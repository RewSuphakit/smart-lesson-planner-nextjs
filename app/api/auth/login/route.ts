import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { LoginSchema, validateRequestBody } from '@/lib/validation';
import { protectRequest, authLimiter } from '@/lib/arcjet';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, LoginSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, password, rememberMe, turnstileToken } = validation.data;

    // 1. Verify Cloudflare Turnstile token FIRST (Ensures siteverify is always called)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     request.headers.get('x-real-ip') ||
                     undefined;
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, clientIp, 'login');
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { message: turnstileCheck.error || 'การตรวจสอบความปลอดภัยไม่ผ่าน' },
        { status: 400 }
      );
    }

    // 2. Arcjet Rate Limiting & Brute Force Protection
    const arcjetCheck = await protectRequest(request, authLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json({ message: 'Please use Google login for this account' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({
        message: 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ',
        requireVerification: true,
        email: user.email,
      }, { status: 403 });
    }

    const token = generateToken(user, rememberMe);

    const response = NextResponse.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
    });

    setAuthCookie(response, token, rememberMe);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
