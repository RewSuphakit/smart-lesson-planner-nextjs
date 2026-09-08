import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { resolveTargetWeeks, getCurrentWeek, getSemesterEndDate } from '@/lib/semester';

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
    });
    if (!classroom) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const c = classroom as typeof classroom & {
      curriculumType?: string;
      totalWeeks?: number;
      semesterStartDate?: Date | null;
    };

    const semesterStart = c.semesterStartDate ?? null;
    const totalWeeks = resolveTargetWeeks(c);
    const currentWeek = semesterStart ? getCurrentWeek(semesterStart, totalWeeks) : null;
    const semesterEnd = semesterStart ? getSemesterEndDate(semesterStart, totalWeeks) : null;

    const formatted = {
      id: c.id,
      name: c.name,
      description: c.description,
      late_to_absent_ratio: c.lateToAbsentRatio,
      leave_to_absent_ratio: c.leaveToAbsentRatio,
      absent_to_f_ratio: c.absentToFRatio,
      total_classes: c.totalClasses,
      min_attendance_percent: c.minAttendancePercent,
      assignment_weight: c.assignmentWeight ? Number(c.assignmentWeight) : 10,
      post_test_weight: c.postTestWeight ? Number(c.postTestWeight) : 70,
      affective_weight: c.affectiveWeight ? Number(c.affectiveWeight) : 20,
      midterm_weight: c.midtermWeight ? Number(c.midtermWeight) : 0,
      final_weight: c.finalWeight ? Number(c.finalWeight) : 0,
      midterm_max_score: c.midtermMaxScore ? Number(c.midtermMaxScore) : 100,
      final_max_score: c.finalMaxScore ? Number(c.finalMaxScore) : 100,
      curriculum_type: c.curriculumType ?? 'pvch',
      total_weeks: totalWeeks,
      semester_start_date: semesterStart ? semesterStart.toISOString().split('T')[0] : null,
      semester_end_date: semesterEnd ? semesterEnd.toISOString().split('T')[0] : null,
      current_week: currentWeek,
    };
    return NextResponse.json({ data: formatted });
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

    const body = await request.json();

    // Check ownership first
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericId, userId: user.id },
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
      curriculum_type: 'curriculumType', total_weeks: 'totalWeeks',
    };

    for (const [key, prismaKey] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updateData[prismaKey] = body[key];
    }

    // Handle semester_start_date separately (needs Date conversion)
    if (body.semester_start_date !== undefined) {
      updateData.semesterStartDate = body.semester_start_date ? new Date(body.semester_start_date) : null;
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

