import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateAffectiveScore } from '@/lib/affective';
import { resolveTargetWeeks, resolveCurrentTeachingWeek } from '@/lib/semester';
import { protectRequest, portalLimiter } from '@/lib/arcjet';
import { invalidateCache, userCacheKey } from '@/lib/cache';
import { generatePortalSession, verifyPortalSession, getAuthUser } from '@/lib/auth';

function stripThaiNamePrefix(raw: string): string {
  return raw
    .trim()
    .replace(/^(นางสาว|เด็กชาย|เด็กหญิง|น\.ส\.|ด\.ช\.|ด\.ญ\.|นาย|นาง)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matchesStudentNameVerification(fullName: string, verifyInput: string): boolean {
  const cleanFull = stripThaiNamePrefix(fullName);
  const cleanInput = stripThaiNamePrefix(verifyInput);
  if (!cleanInput || cleanInput.length < 2) return false;
  if (cleanFull === cleanInput) return true;

  const tokens = cleanFull.split(' ').filter(Boolean);
  return tokens.some(
    (token) => token === cleanInput || (cleanInput.length >= 3 && token.startsWith(cleanInput))
  );
}

function toLightweightAvatarUrl(student: { id: number; avatar?: string | null; updatedAt: Date }): string | null {
  if (!student.avatar) return null;
  if (student.avatar.startsWith('data:image/')) {
    return `/api/students/${student.id}/avatar?v=${student.updatedAt.getTime()}`;
  }
  return student.avatar;
}

/**
 * Loads the avatar of ONE already-verified student and converts it to the lightweight URL.
 * Same output as toLightweightAvatarUrl, but the (potentially large) avatar column is read only
 * for the student that is actually returned instead of for every student sharing the code.
 */
async function loadAvatarUrl(student: { id: number; updatedAt: Date }): Promise<string | null> {
  const row = await prisma.student.findUnique({
    where: { id: student.id },
    select: { avatar: true },
  });
  return toLightweightAvatarUrl({ id: student.id, avatar: row?.avatar ?? null, updatedAt: student.updatedAt });
}

export async function GET(request: NextRequest) {
  try {
    // Arcjet Rate Limiting & Bot Protection against student ID scraping / enumeration
    const arcjetCheck = await protectRequest(request, portalLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    const verifyName = searchParams.get('verify_name')?.trim() || '';
    const classroomIdParam = searchParams.get('classroom_id');

    if (!code) {
      return NextResponse.json(
        { message: 'กรุณาระบุรหัสประจำตัวนักเรียน (code)' },
        { status: 400 }
      );
    }

    // Check if caller already holds a verified portal_session for this studentCode
    const portalSessionCookie = request.cookies.get('portal_session')?.value;
    const existingSession = portalSessionCookie ? verifyPortalSession(portalSessionCookie) : null;
    const hasActiveSessionForCode = Boolean(
      existingSession &&
        existingSession.studentCode.trim().toLowerCase() === code.toLowerCase() &&
        existingSession.studentIds &&
        existingSession.studentIds.length > 0
    );

    if (!hasActiveSessionForCode && stripThaiNamePrefix(verifyName).length < 2) {
      return NextResponse.json(
        { message: 'กรุณาระบุชื่อหรือนามสกุล (อย่างน้อย 2 ตัวอักษร) เพื่อยืนยันตัวตน' },
        { status: 400 }
      );
    }

    // Look up students with matching studentCode.
    // Explicit `select` (instead of `include`): only the columns used below are loaded.
    // `avatar` (MediumText, possibly base64) is deliberately NOT selected here: this query also returns
    // students that fail name verification or belong to other classrooms/schools, so loading it would
    // pull one blob per candidate. It is fetched afterwards only for the single student shown
    // (see loadAvatarUrl). Schema note: an `avatarUpdatedAt DateTime?` column on Student would let us
    // decide "has avatar" + build the cache-busting URL with no blob read at all (not approved yet).
    const rawMatchingStudents = await prisma.student.findMany({
      where: {
        studentCode: code,
      },
      select: {
        id: true,
        name: true,
        studentCode: true,
        gradeLevel: true,
        midtermScore: true,
        finalScore: true,
        affectiveScore: true,
        updatedAt: true,
        classroom: {
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            isPortalEnabled: true,
            curriculumType: true,
            totalWeeks: true,
            semesterStartDate: true,
            assignmentWeight: true,
            postTestWeight: true,
            affectiveWeight: true,
            midtermWeight: true,
            finalWeight: true,
            midtermMaxScore: true,
            finalMaxScore: true,
            lateToAbsentRatio: true,
            leaveToAbsentRatio: true,
            totalClasses: true,
            minAttendancePercent: true,
            user: {
              select: {
                name: true,
              },
            },
            // Only the start date is read (effectiveStartDate); resolveTargetWeeks uses the classroom's own fields.
            semester: {
              select: {
                startDate: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Filter down strictly to the verified student identity (prevents cross-school collisions & ID snooping)
    const matchingStudents = verifyName
      ? rawMatchingStudents.filter((s) => matchesStudentNameVerification(s.name, verifyName))
      : hasActiveSessionForCode
        ? rawMatchingStudents.filter((s) => existingSession!.studentIds!.includes(s.id))
        : [];

    if (matchingStudents.length === 0) {
      return NextResponse.json(
        { message: 'ไม่พบข้อมูลนักเรียน หรือรหัสประจำตัวและชื่อ-นามสกุลไม่ตรงกัน' },
        { status: 404 }
      );
    }

    const verifiedStudentIds = matchingStudents.map((s) => s.id);
    const validClassrooms = matchingStudents.filter((s) => s.classroom !== null);
    if (validClassrooms.length === 0) {
      return NextResponse.json(
        { message: 'นักเรียนยังไม่ได้ถูกจัดให้อยู่ในห้องเรียนหรือรายวิชาใด' },
        { status: 404 }
      );
    }

    // If multiple classrooms found and no classroom_id requested, return list for selection
    if (validClassrooms.length > 1 && !classroomIdParam) {
      const firstStudentAvatar = await loadAvatarUrl(matchingStudents[0]);
      const resp = NextResponse.json({
        status: 'multiple_classrooms',
        student: {
          id: matchingStudents[0].id,
          name: matchingStudents[0].name,
          student_code: matchingStudents[0].studentCode,
          avatar: firstStudentAvatar,
        },
        classrooms: validClassrooms.map((s) => ({
          student_id: s.id,
          classroom_id: s.classroom!.id,
          classroom_name: s.classroom!.name,
          description: s.classroom!.description,
          teacher_name: s.classroom!.user.name,
          grade_level: s.gradeLevel,
          is_portal_enabled: s.classroom!.isPortalEnabled,
        })),
      });

      resp.cookies.set({
        name: 'portal_session',
        value: generatePortalSession(code, verifiedStudentIds),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      });

      return resp;
    }

    // Select target student
    let targetStudent = validClassrooms[0];
    if (classroomIdParam) {
      const parsedId = Number(classroomIdParam);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        return NextResponse.json(
          { message: 'รหัสห้องเรียนไม่ถูกต้อง' },
          { status: 400 }
        );
      }
      const found = validClassrooms.find((s) => s.classroom!.id === parsedId);
      if (!found) {
        return NextResponse.json(
          { message: 'ไม่พบรายวิชานี้ในข้อมูลของนักเรียน' },
          { status: 404 }
        );
      }
      targetStudent = found;
    }

    const classroom = targetStudent.classroom!;

    // If subject teacher has disabled Student Portal for this classroom, return locked status without querying/exposing scores or attendance
    if (!classroom.isPortalEnabled) {
      const targetAvatar = await loadAvatarUrl(targetStudent);
      const disabledResponse = NextResponse.json({
        status: 'portal_disabled',
        student: {
          id: targetStudent.id,
          name: targetStudent.name,
          student_code: targetStudent.studentCode,
          grade_level: targetStudent.gradeLevel,
          avatar: targetAvatar,
        },
        classroom: {
          id: classroom.id,
          name: classroom.name,
          description: classroom.description,
          teacher_name: classroom.user.name,
          curriculum_type: classroom.curriculumType,
          is_portal_enabled: false,
        },
        all_classrooms: validClassrooms.map((s) => ({
          student_id: s.id,
          classroom_id: s.classroom!.id,
          classroom_name: s.classroom!.name,
          description: s.classroom!.description,
          teacher_name: s.classroom!.user.name,
          grade_level: s.gradeLevel,
          is_portal_enabled: s.classroom!.isPortalEnabled,
        })),
      });

      disabledResponse.cookies.set({
        name: 'portal_session',
        value: generatePortalSession(code!, verifiedStudentIds),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      });

      return disabledResponse;
    }

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
    const [
      structures,
      studentScores,
      attendanceRecords,
      dbCriteria,
      latestScoreInClassroom,
      classroomAttendanceDates,
      classroomWeeklySchedules,
      activeSemester,
      targetAvatarUrl,
    ] = await Promise.all([
      prisma.scoreStructure.findMany({
        where: { classroomId: numericClassroomId },
        select: { lessonNumber: true, lessonName: true, maxAssignmentScore: true, maxPostTestScore: true },
        orderBy: { lessonNumber: 'asc' },
      }),
      prisma.studentScore.findMany({
        where: { studentId: studentId, classroomId: numericClassroomId },
        select: { lessonNumber: true, assignmentScore: true, postTestScore: true },
        orderBy: { lessonNumber: 'asc' },
      }),
      prisma.attendance.findMany({
        where: { studentId: studentId, classroomId: numericClassroomId },
        select: { id: true, date: true, status: true },
        orderBy: { date: 'desc' },
      }),
      prisma.gradeCriteria.findMany({
        where: { classroomId: numericClassroomId },
        select: { grade: true, minScore: true },
        orderBy: { minScore: 'desc' },
      }),
      prisma.studentScore.findFirst({
        where: {
          classroomId: numericClassroomId,
          OR: [
            { assignmentScore: { not: null, gt: 0 } },
            { postTestScore: { not: null, gt: 0 } },
          ],
        },
        orderBy: { lessonNumber: 'desc' },
        select: { lessonNumber: true },
      }),
      prisma.attendance.findMany({
        where: { classroomId: numericClassroomId },
        select: { date: true },
        distinct: ['date'],
        orderBy: { date: 'asc' },
      }),
      prisma.weeklySchedule.findMany({
        where: { classroomId: numericClassroomId },
        select: { dayOfWeek: true },
      }),
      prisma.semester.findFirst({
        where: { userId: classroom.userId, isActive: true },
        select: { startDate: true },
      }),
      // Avatar is read only for the returned student, in parallel with the other queries
      loadAvatarUrl(targetStudent),
    ]);

    // Resolve current teaching week based on calendar, attendance, and recorded scores
    const earliestAttendanceDate = classroomAttendanceDates.length > 0 ? classroomAttendanceDates[0].date : null;
    const effectiveStartDate =
      classroom.semesterStartDate ||
      classroom.semester?.startDate ||
      activeSemester?.startDate ||
      earliestAttendanceDate;

    let highestScoredWeek = latestScoreInClassroom?.lessonNumber || 0;
    for (const sc of studentScores) {
      if ((sc.assignmentScore !== null && Number(sc.assignmentScore) > 0) || (sc.postTestScore !== null && Number(sc.postTestScore) > 0)) {
        if (sc.lessonNumber > highestScoredWeek) highestScoredWeek = sc.lessonNumber;
      }
    }

    const timetableDays = Array.from(new Set(classroomWeeklySchedules.map((ws) => ws.dayOfWeek)));

    const currentTeachingWeek = resolveCurrentTeachingWeek({
      startDate: effectiveStartDate,
      totalWeeks: targetWeeks,
      highestScoredWeek,
      attendanceDatesCount: classroomAttendanceDates.length,
      timetableDays,
    });

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

    // Only show and evaluate lessons up to currentTeachingWeek (lessons that have reached teaching time)
    for (let w = 1; w <= currentTeachingWeek; w++) {
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

    // In case the student has recorded scores in any week beyond currentTeachingWeek, include them in score sums
    for (const [lessonNum, sc] of scoresMap.entries()) {
      if (lessonNum > currentTeachingWeek) {
        if (sc.assignmentScore !== null) sumAssignRaw += sc.assignmentScore;
        if (sc.postTestScore !== null) sumPostTestRaw += sc.postTestScore;
      }
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

    const response = NextResponse.json({
      status: 'success',
      student: {
        id: targetStudent.id,
        name: targetStudent.name,
        student_code: targetStudent.studentCode,
        grade_level: targetStudent.gradeLevel,
        avatar: targetAvatarUrl,
      },
      classroom: {
        id: classroom.id,
        name: classroom.name,
        description: classroom.description,
        teacher_name: classroom.user.name,
        curriculum_type: classroom.curriculumType,
        total_weeks: targetWeeks,
        current_teaching_week: currentTeachingWeek,
        total_classes: totalClasses,
        is_portal_enabled: true,
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
        description: s.classroom!.description,
        teacher_name: s.classroom!.user.name,
        grade_level: s.gradeLevel,
        is_portal_enabled: s.classroom!.isPortalEnabled,
      })),
    });

    response.cookies.set({
      name: 'portal_session',
      value: generatePortalSession(code!, verifiedStudentIds),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });

    return response;
  } catch (error) {
    console.error('Portal student error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักเรียน' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return handleAvatarUpdate(request);
}

export async function POST(request: NextRequest) {
  return handleAvatarUpdate(request);
}

async function handleAvatarUpdate(request: NextRequest) {
  try {
    const arcjetCheck = await protectRequest(request, portalLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const body = await request.json();
    const studentCode = typeof body.student_code === 'string' ? body.student_code.trim() : '';
    if (!studentCode) {
      return NextResponse.json(
        { message: 'กรุณาระบุรหัสประจำตัวนักเรียน (student_code)' },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { studentCode },
      select: {
        id: true,
        userId: true,
        classroom: {
          select: { isPortalEnabled: true },
        },
      },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { message: 'ไม่พบข้อมูลนักเรียนด้วยรหัสประจำตัวนี้' },
        { status: 404 }
      );
    }

    // Security Verification: Require valid signed portal session (scoped to verified studentIds) or teacher auth
    const portalSessionCookie = request.cookies.get('portal_session')?.value;
    const verifiedSession = portalSessionCookie ? verifyPortalSession(portalSessionCookie) : null;
    const authUser = getAuthUser(request);

    let authorizedStudents: typeof students = [];
    let isTeacherAuthorized = false;
    if (
      verifiedSession &&
      verifiedSession.studentCode.trim().toLowerCase() === studentCode.toLowerCase() &&
      verifiedSession.studentIds &&
      verifiedSession.studentIds.length > 0
    ) {
      const allowedSet = new Set(verifiedSession.studentIds);
      authorizedStudents = students.filter((s) => allowedSet.has(s.id));
    } else if (authUser) {
      authorizedStudents = students.filter((s) => s.userId === authUser.id);
      isTeacherAuthorized = authorizedStudents.length > 0;
    }

    if (authorizedStudents.length === 0) {
      return NextResponse.json(
        { message: 'ไม่ได้รับอนุญาตให้แก้ไขข้อมูลนักเรียน กรุณาเปิดดูข้อมูลผ่านพอร์ทัลก่อนทำรายการ' },
        { status: 403 }
      );
    }

    // Block student self-avatar updates if every single enrolled classroom currently has Portal disabled
    if (
      !isTeacherAuthorized &&
      !authorizedStudents.some((s) => s.classroom?.isPortalEnabled === true)
    ) {
      return NextResponse.json(
        { message: 'ครูผู้สอนปิดการเข้าดูชั่วคราว ไม่สามารถแก้ไขรูปโปรไฟล์ได้ในขณะนี้' },
        { status: 403 }
      );
    }

    let avatar: string | null = null;
    if (body.remove_avatar !== true && body.avatar) {
      const rawAvatar = String(body.avatar).trim();
      const validBase64ImageRegex = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
      if (!validBase64ImageRegex.test(rawAvatar)) {
        return NextResponse.json(
          { message: 'รูปแบบรูปภาพไม่ถูกต้อง (รองรับเฉพาะไฟล์รูปภาพ WebP, JPG, PNG แบบ base64 เท่านั้น)' },
          { status: 400 }
        );
      }
      // Limit to 256KB
      if (rawAvatar.length > 256 * 1024) {
        return NextResponse.json(
          { message: 'ขนาดรูปภาพใหญ่เกินไป (สูงสุด 250KB)' },
          { status: 400 }
        );
      }
      avatar = rawAvatar;
    }

    const authorizedIds = authorizedStudents.map((s) => s.id);

    // Update ONLY the verified student's own records (never cross-school records sharing the same code)
    await prisma.student.updateMany({
      where: {
        id: { in: authorizedIds },
        studentCode,
      },
      data: { avatar },
    });

    // Invalidate caches for affected teachers (including students:list)
    const distinctUserIds = Array.from(new Set(authorizedStudents.map((s) => s.userId)));
    for (const uId of distinctUserIds) {
      invalidateCache(userCacheKey(uId, 'students'));
      invalidateCache(userCacheKey(uId, 'classrooms'));
      invalidateCache(userCacheKey(uId, 'dashboard'));
    }

    const avatarUrl = avatar ? `/api/students/${authorizedIds[0]}/avatar?v=${Date.now()}` : null;

    return NextResponse.json({
      message: avatar ? 'อัพเดทรูปโปรไฟล์สำเร็จ' : 'ลบรูปโปรไฟล์สำเร็จ',
      avatar: avatarUrl,
    });
  } catch (error) {
    console.error('Portal student avatar update error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการอัพเดทรูปโปรไฟล์' },
      { status: 500 }
    );
  }
}

