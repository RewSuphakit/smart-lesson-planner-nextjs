import { describe, it, expect } from 'vitest';
import { sanitizeScore, sanitizeExamScore } from '@/lib/sanitize';

describe('sanitizeScore', () => {
  it.each([undefined, null, ''])('returns null for empty value %p', (v) => {
    expect(sanitizeScore(v)).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(sanitizeScore('abc')).toBeNull();
    expect(sanitizeScore(NaN)).toBeNull();
  });

  it('parses numeric strings and numbers', () => {
    expect(sanitizeScore('12.5')).toBe(12.5);
    expect(sanitizeScore(7)).toBe(7);
    expect(sanitizeScore(0)).toBe(0);
    expect(sanitizeScore('0')).toBe(0);
  });

  it('clamps to [0, 999.99]', () => {
    expect(sanitizeScore(-1)).toBe(0);
    expect(sanitizeScore(1000)).toBe(999.99);
    expect(sanitizeScore(999.99)).toBe(999.99);
  });
});

describe('sanitizeExamScore', () => {
  it.each([undefined, null, ''])('returns null for empty value %p', (v) => {
    expect(sanitizeExamScore(v)).toBeNull();
    expect(sanitizeExamScore(v, true)).toBeNull();
  });

  it('returns null for NaN-like input', () => {
    expect(sanitizeExamScore('x')).toBeNull();
  });

  it('clamps negative special codes to 0 when not allowed', () => {
    expect(sanitizeExamScore(-1)).toBe(0);
    expect(sanitizeExamScore(-2)).toBe(0);
  });

  it('preserves -1 and -2 when allowSpecialCodes is true', () => {
    expect(sanitizeExamScore(-1, true)).toBe(-1);
    expect(sanitizeExamScore('-2', true)).toBe(-2);
  });

  it('still clamps other negatives and large values with special codes enabled', () => {
    expect(sanitizeExamScore(-3, true)).toBe(0);
    expect(sanitizeExamScore(5000, true)).toBe(999.99);
  });

  it('passes through valid scores', () => {
    expect(sanitizeExamScore('45.5')).toBe(45.5);
  });
});
