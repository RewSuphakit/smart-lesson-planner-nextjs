import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CurriculumType } from '@prisma/client';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { ClassroomSchema, validateRequestBody } from '@/lib/validation';
import { getDefaultWeeks } from '@/lib/semester';
import { formatClassroomResponse } from '@/lib/formatters';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = classrooms.map((classroom) => formatClassroomResponse(classroom));

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
        curriculumType: (curriculum_type as CurriculumType) || CurriculumType.pvch,
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
