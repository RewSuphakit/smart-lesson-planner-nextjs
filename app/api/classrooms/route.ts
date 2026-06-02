import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      late_to_absent_ratio: c.lateToAbsentRatio,
      leave_to_absent_ratio: c.leaveToAbsentRatio,
      absent_to_f_ratio: c.absentToFRatio,
      total_classes: c.totalClasses,
      min_attendance_percent: c.minAttendancePercent,
      student_count: c._count.students,
      assignment_weight: c.assignmentWeight ? Number(c.assignmentWeight) : 10,
      post_test_weight: c.postTestWeight ? Number(c.postTestWeight) : 70,
      affective_weight: c.affectiveWeight ? Number(c.affectiveWeight) : 20,
      midterm_weight: c.midtermWeight ? Number(c.midtermWeight) : 0,
      final_weight: c.finalWeight ? Number(c.finalWeight) : 0,
      midterm_max_score: c.midtermMaxScore ? Number(c.midtermMaxScore) : 100,
      final_max_score: c.finalMaxScore ? Number(c.finalMaxScore) : 100,
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get classrooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ message: 'Classroom name is required' }, { status: 400 });
    }

    const classroom = await prisma.classroom.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description || null,
        lateToAbsentRatio: body.late_to_absent_ratio ?? 3,
        leaveToAbsentRatio: body.leave_to_absent_ratio ?? 2,
        absentToFRatio: body.absent_to_f_ratio ?? 4,
        totalClasses: body.total_classes ?? 40,
        minAttendancePercent: body.min_attendance_percent ?? 80,
      },
    });

    return NextResponse.json({ data: classroom }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to create classroom' }, { status: 500 });
  }
}
