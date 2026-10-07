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
