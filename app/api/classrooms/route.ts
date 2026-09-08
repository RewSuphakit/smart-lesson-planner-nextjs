import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { ClassroomSchema, validateRequestBody } from '@/lib/validation';
import { resolveTargetWeeks, getCurrentWeek, getSemesterEndDate, getDefaultWeeks, type CurriculumType } from '@/lib/semester';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = classrooms.map((classroom) => {
      const c = classroom as typeof classroom & {
        curriculumType?: string;
        totalWeeks?: number;
        semesterStartDate?: Date | null;
      };
      const semesterStart = c.semesterStartDate ?? null;
      const totalWeeks = resolveTargetWeeks(c);
      const currentWeek = semesterStart ? getCurrentWeek(semesterStart, totalWeeks) : null;
      const semesterEnd = semesterStart ? getSemesterEndDate(semesterStart, totalWeeks) : null;

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        late_to_absent_ratio: c.lateToAbsentRatio,
        leave_to_absent_ratio: c.leaveToAbsentRatio,
        absent_to_f_ratio: c.absentToFRatio,
        total_classes: c.totalClasses,
        min_attendance_percent: c.minAttendancePercent,
        student_count: c._count.students,
        assignment_weight: c.assignmentWeight ? Number(c.assignmentWeight) : 10,
        post_test_weight: c.postTestWeight ? Number(c.postTestWeight) : 70,
        affective_weight: c.affectiveWeight ? Number(c.affectiveWeight) : 20,
        midterm_weight: c.midtermWeight ? Number(c.midtermWeight) : 0,
        final_weight: c.finalWeight ? Number(c.finalWeight) : 0,
        midterm_max_score: c.midtermMaxScore ? Number(c.midtermMaxScore) : 100,
        final_max_score: c.finalMaxScore ? Number(c.finalMaxScore) : 100,
        curriculum_type: c.curriculumType ?? 'pvch',
        total_weeks: totalWeeks,
        semester_start_date: semesterStart ? semesterStart.toISOString().split('T')[0] : null,
        semester_end_date: semesterEnd ? semesterEnd.toISOString().split('T')[0] : null,
        current_week: currentWeek,
      };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get classrooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const validation = await validateRequestBody(request, ClassroomSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      description,
      late_to_absent_ratio,
      leave_to_absent_ratio,
      absent_to_f_ratio,
      total_classes,
      min_attendance_percent,
      assignment_weight,
      post_test_weight,
      affective_weight,
      midterm_weight,
      final_weight,
      midterm_max_score,
      final_max_score,
      curriculum_type,
      total_weeks,
      semester_start_date,
    } = validation.data;

    // Auto-set totalWeeks based on curriculum type if not explicitly provided
    const resolvedWeeks = total_weeks || getDefaultWeeks(curriculum_type as CurriculumType);

    const classroom = await prisma.classroom.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        lateToAbsentRatio: late_to_absent_ratio,
        leaveToAbsentRatio: leave_to_absent_ratio,
        absentToFRatio: absent_to_f_ratio,
        totalClasses: total_classes,
        minAttendancePercent: min_attendance_percent,
        assignmentWeight: assignment_weight,
        postTestWeight: post_test_weight,
        affectiveWeight: affective_weight,
        midtermWeight: midterm_weight,
        finalWeight: final_weight,
        midtermMaxScore: midterm_max_score,
        finalMaxScore: final_max_score,
        curriculumType: curriculum_type || 'pvch',
        totalWeeks: resolvedWeeks,
        semesterStartDate: semester_start_date ? new Date(semester_start_date) : null,
      },
    });

    return NextResponse.json({ data: classroom }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to create classroom' }, { status: 500 });
  }
}
