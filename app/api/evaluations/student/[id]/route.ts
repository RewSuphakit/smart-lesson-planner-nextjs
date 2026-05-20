import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const studentId = Number(id);

    const evaluations = await prisma.evaluation.findMany({
      where: {
        studentId,
        userId: user.id,
      },
      include: {
        lessonPlan: { select: { title: true, subject: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const data = evaluations.map(ev => ({
      id: ev.id,
      student_id: ev.studentId,
      lesson_plan_id: ev.lessonPlanId,
      lesson_title: ev.lessonPlan?.title,
      subject: ev.lessonPlan?.subject,
      score: ev.score,
      max_score: ev.maxScore,
      participation: ev.participation,
      notes: ev.notes,
      created_at: ev.createdAt,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get student evaluations' }, { status: 500 });
  }
}
