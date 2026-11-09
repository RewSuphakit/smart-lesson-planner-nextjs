import { describe, it, expect } from 'vitest';
import { calculateAffectiveScore } from '@/lib/affective';

describe('calculateAffectiveScore', () => {
  it('returns full weight (default 20) when no absences/lates and no base score', () => {
    expect(calculateAffectiveScore({ absentCount: 0, lateCount: 0 })).toBe(20);
  });

  it('deducts 2 per absence and 1 per late by default', () => {
    expect(calculateAffectiveScore({ absentCount: 3, lateCount: 4 })).toBe(20 - 6 - 4);
  });

  it('uses custom maxWeight and deductions', () => {
    expect(
      calculateAffectiveScore({
        maxWeight: 10,
        absentCount: 1,
        lateCount: 2,
        absentDeduction: 3,
        lateDeduction: 0.5,
      })
    ).toBe(10 - 3 - 1);
  });

  it('never goes below 0', () => {
    expect(calculateAffectiveScore({ absentCount: 100, lateCount: 100 })).toBe(0);
  });

  it('respects an explicit base score and ignores attendance penalty', () => {
    expect(calculateAffectiveScore({ baseScore: 15, absentCount: 10, lateCount: 10 })).toBe(15);
  });

  it('keeps an explicit base score of 0 (does not treat as missing)', () => {
    expect(calculateAffectiveScore({ baseScore: 0, absentCount: 0, lateCount: 0 })).toBe(0);
  });

  it('clamps base score to [0, maxWeight]', () => {
    expect(calculateAffectiveScore({ baseScore: 50, absentCount: 0, lateCount: 0 })).toBe(20);
    expect(calculateAffectiveScore({ baseScore: -5, absentCount: 0, lateCount: 0 })).toBe(0);
    expect(calculateAffectiveScore({ baseScore: 12, maxWeight: 10, absentCount: 0, lateCount: 0 })).toBe(10);
  });

  it('falls back to attendance calculation when baseScore is null or NaN', () => {
    expect(calculateAffectiveScore({ baseScore: null, absentCount: 1, lateCount: 0 })).toBe(18);
    expect(calculateAffectiveScore({ baseScore: NaN, absentCount: 1, lateCount: 0 })).toBe(18);
  });

  it('falls back to 20 when maxWeight is 0 or NaN-like', () => {
    expect(calculateAffectiveScore({ maxWeight: 0, absentCount: 0, lateCount: 0 })).toBe(20);
  });

  it('allows zero deductions explicitly', () => {
    expect(
      calculateAffectiveScore({ absentCount: 5, lateCount: 5, absentDeduction: 0, lateDeduction: 0 })
    ).toBe(20);
  });
});
