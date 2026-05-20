import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const [lessonCount, studentCount, upcomingSchedulesRaw, evaluations] = await Promise.all([
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
      prisma.evaluation.findMany({
        where: { userId: user.id },
        select: { score: true, maxScore: true, participation: true }
      })
    ]);

    const upcomingSchedules = upcomingSchedulesRaw.map(s => ({
      scheduled_date: s.scheduledDate.toISOString(),
      start_time: s.startTime.toISOString().split('T')[1] || '',
      end_time: s.endTime.toISOString().split('T')[1] || '',
      status: s.status,
      lesson_title: s.lessonPlan?.title,
      subject: s.lessonPlan?.subject,
    }));

    let totalScore = 0;
    let totalMaxScore = 0;
    const counts = { excellent: 0, good: 0, average: 0, poor: 0 };

    evaluations.forEach(ev => {
      totalScore += Number(ev.score) || 0;
      totalMaxScore += Number(ev.maxScore) || 100;
      counts[ev.participation] = (counts[ev.participation] || 0) + 1;
    });

    const evaluation = {
      total_evaluations: evaluations.length,
      avg_score_percent: totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0,
      excellent_count: counts.excellent,
      good_count: counts.good,
      average_count: counts.average,
      poor_count: counts.poor,
    };

    return NextResponse.json({
      data: {
        totalLessons: lessonCount,
        totalStudents: studentCount,
        upcomingSchedules,
        evaluation
      }
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get dashboard' }, { status: 500 });
  }
}
