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
        dayOfWeek: body.day_of_week,
        startPeriod: body.start_period,
        endPeriod: body.end_period,
      },
    });

    return NextResponse.json({ message: 'Timetable moved successfully' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Move timetable error:', error);
    return NextResponse.json({ message: 'Failed to move timetable' }, { status: 500 });
  }
}
