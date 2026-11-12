export const TIMETABLE_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  0: { start: '07:30', end: '08:00' },
  1: { start: '08:00', end: '09:00' },
  2: { start: '09:00', end: '10:00' },
  3: { start: '10:00', end: '11:00' },
  4: { start: '11:00', end: '12:00' },
  5: { start: '13:00', end: '14:00' },
  6: { start: '14:00', end: '15:00' },
  7: { start: '15:00', end: '16:00' },
  8: { start: '16:00', end: '17:00' },
  9: { start: '17:00', end: '18:00' },
  10: { start: '18:00', end: '19:00' },
  11: { start: '19:00', end: '20:00' },
  12: { start: '20:00', end: '21:00' },
};

export const TIME_SLOTS = [
  { id: 0, label: 'กิจกรรม', start: '07:30', end: '08:00', isBreak: false },
  { id: 1, label: '1', start: '08:00', end: '09:00', isBreak: false },
  { id: 2, label: '2', start: '09:00', end: '10:00', isBreak: false },
  { id: 3, label: '3', start: '10:00', end: '11:00', isBreak: false },
  { id: 4, label: '4', start: '11:00', end: '12:00', isBreak: false },
  { id: 'lunch', label: 'พักกลางวัน', start: '12:00', end: '13:00', isBreak: true },
  { id: 5, label: '5', start: '13:00', end: '14:00', isBreak: false },
  { id: 6, label: '6', start: '14:00', end: '15:00', isBreak: false },
  { id: 7, label: '7', start: '15:00', end: '16:00', isBreak: false },
  { id: 8, label: '8', start: '16:00', end: '17:00', isBreak: false },
  { id: 9, label: '9', start: '17:00', end: '18:00', isBreak: false },
  { id: 10, label: '10', start: '18:00', end: '19:00', isBreak: false },
  { id: 11, label: '11', start: '19:00', end: '20:00', isBreak: false },
  { id: 12, label: '12', start: '20:00', end: '21:00', isBreak: false },
] as const;

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export interface TimetableEntry {
  id: string | number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  subject_code: string;
  subject_name?: string;
  room?: string;
  group_name?: string;
  entry_type: 'lecture' | 'lab' | 'activity' | 'homeroom' | 'theory' | string;
  hours?: number;
  classroom_id?: number | null;
  instructor?: string;
  start_time?: string;
  end_time?: string;
  color?: string | null;
}

export interface TimetableSummaryItem {
  subject_code: string;
  subject_name: string;
  total_hours: number;
}

export interface HoverTooltip {
  entry: TimetableEntry;
  rect: DOMRect;
}

export interface TimetableFormState {
  day_of_week: number;
  start_period: number;
  end_period: number;
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name: string;
  room: string;
  group_name: string;
  instructor: string;
  entry_type: string;
  color: string;
  classroom_id: string | number;
}

