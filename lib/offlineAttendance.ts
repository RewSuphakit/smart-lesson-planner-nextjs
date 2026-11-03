/**
 * Offline Attendance Engine — ระบบจัดการข้อมูลการเช็คชื่อแบบออฟไลน์
 * รองรับการบันทึกข้อมูลลงเครื่องอัตโนมัติเมื่อเน็ตหลุด และซิงค์ขึ้นเซิร์ฟเวอร์ทันทีที่ต่อเน็ตได้
 */

export interface OfflineAttendanceRecord {
  id: string; // Unique key: `${studentId}_${classroomId}_${date}`
  studentId: number;
  classroomId: number;
  date: string; // YYYY-MM-DD
  status: string; // 'present' | 'late' | 'absent' | 'leave'
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'smart_planner_offline_attendance_queue';
const ROSTER_CACHE_PREFIX = 'smart_planner_roster_';
const ATT_STATE_CACHE_PREFIX = 'smart_planner_att_state_';

// Dispatch custom event to notify components when queue changes
function notifyQueueUpdated(count: number) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-attendance-queue-changed', {
      detail: { count }
    }));
  }
}

/**
 * ดึงรายการเช็คชื่อที่ค้างอยู่ในคิวออฟไลน์
 */
export function getOfflinePendingQueue(): OfflineAttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[OfflineAttendance] Failed to read queue:', err);
    return [];
  }
}

/**
 * เพิ่มหรืออัปเดตการเช็คชื่อในคิวออฟไลน์
 */
export function enqueueOfflineAttendance(record: {
  studentId: number;
  classroomId: number;
  date: string;
  status: string;
}): void {
  if (typeof window === 'undefined') return;

  const queue = getOfflinePendingQueue();
  const id = `${record.studentId}_${record.classroomId}_${record.date}`;

  // หากมีรายการของนักเรียนคนนี้ในวันเดียวกันอยู่แล้ว ให้อัปเดตสถานะล่าสุดแทน
  const existingIdx = queue.findIndex(item => item.id === id);
  const newEntry: OfflineAttendanceRecord = {
    id,
    studentId: record.studentId,
    classroomId: record.classroomId,
    date: record.date,
    status: record.status,
    timestamp: Date.now(),
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = newEntry;
  } else {
    queue.push(newEntry);
  }

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifyQueueUpdated(queue.length);
  } catch (err) {
    console.error('[OfflineAttendance] Failed to write queue:', err);
  }
}

/**
 * เพิ่มข้อมูลหลายรายการพร้อมกันในคิวออฟไลน์ (เช่น บันทึกทั้งห้อง)
 */
export function enqueueBatchOfflineAttendance(records: {
  studentId: number;
  classroomId: number;
  date: string;
  status: string;
}[]): void {
  if (typeof window === 'undefined' || records.length === 0) return;

  const queue = getOfflinePendingQueue();
  const map = new Map<string, OfflineAttendanceRecord>();

  // ใส่ของเดิมลง Map
  queue.forEach(item => map.set(item.id, item));

  // อัปเดต/เพิ่มของใหม่
  records.forEach(r => {
    const id = `${r.studentId}_${r.classroomId}_${r.date}`;
    map.set(id, {
      id,
      studentId: r.studentId,
      classroomId: r.classroomId,
      date: r.date,
      status: r.status,
      timestamp: Date.now(),
    });
  });

  const updatedQueue = Array.from(map.values());
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
    notifyQueueUpdated(updatedQueue.length);
  } catch (err) {
    console.error('[OfflineAttendance] Failed to batch write queue:', err);
  }
}

/**
 * ลบรายการออกจากคิวหลังจากซิงค์สำเร็จ
 */
export function dequeueOfflineAttendance(idsToRemove: string[]): void {
  if (typeof window === 'undefined') return;

  const queue = getOfflinePendingQueue();
  const set = new Set(idsToRemove);
  const remaining = queue.filter(item => !set.has(item.id));

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    notifyQueueUpdated(remaining.length);
  } catch (err) {
    console.error('[OfflineAttendance] Failed to update queue:', err);
  }
}

/**
 * เคลียร์คิวออฟไลน์ทั้งหมด
 */
export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    notifyQueueUpdated(0);
  } catch (err) {
    console.error('[OfflineAttendance] Failed to clear queue:', err);
  }
}

/**
 * ล้างข้อมูลแคชการเช็คชื่อ รายชื่อนักเรียน และคิวออฟไลน์ทั้งหมดในเครื่อง (เช่น ตอนออกจากระบบ)
 */
export function clearAllAttendanceCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(ROSTER_CACHE_PREFIX) ||
        key.startsWith(ATT_STATE_CACHE_PREFIX) ||
        key === QUEUE_STORAGE_KEY ||
        key === 'attendance_autosave'
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    notifyQueueUpdated(0);
  } catch (err) {
    console.error('[OfflineAttendance] Failed to clear all attendance caches:', err);
  }
}

/**
 * แคชรายชื่อนักเรียนในห้องเรียนไว้ในเครื่อง (เพื่อให้เปิดดูได้แม้ออฟไลน์)
 */
export function cacheClassroomRoster(classroomId: string | number, students: unknown[]): void {
  if (typeof window === 'undefined' || !classroomId) return;
  try {
    const key = `${ROSTER_CACHE_PREFIX}${classroomId}`;
    localStorage.setItem(key, JSON.stringify({
      classroomId,
      students,
      cachedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('[OfflineAttendance] LocalStorage quota exceeded or error:', err);
  }
}

/**
 * ดึงรายชื่อนักเรียนที่แคชไว้ในเครื่อง
 */
export function getCachedClassroomRoster<T = unknown>(classroomId: string | number): T[] | null {
  if (typeof window === 'undefined' || !classroomId) return null;
  try {
    const key = `${ROSTER_CACHE_PREFIX}${classroomId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.students) ? (parsed.students as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * แคชสถานะการเช็คชื่อของห้องในวันนั้นๆ
 */
export function cacheAttendanceState(
  classroomId: string | number,
  date: string,
  state: Record<string | number, string>
): void {
  if (typeof window === 'undefined' || !classroomId || !date) return;
  try {
    const key = `${ATT_STATE_CACHE_PREFIX}${classroomId}_${date}`;
    localStorage.setItem(key, JSON.stringify({
      state,
      cachedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('[OfflineAttendance] Failed to cache state:', err);
  }
}

/**
 * ดึงสถานะการเช็คชื่อที่แคชไว้
 */
export function getCachedAttendanceState(
  classroomId: string | number,
  date: string
): Record<string | number, string> | null {
  if (typeof window === 'undefined' || !classroomId || !date) return null;
  try {
    const key = `${ATT_STATE_CACHE_PREFIX}${classroomId}_${date}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state || null;
  } catch {
    return null;
  }
}

/**
 * ซิงค์รายการค้างในคิวขึ้นเซิร์ฟเวอร์
 */
export async function syncOfflineAttendance(
  apiInstance: { post: (url: string, data: unknown) => Promise<unknown> }
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  const queue = getOfflinePendingQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  // แปลงรูปแบบให้ตรงกับ API POST /api/attendance
  const records = queue.map(item => ({
    student_id: item.studentId,
    classroom_id: item.classroomId,
    date: item.date,
    status: item.status,
  }));

  try {
    await apiInstance.post('/attendance', { records });
    const syncedCount = queue.length;
    // ซิงค์สำเร็จ ลบออกจากคิว
    dequeueOfflineAttendance(queue.map(q => q.id));
    return { success: true, syncedCount };
  } catch (err: unknown) {
    const errorMsg = (err as { message?: string })?.message || 'ซิงค์ข้อมูลไม่สำเร็จ';
    console.error('[OfflineAttendance] Sync failed:', err);
    return { success: false, syncedCount: 0, error: errorMsg };
  }
}

