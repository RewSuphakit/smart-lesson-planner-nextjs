import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { PERIOD_TIMES } from '@/lib/constants';

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

    const endPeriod = body.end_period !== undefined ? body.end_period : entry.endPeriod;
    const startPeriod = entry.startPeriod;

    if (endPeriod < startPeriod) {
      return NextResponse.json({ message: 'End period cannot be less than start period' }, { status: 400 });
    }

    const hours = startPeriod === 0 ? 0 : (endPeriod - startPeriod + 1);
    
    const endTimeStr = PERIOD_TIMES[endPeriod]?.end;
    const endTime = endTimeStr ? new Date(`1970-01-01T${endTimeStr}.000Z`) : null;

    await prisma.weeklySchedule.update({
      where: { id: numericId },
      data: {
        endPeriod,
        hours,
        endTime,
      },
    });

    return NextResponse.json({ message: 'Timetable resized successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Resize timetable error:', error);
    return NextResponse.json({ message: 'Failed to resize timetable' }, { status: 500 });
  }
}

