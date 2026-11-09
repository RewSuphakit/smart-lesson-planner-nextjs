import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { getOrSetCache, userCacheKey } from '@/lib/cache';

/**
 * GET /api/students/grade-levels
 * Returns distinct gradeLevel values for the current user's students.
 * Used for populating the grade level filter dropdown.
 */
export const GET = withAuth(async (request, user) => {
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
}, 'Failed to get grade levels');
