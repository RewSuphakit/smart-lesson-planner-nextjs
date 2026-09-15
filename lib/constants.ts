/**
 * Shared period time mapping for the timetable system.
 * Maps period numbers (0-12) to their start/end times.
 * Period 0 is homeroom (07:30-08:00), periods 1-12 are regular class hours.
 * Note: There's a lunch break gap between period 4 (11:00-12:00) and period 5 (13:00-14:00).
 */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  0:  { start: '07:30', end: '08:00' },
  1:  { start: '08:00', end: '09:00' },
  2:  { start: '09:00', end: '10:00' },
  3:  { start: '10:00', end: '11:00' },
  4:  { start: '11:00', end: '12:00' },
  5:  { start: '13:00', end: '14:00' },
  6:  { start: '14:00', end: '15:00' },
  7:  { start: '15:00', end: '16:00' },
  8:  { start: '16:00', end: '17:00' },
  9:  { start: '17:00', end: '18:00' },
  10: { start: '18:00', end: '19:00' },
  11: { start: '19:00', end: '20:00' },
  12: { start: '20:00', end: '21:00' },
};

/**
 * Safely parse a time string (e.g. '08:00', '08:00:00', '1970-01-01T08:00:00.000Z')
 * into a valid Date object in UTC representation for MySQL TIME(0) fields.
 */
export function parseTimeToUtc(timeStr?: string | null): Date | null {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  if (!clean) return null;

  if (clean.includes('T')) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  // Strip trailing Z if present
  const withoutZ = clean.replace(/Z$/i, '');
  const parts = withoutZ.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  const [sec, ms = '000'] = ss.split('.');

  const dateStr = `1970-01-01T${hh}:${mm}:${sec.padStart(2, '0')}.${ms.padEnd(3, '0').slice(0, 3)}Z`;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
