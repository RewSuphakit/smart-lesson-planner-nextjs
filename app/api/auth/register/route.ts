import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { RegisterSchema, validateRequestBody } from '@/lib/validation';
import { generateOtpCode, sendVerificationEmail, hashOtp } from '@/lib/email';
import { protectRequest, authLimiter } from '@/lib/arcjet';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, RegisterSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, password, name, turnstileToken } = validation.data;

    // 1. Verify Cloudflare Turnstile token
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     request.headers.get('x-real-ip') ||
                     undefined;
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, clientIp, 'register');
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { message: turnstileCheck.error || 'การตรวจสอบความปลอดภัยไม่ผ่าน' },
        { status: 400 }
      );
    }

    // 2. Arcjet Rate Limiting & Abuse Protection
    const arcjetCheck = await protectRequest(request, authLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const lowerEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existing && existing.emailVerified) {
      return NextResponse.json({ message: 'อีเมลนี้ได้รับการลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otpCode = generateOtpCode();
    const hashedOtp = hashOtp(otpCode);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    if (existing && !existing.emailVerified) {
      // Re-use existing unverified account: update password, name, and new OTP
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          password: hashedPassword,
          verificationCode: hashedOtp,
          verificationCodeExpiry: expiry,
          verificationAttempts: 0,
        },
      });
    } else {
      // Create new user with emailVerified = false
      await prisma.user.create({
        data: {
          email: lowerEmail,
          password: hashedPassword,
          name,
          role: 'teacher',
          emailVerified: false,
          verificationCode: hashedOtp,
          verificationCodeExpiry: expiry,
          verificationAttempts: 0,
        },
      });
    }

    // Send verification email
    const emailResult = await sendVerificationEmail(lowerEmail, name, otpCode);

    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      message: emailResult.success
        ? 'ระบบได้ส่งรหัสยืนยัน 6 หลักไปยังอีเมลของคุณแล้ว'
        : 'ระบบสร้างรหัสยืนยันเรียบร้อยแล้ว (โหมดทดสอบ)',
      email: lowerEmail,
      requireVerification: true,
      isDevMode: emailResult.isDevMode,
      ...(isDev && (emailResult.isDevMode || !emailResult.success) ? {
        devCode: otpCode,
        warning: emailResult.error || 'ยังไม่ได้ตั้งค่า SMTP จริงในไฟล์ .env (แสดงรหัสสำหรับทดสอบ)',
      } : {}),
    }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ message: 'การสมัครสมาชิกล้มเหลว กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
