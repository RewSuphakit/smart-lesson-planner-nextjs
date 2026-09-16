import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    const user = await prisma.user.findUnique({
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
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const { password, googleId, ...safeUser } = user;
    return NextResponse.json({ 
      user: {
        ...safeUser,
        hasPassword: !!password,
        isGoogleUser: !!googleId
      } 
    });
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
      updateData.avatar = body.avatar ? String(body.avatar).trim() : null;
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

