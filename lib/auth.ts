import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-lesson-planner-secret-key';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function getAuthUser(request: NextRequest): JwtPayload | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.split(' ')[1];
    return verifyToken(token);
  } catch {
    return null;
  }
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
