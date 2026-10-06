import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { PERIOD_TIMES, parseTimeToUtc } from '@/lib/constants';
import { invalidateCache, userCacheKey } from '@/lib/cache';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid timetable ID' }, { status: 400 });
    }

    const body = await request.json();

    const entry = await prisma.weeklySchedule.findUnique({ where: { id: numericId } });
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    const dayOfWeek = body.day_of_week !== undefined ? body.day_of_week : entry.dayOfWeek;
    const startPeriod = body.start_period !== undefined ? body.start_period : entry.startPeriod;
    
    // Maintain the same duration span when moving
    const span = entry.endPeriod - entry.startPeriod;
    const endPeriod = startPeriod + span;

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ message: 'Invalid day of week (0-6)' }, { status: 400 });
    }
    if (startPeriod < 0 || startPeriod > 12) {
      return NextResponse.json({ message: 'Invalid start period (0-12)' }, { status: 400 });
    }
    if (endPeriod < startPeriod) {
      return NextResponse.json({ message: 'End period cannot be less than start period' }, { status: 400 });
    }
    if (endPeriod > 12) {
      return NextResponse.json({ message: 'คาบเรียนเกินช่วงเวลาทำการสูงสุด (คาบที่ 12)' }, { status: 400 });
    }

    const hours = startPeriod === 0 ? 0 : (endPeriod - startPeriod + 1);
    
    const startTimeStr = PERIOD_TIMES[startPeriod]?.start;
    const endTimeStr = PERIOD_TIMES[endPeriod]?.end;
    const startTime = parseTimeToUtc(startTimeStr);
    const endTime = parseTimeToUtc(endTimeStr);

    await prisma.weeklySchedule.update({
      where: { id: numericId },
      data: {
        dayOfWeek,
        startPeriod,
        endPeriod,
        startTime,
        endTime,
        hours,
      },
    });

    invalidateCache(userCacheKey(user.id, 'dashboard'));

    return NextResponse.json({ message: 'Timetable moved successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Move timetable error:', error);
    return NextResponse.json({ message: 'Failed to move timetable' }, { status: 500 });
  }
}

