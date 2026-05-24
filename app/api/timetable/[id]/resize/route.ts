import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  0:  { start: '07:30', end: '08:00' },
  1:  { start: '08:00', end: '09:00' },
  2:  { start: '09:00', end: '10:00' },
  3:  { start: '10:00', end: '11:00' },
  4:  { start: '11:00', end: '12:00' },
  5:  { start: '13:00', end: '14:00' },
  6:  { start: '14:00', end: '15:00' },
  7:  { start: '15:00', end: '16:00' },
  8:  { start: '16:00', end: '17:00' },
  9:  { start: '17:00', end: '18:00' },
  10: { start: '18:00', end: '19:00' },
  11: { start: '19:00', end: '20:00' },
  12: { start: '20:00', end: '21:00' },
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const entry = await prisma.weeklySchedule.findUnique({ where: { id: Number(id) } });
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
    const endTime = endTimeStr ? new Date(`1970-01-01T${endTimeStr}`) : null;

    await prisma.weeklySchedule.update({
      where: { id: Number(id) },
      data: {
        endPeriod,
        hours,
        endTime,
      },
    });

    return NextResponse.json({ message: 'Timetable resized successfully' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Resize timetable error:', error);
    return NextResponse.json({ message: 'Failed to resize timetable' }, { status: 500 });
  }
}

