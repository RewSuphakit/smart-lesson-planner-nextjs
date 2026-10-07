import { NextRequest, NextResponse } from 'next/server';
import prisma, { withDbRetry } from '@/lib/prisma';
import { requireAuth, getAuthUser, clearAuthCookie, AuthError, handleAuthError } from '@/lib/auth';

import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      const response = NextResponse.json({ user: null }, { status: 200 });
      clearAuthCookie(response);
      return response;
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: authUser.id },
        select: { 
          id: true, 
          email: true, 
          name: true, 
          role: true, 
          avatar: true, 
          emailVerified: true, 
          createdAt: true,
          password: true,
          googleId: true 
        },
      })
    );

    if (!user) {
      const response = NextResponse.json({ user: null }, { status: 200 });
      clearAuthCookie(response);
      return response;
    }

    const { password, googleId, ...safeUser } = user;
    const response = NextResponse.json({ 
      user: {
        ...safeUser,
        hasPassword: !!password,
        isGoogleUser: !!googleId
      } 
    });

    // Ensure client indicator cookie is present when user session is active
    response.cookies.set({
      name: 'logged_in',
      value: 'true',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const body = await request.json();

    const updateData: { name?: string; avatar?: string | null } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
      }
      updateData.name = name;
    }
    if (body.avatar !== undefined) {
      if (body.avatar) {
        const rawAvatar = String(body.avatar).trim();
        const isGoogleAvatar = rawAvatar.startsWith('https://lh3.googleusercontent.com/');
        const isBase64Image = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(rawAvatar);
        if (!isGoogleAvatar && !isBase64Image) {
          return NextResponse.json(
            { message: 'รูปแบบรูปภาพไม่ถูกต้อง (รองรับเฉพาะ base64 WebP, JPG, PNG หรือ Google Avatar)' },
            { status: 400 }
          );
        }
        if (rawAvatar.length > 512 * 1024) {
          return NextResponse.json({ message: 'ขนาดรูปภาพใหญ่เกินไป (สูงสุด 500KB)' }, { status: 400 });
        }
        updateData.avatar = rawAvatar;
      } else {
        updateData.avatar = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatar: true, emailVerified: true, createdAt: true },
    });

    return NextResponse.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update profile error:', error);
    return NextResponse.json({ message: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, password: true, googleId: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { password, confirmation } = body;

    // If user has a password (standard email/password account), verify it
    if (user.password) {
      if (!password) {
        return NextResponse.json({ message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบบัญชี' }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return NextResponse.json({ message: 'รหัสผ่านไม่ถูกต้อง ไม่สามารถลบบัญชีได้' }, { status: 400 });
      }
    } else {
      // User registered via Google (no password set), verify typed confirmation
      const cleanConfirm = String(confirmation || '').trim().toLowerCase();
      if (cleanConfirm !== user.email.toLowerCase() && cleanConfirm !== 'delete' && cleanConfirm !== 'ลบบัญชี') {
        return NextResponse.json({ message: 'กรุณาพิมพ์ยืนยันด้วยอีเมลของคุณเพื่อลบบัญชี' }, { status: 400 });
      }
    }

    // Cascade delete user and all associated data
    await prisma.user.delete({
      where: { id: authUser.id },
    });

    const response = NextResponse.json({ message: 'ลบบัญชีผู้ใช้และข้อมูลทั้งหมดเรียบร้อยแล้ว' });
    response.cookies.set('token', '', { maxAge: 0, path: '/' });
    response.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Delete account error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาดในการลบบัญชี' }, { status: 500 });
  }
}

