import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const [lessonCount, studentCount, upcomingSchedules] = await Promise.all([
      prisma.lessonPlan.count({ where: { userId: user.id } }),
      prisma.student.count({ where: { userId: user.id } }),
      prisma.schedule.findMany({
        where: {
          userId: user.id,
          scheduledDate: { gte: new Date() },
          status: 'scheduled',
        },
        include: { lessonPlan: { select: { title: true, subject: true } } },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        take: 5,
      }),
    ]);

    return NextResponse.json({
      lessonCount,
      studentCount,
      upcomingSchedules,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get dashboard' }, { status: 500 });
  }
}
