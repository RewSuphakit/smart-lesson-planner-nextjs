import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { getOrSetCache, userCacheKey } from '@/lib/cache';
import { fetchDashboardData, getEmptyDashboardData } from '@/lib/dashboard';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const data = await getOrSetCache(
      userCacheKey(user.id, 'dashboard'),
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
