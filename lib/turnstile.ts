interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Helper to call Cloudflare Turnstile canonical siteverify API
 */
async function verifyWithSecret(
  token: string,
  secretKey: string,
  clientIp?: string | null,
  expectedAction?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`siteverify HTTP ${response.status}`);
    }

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      console.warn('[Turnstile Verification Failed]:', data['error-codes']);
      return { success: false, error: 'การตรวจสอบความปลอดภัยไม่ผ่าน กรุณาลองใหม่อีกครั้ง' };
    }

    // Canonical action check if action was specified
    if (expectedAction && data.action && data.action !== expectedAction) {
      console.warn(`[Turnstile Action Mismatch]: expected ${expectedAction}, got ${data.action}`);
      return { success: false, error: 'การตรวจสอบความปลอดภัยไม่ถูกต้อง' };
    }

    // Hostname check if configured
    const configuredHostnames = (process.env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (configuredHostnames.length > 0 && data.hostname) {
      const allowed = new Set(configuredHostnames);
      if (!allowed.has(data.hostname.toLowerCase())) {
        console.warn(`[Turnstile Hostname Mismatch]: ${data.hostname} not in [${configuredHostnames.join(', ')}]`);
        return { success: false, error: 'โดเมนไม่ได้รับอนุญาตสำหรับการตรวจสอบ' };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[Turnstile Error]:', err);
    // Graceful fallback if Cloudflare API is temporarily unreachable so users are not blocked
    return { success: true };
  }
}

/**
 * Verify Cloudflare Turnstile token on backend (Canonical Siteverify)
 * Official Test Secret: 1x0000000000000000000000000000000AA (always passes)
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  clientIp?: string | null,
  expectedAction: string = 'login'
): Promise<{ success: boolean; error?: string }> {
  // Support both TURNSTILE_SECRET_KEY and canonical TURNSTILE_SECRET
  const configuredSecret = process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET;

  // In development, if no secret key is set:
  if (!configuredSecret) {
    if (process.env.NODE_ENV !== 'production') {
      // If client provided a test token (or any token), verify it using Cloudflare's official dummy secret
      if (token) {
        return verifyWithSecret(token, '1x0000000000000000000000000000000AA', clientIp, expectedAction);
      }
      // If in development and no token sent (e.g. offline dev, automated test), pass through
      console.warn('[Turnstile Dev]: No token provided and TURNSTILE_SECRET not set. Bypassing check.');
      return { success: true };
    }

    // In production without secret configured:
    console.warn('[Turnstile Warning]: TURNSTILE_SECRET is not set in production. Bypassing check.');
    return { success: true };
  }

  // Token format and length validation
  if (!token || typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { success: false, error: 'กรุณายืนยันความปลอดภัย (Captcha)' };
  }

  return verifyWithSecret(token, configuredSecret, clientIp, expectedAction);
}
