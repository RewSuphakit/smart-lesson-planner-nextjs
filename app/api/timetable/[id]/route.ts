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

    // Check ownership
    const entry = await prisma.weeklySchedule.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!entry) return NextResponse.json({ message: 'Entry not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      timetable_name: 'timetableName', semester: 'semester', day_of_week: 'dayOfWeek',
      start_period: 'startPeriod', end_period: 'endPeriod',
      subject_code: 'subjectCode', subject_name: 'subjectName',
      room: 'room', instructor: 'instructor', group_name: 'groupName',
      entry_type: 'entryType', color: 'color',
      classroom_id: 'classroomId',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updateData[prismaKey] = body[key];
    }

    const finalStartPeriod = body.start_period !== undefined ? Number(body.start_period) : entry.startPeriod;
    const finalEndPeriod = body.end_period !== undefined ? Number(body.end_period) : entry.endPeriod;
    
    updateData.hours = finalStartPeriod === 0 ? 0 : (finalEndPeriod - finalStartPeriod + 1);

    if (body.start_time !== undefined) {
      updateData.startTime = body.start_time ? new Date(`1970-01-01T${body.start_time}`) : null;
    } else if (body.start_period !== undefined) {
      const startTimeStr = PERIOD_TIMES[finalStartPeriod]?.start;
      updateData.startTime = startTimeStr ? new Date(`1970-01-01T${startTimeStr}`) : null;
    }

    if (body.end_time !== undefined) {
      updateData.endTime = body.end_time ? new Date(`1970-01-01T${body.end_time}`) : null;
    } else if (body.end_period !== undefined) {
      const endTimeStr = PERIOD_TIMES[finalEndPeriod]?.end;
      updateData.endTime = endTimeStr ? new Date(`1970-01-01T${endTimeStr}`) : null;
    }

    await prisma.weeklySchedule.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Entry updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    // Check ownership
    const entry = await prisma.weeklySchedule.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!entry) return NextResponse.json({ message: 'Entry not found' }, { status: 404 });

    await prisma.weeklySchedule.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Entry deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete entry' }, { status: 500 });
  }
}
