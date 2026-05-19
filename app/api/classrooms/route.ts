import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const classrooms = await prisma.classroom.findMany({
      where: { userId: user.id },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = classrooms.map((c) => ({
      ...c,
      student_count: c._count.students,
      _count: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get classrooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

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

    return NextResponse.json(classroom, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to create classroom' }, { status: 500 });
  }
}
