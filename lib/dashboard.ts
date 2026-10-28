/**
 * Dashboard Service Layer
 *
 * Encapsulates data fetching and business calculations for the teacher dashboard:
 * - Classroom and student aggregations
 * - Semester active / ended state computation
 * - At-risk student identification (attendance below threshold)
 * - Today's schedule and pending tasks (unchecked attendance)
 * - Today's overall attendance rate
 */

import prisma, { withDbRetry } from '@/lib/prisma';
import { PERIOD_TIMES } from '@/lib/constants';
import {
  isClassroomTeachingActive,
  isClassroomSemesterEnded,
  resolveTargetWeeks,
  getSemesterEndDate,
  getActiveSemester,
} from '@/lib/semester';
import { getAttendanceConfig, computeAbsentConversion } from '@/lib/formatters';

// ==================== Interfaces ====================

export interface AtRiskStudent {
  student_id: number;
  student_name: string;
  student_code: string | null;
  classroom_name: string;
  reason: string;
  type: 'attendance_f' | 'attendance_warning';
  absent_count?: number;
  max_allowed?: number;
  remaining?: number;
  avatar?: string | null;
}

export interface PendingTask {
  type: string;
  classroom_name: string;
  message: string;
  link: string;
}

export interface TodayScheduleItem {
  id: number;
  subject_code: string;
  subject_name: string;
  room: string;
  group_name: string;
  start_period: number;
  end_period: number;
  start_time: string;
  end_time: string;
  hours: number;
  entry_type: string;
  color: string;
  classroom_id: number | null;
  classroom_name: string | null;
  is_attendance_checked: boolean;
}

export interface TodayStats {
  totalClasses: number;
  checkedClasses: number;
  totalWeeklyHours: number;
  todayAttendanceRate: number | null;
  isSemesterEnded: boolean;
}

export interface DashboardData {
  totalClassrooms: number;
  totalStudents: number;
  upcomingSchedules: Array<{
    scheduled_date: string;
    start_time: string;
    end_time: string;
    status: string;
    lesson_title: string;
    subject: string;
  }>;
  atRiskStudents: AtRiskStudent[];
  pendingTasks: PendingTask[];
  todaySchedule: TodayScheduleItem[];
  todayStats: TodayStats;
  isSemesterEnded: boolean;
  activeSemester: {
    id: number;
    name: string;
    term_number: number;
    academic_year: string;
    is_active: boolean;
  } | null;
}

// ==================== Helper Functions ====================

export function isFlagpoleOrHomeroom(ws: {
  startPeriod?: number;
  entryType?: string;
  subjectName?: string | null;
  subjectCode?: string | null;
}): boolean {
  if (ws.startPeriod === 0) return true;
  if (ws.entryType === 'homeroom') return true;
  const name = `${ws.subjectName || ''} ${ws.subjectCode || ''}`.toLowerCase();
  return name.includes('เสาธง') || name.includes('โฮมรูม') || name.includes('เข้าแถว');
}

export function getEmptyDashboardData(): DashboardData {
  return {
    totalClassrooms: 0,
    totalStudents: 0,
    upcomingSchedules: [],
    atRiskStudents: [],
    pendingTasks: [],
    todaySchedule: [],
    todayStats: {
      totalClasses: 0,
      checkedClasses: 0,
      totalWeeklyHours: 0,
      todayAttendanceRate: null,
      isSemesterEnded: false,
    },
    isSemesterEnded: false,
    activeSemester: null,
  };
}

// ==================== Core Calculation Functions ====================

interface ClassroomMinimal {
  id: number;
  name: string;
  lateToAbsentRatio: number;
  leaveToAbsentRatio: number;
  absentToFRatio?: number;
  totalClasses: number;
  minAttendancePercent: number;
  semesterStartDate: Date | null;
  totalWeeks: number;
  curriculumType: string;
}

/**
 * Calculates at-risk students based on attendance records and classroom policies.
 */
export async function calculateAtRiskStudents(
  userId: number,
  classrooms: ClassroomMinimal[]
): Promise<AtRiskStudent[]> {
  const classroomIds = classrooms.map((c) => c.id);
  if (classroomIds.length === 0) return [];

  const atRiskStudents: AtRiskStudent[] = [];

  const students = await withDbRetry(() =>
    prisma.student.findMany({
      where: { classroomId: { in: classroomIds }, userId },
      select: {
        id: true,
        name: true,
        studentCode: true,
        classroomId: true,
      },
    })
  );

  const attendanceCountsGrouped = await withDbRetry(() =>
    prisma.attendance.groupBy({
      by: ['studentId', 'classroomId', 'status'],
      where: {
        classroomId: { in: classroomIds },
        status: { in: ['absent', 'late', 'leave'] },
      },
      _count: true,
    })
  );

  const attStatsMap = new Map<string, { absent: number; late: number; leave: number }>();
  for (const row of attendanceCountsGrouped) {
    const key = `${row.studentId}_${row.classroomId}`;
    if (!attStatsMap.has(key)) {
      attStatsMap.set(key, { absent: 0, late: 0, leave: 0 });
    }
    const s = attStatsMap.get(key)!;
    if (row.status === 'absent') s.absent = row._count;
    else if (row.status === 'late') s.late = row._count;
    else if (row.status === 'leave') s.leave = row._count;
  }

  const classroomMap = new Map(classrooms.map((c) => [c.id, c]));

  for (const student of students) {
    if (!student.classroomId) continue;
    const classroom = classroomMap.get(student.classroomId);
    if (!classroom) continue;

    const attConfig = getAttendanceConfig(classroom as any);
    const stats = attStatsMap.get(`${student.id}_${student.classroomId}`) || {
      absent: 0,
      late: 0,
      leave: 0,
    };
    const attConv = computeAbsentConversion(stats, attConfig);

    if (attConv.isF) {
      atRiskStudents.push({
        student_id: student.id,
        student_name: student.name,
        student_code: student.studentCode,
        classroom_name: classroom.name,
        reason: 'หมดสิทธิ์สอบแล้ว (เวลาเรียนไม่ถึงเกณฑ์)',
        type: 'attendance_f',
        absent_count: attConv.totalConverted,
        max_allowed: attConv.maxAllowedAbsences,
        remaining: 0,
        avatar: null,
      });
    } else if (attConv.remaining <= 2 && attConv.remaining >= 0) {
      atRiskStudents.push({
        student_id: student.id,
        student_name: student.name,
        student_code: student.studentCode,
        classroom_name: classroom.name,
        reason: `เสี่ยงหมดสิทธิ์สอบ (ขาดได้อีก ${attConv.remaining} ครั้ง)`,
        type: 'attendance_warning',
        absent_count: attConv.totalConverted,
        max_allowed: attConv.maxAllowedAbsences,
        remaining: attConv.remaining,
        avatar: null,
      });
    }
  }

  // Performance Optimization: Only fetch avatar for students who are actually at risk
  if (atRiskStudents.length > 0) {
    const atRiskIds = atRiskStudents.map((s) => s.student_id);
    const studentAvatars = await withDbRetry(() =>
      prisma.student.findMany({
        where: { id: { in: atRiskIds } },
        select: { id: true, avatar: true },
      })
    );
    const avatarMap = new Map(studentAvatars.map((a) => [a.id, a.avatar]));
    for (const s of atRiskStudents) {
      s.avatar = avatarMap.get(s.student_id) || null;
    }
  }

  return atRiskStudents;
}

/**
 * Fetches and builds all dashboard statistics and components for a user.
 */
export async function fetchDashboardData(userId: number): Promise<DashboardData> {
  // Use Thai timezone (UTC+7) to determine "today"
  const nowUtc = new Date();
  const thaiOffsetMs = 7 * 60 * 60 * 1000;
  const nowThai = new Date(nowUtc.getTime() + thaiOffsetMs);
  const jsDay = nowThai.getUTCDay(); // 0=Sun..6=Sat in Thai time
  const schemaDayOfWeek = (jsDay + 6) % 7; // 0=Mon..6=Sun
  const todayDateStr = nowThai.toISOString().split('T')[0];
  const todayDate = new Date(todayDateStr);

  // Resolve active semester for scoping
  const activeSemester = await getActiveSemester(userId);
  const semesterFilter = activeSemester ? { semesterId: activeSemester.id } : {};

  // Fetch classrooms first with retry
  const classrooms = await withDbRetry(() =>
    prisma.classroom.findMany({
      where: { userId, ...semesterFilter },
      select: {
        id: true,
        name: true,
        lateToAbsentRatio: true,
        leaveToAbsentRatio: true,
        totalClasses: true,
        minAttendancePercent: true,
        semesterStartDate: true,
        totalWeeks: true,
        curriculumType: true,
      },
    })
  );
  const classroomCount = classrooms.length;

  const [studentCount, weeklyHoursAgg] = await Promise.all([
    withDbRetry(() =>
      prisma.student.count({
        where: {
          userId,
          classroom: semesterFilter.semesterId ? { semesterId: semesterFilter.semesterId } : undefined,
        },
      })
    ),
    withDbRetry(() =>
      prisma.weeklySchedule.aggregate({
        where: { userId, ...(activeSemester ? { semesterId: activeSemester.id } : {}) },
        _sum: { hours: true },
      })
    ),
  ]);

  // Semester Active & Ended Status Calculation
  const classroomsWithDates = classrooms.filter((c) => c.semesterStartDate || activeSemester?.startDate);
  let maxSemesterEndDate: Date | null = null;
  let allClassroomsEnded = classroomsWithDates.length > 0;
  const classroomStatusMap = new Map<number, { isTeachingActive: boolean; isEnded: boolean; endDate: Date | null }>();

  for (const c of classrooms) {
    const effectiveStartDate = c.semesterStartDate || activeSemester?.startDate || null;
    if (effectiveStartDate) {
      const tempClassroom = { ...c, semesterStartDate: effectiveStartDate };
      const isEnded = isClassroomSemesterEnded(tempClassroom as any, todayDate);
      const isTeachingActive = isClassroomTeachingActive(tempClassroom as any, todayDate);
      const endDate = getSemesterEndDate(effectiveStartDate, resolveTargetWeeks(c as any));

      if (!maxSemesterEndDate || endDate > maxSemesterEndDate) {
        maxSemesterEndDate = endDate;
      }
      if (!isEnded) {
        allClassroomsEnded = false;
      }
      classroomStatusMap.set(c.id, { isTeachingActive, isEnded, endDate });
    } else {
      classroomStatusMap.set(c.id, { isTeachingActive: true, isEnded: false, endDate: null });
    }
  }

  const isSemesterEnded = classroomsWithDates.length > 0 && allClassroomsEnded;

  // At-risk students
  const atRiskStudents = await calculateAtRiskStudents(userId, classrooms);

  // Today's timetable
  const rawTodayTimetable = await withDbRetry(() =>
    prisma.weeklySchedule.findMany({
      where: {
        userId,
        dayOfWeek: schemaDayOfWeek,
        ...(activeSemester ? { semesterId: activeSemester.id } : {}),
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ startPeriod: 'asc' }],
    })
  );

  const todayTimetable = isSemesterEnded
    ? []
    : rawTodayTimetable.filter((slot) => {
        if (slot.classroomId) {
          const status = classroomStatusMap.get(slot.classroomId);
          if (status && !status.isTeachingActive) return false;
        } else {
          if (isFlagpoleOrHomeroom(slot)) return false;
        }
        return true;
      });

  const classroomIdsToCheck = todayTimetable
    .filter((e) => e.classroomId && e.classroom)
    .map((e) => e.classroomId!);
  const uniqueClassroomIds = [...new Set(classroomIdsToCheck)];

  const [attendanceCounts, todayAttendanceRecords] = await Promise.all([
    uniqueClassroomIds.length > 0
      ? withDbRetry(() =>
          prisma.attendance.groupBy({
            by: ['classroomId'],
            where: {
              classroomId: { in: uniqueClassroomIds },
              date: todayDate,
            },
            _count: true,
          })
        )
      : Promise.resolve([]),
    withDbRetry(() =>
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          classroom: { userId },
          date: todayDate,
        },
        _count: true,
      })
    ),
  ]);

  const classroomHasAttendance = new Set(attendanceCounts.map((a) => a.classroomId));

  const pendingTasks: PendingTask[] = [];
  for (const entry of todayTimetable) {
    if (!entry.classroomId || !entry.classroom) continue;

    if (!classroomHasAttendance.has(entry.classroomId)) {
      if (!pendingTasks.some((t) => t.classroom_name === entry.classroom!.name && t.type === 'attendance')) {
        pendingTasks.push({
          type: 'attendance',
          classroom_name: entry.classroom.name,
          message: `ยังไม่เช็คชื่อ "${entry.classroom.name}" วันนี้`,
          link: `/attendance?classroom_id=${entry.classroomId}`,
        });
      }
    }
  }

  const todaySchedule: TodayScheduleItem[] = todayTimetable.map((e) => {
    const defaultStart = PERIOD_TIMES[e.startPeriod]?.start || '08:00';
    const defaultEnd = PERIOD_TIMES[e.endPeriod]?.end || '09:00';
    const startTimeStr = e.startTime
      ? e.startTime.toISOString().split('T')[1].slice(0, 5)
      : defaultStart;
    const endTimeStr = e.endTime
      ? e.endTime.toISOString().split('T')[1].slice(0, 5)
      : defaultEnd;

    return {
      id: e.id,
      subject_code: e.subjectCode || '',
      subject_name: e.subjectName || e.classroom?.name || 'ไม่มีชื่อวิชา',
      room: e.room || '',
      group_name: e.groupName || '',
      start_period: e.startPeriod,
      end_period: e.endPeriod,
      start_time: startTimeStr,
      end_time: endTimeStr,
      hours: e.hours,
      entry_type: e.entryType,
      color: e.color || '',
      classroom_id: e.classroomId,
      classroom_name: e.classroom?.name || null,
      is_attendance_checked: e.classroomId ? classroomHasAttendance.has(e.classroomId) : false,
    };
  });

  let totalAttRecords = 0;
  let presentAttRecords = 0;
  for (const att of todayAttendanceRecords) {
    totalAttRecords += att._count;
    if (att.status === 'present') {
      presentAttRecords += att._count;
    }
  }
  const todayAttendanceRate =
    totalAttRecords > 0 ? Math.round((presentAttRecords / totalAttRecords) * 100) : null;

  const todayStats: TodayStats = {
    totalClasses: todaySchedule.length,
    checkedClasses: todaySchedule.filter((s) => s.classroom_id && s.is_attendance_checked).length,
    totalWeeklyHours: isSemesterEnded ? 0 : (weeklyHoursAgg._sum.hours || 0),
    todayAttendanceRate,
    isSemesterEnded,
  };

  return {
    totalClassrooms: classroomCount,
    totalStudents: studentCount,
    upcomingSchedules: [],
    atRiskStudents,
    pendingTasks,
    todaySchedule,
    todayStats,
    isSemesterEnded,
    activeSemester: activeSemester
      ? {
          id: activeSemester.id,
          name: activeSemester.name,
          term_number: activeSemester.termNumber,
          academic_year: activeSemester.academicYear,
          is_active: true,
        }
      : null,
  };
}
