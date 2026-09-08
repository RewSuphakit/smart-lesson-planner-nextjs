/**
 * Semester calculation utilities
 * 
 * Centralizes all semester/week logic that was previously guessed
 * from classroom names containing "ปวช" or "ปวส".
 */

// Re-export the enum type for convenience (matches Prisma enum)
export type CurriculumType = 'pvch' | 'pvs' | 'custom';

export interface WeekRange {
  week: number;
  start: string; // ISO date string (YYYY-MM-DD)
  end: string;   // ISO date string (YYYY-MM-DD)
  isCurrent: boolean;
}

export interface SemesterInfo {
  classroomId: number;
  curriculumType: CurriculumType;
  totalWeeks: number;
  semesterStartDate: string | null;
  semesterEndDate: string | null;
  currentWeek: number | null;
  isSemesterActive: boolean;
  weeks: WeekRange[];
}

export interface ClassroomSemesterFields {
  curriculumType: string;
  totalWeeks: number;
  semesterStartDate: Date | null;
}

/**
 * Returns the default number of weeks for a curriculum type.
 */
export function getDefaultWeeks(type: CurriculumType): number {
  switch (type) {
    case 'pvch': return 18;
    case 'pvs': return 15;
    case 'custom': return 18; // fallback default
  }
}

/**
 * Calculates the semester end date from start date + total weeks.
 * End date is the last day of the last week (start + totalWeeks*7 - 1 day).
 */
export function getSemesterEndDate(startDate: Date, totalWeeks: number): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + (totalWeeks * 7) - 1);
  return end;
}

/**
 * Calculates the current week number (1-based).
 * Returns null if semester hasn't started yet or has already ended.
 */
export function getCurrentWeek(startDate: Date, totalWeeks: number): number | null {
  const now = new Date();
  // Use Thai timezone (UTC+7)
  const thaiOffsetMs = 7 * 60 * 60 * 1000;
  const nowThai = new Date(now.getTime() + thaiOffsetMs);
  const todayStr = nowThai.toISOString().split('T')[0];
  const today = new Date(todayStr);

  const startStr = startDate.toISOString().split('T')[0];
  const start = new Date(startStr);

  const diffMs = today.getTime() - start.getTime();
  if (diffMs < 0) return null; // Haven't started yet

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;

  if (weekNumber > totalWeeks) return null; // Semester ended
  return weekNumber;
}

/**
 * Generates date ranges for each week of the semester.
 */
export function getWeekDateRanges(startDate: Date, totalWeeks: number): WeekRange[] {
  const currentWeek = getCurrentWeek(startDate, totalWeeks);
  const weeks: WeekRange[] = [];

  const startStr = startDate.toISOString().split('T')[0];
  const baseDate = new Date(startStr);

  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() + (i * 7));

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    weeks.push({
      week: i + 1,
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
      isCurrent: currentWeek === i + 1,
    });
  }

  return weeks;
}

/**
 * Resolves the target weeks for a classroom.
 * This replaces the old logic that guessed from classroom name.
 * 
 * Priority:
 * 1. Use classroom.totalWeeks directly (set by user)
 * 2. Fall back to curriculum type default
 */
export function resolveTargetWeeks(classroom: ClassroomSemesterFields): number {
  // totalWeeks is explicitly set by the user (or defaulted during creation)
  return classroom.totalWeeks || getDefaultWeeks(classroom.curriculumType as CurriculumType);
}

/**
 * Builds the full semester info object for API responses.
 */
export function buildSemesterInfo(classroomId: number, classroom: ClassroomSemesterFields): SemesterInfo {
  const curriculumType = classroom.curriculumType as CurriculumType;
  const totalWeeks = resolveTargetWeeks(classroom);

  if (!classroom.semesterStartDate) {
    return {
      classroomId,
      curriculumType,
      totalWeeks,
      semesterStartDate: null,
      semesterEndDate: null,
      currentWeek: null,
      isSemesterActive: false,
      weeks: [],
    };
  }

  const startDate = classroom.semesterStartDate;
  const endDate = getSemesterEndDate(startDate, totalWeeks);
  const currentWeek = getCurrentWeek(startDate, totalWeeks);
  const weeks = getWeekDateRanges(startDate, totalWeeks);

  return {
    classroomId,
    curriculumType,
    totalWeeks,
    semesterStartDate: startDate.toISOString().split('T')[0],
    semesterEndDate: endDate.toISOString().split('T')[0],
    currentWeek,
    isSemesterActive: currentWeek !== null,
    weeks,
  };
}
