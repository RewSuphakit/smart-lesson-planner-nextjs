import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiHandler';
import { logger } from '@/lib/logger';
import { getOrSetCache, userCacheKey } from '@/lib/cache';
import { fetchDashboardData, getEmptyDashboardData } from '@/lib/dashboard';
import { getActiveSemesterId } from '@/lib/semester';

export const GET = withAuth(async (_request, user) => {
  try {
    const activeSemesterId = await getActiveSemesterId(user.id);

    const data = await getOrSetCache(
      userCacheKey(user.id, 'dashboard', String(activeSemesterId ?? 'none')),
      30,
      () => fetchDashboardData(user.id)
    );

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Dashboard error:', error);
    // Return empty fallback structure on transient database issues to prevent UI crash
    return NextResponse.json({
      data: getEmptyDashboardData(),
      error: 'Failed to get dashboard',
    });
  }
});
