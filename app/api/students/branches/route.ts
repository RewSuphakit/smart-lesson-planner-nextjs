import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

/**
 * GET /api/students/branches
 * Returns distinct branch values for the current user's students.
 * Used for populating the branch filter dropdown.
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const branches = await prisma.student.findMany({
      where: {
        userId: user.id,
        branch: { not: null },
      },
      select: { branch: true },
      distinct: ['branch'],
      orderBy: { branch: 'asc' },
    });

    const branchList = branches
      .map(b => b.branch)
      .filter((b): b is string => b !== null && b.trim() !== '');

    return NextResponse.json({ data: branchList });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get branches' }, { status: 500 });
  }
}
