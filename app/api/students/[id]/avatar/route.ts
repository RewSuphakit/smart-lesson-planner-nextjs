import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, verifyPortalSession, handleAuthError } from '@/lib/auth';
import { readAvatarBinary } from '@/lib/avatarStorage';

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

    const binary = readAvatarBinary(avatar);
    if (!binary) return new NextResponse(null, { status: 204 });

    const headers = {
      ETag: binary.etag,
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600',
    };
    if (request.headers.get('if-none-match') === binary.etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    return new NextResponse(new Uint8Array(binary.buffer), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': binary.contentType,
        'Content-Length': String(binary.buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ message: 'Failed to get avatar' }, { status: 500 });
  }
}
