import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { getOrSetCache, userCacheKey } from '@/lib/cache';

/**
 * GET /api/students/grade-levels
 * Returns distinct gradeLevel values for the current user's students.
 * Used for populating the grade level filter dropdown.
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');

    const gradeLevelList = await getOrSetCache(
      userCacheKey(user.id, 'students', 'grade-levels', branch || 'all'),
      120,
      async () => {
        const where: Record<string, unknown> = {
          userId: user.id,
          gradeLevel: { not: null },
        };
        if (branch) {
          where.branch = branch;
        }

        const gradeLevels = await prisma.student.findMany({
          where,
          select: { gradeLevel: true },
          distinct: ['gradeLevel'],
          orderBy: { gradeLevel: 'asc' },
        });

        return gradeLevels
          .map(g => g.gradeLevel)
          .filter((g): g is string => g !== null && g.trim() !== '');
      }
    );

    return NextResponse.json({ data: gradeLevelList });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get grade levels' }, { status: 500 });
  }
}
