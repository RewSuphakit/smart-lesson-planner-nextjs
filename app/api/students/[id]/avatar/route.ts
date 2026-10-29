import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthUser, verifyPortalSession, handleAuthError } from '@/lib/auth';

const DATA_URI = /^data:(image\/(?:webp|jpeg|png|gif));base64,([A-Za-z0-9+/=]+)$/;

/**
 * GET /api/students/:id/avatar
 * Serves a single student's avatar as a binary image with ETag + private caching,
 * so list and portal endpoints don't need to embed base64 avatars in JSON.
 * Authorized for either the owning teacher or an active verified student portal session.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = getAuthUser(request);
    const portalCookie = request.cookies.get('portal_session')?.value;
    const portalSession = portalCookie ? verifyPortalSession(portalCookie) : null;

    if (!authUser && !portalSession) {
      return handleAuthError();
    }

    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: numericId },
      select: { id: true, userId: true, studentCode: true, avatar: true, updatedAt: true },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const isTeacherOwner = Boolean(authUser && student.userId === authUser.id);
    const isPortalOwner = Boolean(
      portalSession &&
        (portalSession.studentIds
          ? portalSession.studentIds.includes(student.id)
          : student.studentCode &&
            student.studentCode.trim().toLowerCase() === portalSession.studentCode.trim().toLowerCase())
    );

    if (!isTeacherOwner && !isPortalOwner) {
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
  } catch {
    return NextResponse.json({ message: 'Failed to get avatar' }, { status: 500 });
  }
}
