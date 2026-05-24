import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(classroomId), userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    // Get criteria
    if (searchParams.get('type') === 'criteria') {
      const criteria = await prisma.gradeCriteria.findMany({
        where: { classroomId: Number(classroomId) },
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

    // Get report
    const weightAssign = Number(classroom.assignmentWeight ?? 10);
    const weightPostTest = Number(classroom.postTestWeight ?? 70);
    const weightAffective = Number(classroom.affectiveWeight ?? 20);
    const weightMidterm = Number(classroom.midtermWeight ?? 0);
    const weightFinal = Number(classroom.finalWeight ?? 0);
    const maxMidtermScore = Number(classroom.midtermMaxScore ?? 100);
    const maxFinalScore = Number(classroom.finalMaxScore ?? 100);

    // Get target weeks based on totalClasses
    const total = classroom.totalClasses || 40;
    let targetWeeks = 18;
    if (total % 18 !== 0) {
      for (let w = 15; w <= 20; w++) {
        if (total % w === 0) {
          targetWeeks = w;
          break;
        }
      }
    }

    // Get max possible scores from score_structures up to targetWeeks
    const structureAgg = await prisma.scoreStructure.aggregate({
      where: { 
        classroomId: Number(classroomId),
        lessonNumber: { lte: targetWeeks }
      },
      _sum: { maxAssignmentScore: true, maxPostTestScore: true },
    });
    const maxAssignRaw = Number(structureAgg._sum.maxAssignmentScore ?? 0);
    const maxPostTestRaw = Number(structureAgg._sum.maxPostTestScore ?? 0);

    // Get students with scores
    const students = await prisma.student.findMany({
      where: { classroomId: Number(classroomId) },
      include: {
        studentScores: true,
        attendance: { where: { classroomId: Number(classroomId) } },
      },
    });

    // Get criteria
    const criteria = await prisma.gradeCriteria.findMany({
      where: { classroomId: Number(classroomId) },
      orderBy: { minScore: 'desc' },
    });

    // Get attendance config
    const ratioLate = classroom.lateToAbsentRatio || 3;
    const ratioLeave = classroom.leaveToAbsentRatio || 2;
    const totalClasses = classroom.totalClasses || 40;
    const minAttPercent = classroom.minAttendancePercent || 80;
    const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

    const report = students.map((s) => {
      // Attendance stats
      let presentCount = 0, lateCount = 0, absentCount = 0, leaveCount = 0;
      for (const a of s.attendance) {
        if (a.status === 'present') presentCount++;
        else if (a.status === 'late') lateCount++;
        else if (a.status === 'absent') absentCount++;
        else if (a.status === 'leave') leaveCount++;
      }
      const convertedFromLate = Math.floor(lateCount / ratioLate);
      const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
      const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
      const isF = totalConverted > maxAllowedAbsences;

      // Score calculation up to targetWeeks
      const sumAssignRaw = s.studentScores
        .filter(sc => sc.lessonNumber <= targetWeeks)
        .reduce((acc, sc) => acc + Number(sc.assignmentScore ?? 0), 0);
      const sumPostTestRaw = s.studentScores
        .filter(sc => sc.lessonNumber <= targetWeeks)
        .reduce((acc, sc) => acc + Number(sc.postTestScore ?? 0), 0);
      const midtermScore = Number(s.midtermScore ?? 0);
      const finalScore = Number(s.finalScore ?? 0);

      const preciseScaledAssign = maxAssignRaw > 0 ? (sumAssignRaw / maxAssignRaw) * weightAssign : 0;
      const preciseScaledPostTest = maxPostTestRaw > 0 ? (sumPostTestRaw / maxPostTestRaw) * weightPostTest : 0;
      const preciseScaledMidterm = maxMidtermScore > 0 ? (midtermScore / maxMidtermScore) * weightMidterm : 0;
      const preciseScaledFinal = maxFinalScore > 0 ? (finalScore / maxFinalScore) * weightFinal : 0;

      const scaledAssign = Math.round(preciseScaledAssign);
      const scaledPostTest = Math.round(preciseScaledPostTest);
      const scaledMidterm = Math.round(preciseScaledMidterm);
      const scaledFinal = Math.round(preciseScaledFinal);

      // Use stored affective score if manually set, otherwise auto-calculate
      let affectiveScore: number;
      if (s.affectiveScore !== null && s.affectiveScore !== undefined) {
        affectiveScore = Number(s.affectiveScore);
      } else {
        affectiveScore = Math.max(0, weightAffective - (absentCount * 2) - (lateCount * 1));
      }

      const totalScore = scaledAssign + scaledPostTest + affectiveScore + scaledMidterm + scaledFinal;
      const percentage = totalScore;

      let finalGrade: string | null = null;
      if (isF) {
        finalGrade = 'F';
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
        final_score: finalScore,
        raw_assign: sumAssignRaw,
        max_assign: maxAssignRaw,
        precise_scaled_assign: preciseScaledAssign,
        scaled_assign: scaledAssign,
        raw_post_test: sumPostTestRaw,
        max_post_test: maxPostTestRaw,
        precise_scaled_post_test: preciseScaledPostTest,
        scaled_post_test: scaledPostTest,
        precise_scaled_midterm: preciseScaledMidterm,
        scaled_midterm: scaledMidterm,
        precise_scaled_final: preciseScaledFinal,
        scaled_final: scaledFinal,
        total_score: totalScore,
        affective_score: affectiveScore,
        percentage: percentage.toFixed(2),
        grade: finalGrade || 'ไม่มีเกรด',
        is_f: isF,
        absent_count: absentCount,
        late_count: lateCount,
        max_allowed_absences: maxAllowedAbsences,
        remaining_absences: maxAllowedAbsences - totalConverted,
      };
    });

    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
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

    // Save criteria
    await prisma.gradeCriteria.deleteMany({ where: { classroomId: Number(classroomId) } });

    if (body.criteria && body.criteria.length > 0) {
      await prisma.gradeCriteria.createMany({
        data: body.criteria.map((c: { grade: string; min_score: any }) => ({
          classroomId: Number(classroomId),
          grade: c.grade,
          minScore: isNaN(Number(c.min_score)) ? 0 : Number(c.min_score),
        })),
      });
    }

    return NextResponse.json({ message: 'Criteria saved' });
  } catch (error) {
    console.error('Save criteria error:', error);
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to save criteria' }, { status: 500 });
  }
}
