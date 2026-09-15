import { NextRequest, NextResponse } from 'next/server';
import { ScheduleStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { parseTimeToUtc } from '@/lib/constants';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid schedule ID' }, { status: 400 });
    }

    const body = await request.json();

    // Check ownership
    const schedule = await prisma.schedule.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!schedule) return NextResponse.json({ message: 'Schedule not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.subject !== undefined) updateData.subject = String(body.subject).trim();
    if (body.scheduled_date !== undefined) {
      const d = new Date(body.scheduled_date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ message: 'Invalid scheduled_date format' }, { status: 400 });
      }
      updateData.scheduledDate = d;
    }
    if (body.start_time !== undefined) {
      const parsed = parseTimeToUtc(body.start_time);
      if (!parsed) {
        return NextResponse.json({ message: 'Invalid start_time format (expected HH:mm)' }, { status: 400 });
      }
      updateData.startTime = parsed;
    }
    if (body.end_time !== undefined) {
      const parsed = parseTimeToUtc(body.end_time);
      if (!parsed) {
        return NextResponse.json({ message: 'Invalid end_time format (expected HH:mm)' }, { status: 400 });
      }
      updateData.endTime = parsed;
    }
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes).trim() : null;
    if (body.status !== undefined) {
      const validStatuses: string[] = [ScheduleStatus.scheduled, ScheduleStatus.completed, ScheduleStatus.cancelled];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { message: 'Invalid status. Must be scheduled, completed, or cancelled' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    await prisma.schedule.update({ where: { id: numericId }, data: updateData });
    return NextResponse.json({ message: 'Schedule updated' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid schedule ID' }, { status: 400 });
    }

    // Check ownership
    const schedule = await prisma.schedule.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!schedule) return NextResponse.json({ message: 'Schedule not found' }, { status: 404 });

    await prisma.schedule.delete({ where: { id: numericId } });
    return NextResponse.json({ message: 'Schedule deleted' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to delete schedule' }, { status: 500 });
  }
}
