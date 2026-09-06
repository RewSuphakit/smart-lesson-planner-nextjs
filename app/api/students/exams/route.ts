import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (!Array.isArray(body.scores) || body.scores.length === 0) {
      return NextResponse.json({ message: 'Invalid scores format' }, { status: 400 });
    }

    const studentIds: number[] = Array.from(
      new Set(body.scores.map((s: { student_id: string | number }) => Number(s.student_id)).filter((id: number) => !isNaN(id)))
    );

    const ownedStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, userId: user.id },
      select: { id: true },
    });
    const ownedSet = new Set(ownedStudents.map(s => s.id));

    const updateOperations = [];

    for (const score of body.scores) {
      const studentId = Number(score.student_id);
      if (!ownedSet.has(studentId)) {
        continue;
      }

      const dataToUpdate: Record<string, unknown> = {};
      if (score.midterm_score !== undefined) {
        dataToUpdate.midtermScore = score.midterm_score === '' || score.midterm_score === null ? null : Number(score.midterm_score);
      }
      if (score.final_score !== undefined) {
        dataToUpdate.finalScore = score.final_score === '' || score.final_score === null ? null : Number(score.final_score);
      }
      if (score.affective_score !== undefined) {
        if (score.affective_score === '' || score.affective_score === null) {
          dataToUpdate.affectiveScore = null;
        } else {
          dataToUpdate.affectiveScore = Math.max(0, Number(score.affective_score));
        }
      }

      if (Object.keys(dataToUpdate).length > 0) {
        updateOperations.push(
          prisma.student.update({
            where: { id: studentId },
            data: dataToUpdate,
          })
        );
      }
    }

    if (updateOperations.length > 0) {
      await prisma.$transaction(updateOperations);
    }

    return NextResponse.json({ message: 'Exams updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update exams error:', error);
    return NextResponse.json({ message: 'Failed to update exams' }, { status: 500 });
  }
}
