import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (!Array.isArray(body.scores)) {
      return NextResponse.json({ message: 'Invalid scores format' }, { status: 400 });
    }

    for (const score of body.scores) {
      const dataToUpdate: Record<string, unknown> = {};
      if (score.midterm_score !== undefined) {
        dataToUpdate.midtermScore = score.midterm_score === '' ? null : Number(score.midterm_score);
      }
      if (score.final_score !== undefined) {
        dataToUpdate.finalScore = score.final_score === '' ? null : Number(score.final_score);
      }
      if (score.affective_score !== undefined) {
        dataToUpdate.affectiveScore = score.affective_score === '' ? null : Number(score.affective_score);
      }

      if (Object.keys(dataToUpdate).length > 0) {
        // Find student first to verify ownership
        const student = await prisma.student.findUnique({
          where: { id: score.student_id },
        });

        if (student && student.userId === user.id) {
          await prisma.student.update({
            where: { id: score.student_id },
            data: dataToUpdate,
          });
        }
      }
    }

    return NextResponse.json({ message: 'Exams updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update exams error:', error);
    return NextResponse.json({ message: 'Failed to update exams' }, { status: 500 });
  }
}
