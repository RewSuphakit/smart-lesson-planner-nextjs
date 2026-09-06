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
            val = isNaN(num) ? null : Math.min(100, Math.max(0, num));
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
