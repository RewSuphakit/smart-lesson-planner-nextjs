export interface Classroom {
  id: string;
  name: string;
  student_count?: number;
  total_classes?: number;
  total_weeks?: number;
  curriculum_type?: string;
  assignment_weight?: number;
  post_test_weight?: number;
  affective_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
}

export interface Criterion {
  grade: string;
  min_score: number;
}

export interface ReportStudent {
  id?: string | number;
  student_id: string;
  student_code?: string;
  grade_level?: string | null;
  branch?: string | null;
  name: string;
  avatar?: string | null;
  raw_assign?: number;
  max_assign?: number;
  scaled_assign?: number;
  precise_scaled_assign?: number;
  raw_post_test?: number;
  max_post_test?: number;
  scaled_post_test?: number;
  precise_scaled_post_test?: number;
  midterm_score?: number | string;
  scaled_midterm?: number;
  precise_scaled_midterm?: number;
  final_score?: number | string | null;
  exam_status?: 'normal' | 'absent_final' | 'incomplete';
  is_absent_final?: boolean;
  is_incomplete?: boolean;
  scaled_final?: number;
  precise_scaled_final?: number;
  affective_score?: number | string;
  is_f?: boolean;
  total_score_precise?: number;
  total_score?: number | string;
  percentage?: string;
  attendance_percent?: number;
  grade?: string;
  absent_count?: number;
  late_count?: number;
  max_allowed_absences?: number;
  remaining_absences?: number;
}

export interface Weights {
  assignment_weight: number;
  post_test_weight: number;
  affective_weight: number;
  midterm_weight: number;
  final_weight: number;
  midterm_max_score: number;
  final_max_score: number;
  target_weeks?: number;
  is_pws?: boolean;
  max_assign_raw?: number;
  max_post_test_raw?: number;
}

export const EMPTY_CLASSROOMS: Classroom[] = [];

export const DEFAULT_CRITERIA: Criterion[] = [
  { grade: '4', min_score: 80 },
  { grade: '3.5', min_score: 75 },
  { grade: '3', min_score: 70 },
  { grade: '2.5', min_score: 65 },
  { grade: '2', min_score: 60 },
  { grade: '1.5', min_score: 55 },
  { grade: '1', min_score: 50 },
  { grade: '0', min_score: 0 },
];

export const DEFAULT_WEIGHTS: Weights = {
  assignment_weight: 10,
  post_test_weight: 70,
  affective_weight: 20,
  midterm_weight: 0,
  final_weight: 0,
  midterm_max_score: 100,
  final_max_score: 100,
};

export function getGradeStyle(grade?: string): string {
  if (grade === 'ข.ร.' || grade === 'ขร' || grade === 'F') {
    return 'bg-rose-600 text-white shadow-sm shadow-rose-500/20';
  }
  if (grade === 'ข.ส.') {
    return 'bg-amber-500 text-white shadow-sm shadow-amber-500/20';
  }
  if (grade === 'ม.ส.') {
    return 'bg-purple-600 text-white shadow-sm shadow-purple-500/20';
  }
  if (grade === '4' || grade === '3.5' || grade === '3' || grade === 'A') {
    return 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20';
  }
  if (grade === '2.5' || grade === '2' || grade === '1.5' || grade === '1' || grade === 'B' || grade === 'C') {
    return 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20';
  }
  if (grade === '0' || grade === 'D') {
    return 'bg-rose-500 text-white shadow-sm shadow-rose-500/20';
  }
  return 'bg-slate-100 text-slate-700';
}

