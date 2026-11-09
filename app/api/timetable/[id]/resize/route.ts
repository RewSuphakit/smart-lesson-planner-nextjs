import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { PERIOD_TIMES, parseTimeToUtc } from '@/lib/constants';
import { invalidateCache, userCacheKey } from '@/lib/cache';

export const PUT = withAuth<{ id: string }>(async (request, user, { params }) => {
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

  const endPeriod = body.end_period !== undefined ? Number(body.end_period) : entry.endPeriod;
  const startPeriod = entry.startPeriod;

  if (endPeriod < startPeriod) {
    return NextResponse.json({ message: 'End period cannot be less than start period' }, { status: 400 });
  }
  if (endPeriod > 12) {
    return NextResponse.json({ message: 'คาบเรียนเกินช่วงเวลาทำการสูงสุด (คาบที่ 12)' }, { status: 400 });
  }

  const hours = startPeriod === 0 ? 0 : (endPeriod - startPeriod + 1);
  
  const endTimeStr = PERIOD_TIMES[endPeriod]?.end;
  const endTime = parseTimeToUtc(endTimeStr);

  await prisma.weeklySchedule.update({
    where: { id: numericId },
    data: {
      endPeriod,
      hours,
      endTime,
    },
  });

  invalidateCache(userCacheKey(user.id, 'timetable'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));

  return NextResponse.json({ message: 'Timetable resized successfully' });
}, 'Failed to resize timetable');

