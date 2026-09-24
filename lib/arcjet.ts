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
 * Dedicated rate limiter for authentication routes (login / register)
 * Protects against brute-force attacks: max 30 requests per 10 minutes per IP
 * (Prevents blocking multiple teachers sharing the same school public IP/NAT)
 */
export const authLimiter = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: 'LIVE' }),
        slidingWindow({
          mode: 'LIVE',
          interval: '10m',
          max: 30,
        }),
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

/**
 * Utility helper to protect any Next.js API route handler with Arcjet.
 * Gracefully degrades if ARCJET_KEY is not configured in the environment.
 */
export async function protectRequest(
  request: NextRequest,
  limiterInstance: typeof aj | typeof authLimiter | typeof aiLimiter | typeof portalLimiter = aj,
  options?: ProtectOptions
): Promise<{ allowed: boolean; response?: NextResponse }> {
  if (!limiterInstance || !arcjetKey) {
    return { allowed: true };
  }

  // ในโหมด Development (localhost) ข้ามการจำกัด Rate Limit เพื่อไม่ให้ติดบล็อกขณะพัฒนาและทดสอบระบบ
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true };
  }

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
    console.warn('[Arcjet Protection Warning]: Request check bypassed due to error:', error);
    return { allowed: true };
  }
}

export default aj;
