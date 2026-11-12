/**
 * LINE Bot Daily Rate Limiter & Anti-Spam Protection (Database + Memory Hybrid)
 *
 * Enforces:
 * 1. 1 check per day per category (attendance, score, tasks) per student & classroom.
 *    Resets at 00:00 (Midnight) Bangkok Time (UTC+7).
 * 2. Anti-flood debounce: Minimum 5 seconds between consecutive queries per LINE user.
 * 3. Serverless & Multi-Instance Safe: Persists daily quota checks in MySQL (`line_quota_checks`)
 *    with an in-memory fast path on `globalThis` (and optional local file fallback in non-serverless dev).
 */

import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

export type QueryCategory = 'attendance' | 'score' | 'tasks';

export const CATEGORY_LABELS: Record<QueryCategory, string> = {
  attendance: 'ข้อมูลเวลาเรียน/การเข้าเรียน',
  score: 'ข้อมูลคะแนนและเกรด',
  tasks: 'ข้อมูลงานค้างและการบ้าน',
};

export const CATEGORY_COMMANDS: Record<QueryCategory, string> = {
  attendance: '"เข้าเรียน"',
  score: '"คะแนน"',
  tasks: '"งานค้าง"',
};

interface DailyCheckRecord {
  date: string; // YYYY-MM-DD in Bangkok
  timestamp: number; // Unix ms
}

interface RateLimitStore {
  // key: `${lineUserId}:${studentCode}:${classroomId}:${category}` -> DailyCheckRecord
  checks: Record<string, DailyCheckRecord>;
  // key: lineUserId -> last request timestamp ms
  lastRequestByUserId: Record<string, number>;
}

declare global {
  var __lineRateLimitStore: RateLimitStore | undefined;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const PERSISTENT_FILE = path.join(DATA_DIR, 'line-rate-limit.json');
const RAPID_FLOOD_THRESHOLD_MS = 5000; // 5 seconds between rapid requests

function isServerlessEnv(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Returns current date string in Bangkok timezone (YYYY-MM-DD)
 */
export function getBangkokDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats time in Bangkok timezone (HH:mm น.)
 */
export function formatBangkokTime(date: Date = new Date()): string {
  const timeStr = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${timeStr} น.`;
}

/**
 * Initialize or get in-memory singleton store
 */
function getStore(): RateLimitStore {
  if (globalThis.__lineRateLimitStore) {
    return globalThis.__lineRateLimitStore;
  }

  const initialStore: RateLimitStore = {
    checks: {},
    lastRequestByUserId: {},
  };

  // Try loading from local file only in non-serverless environments
  if (!isServerlessEnv()) {
    try {
      if (fs.existsSync(PERSISTENT_FILE)) {
        const raw = fs.readFileSync(PERSISTENT_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          initialStore.checks = parsed.checks || {};
        }
      }
    } catch (err) {
      console.warn('[LineRateLimit] Could not read persistent file, starting fresh:', err);
    }
  }

  globalThis.__lineRateLimitStore = initialStore;
  pruneOldRecords(initialStore);
  return initialStore;
}

let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Persist store to local file in non-serverless environments with debounced writes
 */
function scheduleSave(): void {
  if (isServerlessEnv()) return;
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const store = getStore();
      const payload = JSON.stringify({ checks: store.checks }, null, 2);
      fs.writeFileSync(PERSISTENT_FILE, payload, 'utf-8');
    } catch (err) {
      console.error('[LineRateLimit] Failed to persist rate limit store:', err);
    }
  }, 1000);
}

/**
 * Prune records older than 48 hours
 */
function pruneOldRecords(store: RateLimitStore): void {
  const today = getBangkokDateStr();
  const keys = Object.keys(store.checks);
  let changed = false;

  for (const k of keys) {
    const record = store.checks[k];
    if (!record) continue;
    if (record.date < today) {
      const diffMs = Date.now() - record.timestamp;
      if (diffMs > 48 * 60 * 60 * 1000) {
        delete store.checks[k];
        changed = true;
      }
    }
  }

  if (changed) scheduleSave();
}

/**
 * Build composite storage key
 */
function buildKey(
  lineUserId: string,
  studentCode: string,
  classroomId: number | null | undefined,
  category: QueryCategory
): string {
  const cId = classroomId ?? '0';
  return `${lineUserId}:${studentCode}:${cId}:${category}`;
}

export interface CheckRateLimitParams {
  lineUserId: string;
  studentCode: string;
  classroomId?: number | null;
  category: QueryCategory;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'rapid_flood' | 'daily_limit';
  message?: string;
  lastCheckedAt?: Date;
  categoryLabel: string;
}

/**
 * Hydrates a user's today quota checks from MySQL into the in-memory store.
 * Ensures multi-instance / serverless accuracy even after cold starts.
 */
async function hydrateUserChecksFromDb(
  lineUserId: string,
  studentCode: string,
  classroomId?: number | null
): Promise<void> {
  try {
    const today = getBangkokDateStr();
    const numericClassroomId = classroomId ?? 0;
    const rows = await prisma.lineQuotaCheck.findMany({
      where: {
        lineUserId,
        studentCode,
        classroomId: numericClassroomId,
        checkDate: today,
      },
    });

    const store = getStore();
    for (const r of rows) {
      const cat = r.category as QueryCategory;
      if (cat === 'attendance' || cat === 'score' || cat === 'tasks') {
        const key = buildKey(lineUserId, studentCode, classroomId, cat);
        store.checks[key] = {
          date: r.checkDate,
          timestamp: r.checkedAt.getTime(),
        };
      }
    }
  } catch (err) {
    // Graceful degradation to in-memory store if DB table is temporarily unreachable
    console.warn('[LineRateLimit] DB hydration fallback to memory:', err);
  }
}

/**
 * Check if the user is allowed to perform this query right now (Synchronous In-Memory check)
 */
export function checkRateLimit({
  lineUserId,
  studentCode,
  classroomId,
  category,
}: CheckRateLimitParams): RateLimitResult {
  const store = getStore();
  const categoryLabel = CATEGORY_LABELS[category];
  const now = Date.now();

  // 1. Anti-flood check (rapid queries within 5 seconds)
  const lastUserReq = store.lastRequestByUserId[lineUserId] || 0;
  if (now - lastUserReq < RAPID_FLOOD_THRESHOLD_MS) {
    const waitSec = Math.ceil((RAPID_FLOOD_THRESHOLD_MS - (now - lastUserReq)) / 1000);
    return {
      allowed: false,
      reason: 'rapid_flood',
      categoryLabel,
      message: `⏱️ ระบบกำลังประมวลผล กรุณารอ ${waitSec} วินาทีก่อนส่งคำสั่งใหม่อีกครั้งครับ`,
    };
  }

  // 2. Daily limit check (1 check per day)
  const today = getBangkokDateStr();
  const key = buildKey(lineUserId, studentCode, classroomId, category);
  const existing = store.checks[key];

  if (existing && existing.date === today) {
    const lastCheckedDate = new Date(existing.timestamp);
    const timeFormatted = formatBangkokTime(lastCheckedDate);

    // Find other categories that are still available today
    const remainingCategories: QueryCategory[] = [];
    const allCategories: QueryCategory[] = ['attendance', 'score', 'tasks'];
    for (const cat of allCategories) {
      if (cat === category) continue;
      const otherKey = buildKey(lineUserId, studentCode, classroomId, cat);
      const otherRecord = store.checks[otherKey];
      if (!otherRecord || otherRecord.date !== today) {
        remainingCategories.push(cat);
      }
    }

    let hint = '';
    if (remainingCategories.length > 0) {
      const commandsList = remainingCategories.map((c) => CATEGORY_COMMANDS[c]).join(' หรือ ');
      hint = `\n\n💡 ในวันนี้คุณยังสามารถพิมพ์ ${commandsList} เพื่อดูข้อมูลส่วนอื่นได้อีกประเภทละ 1 ครั้งครับ`;
    }

    const message =
      `⚠️ คุณได้ตรวจสอบ${categoryLabel}ของวันนี้ไปแล้วครับ\n\n` +
      `🕒 ตรวจสอบล่าสุดเมื่อ: วันนี้ เวลา ${timeFormatted}\n` +
      `📌 ระบบจำกัดการตรวจสอบ 1 ครั้งต่อวัน เพื่อป้องกันการเช็คข้อมูลซ้ำซ้อน\n` +
      `📅 สามารถตรวจสอบใหม่อีกครั้งได้ในวันพรุ่งนี้ครับ` +
      hint;

    return {
      allowed: false,
      reason: 'daily_limit',
      lastCheckedAt: lastCheckedDate,
      categoryLabel,
      message,
    };
  }

  return {
    allowed: true,
    categoryLabel,
  };
}

/**
 * Serverless & Multi-Instance safe async rate limit check (syncs from MySQL when memory misses).
 */
export async function checkRateLimitAsync(params: CheckRateLimitParams): Promise<RateLimitResult> {
  const fastResult = checkRateLimit(params);
  if (!fastResult.allowed) {
    return fastResult;
  }

  await hydrateUserChecksFromDb(params.lineUserId, params.studentCode, params.classroomId);
  return checkRateLimit(params);
}

/**
 * Persist a successful query to MySQL (`line_quota_checks`).
 */
async function persistQueryToDb({
  lineUserId,
  studentCode,
  classroomId,
  category,
}: CheckRateLimitParams, checkDate: string, checkedAt: Date): Promise<void> {
  const numericClassroomId = classroomId ?? 0;
  try {
    await prisma.lineQuotaCheck.upsert({
      where: {
        lineUserId_studentCode_classroomId_category: {
          lineUserId,
          studentCode,
          classroomId: numericClassroomId,
          category,
        },
      },
      update: {
        checkDate,
        checkedAt,
      },
      create: {
        lineUserId,
        studentCode,
        classroomId: numericClassroomId,
        category,
        checkDate,
        checkedAt,
      },
    });
  } catch (err) {
    console.warn('[LineRateLimit] Failed to persist quota check to DB:', err);
  }
}

/**
 * Record a successfully answered query (updates memory + triggers async DB & file persistence)
 */
export function recordSuccessfulQuery(params: CheckRateLimitParams): void {
  const { lineUserId, studentCode, classroomId, category } = params;
  const store = getStore();
  const now = Date.now();
  const today = getBangkokDateStr();
  const key = buildKey(lineUserId, studentCode, classroomId, category);

  store.checks[key] = {
    date: today,
    timestamp: now,
  };
  store.lastRequestByUserId[lineUserId] = now;

  scheduleSave();
  void persistQueryToDb(params, today, new Date(now));
}

/**
 * Record a successfully answered query and await DB persistence (ideal for Serverless Functions)
 */
export async function recordSuccessfulQueryAsync(params: CheckRateLimitParams): Promise<void> {
  const { lineUserId, studentCode, classroomId, category } = params;
  const store = getStore();
  const now = Date.now();
  const today = getBangkokDateStr();
  const key = buildKey(lineUserId, studentCode, classroomId, category);

  store.checks[key] = {
    date: today,
    timestamp: now,
  };
  store.lastRequestByUserId[lineUserId] = now;

  scheduleSave();
  await persistQueryToDb(params, today, new Date(now));
}

/**
 * Update user's last request time (for anti-flood on any recognized command)
 */
export function recordUserActivity(lineUserId: string): void {
  const store = getStore();
  store.lastRequestByUserId[lineUserId] = Date.now();
}

/**
 * Get daily query quota summary for student (Synchronous)
 */
export function getDailyQuotaStatus(
  lineUserId: string,
  studentCode: string,
  classroomId?: number | null
): string {
  const store = getStore();
  const today = getBangkokDateStr();
  const allCategories: QueryCategory[] = ['attendance', 'score', 'tasks'];

  const lines = allCategories.map((cat) => {
    const key = buildKey(lineUserId, studentCode, classroomId, cat);
    const record = store.checks[key];
    const isUsed = record && record.date === today;
    if (isUsed) {
      const timeStr = formatBangkokTime(new Date(record.timestamp));
      return `✅ ${CATEGORY_LABELS[cat]}: เช็คแล้วเมื่อ ${timeStr} (ครบ 1 ครั้ง)`;
    }
    return `⚪ ${CATEGORY_LABELS[cat]}: ยังไม่ได้ตรวจสอบ (พิมพ์ ${CATEGORY_COMMANDS[cat]})`;
  });

  return (
    `📊 สิทธิ์การตรวจสอบข้อมูลประจำวันนี้ (${today})\n\n` +
    lines.join('\n') +
    `\n\n📌 ระบบจำกัดการตรวจสอบประเภทละ 1 ครั้งต่อวัน เพื่อป้องกันการส่งข้อมูลซ้ำซ้อน`
  );
}

/**
 * Get daily query quota summary for student (Serverless/Multi-instance safe async version)
 */
export async function getDailyQuotaStatusAsync(
  lineUserId: string,
  studentCode: string,
  classroomId?: number | null
): Promise<string> {
  await hydrateUserChecksFromDb(lineUserId, studentCode, classroomId);
  return getDailyQuotaStatus(lineUserId, studentCode, classroomId);
}
