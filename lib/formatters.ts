import { Classroom, Attendance } from '@prisma/client';
import { resolveTargetWeeks, getCurrentWeek, getSemesterEndDate } from '@/lib/semester';

export interface FormattedClassroom {
  id: number;
  name: string;
  description: string | null;
  late_to_absent_ratio: number;
  leave_to_absent_ratio: number;
  absent_to_f_ratio: number;
  total_classes: number;
  min_attendance_percent: number;
  student_count?: number;
  assignment_weight: number;
  post_test_weight: number;
  affective_weight: number;
  midterm_weight: number;
  final_weight: number;
  midterm_max_score: number;
  final_max_score: number;
  curriculum_type: string;
  total_weeks: number;
  semester_start_date: string | null;
  semester_end_date: string | null;
  current_week: number | null;
  semester_id: number | null;
  semester_name: string | null;
}

/**
 * Format a Classroom database model into standard snake_case API response.
 * Correctly preserves 0 values for weights and scores.
 */
export function formatClassroomResponse(
  classroom: Classroom & {
    _count?: { students?: number };
    semester?: { id: number; name: string; termNumber: number; academicYear: string; startDate?: Date | null; totalWeeks?: number | null } | null;
  }
): FormattedClassroom {
  const semesterStart = classroom.semesterStartDate ?? classroom.semester?.startDate ?? null;
  const totalWeeks = resolveTargetWeeks(classroom);
  const currentWeek = semesterStart ? getCurrentWeek(semesterStart, totalWeeks) : null;
  const semesterEnd = semesterStart ? getSemesterEndDate(semesterStart, totalWeeks) : null;

  const result: FormattedClassroom = {
    id: classroom.id,
    name: classroom.name,
    description: classroom.description,
    late_to_absent_ratio: classroom.lateToAbsentRatio,
    leave_to_absent_ratio: classroom.leaveToAbsentRatio,
    absent_to_f_ratio: classroom.absentToFRatio,
    total_classes: classroom.totalClasses,
    min_attendance_percent: classroom.minAttendancePercent,
    assignment_weight:
      classroom.assignmentWeight !== null && classroom.assignmentWeight !== undefined
        ? Number(classroom.assignmentWeight)
        : 10,
    post_test_weight:
      classroom.postTestWeight !== null && classroom.postTestWeight !== undefined
        ? Number(classroom.postTestWeight)
        : 70,
    affective_weight:
      classroom.affectiveWeight !== null && classroom.affectiveWeight !== undefined
        ? Number(classroom.affectiveWeight)
        : 20,
    midterm_weight:
      classroom.midtermWeight !== null && classroom.midtermWeight !== undefined
        ? Number(classroom.midtermWeight)
        : 0,
    final_weight:
      classroom.finalWeight !== null && classroom.finalWeight !== undefined
        ? Number(classroom.finalWeight)
        : 0,
    midterm_max_score:
      classroom.midtermMaxScore !== null && classroom.midtermMaxScore !== undefined
        ? Number(classroom.midtermMaxScore)
        : 100,
    final_max_score:
      classroom.finalMaxScore !== null && classroom.finalMaxScore !== undefined
        ? Number(classroom.finalMaxScore)
        : 100,
    curriculum_type: classroom.curriculumType ?? 'pvch',
    total_weeks: totalWeeks,
    semester_start_date: semesterStart ? semesterStart.toISOString().split('T')[0] : null,
    semester_end_date: semesterEnd ? semesterEnd.toISOString().split('T')[0] : null,
    current_week: currentWeek,
    semester_id: classroom.semesterId ?? null,
    semester_name: classroom.semester?.name ?? null,
  };

  if (classroom._count?.students !== undefined) {
    result.student_count = classroom._count.students;
  }

  return result;
}

/**
 * Format an Attendance database record into standard snake_case API response.
 */
export function formatAttendanceRecord(record: Attendance) {
  return {
    id: record.id,
    student_id: record.studentId,
    classroom_id: record.classroomId,
    date: record.date,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

// ==================== Attendance Conversion Helpers ====================

export interface AttendanceConfig {
  lateToAbsentRatio: number;
  leaveToAbsentRatio: number;
  totalClasses: number;
  minAttendancePercent: number;
}

export interface AbsentConversionResult {
  convertedFromLate: number;
  convertedFromLeave: number;
  totalConverted: number;
  maxAllowedAbsences: number;
  isF: boolean;
  remaining: number;
  attendancePercent: number;
  remainingLate: number;
  remainingLeave: number;
}

/**
 * Extract normalized attendance config from a classroom record.
 * Provides safe defaults for null/undefined values.
 */
export function getAttendanceConfig(classroom: {
  lateToAbsentRatio?: number | null;
  leaveToAbsentRatio?: number | null;
  totalClasses?: number | null;
  minAttendancePercent?: number | null;
}): AttendanceConfig {
  return {
    lateToAbsentRatio: classroom.lateToAbsentRatio || 3,
    leaveToAbsentRatio: classroom.leaveToAbsentRatio || 2,
    totalClasses: classroom.totalClasses || 40,
    minAttendancePercent: classroom.minAttendancePercent || 80,
  };
}

/**
 * Core logic to convert late/leave counts into equivalent absent counts
 * and determine if a student has lost exam eligibility.
 *
 * Used by: grades report, dashboard at-risk, attendance stats.
 */
export function computeAbsentConversion(
  counts: { absent: number; late: number; leave: number },
  config: AttendanceConfig
): AbsentConversionResult {
  const maxAllowedAbsences = Math.floor(config.totalClasses * ((100 - config.minAttendancePercent) / 100));
  const convertedFromLate = Math.floor(counts.late / config.lateToAbsentRatio);
  const convertedFromLeave = Math.floor(counts.leave / config.leaveToAbsentRatio);
  const totalConverted = counts.absent + convertedFromLate + convertedFromLeave;
  const isF = totalConverted > maxAllowedAbsences;
  const remaining = maxAllowedAbsences - totalConverted;
  const attendancePercent = config.totalClasses > 0
    ? Math.max(0, Math.min(100, Math.round(((config.totalClasses - totalConverted) / config.totalClasses) * 100)))
    : 100;

  return {
    convertedFromLate, convertedFromLeave, totalConverted,
    maxAllowedAbsences, isF, remaining, attendancePercent,
    remainingLate: counts.late % config.lateToAbsentRatio,
    remainingLeave: counts.leave % config.leaveToAbsentRatio,
  };
}

// ==================== Response Formatters ====================

/**
 * Format a Student database record into standard snake_case API response.
 * Handles optional fields gracefully for both full and partial Prisma selects.
 */
export function formatStudentListItem(s: {
  id: number;
  name: string;
  studentCode?: string | null;
  gradeLevel?: string | null;
  email?: string | null;
  classroomId?: number | null;
  avatar?: string | null;
  midtermScore?: unknown;
  finalScore?: unknown;
  affectiveScore?: unknown;
}) {
  return {
    id: s.id,
    name: s.name,
    student_code: s.studentCode ?? null,
    grade_level: s.gradeLevel ?? null,
    email: s.email ?? null,
    classroom_id: s.classroomId ?? null,
    avatar: s.avatar ?? null,
    midterm_score: s.midtermScore != null ? Number(s.midtermScore) : null,
    final_score: s.finalScore != null ? Number(s.finalScore) : null,
    affective_score: s.affectiveScore != null ? Number(s.affectiveScore) : null,
  };
}

/**
 * Format a StudentScore database record into standard snake_case API response.
 */
export function formatScoreResponse(s: {
  id: number;
  studentId: number;
  classroomId: number;
  lessonNumber: number;
  assignmentScore?: unknown;
  postTestScore?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: s.id,
    student_id: s.studentId,
    classroom_id: s.classroomId,
    lesson_number: s.lessonNumber,
    assignment_score: s.assignmentScore != null ? Number(s.assignmentScore) : null,
    post_test_score: s.postTestScore != null ? Number(s.postTestScore) : null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

/**
 * Format a ScoreStructure database record into standard snake_case API response.
 */
export function formatScoreStructureResponse(s: {
  id: number;
  classroomId: number;
  lessonNumber: number;
  lessonName?: string | null;
  maxAssignmentScore?: unknown;
  maxPostTestScore?: unknown;
  hours?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: s.id,
    classroom_id: s.classroomId,
    lesson_number: s.lessonNumber,
    lesson_name: s.lessonName ?? null,
    max_assignment_score: s.maxAssignmentScore ?? null,
    max_post_test_score: s.maxPostTestScore ?? null,
    hours: s.hours ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

// ==================== Attendance Stats ====================

export interface AttendanceStudentStats {
  student_id: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  converted_absent_count: number;
  remaining_late_count: number;
  remaining_leave_count: number;
  is_f: boolean;
  max_allowed_absences: number;
  total_classes: number;
  converted_from_late: number;
  converted_from_leave: number;
}

/**
 * Calculate attendance statistics grouped by student for a given classroom.
 */
export function calculateAttendanceStats(
  records: Attendance[],
  classroom: {
    lateToAbsentRatio?: number | null;
    leaveToAbsentRatio?: number | null;
    totalClasses?: number | null;
    minAttendancePercent?: number | null;
  }
): AttendanceStudentStats[] {
  const config = getAttendanceConfig(classroom);
  const studentMap = new Map<number, { present: number; late: number; absent: number; leave: number }>();
  for (const r of records) {
    if (!studentMap.has(r.studentId)) {
      studentMap.set(r.studentId, { present: 0, late: 0, absent: 0, leave: 0 });
    }
    const s = studentMap.get(r.studentId)!;
    if (r.status === 'present') s.present++;
    else if (r.status === 'late') s.late++;
    else if (r.status === 'absent') s.absent++;
    else if (r.status === 'leave') s.leave++;
  }

  return Array.from(studentMap.entries()).map(([studentId, s]) => {
    const conv = computeAbsentConversion(s, config);
    return {
      student_id: studentId,
      present_count: s.present, late_count: s.late,
      absent_count: s.absent, leave_count: s.leave,
      converted_absent_count: conv.totalConverted,
      remaining_late_count: conv.remainingLate,
      remaining_leave_count: conv.remainingLeave,
      is_f: conv.isF,
      max_allowed_absences: conv.maxAllowedAbsences,
      total_classes: config.totalClasses,
      converted_from_late: conv.convertedFromLate,
      converted_from_leave: conv.convertedFromLeave,
    };
  });
}

/**
 * Calculate attendance statistics grouped by student (optimized for DB groupBy).
 */
export function calculateAttendanceStatsFromGrouped(
  grouped: Array<{ studentId: number; status: string; _count: number }>,
  classroom: {
    lateToAbsentRatio?: number | null;
    leaveToAbsentRatio?: number | null;
    totalClasses?: number | null;
    minAttendancePercent?: number | null;
  }
): AttendanceStudentStats[] {
  const config = getAttendanceConfig(classroom);
  const studentMap = new Map<number, { present: number; late: number; absent: number; leave: number }>();
  for (const r of grouped) {
    if (!studentMap.has(r.studentId)) {
      studentMap.set(r.studentId, { present: 0, late: 0, absent: 0, leave: 0 });
    }
    const s = studentMap.get(r.studentId)!;
    if (r.status === 'present') s.present += r._count;
    else if (r.status === 'late') s.late += r._count;
    else if (r.status === 'absent') s.absent += r._count;
    else if (r.status === 'leave') s.leave += r._count;
  }

  return Array.from(studentMap.entries()).map(([studentId, s]) => {
    const conv = computeAbsentConversion(s, config);
    return {
      student_id: studentId,
      present_count: s.present, late_count: s.late,
      absent_count: s.absent, leave_count: s.leave,
      converted_absent_count: conv.totalConverted,
      remaining_late_count: conv.remainingLate,
      remaining_leave_count: conv.remainingLeave,
      is_f: conv.isF,
      max_allowed_absences: conv.maxAllowedAbsences,
      total_classes: config.totalClasses,
      converted_from_late: conv.convertedFromLate,
      converted_from_leave: conv.convertedFromLeave,
    };
  });
}
