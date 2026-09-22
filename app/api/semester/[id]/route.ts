import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { UpdateSemesterSchema, validateRequestBody } from '@/lib/validation';
import { CurriculumType } from '@prisma/client';
import { getCurrentWeek, getWeekDateRanges, getSemesterEndDate } from '@/lib/semester';

/**
 * GET /api/semester/:id
 * 
 * Returns a single semester with summary info (classroom count, student count, current week).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const semesterId = Number(id);
    const userId = Number(user.id);

    if (isNaN(semesterId) || semesterId <= 0) {
      return NextResponse.json({ message: 'Invalid semester ID' }, { status: 400 });
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
      include: {
        classrooms: {
          select: {
            id: true,
            name: true,
            curriculumType: true,
            totalWeeks: true,
            _count: { select: { students: true } },
          },
        },
        _count: {
          select: { weeklySchedules: true },
        },
      },
    });

    if (!semester) {
      return NextResponse.json({ message: 'Semester not found or unauthorized' }, { status: 404 });
    }

    // Calculate week info
    let currentWeek: number | null = null;
    let weeks: ReturnType<typeof getWeekDateRanges> = [];
    let semesterEndDate: string | null = null;

    if (semester.startDate) {
      const totalWeeks = semester.totalWeeks || 18;
      currentWeek = getCurrentWeek(semester.startDate, totalWeeks);
      weeks = getWeekDateRanges(semester.startDate, totalWeeks);
      const endDate = semester.endDate || getSemesterEndDate(semester.startDate, totalWeeks);
      semesterEndDate = endDate.toISOString().split('T')[0];
    }

    const totalStudents = semester.classrooms.reduce(
      (sum, c) => sum + (c._count.students || 0), 0
    );

    const pvchCount = semester.classrooms.filter(c => c.curriculumType === 'pvch').length;
    const pvsCount = semester.classrooms.filter(c => c.curriculumType === 'pvs').length;
    const customCount = semester.classrooms.filter(c => c.curriculumType === 'custom').length;

    return NextResponse.json({
      data: {
        id: semester.id,
        name: semester.name,
        term_number: semester.termNumber,
        academic_year: semester.academicYear,
        start_date: semester.startDate ? semester.startDate.toISOString().split('T')[0] : null,
        end_date: semester.endDate ? semester.endDate.toISOString().split('T')[0] : semesterEndDate,
        is_active: semester.isActive,
        curriculum_type: semester.curriculumType,
        total_weeks: semester.totalWeeks,
        current_week: currentWeek,
        weeks,
        classroom_count: semester.classrooms.length,
        pvch_count: pvchCount,
        pvs_count: pvsCount,
        custom_count: customCount,
        total_students: totalStudents,
        timetable_count: semester._count.weeklySchedules,
        classrooms: semester.classrooms.map(c => ({
          id: c.id,
          name: c.name,
          curriculum_type: c.curriculumType,
          total_weeks: c.totalWeeks,
          student_count: c._count.students,
        })),
        created_at: semester.createdAt,
        updated_at: semester.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Get semester error:', error);
    return NextResponse.json({ message: 'Failed to get semester' }, { status: 500 });
  }
}

/**
 * PUT /api/semester/:id
 * 
 * Updates a semester's fields.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const semesterId = Number(id);
    const userId = Number(user.id);

    if (isNaN(semesterId) || semesterId <= 0) {
      return NextResponse.json({ message: 'Invalid semester ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Semester not found or unauthorized' }, { status: 404 });
    }

    const validation = await validateRequestBody(request, UpdateSemesterSchema);
    if (!validation.success) {
      return validation.response;
    }

    const data = validation.data;
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.term_number !== undefined) updateData.termNumber = data.term_number;
    if (data.academic_year !== undefined) updateData.academicYear = data.academic_year;
    if (data.start_date !== undefined) updateData.startDate = data.start_date ? new Date(data.start_date) : null;
    if (data.end_date !== undefined) updateData.endDate = data.end_date ? new Date(data.end_date) : null;
    if (data.curriculum_type !== undefined) updateData.curriculumType = data.curriculum_type as CurriculumType;
    if (data.total_weeks !== undefined) updateData.totalWeeks = data.total_weeks;

    // Handle activation toggle
    if (data.is_active === true) {
      // Deactivate all others first
      await prisma.semester.updateMany({
        where: { userId, isActive: true, id: { not: semesterId } },
        data: { isActive: false },
      });
      updateData.isActive = true;
    } else if (data.is_active === false) {
      updateData.isActive = false;
    }

    // Check for duplicate if term_number or academic_year changed
    if (data.term_number !== undefined || data.academic_year !== undefined) {
      const checkTermNumber = data.term_number ?? existing.termNumber;
      const checkAcademicYear = data.academic_year ?? existing.academicYear;

      const duplicate = await prisma.semester.findFirst({
        where: {
          userId,
          termNumber: checkTermNumber,
          academicYear: checkAcademicYear,
          id: { not: semesterId },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: `ภาคเรียนที่ ${checkTermNumber}/${checkAcademicYear} มีอยู่แล้ว` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.semester.update({
      where: { id: semesterId },
      data: updateData,
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        term_number: updated.termNumber,
        academic_year: updated.academicYear,
        start_date: updated.startDate ? updated.startDate.toISOString().split('T')[0] : null,
        end_date: updated.endDate ? updated.endDate.toISOString().split('T')[0] : null,
        is_active: updated.isActive,
        curriculum_type: updated.curriculumType,
        total_weeks: updated.totalWeeks,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Update semester error:', error);
    return NextResponse.json({ message: 'Failed to update semester' }, { status: 500 });
  }
}

/**
 * DELETE /api/semester/:id
 * 
 * Deletes a semester. Cannot delete an active semester.
 * All related classrooms will have their semesterId set to null (onDelete: SetNull).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const semesterId = Number(id);
    const userId = Number(user.id);

    if (isNaN(semesterId) || semesterId <= 0) {
      return NextResponse.json({ message: 'Invalid semester ID' }, { status: 400 });
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });

    if (!semester) {
      return NextResponse.json({ message: 'Semester not found or unauthorized' }, { status: 404 });
    }

    if (semester.isActive) {
      return NextResponse.json(
        { message: 'ไม่สามารถลบภาคเรียนที่กำลังใช้งานอยู่ได้ กรุณาเปลี่ยนภาคเรียนที่ใช้งานก่อน' },
        { status: 400 }
      );
    }

    await prisma.semester.delete({ where: { id: semesterId } });

    return NextResponse.json({ message: 'ลบภาคเรียนสำเร็จ' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Delete semester error:', error);
    return NextResponse.json({ message: 'Failed to delete semester' }, { status: 500 });
  }
}
