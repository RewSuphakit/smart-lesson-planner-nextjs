import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

const DATA_URI = /^data:(image\/(?:webp|jpeg|png|gif));base64,([A-Za-z0-9+/=]+)$/;

/**
 * GET /api/students/:id/avatar
 * Serves a single student's avatar as a binary image with ETag + private caching,
 * so list endpoints don't need to embed base64 avatars in JSON.
 * - data:image/* avatars → binary image (200 / 304)
 * - http(s) avatar URL → 302 redirect
 * - none / non-image (e.g. preset emoji key) → 204
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id: numericId, userId: user.id },
      select: { avatar: true, updatedAt: true },
    });
    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const avatar = student.avatar;
    if (!avatar) return new NextResponse(null, { status: 204 });

    if (/^https:\/\/lh3\.googleusercontent\.com\//.test(avatar)) {
      return NextResponse.redirect(avatar, 302);
    }

    const match = DATA_URI.exec(avatar);
    if (!match) return new NextResponse(null, { status: 204 });

    const etag = `"${crypto.createHash('sha1').update(avatar).digest('hex')}"`;
    const headers = {
      ETag: etag,
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600',
    };
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    const body = Buffer.from(match[2], 'base64');
    return new NextResponse(body, {
      status: 200,
      headers: { ...headers, 'Content-Type': match[1], 'Content-Length': String(body.length) },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get avatar' }, { status: 500 });
  }
}

