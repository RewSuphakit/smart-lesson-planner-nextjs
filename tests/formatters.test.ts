import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {},
  withDbRetry: (fn: () => unknown) => fn(),
}));

import type { Attendance } from '@prisma/client';
import {
  calculateAttendanceStats,
  calculateAttendanceStatsFromGrouped,
  computeAbsentConversion,
  formatAttendanceRecord,
  formatScoreResponse,
  formatScoreStructureResponse,
  formatStudentListItem,
  getAttendanceConfig,
  normalizeAttendanceDate,
} from '@/lib/formatters';

describe('normalizeAttendanceDate', () => {
  it('normalizes a YYYY-MM-DD string to UTC midnight', () => {
    expect(normalizeAttendanceDate('2026-03-05').toISOString()).toBe('2026-03-05T00:00:00.000Z');
  });

  it('drops the time portion of an ISO string without applying timezone shifts', () => {
    expect(normalizeAttendanceDate('2026-03-05T23:59:59.999+07:00').toISOString()).toBe(
      '2026-03-05T00:00:00.000Z'
    );
  });

  it('accepts slash-separated and non-padded dates', () => {
    expect(normalizeAttendanceDate('2026/3/5').toISOString()).toBe('2026-03-05T00:00:00.000Z');
    expect(normalizeAttendanceDate('  2026-3-5  ').toISOString()).toBe('2026-03-05T00:00:00.000Z');
  });

  it('uses UTC date parts of a Date object', () => {
    const d = new Date('2026-12-31T23:30:00.000Z');
    expect(normalizeAttendanceDate(d).toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('falls back to Date parsing for other formats', () => {
    expect(normalizeAttendanceDate('March 5, 2026 12:00:00 UTC').toISOString()).toBe(
      '2026-03-05T00:00:00.000Z'
    );
  });

  it('throws on an invalid Date object', () => {
    expect(() => normalizeAttendanceDate(new Date('nope'))).toThrow('Invalid date');
  });

  it('throws on an unparseable string', () => {
    expect(() => normalizeAttendanceDate('not-a-date')).toThrow('Invalid date format');
    expect(() => normalizeAttendanceDate('')).toThrow('Invalid date format');
  });
});

describe('formatAttendanceRecord', () => {
  it('maps camelCase fields to snake_case', () => {
    const date = new Date('2026-03-05T00:00:00.000Z');
    const createdAt = new Date('2026-03-05T01:00:00.000Z');
    const updatedAt = new Date('2026-03-05T02:00:00.000Z');
    const record = {
      id: 1,
      studentId: 2,
      classroomId: 3,
      userId: 4,
      date,
      status: 'late',
      createdAt,
      updatedAt,
    } as unknown as Attendance;
    expect(formatAttendanceRecord(record)).toEqual({
      id: 1,
      student_id: 2,
      classroom_id: 3,
      date,
      status: 'late',
      created_at: createdAt,
      updated_at: updatedAt,
    });
  });

  it('does not leak userId', () => {
    const record = { id: 1, studentId: 2, classroomId: 3, userId: 99 } as unknown as Attendance;
    expect(formatAttendanceRecord(record)).not.toHaveProperty('userId');
    expect(formatAttendanceRecord(record)).not.toHaveProperty('user_id');
  });
});

describe('getAttendanceConfig', () => {
  it('provides defaults for empty classroom', () => {
    expect(getAttendanceConfig({})).toEqual({
      lateToAbsentRatio: 3,
      leaveToAbsentRatio: 2,
      totalClasses: 40,
      minAttendancePercent: 80,
    });
  });

  it('uses explicit values and treats null as default', () => {
    expect(
      getAttendanceConfig({
        lateToAbsentRatio: 4,
        leaveToAbsentRatio: null,
        totalClasses: 30,
        minAttendancePercent: 75,
      })
    ).toEqual({ lateToAbsentRatio: 4, leaveToAbsentRatio: 2, totalClasses: 30, minAttendancePercent: 75 });
  });
});

describe('computeAbsentConversion', () => {
  const config = { lateToAbsentRatio: 3, leaveToAbsentRatio: 2, totalClasses: 40, minAttendancePercent: 80 };

  it('computes zero-state correctly', () => {
    expect(computeAbsentConversion({ absent: 0, late: 0, leave: 0 }, config)).toEqual({
      convertedFromLate: 0,
      convertedFromLeave: 0,
      totalConverted: 0,
      maxAllowedAbsences: 8,
      isF: false,
      remaining: 8,
      attendancePercent: 100,
      remainingLate: 0,
      remainingLeave: 0,
    });
  });

  it('converts late and leave counts using floor division and keeps remainders', () => {
    const r = computeAbsentConversion({ absent: 1, late: 7, leave: 5 }, config);
    expect(r.convertedFromLate).toBe(2);
    expect(r.convertedFromLeave).toBe(2);
    expect(r.totalConverted).toBe(5);
    expect(r.remainingLate).toBe(1);
    expect(r.remainingLeave).toBe(1);
    expect(r.remaining).toBe(3);
    expect(r.attendancePercent).toBe(88); // round(35/40*100) = 87.5 -> 88
  });

  it('is not F at exactly the max allowed absences, but F at max + 1', () => {
    expect(computeAbsentConversion({ absent: 8, late: 0, leave: 0 }, config).isF).toBe(false);
    const f = computeAbsentConversion({ absent: 9, late: 0, leave: 0 }, config);
    expect(f.isF).toBe(true);
    expect(f.remaining).toBe(-1);
  });

  it('clamps attendancePercent to 0..100', () => {
    expect(computeAbsentConversion({ absent: 100, late: 0, leave: 0 }, config).attendancePercent).toBe(0);
  });

  it('returns 100% when totalClasses is 0', () => {
    const r = computeAbsentConversion(
      { absent: 5, late: 0, leave: 0 },
      { ...config, totalClasses: 0 }
    );
    expect(r.attendancePercent).toBe(100);
  });
});

describe('calculateAttendanceStatsFromGrouped', () => {
  const classroom = { lateToAbsentRatio: 3, leaveToAbsentRatio: 2, totalClasses: 20, minAttendancePercent: 80 };

  it('returns an empty array for empty input', () => {
    expect(calculateAttendanceStatsFromGrouped([], classroom)).toEqual([]);
  });

  it('aggregates counts per student and computes conversion', () => {
    const result = calculateAttendanceStatsFromGrouped(
      [
        { studentId: 1, status: 'present', _count: 10 },
        { studentId: 1, status: 'late', _count: 7 },
        { studentId: 1, status: 'absent', _count: 2 },
        { studentId: 1, status: 'leave', _count: 3 },
        { studentId: 2, status: 'present', _count: 5 },
      ],
      classroom
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      student_id: 1,
      present_count: 10,
      late_count: 7,
      absent_count: 2,
      leave_count: 3,
      converted_absent_count: 2 + 2 + 1,
      remaining_late_count: 1,
      remaining_leave_count: 1,
      is_f: true, // 5 > floor(20 * 0.2) = 4
      max_allowed_absences: 4,
      total_classes: 20,
      converted_from_late: 2,
      converted_from_leave: 1,
    });
    expect(result[1]).toMatchObject({
      student_id: 2,
      present_count: 5,
      absent_count: 0,
      is_f: false,
      converted_absent_count: 0,
    });
  });

  it('sums multiple groups with the same status for the same student', () => {
    const [s] = calculateAttendanceStatsFromGrouped(
      [
        { studentId: 1, status: 'absent', _count: 1 },
        { studentId: 1, status: 'absent', _count: 2 },
      ],
      classroom
    );
    expect(s.absent_count).toBe(3);
  });

  it('ignores unknown statuses', () => {
    const [s] = calculateAttendanceStatsFromGrouped(
      [{ studentId: 1, status: 'weird', _count: 9 }],
      classroom
    );
    expect(s).toMatchObject({ present_count: 0, late_count: 0, absent_count: 0, leave_count: 0 });
  });

  it('applies default config when classroom fields are null', () => {
    const [s] = calculateAttendanceStatsFromGrouped(
      [{ studentId: 1, status: 'late', _count: 3 }],
      { lateToAbsentRatio: null, leaveToAbsentRatio: null, totalClasses: null, minAttendancePercent: null }
    );
    expect(s.total_classes).toBe(40);
    expect(s.max_allowed_absences).toBe(8);
    expect(s.converted_from_late).toBe(1);
  });

  it('matches calculateAttendanceStats (per-record variant) for equivalent data', () => {
    const records = [
      { studentId: 1, status: 'present' },
      { studentId: 1, status: 'late' },
      { studentId: 1, status: 'late' },
      { studentId: 1, status: 'late' },
      { studentId: 1, status: 'absent' },
      { studentId: 2, status: 'leave' },
      { studentId: 2, status: 'leave' },
    ] as unknown as Attendance[];
    const grouped = [
      { studentId: 1, status: 'present', _count: 1 },
      { studentId: 1, status: 'late', _count: 3 },
      { studentId: 1, status: 'absent', _count: 1 },
      { studentId: 2, status: 'leave', _count: 2 },
    ];
    expect(calculateAttendanceStatsFromGrouped(grouped, classroom)).toEqual(
      calculateAttendanceStats(records, classroom)
    );
  });
});

describe('other response formatters', () => {
  it('formatStudentListItem fills nulls and converts numeric-like scores', () => {
    expect(formatStudentListItem({ id: 1, name: 'A' })).toEqual({
      id: 1,
      name: 'A',
      student_code: null,
      grade_level: null,
      branch: null,
      email: null,
      classroom_id: null,
      classroom_name: null,
      avatar: null,
      midterm_score: null,
      final_score: null,
      affective_score: null,
    });
    const r = formatStudentListItem({
      id: 2,
      name: 'B',
      classroom: { name: 'ปวช.1' },
      midtermScore: '12.50',
      finalScore: 0,
      affectiveScore: null,
    });
    expect(r.classroom_name).toBe('ปวช.1');
    expect(r.midterm_score).toBe(12.5);
    expect(r.final_score).toBe(0); // 0 must be preserved
    expect(r.affective_score).toBeNull();
  });

  it('formatScoreResponse converts decimals to numbers and preserves 0', () => {
    const r = formatScoreResponse({
      id: 1,
      studentId: 2,
      classroomId: 3,
      lessonNumber: 4,
      assignmentScore: '5.5',
      postTestScore: 0,
    });
    expect(r).toMatchObject({
      student_id: 2,
      classroom_id: 3,
      lesson_number: 4,
      assignment_score: 5.5,
      post_test_score: 0,
    });
  });

  it('formatScoreStructureResponse defaults optional fields to null', () => {
    expect(
      formatScoreStructureResponse({ id: 1, classroomId: 2, lessonNumber: 3 })
    ).toMatchObject({
      lesson_name: null,
      max_assignment_score: null,
      max_post_test_score: null,
      hours: null,
    });
  });
});
