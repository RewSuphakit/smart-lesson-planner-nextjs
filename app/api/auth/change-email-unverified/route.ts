import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateOtpCode, sendEmailChangeOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentEmail, newEmail } = body;

    if (!currentEmail || !newEmail) {
      return NextResponse.json(
        { message: 'กรุณาระบุอีเมลปัจจุบันและอีเมลใหม่' },
        { status: 400 }
      );
    }

    const cleanCurrent = String(currentEmail).trim().toLowerCase();
    const cleanNew = String(newEmail).trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanNew)) {
      return NextResponse.json(
        { message: 'รูปแบบอีเมลใหม่ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    if (cleanCurrent === cleanNew) {
      return NextResponse.json(
        { message: 'อีเมลใหม่ตรงกับอีเมลเดิมของคุณแล้ว' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanCurrent },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'บัญชีนี้ได้รับการยืนยันเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที' },
        { status: 400 }
      );
    }

    // Check collision with another user
    const existing = await prisma.user.findUnique({
      where: { email: cleanNew },
      select: { id: true, emailVerified: true },
    });

    if (existing && existing.id !== user.id) {
      if (existing.emailVerified) {
        return NextResponse.json(
          { message: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้อีเมลอื่น' },
          { status: 400 }
        );
      }

      // If existing user is unverified and has no classrooms, delete orphan account
      const classrooms = await prisma.classroom.count({
        where: { userId: existing.id },
      });

      if (classrooms === 0) {
        await prisma.user.delete({
          where: { id: existing.id },
        });
      } else {
        return NextResponse.json(
          { message: 'อีเมลนี้ถูกลงทะเบียนไว้ในระบบแล้ว กรุณาใช้อีเมลอื่น' },
          { status: 400 }
        );
      }
    }

    // Generate 6-digit OTP
    const otp = generateOtpCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingEmail: cleanNew,
        verificationCode: otp,
        verificationCodeExpiry: expiry,
      },
    });

    // Send OTP to new real email
    const emailResult = await sendEmailChangeOtpEmail(cleanNew, user.name, otp);

    return NextResponse.json({
      message: 'รหัสยืนยัน OTP ได้ถูกส่งไปยังอีเมลใหม่เรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย',
      newEmail: cleanNew,
      isDevMode: emailResult.isDevMode,
      devCode: emailResult.isDevMode ? otp : undefined,
    });
  } catch (error) {
    console.error('Change unverified email request error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการส่งรหัสยืนยัน กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
