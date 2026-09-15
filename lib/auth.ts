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
}

export function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function getAuthUser(request: NextRequest): JwtPayload | null {
  try {
    let token: string | undefined;

    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = request.cookies.get('token')?.value;
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

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getCookieMaxAge(),
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
