import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { invalidateCache, userCacheKey } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const { students } = await request.json();

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ message: 'No students provided' }, { status: 400 });
    }

    interface StudentBulkInput {
      name: string;
      student_code?: string;
      grade_level?: string;
      email?: string;
      classroom_id?: number | string;
      avatar?: string;
    }

    const classroomIds = Array.from(
      new Set(
        (students as StudentBulkInput[])
          .map((s) => (s.classroom_id ? Number(s.classroom_id) : null))
          .filter((id): id is number => typeof id === 'number' && !isNaN(id) && id > 0)
      )
    );

    if (classroomIds.length > 0) {
      const ownedClassrooms = await prisma.classroom.findMany({
        where: { id: { in: classroomIds }, userId: user.id },
        select: { id: true },
      });
      const ownedSet = new Set(ownedClassrooms.map((c) => c.id));
      const hasUnauthorized = classroomIds.some((id) => !ownedSet.has(id));
      if (hasUnauthorized) {
        return NextResponse.json(
          { message: 'One or more classrooms not found or unauthorized' },
          { status: 403 }
        );
      }
    }

    const data = (students as StudentBulkInput[]).map((s) => ({
      userId: user.id,
      name: s.name,
      studentCode: s.student_code || null,
      gradeLevel: s.grade_level || null,
      email: s.email || null,
      classroomId: s.classroom_id ? Number(s.classroom_id) : null,
      avatar: s.avatar || null,
    }));

    const result = await prisma.student.createMany({
      data,
      skipDuplicates: true,
    });

    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));

    return NextResponse.json({
      message: `นำเข้านักเรียนสำเร็จ ${result.count} คน`,
      count: result.count,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Bulk create students error:', error);
    return NextResponse.json({ message: 'Failed to bulk import students' }, { status: 500 });
  }
}
