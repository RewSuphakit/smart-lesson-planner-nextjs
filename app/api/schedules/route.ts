import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start and end dates required' }, { status: 400 });
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: user.id,
        scheduledDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: {
        lessonPlan: { select: { title: true, subject: true, gradeLevel: true, duration: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    const schedule = await prisma.schedule.create({
      data: {
        userId: user.id,
        lessonPlanId: body.lesson_plan_id,
        scheduledDate: new Date(body.scheduled_date),
        startTime: new Date(`1970-01-01T${body.start_time}`),
        endTime: new Date(`1970-01-01T${body.end_time}`),
        notes: body.notes || null,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to create schedule' }, { status: 500 });
  }
}
