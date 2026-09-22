import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { SemesterSchema, validateRequestBody } from '@/lib/validation';
import { CurriculumType } from '@prisma/client';
import { getDefaultWeeks } from '@/lib/semester';

/**
 * GET /api/semester
 * 
 * Lists all semesters for the authenticated user.
 * Optional query params:
 *   - academic_year: filter by academic year
 *   - active_only: if "true", return only the active semester
 *   - classroom_id: backward-compatible classroom-level semester info
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const userId = Number(user.id);
    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get('academic_year');
    const activeOnly = searchParams.get('active_only') === 'true';
    const classroomId = searchParams.get('classroom_id');

    // Backward-compatible: if classroom_id is provided, return classroom-level semester info
    if (classroomId) {
      const numericClassroomId = Number(classroomId);
      if (isNaN(numericClassroomId) || numericClassroomId <= 0) {
        return NextResponse.json({ message: 'Invalid classroom_id' }, { status: 400 });
      }

      const { buildSemesterInfo } = await import('@/lib/semester');
      const classroom = await prisma.classroom.findFirst({
        where: { id: numericClassroomId, userId },
      });

      if (!classroom) {
        return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
      }

      const semesterInfo = buildSemesterInfo(numericClassroomId, classroom as Parameters<typeof buildSemesterInfo>[1]);
      return NextResponse.json({ data: semesterInfo });
    }

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (academicYear) where.academicYear = academicYear;
    if (activeOnly) where.isActive = true;

    const semesters = await prisma.semester.findMany({
      where,
      include: {
        classrooms: {
          select: { id: true, curriculumType: true },
        },
        _count: {
          select: { classrooms: true, weeklySchedules: true },
        },
      },
      orderBy: [{ academicYear: 'desc' }, { termNumber: 'asc' }],
    });

    const result = semesters.map(s => {
      const pvchCount = s.classrooms.filter(c => c.curriculumType === 'pvch').length;
      const pvsCount = s.classrooms.filter(c => c.curriculumType === 'pvs').length;
      const customCount = s.classrooms.filter(c => c.curriculumType === 'custom').length;

      return {
        id: s.id,
        name: s.name,
        term_number: s.termNumber,
        academic_year: s.academicYear,
        start_date: s.startDate ? s.startDate.toISOString().split('T')[0] : null,
        end_date: s.endDate ? s.endDate.toISOString().split('T')[0] : null,
        is_active: s.isActive,
        curriculum_type: s.curriculumType,
        total_weeks: s.totalWeeks,
        classroom_count: s._count.classrooms,
        pvch_count: pvchCount,
        pvs_count: pvsCount,
        custom_count: customCount,
        timetable_count: s._count.weeklySchedules,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Get semesters error:', error);
    return NextResponse.json({ message: 'Failed to get semesters' }, { status: 500 });
  }
}

/**
 * POST /api/semester
 * 
 * Creates a new semester. If is_active is true, deactivates all other semesters.
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const validation = await validateRequestBody(request, SemesterSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      term_number,
      academic_year,
      start_date,
      end_date,
      is_active,
      curriculum_type,
      total_weeks,
    } = validation.data;

    // Check for duplicate semester (same user, term_number, academic_year)
    const existing = await prisma.semester.findFirst({
      where: {
        userId: user.id,
        termNumber: term_number,
        academicYear: academic_year,
      },
    });
    if (existing) {
      return NextResponse.json(
        { message: `ภาคเรียนที่ ${term_number}/${academic_year} มีอยู่แล้ว` },
        { status: 409 }
      );
    }

    const resolvedWeeks = total_weeks || getDefaultWeeks(curriculum_type as CurriculumType);

    // If this semester should be active, deactivate others first
    if (is_active) {
      await prisma.semester.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }

    const semester = await prisma.semester.create({
      data: {
        userId: user.id,
        name,
        termNumber: term_number,
        academicYear: academic_year,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
        isActive: is_active,
        curriculumType: (curriculum_type as CurriculumType) || CurriculumType.pvch,
        totalWeeks: resolvedWeeks,
      },
    });

    return NextResponse.json({
      data: {
        id: semester.id,
        name: semester.name,
        term_number: semester.termNumber,
        academic_year: semester.academicYear,
        start_date: semester.startDate ? semester.startDate.toISOString().split('T')[0] : null,
        end_date: semester.endDate ? semester.endDate.toISOString().split('T')[0] : null,
        is_active: semester.isActive,
        curriculum_type: semester.curriculumType,
        total_weeks: semester.totalWeeks,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Create semester error:', error);
    return NextResponse.json({ message: 'Failed to create semester' }, { status: 500 });
  }
}
