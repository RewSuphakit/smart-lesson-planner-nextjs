import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, setAuthCookie, generateToken, AuthError, handleAuthError } from '@/lib/auth';
import prisma, { withDbRetry } from '@/lib/prisma';

/**
 * POST /api/auth/refresh
 *
 * Refreshes an active session's JWT token and resets the httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = requireAuth(request);

    // Verify user still exists in database and is active
    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, email: true, role: true },
      })
    );

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const newToken = generateToken(user, undefined, authUser.authMethod);
    const response = NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      message: 'Token refreshed successfully',
    });

    setAuthCookie(response, newToken);
    return response;
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to refresh token' }, { status: 500 });
  }
}
