import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { buildSemesterInfo } from '@/lib/semester';

/**
 * GET /api/semester?classroom_id=1
 * 
 * Returns full semester info including week date ranges and current week.
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    const numericClassroomId = Number(classroomId);
    if (isNaN(numericClassroomId) || numericClassroomId <= 0) {
      return NextResponse.json({ message: 'Invalid classroom_id' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericClassroomId, userId: user.id },
    });

    if (!classroom) {
      return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
    }

    const semesterInfo = buildSemesterInfo(numericClassroomId, classroom);

    return NextResponse.json({ data: semesterInfo });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Get semester info error:', error);
    return NextResponse.json({ message: 'Failed to get semester info' }, { status: 500 });
  }
}
