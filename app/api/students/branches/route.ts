import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { getOrSetCache, userCacheKey } from '@/lib/cache';

/**
 * GET /api/students/branches
 * Returns distinct branch values for the current user's students.
 * Used for populating the branch filter dropdown.
 */
export const GET = withAuth(async (request, user) => {

  const branchList = await getOrSetCache(
    userCacheKey(user.id, 'students', 'branches'),
    120,
    async () => {
      const branches = await prisma.student.findMany({
        where: {
          userId: user.id,
          branch: { not: null },
        },
        select: { branch: true },
        distinct: ['branch'],
        orderBy: { branch: 'asc' },
      });

      return branches
        .map(b => b.branch)
        .filter((b): b is string => b !== null && b.trim() !== '');
    }
  );

  return NextResponse.json({ data: branchList });
}, 'Failed to get branches');
