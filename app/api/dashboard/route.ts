import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

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

    const [classroomCount, studentCount, upcomingSchedulesRaw] = await Promise.all([
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
      })
    ]);

    const upcomingSchedules = upcomingSchedulesRaw.map(s => ({
      scheduled_date: s.scheduledDate.toISOString(),
      start_time: s.startTime.toISOString().split('T')[1] || '',
      end_time: s.endTime.toISOString().split('T')[1] || '',
      status: s.status,
      lesson_title: s.title,
      subject: s.subject,
    }));

    // --- At-Risk Students ---
    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      include: {
        students: {
          include: {
            attendance: true,
          },
        },
      },
    });

    interface AtRiskStudent {
      student_id: number;
      student_name: string;
      student_code: string | null;
      classroom_name: string;
      reason: string;
      type: string;
    }

    const atRiskStudents: AtRiskStudent[] = [];

    for (const classroom of classrooms) {
      const ratioLate = classroom.lateToAbsentRatio || 3;
      const ratioLeave = classroom.leaveToAbsentRatio || 2;
      const totalClasses = classroom.totalClasses || 40;
      const minAttPercent = classroom.minAttendancePercent || 80;
      const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

      for (const student of classroom.students) {
        let absentCount = 0, lateCount = 0, leaveCount = 0;
        for (const a of student.attendance) {
          if (a.classroomId !== classroom.id) continue;
          if (a.status === 'absent') absentCount++;
          else if (a.status === 'late') lateCount++;
          else if (a.status === 'leave') leaveCount++;
        }
        const convertedFromLate = Math.floor(lateCount / ratioLate);
        const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
        const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
        const remaining = maxAllowedAbsences - totalConverted;

        if (totalConverted > maxAllowedAbsences) {
          atRiskStudents.push({
            student_id: student.id,
            student_name: student.name,
            student_code: student.studentCode,
            classroom_name: classroom.name,
            reason: 'หมดสิทธิ์สอบแล้ว (เวลาเรียนไม่ถึงเกณฑ์)',
            type: 'attendance_f',
          });
        } else if (remaining <= 2 && remaining >= 0) {
          atRiskStudents.push({
            student_id: student.id,
            student_name: student.name,
            student_code: student.studentCode,
            classroom_name: classroom.name,
            reason: `เสี่ยงหมดสิทธิ์สอบ (ขาดได้อีก ${remaining} ครั้ง)`,
            type: 'attendance_warning',
          });
        }
      }
    }

    // --- Pending Tasks ---
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
    });



    // BUG-07 fix: batch attendance count instead of N+1 loop
    const classroomIdsToCheck = todayTimetable
      .filter(e => e.classroomId && e.classroom)
      .map(e => e.classroomId!);
    const uniqueClassroomIds = [...new Set(classroomIdsToCheck)];

    const attendanceCounts = uniqueClassroomIds.length > 0
      ? await prisma.attendance.groupBy({
          by: ['classroomId'],
          where: {
            classroomId: { in: uniqueClassroomIds },
            date: todayDate,
          },
          _count: true,
        })
      : [];

    const classroomHasAttendance = new Set(attendanceCounts.map(a => a.classroomId));

    for (const entry of todayTimetable) {
      if (!entry.classroomId || !entry.classroom) continue;

      if (!classroomHasAttendance.has(entry.classroomId)) {
        if (!pendingTasks.some(t => t.classroom_name === entry.classroom!.name && t.type === 'attendance')) {
          pendingTasks.push({
            type: 'attendance',
            classroom_name: entry.classroom.name,
            message: `ยังไม่เช็คชื่อ "${entry.classroom.name}" วันนี้`,
            link: '/attendance',
          });
        }
      }
    }

    return NextResponse.json({
      data: {
        totalClassrooms: classroomCount,
        totalStudents: studentCount,
        upcomingSchedules,
        atRiskStudents,
        pendingTasks,
      }
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get dashboard' }, { status: 500 });
  }
}
