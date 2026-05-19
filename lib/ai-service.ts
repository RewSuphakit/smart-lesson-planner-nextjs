import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

interface LessonPlanResult {
  title: string;
  subject: string;
  grade_level: string;
  duration: number;
  objectives: string[];
  content: {
    introduction: string;
    teaching: string;
    practice: string;
    summary: string;
  };
  teaching_methods: string[];
  materials: string[];
  activities: Array<{
    phase: string;
    duration: string;
    description: string;
  }>;
  _demo?: boolean;
}

export async function generateLessonPlan(prompt: string): Promise<LessonPlanResult> {
  const systemPrompt = `You are an expert educational curriculum designer. Given a teaching request, generate a structured lesson plan in JSON format. Be concise and practical.

Return ONLY valid JSON with this exact structure:
{
  "title": "Lesson title",
  "subject": "Subject name",
  "grade_level": "Target grade/level",
  "duration": <duration in minutes as number>,
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "content": {
    "introduction": "Brief intro activity (5-10 min)",
    "teaching": "Main teaching content and methods",
    "practice": "Student practice activities",
    "summary": "Wrap-up and assessment"
  },
  "teaching_methods": ["method1", "method2"],
  "materials": ["material1", "material2"],
  "activities": [
    {"phase": "Introduction", "duration": "X min", "description": "..."},
    {"phase": "Teaching", "duration": "X min", "description": "..."},
    {"phase": "Practice", "duration": "X min", "description": "..."},
    {"phase": "Summary", "duration": "X min", "description": "..."}
  ]
}`;

  try {
    if (!genAI) {
      throw new Error('Gemini API key is missing');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('AI generation successful with Gemini');
    return JSON.parse(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini API error:', message);
    console.log('⚡ Falling back to Demo Mode — generating sample lesson plan');
    return generateDemoLessonPlan(prompt);
  }
}

function generateDemoLessonPlan(prompt: string): LessonPlanResult {
  const lower = prompt.toLowerCase();

  let duration = 60;
  const durationMatch = prompt.match(/(\d+)\s*(นาที|ชั่วโมง|min|hour)/i);
  if (durationMatch) {
    duration = parseInt(durationMatch[1]);
    if (durationMatch[2].match(/ชั่วโมง|hour/i)) duration *= 60;
  }

  let gradeLevel = 'มัธยมศึกษา';
  if (lower.match(/ปวช|ปวส|vocational|อาชีวะ/)) gradeLevel = 'ปวช.';
  else if (lower.match(/ม\.?\s*(\d)/)) gradeLevel = `ม.${lower.match(/ม\.?\s*(\d)/)![1]}`;
  else if (lower.match(/ป\.?\s*(\d)/)) gradeLevel = `ป.${lower.match(/ป\.?\s*(\d)/)![1]}`;
  else if (lower.match(/มหาวิทยาลัย|university/)) gradeLevel = 'มหาวิทยาลัย';

  let subject = 'วิทยาศาสตร์และเทคโนโลยี';
  let title = 'แผนการสอน';
  let objectives: string[] = [];
  let contentIntro = '';
  let contentTeaching = '';
  let contentPractice = '';
  let contentSummary = '';
  let methods: string[] = [];
  let materials: string[] = [];

  if (lower.match(/sensor|เซ็นเซอร์|เซนเซอร์|ตัวรับรู้/)) {
    subject = 'วิทยาศาสตร์และเทคโนโลยี';
    title = 'เซ็นเซอร์และทรานสดิวเซอร์';
    objectives = [
      'นักเรียนสามารถอธิบายหลักการทำงานของเซ็นเซอร์ประเภทต่างๆ ได้',
      'นักเรียนสามารถเลือกใช้เซ็นเซอร์ให้เหมาะสมกับงานได้',
      'นักเรียนสามารถต่อวงจรเซ็นเซอร์อย่างง่ายได้',
    ];
    contentIntro = 'เปิดวิดีโอแสดงการใช้เซ็นเซอร์ในชีวิตประจำวัน';
    contentTeaching = 'อธิบายประเภทของเซ็นเซอร์: LM35, LDR, Ultrasonic, PIR';
    contentPractice = 'แบ่งกลุ่มนักเรียนทดลองต่อวงจรเซ็นเซอร์กับ Arduino';
    contentSummary = 'สรุปประเภทเซ็นเซอร์ ทำแบบทดสอบ 10 ข้อ';
    methods = ['การบรรยายประกอบสื่อ', 'การสาธิตของจริง', 'การทดลองปฏิบัติ'];
    materials = ['สไลด์นำเสนอ', 'ชุดเซ็นเซอร์', 'Arduino Uno', 'ใบงาน'];
  } else if (lower.match(/คณิต|math|สมการ|equation/)) {
    subject = 'คณิตศาสตร์';
    title = 'สมการเชิงเส้นตัวแปรเดียว';
    objectives = [
      'นักเรียนสามารถแก้สมการเชิงเส้นตัวแปรเดียวได้',
      'นักเรียนสามารถตรวจคำตอบของสมการได้',
      'นักเรียนสามารถนำสมการเชิงเส้นไปแก้ปัญหาในชีวิตจริงได้',
    ];
    contentIntro = 'ยกตัวอย่างปัญหาในชีวิตจริงแล้วเขียนเป็นสมการ';
    contentTeaching = 'สอนหลักการแก้สมการโดยใช้สมบัติการเท่ากัน';
    contentPractice = 'ให้นักเรียนทำแบบฝึกหัด 10 ข้อ';
    contentSummary = 'สรุปขั้นตอนการแก้สมการ ทำแบบทดสอบ';
    methods = ['การบรรยายประกอบตัวอย่าง', 'การฝึกปฏิบัติ', 'การเรียนรู้แบบจับคู่'];
    materials = ['สไลด์นำเสนอ', 'ใบงาน', 'แบบฝึกหัด', 'แบบทดสอบ'];
  } else {
    const topicFromPrompt = prompt.replace(/สอน|เรื่อง|สำหรับ|นักเรียน|ระยะเวลา|ชั่วโมง|นาที/g, '').trim() || 'หัวข้อการเรียนรู้';
    title = topicFromPrompt.slice(0, 50);
    objectives = [
      `นักเรียนสามารถอธิบายความหมายของ${title}ได้`,
      `นักเรียนสามารถวิเคราะห์องค์ประกอบของ${title}ได้`,
      `นักเรียนสามารถประยุกต์ใช้ความรู้เรื่อง${title}ได้`,
    ];
    contentIntro = `เปิดวิดีโอที่เกี่ยวข้องกับ${title} กระตุ้นความสนใจ`;
    contentTeaching = `อธิบายเนื้อหาหลักเรื่อง${title} พร้อมยกตัวอย่าง`;
    contentPractice = `แบ่งกลุ่มนักเรียนทำกิจกรรมเกี่ยวกับ${title}`;
    contentSummary = 'สรุปประเด็นสำคัญ ทำแบบทดสอบ';
    methods = ['การบรรยายประกอบสื่อ', 'การอภิปรายกลุ่ม', 'กิจกรรมปฏิบัติ'];
    materials = ['สไลด์นำเสนอ', 'ใบงาน', 'สื่อวิดีโอ', 'แบบทดสอบ'];
  }

  const introTime = Math.round(duration * 0.15);
  const teachTime = Math.round(duration * 0.35);
  const practiceTime = Math.round(duration * 0.35);
  const summaryTime = duration - introTime - teachTime - practiceTime;

  return {
    title,
    subject,
    grade_level: gradeLevel,
    duration,
    objectives,
    content: {
      introduction: contentIntro,
      teaching: contentTeaching,
      practice: contentPractice,
      summary: contentSummary,
    },
    teaching_methods: methods,
    materials,
    activities: [
      { phase: 'ขั้นนำเข้าสู่บทเรียน', duration: `${introTime} นาที`, description: contentIntro },
      { phase: 'ขั้นสอน', duration: `${teachTime} นาที`, description: contentTeaching },
      { phase: 'ขั้นฝึกปฏิบัติ', duration: `${practiceTime} นาที`, description: contentPractice },
      { phase: 'ขั้นสรุป', duration: `${summaryTime} นาที`, description: contentSummary },
    ],
    _demo: true,
  };
}
