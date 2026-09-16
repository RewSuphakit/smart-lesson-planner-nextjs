import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateOtpCode, sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: 'กรุณาระบุอีเมล' }, { status: 400 });
    }

    const lowerEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (!user) {
      return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งานนี้' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'อีเมลนี้ได้รับการยืนยันเรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที' }, { status: 400 });
    }

    // Rate-limiting: 60 seconds cooldown between resends
    if (user.verificationCodeExpiry) {
      const remainingMs = user.verificationCodeExpiry.getTime() - Date.now();
      // Total validity is 15 minutes (900,000ms). If remaining > 14 minutes (840,000ms), 60s cooldown hasn't passed
      if (remainingMs > 14 * 60 * 1000) {
        const waitSec = Math.ceil((remainingMs - 14 * 60 * 1000) / 1000);
        return NextResponse.json(
          { message: `กรุณารออีก ${waitSec} วินาทีก่อนกดส่งรหัสใหม่` },
          { status: 429 }
        );
      }
    }

    const newCode = generateOtpCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: newCode,
        verificationCodeExpiry: expiry,
      },
    });

    const emailResult = await sendVerificationEmail(lowerEmail, user.name, newCode);
    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      message: emailResult.success
        ? 'ส่งรหัสยืนยันใหม่ไปยังอีเมลของคุณเรียบร้อยแล้ว'
        : 'ระบบสร้างรหัสยืนยันใหม่เรียบร้อยแล้ว (โหมดทดสอบ)',
      isDevMode: emailResult.isDevMode,
      ...(isDev && (emailResult.isDevMode || !emailResult.success) ? {
        devCode: newCode,
        warning: emailResult.error || 'ยังไม่ได้ตั้งค่า SMTP จริงในไฟล์ .env (แสดงรหัสสำหรับทดสอบ)',
      } : {}),
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    return NextResponse.json({ message: 'การส่งรหัสล้มเหลว กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
