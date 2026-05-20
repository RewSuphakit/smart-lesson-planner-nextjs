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

    const mappedSchedules = schedules.map(s => ({
      id: s.id,
      lesson_plan_id: s.lessonPlanId,
      lesson_title: s.lessonPlan?.title,
      scheduled_date: s.scheduledDate,
      start_time: s.startTime.toISOString().split('T')[1],
      end_time: s.endTime.toISOString().split('T')[1],
      notes: s.notes,
      status: s.status
    }));

    return NextResponse.json({ data: mappedSchedules });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
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

      // Fetch classrooms, weekly schedules and lesson plans
      const classrooms = await prisma.classroom.findMany({ where: { userId: user.id } });
      const weeklySchedules = await prisma.weeklySchedule.findMany({ where: { userId: user.id } });
      const userLessons = await prisma.lessonPlan.findMany({ where: { userId: user.id } });

      const classroomCounts: Record<number, number> = {};
      for (const room of classrooms) {
        classroomCounts[room.id] = 0;
      }

      const schedulesToCreate: any[] = [];
      let currentDate = new Date(startDate);
      const maxDays = 365; // safety limit to prevent infinite loops
      let daysProcessed = 0;

      while (daysProcessed < maxDays) {
        const roomsToProcess = classrooms.filter(room => 
          weeklySchedules.some(ws => ws.groupName && ws.groupName.trim().toLowerCase() === room.name.trim().toLowerCase())
        );

        if (roomsToProcess.length === 0) break;

        const allDone = roomsToProcess.every(room => classroomCounts[room.id] >= room.totalClasses);
        if (allDone) break;

        const jsDay = currentDate.getDay();
        const dbDay = jsDay === 0 ? 6 : jsDay - 1;

        const daySlots = weeklySchedules.filter(ws => ws.dayOfWeek === dbDay);

        for (const slot of daySlots) {
          if (!slot.groupName) continue;
          const room = classrooms.find(c => c.name.trim().toLowerCase() === slot.groupName!.trim().toLowerCase());
          if (!room) continue;

          if (classroomCounts[room.id] >= room.totalClasses) continue;

          const matchingLessons = userLessons.filter(l => 
            l.subject.trim().toLowerCase() === (slot.subjectName || '').trim().toLowerCase() ||
            l.subject.trim().toLowerCase() === (slot.subjectCode || '').trim().toLowerCase()
          );

          let lessonPlanId: number;
          if (matchingLessons.length > 0) {
            const idx = classroomCounts[room.id] % matchingLessons.length;
            lessonPlanId = matchingLessons[idx].id;
          } else if (userLessons.length > 0) {
            lessonPlanId = userLessons[0].id;
          } else {
            const defaultLesson = await prisma.lessonPlan.create({
              data: {
                userId: user.id,
                title: `แผนการสอน: ${slot.subjectName || slot.subjectCode || 'วิชาทั่วไป'}`,
                subject: slot.subjectName || slot.subjectCode || 'วิชาทั่วไป',
                gradeLevel: room.name,
                duration: slot.hours * 50,
                status: 'draft',
              }
            });
            userLessons.push(defaultLesson);
            lessonPlanId = defaultLesson.id;
          }

          schedulesToCreate.push({
            userId: user.id,
            lessonPlanId,
            scheduledDate: new Date(currentDate),
            startTime: slot.startTime ? new Date(slot.startTime) : new Date(`1970-01-01T08:30:00`),
            endTime: slot.endTime ? new Date(slot.endTime) : new Date(`1970-01-01T10:30:00`),
            notes: `สร้างอัตโนมัติจากคาบ ${slot.subjectCode || ''} ${slot.subjectName || ''}`,
            status: 'scheduled'
          });

          classroomCounts[room.id]++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
        daysProcessed++;
      }

      if (schedulesToCreate.length > 0) {
        await prisma.schedule.createMany({
          data: schedulesToCreate
        });
      }

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

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Create schedule error:', error);
    return NextResponse.json({ message: 'Failed to create schedule' }, { status: 500 });
  }
}
