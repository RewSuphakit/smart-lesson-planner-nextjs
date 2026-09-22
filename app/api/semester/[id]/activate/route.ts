import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

/**
 * POST /api/semester/:id/activate
 * 
 * Sets the specified semester as active and deactivates all others for the user.
 */
export async function POST(
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

    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ message: 'Invalid user ID' }, { status: 401 });
    }

    // Verify ownership
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });

    if (!semester) {
      return NextResponse.json({ message: 'Semester not found or unauthorized' }, { status: 404 });
    }

    // Already active
    if (semester.isActive) {
      return NextResponse.json({
        data: {
          id: semester.id,
          name: semester.name,
          term_number: semester.termNumber,
          academic_year: semester.academicYear,
          is_active: true,
        },
        message: 'ภาคเรียนนี้เป็นภาคเรียนที่ใช้งานอยู่แล้ว',
      });
    }

    // Atomically: deactivate all, activate target
    await prisma.$transaction([
      prisma.semester.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      prisma.semester.update({
        where: { id: semesterId },
        data: { isActive: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        id: semester.id,
        name: semester.name,
        term_number: semester.termNumber,
        academic_year: semester.academicYear,
        is_active: true,
      },
      message: `เปลี่ยนเป็นภาคเรียน "${semester.name}" สำเร็จ`,
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Activate semester error:', error);
    return NextResponse.json({ message: 'Failed to activate semester' }, { status: 500 });
  }
}
