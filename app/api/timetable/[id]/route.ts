import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      timetable_name: 'timetableName', semester: 'semester', day_of_week: 'dayOfWeek',
      start_period: 'startPeriod', end_period: 'endPeriod',
      subject_code: 'subjectCode', subject_name: 'subjectName',
      room: 'room', instructor: 'instructor', group_name: 'groupName',
      hours: 'hours', entry_type: 'entryType', color: 'color',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updateData[prismaKey] = body[key];
    }

    if (body.start_time !== undefined) updateData.startTime = body.start_time ? new Date(`1970-01-01T${body.start_time}`) : null;
    if (body.end_time !== undefined) updateData.endTime = body.end_time ? new Date(`1970-01-01T${body.end_time}`) : null;

    await prisma.weeklySchedule.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Entry updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    await prisma.weeklySchedule.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Entry deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete entry' }, { status: 500 });
  }
}
