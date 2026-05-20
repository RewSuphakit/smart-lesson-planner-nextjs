import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Check ownership
    const schedule = await prisma.schedule.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!schedule) return NextResponse.json({ message: 'Schedule not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (body.lesson_plan_id !== undefined) updateData.lessonPlanId = body.lesson_plan_id;
    if (body.scheduled_date !== undefined) updateData.scheduledDate = new Date(body.scheduled_date);
    if (body.start_time !== undefined) updateData.startTime = new Date(`1970-01-01T${body.start_time}`);
    if (body.end_time !== undefined) updateData.endTime = new Date(`1970-01-01T${body.end_time}`);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    await prisma.schedule.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Schedule updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    // Check ownership
    const schedule = await prisma.schedule.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!schedule) return NextResponse.json({ message: 'Schedule not found' }, { status: 404 });

    await prisma.schedule.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Schedule deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete schedule' }, { status: 500 });
  }
}
