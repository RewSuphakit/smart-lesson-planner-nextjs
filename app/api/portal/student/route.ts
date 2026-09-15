import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateAffectiveScore } from '@/lib/affective';
import { resolveTargetWeeks } from '@/lib/semester';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    const classroomIdParam = searchParams.get('classroom_id');

    if (!code) {
      return NextResponse.json(
        { message: 'กรุณาระบุรหัสประจำตัวนักเรียน (code)' },
        { status: 400 }
      );
    }

    // Look up students with matching studentCode
    const matchingStudents = await prisma.student.findMany({
      where: {
        studentCode: code,
      },
      include: {
        classroom: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (matchingStudents.length === 0) {
      return NextResponse.json(
        { message: 'ไม่พบข้อมูลนักเรียนด้วยรหัสประจำตัวนี้ กรุณาตรวจสอบรหัสอีกครั้ง' },
        { status: 404 }
      );
    }

    const validClassrooms = matchingStudents.filter((s) => s.classroom !== null);
    if (validClassrooms.length === 0) {
      return NextResponse.json(
        { message: 'นักเรียนยังไม่ได้ถูกจัดให้อยู่ในห้องเรียนหรือรายวิชาใด' },
        { status: 404 }
      );
    }

    // If multiple classrooms found and no classroom_id requested, return list for selection
    if (validClassrooms.length > 1 && !classroomIdParam) {
      return NextResponse.json({
        status: 'multiple_classrooms',
        student: {
          name: matchingStudents[0].name,
          student_code: matchingStudents[0].studentCode,
        },
        classrooms: validClassrooms.map((s) => ({
          student_id: s.id,
          classroom_id: s.classroom!.id,
          classroom_name: s.classroom!.name,
          description: s.classroom!.description,
          teacher_name: s.classroom!.user.name,
          grade_level: s.gradeLevel,
        })),
      });
    }

    // Select target student
    let targetStudent = validClassrooms[0];
    if (classroomIdParam) {
      const parsedId = Number(classroomIdParam);
      const found = validClassrooms.find((s) => s.classroom!.id === parsedId);
      if (found) {
        targetStudent = found;
      }
    }

    const classroom = targetStudent.classroom!;
    const numericClassroomId = classroom.id;
    const studentId = targetStudent.id;

    // Resolve target weeks
    const targetWeeks = resolveTargetWeeks(classroom);

    // Weights & config
    const weightAssign = Number(classroom.assignmentWeight ?? 10);
    const weightPostTest = Number(classroom.postTestWeight ?? 70);
    const weightAffective = Number(classroom.affectiveWeight ?? 20);
    const weightMidterm = Number(classroom.midtermWeight ?? 0);
    const weightFinal = Number(classroom.finalWeight ?? 0);
    const maxMidtermScore = Number(classroom.midtermMaxScore ?? 100);
    const maxFinalScore = Number(classroom.finalMaxScore ?? 100);

    // Attendance config
    const ratioLate = classroom.lateToAbsentRatio || 3;
    const ratioLeave = classroom.leaveToAbsentRatio || 2;
    const totalClasses = classroom.totalClasses || 40;
    const minAttPercent = classroom.minAttendancePercent || 80;
    const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

    // Fetch details in parallel
    const [structures, studentScores, attendanceRecords, dbCriteria] = await Promise.all([
      prisma.scoreStructure.findMany({
        where: { classroomId: numericClassroomId },
        orderBy: { lessonNumber: 'asc' },
      }),
      prisma.studentScore.findMany({
        where: { studentId: studentId, classroomId: numericClassroomId },
        orderBy: { lessonNumber: 'asc' },
      }),
      prisma.attendance.findMany({
        where: { studentId: studentId, classroomId: numericClassroomId },
        orderBy: { date: 'desc' },
      }),
      prisma.gradeCriteria.findMany({
        where: { classroomId: numericClassroomId },
        orderBy: { minScore: 'desc' },
      }),
    ]);

    // Max assign and post test raw calculations
    const activeStructures = structures.filter((st) => st.lessonNumber <= targetWeeks);
    let maxAssignRaw = activeStructures.reduce((sum, st) => sum + Number(st.maxAssignmentScore ?? 0), 0);
    let maxPostTestRaw = activeStructures.reduce((sum, st) => sum + Number(st.maxPostTestScore ?? 0), 0);

    if (maxAssignRaw === 0) maxAssignRaw = targetWeeks * 10;
    if (maxPostTestRaw === 0) maxPostTestRaw = targetWeeks * 10;

    // Attendance breakdown
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    for (const a of attendanceRecords) {
      if (a.status === 'present') presentCount++;
      else if (a.status === 'late') lateCount++;
      else if (a.status === 'absent') absentCount++;
      else if (a.status === 'leave') leaveCount++;
    }

    const convertedFromLate = Math.floor(lateCount / ratioLate);
    const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
    const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
    const remainingAbsences = maxAllowedAbsences - totalConverted;
    const isF = totalConverted > maxAllowedAbsences;
    const attendancePercent = totalClasses > 0
      ? Math.max(0, Math.min(100, Math.round(((totalClasses - totalConverted) / totalClasses) * 100)))
      : 100;

    let attendanceRiskStatus: 'safe' | 'warning' | 'critical' = 'safe';
    if (isF || remainingAbsences < 0) {
      attendanceRiskStatus = 'critical';
    } else if (remainingAbsences <= 2) {
      attendanceRiskStatus = 'warning';
    }

    // Weekly scores up to targetWeeks
    const scoresMap = new Map<number, { assignmentScore: number | null; postTestScore: number | null }>();
    for (const sc of studentScores) {
      scoresMap.set(sc.lessonNumber, {
        assignmentScore: sc.assignmentScore !== null ? Number(sc.assignmentScore) : null,
        postTestScore: sc.postTestScore !== null ? Number(sc.postTestScore) : null,
      });
    }

    const structureMap = new Map<number, (typeof structures)[0]>();
    for (const st of structures) {
      structureMap.set(st.lessonNumber, st);
    }

    let sumAssignRaw = 0;
    let sumPostTestRaw = 0;
    const weeklyLessons = [];

    for (let w = 1; w <= targetWeeks; w++) {
      const st = structureMap.get(w);
      const sc = scoresMap.get(w);

      const maxAssignment = st ? Number(st.maxAssignmentScore ?? 0) : 10;
      const maxPostTest = st ? Number(st.maxPostTestScore ?? 0) : 10;
      const assignmentScore = sc?.assignmentScore ?? null;
      const postTestScore = sc?.postTestScore ?? null;

      if (assignmentScore !== null) sumAssignRaw += assignmentScore;
      if (postTestScore !== null) sumPostTestRaw += postTestScore;

      const hasAssignmentConfig = maxAssignment > 0;
      const isAssignmentSubmitted = assignmentScore !== null && assignmentScore > 0;
      const isMissingAssignment = hasAssignmentConfig && (assignmentScore === null || assignmentScore === 0);

      weeklyLessons.push({
        lesson_number: w,
        lesson_name: st?.lessonName || `สัปดาห์ที่ ${w}`,
        max_assignment: maxAssignment,
        max_post_test: maxPostTest,
        assignment_score: assignmentScore,
        post_test_score: postTestScore,
        is_submitted: isAssignmentSubmitted,
        is_missing: isMissingAssignment,
      });
    }

    // Exam scores
    const midtermScore = Number(targetStudent.midtermScore ?? 0);
    const rawFinalScore = targetStudent.finalScore !== null ? Number(targetStudent.finalScore) : null;
    const isAbsentFinal = rawFinalScore === -1;
    const isIncomplete = rawFinalScore === -2;
    const finalScore = (rawFinalScore === null || rawFinalScore < 0) ? 0 : rawFinalScore;

    // Scaled scores
    const preciseScaledAssign = maxAssignRaw > 0 ? (sumAssignRaw / maxAssignRaw) * weightAssign : 0;
    const preciseScaledPostTest = maxPostTestRaw > 0 ? (sumPostTestRaw / maxPostTestRaw) * weightPostTest : 0;
    const preciseScaledMidterm = maxMidtermScore > 0 ? (midtermScore / maxMidtermScore) * weightMidterm : 0;
    const preciseScaledFinal = maxFinalScore > 0 ? (finalScore / maxFinalScore) * weightFinal : 0;

    const affectiveScore = calculateAffectiveScore({
      baseScore: targetStudent.affectiveScore ? Number(targetStudent.affectiveScore) : null,
      maxWeight: weightAffective,
      absentCount,
      lateCount,
    });

    const totalScorePrecise = preciseScaledAssign + preciseScaledPostTest + affectiveScore + preciseScaledMidterm + preciseScaledFinal;
    const totalWeightSum = weightAssign + weightPostTest + weightAffective + weightMidterm + weightFinal;
    const percentage = totalWeightSum > 0 ? (totalScorePrecise / totalWeightSum) * 100 : 0;

    // Criteria for final grade
    const criteria = dbCriteria.length > 0
      ? dbCriteria.map((c) => ({ grade: c.grade, minScore: Number(c.minScore) }))
      : [
          { grade: '4', minScore: 80 },
          { grade: '3.5', minScore: 75 },
          { grade: '3', minScore: 70 },
          { grade: '2.5', minScore: 65 },
          { grade: '2', minScore: 60 },
          { grade: '1.5', minScore: 55 },
          { grade: '1', minScore: 50 },
          { grade: '0', minScore: 0 },
        ];

    let finalGrade = '0';
    if (isF) {
      finalGrade = 'ข.ร.';
    } else if (isAbsentFinal) {
      finalGrade = 'ข.ส.';
    } else if (isIncomplete) {
      finalGrade = 'ม.ส.';
    } else {
      for (const c of criteria) {
        if (percentage >= c.minScore) {
          finalGrade = c.grade;
          break;
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      student: {
        id: targetStudent.id,
        name: targetStudent.name,
        student_code: targetStudent.studentCode,
        grade_level: targetStudent.gradeLevel,
      },
      classroom: {
        id: classroom.id,
        name: classroom.name,
        description: classroom.description,
        teacher_name: classroom.user.name,
        curriculum_type: classroom.curriculumType,
        total_weeks: targetWeeks,
        total_classes: totalClasses,
      },
      attendance_summary: {
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        leave_count: leaveCount,
        total_converted_absent: totalConverted,
        max_allowed_absences: maxAllowedAbsences,
        remaining_absences: remainingAbsences,
        attendance_percent: attendancePercent,
        min_attendance_percent: minAttPercent,
        status: attendanceRiskStatus,
        is_f: isF,
      },
      grades_summary: {
        grade: finalGrade,
        percentage: percentage.toFixed(2),
        total_score: Math.round(totalScorePrecise),
        total_score_precise: totalScorePrecise,
        max_score: totalWeightSum,
        raw_assignment: sumAssignRaw,
        max_raw_assignment: maxAssignRaw,
        scaled_assignment: Math.round(preciseScaledAssign),
        max_scaled_assignment: weightAssign,
        raw_post_test: sumPostTestRaw,
        max_raw_post_test: maxPostTestRaw,
        scaled_post_test: Math.round(preciseScaledPostTest),
        max_scaled_post_test: weightPostTest,
        midterm_score: midtermScore,
        max_midterm_score: maxMidtermScore,
        scaled_midterm: Math.round(preciseScaledMidterm),
        max_scaled_midterm: weightMidterm,
        final_score: rawFinalScore,
        max_final_score: maxFinalScore,
        scaled_final: Math.round(preciseScaledFinal),
        max_scaled_final: weightFinal,
        affective_score: affectiveScore,
        max_affective_score: weightAffective,
        weights: {
          assignment: weightAssign,
          post_test: weightPostTest,
          affective: weightAffective,
          midterm: weightMidterm,
          final: weightFinal,
        },
      },
      weekly_lessons: weeklyLessons,
      attendance_records: attendanceRecords.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split('T')[0],
        status: a.status,
      })),
      all_classrooms: validClassrooms.map((s) => ({
        student_id: s.id,
        classroom_id: s.classroom!.id,
        classroom_name: s.classroom!.name,
        teacher_name: s.classroom!.user.name,
      })),
    });
  } catch (error) {
    console.error('Portal student error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักเรียน' },
      { status: 500 }
    );
  }
}
