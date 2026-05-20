import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const entries = await prisma.weeklySchedule.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: 'asc' }],
    });
    const mappedEntries = entries.map(e => ({
      id: e.id,
      day_of_week: e.dayOfWeek,
      start_period: e.startPeriod,
      end_period: e.endPeriod,
      subject_code: e.subjectCode,
      subject_name: e.subjectName,
      room: e.room,
      instructor: e.instructor,
      group_name: e.groupName,
      hours: e.hours,
      entry_type: e.entryType,
      color: e.color
    }));
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
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get timetable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk create
    if (Array.isArray(body.entries)) {
      const data = body.entries.map((e: Record<string, unknown>) => ({
        userId: user.id,
        timetableName: (e.timetable_name as string) || 'ตารางสอน',
        semester: (e.semester as string) || null,
        dayOfWeek: e.day_of_week as number,
        startPeriod: e.start_period as number,
        endPeriod: e.end_period as number,
        startTime: e.start_time ? new Date(`1970-01-01T${e.start_time}`) : null,
        endTime: e.end_time ? new Date(`1970-01-01T${e.end_time}`) : null,
        subjectCode: (e.subject_code as string) || null,
        subjectName: (e.subject_name as string) || null,
        room: (e.room as string) || null,
        instructor: (e.instructor as string) || null,
        groupName: (e.group_name as string) || null,
        hours: (e.hours as number) ?? 1,
        entryType: (e.entry_type as string) || 'lecture',
        color: (e.color as string) || null,
      }));

      await prisma.weeklySchedule.createMany({ data });
      return NextResponse.json({ message: 'Timetable entries created' }, { status: 201 });
    }

    // Single create
    const entry = await prisma.weeklySchedule.create({
      data: {
        userId: user.id,
        timetableName: body.timetable_name || 'ตารางสอน',
        semester: body.semester || null,
        dayOfWeek: body.day_of_week,
        startPeriod: body.start_period,
        endPeriod: body.end_period,
        startTime: body.start_time ? new Date(`1970-01-01T${body.start_time}`) : null,
        endTime: body.end_time ? new Date(`1970-01-01T${body.end_time}`) : null,
        subjectCode: body.subject_code || null,
        subjectName: body.subject_name || null,
        room: body.room || null,
        instructor: body.instructor || null,
        groupName: body.group_name || null,
        hours: body.hours ?? 1,
        entryType: body.entry_type || 'lecture',
        color: body.color || null,
      },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
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
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to clear timetable' }, { status: 500 });
  }
}
