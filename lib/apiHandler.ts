import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export type AuthedUser = ReturnType<typeof requireAuth>;

/**
 * Next.js 16 route handler context: `params` is a Promise
 * (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md).
 */
export type RouteCtx<P = Record<string, never>> = { params: Promise<P> };

type AuthedHandler<P> = (
  req: NextRequest,
  user: AuthedUser,
  ctx: RouteCtx<P>
) => Promise<Response>;

/**
 * Wraps a route handler with authentication + uniform error handling.
 *
 * - Runs `requireAuth`; an `AuthError` becomes the standard 401 response.
 * - Any other thrown error is logged and answered with
 *   `{ message: failMessage }` and HTTP 500.
 *
 * Routes with special catch logic (Prisma errors, validation, ...) should keep
 * their own try/catch inside the handler and only let unexpected errors bubble.
 */
export function withAuth<P = Record<string, never>>(
  handler: AuthedHandler<P>,
  failMessage = 'Internal server error'
) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const user = requireAuth(req);
      return await handler(req, user, ctx);
    } catch (error) {
      if (error instanceof AuthError) return handleAuthError();
      logger.error(`${req.method} ${req.nextUrl.pathname}`, error);
      return NextResponse.json({ message: failMessage }, { status: 500 });
    }
  };
}
