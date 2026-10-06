import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { invalidateCache, userCacheKey } from '@/lib/cache';

export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const { studentIds, classroomId } = await request.json();

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ message: 'No students selected' }, { status: 400 });
    }

    if (classroomId) {
      const ownedClassroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id },
      });
      if (!ownedClassroom) {
        return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
      }
    }

    // Verify students belong to user before updating
    const updateResult = await prisma.student.updateMany({
      where: {
        id: { in: studentIds.map(Number) },
        userId: user.id,
      },
      data: {
        classroomId: classroomId ? Number(classroomId) : null,
      },
    });

    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));

    return NextResponse.json({
      message: `ย้ายนักเรียนสำเร็จ ${updateResult.count} คน`,
      count: updateResult.count
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Bulk update classroom error:', error);
    return NextResponse.json({ message: 'Failed to update classrooms' }, { status: 500 });
  }
}
