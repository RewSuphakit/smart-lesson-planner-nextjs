import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { message: 'กรุณาระบุอีเมลและรหัสยืนยัน 6 หลัก' },
        { status: 400 }
      );
    }

    const lowerEmail = String(email).toLowerCase().trim();
    const cleanCode = String(code).trim();

    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (!user) {
      return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งานนี้' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'อีเมลนี้ได้รับการยืนยันเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที' }, { status: 400 });
    }

    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return NextResponse.json({ message: 'รหัสยืนยันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }, { status: 400 });
    }

    if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
      return NextResponse.json({ message: 'รหัสยืนยันหมดอายุแล้ว กรุณากดส่งรหัสใหม่อีกครั้ง' }, { status: 400 });
    }

    // Activate user and clear verification code
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });

    const token = generateToken(updatedUser);

    const response = NextResponse.json({
      message: 'ยืนยันอีเมลและเปิดใช้งานบัญชีสำเร็จ!',
      token,
      user: updatedUser,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json({ message: 'การยืนยันอีเมลล้มเหลว กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
