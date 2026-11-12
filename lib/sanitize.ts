/**
 * Shared score sanitization utilities.
 *
 * Centralizes score value normalization logic used across
 * score and student API routes.
 */

/**
 * Sanitize a score value: converts empty/null to null,
 * validates numbers, and clamps between 0 and 999.99.
 */
export function sanitizeScore(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  return Math.min(999.99, Math.max(0, num));
}

/**
 * Sanitize an exam score value: converts empty/null to null,
 * validates numbers, and clamps between 0 and 999.99.
 * Optionally allows special vocational education status codes:
 * -1 = ข.ส. (ขาดสอบ), -2 = ม.ส. (ไม่สมบูรณ์)
 */
export function sanitizeExamScore(val: unknown, allowSpecialCodes = false): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  if (allowSpecialCodes && (num === -1 || num === -2)) {
    return num;
  }
  return Math.min(999.99, Math.max(0, num));
}

export type SanitizedExamStatus = 'normal' | 'absent_final' | 'incomplete';

/**
 * Separates final exam score from special vocational exam statuses (`absent_final` / ข.ส., `incomplete` / ม.ส.)
 * so negative sentinel numbers are never stored in the numeric `final_score` column while preserving
 * full backward compatibility with callers sending `-1` or `-2`.
 */
export function sanitizeFinalExamPayload(
  finalScoreVal: unknown,
  examStatusVal?: unknown,
  maxScore = 999.99
): { finalScore: number | null; examStatus: SanitizedExamStatus } {
  if (examStatusVal === 'absent_final') {
    return { finalScore: 0, examStatus: 'absent_final' };
  }
  if (examStatusVal === 'incomplete') {
    return { finalScore: 0, examStatus: 'incomplete' };
  }

  if (finalScoreVal === undefined || finalScoreVal === null || finalScoreVal === '') {
    return { finalScore: null, examStatus: 'normal' };
  }

  const num = Number(finalScoreVal);
  if (isNaN(num)) {
    return { finalScore: null, examStatus: 'normal' };
  }

  if (num === -1) {
    return { finalScore: 0, examStatus: 'absent_final' };
  }
  if (num === -2) {
    return { finalScore: 0, examStatus: 'incomplete' };
  }

  return {
    finalScore: Math.min(maxScore, Math.max(0, num)),
    examStatus: 'normal',
  };
}
