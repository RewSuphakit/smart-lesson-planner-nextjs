import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { formatClassroomResponse } from '@/lib/formatters';
import { UpdateClassroomSchema, validateRequestBody } from '@/lib/validation';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid classroom ID' }, { status: 400 });
    }

    const classroom = await prisma.classroom.findFirst({
      where: { id: numericId, userId: user.id },
      include: { semester: { select: { id: true, name: true, termNumber: true, academicYear: true, startDate: true } } },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    return NextResponse.json({ data: formatClassroomResponse(classroom) });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid classroom ID' }, { status: 400 });
    }

    const validation = await validateRequestBody(request, UpdateClassroomSchema);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;

    // Check ownership first
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<keyof typeof body, string> = {
      name: 'name',
      description: 'description',
      late_to_absent_ratio: 'lateToAbsentRatio',
      leave_to_absent_ratio: 'leaveToAbsentRatio',
      absent_to_f_ratio: 'absentToFRatio',
      total_classes: 'totalClasses',
      min_attendance_percent: 'minAttendancePercent',
      assignment_weight: 'assignmentWeight',
      post_test_weight: 'postTestWeight',
      affective_weight: 'affectiveWeight',
      midterm_weight: 'midtermWeight',
      final_weight: 'finalWeight',
      midterm_max_score: 'midtermMaxScore',
      final_max_score: 'finalMaxScore',
      curriculum_type: 'curriculumType',
      total_weeks: 'totalWeeks',
      semester_start_date: 'semesterStartDate',
      semester_id: 'semesterId',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      const val = body[key as keyof typeof body];
      if (val !== undefined) {
        if (key === 'semester_start_date') {
          updateData[prismaKey] = val ? new Date(val as string) : null;
        } else {
          updateData[prismaKey] = val;
        }
      }
    }

    await prisma.classroom.update({ where: { id: numericId }, data: updateData });
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
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid classroom ID' }, { status: 400 });
    }

    // Check ownership first
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericId, userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    await prisma.classroom.delete({ where: { id: numericId } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

