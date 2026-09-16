import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { generateOtpCode, sendEmailChangeOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const body = await request.json();

    const rawEmail = body.newEmail ? String(body.newEmail).trim().toLowerCase() : '';

    if (!rawEmail) {
      return NextResponse.json(
        { message: 'กรุณาระบุที่อยู่อีเมลใหม่' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
      return NextResponse.json(
        { message: 'รูปแบบอีเมลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check against current user
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true },
    });

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (currentUser.email.toLowerCase() === rawEmail) {
      return NextResponse.json(
        { message: 'อีเมลนี้ตรงกับอีเมลปัจจุบันของคุณแล้ว' },
        { status: 400 }
      );
    }

    // Check if newEmail is already used by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: rawEmail },
      select: { id: true, emailVerified: true },
    });

    if (existingUser && existingUser.id !== currentUser.id) {
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { message: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้อีเมลอื่น' },
          { status: 400 }
        );
      }

      // If user is unverified and has no classrooms, clean up collision
      const classroomCount = await prisma.classroom.count({
        where: { userId: existingUser.id },
      });

      if (classroomCount === 0) {
        await prisma.user.delete({
          where: { id: existingUser.id },
        });
      } else {
        return NextResponse.json(
          { message: 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว กรุณาใช้อีเมลอื่น' },
          { status: 400 }
        );
      }
    }

    // Generate 6-digit OTP
    const otp = generateOtpCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        pendingEmail: rawEmail,
        verificationCode: otp,
        verificationCodeExpiry: expiry,
      },
    });

    // Send OTP to the new email
    const emailResult = await sendEmailChangeOtpEmail(rawEmail, currentUser.name, otp);

    return NextResponse.json({
      message: 'รหัสยืนยัน OTP ได้ถูกส่งไปยังอีเมลใหม่เรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย',
      newEmail: rawEmail,
      isDevMode: emailResult.isDevMode,
      devCode: emailResult.isDevMode ? otp : undefined,
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Request email change error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการส่งรหัสยืนยัน กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
