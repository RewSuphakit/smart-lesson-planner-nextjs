import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { invalidateCache, userCacheKey } from '@/lib/cache';

export const PUT = withAuth(async (request, user) => {

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

  invalidateCache(userCacheKey(user.id, 'students'));
  invalidateCache(userCacheKey(user.id, 'grades'));
  invalidateCache(userCacheKey(user.id, 'scores'));
  invalidateCache(userCacheKey(user.id, 'classrooms'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));

  return NextResponse.json({
    message: `ย้ายนักเรียนสำเร็จ ${updateResult.count} คน`,
    count: updateResult.count
  });
}, 'Failed to update classrooms');
