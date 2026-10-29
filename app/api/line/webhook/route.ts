/**
 * LINE Webhook Handler
 *
 * POST /api/line/webhook
 *
 * Receives events from LINE Messaging API, verifies signature,
 * and processes student commands:
 *   - "ผูก <รหัส>"       → bind LINE userId to studentCode
 *   - "คะแนน" / "เกรด"   → show score summary
 *   - "เข้าเรียน" / "ขาด" / "สาย" / "ลา" → show attendance summary
 *   - "เปลี่ยนวิชา"       → re-select classroom
 *   - "ยกเลิก"           → unbind account
 *   - "วิธีใช้" / "help"  → show help
 *
 * No teacher auth needed — this is a public webhook endpoint.
 * Signature verification via X-Line-Signature header ensures
 * requests originate from LINE platform.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateAffectiveScore } from '@/lib/affective';
import { resolveTargetWeeks, getCurrentWeek } from '@/lib/semester';
import { decryptIfPresent, encryptIfPresent } from '@/lib/encryption';
import {
  verifyLineSignature,
  replyMessage,
  textMessage,
  buildAttendanceFlexMessage,
  buildScoreFlexMessage,
  buildClassroomSelectionFlex,
  buildMissingTasksFlexMessage,
  buildHelpMessage,
  MissingTaskWeek,
  LineWebhookBody,
  LineEvent,
} from '@/lib/line';

// GET /api/line/webhook — Minimal health check (does not expose internal counts or secret metadata)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is running',
  });
}

// POST /api/line/webhook
export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    if (!rawBody || !signature) {
      return NextResponse.json({ message: 'Missing body or signature' }, { status: 400 });
    }

    // 2. Parse body
    let body: LineWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
    }

    if (!body.events || body.events.length === 0) {
      // Webhook verification from LINE (empty events)
      return NextResponse.json({ status: 'ok' });
    }

    // 3. Find matching LINE channel config by verifying signature against known channels
    const activeConfigs = await prisma.lineChannelConfig.findMany({
      where: { isActive: true },
    });

    let matchedConfig: { channelSecret: string; channelAccessToken: string; userId: number } | null = null;
    for (const config of activeConfigs) {
      const secret = decryptIfPresent(config.channelSecret);
      if (verifyLineSignature(rawBody, signature, secret)) {
        matchedConfig = {
          channelSecret: secret,
          channelAccessToken: decryptIfPresent(config.channelAccessToken),
          userId: config.userId,
        };
        break;
      }
    }

    // Fallback: check environment variables from .env
    const envSecret = process.env.LINE_CHANNEL_SECRET || process.env.channel_secret;
    const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.channel_access_token;
    const envChannelId = process.env.LINE_CHANNEL_ID || process.env.channel_id || 'env-default';

    if (!matchedConfig && envSecret && envToken) {
      if (verifyLineSignature(rawBody, signature, envSecret)) {
        let teacherUserId = process.env.LINE_USER_ID ? parseInt(process.env.LINE_USER_ID, 10) : 0;
        if (!teacherUserId) {
          const defaultUser = await prisma.user.findFirst({
            orderBy: { id: 'asc' },
            select: { id: true },
          });
          teacherUserId = defaultUser?.id || 1;
        }

        matchedConfig = {
          channelSecret: envSecret,
          channelAccessToken: envToken,
          userId: teacherUserId,
        };

        // Auto-save/sync into database
        try {
          await prisma.lineChannelConfig.upsert({
            where: { userId: teacherUserId },
            update: {
              channelId: envChannelId,
              channelSecret: encryptIfPresent(envSecret),
              channelAccessToken: encryptIfPresent(envToken),
              isActive: true,
            },
            create: {
              userId: teacherUserId,
              channelId: envChannelId,
              channelSecret: encryptIfPresent(envSecret),
              channelAccessToken: encryptIfPresent(envToken),
              isActive: true,
            },
          });
        } catch (dbErr) {
          console.warn('Auto-save env LINE config warning:', dbErr);
        }
      } else {
        console.warn('LINE webhook: signature does not match LINE_CHANNEL_SECRET in .env');
      }
    }

    if (!matchedConfig) {
      console.error('LINE webhook: no matching channel config for signature');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const accessToken = matchedConfig.channelAccessToken;

    // 4. Process events
    for (const event of body.events) {
      console.log(`[LINE Webhook] Processing event: ${event.type}, text: ${event.message?.text || event.postback?.data || ''}`);
      await processEvent(event, accessToken, matchedConfig.userId);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// ==================== Event Processor ====================

async function processEvent(event: LineEvent, accessToken: string, teacherUserId: number) {
  // Only handle message and postback events from users
  if (!event.source?.userId) return;
  if (!event.replyToken) return;

  const lineUserId = event.source.userId;

  if (event.type === 'follow') {
    // User added the bot as friend
    await replyMessage(event.replyToken, [buildHelpMessage()], accessToken);
    return;
  }

  if (event.type === 'postback' && event.postback?.data) {
    await handlePostback(event, lineUserId, accessToken, teacherUserId);
    return;
  }

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text?.trim() || '';
    await handleTextMessage(event, text, lineUserId, accessToken, teacherUserId);
    return;
  }
}

// ==================== Text Message Handler ====================

async function handleTextMessage(
  event: LineEvent,
  text: string,
  lineUserId: string,
  accessToken: string,
  teacherUserId: number
) {
  const replyToken = event.replyToken!;
  const lowerText = text.toLowerCase();

  // --- Help / วิธีใช้ ---
  if (['วิธีใช้', 'help', 'ช่วยเหลือ', 'คำสั่ง', 'เมนู', 'menu'].includes(lowerText)) {
    await replyMessage(replyToken, [buildHelpMessage()], accessToken);
    return;
  }

  // --- Bind account: "ผูก 12345" ---
  const bindMatch = text.match(/^(?:ผูก|bind|register|ลงทะเบียน)\s+(.+)$/i);
  if (bindMatch) {
    const studentCode = bindMatch[1].trim();
    await handleBind(replyToken, lineUserId, studentCode, accessToken, teacherUserId);
    return;
  }

  // --- Unbind / ลบการผูก: "ยกเลิก" / "ลบ" / "ลบการผูก" / "ปลดผูก" ---
  const isUnbind =
    /^(?:ยกเลิก|ลบ|ปลด|unbind|unlink|delete|remove|reset|รีเซ็ต|รีเซต)(?:\s*(?:การผูก|ผูก|บัญชี|เชื่อมต่อ)?(?:\s+\S+)?)?$/i.test(text);
  if (isUnbind) {
    await handleUnbind(replyToken, lineUserId, accessToken);
    return;
  }

  // --- Change classroom: "เปลี่ยนวิชา" ---
  if (['เปลี่ยนวิชา', 'เปลี่ยน', 'switch', 'เลือกวิชา'].includes(lowerText)) {
    await handleSwitchClassroom(replyToken, lineUserId, accessToken, teacherUserId);
    return;
  }

  // --- Missing tasks queries: "งานค้าง" / "งานที่ขาด" / "การบ้าน" / "เช็คงาน" ---
  const normalizedText = lowerText.replace(/\s+/g, '');
  const missingKeywords = [
    'งานค้าง', 'ค้างงาน', 'งานที่ขาด', 'งานขาด', 'ขาดงาน', 'เช็คงาน', 'เช็คงานขาด',
    'เช็คงานค้าง', 'การบ้าน', 'การบ้านค้าง', 'เช็คการบ้าน', 'งานที่ยังไม่ส่ง',
    'งาน', 'homework', 'task', 'tasks', 'missing',
  ];
  const isMissingQuery =
    missingKeywords.includes(normalizedText) ||
    /(?:เช็ค|ดู|มี)?(?:งาน|การบ้าน)(?:ค้าง|ขาด|ที่ขาด|ที่ยังไม่ส่ง)/i.test(normalizedText) ||
    /^(?:เช็ค)?(?:งาน|การบ้าน)(?:ค้าง|ขาด|ที่ขาด|ที่ยังไม่ส่ง)?$/i.test(normalizedText);

  if (isMissingQuery) {
    await handleMissingTasksQuery(replyToken, lineUserId, accessToken, teacherUserId);
    return;
  }

  // --- Score/Grade queries ---
  if (['คะแนน', 'เกรด', 'score', 'grade', 'ผลคะแนน', 'ผลเกรด', 'ผลการเรียน'].includes(lowerText)) {
    await handleScoreQuery(replyToken, lineUserId, accessToken, teacherUserId);
    return;
  }

  // --- Attendance queries ---
  if (['เข้าเรียน', 'ขาด', 'สาย', 'ลา', 'attendance', 'ขาดเรียน', 'มาเรียน', 'สถิติ', 'เช็คชื่อ'].includes(lowerText)) {
    await handleAttendanceQuery(replyToken, lineUserId, accessToken, teacherUserId);
    return;
  }

  // --- Unknown command → show help ---
  await replyMessage(replyToken, [
    textMessage('🤔 ไม่เข้าใจคำสั่ง\nพิมพ์ "วิธีใช้" เพื่อดูคำสั่งทั้งหมด'),
  ], accessToken);
}

// ==================== Postback Handler ====================

async function handlePostback(
  event: LineEvent,
  lineUserId: string,
  accessToken: string,
  _teacherUserId: number
) {
  const data = event.postback!.data;
  const params = new URLSearchParams(data);
  const action = params.get('action');

  if (action === 'select_classroom') {
    const classroomId = parseInt(params.get('classroom_id') || '0', 10);
    if (!classroomId) return;

    // Update the binding with selected classroom
    const binding = await prisma.lineBinding.findFirst({
      where: { lineUserId },
    });

    if (!binding) {
      await replyMessage(event.replyToken!, [
        textMessage('❌ ยังไม่ได้ผูกบัญชี กรุณาพิมพ์ "ผูก <รหัสนักเรียน>" ก่อน'),
      ], accessToken);
      return;
    }

    // Verify the classroom belongs to student (across any teacher)
    const student = await prisma.student.findFirst({
      where: {
        studentCode: binding.studentCode,
        classroomId: classroomId,
      },
    });

    if (!student) {
      await replyMessage(event.replyToken!, [
        textMessage('❌ ไม่พบวิชานี้ในข้อมูลของคุณ'),
      ], accessToken);
      return;
    }

    await prisma.lineBinding.update({
      where: { id: binding.id },
      data: { classroomId },
    });

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        name: true,
        user: { select: { name: true } },
      },
    });

    const teacherInfo = classroom?.user?.name ? `\n👨‍🏫 ผู้สอน: ${classroom.user.name}` : '';
    await replyMessage(event.replyToken!, [
      textMessage(
        `✅ เลือกวิชา "${classroom?.name}" แล้ว${teacherInfo}\n\n` +
        `พิมพ์ "คะแนน" หรือ "เข้าเรียน" เพื่อดูข้อมูลวิชานี้\n` +
        `(หรือพิมพ์ "เปลี่ยนวิชา" เมื่อต้องการดูวิชาอื่น)`
      ),
    ], accessToken);
  }
}

// ==================== Command Handlers ====================

async function handleBind(
  replyToken: string,
  lineUserId: string,
  studentCode: string,
  accessToken: string,
  _teacherUserId: number
) {
  // Search all classrooms for this student across all teachers (Shared Bot model)
  const students = await prisma.student.findMany({
    where: {
      studentCode,
      classroomId: { not: null },
    },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (students.length === 0) {
    await replyMessage(replyToken, [
      textMessage(`❌ ไม่พบรหัสนักเรียน "${studentCode}" ในระบบ\nกรุณาตรวจสอบรหัสอีกครั้ง`),
    ], accessToken);
    return;
  }

  // Upsert binding
  const existingBinding = await prisma.lineBinding.findFirst({
    where: { lineUserId, studentCode },
  });

  if (existingBinding) {
    await replyMessage(replyToken, [
      textMessage(`✅ บัญชี LINE ของคุณผูกกับรหัส ${studentCode} อยู่แล้ว\n\nพิมพ์ "คะแนน" หรือ "เข้าเรียน" เพื่อดูข้อมูล`),
    ], accessToken);
    return;
  }

  // Remove old bindings for this LINE user (one LINE → one student)
  await prisma.lineBinding.deleteMany({
    where: { lineUserId },
  });

  // If only one classroom, bind directly
  const classroomId = students.length === 1 ? students[0].classroomId : null;

  await prisma.lineBinding.create({
    data: {
      lineUserId,
      studentCode,
      classroomId,
    },
  });

  if (students.length === 1) {
    const teacherName = students[0].classroom?.user?.name ? `\n👨‍🏫 ผู้สอน: ${students[0].classroom.user.name}` : '';
    await replyMessage(replyToken, [
      textMessage(
        `✅ ผูกบัญชีสำเร็จ!\n\n` +
        `👤 ${students[0].name}\n` +
        `📚 ${students[0].classroom?.name}${teacherName}\n\n` +
        `พิมพ์ "คะแนน" หรือ "เข้าเรียน" เพื่อดูข้อมูล`
      ),
    ], accessToken);
  } else {
    // Multiple classrooms → ask to select
    const classrooms = students
      .filter((s) => s.classroom)
      .map((s) => ({
        classroomId: s.classroom!.id,
        classroomName: s.classroom!.name,
        teacherName: s.classroom!.user?.name || '',
      }));

    await replyMessage(replyToken, [
      textMessage(`✅ ผูกบัญชีสำเร็จ! คุณ ${students[0].name}\nกรุณาเลือกวิชาที่ต้องการดูข้อมูลด้านล่าง:`),
      buildClassroomSelectionFlex(students[0].name, classrooms),
    ], accessToken);
  }
}

async function handleUnbind(replyToken: string, lineUserId: string, accessToken: string) {
  // Find current binding to show student name in response
  const existing = await prisma.lineBinding.findFirst({
    where: { lineUserId },
  });

  let studentName = '';
  if (existing?.studentCode) {
    const student = await prisma.student.findFirst({
      where: { studentCode: existing.studentCode },
      select: { name: true },
    });
    studentName = student?.name || '';
  }

  const deleted = await prisma.lineBinding.deleteMany({
    where: { lineUserId },
  });

  if (deleted.count === 0) {
    await replyMessage(replyToken, [
      textMessage('ℹ️ ไม่พบบัญชีที่ผูกอยู่กับ LINE นี้\n\nพิมพ์ "ผูก <รหัสนักเรียน>" เพื่อเริ่มต้นใช้งาน'),
    ], accessToken);
  } else {
    const infoText = studentName ? `\n👤 ${studentName} (รหัส ${existing?.studentCode})` : (existing?.studentCode ? ` (รหัส ${existing.studentCode})` : '');
    await replyMessage(replyToken, [
      textMessage(
        `✅ ลบการผูกบัญชีเรียบร้อยแล้ว${infoText}\n\n` +
        `คุณสามารถพิมพ์ "ผูก <รหัสนักเรียน>" เพื่อผูกบัญชีใหม่ได้ตลอดเวลา`
      ),
    ], accessToken);
  }
}

async function handleSwitchClassroom(
  replyToken: string,
  lineUserId: string,
  accessToken: string,
  _teacherUserId: number
) {
  const binding = await prisma.lineBinding.findFirst({
    where: { lineUserId },
  });

  if (!binding) {
    await replyMessage(replyToken, [
      textMessage('❌ ยังไม่ได้ผูกบัญชี\nกรุณาพิมพ์ "ผูก <รหัสนักเรียน>" ก่อน'),
    ], accessToken);
    return;
  }

  const students = await prisma.student.findMany({
    where: {
      studentCode: binding.studentCode,
      classroomId: { not: null },
    },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (students.length <= 1) {
    await replyMessage(replyToken, [
      textMessage('ℹ️ มีเพียงวิชาเดียว ไม่สามารถเปลี่ยนได้'),
    ], accessToken);
    return;
  }

  const name = students[0].name;
  const classrooms = students
    .filter((s) => s.classroom)
    .map((s) => ({
      classroomId: s.classroom!.id,
      classroomName: s.classroom!.name,
      teacherName: s.classroom!.user?.name || '',
    }));

  await replyMessage(replyToken, [
    buildClassroomSelectionFlex(name, classrooms),
  ], accessToken);
}

async function handleScoreQuery(
  replyToken: string,
  lineUserId: string,
  accessToken: string,
  teacherUserId: number
) {
  const { binding, student, classroom, errorMsg } = await resolveStudentContext(
    lineUserId, teacherUserId
  );

  if (errorMsg || !binding || !student || !classroom) {
    if (errorMsg === 'NEED_CLASSROOM') {
      await handleSwitchClassroom(replyToken, lineUserId, accessToken, teacherUserId);
    } else {
      await replyMessage(replyToken, [textMessage(errorMsg || '❌ เกิดข้อผิดพลาด')], accessToken);
    }
    return;
  }

  const targetWeeks = resolveTargetWeeks(classroom);

  // Weights
  const weightAssign = Number(classroom.assignmentWeight ?? 10);
  const weightPostTest = Number(classroom.postTestWeight ?? 70);
  const weightAffective = Number(classroom.affectiveWeight ?? 20);
  const weightMidterm = Number(classroom.midtermWeight ?? 0);
  const weightFinal = Number(classroom.finalWeight ?? 0);
  const maxMidtermScore = Number(classroom.midtermMaxScore ?? 100);
  const maxFinalScore = Number(classroom.finalMaxScore ?? 100);

  // Attendance config for F check
  const ratioLate = classroom.lateToAbsentRatio || 3;
  const ratioLeave = classroom.leaveToAbsentRatio || 2;
  const totalClasses = classroom.totalClasses || 40;
  const minAttPercent = classroom.minAttendancePercent || 80;
  const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

  const [structures, studentScores, attendanceRecords, dbCriteria] = await Promise.all([
    prisma.scoreStructure.findMany({
      where: { classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.studentScore.findMany({
      where: { studentId: student.id, classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { studentId: student.id, classroomId: classroom.id },
    }),
    prisma.gradeCriteria.findMany({
      where: { classroomId: classroom.id },
      orderBy: { minScore: 'desc' },
    }),
  ]);

  // Max raw scores
  const activeStructures = structures.filter((st) => st.lessonNumber <= targetWeeks);
  let maxAssignRaw = activeStructures.reduce((sum, st) => sum + Number(st.maxAssignmentScore ?? 0), 0);
  let maxPostTestRaw = activeStructures.reduce((sum, st) => sum + Number(st.maxPostTestScore ?? 0), 0);
  if (maxAssignRaw === 0) maxAssignRaw = targetWeeks * 10;
  if (maxPostTestRaw === 0) maxPostTestRaw = targetWeeks * 10;

  // Attendance counts
  let absentCount = 0, lateCount = 0, leaveCount = 0;
  for (const a of attendanceRecords) {
    if (a.status === 'absent') absentCount++;
    else if (a.status === 'late') lateCount++;
    else if (a.status === 'leave') leaveCount++;
  }

  const convertedFromLate = Math.floor(lateCount / ratioLate);
  const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
  const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
  const isF = totalConverted > maxAllowedAbsences;

  // Sum scores
  let sumAssignRaw = 0, sumPostTestRaw = 0;
  for (const sc of studentScores) {
    if (sc.assignmentScore !== null) sumAssignRaw += Number(sc.assignmentScore);
    if (sc.postTestScore !== null) sumPostTestRaw += Number(sc.postTestScore);
  }

  const midtermScore = Number(student.midtermScore ?? 0);
  const rawFinalScore = student.finalScore !== null ? Number(student.finalScore) : null;
  const isAbsentFinal = rawFinalScore === -1;
  const isIncomplete = rawFinalScore === -2;
  const finalScore = (rawFinalScore === null || rawFinalScore < 0) ? 0 : rawFinalScore;

  const preciseScaledAssign = maxAssignRaw > 0 ? (sumAssignRaw / maxAssignRaw) * weightAssign : 0;
  const preciseScaledPostTest = maxPostTestRaw > 0 ? (sumPostTestRaw / maxPostTestRaw) * weightPostTest : 0;
  const preciseScaledMidterm = maxMidtermScore > 0 ? (midtermScore / maxMidtermScore) * weightMidterm : 0;
  const preciseScaledFinal = maxFinalScore > 0 ? (finalScore / maxFinalScore) * weightFinal : 0;

  const affectiveScore = calculateAffectiveScore({
    baseScore: student.affectiveScore ? Number(student.affectiveScore) : null,
    maxWeight: weightAffective,
    absentCount,
    lateCount,
  });

  const totalScorePrecise = preciseScaledAssign + preciseScaledPostTest + affectiveScore + preciseScaledMidterm + preciseScaledFinal;
  const totalWeightSum = weightAssign + weightPostTest + weightAffective + weightMidterm + weightFinal;
  const percentage = totalWeightSum > 0 ? (totalScorePrecise / totalWeightSum) * 100 : 0;

  // Grade
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

  try {
    await replyMessage(replyToken, [
      buildScoreFlexMessage({
        studentName: student.name,
        classroomName: classroom.name,
        grade: finalGrade,
        percentage: percentage.toFixed(2),
        totalScore: Math.round(totalScorePrecise),
        maxScore: totalWeightSum,
        scaledAssignment: Math.round(preciseScaledAssign),
        maxAssignment: weightAssign,
        scaledPostTest: Math.round(preciseScaledPostTest),
        maxPostTest: weightPostTest,
        scaledMidterm: Math.round(preciseScaledMidterm),
        maxMidterm: weightMidterm,
        scaledFinal: Math.round(preciseScaledFinal),
        maxFinal: weightFinal,
        affectiveScore,
        maxAffective: weightAffective,
      }),
    ], accessToken);
  } catch (err) {
    console.error('Score flex reply error, falling back to text:', err);
    await replyMessage(replyToken, [
      textMessage(
        `📊 สรุปคะแนน\n` +
        `👤 ${student.name}\n` +
        `📚 ${classroom.name}\n\n` +
        `🏆 เกรด: ${finalGrade}\n` +
        `📈 ร้อยละ: ${percentage.toFixed(2)}%\n` +
        `🎯 คะแนนรวม: ${Math.round(totalScorePrecise)}/${totalWeightSum}`
      ),
    ], accessToken);
  }
}

async function handleAttendanceQuery(
  replyToken: string,
  lineUserId: string,
  accessToken: string,
  teacherUserId: number
) {
  const { binding, student, classroom, errorMsg } = await resolveStudentContext(
    lineUserId, teacherUserId
  );

  if (errorMsg || !binding || !student || !classroom) {
    if (errorMsg === 'NEED_CLASSROOM') {
      await handleSwitchClassroom(replyToken, lineUserId, accessToken, teacherUserId);
    } else {
      await replyMessage(replyToken, [textMessage(errorMsg || '❌ เกิดข้อผิดพลาด')], accessToken);
    }
    return;
  }

  const ratioLate = classroom.lateToAbsentRatio || 3;
  const ratioLeave = classroom.leaveToAbsentRatio || 2;
  const totalClasses = classroom.totalClasses || 40;
  const minAttPercent = classroom.minAttendancePercent || 80;
  const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

  const attendanceRecords = await prisma.attendance.findMany({
    where: { studentId: student.id, classroomId: classroom.id },
  });

  let presentCount = 0, lateCount = 0, absentCount = 0, leaveCount = 0;
  for (const a of attendanceRecords) {
    if (a.status === 'present') presentCount++;
    else if (a.status === 'late') lateCount++;
    else if (a.status === 'absent') absentCount++;
    else if (a.status === 'leave') leaveCount++;
  }

  const convertedFromLate = Math.floor(lateCount / ratioLate);
  const convertedFromLeave = Math.floor(leaveCount / ratioLeave);
  const totalConverted = absentCount + convertedFromLate + convertedFromLeave;
  const remaining = maxAllowedAbsences - totalConverted;
  const isF = totalConverted > maxAllowedAbsences;
  const attendancePercent = totalClasses > 0
    ? Math.max(0, Math.min(100, Math.round(((totalClasses - totalConverted) / totalClasses) * 100)))
    : 100;

  let status: 'safe' | 'warning' | 'critical' = 'safe';
  if (isF || remaining < 0) {
    status = 'critical';
  } else if (remaining <= 2) {
    status = 'warning';
  }

  try {
    await replyMessage(replyToken, [
      buildAttendanceFlexMessage({
        studentName: student.name,
        classroomName: classroom.name,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        leave: leaveCount,
        totalConverted,
        maxAllowed: maxAllowedAbsences,
        remaining,
        percent: attendancePercent,
        status,
        isF,
      }),
    ], accessToken);
  } catch (err) {
    console.error('Attendance flex reply error, falling back to text:', err);
    await replyMessage(replyToken, [
      textMessage(
        `📋 สถิติการเข้าเรียน\n` +
        `👤 ${student.name}\n` +
        `📚 ${classroom.name}\n\n` +
        `🟢 มาเรียน: ${presentCount} ครั้ง\n` +
        `🟡 สาย: ${lateCount} ครั้ง\n` +
        `🔴 ขาด: ${absentCount} ครั้ง\n` +
        `🔵 ลา: ${leaveCount} ครั้ง\n\n` +
        `ขาดรวม: ${totalConverted}/${maxAllowedAbsences}\n` +
        `เหลือขาดได้อีก: ${remaining} ครั้ง\n` +
        `อัตราเข้าเรียน: ${attendancePercent}%`
      ),
    ], accessToken);
  }
}

async function handleMissingTasksQuery(
  replyToken: string,
  lineUserId: string,
  accessToken: string,
  teacherUserId: number
) {
  const { binding, student, classroom, errorMsg } = await resolveStudentContext(
    lineUserId, teacherUserId
  );

  if (errorMsg || !binding || !student || !classroom) {
    if (errorMsg === 'NEED_CLASSROOM') {
      await handleSwitchClassroom(replyToken, lineUserId, accessToken, teacherUserId);
    } else {
      await replyMessage(replyToken, [textMessage(errorMsg || '❌ เกิดข้อผิดพลาด')], accessToken);
    }
    return;
  }

  const targetWeeks = resolveTargetWeeks(classroom);

  // Parallel fetch: score structures, student scores, and latest recorded score in classroom
  const [structures, studentScores, latestScoreInClassroom] = await Promise.all([
    prisma.scoreStructure.findMany({
      where: { classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.studentScore.findMany({
      where: { studentId: student.id, classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.studentScore.findFirst({
      where: { classroomId: classroom.id },
      orderBy: { lessonNumber: 'desc' },
      select: { lessonNumber: true },
    }),
  ]);

  // Determine current active week limit
  const highestRecordedWeek = latestScoreInClassroom?.lessonNumber || 0;
  let maxWeekToCheck = targetWeeks;

  if (classroom.semesterStartDate) {
    const currentWeek = getCurrentWeek(classroom.semesterStartDate, targetWeeks);
    if (currentWeek !== null) {
      maxWeekToCheck = Math.min(targetWeeks, Math.max(currentWeek, highestRecordedWeek));
    }
  } else if (highestRecordedWeek > 0) {
    maxWeekToCheck = Math.min(targetWeeks, highestRecordedWeek);
  } else if (structures.length > 0) {
    const maxStructureWeek = Math.max(...structures.map((s) => s.lessonNumber));
    if (maxStructureWeek > 0) {
      maxWeekToCheck = Math.min(targetWeeks, maxStructureWeek);
    }
  }

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

  const missingWeeks: MissingTaskWeek[] = [];
  let totalMissing = 0;
  let totalCompleted = 0;

  for (let w = 1; w <= maxWeekToCheck; w++) {
    const st = structureMap.get(w);
    const sc = scoresMap.get(w);

    const maxAssignment = st ? Number(st.maxAssignmentScore ?? 0) : 10;
    const maxPostTest = st ? Number(st.maxPostTestScore ?? 0) : 10;
    const assignmentScore = sc?.assignmentScore ?? null;
    const postTestScore = sc?.postTestScore ?? null;

    const hasAssignment = maxAssignment > 0;
    const hasPostTest = maxPostTest > 0;

    const isMissingAssignment = hasAssignment && (assignmentScore === null || assignmentScore === 0);
    const isMissingPostTest = hasPostTest && (postTestScore === null || postTestScore === 0);

    if (hasAssignment) {
      if (isMissingAssignment) {
        totalMissing++;
      } else {
        totalCompleted++;
      }
    }

    if (hasPostTest) {
      if (isMissingPostTest) {
        totalMissing++;
      } else {
        totalCompleted++;
      }
    }

    if (isMissingAssignment || isMissingPostTest) {
      missingWeeks.push({
        lessonNumber: w,
        lessonName: st?.lessonName || `สัปดาห์ที่ ${w}`,
        missingAssignment: isMissingAssignment,
        missingPostTest: isMissingPostTest,
        maxAssignmentScore: maxAssignment,
        maxPostTestScore: maxPostTest,
      });
    }
  }

  try {
    await replyMessage(replyToken, [
      buildMissingTasksFlexMessage({
        studentName: student.name,
        classroomName: classroom.name,
        totalMissing,
        totalCompleted,
        weeks: missingWeeks,
      }),
    ], accessToken);
  } catch (err) {
    console.error('Missing tasks flex reply error, falling back to text:', err);
    if (missingWeeks.length === 0) {
      await replyMessage(replyToken, [
        textMessage(
          `🎉 ยอดเยี่ยมมาก!\n` +
          `👤 ${student.name}\n` +
          `📚 ${classroom.name}\n\n` +
          `คุณไม่มีงานค้างเลย ส่งงานครบทุกสัปดาห์แล้ว 💯`
        ),
      ], accessToken);
    } else {
      const weekLines = missingWeeks.slice(0, 10).map((w) => {
        const details: string[] = [];
        if (w.missingAssignment) details.push(`• 📝 ใบงาน/การบ้าน (${w.maxAssignmentScore} คะแนน)`);
        if (w.missingPostTest) details.push(`• 📊 แบบทดสอบ (${w.maxPostTestScore} คะแนน)`);
        return `📌 สัปดาห์ที่ ${w.lessonNumber}: ${w.lessonName}\n${details.join('\n')}`;
      });

      const moreText = missingWeeks.length > 10 ? `\n...และอีก ${missingWeeks.length - 10} สัปดาห์` : '';

      await replyMessage(replyToken, [
        textMessage(
          `📝 รายการงานค้าง / ยังไม่ส่ง\n` +
          `👤 ${student.name}\n` +
          `📚 ${classroom.name}\n\n` +
          `🔴 ค้างส่ง: ${totalMissing} งาน\n` +
          `🟢 ส่งแล้ว: ${totalCompleted} งาน\n\n` +
          weekLines.join('\n\n') +
          moreText +
          `\n\n💡 ติดต่อครูผู้สอนเพื่อส่งงานหรือสอบแก้ตัวย้อนหลัง`
        ),
      ], accessToken);
    }
  }
}

// ==================== Helpers ====================

async function resolveStudentContext(lineUserId: string, _teacherUserId: number) {
  // Find binding
  const binding = await prisma.lineBinding.findFirst({
    where: { lineUserId },
  });

  if (!binding) {
    return {
      binding: null,
      student: null,
      classroom: null,
      errorMsg: '❌ ยังไม่ได้ผูกบัญชี\nกรุณาพิมพ์ "ผูก <รหัสนักเรียน>" เพื่อเริ่มต้นใช้งาน',
    };
  }

  // Find all classrooms for this student under this teacher
  // Find all classrooms for this student across all teachers
  const students = await prisma.student.findMany({
    where: {
      studentCode: binding.studentCode,
      classroomId: { not: null },
    },
    include: {
      classroom: true,
    },
  });

  if (students.length === 0) {
    return {
      binding,
      student: null,
      classroom: null,
      errorMsg: '❌ ไม่พบข้อมูลในระบบ อาจถูกลบแล้ว\nลองพิมพ์ "ยกเลิก" แล้ว "ผูก" ใหม่',
    };
  }

  // If classroom already selected in binding
  if (binding.classroomId) {
    const matched = students.find((s) => s.classroomId === binding.classroomId);
    if (matched && matched.classroom) {
      return { binding, student: matched, classroom: matched.classroom, errorMsg: null };
    }
  }

  // If only one classroom, use it
  if (students.length === 1 && students[0].classroom) {
    // Auto-bind classroom
    await prisma.lineBinding.update({
      where: { id: binding.id },
      data: { classroomId: students[0].classroomId },
    });
    return { binding, student: students[0], classroom: students[0].classroom, errorMsg: null };
  }

  // Multiple classrooms, need selection
  return {
    binding,
    student: null,
    classroom: null,
    errorMsg: 'NEED_CLASSROOM',
  };
}
