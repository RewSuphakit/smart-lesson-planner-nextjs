import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { UpdateStudentExamScoresSchema, validateRequestBody } from '@/lib/validation';

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

    const updateOperations = [];

    // Helper to sanitize score values: converts empty/null to null, validates numbers, and clamps between 0 and 999.99
    const sanitizeExamScore = (val: unknown, allowSpecialCodes = false): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      if (isNaN(num)) return null;
      // Allow special vocational education status codes: -1 = ข.ส. (ขาดสอบ), -2 = ม.ส. (ไม่สมบูรณ์)
      if (allowSpecialCodes && (num === -1 || num === -2)) {
        return num;
      }
      return Math.min(999.99, Math.max(0, num));
    };

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
