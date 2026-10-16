/**
 * LINE Messaging API Utilities
 *
 * Handles webhook signature verification, reply/push messages,
 * and Flex Message construction for student data responses.
 */

import crypto from 'crypto';

// ==================== Types ====================

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  postback?: {
    data: string;
  };
}

export interface LineWebhookBody {
  destination?: string;
  events: LineEvent[];
}

interface FlexBubble {
  type: 'bubble';
  size?: string;
  header?: Record<string, unknown>;
  hero?: Record<string, unknown>;
  body: Record<string, unknown>;
  footer?: Record<string, unknown>;
  styles?: Record<string, unknown>;
}

interface FlexCarousel {
  type: 'carousel';
  contents: FlexBubble[];
}

// ==================== Signature Verification ====================

export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  if (!body || !signature || !channelSecret) return false;
  const cleanSecret = channelSecret.trim().replace(/^["']|["']$/g, '');
  const hash = crypto
    .createHmac('SHA256', cleanSecret)
    .update(body)
    .digest('base64');
  return hash === signature.trim();
}

// ==================== Reply / Push Messages ====================

export async function replyMessage(
  replyToken: string,
  messages: Record<string, unknown>[],
  channelAccessToken: string
): Promise<void> {
  const cleanToken = channelAccessToken.trim().replace(/^["']|["']$/g, '');
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('LINE reply error:', response.status, errorBody);
  }
}

export async function pushMessage(
  to: string,
  messages: Record<string, unknown>[],
  channelAccessToken: string
): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('LINE push error:', response.status, errorBody);
  }
}

// ==================== Text Helpers ====================

export function textMessage(text: string): Record<string, unknown> {
  return { type: 'text', text };
}

// ==================== Flex Message Builders ====================

/**
 * Build a Flex Message showing attendance summary
 */
export function buildAttendanceFlexMessage(data: {
  studentName: string;
  classroomName: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalConverted: number;
  maxAllowed: number;
  remaining: number;
  percent: number;
  status: 'safe' | 'warning' | 'critical';
  isF: boolean;
}): Record<string, unknown> {
  const statusColor = data.status === 'safe' ? '#27ae60' : data.status === 'warning' ? '#f39c12' : '#e74c3c';
  const statusText = data.status === 'safe' ? '✅ ปลอดภัย' : data.status === 'warning' ? '⚠️ เฝ้าระวัง' : '🚨 เสี่ยงตกออก';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '📋 สถิติการเข้าเรียน',
          weight: 'bold',
          size: 'lg',
          color: '#1a1a2e',
        },
        {
          type: 'text',
          text: `${data.studentName} — ${data.classroomName}`,
          size: 'sm',
          color: '#666666',
          wrap: true,
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          margin: 'lg',
          contents: [
            buildStatRow('🟢 มาเรียน', `${data.present} ครั้ง`, '#27ae60'),
            buildStatRow('🟡 สาย', `${data.late} ครั้ง`, '#f39c12'),
            buildStatRow('🔴 ขาด', `${data.absent} ครั้ง`, '#e74c3c'),
            buildStatRow('🔵 ลา', `${data.leave} ครั้ง`, '#3498db'),
          ],
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          margin: 'lg',
          contents: [
            buildStatRow('ขาดรวม (แปลงแล้ว)', `${data.totalConverted}/${data.maxAllowed}`, '#333'),
            buildStatRow('เหลือขาดได้อีก', `${data.remaining} ครั้ง`, data.remaining <= 2 ? '#e74c3c' : '#333'),
            buildStatRow('อัตราเข้าเรียน', `${data.percent}%`, '#333'),
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'xl',
          contents: [
            {
              type: 'text',
              text: statusText,
              weight: 'bold',
              size: 'md',
              color: statusColor,
              align: 'center',
            },
          ],
        },
      ],
    },
    styles: {
      body: { separator: false },
    },
  };

  return {
    type: 'flex',
    altText: `สถิติการเข้าเรียน: ${data.studentName}`,
    contents: bubble,
  };
}

/**
 * Build a Flex Message showing score/grade summary
 */
export function buildScoreFlexMessage(data: {
  studentName: string;
  classroomName: string;
  grade: string;
  percentage: string;
  totalScore: number;
  maxScore: number;
  scaledAssignment: number;
  maxAssignment: number;
  scaledPostTest: number;
  maxPostTest: number;
  scaledMidterm: number;
  maxMidterm: number;
  scaledFinal: number;
  maxFinal: number;
  affectiveScore: number;
  maxAffective: number;
}): Record<string, unknown> {
  const gradeColor = getGradeColor(data.grade);

  const scoreRows: Record<string, unknown>[] = [
    buildStatRow('📝 งาน', `${data.scaledAssignment}/${data.maxAssignment}`, '#333'),
    buildStatRow('📊 ทดสอบ', `${data.scaledPostTest}/${data.maxPostTest}`, '#333'),
  ];

  if (data.maxMidterm > 0) {
    scoreRows.push(buildStatRow('📑 กลางภาค', `${data.scaledMidterm}/${data.maxMidterm}`, '#333'));
  }
  if (data.maxFinal > 0) {
    scoreRows.push(buildStatRow('📑 ปลายภาค', `${data.scaledFinal}/${data.maxFinal}`, '#333'));
  }

  scoreRows.push(buildStatRow('💭 จิตพิสัย', `${data.affectiveScore.toFixed(1)}/${data.maxAffective}`, '#333'));

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '📊 สรุปคะแนน',
          weight: 'bold',
          size: 'lg',
          color: '#1a1a2e',
        },
        {
          type: 'text',
          text: `${data.studentName} — ${data.classroomName}`,
          size: 'sm',
          color: '#666666',
          wrap: true,
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          spacing: 'none',
          contents: [
            {
              type: 'text',
              text: data.grade,
              size: '3xl',
              weight: 'bold',
              color: gradeColor,
              align: 'center',
            },
            {
              type: 'text',
              text: `${data.percentage}% (${data.totalScore}/${data.maxScore} คะแนน)`,
              size: 'sm',
              color: '#666666',
              align: 'center',
              margin: 'sm',
            },
          ],
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          margin: 'lg',
          contents: scoreRows,
        },
      ],
    },
    styles: {
      body: { separator: false },
    },
  };

  return {
    type: 'flex',
    altText: `สรุปคะแนน: ${data.studentName} — เกรด ${data.grade}`,
    contents: bubble,
  };
}

/**
 * Build a Flex Message for classroom selection
 */
export function buildClassroomSelectionFlex(
  studentName: string,
  classrooms: { classroomId: number; classroomName: string; teacherName: string }[]
): Record<string, unknown> {
  const items = classrooms.map((c) => ({
    type: 'button',
    action: {
      type: 'postback',
      label: c.classroomName.length > 20 ? c.classroomName.substring(0, 17) + '...' : c.classroomName,
      data: `action=select_classroom&classroom_id=${c.classroomId}`,
      displayText: c.classroomName,
    },
    style: 'primary',
    color: '#4a6cf7',
    margin: 'sm',
    height: 'sm',
  }));

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '📚 เลือกวิชา',
          weight: 'bold',
          size: 'lg',
          color: '#1a1a2e',
        },
        {
          type: 'text',
          text: `สวัสดี ${studentName}\nกรุณาเลือกวิชาที่ต้องการดูข้อมูล`,
          size: 'sm',
          color: '#666666',
          wrap: true,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: items,
    },
  };

  return {
    type: 'flex',
    altText: `เลือกวิชาสำหรับ ${studentName}`,
    contents: bubble,
  };
}

/**
 * Build welcome / help message
 */
export function buildHelpMessage(): Record<string, unknown> {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      contents: [
        {
          type: 'text',
          text: '📖 วิธีใช้งาน',
          weight: 'bold',
          size: 'xl',
          color: '#1a1a2e',
        },
        { type: 'separator' },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: '🔗 ผูกบัญชี',
              weight: 'bold',
              size: 'md',
              color: '#4a6cf7',
            },
            {
              type: 'text',
              text: 'พิมพ์ "ผูก 12345" (ใส่รหัสนักเรียน)\nตัวอย่าง: ผูก 65001',
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: '📊 ดูคะแนน',
              weight: 'bold',
              size: 'md',
              color: '#27ae60',
            },
            {
              type: 'text',
              text: 'พิมพ์ "คะแนน" หรือ "เกรด"',
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: '📋 ดูการเข้าเรียน',
              weight: 'bold',
              size: 'md',
              color: '#e74c3c',
            },
            {
              type: 'text',
              text: 'พิมพ์ "เข้าเรียน" "ขาด" "สาย" หรือ "ลา"',
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: '🔄 เปลี่ยนวิชา',
              weight: 'bold',
              size: 'md',
              color: '#f39c12',
            },
            {
              type: 'text',
              text: 'พิมพ์ "เปลี่ยนวิชา"',
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: '❌ ยกเลิกผูกบัญชี',
              weight: 'bold',
              size: 'md',
              color: '#95a5a6',
            },
            {
              type: 'text',
              text: 'พิมพ์ "ยกเลิก"',
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
          ],
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: 'วิธีใช้งาน LINE Bot',
    contents: bubble,
  };
}

// ==================== Private Helpers ====================

function buildStatRow(label: string, value: string, color: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: '#555555',
        flex: 5,
      },
      {
        type: 'text',
        text: value,
        size: 'sm',
        color: color,
        align: 'end',
        weight: 'bold',
        flex: 4,
      },
    ],
  };
}

function getGradeColor(grade: string): string {
  if (grade === '4') return '#27ae60';
  if (grade === '3.5' || grade === '3') return '#2ecc71';
  if (grade === '2.5' || grade === '2') return '#f39c12';
  if (grade === '1.5' || grade === '1') return '#e67e22';
  if (grade === '0') return '#e74c3c';
  // Special grades (ข.ร., ข.ส., ม.ส.)
  return '#e74c3c';
}
