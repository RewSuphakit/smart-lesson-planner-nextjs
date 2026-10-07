import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError, generateToken, setAuthCookie } from '@/lib/auth';
import { protectRequest, authLimiter } from '@/lib/arcjet';

export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    const arcjetCheck = await protectRequest(request, authLimiter, { userId: String(authUser.id) });
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const body = await request.json();

    const cleanCode = body.code ? String(body.code).trim() : '';

    if (!cleanCode || cleanCode.length !== 6) {
      return NextResponse.json(
        { message: 'กรุณากรอกรหัสยืนยัน 6 หลักให้ถูกต้อง' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (!user.pendingEmail) {
      return NextResponse.json(
        { message: 'ไม่พบคำขอเปลี่ยนอีเมลที่รอดำเนินการ กรุณาทำรายการใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json(
        { message: 'ไม่พบรหัสยืนยันในระบบ กรุณากดขอรหัสใหม่' },
        { status: 400 }
      );
    }

    if (new Date() > user.verificationCodeExpiry) {
      return NextResponse.json(
        { message: 'รหัสยืนยันหมดอายุแล้ว (เกิน 15 นาที) กรุณากดขอรหัสใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    const currentAttempts = (user as { verificationAttempts?: number }).verificationAttempts ?? 0;
    const MAX_VERIFY_ATTEMPTS = 5;

    if (currentAttempts >= MAX_VERIFY_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: null,
          verificationCodeExpiry: null,
          verificationAttempts: 0,
        },
      });
      return NextResponse.json(
        { message: 'คุณกรอกรหัสยืนยันผิดเกินจำนวนครั้งที่กำหนด รหัสถูกยกเลิกแล้ว กรุณากดขอรหัสใหม่' },
        { status: 400 }
      );
    }

    if (user.verificationCode !== cleanCode) {
      const newAttempts = currentAttempts + 1;
      if (newAttempts >= MAX_VERIFY_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            verificationCode: null,
            verificationCodeExpiry: null,
            verificationAttempts: 0,
          },
        });
        return NextResponse.json(
          { message: 'คุณกรอกรหัสยืนยันผิดเกินจำนวนครั้งที่กำหนด (5 ครั้ง) รหัสถูกยกเลิกแล้ว กรุณากดขอรหัสใหม่' },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { verificationAttempts: newAttempts },
      });

      const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;
      return NextResponse.json(
        { message: `รหัสยืนยัน OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง (เหลือโอกาสอีก ${remaining} ครั้ง)` },
        { status: 400 }
      );
    }

    // Check if pendingEmail is taken by another verified user
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
      // Remove unverified collision account
      await prisma.user.delete({
        where: { id: collision.id },
      });
    }

    // Successfully apply pendingEmail as active email
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

    // Generate fresh JWT token with the new email
    const token = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      message: 'เปลี่ยนที่อยู่อีเมลสำเร็จเรียบร้อยแล้ว ข้อมูลเดิมทั้งหมดของคุณยังคงอยู่ครบถ้วน 🎉',
      user: updatedUser,
      token,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Verify email change error:', error);
    return NextResponse.json(
      { message: 'เกิดข้อผิดพลาดในการยืนยันอีเมล กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
