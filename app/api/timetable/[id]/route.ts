import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { PERIOD_TIMES } from '@/lib/constants';

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
      if (body[key] !== undefined) {
        if (prismaKey === 'classroomId') {
          if (body[key]) {
            const ownedClassroom = await prisma.classroom.findFirst({
              where: { id: Number(body[key]), userId: user.id },
            });
            if (!ownedClassroom) {
              return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
            }
            updateData[prismaKey] = Number(body[key]);
          } else {
            updateData[prismaKey] = null;
          }
        } else {
          updateData[prismaKey] = body[key];
        }
      }
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
    if (error instanceof AuthError) return handleAuthError();
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
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to delete entry' }, { status: 500 });
  }
}
