import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, emailVerified: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
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

