import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { PERIOD_TIMES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    // Use Thai timezone (UTC+7) to determine "today"
    const nowUtc = new Date();
    const thaiOffsetMs = 7 * 60 * 60 * 1000;
    const nowThai = new Date(nowUtc.getTime() + thaiOffsetMs);
    const jsDay = nowThai.getUTCDay(); // 0=Sun..6=Sat in Thai time
    const schemaDayOfWeek = (jsDay + 6) % 7; // 0=Mon..6=Sun
    const todayDateStr = nowThai.toISOString().split('T')[0];
    const todayDate = new Date(todayDateStr);

    const [classroomCount, studentCount, upcomingSchedulesRaw, weeklyHoursAgg] = await Promise.all([
      prisma.classroom.count({ where: { userId: user.id } }),
      prisma.student.count({ where: { userId: user.id } }),
      prisma.schedule.findMany({
        where: {
          userId: user.id,
          scheduledDate: { gte: todayDate },
          status: 'scheduled',
        },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        take: 5,
      }),
      prisma.weeklySchedule.aggregate({
        where: { userId: user.id },
        _sum: { hours: true },
      }),
    ]);

    const upcomingSchedules = upcomingSchedulesRaw.map(s => ({
      scheduled_date: s.scheduledDate.toISOString(),
      start_time: s.startTime.toISOString().split('T')[1] || '',
      end_time: s.endTime.toISOString().split('T')[1] || '',
      status: s.status,
      lesson_title: s.title,
      subject: s.subject,
    }));

    // --- At-Risk Students (Optimized via Aggregation) ---
    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        lateToAbsentRatio: true,
        leaveToAbsentRatio: true,
        totalClasses: true,
        minAttendancePercent: true,
      },
    });

    const classroomIds = classrooms.map(c => c.id);

    interface AtRiskStudent {
      student_id: number;
      student_name: string;
      student_code: string | null;
      classroom_name: string;
      reason: string;
      type: string;
      absent_count?: number;
      max_allowed?: number;
      remaining?: number;
    }

    const atRiskStudents: AtRiskStudent[] = [];

    if (classroomIds.length > 0) {
      const [students, attendanceCountsGrouped] = await Promise.all([
        prisma.student.findMany({
          where: { classroomId: { in: classroomIds }, userId: user.id },
          select: {
            id: true,
            name: true,
            studentCode: true,
            classroomId: true,
          },
        }),
        prisma.attendance.groupBy({
          by: ['studentId', 'classroomId', 'status'],
          where: {
            classroomId: { in: classroomIds },
            status: { in: ['absent', 'late', 'leave'] },
          },
          _count: true,
        }),
      ]);

      const attStatsMap = new Map<string, { absent: number; late: number; leave: number }>();
      for (const row of attendanceCountsGrouped) {
        const key = `${row.studentId}_${row.classroomId}`;
        if (!attStatsMap.has(key)) {
          attStatsMap.set(key, { absent: 0, late: 0, leave: 0 });
        }
        const s = attStatsMap.get(key)!;
        if (row.status === 'absent') s.absent = row._count;
        else if (row.status === 'late') s.late = row._count;
        else if (row.status === 'leave') s.leave = row._count;
      }

      const classroomMap = new Map(classrooms.map(c => [c.id, c]));

      for (const student of students) {
        if (!student.classroomId) continue;
        const classroom = classroomMap.get(student.classroomId);
        if (!classroom) continue;

        const ratioLate = classroom.lateToAbsentRatio || 3;
        const ratioLeave = classroom.leaveToAbsentRatio || 2;
        const totalClasses = classroom.totalClasses || 40;
        const minAttPercent = classroom.minAttendancePercent || 80;
        const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

        const stats = attStatsMap.get(`${student.id}_${student.classroomId}`) || { absent: 0, late: 0, leave: 0 };
        const convertedFromLate = Math.floor(stats.late / ratioLate);
        const convertedFromLeave = Math.floor(stats.leave / ratioLeave);
        const totalConverted = stats.absent + convertedFromLate + convertedFromLeave;
        const remaining = maxAllowedAbsences - totalConverted;

        if (totalConverted > maxAllowedAbsences) {
          atRiskStudents.push({
            student_id: student.id,
            student_name: student.name,
            student_code: student.studentCode,
            classroom_name: classroom.name,
            reason: 'หมดสิทธิ์สอบแล้ว (เวลาเรียนไม่ถึงเกณฑ์)',
            type: 'attendance_f',
            absent_count: totalConverted,
            max_allowed: maxAllowedAbsences,
            remaining: 0,
          });
        } else if (remaining <= 2 && remaining >= 0) {
          atRiskStudents.push({
            student_id: student.id,
            student_name: student.name,
            student_code: student.studentCode,
            classroom_name: classroom.name,
            reason: `เสี่ยงหมดสิทธิ์สอบ (ขาดได้อีก ${remaining} ครั้ง)`,
            type: 'attendance_warning',
            absent_count: totalConverted,
            max_allowed: maxAllowedAbsences,
            remaining: remaining,
          });
        }
      }
    }

    // --- Pending Tasks & Today Timetable ---
    interface PendingTask {
      type: string;
      classroom_name: string;
      message: string;
      link: string;
    }

    const pendingTasks: PendingTask[] = [];

    const todayTimetable = await prisma.weeklySchedule.findMany({
      where: { userId: user.id, dayOfWeek: schemaDayOfWeek },
      include: { classroom: true },
      orderBy: [{ startPeriod: 'asc' }],
    });

    const classroomIdsToCheck = todayTimetable
      .filter(e => e.classroomId && e.classroom)
      .map(e => e.classroomId!);
    const uniqueClassroomIds = [...new Set(classroomIdsToCheck)];

    const [attendanceCounts, todayAttendanceRecords] = await Promise.all([
      uniqueClassroomIds.length > 0
        ? prisma.attendance.groupBy({
            by: ['classroomId'],
            where: {
              classroomId: { in: uniqueClassroomIds },
              date: todayDate,
            },
            _count: true,
          })
        : [],
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          classroom: { userId: user.id },
          date: todayDate,
        },
        _count: true,
      }),
    ]);

    const classroomHasAttendance = new Set(attendanceCounts.map(a => a.classroomId));

    for (const entry of todayTimetable) {
      if (!entry.classroomId || !entry.classroom) continue;

      if (!classroomHasAttendance.has(entry.classroomId)) {
        if (!pendingTasks.some(t => t.classroom_name === entry.classroom!.name && t.type === 'attendance')) {
          pendingTasks.push({
            type: 'attendance',
            classroom_name: entry.classroom.name,
            message: `ยังไม่เช็คชื่อ "${entry.classroom.name}" วันนี้`,
            link: `/attendance?classroom_id=${entry.classroomId}`,
          });
        }
      }
    }

    // Map today's schedule for frontend timeline
    const todaySchedule = todayTimetable.map(e => {
      const defaultStart = PERIOD_TIMES[e.startPeriod]?.start || '08:00';
      const defaultEnd = PERIOD_TIMES[e.endPeriod]?.end || '09:00';
      const startTimeStr = e.startTime
        ? e.startTime.toISOString().split('T')[1].slice(0, 5)
        : defaultStart;
      const endTimeStr = e.endTime
        ? e.endTime.toISOString().split('T')[1].slice(0, 5)
        : defaultEnd;

      return {
        id: e.id,
        subject_code: e.subjectCode || '',
        subject_name: e.subjectName || e.classroom?.name || 'ไม่มีชื่อวิชา',
        room: e.room || '',
        group_name: e.groupName || '',
        start_period: e.startPeriod,
        end_period: e.endPeriod,
        start_time: startTimeStr,
        end_time: endTimeStr,
        hours: e.hours,
        entry_type: e.entryType,
        color: e.color || '',
        classroom_id: e.classroomId,
        classroom_name: e.classroom?.name || null,
        is_attendance_checked: e.classroomId ? classroomHasAttendance.has(e.classroomId) : false,
      };
    });

    // Compute today's attendance stats
    let totalAttRecords = 0;
    let presentAttRecords = 0;
    for (const att of todayAttendanceRecords) {
      totalAttRecords += att._count;
      if (att.status === 'present') {
        presentAttRecords += att._count;
      }
    }
    const todayAttendanceRate = totalAttRecords > 0
      ? Math.round((presentAttRecords / totalAttRecords) * 100)
      : null;

    const todayStats = {
      totalClasses: todaySchedule.length,
      checkedClasses: todaySchedule.filter(s => s.classroom_id && s.is_attendance_checked).length,
      totalWeeklyHours: weeklyHoursAgg._sum.hours || 0,
      todayAttendanceRate,
    };

    return NextResponse.json({
      data: {
        totalClassrooms: classroomCount,
        totalStudents: studentCount,
        upcomingSchedules,
        atRiskStudents,
        pendingTasks,
        todaySchedule,
        todayStats,
      }
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get dashboard' }, { status: 500 });
  }
}
