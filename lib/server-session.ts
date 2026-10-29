import { cache } from 'react';
import { cookies } from 'next/headers';
import prisma, { withDbRetry } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getOrSetCache, userCacheKey } from '@/lib/cache';
import { fetchDashboardData, getEmptyDashboardData, type DashboardData } from '@/lib/dashboard';
import { getActiveSemesterId } from '@/lib/semester';
import type { User } from '@/context/AuthContext';
import type { Semester } from '@/services/semester';

export interface ServerSessionResult {
  user: User | null;
  semesters?: Semester[];
}

async function fetchUserSemestersForSSR(userId: number): Promise<Semester[]> {
  const cacheKey = userCacheKey(userId, 'semesters', 'all', 'false');

  const raw = await getOrSetCache(cacheKey, 60, async () => {
    const semesters = await withDbRetry(() =>
      prisma.semester.findMany({
        where: { userId },
        include: {
          classrooms: {
            select: { id: true, curriculumType: true },
          },
          _count: {
            select: { classrooms: true, weeklySchedules: true },
          },
        },
        orderBy: [{ academicYear: 'desc' }, { termNumber: 'asc' }],
      })
    );

    return semesters.map((s) => {
      const pvchCount = s.classrooms.filter((c) => c.curriculumType === 'pvch').length;
      const pvsCount = s.classrooms.filter((c) => c.curriculumType === 'pvs').length;
      const customCount = s.classrooms.filter((c) => c.curriculumType === 'custom').length;

      return {
        id: s.id,
        name: s.name,
        term_number: s.termNumber,
        academic_year: s.academicYear,
        start_date: s.startDate ? s.startDate.toISOString().split('T')[0] : null,
        end_date: s.endDate ? s.endDate.toISOString().split('T')[0] : null,
        is_active: s.isActive,
        curriculum_type: s.curriculumType,
        total_weeks: s.totalWeeks,
        classroom_count: s._count.classrooms,
        pvch_count: pvchCount,
        pvs_count: pvsCount,
        custom_count: customCount,
        timetable_count: s._count.weeklySchedules,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      };
    });
  });

  // Normalize created_at / updated_at in case cache entry was populated by Route Handler with Date objects
  return raw.map((sem) => ({
    ...sem,
    curriculum_type: sem.curriculum_type as Semester['curriculum_type'],
    created_at:
      (sem.created_at as unknown) instanceof Date
        ? (sem.created_at as unknown as Date).toISOString()
        : sem.created_at,
    updated_at:
      (sem.updated_at as unknown) instanceof Date
        ? (sem.updated_at as unknown as Date).toISOString()
        : sem.updated_at,
  }));
}

/**
 * Request-deduplicated server session & semester resolver for SSR hydration.
 * Eliminates the client-side `/api/auth/profile` + `/api/semester` waterfall on initial load.
 */
export const getServerSession = cache(async (): Promise<ServerSessionResult> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return { user: null };
    }

    let authUser: { id: number; email: string; role: string };
    try {
      authUser = verifyToken(token);
    } catch {
      return { user: null };
    }

    const userId = Number(authUser.id);
    if (!userId || Number.isNaN(userId)) {
      return { user: null };
    }

    const [dbUser, semesters] = await Promise.all([
      withDbRetry(() =>
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            emailVerified: true,
            createdAt: true,
            password: true,
            googleId: true,
          },
        })
      ),
      fetchUserSemestersForSSR(userId).catch(() => undefined),
    ]);

    if (!dbUser) {
      return { user: null };
    }

    const safeUser: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      avatar: dbUser.avatar,
      emailVerified: dbUser.emailVerified,
      createdAt: dbUser.createdAt.toISOString(),
      hasPassword: Boolean(dbUser.password),
      isGoogleUser: Boolean(dbUser.googleId),
    };

    return {
      user: safeUser,
      semesters,
    };
  } catch {
    return { user: null };
  }
});

/**
 * Server-side Dashboard data prefetcher sharing the same 30s memory cache as `/api/dashboard`.
 */
export async function getServerDashboardData(userId: number): Promise<DashboardData> {
  try {
    const activeSemesterId = await getActiveSemesterId(userId);
    return await getOrSetCache(
      userCacheKey(userId, 'dashboard', String(activeSemesterId ?? 'none')),
      30,
      () => fetchDashboardData(userId)
    );
  } catch (error) {
    console.error('SSR Dashboard prefetch error:', error);
    return getEmptyDashboardData();
  }
}

