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
  const ratioLate = classroom.lateToAbsentRatio || 3;
  const ratioLeave = classroom.leaveToAbsentRatio || 2;
  const totalClasses = classroom.totalClasses || 40;
  const minAttPercent = classroom.minAttendancePercent || 80;
  const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

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
    const convertedFromLate = Math.floor(s.late / ratioLate);
    const convertedFromLeave = Math.floor(s.leave / ratioLeave);
    const totalConverted = s.absent + convertedFromLate + convertedFromLeave;
    return {
      student_id: studentId,
      present_count: s.present,
      late_count: s.late,
      absent_count: s.absent,
      leave_count: s.leave,
      converted_absent_count: totalConverted,
      remaining_late_count: s.late % ratioLate,
      remaining_leave_count: s.leave % ratioLeave,
      is_f: totalConverted > maxAllowedAbsences,
      max_allowed_absences: maxAllowedAbsences,
      total_classes: totalClasses,
      converted_from_late: convertedFromLate,
      converted_from_leave: convertedFromLeave,
    };
  });
}

/**
 * Calculate attendance statistics grouped by student for a given classroom (optimized for DB groupBy).
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
  const ratioLate = classroom.lateToAbsentRatio || 3;
  const ratioLeave = classroom.leaveToAbsentRatio || 2;
  const totalClasses = classroom.totalClasses || 40;
  const minAttPercent = classroom.minAttendancePercent || 80;
  const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

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
    const convertedFromLate = Math.floor(s.late / ratioLate);
    const convertedFromLeave = Math.floor(s.leave / ratioLeave);
    const totalConverted = s.absent + convertedFromLate + convertedFromLeave;
    return {
      student_id: studentId,
      present_count: s.present,
      late_count: s.late,
      absent_count: s.absent,
      leave_count: s.leave,
      converted_absent_count: totalConverted,
      remaining_late_count: s.late % ratioLate,
      remaining_leave_count: s.leave % ratioLeave,
      is_f: totalConverted > maxAllowedAbsences,
      max_allowed_absences: maxAllowedAbsences,
      total_classes: totalClasses,
      converted_from_late: convertedFromLate,
      converted_from_leave: convertedFromLeave,
    };
  });
}

