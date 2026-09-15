import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);
    const body = await request.json();

    const { current_password, new_password } = body;

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { message: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // If user has an existing password, verify current password
    if (user.password) {
      if (!current_password) {
        return NextResponse.json(
          { message: 'Current password is required' },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { message: 'Current password does not match' },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await prisma.user.update({
      where: { id: authUser.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Change password error:', error);
    return NextResponse.json({ message: 'Failed to change password' }, { status: 500 });
  }
}
