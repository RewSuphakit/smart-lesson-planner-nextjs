import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { RegisterSchema, validateRequestBody } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, RegisterSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, password, name } = validation.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'teacher',
      },
      select: { id: true, email: true, name: true, role: true, avatar: true },
    });

    const token = generateToken(user);

    const response = NextResponse.json({
      message: 'Registration successful',
      token,
      user,
    }, { status: 201 });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ message: 'Registration failed' }, { status: 500 });
  }
}
