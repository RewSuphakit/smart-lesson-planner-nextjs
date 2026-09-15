import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
    }

    const body = await request.json();

    // Check ownership
    const student = await prisma.student.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: 'name', student_code: 'studentCode', grade_level: 'gradeLevel',
      email: 'email', classroom_id: 'classroomId',
      midterm_score: 'midtermScore', final_score: 'finalScore',
    };

    // Lookup classroom max scores if updating exam scores
    let classroomMaxScores: { midterm: number; final: number } = { midterm: 100, final: 100 };
    if (body.midterm_score !== undefined || body.final_score !== undefined) {
      const targetClassroomId =
        body.classroom_id !== undefined
          ? body.classroom_id
            ? Number(body.classroom_id)
            : null
          : student.classroomId;
      if (targetClassroomId) {
        const cls = await prisma.classroom.findUnique({
          where: { id: targetClassroomId },
          select: { midtermMaxScore: true, finalMaxScore: true },
        });
        if (cls) {
          classroomMaxScores = {
            midterm: cls.midtermMaxScore ? Number(cls.midtermMaxScore) : 100,
            final: cls.finalMaxScore ? Number(cls.finalMaxScore) : 100,
          };
        }
      }
    }

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        let val = body[key];
        if (prismaKey === 'classroomId') {
          if (val) {
            const ownedClassroom = await prisma.classroom.findFirst({
              where: { id: Number(val), userId: user.id },
            });
            if (!ownedClassroom) {
              return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
            }
            val = Number(val);
          } else {
            val = null;
          }
        } else if (prismaKey === 'midtermScore' || prismaKey === 'finalScore') {
          if (val === '' || val === null || val === undefined) {
            val = null;
          } else {
            const num = Number(val);
            if (isNaN(num)) {
              val = null;
            } else if (num === -1 || num === -2) {
              // Special scores: -1 = ขาดสอบ (absent), -2 = หมดสิทธิ์สอบ (no rights)
              val = num;
            } else {
              const maxScore = prismaKey === 'midtermScore' ? classroomMaxScores.midterm : classroomMaxScores.final;
              val = Math.min(maxScore, Math.max(0, num));
            }
          }
        } else if (['studentCode', 'gradeLevel', 'email'].includes(prismaKey)) {
          val = val || null;
        }
        updateData[prismaKey] = val;
      }
    }

    await prisma.student.update({ where: { id: numericId }, data: updateData });
    return NextResponse.json({ message: 'Student updated' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update student error:', error);
    return NextResponse.json({ message: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
    }

    // Check ownership
    const student = await prisma.student.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

    await prisma.student.delete({ where: { id: numericId } });
    return NextResponse.json({ message: 'Student deleted' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to delete student' }, { status: 500 });
  }
}
