import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { CreateStudentSchema, BulkCreateStudentSchema, validateRequestBody } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');

    const where: Record<string, unknown> = { userId: user.id };
    if (classroomId) where.classroomId = Number(classroomId);

    const pageStr = searchParams.get('page');
    const limitStr = searchParams.get('limit');

    if (pageStr || limitStr) {
      const page = Math.max(1, parseInt(pageStr || '1') || 1);
      const limit = Math.max(1, parseInt(limitStr || '25') || 25);
      const skip = (page - 1) * limit;

      const [total, students] = await Promise.all([
        prisma.student.count({ where }),
        prisma.student.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      const mappedStudents = students.map(s => ({
        id: s.id,
        name: s.name,
        student_code: s.studentCode,
        grade_level: s.gradeLevel,
        email: s.email,
        classroom_id: s.classroomId,
        midterm_score: s.midtermScore ? Number(s.midtermScore) : null,
        final_score: s.finalScore ? Number(s.finalScore) : null,
        affective_score: s.affectiveScore ? Number(s.affectiveScore) : null,
      }));

      return NextResponse.json({
        data: mappedStudents,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const mappedStudents = students.map(s => ({
      id: s.id,
      name: s.name,
      student_code: s.studentCode,
      grade_level: s.gradeLevel,
      email: s.email,
      classroom_id: s.classroomId,
      midterm_score: s.midtermScore ? Number(s.midtermScore) : null,
      final_score: s.finalScore ? Number(s.finalScore) : null,
      affective_score: s.affectiveScore ? Number(s.affectiveScore) : null,
    }));

    return NextResponse.json({ data: mappedStudents });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.clone().json().catch(() => null);

    // Bulk create
    if (body && Array.isArray(body.students)) {
      const validation = await validateRequestBody(request, BulkCreateStudentSchema);
      if (!validation.success) {
        return validation.response;
      }

      // IDOR check for any specified classroom_ids
      const classroomIds = Array.from(
        new Set(validation.data.students.map(s => s.classroom_id).filter((id): id is number => typeof id === 'number' && id > 0))
      );
      if (classroomIds.length > 0) {
        const ownedClassrooms = await prisma.classroom.findMany({
          where: { id: { in: classroomIds }, userId: user.id },
          select: { id: true },
        });
        const ownedSet = new Set(ownedClassrooms.map(c => c.id));
        const hasUnauthorized = classroomIds.some(id => !ownedSet.has(id));
        if (hasUnauthorized) {
          return NextResponse.json({ message: 'One or more classrooms not found or unauthorized' }, { status: 403 });
        }
      }

      const data = validation.data.students.map(s => ({
        userId: user.id,
        name: s.name,
        studentCode: s.student_code || null,
        gradeLevel: s.grade_level || null,
        email: s.email || null,
        classroomId: s.classroom_id ? Number(s.classroom_id) : null,
      }));

      const result = await prisma.student.createMany({ data });
      return NextResponse.json({ message: `Created ${result.count} students` }, { status: 201 });
    }

    // Single create
    const validation = await validateRequestBody(request, CreateStudentSchema);
    if (!validation.success) {
      return validation.response;
    }

    // IDOR check for single student classroom
    if (validation.data.classroom_id) {
      const ownedClassroom = await prisma.classroom.findFirst({
        where: { id: Number(validation.data.classroom_id), userId: user.id },
      });
      if (!ownedClassroom) {
        return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 403 });
      }
    }

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name: validation.data.name,
        studentCode: validation.data.student_code || null,
        gradeLevel: validation.data.grade_level || null,
        email: validation.data.email || null,
        classroomId: validation.data.classroom_id ? Number(validation.data.classroom_id) : null,
      },
    });

    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Create student error:', error);
    return NextResponse.json({ message: 'Failed to create student' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk update classroom
    if (body.student_ids && body.classroom_id !== undefined) {
      if (body.classroom_id) {
        const ownedClassroom = await prisma.classroom.findFirst({
          where: { id: Number(body.classroom_id), userId: user.id },
        });
        if (!ownedClassroom) {
          return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
        }
      }

      await prisma.student.updateMany({
        where: { id: { in: body.student_ids }, userId: user.id },
        data: { classroomId: body.classroom_id ? Number(body.classroom_id) : null },
      });
      return NextResponse.json({ message: 'Students updated' });
    }

    // Bulk update exams — verify ownership + only update provided fields
    if (Array.isArray(body.scores)) {
      for (const score of body.scores) {
        const dataToUpdate: Record<string, unknown> = {};
        if (score.midterm_score !== undefined) {
          dataToUpdate.midtermScore = score.midterm_score === '' || score.midterm_score === null ? null : Number(score.midterm_score);
        }
        if (score.final_score !== undefined) {
          dataToUpdate.finalScore = score.final_score === '' || score.final_score === null ? null : Number(score.final_score);
        }
        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.student.updateMany({
            where: { id: score.student_id, userId: user.id },
            data: dataToUpdate,
          });
        }
      }
      return NextResponse.json({ message: 'Scores updated' });
    }

    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to update students' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const idsParam = searchParams.get('ids');

    // Prevent accidental full database wipe
    if (!idsParam && !classroomId) {
      return NextResponse.json(
        { message: 'Must specify classroom_id or ids parameter to delete students' },
        { status: 400 }
      );
    }

    // Case 1: Delete specific students by IDs list
    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(id => !isNaN(id));
      const result = await prisma.student.deleteMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
      });
      return NextResponse.json({ message: `Deleted ${result.count} students`, count: result.count });
    }

    // Case 2: Delete students in a specific classroom
    const cid = Number(classroomId);
    const ownedClassroom = await prisma.classroom.findFirst({
      where: { id: cid, userId: user.id },
    });
    if (!ownedClassroom) {
      return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
    }

    const result = await prisma.student.deleteMany({
      where: {
        userId: user.id,
        classroomId: cid,
      },
    });
    return NextResponse.json({ message: `Deleted ${result.count} students`, count: result.count });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Delete students error:', error);
    return NextResponse.json({ message: 'Failed to delete students' }, { status: 500 });
  }
}
