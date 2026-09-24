interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Helper to call Cloudflare Turnstile siteverify API
 */
async function verifyWithSecret(
  token: string,
  secretKey: string,
  clientIp?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      console.warn('[Turnstile Verification Failed]:', data['error-codes']);
      return { success: false, error: 'การตรวจสอบความปลอดภัยไม่ผ่าน กรุณาลองใหม่อีกครั้ง' };
    }

    return { success: true };
  } catch (err) {
    console.error('[Turnstile Error]:', err);
    // Graceful fallback if Cloudflare API is temporarily unreachable
    return { success: true };
  }
}

/**
 * Verify Cloudflare Turnstile token on backend
 * Official Test Secret: 1x0000000000000000000000000000000AA (always passes)
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  clientIp?: string | null
): Promise<{ success: boolean; error?: string }> {
  const configuredSecret = process.env.TURNSTILE_SECRET_KEY;

  // In development, if no secret key is set:
  if (!configuredSecret) {
    if (process.env.NODE_ENV !== 'production') {
      // If client provided a test token (or any token), verify it using Cloudflare's official dummy secret
      if (token) {
        return verifyWithSecret(token, '1x0000000000000000000000000000000AA', clientIp);
      }
      // If in development and no token sent (e.g. offline dev, automated test), pass through
      console.warn('[Turnstile Dev]: No token provided and TURNSTILE_SECRET_KEY not set. Bypassing check.');
      return { success: true };
    }

    // In production without TURNSTILE_SECRET_KEY configured in .env:
    console.warn('[Turnstile Warning]: TURNSTILE_SECRET_KEY is not set in production. Bypassing check.');
    return { success: true };
  }

  // If secret key is configured, token is required
  if (!token) {
    return { success: false, error: 'กรุณายืนยันความปลอดภัย (Captcha)' };
  }

  return verifyWithSecret(token, configuredSecret, clientIp);
}

