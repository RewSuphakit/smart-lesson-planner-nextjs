import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { ResetPasswordSchema, validateRequestBody } from '@/lib/validation';
import { protectRequest, authLimiter } from '@/lib/arcjet';
import { verifyOtp } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Arcjet Rate Limiting & Protection
    const arcjetCheck = await protectRequest(request, authLimiter);
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const validation = await validateRequestBody(request, ResetPasswordSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, code, newPassword } = validation.data;
    const lowerEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (!user.resetPasswordToken || !user.resetPasswordExpiry) {
      return NextResponse.json(
        { message: 'ไม่พบคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้ กรุณากดขอรหัส OTP ก่อน' },
        { status: 400 }
      );
    }

    if (new Date() > user.resetPasswordExpiry) {
      return NextResponse.json(
        { message: 'รหัส OTP หมดอายุแล้ว (เกินกำหนด 15 นาที) กรุณากดขอรหัสใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    const currentAttempts = (user as { resetPasswordAttempts?: number }).resetPasswordAttempts ?? 0;
    const MAX_OTP_ATTEMPTS = 5;

    if (currentAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpiry: null,
          resetPasswordAttempts: 0,
        },
      });
      return NextResponse.json(
        { message: 'คุณกรอกรหัส OTP ไม่ถูกต้องเกินจำนวนครั้งที่กำหนด รหัสนี้ถูกยกเลิกแล้ว กรุณากดขอรหัสใหม่' },
        { status: 400 }
      );
    }

    if (!verifyOtp(code, user.resetPasswordToken)) {
      const newAttempts = currentAttempts + 1;
      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            resetPasswordToken: null,
            resetPasswordExpiry: null,
            resetPasswordAttempts: 0,
          },
        });
        return NextResponse.json(
          { message: 'คุณกรอกรหัส OTP ไม่ถูกต้องเกินจำนวนครั้งที่กำหนด (5 ครั้ง) รหัสนี้ถูกยกเลิกแล้ว กรุณากดขอรหัสใหม่' },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordAttempts: newAttempts },
      });

      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      return NextResponse.json(
        { message: `รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบใหม่อีกครั้ง (เหลือโอกาสอีก ${remaining} ครั้ง)` },
        { status: 400 }
      );
    }

    // Hash the new password securely
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        resetPasswordAttempts: 0,
      },
    });

    return NextResponse.json({
      message: 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
