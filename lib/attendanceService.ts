import prisma from '@/lib/prisma';
import { AttendanceStatus, Prisma } from '@prisma/client';
import {
  formatAttendanceRecord,
  calculateAttendanceStatsFromGrouped,
  normalizeAttendanceDate,
} from '@/lib/formatters';
import { getOrSetCache, invalidateCache, userCacheKey } from '@/lib/cache';

export interface AttendanceRecordInput {
  student_id: number;
  classroom_id: number;
  date: string;
  status: AttendanceStatus;
}

export type ServiceResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; status: number; message: string };

/**
 * Invalidates user-scoped caches impacted by attendance mutations
 */
export function invalidateAttendanceCaches(userId: number): void {
  invalidateCache(userCacheKey(userId, 'attendance'));
  invalidateCache(userCacheKey(userId, 'grades'));
  invalidateCache(userCacheKey(userId, 'dashboard'));
}

/**
 * Get attendance history for a single student (optionally scoped to a classroom).
 * Unbounded by semester range or take so the history modal shows complete logs.
 */
export async function getStudentAttendanceHistory(
  userId: number,
  studentId: number | string,
  classroomId?: number | string
) {
  const numericStudentId = Number(studentId);
  if (isNaN(numericStudentId) || numericStudentId <= 0) return null;

  // Validate ownership (select id only: avoids loading avatar blob)
  const student = await prisma.student.findFirst({
    where: { id: numericStudentId, userId },
    select: { id: true },
  });
  if (!student) return null;

  const whereClause: { studentId: number; classroomId?: number } = { studentId: numericStudentId };
  if (classroomId !== undefined && classroomId !== null) {
    const numericClassroomId = Number(classroomId);
    if (!isNaN(numericClassroomId) && numericClassroomId > 0) {
      whereClause.classroomId = numericClassroomId;
    }
  }

  const records = await prisma.attendance.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
  });
  return records.map(formatAttendanceRecord);
}

/**
 * Get attendance records for a classroom in a date range (Matrix view), cached for 45s.
 */
export async function getClassroomAttendanceRange(
  userId: number,
  classroomId: number | string,
  startDate: string,
  endDate: string
) {
  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) return null;

  return await getOrSetCache(
    userCacheKey(userId, 'attendance:range', `${numericClassroomId}:${startDate}:${endDate}`),
    45,
    async () => {
      // Check ownership first so records query never runs for classrooms user does not own
      const classroom = await prisma.classroom.findFirst({
        where: { id: numericClassroomId, userId },
        select: { id: true },
      });
      if (!classroom) return null;

      const records = await prisma.attendance.findMany({
        where: {
          classroomId: numericClassroomId,
          date: {
            gte: normalizeAttendanceDate(startDate),
            lte: normalizeAttendanceDate(endDate),
          },
        },
        orderBy: { date: 'asc' },
      });
      return records.map(formatAttendanceRecord);
    }
  );
}

/**
 * Get attendance records for a classroom on a specific date, cached for 45s.
 */
export async function getClassroomAttendanceByDate(
  userId: number,
  classroomId: number | string,
  date: string
) {
  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) return null;

  return await getOrSetCache(
    userCacheKey(userId, 'attendance:date', `${numericClassroomId}:${date}`),
    45,
    async () => {
      const classroom = await prisma.classroom.findFirst({
        where: { id: numericClassroomId, userId },
        select: { id: true },
      });
      if (!classroom) return null;

      const records = await prisma.attendance.findMany({
        where: { classroomId: numericClassroomId, date: normalizeAttendanceDate(date) },
      });
      return records.map(formatAttendanceRecord);
    }
  );
}

/**
 * Distinct attendance dates for a classroom (lightweight alternative to type=records), cached for 45s.
 */
export async function getClassroomAttendanceDates(
  userId: number,
  classroomId: number | string
) {
  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) return null;

  const classroom = await prisma.classroom.findFirst({
    where: { id: numericClassroomId, userId },
    select: { id: true },
  });
  if (!classroom) return null;

  return await getOrSetCache(
    userCacheKey(userId, 'attendance:dates', numericClassroomId),
    45,
    async () => {
      const rows = await prisma.attendance.groupBy({
        by: ['date'],
        where: { classroomId: numericClassroomId },
        _count: true,
        orderBy: { date: 'asc' },
      });
      return rows.map(r => ({ date: r.date.toISOString().split('T')[0], count: r._count }));
    }
  );
}

/**
 * Get all individual attendance records for a classroom (e.g. for Scores matrix week-date mapping), cached for 45s.
 */
export async function getClassroomAttendanceRecords(
  userId: number,
  classroomId: number | string
) {
  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) return null;

  const classroom = await prisma.classroom.findFirst({
    where: { id: numericClassroomId, userId },
    select: { id: true },
  });
  if (!classroom) return null;

  return await getOrSetCache(
    userCacheKey(userId, 'attendance:records', numericClassroomId),
    45,
    async () => {
      const records = await prisma.attendance.findMany({
        where: { classroomId: numericClassroomId },
        select: { id: true, studentId: true, classroomId: true, date: true, status: true },
        orderBy: { date: 'asc' },
      });
      return records.map(r => ({
        id: r.id,
        student_id: r.studentId,
        classroom_id: r.classroomId,
        date: r.date,
        status: r.status,
      }));
    }
  );
}

/**
 * Calculate attendance statistics for a classroom, cached for 45s.
 */
export async function getClassroomAttendanceStats(
  userId: number,
  classroomId: number | string
) {
  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) return [];

  return await getOrSetCache(
    userCacheKey(userId, 'attendance:stats', numericClassroomId),
    45,
    async () => {
      const classroom = await prisma.classroom.findFirst({
        where: { id: numericClassroomId, userId },
      });
      if (!classroom) return [];

      const groupedCounts = await prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { classroomId: numericClassroomId },
        _count: true,
      });

      return calculateAttendanceStatsFromGrouped(groupedCounts, classroom);
    }
  );
}

/**
 * Bulk create or update attendance records with authorization checks, deduplication, and cache invalidation.
 */
export async function processBulkAttendance(
  userId: number,
  records: AttendanceRecordInput[]
): Promise<ServiceResult> {
  if (!records || records.length === 0) {
    return { success: true };
  }

  // Find unique classroom IDs and verify ownership in a single query
  const classroomIds = Array.from(new Set(records.map(r => r.classroom_id)));
  if (classroomIds.length > 0) {
    const ownedClassrooms = await prisma.classroom.findMany({
      where: { id: { in: classroomIds }, userId },
      select: { id: true },
    });
    const ownedClassroomIds = new Set(ownedClassrooms.map(c => c.id));
    const hasUnauthorizedClassroom = classroomIds.some(cid => !ownedClassroomIds.has(cid));
    if (hasUnauthorizedClassroom) {
      return { success: false, status: 404, message: 'Classroom not found or unauthorized' };
    }
  }

  // Verify student ownership for all students in the request
  const studentIds = Array.from(new Set(records.map(r => r.student_id)));
  const ownedStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, userId },
    select: { id: true },
  });
  const ownedStudentIds = new Set(ownedStudents.map(s => s.id));
  const unauthorizedIds = studentIds.filter(id => !ownedStudentIds.has(id));
  if (unauthorizedIds.length > 0) {
    return { success: false, status: 403, message: 'Some students not found or unauthorized' };
  }

  // Deduplicate incoming records by (student_id, classroom_id, date)
  const dedupedMap = new Map<string, { studentId: number; classroomId: number; date: Date; status: AttendanceStatus }>();
  for (const r of records) {
    const parsedDate = normalizeAttendanceDate(r.date);
    const dateIso = parsedDate.toISOString().split('T')[0];
    const key = `${r.student_id}_${r.classroom_id}_${dateIso}`;
    dedupedMap.set(key, {
      studentId: r.student_id,
      classroomId: r.classroom_id,
      date: parsedDate,
      status: r.status,
    });
  }
  const dedupedList = Array.from(dedupedMap.values());

  // Query existing records in a single batch query
  const existingAttendance = await prisma.attendance.findMany({
    where: {
      classroomId: { in: classroomIds },
      studentId: { in: studentIds },
      // Dedupe by timestamp (Set of Date objects would compare by reference)
      date: { in: Array.from(new Set(dedupedList.map(r => r.date.getTime()))).map(t => new Date(t)) },
    },
    select: { id: true, studentId: true, classroomId: true, date: true, status: true },
  });

  const existingMap = new Map<string, { id: number; status: string }>();
  for (const ea of existingAttendance) {
    const key = `${ea.studentId}_${ea.classroomId}_${ea.date.toISOString().split('T')[0]}`;
    existingMap.set(key, { id: ea.id, status: ea.status });
  }

  const creates: Array<{ studentId: number; classroomId: number; date: Date; status: AttendanceStatus }> = [];
  const updates: Array<{ id: number; status: AttendanceStatus }> = [];

  for (const item of dedupedList) {
    const key = `${item.studentId}_${item.classroomId}_${item.date.toISOString().split('T')[0]}`;
    const existing = existingMap.get(key);
    if (existing) {
      // Only update if status has actually changed to save DB writes
      if (existing.status !== item.status) {
        updates.push({ id: existing.id, status: item.status });
      }
    } else {
      creates.push({
        studentId: item.studentId,
        classroomId: item.classroomId,
        date: item.date,
        status: item.status,
      });
    }
  }

  if (creates.length > 0 || updates.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (creates.length > 0) {
        await tx.attendance.createMany({
          data: creates,
          skipDuplicates: true,
        });
      }

      const BATCH_SIZE = 25;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((upd) =>
            tx.attendance.update({
              where: { id: upd.id },
              data: { status: upd.status },
            })
          )
        );
      }
    });
  }

  invalidateAttendanceCaches(userId);
  return { success: true };
}

/**
 * Record or update a single student's attendance.
 */
export async function processSingleAttendance(
  userId: number,
  record: AttendanceRecordInput
): Promise<ServiceResult> {
  const parsedDate = normalizeAttendanceDate(record.date);

  // Verify classroom and student ownership
  const [classroom, student] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id: record.classroom_id, userId },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { id: record.student_id, userId },
      select: { id: true },
    }),
  ]);
  if (!classroom) return { success: false, status: 404, message: 'Classroom not found or unauthorized' };
  if (!student) return { success: false, status: 404, message: 'Student not found or unauthorized' };

  try {
    await prisma.attendance.upsert({
      where: {
        studentId_classroomId_date: {
          studentId: record.student_id,
          classroomId: record.classroom_id,
          date: parsedDate,
        },
      },
      update: { status: record.status },
      create: {
        studentId: record.student_id,
        classroomId: record.classroom_id,
        date: parsedDate,
        status: record.status,
      },
    });
  } catch (upsertError: unknown) {
    const isUniqueConstraint =
      (upsertError instanceof Prisma.PrismaClientKnownRequestError && upsertError.code === 'P2002') ||
      (upsertError as { code?: string })?.code === 'P2002';

    if (isUniqueConstraint) {
      // Fallback for concurrent upserts (race condition):
      // A parallel request inserted the record right after the where check.
      // Safely update the existing record.
      await prisma.attendance.updateMany({
        where: {
          studentId: record.student_id,
          classroomId: record.classroom_id,
          date: parsedDate,
        },
        data: { status: record.status },
      });
    } else {
      throw upsertError;
    }
  }

  invalidateAttendanceCaches(userId);
  return { success: true };
}

/**
 * Delete a single attendance record by ID with ownership verification.
 */
export async function deleteAttendanceById(
  userId: number,
  id: number
): Promise<ServiceResult> {
  const attendance = await prisma.attendance.findFirst({
    where: { id, classroom: { userId } },
    select: { id: true },
  });
  if (!attendance) {
    return { success: false, status: 404, message: 'Attendance record not found' };
  }

  await prisma.attendance.delete({ where: { id } });
  invalidateAttendanceCaches(userId);
  return { success: true };
}

/**
 * Delete attendance records by classroom and date (optionally filtered by studentId or studentIds).
 */
export async function deleteAttendanceByFilter(
  userId: number,
  params: {
    classroomId: number;
    date: string;
    studentId?: number;
    studentIds?: number[];
  }
): Promise<ServiceResult> {
  const { classroomId, date, studentId, studentIds } = params;
  const parsedDate = normalizeAttendanceDate(date);

  if (studentIds && studentIds.length > 0) {
    const [classroom, ownedStudents] = await Promise.all([
      prisma.classroom.findFirst({
        where: { id: classroomId, userId },
        select: { id: true },
      }),
      prisma.student.findMany({
        where: { id: { in: studentIds }, userId },
        select: { id: true },
      }),
    ]);
    if (!classroom) return { success: false, status: 404, message: 'Classroom not found' };
    const ownedIds = ownedStudents.map(s => s.id);
    if (ownedIds.length === 0) {
      return { success: false, status: 404, message: 'No matching authorized students found' };
    }

    await prisma.attendance.deleteMany({
      where: {
        studentId: { in: ownedIds },
        classroomId,
        date: parsedDate,
      },
    });
  } else if (studentId) {
    const [classroom, student] = await Promise.all([
      prisma.classroom.findFirst({
        where: { id: classroomId, userId },
        select: { id: true },
      }),
      prisma.student.findFirst({
        where: { id: studentId, userId },
        select: { id: true },
      }),
    ]);
    if (!classroom) return { success: false, status: 404, message: 'Classroom not found' };
    if (!student) return { success: false, status: 404, message: 'Student not found or unauthorized' };

    await prisma.attendance.deleteMany({
      where: {
        studentId,
        classroomId,
        date: parsedDate,
      },
    });
  } else {
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, userId },
      select: { id: true },
    });
    if (!classroom) return { success: false, status: 404, message: 'Classroom not found' };

    await prisma.attendance.deleteMany({
      where: { classroomId, date: parsedDate },
    });
  }

  invalidateAttendanceCaches(userId);
  return { success: true };
}
