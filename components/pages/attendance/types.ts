import { HolidayInfo } from '@/lib/thaiHolidays';
import { StudentSectionGroup } from '@/lib/studentSections';
import { parseClassroomName, ParsedClassroomName } from '@/lib/classroom';

export { parseClassroomName };
export type { ParsedClassroomName, HolidayInfo, StudentSectionGroup };

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const getSchemaDayOfWeek = (dateStr: string): number => {
  const jsDay = new Date(dateStr).getDay();
  return (jsDay + 6) % 7; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
};

export interface TimetableEntry {
  id: number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  subject_name?: string;
  subject_code?: string;
  room?: string;
  group_name?: string;
  classroom_id?: number;
  hours: number;
  entry_type: string;
}

export interface Classroom {
  id: string;
  name: string;
  total_classes?: number;
  min_attendance_percent?: number;
  late_to_absent_ratio?: number;
  leave_to_absent_ratio?: number;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
  semester_start_date?: string | null;
  semester_end_date?: string | null;
  current_week?: number | null;
  student_count?: number;
}

export interface SemesterWeek {
  week: number;
  start: string;
  end: string;
  isCurrent: boolean;
}

export interface SemesterInfo {
  classroomId: number;
  curriculumType: 'pvch' | 'pvs' | 'custom';
  totalWeeks: number;
  semesterStartDate: string | null;
  semesterEndDate: string | null;
  currentWeek: number | null;
  isSemesterActive: boolean;
  weeks: SemesterWeek[];
}

export interface Student {
  id: string;
  student_code?: string;
  name: string;
  classroom_id: string;
  email?: string;
  grade_level?: string | null;
  branch?: string | null;
  avatar?: string | null;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
}

export interface StudentStats {
  student_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  converted_absent_count: number;
  remaining_late_count: number;
  remaining_leave_count: number;
  is_f?: boolean;
}

export interface DailyStats {
  present: number;
  late: number;
  absent: number;
  leave: number;
  marked: number;
  total: number;
}

export interface SectionDailyStats {
  present: number;
  late: number;
  absent: number;
  leave: number;
  marked: number;
  total: number;
}

export type AttendanceStatusType = 'present' | 'late' | 'absent' | 'leave';

export type ClassFilter = 'all' | 'today' | 'pvch' | 'pvs';

export type ActiveTab = 'daily' | 'matrix';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type RetroactiveTab = 'weeks' | 'calendar';
