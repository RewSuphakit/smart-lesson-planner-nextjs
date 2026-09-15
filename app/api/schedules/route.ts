import { NextRequest, NextResponse } from 'next/server';
import { ScheduleStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { parseTimeToUtc } from '@/lib/constants';

function isFlagpoleOrHomeroom(ws: { startPeriod?: number; entryType?: string; subjectName?: string | null; subjectCode?: string | null }) {
  if (ws.startPeriod === 0) return true;
  if (ws.entryType === 'homeroom') return true;
  const name = `${ws.subjectName || ''} ${ws.subjectCode || ''}`.toLowerCase();
  if (name.includes('เสาธง') || name.includes('โฮมรูม') || name.includes('เข้าแถว')) return true;
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start and end dates required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ message: 'Invalid start or end date format' }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json({ message: 'Start date cannot be after end date' }, { status: 400 });
    }

    // Guard against unbounded loop DoS: cap date range to maximum 366 days
    const diffMs = Math.abs(end.getTime() - start.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      return NextResponse.json({ message: 'Date range cannot exceed 366 days' }, { status: 400 });
    }

    // Normalize boundaries in UTC
    const startUtc = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
    const endUtc = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));

    // Get weekly schedules
    const weeklySchedules = await prisma.weeklySchedule.findMany({
      where: { userId: user.id },
    });

    // Get concrete schedules
    const concreteSchedules = await prisma.schedule.findMany({
      where: {
        userId: user.id,
        scheduledDate: { gte: startUtc, lte: endUtc },
      },
      orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
    });

    const mappedConcrete = concreteSchedules.map(s => ({
      id: s.id,
      lesson_title: s.title,
      subject: s.subject,
      scheduled_date: s.scheduledDate.toISOString(),
      start_time: s.startTime.toISOString().split('T')[1],
      end_time: s.endTime.toISOString().split('T')[1],
      notes: s.notes,
      status: s.status
    }));

    interface VirtualSchedule {
      id: string;
      lesson_title: string;
      subject: string;
      scheduled_date: string;
      start_time: string;
      end_time: string;
      notes: string;
      status: string;
    }
    const resultSchedules: VirtualSchedule[] = [];
    const current = new Date(startUtc);

    while (current <= endUtc) {
      const dateStr = current.toISOString().split('T')[0];
      const jsDay = current.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const dbDay = jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon, ..., 6 = Sun

      const dayWeeklySlots = weeklySchedules.filter(ws => ws.dayOfWeek === dbDay);
      const dayConcrete = mappedConcrete.filter(c => c.scheduled_date.startsWith(dateStr));

      for (const slot of dayWeeklySlots) {
        if (isFlagpoleOrHomeroom(slot)) continue;
        const slotStartStr = slot.startTime ? slot.startTime.toISOString().split('T')[1] : '08:30:00.000Z';
        const slotEndStr = slot.endTime ? slot.endTime.toISOString().split('T')[1] : '10:30:00.000Z';

        const slotStartMs = slot.startTime ? slot.startTime.getTime() : new Date(`1970-01-01T08:30:00.000Z`).getTime();
        const slotEndMs = slot.endTime ? slot.endTime.getTime() : new Date(`1970-01-01T10:30:00.000Z`).getTime();

        // Check for time overlap in the same day
        const overlapping = dayConcrete.find(c => {
          const cStartMs = new Date(`1970-01-01T${c.start_time}`).getTime();
          const cEndMs = new Date(`1970-01-01T${c.end_time}`).getTime();
          return (cStartMs < slotEndMs) && (cEndMs > slotStartMs);
        });

        if (!overlapping) {
          resultSchedules.push({
            id: `virtual_${slot.id}_${dateStr}`,
            lesson_title: slot.subjectName || slot.subjectCode || 'วิชาทั่วไป',
            subject: slot.subjectName || slot.subjectCode || 'วิชาทั่วไป',
            scheduled_date: `${dateStr}T12:00:00.000Z`, // Middle of the day for calendar parsing
            start_time: slotStartStr,
            end_time: slotEndStr,
            notes: `ตารางเรียนประจำสัปดาห์ (ห้อง: ${slot.room || '-'})`,
            status: 'scheduled',
          });
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Combined virtual and concrete schedules
    const data = [...resultSchedules, ...mappedConcrete];
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Get schedules error:', error);
    return NextResponse.json({ message: 'Failed to get schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (body.action === 'generate') {
      const startDateStr = body.start_date;
      if (!startDateStr) {
        return NextResponse.json({ message: 'กรุณาระบุวันเริ่มต้นภาคเรียน' }, { status: 400 });
      }

      const startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ message: 'รูปแบบวันเริ่มต้นภาคเรียนไม่ถูกต้อง' }, { status: 400 });
      }

      // Fetch classrooms, weekly schedules (with classroomId, excluding homeroom/flagpole)
      const classrooms = await prisma.classroom.findMany({ where: { userId: user.id } });
      const rawWeeklySchedules = await prisma.weeklySchedule.findMany({
        where: { userId: user.id, classroomId: { not: null } },
      });
      const weeklySchedules = rawWeeklySchedules.filter(ws => !isFlagpoleOrHomeroom(ws));

      if (weeklySchedules.length === 0) {
        return NextResponse.json({
          message: 'ไม่พบคาบเรียนวิชาการที่เชื่อมกับห้องเรียน กรุณาไปตั้งค่าที่เมนู "ตารางเรียน" → คลิกที่คาบวิชา → เลือกห้องเรียน (คาบกิจกรรมหน้าเสาธง/โฮมรูมไม่นับเป็นคาบสอน)',
        }, { status: 400 });
      }

      // Track how many schedules generated per classroom
      const classroomCounts: Record<number, number> = {};
      for (const room of classrooms) {
        classroomCounts[room.id] = 0;
      }

      interface ScheduleInput {
        userId: number;
        title: string;
        subject: string;
        scheduledDate: Date;
        startTime: Date;
        endTime: Date;
        notes: string;
        status: ScheduleStatus;
      }
      const schedulesToCreate: ScheduleInput[] = [];
      const currentDate = new Date(startDate);
      const maxDays = 365;
      let daysProcessed = 0;

      // Get unique classroomIds from timetable
      const linkedClassroomIds = [...new Set(weeklySchedules.map(ws => ws.classroomId!))];
      const linkedClassrooms = classrooms.filter(c => linkedClassroomIds.includes(c.id));

      while (daysProcessed < maxDays) {
        const allDone = linkedClassrooms.every(room => classroomCounts[room.id] >= room.totalClasses);
        if (allDone) break;

        const jsDay = currentDate.getDay();
        const dbDay = jsDay === 0 ? 6 : jsDay - 1; // Convert: Sun=6, Mon=0, etc.

        const daySlots = weeklySchedules.filter(ws => ws.dayOfWeek === dbDay);

        for (const slot of daySlots) {
          const room = classrooms.find(c => c.id === slot.classroomId);
          if (!room) continue;

          if (classroomCounts[room.id] >= room.totalClasses) continue;

          const title = slot.subjectName || slot.subjectCode || 'วิชาทั่วไป';
          const subject = slot.subjectName || slot.subjectCode || 'วิชาทั่วไป';

          schedulesToCreate.push({
            userId: user.id,
            title,
            subject,
            scheduledDate: new Date(currentDate),
            startTime: slot.startTime ? new Date(slot.startTime) : new Date(`1970-01-01T08:30:00.000Z`),
            endTime: slot.endTime ? new Date(slot.endTime) : new Date(`1970-01-01T10:30:00.000Z`),
            notes: `สร้างอัตโนมัติ: ${slot.subjectCode || ''} ${slot.subjectName || ''} — ${room.name}`,
            status: 'scheduled'
          });

          classroomCounts[room.id]++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
        daysProcessed++;
      }

      // Execute delete existing and create new atomically in a transaction to prevent data loss
      await prisma.$transaction([
        prisma.schedule.deleteMany({
          where: {
            userId: user.id,
            OR: [
              { notes: { startsWith: 'สร้างอัตโนมัติ:' } },
              { title: { contains: 'เสาธง' } },
              { subject: { contains: 'เสาธง' } },
              { title: { contains: 'เข้าแถว' } },
              { subject: { contains: 'เข้าแถว' } },
            ],
          },
        }),
        ...(schedulesToCreate.length > 0
          ? [prisma.schedule.createMany({ data: schedulesToCreate })]
          : []),
      ]);

      const summary = classrooms.map(room => ({
        classroom_name: room.name,
        total_classes_defined: room.totalClasses,
        generated_schedules: classroomCounts[room.id] || 0
      })).filter(s => s.generated_schedules > 0);

      return NextResponse.json({
        message: `สร้างตารางสอนล่วงหน้าสำเร็จ ${schedulesToCreate.length} รายการ`,
        summary
      }, { status: 201 });
    }

    if (!body.title || !body.subject || !body.scheduled_date || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { message: 'Missing required fields (title, subject, scheduled_date, start_time, end_time)' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(body.scheduled_date);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ message: 'Invalid scheduled_date format' }, { status: 400 });
    }

    const startTime = parseTimeToUtc(body.start_time);
    const endTime = parseTimeToUtc(body.end_time);
    if (!startTime || !endTime) {
      return NextResponse.json({ message: 'Invalid start_time or end_time format (expected HH:mm)' }, { status: 400 });
    }

    const validStatuses = ['scheduled', 'completed', 'cancelled'];
    const status = body.status && validStatuses.includes(body.status) ? (body.status as ScheduleStatus) : ScheduleStatus.scheduled;

    const schedule = await prisma.schedule.create({
      data: {
        userId: user.id,
        title: String(body.title).trim(),
        subject: String(body.subject).trim(),
        scheduledDate,
        startTime,
        endTime,
        notes: body.notes ? String(body.notes).trim() : null,
        status,
      },
    });

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Create schedule error:', error);
    return NextResponse.json({ message: 'Failed to create schedule' }, { status: 500 });
  }
}
