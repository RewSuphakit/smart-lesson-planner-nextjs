import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateOtpCode, sendPasswordResetOtpEmail, hashOtp } from '@/lib/email';
import { ForgotPasswordSchema, validateRequestBody } from '@/lib/validation';
import { protectRequest, authLimiter } from '@/lib/arcjet';

export async function POST(request: NextRequest) {
  try {
    // Arcjet Rate Limiting & Protection
    const arcjetCheck = await protectRequest(request, authLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const validation = await validateRequestBody(request, ForgotPasswordSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email } = validation.data;
    const lowerEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (!user) {
      return NextResponse.json({
        message: 'หากอีเมลนี้ลงทะเบียนไว้ในระบบ เราได้ส่งรหัส OTP สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (หากไม่พบ กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ/Spam)',
        email: lowerEmail,
      });
    }

    if (!user.password && user.googleId) {
      return NextResponse.json(
        { message: 'บัญชีนี้ลงทะเบียนด้วย Google Login กรุณาเข้าสู่ระบบผ่าน Google' },
        { status: 400 }
      );
    }

    // Rate-limiting cooldown: 60 seconds between OTP requests
    if (user.resetPasswordExpiry) {
      const remainingMs = user.resetPasswordExpiry.getTime() - Date.now();
      // Total validity is 15 minutes (900,000ms). If remaining > 14 minutes (840,000ms), 60s cooldown hasn't elapsed
      if (remainingMs > 14 * 60 * 1000) {
        const waitSec = Math.ceil((remainingMs - 14 * 60 * 1000) / 1000);
        return NextResponse.json(
          { message: `กรุณารออีก ${waitSec} วินาทีก่อนกดขอรหัส OTP ใหม่` },
          { status: 429 }
        );
      }
    }

    const otpCode = generateOtpCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashOtp(otpCode),
        resetPasswordExpiry: expiry,
        resetPasswordAttempts: 0,
      },
    });

    const emailResult = await sendPasswordResetOtpEmail(lowerEmail, user.name, otpCode);
    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      message: 'ส่งรหัส OTP สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว (หากไม่พบ กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ/Spam)',
      email: lowerEmail,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการส่งรหัสรีเซ็ตรหัสผ่าน กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
