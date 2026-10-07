import arcjet, { shield, detectBot, slidingWindow } from '@arcjet/next';
import { NextRequest, NextResponse } from 'next/server';

const arcjetKey = process.env.ARCJET_KEY;

/**
 * Base Arcjet instance for general API protection (Shield + Bot detection)
 */
export const aj = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: 'LIVE' }),
        detectBot({
          mode: 'LIVE',
          allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'],
        }),
      ],
    })
  : null;

/**
 * Dedicated security guard for authentication routes (login / register)
 * Uses Arcjet Shield for attack protection; bot & brute-force defense is handled by Cloudflare Turnstile
 */
export const authLimiter = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: 'LIVE' }),
      ],
    })
  : null;

/**
 * Dedicated rate limiter for AI-heavy operations (e.g. Gemini Timetable OCR / Generation)
 * Protects API token quota: max 15 requests per 1 hour per IP/user
 */
export const aiLimiter = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: 'LIVE' }),
        detectBot({
          mode: 'LIVE',
          allow: [],
        }),
        slidingWindow({
          mode: 'LIVE',
          interval: '1h',
          max: 15,
        }),
      ],
    })
  : null;
/**
 * Dedicated rate limiter for public Student Portal search
 * Protects against automated student ID scraping / enumeration: max 25 requests per 5 minutes per IP
 */
export const portalLimiter = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: 'LIVE' }),
        detectBot({
          mode: 'LIVE',
          allow: [],
        }),
        slidingWindow({
          mode: 'LIVE',
          interval: '5m',
          max: 25,
        }),
      ],
    })
  : null;

export interface ProtectOptions {
  requested?: number;
  userId?: string;
}

// In-memory sliding rate limiting fallback for self-hosted / environments without ARCJET_KEY
interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  // Periodic cleanup if map grows too large (> 5,000 entries)
  if (memoryStore.size > 5000) {
    for (const [k, v] of memoryStore.entries()) {
      if (now > v.resetAt) {
        memoryStore.delete(k);
      }
    }
  }

  if (!bucket || now > bucket.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Utility helper to protect any Next.js API route handler with Arcjet.
 * Gracefully degrades to an in-memory sliding window rate limiter if ARCJET_KEY is not configured.
 */
export async function protectRequest(
  request: NextRequest,
  limiterInstance: typeof aj | typeof authLimiter | typeof aiLimiter | typeof portalLimiter = aj,
  options?: ProtectOptions
): Promise<{ allowed: boolean; response?: NextResponse }> {
  // ในโหมด Development (localhost) ข้ามการจำกัด Rate Limit เพื่อไม่ให้ติดบล็อกขณะพัฒนาและทดสอบระบบ
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true };
  }

  if (limiterInstance && arcjetKey) {
    try {
      const decision = await limiterInstance.protect(request, options);

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return {
            allowed: false,
            response: NextResponse.json(
              {
                message: 'มีการส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง (Rate limit exceeded)',
                retryAfter: decision.reason.resetTime,
              },
              { status: 429 }
            ),
          };
        }

        if (decision.reason.isBot()) {
          return {
            allowed: false,
            response: NextResponse.json(
              { message: 'การเข้าถึงถูกปฏิเสธ: ตรวจพบบอทหรือการทำงานอัตโนมัติ (Automated bot traffic blocked)' },
              { status: 403 }
            ),
          };
        }

        if (decision.reason.isShield()) {
          return {
            allowed: false,
            response: NextResponse.json(
              { message: 'การเข้าถึงถูกปฏิเสธ: ตรวจพบรูปแบบคำขอที่ไม่ปลอดภัย (Security Shield blocked)' },
              { status: 403 }
            ),
          };
        }

        return {
          allowed: false,
          response: NextResponse.json(
            { message: 'การเข้าถึงถูกปฏิเสธตามนโยบายความปลอดภัย (Access denied by security policy)' },
            { status: 403 }
          ),
        };
      }

      return { allowed: true };
    } catch (error) {
      console.warn('[Arcjet Protection Warning]: Arcjet check failed, falling back to memory rate limiter:', error);
    }
  }

  // In-memory fallback rate limiting
  const ip = getClientIp(request);
  const identifier = options?.userId ? `user:${options.userId}` : `ip:${ip}`;

  let maxRequests = 120;
  let windowMs = 60 * 1000; // 1 min

  if (limiterInstance === aiLimiter) {
    maxRequests = 20;
    windowMs = 60 * 60 * 1000; // 1 hr
  } else if (limiterInstance === portalLimiter) {
    maxRequests = 30;
    windowMs = 5 * 60 * 1000; // 5 mins
  } else if (limiterInstance === authLimiter) {
    maxRequests = 30;
    windowMs = 60 * 1000; // 1 min
  }

  const memoryResult = checkMemoryRateLimit(`${identifier}:${maxRequests}`, maxRequests, windowMs);
  if (!memoryResult.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          message: 'มีการส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง (Rate limit exceeded)',
          retryAfter: new Date(Date.now() + memoryResult.retryAfterSeconds * 1000).toISOString(),
        },
        { status: 429 }
      ),
    };
  }

  return { allowed: true };
}

export default aj;
