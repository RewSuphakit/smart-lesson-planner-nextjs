import { NextResponse } from 'next/server';
import prisma, { withDbRetry } from '@/lib/prisma';
import { CurriculumType } from '@prisma/client';
import { withAuth } from '@/lib/apiHandler';
import { ClassroomSchema, validateRequestBody } from '@/lib/validation';
import { getDefaultWeeks, getActiveSemesterId } from '@/lib/semester';
import { formatClassroomResponse } from '@/lib/formatters';
import { getOrSetCache, userCacheKey, invalidateCache } from '@/lib/cache';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const semesterIdParam = searchParams.get('semester_id');
  const allSemesters = searchParams.get('all') === 'true';

  let targetSemesterId: number | null = null;
  if (!allSemesters) {
    if (semesterIdParam) {
      const semesterId = Number(semesterIdParam);
      if (!isNaN(semesterId) && semesterId > 0) {
        targetSemesterId = semesterId;
      }
    } else {
      targetSemesterId = await getActiveSemesterId(user.id);
    }
  }

  const cacheKey = userCacheKey(
    user.id,
    'classrooms',
    allSemesters ? 'all' : String(targetSemesterId ?? 'none')
  );

  const result = await getOrSetCache(cacheKey, 60, async () => {
    // Build where clause with semester scoping
    const where: Record<string, unknown> = { userId: user.id };
    if (!allSemesters && targetSemesterId) {
      where.semesterId = targetSemesterId;
    }

    const classrooms = await withDbRetry(() =>
      prisma.classroom.findMany({
        where,
        include: {
          _count: { select: { students: true } },
          semester: { select: { id: true, name: true, termNumber: true, academicYear: true, startDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    );

    return classrooms.map((classroom) => formatClassroomResponse(classroom));
  });

  return NextResponse.json({ data: result });
}, 'Failed to get classrooms');

export const POST = withAuth(async (request, user) => {
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
    late_deduction_score,
    absent_deduction_score,
    midterm_weight,
    final_weight,
    midterm_max_score,
    final_max_score,
    curriculum_type,
    total_weeks,
    semester_start_date,
    semester_id,
    is_portal_enabled,
  } = validation.data;

  // Resolve semester: explicit > active > null
  let resolvedSemesterId = semester_id || null;
  if (resolvedSemesterId) {
    const ownedSemester = await prisma.semester.findFirst({
      where: { id: resolvedSemesterId, userId: user.id },
    });
    if (!ownedSemester) {
      return NextResponse.json({ message: 'Target semester not found or unauthorized' }, { status: 403 });
    }
  } else {
    resolvedSemesterId = await getActiveSemesterId(user.id);
  }

  // Auto-set totalWeeks based on curriculum type if not explicitly provided
  const resolvedWeeks = total_weeks || getDefaultWeeks(curriculum_type as CurriculumType);

  const classroom = await prisma.classroom.create({
    data: {
      userId: user.id,
      semesterId: resolvedSemesterId,
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
      lateDeductionScore: late_deduction_score,
      absentDeductionScore: absent_deduction_score,
      midtermWeight: midterm_weight,
      finalWeight: final_weight,
      midtermMaxScore: midterm_max_score,
      finalMaxScore: final_max_score,
      curriculumType: (curriculum_type as CurriculumType) || CurriculumType.pvch,
      totalWeeks: resolvedWeeks,
      semesterStartDate: semester_start_date ? new Date(semester_start_date) : null,
      isPortalEnabled: is_portal_enabled ?? true,
    },
  });

  invalidateCache(userCacheKey(user.id, 'classrooms'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));

  return NextResponse.json({ data: classroom }, { status: 201 });
}, 'Failed to create classroom');
