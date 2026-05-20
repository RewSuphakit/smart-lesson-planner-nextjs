import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Check ownership
    const student = await prisma.student.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: 'name', student_code: 'studentCode', grade_level: 'gradeLevel',
      email: 'email', classroom_id: 'classroomId',
      midterm_score: 'midtermScore', final_score: 'finalScore',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updateData[prismaKey] = body[key];
    }

    await prisma.student.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Student updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    // Check ownership
    const student = await prisma.student.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

    await prisma.student.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Student deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete student' }, { status: 500 });
  }
}
