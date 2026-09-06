import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { calculateAffectiveScore } from '@/lib/affective';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
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
      const criteria = await prisma.gradeCriteria.findMany({
        where: { classroomId: numericClassroomId },
        orderBy: { minScore: 'desc' },
      });
      const mappedCriteria = criteria.map(c => ({
        id: c.id,
        classroom_id: c.classroomId,
        grade: c.grade,
        min_score: Number(c.minScore),
        created_at: c.createdAt,
        updated_at: c.updatedAt
      }));
      return NextResponse.json({ data: mappedCriteria });
    }

    // Get report weights & settings
    const weightAssign = Number(classroom.assignmentWeight ?? 10);
    const weightPostTest = Number(classroom.postTestWeight ?? 70);
    const weightAffective = Number(classroom.affectiveWeight ?? 20);
    const weightMidterm = Number(classroom.midtermWeight ?? 0);
    const weightFinal = Number(classroom.finalWeight ?? 0);
    const maxMidtermScore = Number(classroom.midtermMaxScore ?? 100);
    const maxFinalScore = Number(classroom.finalMaxScore ?? 100);

    // Determine target weeks based on classroom level (ปวส = 15 weeks, ปวช = 18 weeks) or structures
    const isPws = classroom.name?.includes('ปวส') || 
                  classroom.name?.includes('ปวส.') || 
                  classroom.description?.includes('ปวส') || 
                  classroom.description?.includes('ปวส.');

    const maxLessonAgg = await prisma.scoreStructure.aggregate({
      where: { classroomId: numericClassroomId },
      _max: { lessonNumber: true },
    });

    const weeksParam = searchParams.get('weeks');
    let targetWeeks = 18;

    if (weeksParam && !isNaN(Number(weeksParam))) {
      targetWeeks = Number(weeksParam);
    } else if (isPws) {
      // For ปวส curriculum, cap standard weeks at 15
      targetWeeks = maxLessonAgg._max.lessonNumber && maxLessonAgg._max.lessonNumber <= 15
        ? maxLessonAgg._max.lessonNumber
        : 15;
    } else if (classroom.name?.includes('ปวช') || classroom.name?.includes('ปวช.')) {
      targetWeeks = maxLessonAgg._max.lessonNumber || 18;
    } else {
      targetWeeks = maxLessonAgg._max.lessonNumber || 18;
    }

    // Get max possible scores from score_structures up to targetWeeks
    const structureAgg = await prisma.scoreStructure.aggregate({
      where: { 
        classroomId: numericClassroomId,
        lessonNumber: { lte: targetWeeks }
      },
      _sum: { maxAssignmentScore: true, maxPostTestScore: true },
    });
    let maxAssignRaw = Number(structureAgg._sum.maxAssignmentScore ?? 0);
    let maxPostTestRaw = Number(structureAgg._sum.maxPostTestScore ?? 0);

    // Fallback if no structures exist in DB yet: standard 10 points per week
    if (maxAssignRaw === 0) {
      maxAssignRaw = targetWeeks * 10;
    }
    if (maxPostTestRaw === 0) {
      maxPostTestRaw = targetWeeks * 10;
    }

    // Get students with scores and attendance
    const students = await prisma.student.findMany({
      where: { classroomId: numericClassroomId },
      include: {
        studentScores: true,
        attendance: { where: { classroomId: numericClassroomId } },
      },
      orderBy: [{ studentCode: 'asc' }, { name: 'asc' }],
    });

    // Get criteria (with official vocational 8-level fallback if not yet set)
    const dbCriteria = await prisma.gradeCriteria.findMany({
      where: { classroomId: numericClassroomId },
      orderBy: { minScore: 'desc' },
    });
    const criteria = dbCriteria.length > 0 ? dbCriteria.map(c => ({ grade: c.grade, minScore: Number(c.minScore) })) : [
      { grade: '4', minScore: 80 },
      { grade: '3.5', minScore: 75 },
      { grade: '3', minScore: 70 },
      { grade: '2.5', minScore: 65 },
      { grade: '2', minScore: 60 },
      { grade: '1.5', minScore: 55 },
      { grade: '1', minScore: 50 },
      { grade: '0', minScore: 0 },
    ];

    // Get attendance config
    const ratioLate = classroom.lateToAbsentRatio || 3;
    const ratioLeave = classroom.leaveToAbsentRatio || 2;
    const totalClasses = classroom.totalClasses || 40;
    const minAttPercent = classroom.minAttendancePercent || 80;
    const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

    const totalWeightSum = weightAssign + weightPostTest + weightAffective + weightMidterm + weightFinal;

    const report = students.map((s) => {
      // Attendance stats
      let lateCount = 0, absentCount = 0, leaveCount = 0;
      for (const a of s.attendance) {
        if (a.status === 'late') lateCount++;
        else if (a.status === 'absent') absentCount++;
        else if (a.status === 'leave') leaveCount++;
      }
      const convertedFromLate = Math.floor(lateCount / ratioLate);
      const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
      const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
      const isF = totalConverted > maxAllowedAbsences;
      const attendancePercent = totalClasses > 0
        ? Math.max(0, Math.min(100, Math.round(((totalClasses - totalConverted) / totalClasses) * 100)))
        : 100;

      // Score calculation up to targetWeeks
      const sumAssignRaw = s.studentScores
        .filter(sc => sc.lessonNumber <= targetWeeks)
        .reduce((acc, sc) => acc + Number(sc.assignmentScore ?? 0), 0);
      const sumPostTestRaw = s.studentScores
        .filter(sc => sc.lessonNumber <= targetWeeks)
        .reduce((acc, sc) => acc + Number(sc.postTestScore ?? 0), 0);
      const midtermScore = Number(s.midtermScore ?? 0);
      
      const rawFinalScore = s.finalScore !== null ? Number(s.finalScore) : null;
      const isAbsentFinal = rawFinalScore === -1;
      const isIncomplete = rawFinalScore === -2;
      const finalScore = (rawFinalScore === null || rawFinalScore < 0) ? 0 : rawFinalScore;

      const preciseScaledAssign = maxAssignRaw > 0 ? (sumAssignRaw / maxAssignRaw) * weightAssign : 0;
      const preciseScaledPostTest = maxPostTestRaw > 0 ? (sumPostTestRaw / maxPostTestRaw) * weightPostTest : 0;
      const preciseScaledMidterm = maxMidtermScore > 0 ? (midtermScore / maxMidtermScore) * weightMidterm : 0;
      const preciseScaledFinal = maxFinalScore > 0 ? (finalScore / maxFinalScore) * weightFinal : 0;

      // Affective score calculation via shared helper
      const affectiveScore = calculateAffectiveScore({
        baseScore: s.affectiveScore ? Number(s.affectiveScore) : null,
        maxWeight: weightAffective,
        absentCount,
        lateCount,
      });

      const totalScorePrecise = preciseScaledAssign + preciseScaledPostTest + affectiveScore + preciseScaledMidterm + preciseScaledFinal;
      const percentage = totalWeightSum > 0 ? (totalScorePrecise / totalWeightSum) * 100 : 0;

      // Determine final grade according to official vocational education (สอศ.) rules
      let finalGrade: string | null = null;
      if (isF) {
        finalGrade = 'ข.ร.';
      } else if (isAbsentFinal) {
        finalGrade = 'ข.ส.';
      } else if (isIncomplete) {
        finalGrade = 'ม.ส.';
      } else {
        for (const c of criteria) {
          if (percentage >= Number(c.minScore)) {
            finalGrade = c.grade;
            break;
          }
        }
      }

      return {
        student_id: s.id,
        name: s.name,
        student_code: s.studentCode,
        midterm_score: midtermScore,
        final_score: rawFinalScore,
        is_absent_final: isAbsentFinal,
        is_incomplete: isIncomplete,
        raw_assign: sumAssignRaw,
        max_assign: maxAssignRaw,
        precise_scaled_assign: preciseScaledAssign,
        scaled_assign: Math.round(preciseScaledAssign),
        raw_post_test: sumPostTestRaw,
        max_post_test: maxPostTestRaw,
        precise_scaled_post_test: preciseScaledPostTest,
        scaled_post_test: Math.round(preciseScaledPostTest),
        precise_scaled_midterm: preciseScaledMidterm,
        scaled_midterm: Math.round(preciseScaledMidterm),
        precise_scaled_final: preciseScaledFinal,
        scaled_final: Math.round(preciseScaledFinal),
        total_score_precise: totalScorePrecise,
        total_score: Math.round(totalScorePrecise),
        affective_score: affectiveScore,
        percentage: percentage.toFixed(2),
        attendance_percent: attendancePercent,
        grade: finalGrade || 'ไม่มีเกรด',
        is_f: isF,
        absent_count: absentCount,
        late_count: lateCount,
        max_allowed_absences: maxAllowedAbsences,
        remaining_absences: maxAllowedAbsences - totalConverted,
      };
    });

    return NextResponse.json({
      data: report,
      weights: {
        assignment_weight: weightAssign,
        post_test_weight: weightPostTest,
        affective_weight: weightAffective,
        midterm_weight: weightMidterm,
        final_weight: weightFinal,
        midterm_max_score: maxMidtermScore,
        final_max_score: maxFinalScore,
        total_weight_sum: totalWeightSum,
        target_weeks: targetWeeks,
        is_pws: isPws,
        max_assign_raw: maxAssignRaw,
        max_post_test_raw: maxPostTestRaw,
      }
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Get grades error:', error);
    return NextResponse.json({ message: 'Failed to get grades' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
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

    // Save criteria atomically via transaction
    const operations = [
      prisma.gradeCriteria.deleteMany({ where: { classroomId: Number(classroomId) } }),
    ];

    if (body.criteria && body.criteria.length > 0) {
      operations.push(
        prisma.gradeCriteria.createMany({
          data: body.criteria.map((c: { grade: string; min_score: string | number }) => ({
            classroomId: Number(classroomId),
            grade: c.grade,
            minScore: isNaN(Number(c.min_score)) ? 0 : Number(c.min_score),
          })),
        })
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ message: 'Criteria saved' });
  } catch (error) {
    console.error('Save criteria error:', error);
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to save criteria' }, { status: 500 });
  }
}

