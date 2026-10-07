import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { protectRequest, authLimiter } from '@/lib/arcjet';

export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    const arcjetCheck = await protectRequest(request, authLimiter, { userId: String(authUser.id) });
    if (!arcjetCheck.allowed) {
      return arcjetCheck.response!;
    }

    const body = await request.json();

    const { current_password, new_password } = body;

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
    }

    // If user has an existing password AND logged in via credentials (not Google OAuth),
    // require current password verification
    if (user.password && authUser.authMethod !== 'google') {
      if (!current_password) {
        return NextResponse.json(
          { message: 'กรุณากรอกรหัสผ่านปัจจุบัน' },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await prisma.user.update({
      where: { id: authUser.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Change password error:', error);
    return NextResponse.json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
