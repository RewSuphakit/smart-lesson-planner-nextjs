import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json(classroom);
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Check ownership first
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description',
      late_to_absent_ratio: 'lateToAbsentRatio', leave_to_absent_ratio: 'leaveToAbsentRatio',
      absent_to_f_ratio: 'absentToFRatio', total_classes: 'totalClasses',
      min_attendance_percent: 'minAttendancePercent',
      assignment_weight: 'assignmentWeight', post_test_weight: 'postTestWeight',
      affective_weight: 'affectiveWeight', midterm_weight: 'midtermWeight',
      final_weight: 'finalWeight', midterm_max_score: 'midtermMaxScore',
      final_max_score: 'finalMaxScore',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updateData[prismaKey] = body[key];
    }

    await prisma.classroom.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('Update classroom error:', error);
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    // Check ownership first
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(id), userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    await prisma.classroom.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

