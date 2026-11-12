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
import { resolveTargetWeeks, resolveCurrentTeachingWeek } from '@/lib/semester';
import { decryptIfPresent, encryptIfPresent } from '@/lib/encryption';
import { getOrSetCache, invalidateCache } from '@/lib/cache';
import { getAttendanceConfig, computeAbsentConversion } from '@/lib/formatters';
import {
  extractClassroomWeights,
  normalizeGradeCriteria,
  calculateStudentGradeSummary,
} from '@/lib/gradeCalculator';
import {
  checkRateLimitAsync,
  recordSuccessfulQueryAsync,
  recordUserActivity,
  getDailyQuotaStatusAsync,
} from '@/lib/lineRateLimit';
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

interface DecryptedChannelConfig {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  userId: number;
}

async function resolveMatchedChannelConfig(
  rawBody: string,
  signature: string,
  targetChannelId?: string | null
): Promise<DecryptedChannelConfig | null> {
  // 1. O(1) Direct lookup when channelId is specified in URL path or query parameter
  if (targetChannelId && targetChannelId.trim() && targetChannelId !== 'env-default' && targetChannelId !== 'env-configured') {
    const cleanId = targetChannelId.trim();
    const singleConfig = await getOrSetCache<DecryptedChannelConfig | null>(
      `line:config:${cleanId}`,
      120,
      async () => {
        const cfg = await prisma.lineChannelConfig.findFirst({
          where: { channelId: cleanId, isActive: true },
        });
        if (!cfg) return null;
        return {
          channelId: cfg.channelId,
          channelSecret: decryptIfPresent(cfg.channelSecret),
          channelAccessToken: decryptIfPresent(cfg.channelAccessToken),
          userId: cfg.userId,
        };
      }
    );

    if (singleConfig && verifyLineSignature(rawBody, signature, singleConfig.channelSecret)) {
      return singleConfig;
    }
  }

  // 2. Cached lookup across active channels (avoids repeated DB queries & AES-GCM decryption on every webhook)
  const activeConfigs = await getOrSetCache<DecryptedChannelConfig[]>(
    'line:active_configs',
    60,
    async () => {
      const rows = await prisma.lineChannelConfig.findMany({
        where: { isActive: true },
      });
      return rows.map((cfg) => ({
        channelId: cfg.channelId,
        channelSecret: decryptIfPresent(cfg.channelSecret),
        channelAccessToken: decryptIfPresent(cfg.channelAccessToken),
        userId: cfg.userId,
      }));
    }
  );

  for (const config of activeConfigs) {
    if (verifyLineSignature(rawBody, signature, config.channelSecret)) {
      return config;
    }
  }

  return null;
}

// GET /api/line/webhook — Minimal health check (does not expose internal counts or secret metadata)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is running',
  });
}

// POST /api/line/webhook (and /api/line/webhook/[channelId])
export async function POST(request: NextRequest) {
  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean);
  const pathChannelId =
    pathSegments.length >= 4 && pathSegments[2] === 'webhook'
      ? decodeURIComponent(pathSegments[3])
      : undefined;
  return handleLineWebhook(request, pathChannelId);
}

async function handleLineWebhook(request: NextRequest, explicitChannelId?: string) {
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

    // 3. Find matching LINE channel config (O(1) by channelId or cached active configs)
    const targetChannelId = explicitChannelId || request.nextUrl.searchParams.get('channel_id');
    let matchedConfig = await resolveMatchedChannelConfig(rawBody, signature, targetChannelId);

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
          channelId: envChannelId,
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
          invalidateCache('line:');
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
    recordUserActivity(lineUserId);
    await replyMessage(replyToken, [buildHelpMessage()], accessToken);
    return;
  }

  // --- Quota / Daily status: "โควต้า" / "สิทธิ์" / "สถานะ" ---
  if (['โควต้า', 'quota', 'สิทธิ์', 'เช็คสิทธิ์', 'สถานะการเช็ค', 'สถานะโควต้า'].includes(lowerText)) {
    recordUserActivity(lineUserId);
    const { binding } = await resolveStudentContext(lineUserId, teacherUserId);
    if (!binding) {
      await replyMessage(
        replyToken,
        [textMessage('❌ ยังไม่ได้ผูกบัญชี กรุณาพิมพ์ "ผูก <รหัสนักเรียน>" ก่อนใช้งานครับ')],
        accessToken
      );
      return;
    }
    const statusMsg = await getDailyQuotaStatusAsync(lineUserId, binding.studentCode, binding.classroomId);
    await replyMessage(replyToken, [textMessage(statusMsg)], accessToken);
    return;
  }

  // --- Bind account: "ผูก 12345" ---
  const bindMatch = text.match(/^(?:ผูก|bind|register|ลงทะเบียน)\s+(.+)$/i);
  if (bindMatch) {
    recordUserActivity(lineUserId);
    const studentCode = bindMatch[1].trim();
    await handleBind(replyToken, lineUserId, studentCode, accessToken, teacherUserId);
    return;
  }

  // --- Unbind / ลบการผูก: "ยกเลิก" / "ลบ" / "ลบการผูก" / "ปลดผูก" ---
  const isUnbind =
    /^(?:ยกเลิก|ลบ|ปลด|unbind|unlink|delete|remove|reset|รีเซ็ต|รีเซต)(?:\s*(?:การผูก|ผูก|บัญชี|เชื่อมต่อ)?(?:\s+\S+)?)?$/i.test(text);
  if (isUnbind) {
    recordUserActivity(lineUserId);
    await handleUnbind(replyToken, lineUserId, accessToken);
    return;
  }

  // --- Change classroom: "เปลี่ยนวิชา" ---
  if (['เปลี่ยนวิชา', 'เปลี่ยน', 'switch', 'เลือกวิชา'].includes(lowerText)) {
    recordUserActivity(lineUserId);
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

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        name: true,
        isPortalEnabled: true,
        user: { select: { name: true } },
      },
    });

    const teacherInfo = classroom?.user?.name ? `\n👨‍🏫 ผู้สอน: ${classroom.user.name}` : '';

    if (classroom && !classroom.isPortalEnabled) {
      await replyMessage(event.replyToken!, [
        textMessage(
          `🔒 รายวิชา "${classroom.name}"${teacherInfo}\n` +
          `ครูผู้สอนปิดการเข้าดูชั่วคราว ยังไม่สามารถตรวจสอบคะแนนหรือเวลาเรียนได้ในขณะนี้`
        ),
      ], accessToken);
      return;
    }

    await prisma.lineBinding.update({
      where: { id: binding.id },
      data: { classroomId },
    });

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
          isPortalEnabled: true,
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
    const isPortalOpen = students[0].classroom?.isPortalEnabled !== false;
    const footerHint = isPortalOpen
      ? `พิมพ์ "คะแนน" หรือ "เข้าเรียน" เพื่อดูข้อมูล`
      : `🔒 หมายเหตุ: ขณะนี้ครูผู้สอนปิดการเข้าดูชั่วคราว คุณจะสามารถเช็คคะแนนและเวลาเรียนได้เมื่อครูเปิดระบบ`;
    await replyMessage(replyToken, [
      textMessage(
        `✅ ผูกบัญชีสำเร็จ!\n\n` +
        `👤 ${students[0].name}\n` +
        `📚 ${students[0].classroom?.name}${teacherName}\n\n` +
        footerHint
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
        isPortalEnabled: s.classroom!.isPortalEnabled,
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
          isPortalEnabled: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (students.length <= 1) {
    const onlyClassroom = students[0]?.classroom;
    if (onlyClassroom && !onlyClassroom.isPortalEnabled) {
      await replyMessage(replyToken, [
        textMessage(`🔒 คุณมีเพียงวิชาเดียวคือ "${onlyClassroom.name}" และขณะนี้ครูผู้สอนปิดการเข้าดูชั่วคราว`),
      ], accessToken);
      return;
    }
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
      isPortalEnabled: s.classroom!.isPortalEnabled,
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

  // Rate limit check: 1 check per day per category (Serverless/DB-synced)
  const rateLimit = await checkRateLimitAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'score',
  });

  if (!rateLimit.allowed) {
    await replyMessage(
      replyToken,
      [textMessage(rateLimit.message || '⚠️ คุณได้ตรวจสอบข้อมูลของวันนี้ไปแล้วครับ')],
      accessToken
    );
    return;
  }

  const targetWeeks = resolveTargetWeeks(classroom);
  const weightsConfig = extractClassroomWeights(classroom);
  const {
    assignmentWeight: weightAssign,
    postTestWeight: weightPostTest,
    affectiveWeight: weightAffective,
    midtermWeight: weightMidterm,
    finalWeight: weightFinal,
    totalWeightSum,
  } = weightsConfig;

  const attConfig = getAttendanceConfig(classroom);

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

  const attConv = computeAbsentConversion(
    { absent: absentCount, late: lateCount, leave: leaveCount },
    attConfig
  );
  const isF = attConv.isF;

  // Sum scores
  let sumAssignRaw = 0, sumPostTestRaw = 0;
  for (const sc of studentScores) {
    if (sc.assignmentScore !== null) sumAssignRaw += Number(sc.assignmentScore);
    if (sc.postTestScore !== null) sumPostTestRaw += Number(sc.postTestScore);
  }

  const criteria = normalizeGradeCriteria(dbCriteria);
  const calc = calculateStudentGradeSummary({
    sumAssignRaw,
    maxAssignRaw,
    sumPostTestRaw,
    maxPostTestRaw,
    midtermScore: student.midtermScore,
    finalScore: student.finalScore,
    examStatus: student.examStatus,
    baseAffectiveScore: student.affectiveScore,
    absentCount,
    lateCount,
    isF,
    weights: weightsConfig,
    criteria,
  });

  try {
    await replyMessage(replyToken, [
      buildScoreFlexMessage({
        studentName: student.name,
        classroomName: classroom.name,
        grade: calc.grade,
        percentage: calc.percentage,
        totalScore: calc.totalScore,
        maxScore: totalWeightSum,
        scaledAssignment: calc.scaledAssign,
        maxAssignment: weightAssign,
        scaledPostTest: calc.scaledPostTest,
        maxPostTest: weightPostTest,
        scaledMidterm: calc.scaledMidterm,
        maxMidterm: weightMidterm,
        scaledFinal: calc.scaledFinal,
        maxFinal: weightFinal,
        affectiveScore: calc.affectiveScore,
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
        `🏆 เกรด: ${calc.grade}\n` +
        `📈 ร้อยละ: ${calc.percentage}%\n` +
        `🎯 คะแนนรวม: ${calc.totalScore}/${totalWeightSum}`
      ),
    ], accessToken);
  }

  await recordSuccessfulQueryAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'score',
  });
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

  // Rate limit check: 1 check per day per category (Serverless/DB-synced)
  const rateLimit = await checkRateLimitAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'attendance',
  });

  if (!rateLimit.allowed) {
    await replyMessage(
      replyToken,
      [textMessage(rateLimit.message || '⚠️ คุณได้ตรวจสอบข้อมูลของวันนี้ไปแล้วครับ')],
      accessToken
    );
    return;
  }

  const attConfig = getAttendanceConfig(classroom);

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

  const attConv = computeAbsentConversion(
    { absent: absentCount, late: lateCount, leave: leaveCount },
    attConfig
  );
  const totalConverted = attConv.totalConverted;
  const maxAllowedAbsences = attConv.maxAllowedAbsences;
  const remaining = attConv.remaining;
  const isF = attConv.isF;
  const attendancePercent = attConv.attendancePercent;

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

  await recordSuccessfulQueryAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'attendance',
  });
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

  // Rate limit check: 1 check per day per category (Serverless/DB-synced)
  const rateLimit = await checkRateLimitAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'tasks',
  });

  if (!rateLimit.allowed) {
    await replyMessage(
      replyToken,
      [textMessage(rateLimit.message || '⚠️ คุณได้ตรวจสอบข้อมูลของวันนี้ไปแล้วครับ')],
      accessToken
    );
    return;
  }

  const targetWeeks = resolveTargetWeeks(classroom);

  // Parallel fetch: score structures, student scores, latest recorded score in classroom, and attendance dates
  const [structures, studentScores, latestScoreInClassroom, classroomAttendanceDates, classroomWeeklySchedules] = await Promise.all([
    prisma.scoreStructure.findMany({
      where: { classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.studentScore.findMany({
      where: { studentId: student.id, classroomId: classroom.id },
      orderBy: { lessonNumber: 'asc' },
    }),
    prisma.studentScore.findFirst({
      where: {
        classroomId: classroom.id,
        OR: [
          { assignmentScore: { not: null, gt: 0 } },
          { postTestScore: { not: null, gt: 0 } },
        ],
      },
      orderBy: { lessonNumber: 'desc' },
      select: { lessonNumber: true },
    }),
    prisma.attendance.findMany({
      where: { classroomId: classroom.id },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    }),
    prisma.weeklySchedule.findMany({
      where: { classroomId: classroom.id },
      select: { dayOfWeek: true },
    }),
  ]);

  // Determine current active week limit (do not count weeks that haven't reached teaching time yet)
  const earliestAttendanceDate = classroomAttendanceDates.length > 0 ? classroomAttendanceDates[0].date : null;
  const effectiveStartDate = classroom.semesterStartDate || earliestAttendanceDate;
  const highestRecordedWeek = latestScoreInClassroom?.lessonNumber || 0;
  const timetableDays = Array.from(new Set(classroomWeeklySchedules.map((ws) => ws.dayOfWeek)));

  const maxWeekToCheck = resolveCurrentTeachingWeek({
    startDate: effectiveStartDate,
    totalWeeks: targetWeeks,
    highestScoredWeek: highestRecordedWeek,
    attendanceDatesCount: classroomAttendanceDates.length,
    timetableDays,
  });

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

  await recordSuccessfulQueryAsync({
    lineUserId,
    studentCode: student.studentCode || binding.studentCode,
    classroomId: classroom.id,
    category: 'tasks',
  });
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
      if (!matched.classroom.isPortalEnabled) {
        const hasOtherOpen = students.some(
          (s) => s.classroomId !== matched.classroomId && s.classroom?.isPortalEnabled
        );
        return {
          binding,
          student: null,
          classroom: null,
          errorMsg:
            `🔒 รายวิชา "${matched.classroom.name}"\nครูผู้สอนปิดการเข้าดูชั่วคราวในขณะนี้` +
            (hasOtherOpen ? `\n\n💡 พิมพ์ "เปลี่ยนวิชา" เพื่อดูรายวิชาอื่นที่เปิดอยู่` : ''),
        };
      }
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
    if (!students[0].classroom.isPortalEnabled) {
      return {
        binding,
        student: null,
        classroom: null,
        errorMsg: `🔒 รายวิชา "${students[0].classroom.name}"\nครูผู้สอนปิดการเข้าดูชั่วคราวในขณะนี้`,
      };
    }
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
