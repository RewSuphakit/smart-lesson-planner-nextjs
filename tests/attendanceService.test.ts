import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const { mockPrisma, mockCache } = vi.hoisted(() => {
  const mockCache = new Map<string, unknown>();
  const mockPrisma = {
    student: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    classroom: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    attendance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
  };
  return { mockPrisma, mockCache };
});

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}));

vi.mock('@/lib/cache', () => ({
  getOrSetCache: vi.fn(async (key: string, _ttl: number, fn: () => Promise<unknown>) => {
    if (mockCache.has(key)) return mockCache.get(key);
    const result = await fn();
    if (result !== null && result !== undefined) {
      mockCache.set(key, result);
    }
    return result;
  }),
  invalidateCache: vi.fn((keyPrefix: string) => {
    for (const key of Array.from(mockCache.keys())) {
      if (key.startsWith(keyPrefix)) {
        mockCache.delete(key);
      }
    }
  }),
  userCacheKey: (...parts: (string | number)[]) => parts.join(':'),
  memoryCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import {
  getStudentAttendanceHistory,
  getClassroomAttendanceRange,
  getClassroomAttendanceByDate,
  getClassroomAttendanceDates,
  getClassroomAttendanceRecords,
  getClassroomAttendanceStats,
  processBulkAttendance,
  processSingleAttendance,
  deleteAttendanceById,
  deleteAttendanceByFilter,
} from '@/lib/attendanceService';

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
  });

  describe('getStudentAttendanceHistory', () => {
    it('returns null if studentId is invalid', async () => {
      expect(await getStudentAttendanceHistory(1, -1)).toBeNull();
      expect(await getStudentAttendanceHistory(1, 'abc')).toBeNull();
    });

    it('returns null if student not owned by user', async () => {
      mockPrisma.student.findFirst.mockResolvedValueOnce(null);
      const res = await getStudentAttendanceHistory(1, 10);
      expect(res).toBeNull();
      expect(mockPrisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 10, userId: 1 },
        select: { id: true },
      });
    });

    it('returns formatted records when student is owned', async () => {
      mockPrisma.student.findFirst.mockResolvedValueOnce({ id: 10 });
      mockPrisma.attendance.findMany.mockResolvedValueOnce([
        {
          id: 1,
          studentId: 10,
          classroomId: 2,
          date: new Date('2026-03-01T00:00:00.000Z'),
          status: 'present',
          createdAt: new Date('2026-03-01T08:00:00.000Z'),
          updatedAt: new Date('2026-03-01T08:00:00.000Z'),
        },
      ]);

      const res = await getStudentAttendanceHistory(1, 10, 2);
      expect(res).toEqual([
        {
          id: 1,
          student_id: 10,
          classroom_id: 2,
          date: new Date('2026-03-01T00:00:00.000Z'),
          status: 'present',
          created_at: new Date('2026-03-01T08:00:00.000Z'),
          updated_at: new Date('2026-03-01T08:00:00.000Z'),
        },
      ]);
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
        where: { studentId: 10, classroomId: 2 },
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('getClassroomAttendanceRange', () => {
    it('returns null if classroom is not owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await getClassroomAttendanceRange(1, 5, '2026-03-01', '2026-03-10');
      expect(res).toBeNull();
    });

    it('returns formatted range records when classroom is owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 5 });
      mockPrisma.attendance.findMany.mockResolvedValueOnce([
        {
          id: 101,
          studentId: 20,
          classroomId: 5,
          date: new Date('2026-03-02T00:00:00.000Z'),
          status: 'late',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await getClassroomAttendanceRange(1, 5, '2026-03-01', '2026-03-10');
      expect(res).toHaveLength(1);
      expect(res?.[0].status).toBe('late');
      expect(res?.[0].student_id).toBe(20);
    });
  });

  describe('getClassroomAttendanceByDate', () => {
    it('returns null if classroom not owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await getClassroomAttendanceByDate(1, 5, '2026-03-05');
      expect(res).toBeNull();
    });

    it('returns attendance for specific date', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 5 });
      mockPrisma.attendance.findMany.mockResolvedValueOnce([
        {
          id: 102,
          studentId: 21,
          classroomId: 5,
          date: new Date('2026-03-05T00:00:00.000Z'),
          status: 'present',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await getClassroomAttendanceByDate(1, 5, '2026-03-05');
      expect(res).toHaveLength(1);
      expect(res?.[0].student_id).toBe(21);
    });
  });

  describe('getClassroomAttendanceDates', () => {
    it('returns null if classroom not owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await getClassroomAttendanceDates(1, 5);
      expect(res).toBeNull();
    });

    it('returns grouped date counts when classroom is owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 5 });
      mockPrisma.attendance.groupBy.mockResolvedValueOnce([
        { date: new Date('2026-03-01T00:00:00.000Z'), _count: 30 },
        { date: new Date('2026-03-08T00:00:00.000Z'), _count: 29 },
      ]);

      const res = await getClassroomAttendanceDates(1, 5);
      expect(res).toEqual([
        { date: '2026-03-01', count: 30 },
        { date: '2026-03-08', count: 29 },
      ]);
    });
  });

  describe('getClassroomAttendanceRecords', () => {
    it('returns null if classroom not owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await getClassroomAttendanceRecords(1, 5);
      expect(res).toBeNull();
    });

    it('returns formatted records with selected fields', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 5 });
      const recordDate = new Date('2026-03-01T00:00:00.000Z');
      mockPrisma.attendance.findMany.mockResolvedValueOnce([
        { id: 1, studentId: 10, classroomId: 5, date: recordDate, status: 'present' },
      ]);

      const res = await getClassroomAttendanceRecords(1, 5);
      expect(res).toEqual([
        { id: 1, student_id: 10, classroom_id: 5, date: recordDate, status: 'present' },
      ]);
    });
  });

  describe('getClassroomAttendanceStats', () => {
    it('returns empty array if classroom not found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await getClassroomAttendanceStats(1, 5);
      expect(res).toEqual([]);
    });

    it('calculates grouped stats when classroom is found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({
        id: 5,
        userId: 1,
        totalClasses: 18,
        lateToAbsentRatio: 3,
        leaveToAbsentRatio: 0,
        minAttendancePercent: 80,
      });
      mockPrisma.attendance.groupBy.mockResolvedValueOnce([
        { studentId: 10, status: 'present', _count: 15 },
        { studentId: 10, status: 'late', _count: 3 },
      ]);

      const res = await getClassroomAttendanceStats(1, 5);
      expect(res).toHaveLength(1);
      expect(res[0].student_id).toBe(10);
      expect(res[0].present_count).toBe(15);
      expect(res[0].late_count).toBe(3);
    });
  });

  describe('processBulkAttendance', () => {
    it('returns success immediately for empty array', async () => {
      const res = await processBulkAttendance(1, []);
      expect(res).toEqual({ success: true });
    });

    it('returns 404 if any classroom is unauthorized', async () => {
      mockPrisma.classroom.findMany.mockResolvedValueOnce([{ id: 1 }]); // classroom 2 missing
      const res = await processBulkAttendance(1, [
        { student_id: 10, classroom_id: 1, date: '2026-03-01', status: 'present' },
        { student_id: 11, classroom_id: 2, date: '2026-03-01', status: 'present' },
      ]);
      expect(res).toEqual({
        success: false,
        status: 404,
        message: 'Classroom not found or unauthorized',
      });
    });

    it('returns 403 if any student is unauthorized', async () => {
      mockPrisma.classroom.findMany.mockResolvedValueOnce([{ id: 1 }]);
      mockPrisma.student.findMany.mockResolvedValueOnce([{ id: 10 }]); // student 11 missing
      const res = await processBulkAttendance(1, [
        { student_id: 10, classroom_id: 1, date: '2026-03-01', status: 'present' },
        { student_id: 11, classroom_id: 1, date: '2026-03-01', status: 'present' },
      ]);
      expect(res).toEqual({
        success: false,
        status: 403,
        message: 'Some students not found or unauthorized',
      });
    });

    it('creates new records and updates changed records, skipping unchanged', async () => {
      mockPrisma.classroom.findMany.mockResolvedValueOnce([{ id: 1 }]);
      mockPrisma.student.findMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }, { id: 12 }]);

      // Existing records in DB:
      // student 10: status already 'present' (unchanged)
      // student 11: status 'present' -> update to 'absent'
      // student 12: not in DB -> create
      const d1 = new Date('2026-03-01T00:00:00.000Z');
      mockPrisma.attendance.findMany.mockResolvedValueOnce([
        { id: 100, studentId: 10, classroomId: 1, date: d1, status: 'present' },
        { id: 101, studentId: 11, classroomId: 1, date: d1, status: 'present' },
      ]);

      const res = await processBulkAttendance(1, [
        { student_id: 10, classroom_id: 1, date: '2026-03-01', status: 'present' },
        { student_id: 11, classroom_id: 1, date: '2026-03-01', status: 'absent' },
        { student_id: 12, classroom_id: 1, date: '2026-03-01', status: 'late' },
      ]);

      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.createMany).toHaveBeenCalledWith({
        data: [
          {
            studentId: 12,
            classroomId: 1,
            date: d1,
            status: 'late',
          },
        ],
        skipDuplicates: true,
      });
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { status: 'absent' },
      });
      // student 10 was unchanged, so update should not have been called for id 100
      expect(mockPrisma.attendance.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 100 } })
      );
    });
  });

  describe('processSingleAttendance', () => {
    it('returns 404 if classroom is unauthorized', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      mockPrisma.student.findFirst.mockResolvedValueOnce({ id: 10 });

      const res = await processSingleAttendance(1, {
        student_id: 10,
        classroom_id: 1,
        date: '2026-03-01',
        status: 'present',
      });
      expect(res).toEqual({
        success: false,
        status: 404,
        message: 'Classroom not found or unauthorized',
      });
    });

    it('returns 404 if student is unauthorized', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.student.findFirst.mockResolvedValueOnce(null);

      const res = await processSingleAttendance(1, {
        student_id: 10,
        classroom_id: 1,
        date: '2026-03-01',
        status: 'present',
      });
      expect(res).toEqual({
        success: false,
        status: 404,
        message: 'Student not found or unauthorized',
      });
    });

    it('upserts successfully', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.student.findFirst.mockResolvedValueOnce({ id: 10 });
      mockPrisma.attendance.upsert.mockResolvedValueOnce({});

      const res = await processSingleAttendance(1, {
        student_id: 10,
        classroom_id: 1,
        date: '2026-03-01',
        status: 'present',
      });
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.upsert).toHaveBeenCalled();
    });

    it('retries with updateMany if unique constraint P2002 race occurs', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.student.findFirst.mockResolvedValueOnce({ id: 10 });

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrisma.attendance.upsert.mockRejectedValueOnce(p2002Error);
      mockPrisma.attendance.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await processSingleAttendance(1, {
        student_id: 10,
        classroom_id: 1,
        date: '2026-03-01',
        status: 'present',
      });
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.updateMany).toHaveBeenCalledWith({
        where: {
          studentId: 10,
          classroomId: 1,
          date: new Date('2026-03-01T00:00:00.000Z'),
        },
        data: { status: 'present' },
      });
    });
  });

  describe('deleteAttendanceById', () => {
    it('returns 404 if record not found or unauthorized', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValueOnce(null);
      const res = await deleteAttendanceById(1, 99);
      expect(res).toEqual({
        success: false,
        status: 404,
        message: 'Attendance record not found',
      });
    });

    it('deletes record successfully', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValueOnce({ id: 99 });
      mockPrisma.attendance.delete.mockResolvedValueOnce({});

      const res = await deleteAttendanceById(1, 99);
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });
  });

  describe('deleteAttendanceByFilter', () => {
    it('returns 404 if classroom not owned', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce(null);
      const res = await deleteAttendanceByFilter(1, { classroomId: 1, date: '2026-03-01' });
      expect(res).toEqual({
        success: false,
        status: 404,
        message: 'Classroom not found',
      });
    });

    it('deletes by studentIds when provided', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.student.findMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
      mockPrisma.attendance.deleteMany.mockResolvedValueOnce({ count: 2 });

      const res = await deleteAttendanceByFilter(1, {
        classroomId: 1,
        date: '2026-03-01',
        studentIds: [10, 11],
      });
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.deleteMany).toHaveBeenCalledWith({
        where: {
          studentId: { in: [10, 11] },
          classroomId: 1,
          date: new Date('2026-03-01T00:00:00.000Z'),
        },
      });
    });

    it('deletes by single studentId when provided', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.student.findFirst.mockResolvedValueOnce({ id: 10 });
      mockPrisma.attendance.deleteMany.mockResolvedValueOnce({ count: 1 });

      const res = await deleteAttendanceByFilter(1, {
        classroomId: 1,
        date: '2026-03-01',
        studentId: 10,
      });
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.deleteMany).toHaveBeenCalledWith({
        where: {
          studentId: 10,
          classroomId: 1,
          date: new Date('2026-03-01T00:00:00.000Z'),
        },
      });
    });

    it('deletes entire class attendance for date when no student specified', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.attendance.deleteMany.mockResolvedValueOnce({ count: 30 });

      const res = await deleteAttendanceByFilter(1, {
        classroomId: 1,
        date: '2026-03-01',
      });
      expect(res).toEqual({ success: true });
      expect(mockPrisma.attendance.deleteMany).toHaveBeenCalledWith({
        where: {
          classroomId: 1,
          date: new Date('2026-03-01T00:00:00.000Z'),
        },
      });
    });
  });
});
