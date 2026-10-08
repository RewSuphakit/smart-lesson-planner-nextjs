import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set.');
  }
  return secret;
}

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  authMethod?: 'credentials' | 'google';
}

export function generateToken(
  user: { id: number; email: string; role: string },
  rememberMe?: boolean,
  authMethod?: 'credentials' | 'google'
): string {
  let expiresIn: string;
  if (rememberMe === true) {
    expiresIn = '30d';
  } else if (rememberMe === false) {
    expiresIn = '1d';
  } else {
    expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, authMethod: authMethod || 'credentials' },
    getJwtSecret(),
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function generatePortalSession(studentCode: string): string {
  return jwt.sign(
    { studentCode, type: 'portal_session' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

export function verifyPortalSession(token: string): { studentCode: string } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { studentCode?: string; type?: string };
    if (payload?.type === 'portal_session' && payload.studentCode) {
      return { studentCode: payload.studentCode };
    }
    return null;
  } catch {
    return null;
  }
}

export function getAuthUser(request: NextRequest): JwtPayload | null {
  try {
    let token: string | undefined;

    // 1. Primary & Secure: httpOnly cookie
    token = request.cookies.get('token')?.value;

    // 2. Fallback: Authorization Bearer header (for external API clients / tests)
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return null;
    }

    return verifyToken(token);
  } catch {
    return null;
  }
}

function getCookieMaxAge(): number {
  const expires = process.env.JWT_EXPIRES_IN || '7d';
  const match = expires.match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 7 * 86400;
  }
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  rememberMe?: boolean
): void {
  let maxAge: number;
  if (rememberMe === true) {
    maxAge = 30 * 24 * 60 * 60; // 30 days
  } else if (rememberMe === false) {
    maxAge = 24 * 60 * 60; // 1 day
  } else {
    maxAge = getCookieMaxAge();
  }

  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  // Client indicator cookie (accessible to JavaScript)
  response.cookies.set({
    name: 'logged_in',
    value: 'true',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: 'token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set({
    name: 'logged_in',
    value: '',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export function requireAuth(request: NextRequest): JwtPayload {
  const user = getAuthUser(request);
  if (!user) {
    throw new AuthError('Authentication required');
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function handleAuthError(): NextResponse {
  return NextResponse.json(
    { message: 'Authentication required' },
    { status: 401 }
  );
}
