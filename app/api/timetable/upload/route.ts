import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { EntryType } from '@prisma/client';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-expect-error - pdf-parse lacks official type declarations
import pdfParse from 'pdf-parse';
import { PERIOD_TIMES } from '@/lib/constants';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel Serverless Function
export const dynamic = 'force-dynamic';

const DAY_MAP: Record<string, number> = {
  'จันทร์': 0, 'วันจันทร์': 0, 'mon': 0, 'monday': 0,
  'อังคาร': 1, 'วันอังคาร': 1, 'tue': 1, 'tuesday': 1,
  'พุธ': 2, 'วันพุธ': 2, 'wed': 2, 'wednesday': 2,
  'พฤหัสบดี': 3, 'วันพฤหัสบดี': 3, 'พฤหัส': 3, 'thu': 3, 'thursday': 3,
  'ศุกร์': 4, 'วันศุกร์': 4, 'fri': 4, 'friday': 4,
  'เสาร์': 5, 'วันเสาร์': 5, 'sat': 5, 'saturday': 5,
  'อาทิตย์': 6, 'วันอาทิตย์': 6, 'sun': 6, 'sunday': 6,
};

const TYPE_MAP: Record<string, string> = {
  'lecture': 'lecture', 'ทฤษฎี': 'lecture', 'บรรยาย': 'lecture',
  'lab': 'lab', 'ปฏิบัติ': 'lab',
  'activity': 'activity', 'กิจกรรม': 'activity',
  'homeroom': 'homeroom', 'โฮมรูม': 'homeroom', 'เข้าแถว': 'homeroom',
};

interface RawAIEntry {
  day_of_week?: number | string;
  start_period?: number | string;
  end_period?: number | string;
  subject_code?: string | null;
  subject_name?: string | null;
  room?: string | null;
  instructor?: string | null;
  group_name?: string | null;
  entry_type?: string | null;
}

function parseCSV(content: string, userId: number) {
  const cleanContent = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('ไฟล์ CSV ต้องมีอย่างน้อย 2 บรรทัด (header + data)');

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const entries = [];

  const headerMap: Record<string, number> = {};
  const ALIASES: Record<string, string[]> = {
    day: ['วัน', 'day', 'day_of_week', 'วัน/คาบ'],
    start_period: ['คาบเริ่ม', 'start_period', 'คาบเริ่มต้น', 'period_start', 'คาบ'],
    end_period: ['คาบสิ้นสุด', 'end_period', 'คาบจบ', 'period_end'],
    subject_code: ['รหัสวิชา', 'subject_code', 'code', 'รหัส'],
    subject_name: ['ชื่อวิชา', 'subject_name', 'subject', 'วิชา', 'ชื่อ'],
    room: ['ห้อง', 'room', 'ห้องเรียน'],
    group_name: ['กลุ่ม', 'group', 'group_name', 'กลุ่มเรียน', 'sec'],
    entry_type: ['ประเภท', 'type', 'entry_type'],
    instructor: ['อาจารย์', 'instructor', 'ผู้สอน', 'teacher'],
    hours: ['ชั่วโมง', 'hours', 'ชม.', 'ชม'],
  };

  for (const [key, aliases] of Object.entries(ALIASES)) {
    const idx = headers.findIndex(h => aliases.includes(h));
    if (idx >= 0) headerMap[key] = idx;
  }

  if (headerMap.day === undefined) {
    throw new Error('ไม่พบคอลัมน์ "วัน" ในไฟล์ CSV — กรุณาตรวจสอบ header');
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const dayStr = (cols[headerMap.day] || '').trim().toLowerCase();
    const dayNum = DAY_MAP[dayStr];
    if (dayNum === undefined) continue;

    const startPeriod = parseInt(cols[headerMap.start_period] || '1') || 1;
    const endPeriod = headerMap.end_period !== undefined
      ? (parseInt(cols[headerMap.end_period]) || startPeriod)
      : startPeriod;
    const hours = endPeriod - startPeriod + 1;

    const typeStr = (headerMap.entry_type !== undefined ? cols[headerMap.entry_type] : '') || '';
    const entryType = (TYPE_MAP[typeStr.toLowerCase()] || 'lecture') as EntryType;

    entries.push({
      userId,
      dayOfWeek: dayNum,
      startPeriod,
      endPeriod,
      startTime: PERIOD_TIMES[startPeriod]?.start ? new Date(`1970-01-01T${PERIOD_TIMES[startPeriod].start}`) : null,
      endTime: PERIOD_TIMES[endPeriod]?.end ? new Date(`1970-01-01T${PERIOD_TIMES[endPeriod].end}`) : null,
      subjectCode: headerMap.subject_code !== undefined ? cols[headerMap.subject_code] || null : null,
      subjectName: headerMap.subject_name !== undefined ? cols[headerMap.subject_name] || null : null,
      room: headerMap.room !== undefined ? cols[headerMap.room] || null : null,
      instructor: headerMap.instructor !== undefined ? cols[headerMap.instructor] || null : null,
      groupName: headerMap.group_name !== undefined ? cols[headerMap.group_name] || null : null,
      hours,
      entryType,
    });
  }
  return entries;
}

async function callGeminiWithFallback(
  genAI: GoogleGenerativeAI,
  parts: (string | { inlineData: { data: string; mimeType: string } })[]
) {
  const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
  let lastError: Error | null = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(parts);
      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini model ${modelName} attempt failed: ${lastError.message}`);
    }
  }

  throw new Error(`Google Gemini API ไม่สามารถประมวลผลได้ในขณะนี้: ${lastError?.message || 'Unknown'}`);
}

async function parsePDF(buffer: Buffer, userId: number) {
  const data = await pdfParse(buffer);
  const text = data.text;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ ไม่พบ GEMINI_API_KEY — กำลังใช้ Regex fallback สำหรับ PDF');
    return parsePDFRegexFallback(text, userId);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `
      คุณเป็นผู้เชี่ยวชาญการอ่านตารางสอนของสถาบันอาชีวศึกษาไทย
      หน้าที่ของคุณคือสกัดข้อมูลตารางสอนจากข้อความดิบ (Raw Text) ที่ดึงมาจากไฟล์ตารางสอน PDF ให้ถูกต้อง 100%
      
      ข้อความดิบที่ดึงมาจาก PDF มีดังนี้:
      """
      ${text}
      """
      
      ให้วิเคราะห์ข้อความและแยกแยะวิชาเรียนในแต่ละวัน โดยยึดหลักเกณฑ์ดังนี้:
      1. วันในสัปดาห์ (day_of_week):
         - 0 = วันจันทร์, 1 = วันอังคาร, 2 = วันพุธ, 3 = วันพฤหัสบดี, 4 = วันศุกร์, 5 = วันเสาร์, 6 = วันอาทิตย์
      2. เวลาและคาบเรียน:
         - กิจกรรมหน้าเสาธง/โฮมรูม ให้เริ่มที่คาบ 0 สิ้นสุดที่คาบ 0 (start_period: 0, end_period: 0)
         - คาบ 1: 08:00 - 09:00
         - คาบ 2: 09:00 - 10:00
         - คาบ 3: 10:00 - 11:00
         - คาบ 4: 11:00 - 12:00
         - คาบ 5: 13:00 - 14:00
         - คาบ 6: 14:00 - 15:00
         - คาบ 7: 15:00 - 16:00
         - คาบ 8: 16:00 - 17:00
         - คาบ 9: 17:00 - 18:00
         - คาบ 10: 18:00 - 19:00
         - คาบ 11: 19:00 - 20:00
      3. ค้นหารหัสวิชา (รูปแบบ 5 หลักขีด 4 หลัก เช่น 21909-2011) และจับคู่กับชื่อวิชา ห้องเรียน กลุ่มเรียน และอาจารย์ผู้สอน
      4. แปลงข้อมูลทั้งหมดเป็น JSON array ตามโครงสร้างนี้เท่านั้น:
      [
        {
          "day_of_week": number,
          "start_period": number,
          "end_period": number,
          "subject_code": string or null,
          "subject_name": string or null,
          "room": string or null,
          "group_name": string or null,
          "instructor": string or null,
          "entry_type": "lecture" | "lab" | "activity" | "homeroom"
        }
      ]
      ห้ามมีคำอธิบายประกอบ ให้ตอบกลับมาเป็น JSON array ล้วนๆ ที่สามารถใช้อ้างอิงและ JSON.parse() ได้ทันที
    `;

    const result = await callGeminiWithFallback(genAI, [prompt]);

    const responseText = result.response.text().trim();
    let parsedData: RawAIEntry[];
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      parsedData = JSON.parse(jsonStr);
    }
    
    if (!Array.isArray(parsedData)) {
      throw new Error("รูปแบบข้อมูลที่ AI ส่งกลับมาไม่ใช่ Array");
    }

    const aiData = parsedData;
    const entries = [];
    for (const item of aiData) {
      const startP = item.start_period !== undefined && item.start_period !== null ? parseInt(item.start_period) : 1;
      const endP = item.end_period !== undefined && item.end_period !== null ? parseInt(item.end_period) : startP;
      
      const rawType = (item.entry_type || 'lecture').toLowerCase().trim();
      let normalizedType = 'lecture';
      if (rawType === 'lab' || rawType.includes('lab') || rawType.includes('ปฏิบัติ')) {
        normalizedType = 'lab';
      } else if (rawType === 'activity' || rawType.includes('activity') || rawType.includes('กิจกรรม') || rawType.includes('ลูกเสือ')) {
        normalizedType = 'activity';
      } else if (rawType === 'homeroom' || rawType.includes('homeroom') || rawType.includes('โฮมรูม') || rawType.includes('เข้าแถว') || rawType.includes('เสาธง')) {
        normalizedType = 'homeroom';
      }

      entries.push({
        userId,
        dayOfWeek: Number(item.day_of_week),
        startPeriod: startP,
        endPeriod: endP,
        startTime: PERIOD_TIMES[startP]?.start ? new Date(`1970-01-01T${PERIOD_TIMES[startP].start}`) : null,
        endTime: PERIOD_TIMES[endP]?.end ? new Date(`1970-01-01T${PERIOD_TIMES[endP].end}`) : null,
        subjectCode: item.subject_code || null,
        subjectName: item.subject_name || null,
        room: item.room || null,
        instructor: item.instructor || null,
        groupName: item.group_name || null,
        hours: startP === 0 ? 0 : (endP - startP + 1),
        entryType: normalizedType as EntryType,
      });
    }

    return entries;
  } catch (error) {
    console.error("Failed to parse PDF with Gemini AI, falling back to regex:", error);
    return parsePDFRegexFallback(text, userId);
  }
}

function parsePDFRegexFallback(text: string, userId: number) {
  const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
  const entries = [];
  const dayPatterns = Object.keys(DAY_MAP);

  let currentDay: number | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of dayPatterns) {
      if (trimmed.startsWith(pattern) || trimmed.toLowerCase().startsWith(pattern)) {
        currentDay = DAY_MAP[pattern.toLowerCase()];
        break;
      }
    }

    const codeMatch = trimmed.match(/(\d{5}-\d{4})/g);
    if (codeMatch && currentDay !== null) {
      for (const code of codeMatch) {
        const afterCode = trimmed.split(code)[1] || '';
        const parts = afterCode.trim().split(/\s{2,}/);
        entries.push({
        userId,
        dayOfWeek: currentDay,
        startPeriod: 1,
        endPeriod: 1,
        startTime: new Date(`1970-01-01T${PERIOD_TIMES[1].start}`),
        endTime: new Date(`1970-01-01T${PERIOD_TIMES[1].end}`),
        subjectCode: code,
        subjectName: parts[0]?.trim() || null,
        room: parts[1]?.trim() || null,
        instructor: null,
        groupName: parts[2]?.trim() || null,
        hours: 1,
        entryType: 'lecture' as EntryType,
      });
      }
    }
  }
  return entries;
}

async function parseImageWithAI(buffer: Buffer, mimeType: string, userId: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('ไม่พบ API Key สำหรับ Gemini AI กรุณาตรวจสอบการตั้งค่า GEMINI_API_KEY ใน Vercel หรือไฟล์ .env');
  }

  let normalizedMime = mimeType;
  if (normalizedMime === 'image/jpg' || normalizedMime === 'image/pjpeg') {
    normalizedMime = 'image/jpeg';
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
    คุณเป็นผู้เชี่ยวชาญการอ่านตารางสอนของสถาบันอาชีวศึกษาไทย
    หน้าที่ของคุณคือสกัดข้อมูลตารางสอนจากภาพให้ถูกต้อง 100% โดยวิเคราะห์และจับคู่ข้อมูลจาก 2 ส่วน:
    1. ตารางสรุปรายวิชา (ด้านบน):
       - มีคอลัมน์: รหัสวิชา, ชื่อรายวิชา, ท. ป. น. ช.
       - ให้สร้างพจนานุกรมจับคู่รหัสวิชา -> ชื่อรายวิชา และจำนวนชั่วโมงเรียน (ช.) เอาไว้ใช้ตรวจสอบเปรียบเทียบเสมอ
       - ห้ามจินตนาการชื่อวิชาเองเด็ดขาด ต้องใช้ชื่อวิชาตรงตามที่สะกดในตารางสรุปด้านบนนี้เท่านั้น (ตัวอย่าง: "21909-2011" คือ "การเขียนโปรแกรมประยุกต์บนอุปกรณ์พกพา", "20001-1005" คือ "การใช้เทคโนโลยีดิจิทัลเพื่ออาชีพ", "30001-1003" คือ "การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ")
    2. ตารางตารางสอนรายสัปดาห์ (ด้านล่าง):
       - แถวแนวนอนแสดงวันในสัปดาห์ตามลำดับ:
         * แถวที่ 1: วันจันทร์ (day_of_week: 0)
         * แถวที่ 2: วันอังคาร (day_of_week: 1)
         * แถวที่ 3: วันพุธ (day_of_week: 2)
         * แถวที่ 4: วันพฤหัสบดี (day_of_week: 3)
         * แถวที่ 5: วันศุกร์ (day_of_week: 4)
         * แถวที่ 6: วันเสาร์ (day_of_week: 5)
         * แถวที่ 7: วันอาทิตย์ (day_of_week: 6)
         🚨 สำคัญมาก: แม้ว่าบางแถว (เช่น วันพฤหัสบดี) จะว่างเปล่าไม่มีวิชาเรียนเลย ห้ามข้ามหรือเลื่อนวิชาของแถวถัดไปขึ้นมาเด็ดขาด! แถวถัดมาคือวันศุกร์ (day_of_week: 4) และต้องมีค่าเป็นวันศุกร์เสมอ ห้ามสับสนเป็นวันพฤหัสบดี
       - คอลัมน์แนวตั้งแสดงเวลาและตัวเลขคาบเรียน (1, 2, 3, 4, พักกลางวัน, 5, 6, 7, 8, 9, 10, 11):
         * คอลัมน์แรกสุด 07:30 - 08:00 คือ "กิจกรรมหน้าเสาธง" ให้สร้างรายการนี้ให้กับทุกวันจันทร์ถึงศุกร์โดยกำหนดให้ start_period: 0, end_period: 0, subject_name: "กิจกรรมหน้าเสาธง", entry_type: "homeroom"
         * คาบ 1: 08:00 - 09:00
         * คาบ 2: 09:00 - 10:00
         * คาบ 3: 10:00 - 11:00
         * คาบ 4: 11:00 - 12:00
         * 12:00 - 13:00 คือ พักกลางวัน (ให้ข้ามไปเลย ห้ามนำมารวมในคาบเรียน)
         * คาบ 5: 13:00 - 14:00
         * คาบ 6: 14:00 - 15:00
         * คาบ 7: 15:00 - 16:00
         * คาบ 8: 16:00 - 17:00
         * คาบ 9: 17:00 - 18:00
         * คาบ 10: 18:00 - 19:00
         * คาบ 11: 19:00 - 20:00

    การวิเคราะห์ข้อมูลในแต่ละบล็อกการเรียน:
    - ให้ดูรหัสวิชา, สถานที่เรียน/ห้องเรียน, และกลุ่มเรียน/ชื่อผู้สอนที่ระบุไว้ในบล็อกนั้นๆ
    - สังเกตขอบเขตของกล่อง (Block Boundaries) ว่าเริ่มที่คาบใดและไปสิ้นสุดที่คาบใดในแนวคอลัมน์ และตรวจสอบความถูกต้องกับจำนวนชั่วโมงเรียน (ช.) จากตารางสรุปด้านบน ตัวอย่างเช่น:
      * ในวันจันทร์: วิชา "21909-2011" เริ่มต้นที่คาบ 5 (13:00) และลากยาวไปถึงคาบ 8 (17:00) รวมเป็น 4 คาบ (สอดคล้องกับ ช. = 4 ในตารางสรุป) ดังนั้น start_period: 5, end_period: 8
      * ในวันอังคาร: วิชา "20001-1005" เริ่มต้นที่คาบ 2 (09:00) และสิ้นสุดที่คาบ 4 (12:00) รวมเป็น 3 คาบ ดังนั้น start_period: 2, end_period: 4
      * ในวันพุธ เช้า: วิชา "20001-1005" เริ่มต้นที่คาบ 2 (09:00) และสิ้นสุดที่คาบ 4 (12:00) รวมเป็น 3 คาบ ดังนั้น start_period: 2, end_period: 4
      * ในวันพุธ บ่าย: วิชา "20000-2001" (กิจกรรมลูกเสือวิสามัญ 1) เริ่มต้นที่คาบ 5 (13:00) และสิ้นสุดที่คาบ 6 (15:00) รวมเป็น 2 คาบ ดังนั้น start_period: 5, end_period: 6
      * ในวันศุกร์: วิชา "30001-1003" เริ่มต้นที่คาบ 2 (09:00) และสิ้นสุดที่คาบ 4 (12:00) รวมเป็น 3 คาบ ดังนั้น start_period: 2, end_period: 4 (ต้องอยู่แถววันศุกร์ day_of_week: 4 เท่านั้น ห้ามใส่ในวันพฤหัสบดี)

    การสกัดฟิลด์ข้อมูล:
    - "subject_code": รหัสวิชา (เช่น "21909-2011")
    - "subject_name": ชื่อวิชาแบบเต็มจากตารางสรุปด้านบน
    - "room": ห้องเรียน (เช่น "735", "ห้องคอมฯ ต้นแบบ 2", "734", "โดม", "745")
    - "group_name": กลุ่มเรียน เช่น "ชค.2/1", "ชย.2/5", "ชค.1/1 ชค.1/2", "สชย.1/4 (จบ ม.6 / ต่างสาขา)" (ต้องตัดชื่อครูในวงเล็บ เช่น "(อ.ศิริยา)" หรือ "(อ.จริญยา)" ออกไปทั้งหมด)
    - "instructor": ชื่ออาจารย์ผู้สอนในวงเล็บท้ายบรรทัดกลุ่มเรียน (เช่น "อ.ศิริยา", "อ.ชญารัตน์", "อ.ณัฐนันท์", "อ.จริญยา") ถอดวงเล็บออก ถ้าไม่มีผู้สอนระบุไว้ให้เป็น null
    - "entry_type": ประเภทวิชา ให้เลือกค่าใดค่าหนึ่งจากนี้เท่านั้น: "lecture", "lab", "activity", "homeroom" (ตัวอย่าง: กิจกรรมหน้าเสาธง = homeroom, กิจกรรมลูกเสือวิสามัญ = activity, การเขียนโปรแกรม = lecture หรือ lab)

    แปลงข้อมูลทั้งหมดเป็น JSON array ตามโครงสร้างนี้เท่านั้น:
    [
      {
        "day_of_week": number,
        "start_period": number,
        "end_period": number,
        "subject_code": string or null,
        "subject_name": string or null,
        "room": string or null,
        "group_name": string or null,
        "instructor": string or null,
        "entry_type": "lecture" | "lab" | "activity" | "homeroom"
      }
    ]
    ห้ามมีคำอธิบายประกอบหรือการอธิบายเพิ่มเติม ห้ามมี Markdown code block (\`\`\`json) ให้ตอบกลับมาเป็น JSON array ล้วนๆ ที่สามารถใช้อ้างอิงและ JSON.parse() ได้ทันที
  `;

  const imageParts = [
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: normalizedMime
      }
    }
  ];

  try {
    const result = await callGeminiWithFallback(genAI, [prompt, ...imageParts]);

    const responseText = result.response.text().trim();
    let data: RawAIEntry[];
    try {
      data = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      data = JSON.parse(jsonStr);
    }
    
    if (!Array.isArray(data)) {
      throw new Error("รูปแบบข้อมูลที่ AI ส่งกลับมาไม่ใช่ Array");
    }

    const entries = [];
    for (const item of data) {
      const startP = item.start_period !== undefined && item.start_period !== null ? parseInt(item.start_period) : 1;
      const endP = item.end_period !== undefined && item.end_period !== null ? parseInt(item.end_period) : startP;
      
      // Normalize entry type to match MySQL enum constraints: 'lecture' | 'lab' | 'activity' | 'homeroom'
      const rawType = (item.entry_type || 'lecture').toLowerCase().trim();
      let normalizedType = 'lecture';
      if (rawType === 'lab' || rawType.includes('lab') || rawType.includes('ปฏิบัติ')) {
        normalizedType = 'lab';
      } else if (rawType === 'activity' || rawType.includes('activity') || rawType.includes('กิจกรรม') || rawType.includes('ลูกเสือ')) {
        normalizedType = 'activity';
      } else if (rawType === 'homeroom' || rawType.includes('homeroom') || rawType.includes('โฮมรูม') || rawType.includes('เข้าแถว') || rawType.includes('เสาธง')) {
        normalizedType = 'homeroom';
      }

      entries.push({
        userId,
        dayOfWeek: item.day_of_week,
        startPeriod: startP,
        endPeriod: endP,
        startTime: PERIOD_TIMES[startP]?.start ? new Date(`1970-01-01T${PERIOD_TIMES[startP].start}`) : null,
        endTime: PERIOD_TIMES[endP]?.end ? new Date(`1970-01-01T${PERIOD_TIMES[endP].end}`) : null,
        subjectCode: item.subject_code || null,
        subjectName: item.subject_name || null,
        room: item.room || null,
        instructor: item.instructor || null,
        groupName: item.group_name || null,
        hours: startP === 0 ? 0 : (endP - startP + 1),
        entryType: normalizedType as EntryType,
      });
    }
    
    return entries;
  } catch (error: unknown) {
    console.error("Gemini AI Parsing Error:", error);
    const msg = error instanceof Error ? error.message : 'Unknown';
    throw new Error('AI ไม่สามารถวิเคราะห์ตารางสอนจากรูปภาพนี้ได้: ' + msg);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ message: 'กรุณาเลือกไฟล์' }, { status: 400 });
    }

    // Limit maximum upload file size to 5MB to avoid memory exhaustion (DoS)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'ขนาดไฟล์เกินกำหนด (สูงสุดไม่เกิน 5MB)' }, { status: 413 });
    }

    const mime = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    interface TimetableEntryInput {
      userId: number;
      dayOfWeek: number;
      startPeriod: number;
      endPeriod: number;
      startTime: Date | null;
      endTime: Date | null;
      subjectCode: string | null;
      subjectName: string | null;
      room: string | null;
      instructor: string | null;
      groupName: string | null;
      hours: number;
      entryType: EntryType;
      timetableName?: string;
      semester?: string | null;
    }

    let entries: TimetableEntryInput[] = [];

    if (mime === 'text/csv' || mime === 'application/vnd.ms-excel' || file.name.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      entries = parseCSV(content, user.id);
    } else if (mime === 'application/pdf') {
      entries = await parsePDF(buffer, user.id);
    } else if (mime.startsWith('image/')) {
      entries = await parseImageWithAI(buffer, mime, user.id);
    } else {
      return NextResponse.json({ message: 'รองรับเฉพาะไฟล์ CSV, PDF หรือรูปภาพ (JPG, PNG) เท่านั้น' }, { status: 400 });
    }

    if (entries.length === 0) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลตารางสอนในไฟล์ — กรุณาตรวจสอบความถูกต้องของไฟล์' }, { status: 400 });
    }

    const timetableName = (formData.get('timetable_name') as string) || 'ตารางสอน';
    const semester = (formData.get('semester') as string) || null;
    
    entries = entries.map(e => ({
      ...e,
      timetableName,
      semester,
    }));

    let createdCount = 0;
    if (formData.get('replace') === 'true') {
      const [, created] = await prisma.$transaction([
        prisma.weeklySchedule.deleteMany({ where: { userId: user.id } }),
        prisma.weeklySchedule.createMany({ data: entries }),
      ]);
      createdCount = created.count;
    } else {
      const created = await prisma.weeklySchedule.createMany({ data: entries });
      createdCount = created.count;
    }

    return NextResponse.json({
      message: `นำเข้าตารางสอนสำเร็จ ${createdCount} รายการ`,
      data: { count: createdCount },
    }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Timetable upload error:', error);
    const msg = error instanceof Error ? error.message : 'อัพโหลดไม่สำเร็จ';
    const isUserError =
      msg.includes('CSV') ||
      msg.includes('header') ||
      msg.includes('คอลัมน์') ||
      msg.includes('ไม่พบข้อมูล') ||
      msg.includes('รูปแบบข้อมูล') ||
      msg.includes('GEMINI_API_KEY') ||
      msg.includes('API Key') ||
      msg.includes('AI ไม่สามารถวิเคราะห์') ||
      msg.includes('Google Gemini API');
    return NextResponse.json({ message: msg }, { status: isUserError ? 400 : 500 });
  }
}
