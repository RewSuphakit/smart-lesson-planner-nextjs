import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const entry = await prisma.weeklySchedule.findUnique({ where: { id: Number(id) } });
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
    }

    await prisma.weeklySchedule.update({
      where: { id: Number(id) },
      data: {
        endPeriod: body.end_period,
        hours: body.hours,
      },
    });

    return NextResponse.json({ message: 'Timetable resized successfully' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Resize timetable error:', error);
    return NextResponse.json({ message: 'Failed to resize timetable' }, { status: 500 });
  }
}
