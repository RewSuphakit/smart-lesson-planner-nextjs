import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

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
    }

    const data = (students as StudentBulkInput[]).map((s) => ({
      userId: user.id,
      name: s.name,
      studentCode: s.student_code || null,
      gradeLevel: s.grade_level || null,
      email: s.email || null,
      classroomId: s.classroom_id ? Number(s.classroom_id) : null,
    }));

    const result = await prisma.student.createMany({
      data,
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `นำเข้านักเรียนสำเร็จ ${result.count} คน`,
      count: result.count
    }, { status: 201 });
  } catch (error) {
    console.error('Bulk create students error:', error);
    return NextResponse.json({ message: 'Failed to bulk import students' }, { status: 500 });
  }
}
