import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const [classroomCount, studentCount, upcomingSchedulesRaw] = await Promise.all([
      prisma.classroom.count({ where: { userId: user.id } }),
      prisma.student.count({ where: { userId: user.id } }),
      prisma.schedule.findMany({
        where: {
          userId: user.id,
          scheduledDate: { gte: new Date() },
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

    // Check today's timetable vs attendance
    const jsDay = new Date().getDay(); // 0=Sun..6=Sat
    const schemaDayOfWeek = (jsDay + 6) % 7; // 0=Mon..6=Sun

    const todayTimetable = await prisma.weeklySchedule.findMany({
      where: { userId: user.id, dayOfWeek: schemaDayOfWeek },
      include: { classroom: true },
    });

    const todayDateStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayDateStr);

    for (const entry of todayTimetable) {
      if (!entry.classroomId || !entry.classroom) continue;

      // Check if any attendance records exist for this classroom today
      const attendanceCount = await prisma.attendance.count({
        where: {
          classroomId: entry.classroomId,
          date: todayDate,
        },
      });

      if (attendanceCount === 0) {
        // Only add if not already in pendingTasks for this classroom
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
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get dashboard' }, { status: 500 });
  }
}
