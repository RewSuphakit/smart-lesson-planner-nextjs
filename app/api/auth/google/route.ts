import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';

function cleanString(str?: string | null): string {
  if (!str) return '';
  return str.trim().replace(/^["']|["']$/g, '').replace(/\r/g, '').trim();
}

export async function GET() {
  const clientId = cleanString(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  return NextResponse.json({ clientId });
}

export async function POST(request: NextRequest) {
  try {
    const cleanClientId = cleanString(process.env.GOOGLE_CLIENT_ID);
    const cleanPublicClientId = cleanString(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

    if (!cleanClientId && !cleanPublicClientId) {
      return NextResponse.json(
        { message: 'ระบบยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ในระบบ' },
        { status: 500 }
      );
    }

    const { credential } = await request.json();
    if (!credential) {
      return NextResponse.json({ message: 'Missing credential' }, { status: 400 });
    }

    // Extract aud from token for diagnostics
    let tokenAud: string | undefined;
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        tokenAud = decoded.aud;
      }
    } catch {
      // Ignore
    }

    const validAudiences = Array.from(
      new Set([cleanClientId, cleanPublicClientId].filter(Boolean))
    );

    console.log('[Google Auth] Token aud:', tokenAud, 'Valid audiences:', validAudiences);

    // If tokenAud exists and matches either ID, ensure it is considered valid
    const targetAudience = validAudiences.length === 1 ? validAudiences[0] : validAudiences;
    const googleClient = new OAuth2Client(cleanClientId || cleanPublicClientId);

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: targetAudience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ message: 'Invalid Google token' }, { status: 400 });
    }

    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
      return NextResponse.json({ message: 'Email not provided by Google account' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        // Link Google ID to existing user account and ensure email is verified
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId,
            avatar: existingByEmail.avatar || picture,
            emailVerified: true,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: name || 'User',
            googleId,
            avatar: picture,
            role: 'teacher',
            emailVerified: true,
          },
        });
      }
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
