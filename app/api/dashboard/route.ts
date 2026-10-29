import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { getOrSetCache, userCacheKey } from '@/lib/cache';
import { fetchDashboardData, getEmptyDashboardData } from '@/lib/dashboard';
import { getActiveSemesterId } from '@/lib/semester';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const activeSemesterId = await getActiveSemesterId(user.id);

    const data = await getOrSetCache(
      userCacheKey(user.id, 'dashboard', String(activeSemesterId ?? 'none')),
      30,
      () => fetchDashboardData(user.id)
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Dashboard error:', error);
    // Return empty fallback structure on transient database issues to prevent UI crash
    return NextResponse.json({
      data: getEmptyDashboardData(),
      error: 'Failed to get dashboard',
    });
  }
}
