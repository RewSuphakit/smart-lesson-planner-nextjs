export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'government' | 'weekend';
}

// Fixed Thai Holidays (MM-DD)
const FIXED_THAI_HOLIDAYS: Record<string, string> = {
  '01-01': 'วันขึ้นปีใหม่',
  '04-06': 'วันจักรี',
  '04-13': 'วันสงกรานต์',
  '04-14': 'วันสงกรานต์',
  '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ',
  '05-04': 'วันฉัตรมงคล',
  '06-03': 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '07-28': 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว',
  '08-12': 'วันแม่แห่งชาติ (วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง)',
  '10-13': 'วันนวมินทรมหาราช (วันคล้ายวันสวรรคต ร.9)',
  '10-23': 'วันปิยมหาราช',
  '12-05': 'วันพ่อแห่งชาติ (วันคล้ายวันพระบรมราชสมภพ ร.9)',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-31': 'วันสิ้นปี',
};

// Variable Lunar / Royal Holidays (YYYY-MM-DD)
const VARIABLE_THAI_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-02-24': 'วันมาฆบูชา',
  '2024-02-26': 'ชดเชยวันมาฆบูชา',
  '2024-05-22': 'วันวิสาขบูชา',
  '2024-07-20': 'วันอาสาฬหบูชา',
  '2024-07-21': 'วันเข้าพรรษา',
  '2024-07-22': 'ชดเชยวันอาสาฬหบูชา',

  // 2025
  '2025-02-12': 'วันมาฆบูชา',
  '2025-05-11': 'วันวิสาขบูชา',
  '2025-05-12': 'ชดเชยวันวิสาขบูชา',
  '2025-07-10': 'วันอาสาฬหบูชา',
  '2025-07-11': 'วันเข้าพรรษา',

  // 2026
  '2026-03-03': 'วันมาฆบูชา',
  '2026-05-31': 'วันวิสาขบูชา',
  '2026-06-01': 'ชดเชยวันวิสาขบูชา',
  '2026-07-29': 'วันอาสาฬหบูชา',
  '2026-07-30': 'วันเข้าพรรษา',

  // 2027
  '2027-02-21': 'วันมาฆบูชา',
  '2027-05-20': 'วันวิสาขบูชา',
  '2027-07-18': 'วันอาสาฬหบูชา',
  '2027-07-19': 'วันเข้าพรรษา',
};

// In-memory caches to avoid repeated Date allocations and range loops during table renders
const singleDateHolidayCache = new Map<string, HolidayInfo | null>();
const rangeHolidayCache = new Map<string, HolidayInfo[]>();

/**
 * Helper to check a specific date string (YYYY-MM-DD) in O(1) after first lookup.
 */
export function checkThaiHoliday(dateStr: string): HolidayInfo | null {
  if (!dateStr) return null;
  if (singleDateHolidayCache.has(dateStr)) {
    return singleDateHolidayCache.get(dateStr)!;
  }

  let info: HolidayInfo | null = null;
  const mmdd = dateStr.length >= 10 ? dateStr.slice(5, 10) : '';
  const govHolidayName = VARIABLE_THAI_HOLIDAYS[dateStr] || FIXED_THAI_HOLIDAYS[mmdd];

  if (govHolidayName) {
    info = {
      date: dateStr,
      name: govHolidayName,
      type: 'government',
    };
  } else {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        info = {
          date: dateStr,
          name: dayOfWeek === 6 ? 'วันเสาร์' : 'วันอาทิตย์',
          type: 'weekend',
        };
      }
    }
  }

  if (singleDateHolidayCache.size > 2000) {
    singleDateHolidayCache.clear();
  }
  singleDateHolidayCache.set(dateStr, info);
  return info;
}

/**
 * Returns all holidays (government and weekend) within the given date range [startDateStr, endDateStr]
 */
export function getThaiHolidays(startDateStr: string, endDateStr: string): HolidayInfo[] {
  if (!startDateStr || !endDateStr) return [];
  const cacheKey = `${startDateStr}_${endDateStr}`;
  const cached = rangeHolidayCache.get(cacheKey);
  if (cached) return cached;

  const result: HolidayInfo[] = [];

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return result;
  }

  // Normalize time to midnight UTC/local comparison
  const curr = new Date(start);
  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const info = checkThaiHoliday(dateStr);
    if (info) {
      result.push(info);
    }

    curr.setDate(curr.getDate() + 1);
  }

  if (rangeHolidayCache.size > 200) {
    rangeHolidayCache.clear();
  }
  rangeHolidayCache.set(cacheKey, result);
  return result;
}
