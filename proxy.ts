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

// Helper to check if JWT token is expired without external dependencies
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    if (!payload || typeof payload !== 'object') return true;
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
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
  const isValidToken = Boolean(rawToken && !isTokenExpired(rawToken));

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
