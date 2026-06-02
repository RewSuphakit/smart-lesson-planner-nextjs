import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { PERIOD_TIMES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const entries = await prisma.weeklySchedule.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: 'asc' }],
    });
    const mappedEntries = entries.map(e => {
      const hours = e.startPeriod === 0 ? 0 : (e.endPeriod - e.startPeriod + 1);
      return {
        id: e.id,
        day_of_week: e.dayOfWeek,
        start_period: e.startPeriod,
        end_period: e.endPeriod,
        start_time: e.startTime ? e.startTime.toISOString().split('T')[1].slice(0, 5) : null,
        end_time: e.endTime ? e.endTime.toISOString().split('T')[1].slice(0, 5) : null,
        subject_code: e.subjectCode,
        subject_name: e.subjectName,
        room: e.room,
        instructor: e.instructor,
        group_name: e.groupName,
        hours: hours,
        entry_type: e.entryType,
        color: e.color,
        classroom_id: e.classroomId
      };
    });
    const summaryMap = new Map();
    mappedEntries.forEach(e => {
      if (!e.subject_code) return;
      if (!summaryMap.has(e.subject_code)) {
        summaryMap.set(e.subject_code, { subject_code: e.subject_code, subject_name: e.subject_name, total_hours: 0 });
      }
      summaryMap.get(e.subject_code).total_hours += e.hours;
    });
    const summary = Array.from(summaryMap.values());

    return NextResponse.json({ data: { entries: mappedEntries, summary } });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get timetable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk create
    if (Array.isArray(body.entries)) {
      const data = body.entries.map((e: Record<string, unknown>) => {
        const startPeriod = Number(e.start_period);
        const endPeriod = Number(e.end_period);
        const hours = startPeriod === 0 ? 0 : (endPeriod - startPeriod + 1);
        const startTimeStr = (e.start_time as string) || PERIOD_TIMES[startPeriod]?.start;
        const endTimeStr = (e.end_time as string) || PERIOD_TIMES[endPeriod]?.end;

        return {
          userId: user.id,
          timetableName: (e.timetable_name as string) || 'ตารางสอน',
          semester: (e.semester as string) || null,
          dayOfWeek: e.day_of_week as number,
          startPeriod,
          endPeriod,
          startTime: startTimeStr ? new Date(`1970-01-01T${startTimeStr}`) : null,
          endTime: endTimeStr ? new Date(`1970-01-01T${endTimeStr}`) : null,
          subjectCode: (e.subject_code as string) || null,
          subjectName: (e.subject_name as string) || null,
          room: (e.room as string) || null,
          instructor: (e.instructor as string) || null,
          groupName: (e.group_name as string) || null,
          hours,
          entryType: (e.entry_type as string) || 'lecture',
          color: (e.color as string) || null,
          classroomId: e.classroom_id ? Number(e.classroom_id) : null,
        };
      });

      await prisma.weeklySchedule.createMany({ data });
      return NextResponse.json({ message: 'Timetable entries created' }, { status: 201 });
    }

    // Single create
    const startPeriod = Number(body.start_period);
    const endPeriod = Number(body.end_period);
    const hours = startPeriod === 0 ? 0 : (endPeriod - startPeriod + 1);
    const startTimeStr = body.start_time || PERIOD_TIMES[startPeriod]?.start;
    const endTimeStr = body.end_time || PERIOD_TIMES[endPeriod]?.end;

    const entry = await prisma.weeklySchedule.create({
      data: {
        userId: user.id,
        timetableName: body.timetable_name || 'ตารางสอน',
        semester: body.semester || null,
        dayOfWeek: Number(body.day_of_week),
        startPeriod,
        endPeriod,
        startTime: startTimeStr ? new Date(`1970-01-01T${startTimeStr}`) : null,
        endTime: endTimeStr ? new Date(`1970-01-01T${endTimeStr}`) : null,
        subjectCode: body.subject_code || null,
        subjectName: body.subject_name || null,
        room: body.room || null,
        instructor: body.instructor || null,
        groupName: body.group_name || null,
        hours,
        entryType: body.entry_type || 'lecture',
        color: body.color || null,
        classroomId: body.classroom_id ? Number(body.classroom_id) : null,
      },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Create timetable error:', error);
    return NextResponse.json({ message: 'Failed to create timetable' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await prisma.weeklySchedule.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ message: 'Timetable cleared' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to clear timetable' }, { status: 500 });
  }
}
