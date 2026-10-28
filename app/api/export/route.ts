import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { calculateAffectiveScore } from '@/lib/affective';

/**
 * Export API — Full data export with pagination support
 *
 * Query params:
 *   - limit:  Max records per collection (default: 5000, max: 50000)
 *   - offset: Starting offset for attendance & scores (default: 0)
 *   - sections: Comma-separated list of sections to include
 *               (classrooms,students,attendance,scores,schedules,timetable)
 *               Default: all sections
 */

const MAX_LIMIT = 50000;
const DEFAULT_LIMIT = 5000;

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);

    // Parse pagination params
    const limit = Math.min(
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    // Parse sections filter
    const sectionsParam = searchParams.get('sections');
    const allSections = ['classrooms', 'students', 'attendance', 'scores', 'schedules', 'timetable'];
    const sections = new Set(
      sectionsParam
        ? sectionsParam.split(',').filter(s => allSections.includes(s))
        : allSections
    );

    // Build parallel queries only for requested sections
    const queries: Record<string, Promise<unknown>> = {};

    if (sections.has('classrooms') || sections.has('students') || sections.has('scores')) {
      queries.classrooms = prisma.classroom.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      });
    }

    if (sections.has('students')) {
      queries.students = prisma.student.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          studentCode: true,
          classroomId: true,
          midtermScore: true,
          finalScore: true,
          affectiveScore: true,
          classroom: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      });
    }

    if (sections.has('attendance')) {
      queries.attendance = prisma.attendance.findMany({
        where: { student: { userId: user.id } },
        include: {
          student: { select: { name: true, studentCode: true } },
          classroom: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      });
    }

    if (sections.has('schedules')) {
      queries.schedules = prisma.schedule.findMany({
        where: { userId: user.id },
        orderBy: { scheduledDate: 'asc' },
        take: limit,
        skip: offset,
      });
    }

    if (sections.has('timetable')) {
      queries.timetable = prisma.weeklySchedule.findMany({
        where: { userId: user.id },
        include: { classroom: { select: { name: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: 'asc' }],
      });
    }

    // Execute all queries in parallel
    const results = await Promise.all(
      Object.entries(queries).map(async ([key, promise]) => [key, await promise] as const)
    );
    const data: Record<string, unknown> = Object.fromEntries(results);

    // Type-safe result extraction
    const classrooms = (data.classrooms || []) as Array<{
      id: number; name: string; totalClasses: number; minAttendancePercent: number;
      assignmentWeight: unknown; postTestWeight: unknown; affectiveWeight: unknown;
      midtermWeight: unknown; finalWeight: unknown; midtermMaxScore: unknown;
      finalMaxScore: unknown; lateToAbsentRatio: number; leaveToAbsentRatio: number;
    }>;

    // Fetch scores in bulk (not N+1)
    let scoresData: Array<{
      classroom_name: string; student_code: string; student_name: string;
      lesson_number: number; assignment_score: number | null; post_test_score: number | null;
    }> = [];

    if (sections.has('scores')) {
      const classroomIds = classrooms.map(c => c.id);
      const allScores = classroomIds.length > 0
        ? await prisma.studentScore.findMany({
            where: { classroomId: { in: classroomIds } },
            include: {
              student: { select: { name: true, studentCode: true } },
              classroom: { select: { name: true } },
            },
            take: limit,
            skip: offset,
          })
        : [];

      scoresData = allScores.map(score => ({
        classroom_name: score.classroom?.name || '',
        student_code: score.student?.studentCode || '',
        student_name: score.student?.name || '',
        lesson_number: score.lessonNumber,
        assignment_score: score.assignmentScore !== null ? Number(score.assignmentScore) : null,
        post_test_score: score.postTestScore !== null ? Number(score.postTestScore) : null,
      }));
    }

    // Build O(1) lookup maps for student data transformation
    const classroomMap = new Map(classrooms.map(c => [c.id, c]));

    const attendance = (data.attendance || []) as Array<{
      studentId: number; classroomId: number; date: Date; status: string;
      student?: { name: string; studentCode: string | null } | null;
      classroom?: { name: string } | null;
    }>;

    const attendanceByStudent = new Map<number, typeof attendance>();
    for (const a of attendance) {
      let list = attendanceByStudent.get(a.studentId);
      if (!list) {
        list = [];
        attendanceByStudent.set(a.studentId, list);
      }
      list.push(a);
    }

    const students = (data.students || []) as Array<{
      id: number; name: string; studentCode: string | null; classroomId: number | null;
      midtermScore: unknown; finalScore: unknown; affectiveScore: unknown;
      classroom?: { id: number; name: string } | null;
    }>;

    const schedules = (data.schedules || []) as Array<{
      title: string; subject: string; scheduledDate: Date; startTime: Date;
      endTime: Date; status: string; notes: string | null;
    }>;

    const weeklySchedules = (data.timetable || []) as Array<{
      dayOfWeek: number; startPeriod: number; endPeriod: number;
      subjectCode: string | null; subjectName: string | null; room: string | null;
      groupName: string | null; hours: number;
      classroom?: { name: string } | null;
    }>;

    // Format response data
    const exportData = {
      classrooms: sections.has('classrooms') ? classrooms.map(c => ({
        id: c.id,
        name: c.name,
        total_classes: c.totalClasses,
        min_attendance_percent: c.minAttendancePercent,
        assignment_weight: c.assignmentWeight !== null && c.assignmentWeight !== undefined ? Number(c.assignmentWeight) : null,
        post_test_weight: c.postTestWeight !== null && c.postTestWeight !== undefined ? Number(c.postTestWeight) : null,
        affective_weight: c.affectiveWeight !== null && c.affectiveWeight !== undefined ? Number(c.affectiveWeight) : null,
        midterm_weight: c.midtermWeight !== null && c.midtermWeight !== undefined ? Number(c.midtermWeight) : null,
        final_weight: c.finalWeight !== null && c.finalWeight !== undefined ? Number(c.finalWeight) : null,
        midterm_max_score: c.midtermMaxScore !== null && c.midtermMaxScore !== undefined ? Number(c.midtermMaxScore) : null,
        final_max_score: c.finalMaxScore !== null && c.finalMaxScore !== undefined ? Number(c.finalMaxScore) : null,
        late_to_absent_ratio: c.lateToAbsentRatio,
        leave_to_absent_ratio: c.leaveToAbsentRatio,
      })) : undefined,
      students: sections.has('students') ? students.map(s => {
        const cId = s.classroomId || s.classroom?.id;
        const studentAttendance = attendanceByStudent.get(s.id) || [];
        let absentCount = 0, lateCount = 0;
        for (const a of studentAttendance) {
          if (cId && a.classroomId !== cId) continue;
          if (a.status === 'absent') absentCount++;
          else if (a.status === 'late') lateCount++;
        }
        const classroom = cId ? classroomMap.get(cId) : undefined;
        const weightAffective = classroom?.affectiveWeight !== null && classroom?.affectiveWeight !== undefined ? Number(classroom.affectiveWeight) : 20;
        const finalAffectiveScore = calculateAffectiveScore({
          baseScore: s.affectiveScore !== null && s.affectiveScore !== undefined ? Number(s.affectiveScore) : null,
          maxWeight: weightAffective,
          absentCount,
          lateCount,
        });

        return {
          id: s.id,
          student_code: s.studentCode || '',
          name: s.name,
          classroom: s.classroom?.name || '',
          midterm_score: s.midtermScore !== null && s.midtermScore !== undefined ? Number(s.midtermScore) : null,
          final_score: s.finalScore !== null && s.finalScore !== undefined ? Number(s.finalScore) : null,
          affective_score: finalAffectiveScore,
        };
      }) : undefined,
      attendance: sections.has('attendance') ? attendance.map(a => ({
        student_code: a.student?.studentCode || '',
        student_name: a.student?.name || '',
        classroom: a.classroom?.name || '',
        date: a.date.toISOString().split('T')[0],
        status: a.status,
      })) : undefined,
      scores: sections.has('scores') ? scoresData : undefined,
      schedules: sections.has('schedules') ? schedules.map(s => ({
        lesson_title: s.title || '',
        subject: s.subject || '',
        scheduled_date: s.scheduledDate.toISOString().split('T')[0],
        start_time: s.startTime.toISOString().split('T')[1]?.slice(0, 5) || '',
        end_time: s.endTime.toISOString().split('T')[1]?.slice(0, 5) || '',
        status: s.status,
        notes: s.notes || '',
      })) : undefined,
      timetable: sections.has('timetable') ? weeklySchedules.map(ws => ({
        day_of_week: ws.dayOfWeek,
        start_period: ws.startPeriod,
        end_period: ws.endPeriod,
        subject_code: ws.subjectCode || '',
        subject_name: ws.subjectName || '',
        room: ws.room || '',
        group_name: ws.groupName || '',
        classroom_linked: ws.classroom?.name || '',
        hours: ws.hours,
      })) : undefined,
      exported_at: new Date().toISOString(),
      pagination: {
        limit,
        offset,
        sections: Array.from(sections),
      },
    };

    return NextResponse.json({ data: exportData });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Export error:', error);
    return NextResponse.json({ message: 'Failed to export data' }, { status: 500 });
  }
}
