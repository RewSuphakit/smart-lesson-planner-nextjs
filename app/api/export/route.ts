import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    // Fetch all user data in parallel
    const [classrooms, students, attendance, schedules, weeklySchedules] = await Promise.all([
      prisma.classroom.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      }),
      prisma.student.findMany({
        where: { userId: user.id },
        include: {
          classroom: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.attendance.findMany({
        where: {
          student: { userId: user.id },
        },
        include: {
          student: { select: { name: true, studentCode: true } },
          classroom: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.schedule.findMany({
        where: { userId: user.id },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.weeklySchedule.findMany({
        where: { userId: user.id },
        include: {
          classroom: { select: { name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: 'asc' }],
      }),
    ]);

    // BUG-06 fix: Fetch all scores in one query instead of N+1 loop
    const classroomIds = classrooms.map(c => c.id);
    const allScores = classroomIds.length > 0
      ? await prisma.studentScore.findMany({
          where: { classroomId: { in: classroomIds } },
          include: {
            student: { select: { name: true, studentCode: true } },
            classroom: { select: { name: true } },
          },
        })
      : [];

    const scoresData = allScores.map(score => ({
      classroom_name: score.classroom?.name || '',
      student_code: score.student?.studentCode || '',
      student_name: score.student?.name || '',
      lesson_number: score.lessonNumber,
      assignment_score: score.assignmentScore !== null ? Number(score.assignmentScore) : null,
      post_test_score: score.postTestScore !== null ? Number(score.postTestScore) : null,
    }));

    // Format data for export
    const exportData = {
      classrooms: classrooms.map(c => ({
        id: c.id,
        name: c.name,
        total_classes: c.totalClasses,
        min_attendance_percent: c.minAttendancePercent,
        assignment_weight: c.assignmentWeight,
        post_test_weight: c.postTestWeight,
        affective_weight: c.affectiveWeight,
        midterm_weight: c.midtermWeight,
        final_weight: c.finalWeight,
        midterm_max_score: c.midtermMaxScore,
        final_max_score: c.finalMaxScore,
        late_to_absent_ratio: c.lateToAbsentRatio,
        leave_to_absent_ratio: c.leaveToAbsentRatio,
      })),
      students: students.map(s => ({
        id: s.id,
        student_code: s.studentCode || '',
        name: s.name,
        classroom: s.classroom?.name || '',
        midterm_score: s.midtermScore,
        final_score: s.finalScore,
        affective_score: s.affectiveScore,
      })),
      attendance: attendance.map(a => ({
        student_code: a.student?.studentCode || '',
        student_name: a.student?.name || '',
        classroom: a.classroom?.name || '',
        date: a.date.toISOString().split('T')[0],
        status: a.status,
      })),
      scores: scoresData,
      schedules: schedules.map(s => ({
        lesson_title: s.title || '',
        subject: s.subject || '',
        scheduled_date: s.scheduledDate.toISOString().split('T')[0],
        start_time: s.startTime.toISOString().split('T')[1]?.slice(0, 5) || '',
        end_time: s.endTime.toISOString().split('T')[1]?.slice(0, 5) || '',
        status: s.status,
        notes: s.notes || '',
      })),
      timetable: weeklySchedules.map(ws => ({
        day_of_week: ws.dayOfWeek,
        start_period: ws.startPeriod,
        end_period: ws.endPeriod,
        subject_code: ws.subjectCode || '',
        subject_name: ws.subjectName || '',
        room: ws.room || '',
        group_name: ws.groupName || '',
        classroom_linked: ws.classroom?.name || '',
        hours: ws.hours,
      })),
      exported_at: new Date().toISOString(),
      total_counts: {
        classrooms: classrooms.length,
        students: students.length,
        attendance_records: attendance.length,
        scores: scoresData.length,
        schedules: schedules.length,
        timetable_entries: weeklySchedules.length,
      },
    };

    return NextResponse.json({ data: exportData });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Export error:', error);
    return NextResponse.json({ message: 'Failed to export data' }, { status: 500 });
  }
}
