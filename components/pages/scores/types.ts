export interface Classroom {
  id: string | number;
  name: string;
  student_count?: number;
  description?: string;
  total_classes?: number;
  assignment_weight?: number;
  post_test_weight?: number;
  affective_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
  total_weeks?: number;
  curriculum_type?: 'pvch' | 'pvs' | 'custom' | string;
  semester_start_date?: string | null;
}

export interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  classroom_id?: string | number;
  grade_level?: string | null;
  branch?: string | null;
  midterm_score?: number | null;
  final_score?: number | null;
  affective_score?: number | null;
}

export interface ScoreStructure {
  lesson_number: number;
  lesson_name: string;
  max_assignment_score: number;
  max_post_test_score: number;
  hours: number;
}

export interface ScoreValue {
  assignment_score: number | string;
  post_test_score: number | string;
}

export interface ScoresMap {
  [studentId: string]: ScoreValue;
}

export interface FullMatrixScoresMap {
  [key: string]: {
    assignment_score: number | string;
    post_test_score: number | string;
  };
}

export interface AnalyticsSummary {
  avgScore: number;
  completionRate: number;
  highestScore: number;
  lowestScore: number;
  totalMaxScore: number;
}

export interface WeeklyAttendanceCounts {
  absent: number;
  leave: number;
  present: number;
  late: number;
  noData: number;
  total: number;
}

export function parseSafeDateStr(rawDate: unknown): string {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    const clean = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  try {
    const d = new Date(rawDate as string | number | Date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export function formatThaiFullDateHeader(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dayName = THAI_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = THAI_SHORT_MONTHS[d.getMonth()];
  return {
    dayName,
    label: `${dayName} ${dayNum} ${monthName}`,
    shortLabel: `${dayNum} ${monthName}`,
  };
}

