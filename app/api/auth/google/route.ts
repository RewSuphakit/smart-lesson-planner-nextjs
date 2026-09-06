import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json();

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ message: 'Invalid Google token' }, { status: 400 });
    }

    const { sub: googleId, email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: email! } });
      if (existingByEmail) {
        return NextResponse.json({ message: 'Email already registered. Please use email/password login.' }, { status: 400 });
      }

      user = await prisma.user.create({
        data: {
          email: email!,
          name: name || 'User',
          googleId,
          avatar: picture,
          role: 'teacher',
        },
      });
    }

    const token = generateToken(user);

    const response = NextResponse.json({
      message: 'Google login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Google login error:', error);
    return NextResponse.json({ message: 'Google authentication failed' }, { status: 500 });
  }
}
