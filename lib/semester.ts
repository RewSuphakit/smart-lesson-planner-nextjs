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
  curriculumType?: string | null;
  totalWeeks?: number | null;
  semesterStartDate?: Date | null;
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
 * Calculates the week number (1-based) for any given target date.
 * Returns null if before semester start or after totalWeeks.
 */
export function getWeekNumberForDate(targetDate: Date, startDate: Date, totalWeeks: number): number | null {
  const targetStr = targetDate.toISOString().split('T')[0];
  const target = new Date(targetStr);

  const startStr = startDate.toISOString().split('T')[0];
  const start = new Date(startStr);

  const diffMs = target.getTime() - start.getTime();
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
  return classroom.totalWeeks || getDefaultWeeks(((classroom.curriculumType || 'pvch') as CurriculumType));
}

/**
 * Builds the full semester info object for API responses.
 */
export function buildSemesterInfo(classroomId: number, classroom: ClassroomSemesterFields): SemesterInfo {
  const curriculumType = ((classroom.curriculumType || 'pvch') as CurriculumType);
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

/**
 * Checks whether a classroom's regular teaching schedule is still active as of a given date.
 * In Thai vocational curriculum (สอศ.):
 * - Regular teaching runs in weeks 1 to totalWeeks - 1.
 * - The final week (week 18 for pvch, week 15 for pvs) is final examination week.
 * - Once currentWeek is null or today is past semesterEndDate, teaching is ended.
 */
export function isClassroomTeachingActive(classroom: ClassroomSemesterFields, asOfDate?: Date): boolean {
  if (!classroom.semesterStartDate) return true;
  const totalWeeks = resolveTargetWeeks(classroom);
  const currentWeek = getCurrentWeek(classroom.semesterStartDate, totalWeeks);

  if (currentWeek === null) return false;
  if (currentWeek >= totalWeeks) return false; // Final exam / evaluation week

  const end = getSemesterEndDate(classroom.semesterStartDate, totalWeeks);
  const today = asOfDate || new Date();
  if (today > end) return false;

  return true;
}

/**
 * Checks whether a classroom's semester has completed / ended.
 */
export function isClassroomSemesterEnded(classroom: ClassroomSemesterFields, asOfDate?: Date): boolean {
  if (!classroom.semesterStartDate) return false;
  const totalWeeks = resolveTargetWeeks(classroom);
  const currentWeek = getCurrentWeek(classroom.semesterStartDate, totalWeeks);
  const end = getSemesterEndDate(classroom.semesterStartDate, totalWeeks);
  const today = asOfDate || new Date();

  // If today is past end date, or currentWeek is null, or in final exam week (currentWeek >= totalWeeks)
  return today > end || currentWeek === null || currentWeek >= totalWeeks;
}

// ==================== Semester Model Helpers ====================

import prisma from '@/lib/prisma';

export interface SemesterRecord {
  id: number;
  userId: number;
  name: string;
  termNumber: number;
  academicYear: string;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  curriculumType: string;
  totalWeeks: number;
}

/**
 * Retrieves the active semester for a user.
 * Returns null if no active semester is set.
 */
export async function getActiveSemester(userId: number): Promise<SemesterRecord | null> {
  const semester = await prisma.semester.findFirst({
    where: { userId, isActive: true },
  });
  return semester;
}

/**
 * Lightweight helper that returns only the active semester ID.
 * Returns null if no active semester is set.
 */
export async function getActiveSemesterId(userId: number): Promise<number | null> {
  const semester = await prisma.semester.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  return semester?.id ?? null;
}

/**
 * Builds semester info from a Semester model record.
 * Uses Semester.startDate and Semester.totalWeeks for week calculations.
 */
export function buildSemesterInfoFromSemester(semester: SemesterRecord): SemesterInfo & { termNumber: number; academicYear: string; isActive: boolean } {
  const curriculumType = (semester.curriculumType || 'pvch') as CurriculumType;
  const totalWeeks = semester.totalWeeks || getDefaultWeeks(curriculumType);

  if (!semester.startDate) {
    return {
      classroomId: 0, // Not classroom-specific
      curriculumType,
      totalWeeks,
      semesterStartDate: null,
      semesterEndDate: semester.endDate ? semester.endDate.toISOString().split('T')[0] : null,
      currentWeek: null,
      isSemesterActive: semester.isActive,
      weeks: [],
      termNumber: semester.termNumber,
      academicYear: semester.academicYear,
      isActive: semester.isActive,
    };
  }

  const startDate = semester.startDate;
  const endDate = semester.endDate || getSemesterEndDate(startDate, totalWeeks);
  const currentWeek = getCurrentWeek(startDate, totalWeeks);
  const weeks = getWeekDateRanges(startDate, totalWeeks);

  return {
    classroomId: 0,
    curriculumType,
    totalWeeks,
    semesterStartDate: startDate.toISOString().split('T')[0],
    semesterEndDate: endDate.toISOString().split('T')[0],
    currentWeek,
    isSemesterActive: currentWeek !== null,
    weeks,
    termNumber: semester.termNumber,
    academicYear: semester.academicYear,
    isActive: semester.isActive,
  };
}

