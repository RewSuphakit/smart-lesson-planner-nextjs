import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentEmail, code } = body;

    if (!currentEmail || !code) {
      return NextResponse.json(
        { message: 'กรุณาระบุอีเมลและรหัสยืนยัน 6 หลัก' },
        { status: 400 }
      );
    }

    const cleanCurrent = String(currentEmail).trim().toLowerCase();
    const cleanCode = String(code).trim();

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { message: 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanCurrent },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'บัญชีนี้ได้รับการยืนยันตัวตนเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที' },
        { status: 400 }
      );
    }

    if (!user.pendingEmail) {
      return NextResponse.json(
        { message: 'ไม่พบคำขอเปลี่ยนอีเมลที่รอดำเนินการ กรุณาระบุอีเมลใหม่เพื่อขอรับรหัส OTP อีกครั้ง' },
        { status: 400 }
      );
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json(
        { message: 'ไม่พบรหัสยืนยันในระบบ กรุณากดส่งรหัสใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    if (new Date() > user.verificationCodeExpiry) {
      return NextResponse.json(
        { message: 'รหัสยืนยันหมดอายุแล้ว (เกิน 15 นาที) กรุณากดขอรหัสใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    if (user.verificationCode !== cleanCode) {
      return NextResponse.json(
        { message: 'รหัสยืนยัน OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' },
        { status: 400 }
      );
    }

    // Check collision for pendingEmail again
    const collision = await prisma.user.findUnique({
      where: { email: user.pendingEmail },
      select: { id: true, emailVerified: true },
    });

    if (collision && collision.id !== user.id) {
      if (collision.emailVerified) {
        return NextResponse.json(
          { message: 'อีเมลนี้ถูกใช้งานไปแล้ว กรุณาใช้อีเมลอื่น' },
          { status: 400 }
        );
      }
      await prisma.user.delete({
        where: { id: collision.id },
      });
    }

    // Update account with new email and mark verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        verificationCode: null,
        verificationCodeExpiry: null,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });

    const token = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      message: 'เปลี่ยนเป็นอีเมลจริงและเปิดใช้งานบัญชีสำเร็จเรียบร้อย! ข้อมูลเดิมทั้งหมดของคุณยังคงอยู่ครบถ้วน 🎉',
      token,
      user: updatedUser,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Verify unverified email error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการยืนยันอีเมล กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
