import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const lessonPlanId = searchParams.get('lesson_plan_id');
    const studentId = searchParams.get('student_id');

    if (lessonPlanId) {
      const evaluations = await prisma.evaluation.findMany({
        where: { lessonPlanId: Number(lessonPlanId) },
        include: { student: { select: { name: true, studentCode: true } } },
        orderBy: { student: { name: 'asc' } },
      });
      return NextResponse.json(evaluations);
    }

    if (studentId) {
      const evaluations = await prisma.evaluation.findMany({
        where: { studentId: Number(studentId) },
        include: { lessonPlan: { select: { title: true, subject: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(evaluations);
    }

    // Summary
    const agg = await prisma.evaluation.aggregate({
      where: { userId: user.id },
      _count: true,
      _avg: { score: true },
    });

    return NextResponse.json({
      total_evaluations: agg._count,
      avg_score: agg._avg.score,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get evaluations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    const evaluation = await prisma.evaluation.create({
      data: {
        studentId: body.student_id,
        lessonPlanId: body.lesson_plan_id,
        userId: user.id,
        score: body.score,
        maxScore: body.max_score || 100,
        participation: body.participation || 'average',
        notes: body.notes || null,
      },
    });

    return NextResponse.json(evaluation, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to create evaluation' }, { status: 500 });
  }
}
