import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/portal',
  '/404',
  '/api/portal',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/verify-email',
  '/api/auth/resend-code',
  '/api/auth/change-email-unverified',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
];

import crypto from 'crypto';

// Helper to cryptographically verify JWT token signature and expiration
function isValidJwt(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Verify expiration
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!payload || typeof payload !== 'object') return false;
    if (payload.exp && Date.now() >= payload.exp * 1000) return false;

    // 2. Cryptographically verify signature if secret is present
    const secret = process.env.JWT_SECRET;
    if (secret) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      const sigBuffer = Buffer.from(signatureB64);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (sigBuffer.length !== expectedBuffer.length) return false;
      if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public static assets and next internal requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/uploads')
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path));
  const rawToken = request.cookies.get('token')?.value;
  const isValidToken = Boolean(rawToken && isValidJwt(rawToken));

  // If token is present but expired, clear the cookie and redirect to login
  if (rawToken && !isValidToken) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('token', '', { maxAge: 0, path: '/' });
    return response;
  }

  // If user is not authenticated and tries to access protected web pages
  if (!isValidToken && !isPublicPath && !pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
