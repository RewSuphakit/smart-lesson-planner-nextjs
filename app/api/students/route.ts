import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');

    const where: Record<string, unknown> = { userId: user.id };
    if (classroomId) where.classroomId = Number(classroomId);

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const mappedStudents = students.map(s => ({
      id: s.id,
      name: s.name,
      student_code: s.studentCode,
      grade_level: s.gradeLevel,
      email: s.email,
      classroom_id: s.classroomId,
      midterm_score: s.midtermScore,
      final_score: s.finalScore
    }));

    return NextResponse.json({ data: mappedStudents });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk create
    if (Array.isArray(body.students)) {
      const data = body.students.map((s: Record<string, unknown>) => ({
        userId: user.id,
        name: s.name as string,
        studentCode: (s.student_code as string) || null,
        gradeLevel: (s.grade_level as string) || null,
        email: (s.email as string) || null,
        classroomId: s.classroom_id ? Number(s.classroom_id) : null,
      }));

      const result = await prisma.student.createMany({ data });
      return NextResponse.json({ message: `Created ${result.count} students` }, { status: 201 });
    }

    // Single create
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name: body.name,
        studentCode: body.student_code || null,
        gradeLevel: body.grade_level || null,
        email: body.email || null,
        classroomId: body.classroom_id ? Number(body.classroom_id) : null,
      },
    });

    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Create student error:', error);
    return NextResponse.json({ message: 'Failed to create student' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk update classroom
    if (body.student_ids && body.classroom_id !== undefined) {
      await prisma.student.updateMany({
        where: { id: { in: body.student_ids }, userId: user.id },
        data: { classroomId: body.classroom_id || null },
      });
      return NextResponse.json({ message: 'Students updated' });
    }

    // Bulk update exams
    if (Array.isArray(body.scores)) {
      for (const score of body.scores) {
        await prisma.student.update({
          where: { id: score.student_id },
          data: {
            midtermScore: score.midterm_score || 0,
            finalScore: score.final_score || 0,
          },
        });
      }
      return NextResponse.json({ message: 'Scores updated' });
    }

    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update students' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const idsParam = searchParams.get('ids');

    // Case 1: Delete specific students by IDs list
    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(id => !isNaN(id));
      const result = await prisma.student.deleteMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
      });
      return NextResponse.json({ message: `Deleted ${result.count} students`, count: result.count });
    }

    // Case 2: Delete all students (optionally in a specific classroom)
    const where: Record<string, unknown> = { userId: user.id };
    if (classroomId) {
      where.classroomId = Number(classroomId);
    }

    const result = await prisma.student.deleteMany({ where });
    return NextResponse.json({ message: `Deleted ${result.count} students`, count: result.count });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Delete students error:', error);
    return NextResponse.json({ message: 'Failed to delete students' }, { status: 500 });
  }
}
