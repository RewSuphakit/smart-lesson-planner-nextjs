import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {},
  withDbRetry: (fn: () => unknown) => fn(),
}));

import {
  getDefaultWeeks,
  getSemesterEndDate,
  getCurrentWeek,
  getWeekNumberForDate,
  getWeekDateRanges,
  resolveTargetWeeks,
  resolveCurrentTeachingWeek,
  buildSemesterInfo,
  isClassroomTeachingActive,
  isClassroomSemesterEnded,
  buildSemesterInfoFromSemester,
  type SemesterRecord,
} from '@/lib/semester';

/** Set "now" in Thai local time terms: UTC+7 => subtract 7h to get UTC instant. */
function setThaiNow(isoLocal: string) {
  vi.setSystemTime(new Date(new Date(`${isoLocal}Z`).getTime() - 7 * 3600 * 1000));
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getDefaultWeeks', () => {
  it('returns defaults per curriculum type', () => {
    expect(getDefaultWeeks('pvch')).toBe(18);
    expect(getDefaultWeeks('pvs')).toBe(15);
    expect(getDefaultWeeks('custom')).toBe(18);
  });
});

describe('resolveTargetWeeks', () => {
  it('prefers explicit totalWeeks', () => {
    expect(resolveTargetWeeks({ totalWeeks: 12, curriculumType: 'pvs' })).toBe(12);
  });

  it('falls back to curriculum default when totalWeeks is null/0/undefined', () => {
    expect(resolveTargetWeeks({ totalWeeks: null, curriculumType: 'pvs' })).toBe(15);
    expect(resolveTargetWeeks({ totalWeeks: 0, curriculumType: 'pvs' })).toBe(15);
    expect(resolveTargetWeeks({ curriculumType: 'pvch' })).toBe(18);
  });

  it('defaults to pvch (18) when nothing is provided', () => {
    expect(resolveTargetWeeks({})).toBe(18);
    expect(resolveTargetWeeks({ curriculumType: null })).toBe(18);
  });
});

describe('getSemesterEndDate', () => {
  it('is start + weeks*7 - 1 days and does not mutate input', () => {
    const start = new Date('2026-05-11T00:00:00.000Z');
    const end = getSemesterEndDate(start, 2);
    expect(end.toISOString().split('T')[0]).toBe('2026-05-24');
    expect(start.toISOString()).toBe('2026-05-11T00:00:00.000Z');
  });
});

describe('getWeekNumberForDate', () => {
  const start = new Date('2026-05-11T00:00:00.000Z');

  it('returns 1 on the start date and the last day of week 1', () => {
    expect(getWeekNumberForDate(new Date('2026-05-11'), start, 18)).toBe(1);
    expect(getWeekNumberForDate(new Date('2026-05-17'), start, 18)).toBe(1);
  });

  it('rolls to week 2 after 7 days', () => {
    expect(getWeekNumberForDate(new Date('2026-05-18'), start, 18)).toBe(2);
  });

  it('returns null before start and after the last week', () => {
    expect(getWeekNumberForDate(new Date('2026-05-10'), start, 18)).toBeNull();
    // week 3 begins 2026-05-25 when totalWeeks=2
    expect(getWeekNumberForDate(new Date('2026-05-24'), start, 2)).toBe(2);
    expect(getWeekNumberForDate(new Date('2026-05-25'), start, 2)).toBeNull();
  });
});

describe('getCurrentWeek (Thai timezone)', () => {
  const start = new Date('2026-05-11T00:00:00.000Z');

  it('returns null before start', () => {
    setThaiNow('2026-05-10T12:00:00');
    expect(getCurrentWeek(start, 18)).toBeNull();
  });

  it('returns 1 on the first day', () => {
    setThaiNow('2026-05-11T08:00:00');
    expect(getCurrentWeek(start, 18)).toBe(1);
  });

  it('uses Thai date even when UTC date is still the previous day', () => {
    // 2026-05-10T18:00Z == 2026-05-11 01:00 in Thailand -> week 1
    vi.setSystemTime(new Date('2026-05-10T18:00:00.000Z'));
    expect(getCurrentWeek(start, 18)).toBe(1);
  });

  it('returns null after the last week', () => {
    setThaiNow('2026-05-25T08:00:00'); // first day after 2-week semester
    expect(getCurrentWeek(start, 2)).toBeNull();
    setThaiNow('2026-05-24T08:00:00');
    expect(getCurrentWeek(start, 2)).toBe(2);
  });
});

describe('getWeekDateRanges', () => {
  it('produces totalWeeks contiguous 7-day ranges with a single current week', () => {
    setThaiNow('2026-05-20T08:00:00');
    const weeks = getWeekDateRanges(new Date('2026-05-11T00:00:00.000Z'), 3);
    expect(weeks).toEqual([
      { week: 1, start: '2026-05-11', end: '2026-05-17', isCurrent: false },
      { week: 2, start: '2026-05-18', end: '2026-05-24', isCurrent: true },
      { week: 3, start: '2026-05-25', end: '2026-05-31', isCurrent: false },
    ]);
  });

  it('returns empty array for 0 weeks', () => {
    expect(getWeekDateRanges(new Date('2026-05-11T00:00:00.000Z'), 0)).toEqual([]);
  });
});

describe('resolveCurrentTeachingWeek', () => {
  const startDate = new Date('2026-05-11T00:00:00.000Z'); // Monday

  it('defaults to week 1 with no data at all', () => {
    expect(resolveCurrentTeachingWeek({ totalWeeks: 18 })).toBe(1);
  });

  it('uses calendar week while semester is running', () => {
    setThaiNow('2026-05-20T08:00:00'); // Wednesday of week 2
    expect(resolveCurrentTeachingWeek({ startDate, totalWeeks: 18 })).toBe(2);
  });

  it('returns 1 (min clamp) before the semester starts when nothing else exists', () => {
    setThaiNow('2026-05-01T08:00:00');
    expect(resolveCurrentTeachingWeek({ startDate, totalWeeks: 18 })).toBe(1);
  });

  it('uses attendance dates count before semester starts', () => {
    setThaiNow('2026-05-01T08:00:00');
    expect(
      resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, attendanceDatesCount: 3 })
    ).toBe(3);
  });

  it('ignores attendance dates count once calendar week is positive', () => {
    setThaiNow('2026-05-20T08:00:00'); // week 2
    expect(
      resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, attendanceDatesCount: 10 })
    ).toBe(2);
  });

  it('returns totalWeeks after the semester has ended', () => {
    setThaiNow('2026-12-01T08:00:00');
    expect(resolveCurrentTeachingWeek({ startDate, totalWeeks: 18 })).toBe(18);
  });

  it('highestScoredWeek can push the week beyond the calendar week', () => {
    setThaiNow('2026-05-20T08:00:00'); // week 2
    expect(
      resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, highestScoredWeek: 5 })
    ).toBe(5);
  });

  it('never exceeds totalWeeks', () => {
    expect(
      resolveCurrentTeachingWeek({ totalWeeks: 15, highestScoredWeek: 40 })
    ).toBe(15);
  });

  it('without startDate relies on scores/attendance', () => {
    expect(
      resolveCurrentTeachingWeek({ totalWeeks: 18, attendanceDatesCount: 4 })
    ).toBe(4);
  });

  describe('timetableDays', () => {
    it('steps back one week when today is before the first class day', () => {
      // Wednesday week 2 (dbDay=2), first class day = Thursday (3)
      setThaiNow('2026-05-20T08:00:00');
      expect(
        resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, timetableDays: [3, 4] })
      ).toBe(1);
    });

    it('keeps the current week on/after the first class day', () => {
      setThaiNow('2026-05-21T08:00:00'); // Thursday week 2
      expect(
        resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, timetableDays: [3, 4] })
      ).toBe(2);
    });

    it('treats Sunday as day 6', () => {
      setThaiNow('2026-05-24T08:00:00'); // Sunday of week 2
      expect(
        resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, timetableDays: [6] })
      ).toBe(2);
      expect(
        resolveCurrentTeachingWeek({ startDate, totalWeeks: 18, timetableDays: [0] })
      ).toBe(2);
    });
  });
});

describe('buildSemesterInfo', () => {
  it('returns an inactive empty info when there is no start date', () => {
    expect(buildSemesterInfo(7, { curriculumType: 'pvs' })).toEqual({
      classroomId: 7,
      curriculumType: 'pvs',
      totalWeeks: 15,
      semesterStartDate: null,
      semesterEndDate: null,
      currentWeek: null,
      isSemesterActive: false,
      weeks: [],
    });
  });

  it('computes dates, current week and week list when started', () => {
    setThaiNow('2026-05-12T08:00:00');
    const info = buildSemesterInfo(1, {
      curriculumType: 'custom',
      totalWeeks: 2,
      semesterStartDate: new Date('2026-05-11T00:00:00.000Z'),
    });
    expect(info.semesterStartDate).toBe('2026-05-11');
    expect(info.semesterEndDate).toBe('2026-05-24');
    expect(info.currentWeek).toBe(1);
    expect(info.isSemesterActive).toBe(true);
    expect(info.weeks).toHaveLength(2);
  });
});

describe('isClassroomTeachingActive / isClassroomSemesterEnded', () => {
  const classroom = {
    curriculumType: 'custom',
    totalWeeks: 3,
    semesterStartDate: new Date('2026-05-11T00:00:00.000Z'),
  };

  it('teaching is active with no start date and semester is never "ended"', () => {
    expect(isClassroomTeachingActive({})).toBe(true);
    expect(isClassroomSemesterEnded({})).toBe(false);
  });

  it('is active in regular weeks', () => {
    setThaiNow('2026-05-20T08:00:00');
    expect(isClassroomTeachingActive(classroom, new Date('2026-05-20T01:00:00Z'))).toBe(true);
    expect(isClassroomSemesterEnded(classroom, new Date('2026-05-20T01:00:00Z'))).toBe(false);
  });

  it('is inactive (exam week) in the last week, and the semester counts as ended', () => {
    setThaiNow('2026-05-27T08:00:00'); // week 3 == totalWeeks
    expect(isClassroomTeachingActive(classroom, new Date('2026-05-27T01:00:00Z'))).toBe(false);
    expect(isClassroomSemesterEnded(classroom, new Date('2026-05-27T01:00:00Z'))).toBe(true);
  });

  it('is inactive after the semester ended', () => {
    setThaiNow('2026-08-01T08:00:00');
    expect(isClassroomTeachingActive(classroom, new Date('2026-08-01T01:00:00Z'))).toBe(false);
    expect(isClassroomSemesterEnded(classroom, new Date('2026-08-01T01:00:00Z'))).toBe(true);
  });

  it('is inactive before the semester starts (currentWeek null)', () => {
    setThaiNow('2026-05-01T08:00:00');
    expect(isClassroomTeachingActive(classroom, new Date('2026-05-01T01:00:00Z'))).toBe(false);
  });
});

describe('buildSemesterInfoFromSemester', () => {
  const base: SemesterRecord = {
    id: 1,
    userId: 1,
    name: 'เทอม 1/2569',
    termNumber: 1,
    academicYear: '2569',
    startDate: null,
    endDate: null,
    isActive: true,
    curriculumType: 'pvs',
    totalWeeks: 0,
  };

  it('handles missing startDate, defaulting weeks from curriculum', () => {
    const info = buildSemesterInfoFromSemester(base);
    expect(info).toMatchObject({
      classroomId: 0,
      totalWeeks: 15,
      semesterStartDate: null,
      semesterEndDate: null,
      currentWeek: null,
      isSemesterActive: true, // mirrors semester.isActive when no start date
      weeks: [],
      termNumber: 1,
      academicYear: '2569',
      isActive: true,
    });
  });

  it('uses explicit endDate when startDate is missing', () => {
    const info = buildSemesterInfoFromSemester({
      ...base,
      endDate: new Date('2026-09-30T00:00:00.000Z'),
    });
    expect(info.semesterEndDate).toBe('2026-09-30');
  });

  it('computes derived values when startDate exists', () => {
    setThaiNow('2026-05-12T08:00:00');
    const info = buildSemesterInfoFromSemester({
      ...base,
      startDate: new Date('2026-05-11T00:00:00.000Z'),
      totalWeeks: 2,
    });
    expect(info.semesterStartDate).toBe('2026-05-11');
    expect(info.semesterEndDate).toBe('2026-05-24');
    expect(info.currentWeek).toBe(1);
    expect(info.isSemesterActive).toBe(true);
    expect(info.weeks).toHaveLength(2);
  });
});
