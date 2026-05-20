import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Period time mapping ────────────────────────────────────────────────────
const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  0:  { start: '07:30', end: '08:00' },
  1:  { start: '08:00', end: '09:00' },
  2:  { start: '09:00', end: '10:00' },
  3:  { start: '10:00', end: '11:00' },
  4:  { start: '11:00', end: '12:00' },
  5:  { start: '13:00', end: '14:00' },
  6:  { start: '14:00', end: '15:00' },
  7:  { start: '15:00', end: '16:00' },
  8:  { start: '16:00', end: '17:00' },
  9:  { start: '17:00', end: '18:00' },
  10: { start: '18:00', end: '19:00' },
  11: { start: '19:00', end: '20:00' },
  12: { start: '20:00', end: '21:00' },
};

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

function parseCSV(content: string, userId: number) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
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
    const entryType = TYPE_MAP[typeStr.toLowerCase()] || 'lecture';

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

async function parsePDF(buffer: Buffer, userId: number) {
  // @ts-ignore
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const text = data.text;
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
          groupName: parts[2]?.trim() || null,
          hours: 1,
          entryType: 'lecture',
        });
      }
    }
  }
  return entries;
}

async function parseImageWithAI(buffer: Buffer, mimeType: string, userId: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('ไม่พบ API Key สำหรับ Gemini AI กรุณาตรวจสอบการตั้งค่า');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    คุณเป็นผู้เชี่ยวชาญการอ่านตารางสอนของสถาบันอาชีวศึกษาไทย
    หน้าที่ของคุณคือ สกัดข้อมูลตารางสอนจากภาพให้ถูกต้อง 100% โดยต้องอ่านและเทียบเคียงข้อมูลจากตาราง 2 ส่วน คือ
    1. ตารางสรุปรายวิชา (ด้านบน) เพื่อหาชื่อวิชาที่ตรงกับรหัสวิชา
    2. ตารางตารางสอน (ด้านล่าง) เพื่อดูวันและคาบเวลาเรียน

    โปรดอ่านลักษณะของคาบเรียน (บล็อก/กล่องข้อมูลในตารางสอนประจำวัน):
    - แต่ละบล็อกในช่องวัน (แถวแนวนอน จันทร์-อาทิตย์) มักระบุข้อมูล 3 บรรทัดดังนี้:
      * บรรทัดที่ 1: รหัสวิชา (เช่น "21909-2011" หรือ "20001-1005")
      * บรรทัดที่ 2: ห้องเรียนหรือสถานที่เรียน (เช่น "735", "ห้องคอมฯ ต้นแบบ 2", "โดม")
      * บรรทัดที่ 3: กลุ่มเรียน และ ชื่ออาจารย์ในวงเล็บ (เช่น "ชค.2/1 (อ.ศิริยา)" หรือ "ชย.2/5 (อ.ชญารัตน์)")
    - หน้าที่ของคุณคือ:
      * สกัดรหัสวิชา ไปใส่ใน "subject_code"
      * นำรหัสวิชาไปค้นหาชื่อวิชาจากตารางสรุปด้านบน แล้วมาใส่ใน "subject_name" ให้เต็มและถูกต้อง
      * สกัดห้องเรียนหรือสถานที่ ไปใส่ใน "room"
      * สกัดกลุ่มเรียน (เช่น "ชค.2/1", "ชย.2/5", "ชค.1/1 ชค.1/2") ไปใส่ใน "group_name" (ตัดชื่ออาจารย์และวงเล็บออก)
      * สกัดชื่อครูผู้สอนที่อยู่ในวงเล็บ (เช่น "อ.ศิริยา", "อ.ชญารัตน์", "อ.ณัฐนันท์") ไปใส่ใน "instructor" (ถอดวงเล็บออก)

    โปรดอ่านโครงสร้างเวลาในตารางให้แม่นยำ:
    - คอลัมน์แรกสุดคือเวลา 07:30-08:00 ซึ่งเป็น "กิจกรรมหน้าเสาธง" (ให้สร้าง 1 รายการต่อ 1 วันจันทร์-ศุกร์ โดยกำหนดให้ start_period: 0, end_period: 0, subject_name: "กิจกรรมหน้าเสาธง", entry_type: "homeroom")
    - คอลัมน์คาบเรียน จะมีตัวเลขกำกับด้านล่างของเวลาชัดเจน (คาบ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
    - คาบ 1 คือ 08:00-09:00
    - คาบ 2 คือ 09:00-10:00
    - คาบ 3 คือ 10:00-11:00
    - คาบ 4 คือ 11:00-12:00
    - คอลัมน์ 12:00-13:00 คือ "พักกลางวัน" ห้ามนำมานับเป็นคาบเรียน และไม่ต้องสกัดข้อมูลออกมา
    - คาบ 5 เริ่มที่ 13:00-14:00
    - คาบ 6 เริ่มที่ 14:00-15:00
    - คาบ 7 เริ่มที่ 15:00-16:00
    - คาบ 8 เริ่มที่ 16:00-17:00
    - คาบ 9 เริ่มที่ 17:00-18:00
    - คาบ 10 เริ่มที่ 18:00-19:00
    - คาบ 11 เริ่มที่ 19:00-20:00

    แปลงข้อมูลทั้งหมดเป็น JSON array ตามโครงสร้างนี้เท่านั้น:
    [
      {
        "day_of_week": ตัวเลขวัน (0=จันทร์, 1=อังคาร, 2=พุธ, 3=พฤหัส, 4=ศุกร์, 5=เสาร์, 6=อาทิตย์),
        "start_period": ตัวเลขคาบเริ่มต้น (ดูจากตัวเลขคาบ 1, 2, 3... บนหัวตารางให้ตรงกับบล็อก, ถ้าเป็นกิจกรรมหน้าเสาธงให้ใส่ 0),
        "end_period": ตัวเลขคาบสิ้นสุดที่บล็อกนั้นลากไปถึง,
        "subject_code": "รหัสวิชา",
        "subject_name": "ชื่อรายวิชาเต็ม (ค้นเทียบเคียงจากรหัสวิชาด้านบน)",
        "room": "ห้องเรียนหรือสถานที่",
        "group_name": "กลุ่มเรียน (เฉพาะกลุ่มเรียน เช่น ชค.2/1)",
        "instructor": "ชื่อครูผู้สอน (ถอดวงเล็บออก)",
        "entry_type": "ประเภท (เช่น ถ้าชื่อวิชามีคำว่า ลูกเสือ หรือ กิจกรรม ให้ใส่ activity, นอกนั้นเป็น lecture)"
      }
    ]
    ห้ามมีคำอธิบายเพิ่มเติม ห้ามมี Markdown code block (\`\`\`json) ให้ตอบกลับมาเป็น JSON array ล้วนๆ ที่สามารถใช้ JSON.parse() ได้ทันที
  `;

  const imageParts = [
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: mimeType
      }
    }
  ];

  try {
    let result = null;
    let retries = 3;
    let delayMs = 1500;
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        result = await model.generateContent([prompt, ...imageParts]);
        break; // Success!
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini API call failed (Attempt ${attempt}/${retries}). Error: ${error.message || error}`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      }
    }

    if (!result) {
      throw new Error(`Google Gemini API ไม่ตอบสนอง (เนื่องจากมีผู้ใช้งานหนาแน่น 503) รายละเอียด: ${lastError?.message || lastError}`);
    }

    const responseText = result.response.text();
    const jsonStr = responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const data = JSON.parse(jsonStr);
    
    if (!Array.isArray(data)) {
      throw new Error("รูปแบบข้อมูลที่ AI ส่งกลับมาไม่ใช่ Array");
    }

    const entries = [];
    for (const item of data) {
      const startP = item.start_period !== undefined && item.start_period !== null ? parseInt(item.start_period) : 1;
      const endP = item.end_period !== undefined && item.end_period !== null ? parseInt(item.end_period) : startP;
      
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
        entryType: item.entry_type || 'lecture',
      });
    }
    
    return entries;
  } catch (error: any) {
    console.error("Gemini AI Parsing Error:", error);
    throw new Error('AI ไม่สามารถวิเคราะห์ตารางสอนจากรูปภาพนี้ได้: ' + (error.message || 'Unknown'));
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

    const mime = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let entries: any[] = [];

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

    if (formData.get('replace') === 'true') {
      await prisma.weeklySchedule.deleteMany({ where: { userId: user.id } });
    }

    const created = await prisma.weeklySchedule.createMany({ data: entries });

    return NextResponse.json({
      message: `นำเข้าตารางสอนสำเร็จ ${created.count} รายการ`,
      data: { count: created.count },
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Timetable upload error:', error);
    return NextResponse.json({ message: error.message || 'อัพโหลดไม่สำเร็จ' }, { status: 500 });
  }
}
