import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { UpdateStudentExamScoresSchema, validateRequestBody } from '@/lib/validation';
import { invalidateCache, userCacheKey } from '@/lib/cache';
import { sanitizeExamScore } from '@/lib/sanitize';

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const validation = await validateRequestBody(request, UpdateStudentExamScoresSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;

    const studentIds: number[] = Array.from(
      new Set(body.scores.map((s: { student_id: string | number }) => Number(s.student_id)).filter((id: number) => !isNaN(id)))
    );

    const ownedStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, userId: user.id },
      select: { id: true },
    });
    const ownedSet = new Set(ownedStudents.map(s => s.id));

    // Group students with identical score payloads so bulk updates (e.g. resetting affective score)
    // execute a single `updateMany` query instead of N individual `update` queries.
    const groupedUpdates = new Map<string, { data: Record<string, unknown>; ids: number[] }>();

    for (const score of body.scores) {
      const studentId = Number(score.student_id);
      if (!ownedSet.has(studentId)) {
        continue;
      }

      const dataToUpdate: Record<string, unknown> = {};
      if (score.midterm_score !== undefined) {
        dataToUpdate.midtermScore = sanitizeExamScore(score.midterm_score, false);
      }
      if (score.final_score !== undefined) {
        dataToUpdate.finalScore = sanitizeExamScore(score.final_score, true);
      }
      if (score.affective_score !== undefined) {
        dataToUpdate.affectiveScore = sanitizeExamScore(score.affective_score, false);
      }

      if (Object.keys(dataToUpdate).length > 0) {
        const key = JSON.stringify(dataToUpdate);
        const existing = groupedUpdates.get(key);
        if (existing) {
          existing.ids.push(studentId);
        } else {
          groupedUpdates.set(key, { data: dataToUpdate, ids: [studentId] });
        }
      }
    }

    const updateOperations = Array.from(groupedUpdates.values()).map(({ data, ids }) =>
      ids.length === 1
        ? prisma.student.update({
            where: { id: ids[0] },
            data,
          })
        : prisma.student.updateMany({
            where: { id: { in: ids }, userId: user.id },
            data,
          })
    );

    if (updateOperations.length > 0) {
      await prisma.$transaction(updateOperations);
    }

    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));

    return NextResponse.json({ message: 'Exams updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update exams error:', error);
    return NextResponse.json({ message: 'Failed to update exams' }, { status: 500 });
  }
}
