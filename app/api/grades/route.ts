import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { resolveTargetWeeks } from '@/lib/semester';
import { getOrSetCache, userCacheKey, invalidateCache, memoryCache } from '@/lib/cache';
import { getAttendanceConfig, computeAbsentConversion } from '@/lib/formatters';
import {
  extractClassroomWeights,
  normalizeGradeCriteria,
  calculateStudentGradeSummary,
} from '@/lib/gradeCalculator';
import { resolveStudentAvatarUrl } from '@/lib/avatarStorage';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroom_id');

  if (!classroomId) {
    return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
  }

  const numericClassroomId = Number(classroomId);

  // Verify classroom ownership
  const classroom = await prisma.classroom.findFirst({
    where: { id: numericClassroomId, userId: user.id }
  });
  if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

  // Get criteria
  if (searchParams.get('type') === 'criteria') {
    const mappedCriteria = await getOrSetCache(
      userCacheKey(user.id, 'grades:criteria', numericClassroomId),
      120,
      async () => {
        const criteria = await prisma.gradeCriteria.findMany({
          where: { classroomId: numericClassroomId },
          orderBy: { minScore: 'desc' },
        });
        return criteria.map(c => ({
          id: c.id,
          classroom_id: c.classroomId,
          grade: c.grade,
          min_score: Number(c.minScore),
          created_at: c.createdAt,
          updated_at: c.updatedAt
        }));
      }
    );
    return NextResponse.json({ data: mappedCriteria });
  }

  // Report cache (45s). Invalidated via the broad `grades` prefix on attendance/score/student/classroom writes.
  const reportCacheKey = userCacheKey(user.id, 'grades:report', numericClassroomId, searchParams.get('weeks') ?? '');
  const cachedReport = memoryCache.get<Record<string, unknown>>(reportCacheKey);
  if (cachedReport) return NextResponse.json(cachedReport);

  // Get report weights & settings via centralized gradeCalculator
  const weightsConfig = extractClassroomWeights(classroom);
  const {
    assignmentWeight: weightAssign,
    postTestWeight: weightPostTest,
    affectiveWeight: weightAffective,
    lateDeductionScore: lateDeduction,
    absentDeductionScore: absentDeduction,
    midtermWeight: weightMidterm,
    finalWeight: weightFinal,
    midtermMaxScore: maxMidtermScore,
    finalMaxScore: maxFinalScore,
    totalWeightSum,
  } = weightsConfig;

  // Resolve target weeks from classroom settings (replaces old name-guessing logic)
  const weeksParam = searchParams.get('weeks');
  let targetWeeks: number;

  if (weeksParam && !isNaN(Number(weeksParam))) {
    targetWeeks = Number(weeksParam);
  } else {
    targetWeeks = resolveTargetWeeks(classroom);
  }

  // Parallelize independent queries: structure aggregates, students with scores/attendance, criteria
  // Aggregate in the database (groupBy) instead of loading every attendance/score row per student.
  const [structureAgg, students, dbCriteria, attendanceGrouped, scoreSums] = await Promise.all([
    prisma.scoreStructure.aggregate({
      where: { 
        classroomId: numericClassroomId,
        lessonNumber: { lte: targetWeeks }
      },
      _sum: { maxAssignmentScore: true, maxPostTestScore: true },
    }),
    prisma.student.findMany({
      where: { classroomId: numericClassroomId },
      select: {
        id: true,
        name: true,
        studentCode: true,
        gradeLevel: true,
        branch: true,
        avatar: true,
        updatedAt: true,
        midtermScore: true,
        finalScore: true,
        examStatus: true,
        affectiveScore: true,
      },
      orderBy: [{ gradeLevel: 'asc' }, { studentCode: 'asc' }, { name: 'asc' }],
    }),
    prisma.gradeCriteria.findMany({
      where: { classroomId: numericClassroomId },
      select: { grade: true, minScore: true },
      orderBy: { minScore: 'desc' },
    }),
    prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { classroomId: numericClassroomId, status: { in: ['late', 'absent', 'leave'] } },
      _count: true,
    }),
    prisma.studentScore.groupBy({
      by: ['studentId'],
      where: { classroomId: numericClassroomId, lessonNumber: { lte: targetWeeks } },
      _sum: { assignmentScore: true, postTestScore: true },
    }),
  ]);

  const attByStudent = new Map<number, { late: number; absent: number; leave: number }>();
  for (const row of attendanceGrouped) {
    const e = attByStudent.get(row.studentId) ?? { late: 0, absent: 0, leave: 0 };
    if (row.status === 'late') e.late = row._count;
    else if (row.status === 'absent') e.absent = row._count;
    else if (row.status === 'leave') e.leave = row._count;
    attByStudent.set(row.studentId, e);
  }
  const scoreByStudent = new Map(scoreSums.map((r) => [r.studentId, r._sum]));

  let maxAssignRaw = Number(structureAgg._sum.maxAssignmentScore ?? 0);
  let maxPostTestRaw = Number(structureAgg._sum.maxPostTestScore ?? 0);

  // Fallback if no structures exist in DB yet: standard 10 points per week
  if (maxAssignRaw === 0) {
    maxAssignRaw = targetWeeks * 10;
  }
  if (maxPostTestRaw === 0) {
    maxPostTestRaw = targetWeeks * 10;
  }

  const criteria = normalizeGradeCriteria(dbCriteria);

  // Get attendance config
  const attConfig = getAttendanceConfig(classroom);

  const report = students.map((s) => {
    // Attendance stats
    const att = attByStudent.get(s.id);
    const lateCount = att?.late ?? 0;
    const absentCount = att?.absent ?? 0;
    const leaveCount = att?.leave ?? 0;
    const attConv = computeAbsentConversion({ absent: absentCount, late: lateCount, leave: leaveCount }, attConfig);
    const isF = attConv.isF;
    const attendancePercent = attConv.attendancePercent;

    // Single-pass score calculation up to targetWeeks via shared gradeCalculator
    const sums = scoreByStudent.get(s.id);
    const sumAssignRaw = Number(sums?.assignmentScore ?? 0);
    const sumPostTestRaw = Number(sums?.postTestScore ?? 0);

    const calc = calculateStudentGradeSummary({
      sumAssignRaw,
      maxAssignRaw,
      sumPostTestRaw,
      maxPostTestRaw,
      midtermScore: s.midtermScore,
      finalScore: s.finalScore,
      examStatus: s.examStatus,
      baseAffectiveScore: s.affectiveScore,
      absentCount,
      lateCount,
      isF,
      weights: weightsConfig,
      criteria,
    });

    return {
      id: s.id,
      student_id: s.id,
      name: s.name,
      student_code: s.studentCode,
      grade_level: s.gradeLevel,
      branch: s.branch,
      avatar: resolveStudentAvatarUrl(s.id, s.avatar, s.updatedAt),
      midterm_score: calc.midtermScore,
      final_score: calc.rawFinalScore,
      exam_status: calc.examStatus,
      is_absent_final: calc.isAbsentFinal,
      is_incomplete: calc.isIncomplete,
      raw_assign: sumAssignRaw,
      max_assign: maxAssignRaw,
      precise_scaled_assign: calc.preciseScaledAssign,
      scaled_assign: calc.scaledAssign,
      raw_post_test: sumPostTestRaw,
      max_post_test: maxPostTestRaw,
      precise_scaled_post_test: calc.preciseScaledPostTest,
      scaled_post_test: calc.scaledPostTest,
      precise_scaled_midterm: calc.preciseScaledMidterm,
      scaled_midterm: calc.scaledMidterm,
      precise_scaled_final: calc.preciseScaledFinal,
      scaled_final: calc.scaledFinal,
      total_score_precise: calc.totalScorePrecise,
      total_score: calc.totalScore,
      affective_score: calc.affectiveScore,
      percentage: calc.percentage,
      attendance_percent: attendancePercent,
      grade: calc.grade || 'ไม่มีเกรด',
      is_f: isF,
      absent_count: absentCount,
      late_count: lateCount,
      max_allowed_absences: attConv.maxAllowedAbsences,
      remaining_absences: attConv.remaining,
    };
  });

  const responseBody = {
    data: report,
    criteria: criteria.map(c => ({ grade: c.grade, min_score: c.minScore })),
    weights: {
      assignment_weight: weightAssign,
      post_test_weight: weightPostTest,
      affective_weight: weightAffective,
      late_deduction_score: lateDeduction,
      absent_deduction_score: absentDeduction,
      midterm_weight: weightMidterm,
      final_weight: weightFinal,
      midterm_max_score: maxMidtermScore,
      final_max_score: maxFinalScore,
      total_weight_sum: totalWeightSum,
      target_weeks: targetWeeks,
      is_pws: (classroom.curriculumType ?? 'pvch') === 'pvs',
      max_assign_raw: maxAssignRaw,
      max_post_test_raw: maxPostTestRaw,
    }
  };
  memoryCache.set(reportCacheKey, responseBody, 45);
  return NextResponse.json(responseBody);
}, 'Failed to get grades');

export const POST = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const body = await request.json();

  const classroomId = Number(body.classroom_id || searchParams.get('classroom_id'));
  if (!classroomId) {
    return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
  }

  // Verify classroom ownership
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, userId: user.id }
  });
  if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

  // Save criteria atomically via interactive transaction
  await prisma.$transaction(async (tx) => {
    await tx.gradeCriteria.deleteMany({ where: { classroomId: Number(classroomId) } });

    if (body.criteria && body.criteria.length > 0) {
      await tx.gradeCriteria.createMany({
        data: body.criteria.map((c: { grade: string; min_score: string | number }) => ({
          classroomId: Number(classroomId),
          grade: c.grade,
          minScore: isNaN(Number(c.min_score)) ? 0 : Number(c.min_score),
        })),
      });
    }
  });

  invalidateCache(userCacheKey(user.id, 'grades:criteria', classroomId));
  invalidateCache(userCacheKey(user.id, 'grades:report', classroomId));

  return NextResponse.json({ message: 'Criteria saved' });
}, 'Failed to save criteria');

