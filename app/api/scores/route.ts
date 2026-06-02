import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const lessonNumber = searchParams.get('lesson_number');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(classroomId), userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    // Get structures
    if (searchParams.get('type') === 'structure') {
      const structures = await prisma.scoreStructure.findMany({
        where: { classroomId: Number(classroomId) },
        orderBy: { lessonNumber: 'asc' },
      });
      const mappedStructures = structures.map(s => ({
        id: s.id,
        classroom_id: s.classroomId,
        lesson_number: s.lessonNumber,
        lesson_name: s.lessonName,
        max_assignment_score: s.maxAssignmentScore,
        max_post_test_score: s.maxPostTestScore,
        hours: s.hours,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      }));
      return NextResponse.json({ data: mappedStructures });
    }

    // Get student scores
    if (lessonNumber) {
      const scores = await prisma.studentScore.findMany({
        where: { classroomId: Number(classroomId), lessonNumber: Number(lessonNumber) },
      });
      const mappedScores = scores.map(s => ({
        id: s.id,
        student_id: s.studentId,
        classroom_id: s.classroomId,
        lesson_number: s.lessonNumber,
        assignment_score: s.assignmentScore,
        post_test_score: s.postTestScore,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      }));
      return NextResponse.json({ data: mappedScores });
    }

    // Get all student scores for classroom
    const scores = await prisma.studentScore.findMany({
      where: { classroomId: Number(classroomId) },
    });
    const mappedScores = scores.map(s => ({
      id: s.id,
      student_id: s.studentId,
      classroom_id: s.classroomId,
      lesson_number: s.lessonNumber,
      assignment_score: s.assignmentScore,
      post_test_score: s.postTestScore,
      created_at: s.createdAt,
      updated_at: s.updatedAt
    }));
    return NextResponse.json({ data: mappedScores });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get scores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const body = await request.json();

    const classroomId = Number(body.classroom_id || searchParams.get('classroom_id'));
    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    // Save structure
    if (body.type === 'structure' || searchParams.get('type') === 'structure' || body.structures) {
      for (const struct of body.structures) {
        await prisma.scoreStructure.upsert({
          where: {
            classroomId_lessonNumber: {
              classroomId: Number(classroomId),
              lessonNumber: Number(struct.lesson_number),
            },
          },
          update: {
            lessonName: struct.lesson_name || '',
            maxAssignmentScore: struct.max_assignment_score === '' ? null : Number(struct.max_assignment_score) || 0,
            maxPostTestScore: struct.max_post_test_score === '' ? null : Number(struct.max_post_test_score) || 0,
            hours: Number(struct.hours) || 0,
          },
          create: {
            classroomId: Number(classroomId),
            lessonNumber: Number(struct.lesson_number),
            lessonName: struct.lesson_name || '',
            maxAssignmentScore: struct.max_assignment_score === '' ? null : Number(struct.max_assignment_score) || 0,
            maxPostTestScore: struct.max_post_test_score === '' ? null : Number(struct.max_post_test_score) || 0,
            hours: Number(struct.hours) || 0,
          },
        });
      }
      return NextResponse.json({ message: 'Structure saved' });
    }

    // Save student scores (single lesson)
    if (body.scores && body.lesson_number !== undefined) {
      interface ScoreInput {
        student_id: number | string;
        assignment_score: number | string | null;
        post_test_score: number | string | null;
      }
      const scores = body.scores as ScoreInput[];
      const studentIds = scores.map(s => Number(s.student_id));
      const ownedStudents = await prisma.student.findMany({
        where: { id: { in: studentIds }, userId: user.id },
        select: { id: true },
      });
      const ownedStudentIds = new Set(ownedStudents.map(s => s.id));

      for (const score of scores) {
        if (!ownedStudentIds.has(Number(score.student_id))) continue; // Skip unauthorized
        await prisma.studentScore.upsert({
          where: {
            studentId_classroomId_lessonNumber: {
              studentId: Number(score.student_id),
              classroomId: Number(classroomId),
              lessonNumber: Number(body.lesson_number),
            },
          },
          update: {
            assignmentScore: score.assignment_score !== undefined && score.assignment_score !== '' ? Number(score.assignment_score) : null,
            postTestScore: score.post_test_score !== undefined && score.post_test_score !== '' ? Number(score.post_test_score) : null,
          },
          create: {
            studentId: Number(score.student_id),
            classroomId: Number(classroomId),
            lessonNumber: Number(body.lesson_number),
            assignmentScore: score.assignment_score !== undefined && score.assignment_score !== '' ? Number(score.assignment_score) : null,
            postTestScore: score.post_test_score !== undefined && score.post_test_score !== '' ? Number(score.post_test_score) : null,
          },
        });
      }
      return NextResponse.json({ message: 'Scores saved' });
    }

    // Bulk weekly scores
    if (body.scores && body.lesson_number === undefined) {
      for (const score of body.scores) {
        const data: Record<string, unknown> = {};
        if (score.assignment_score !== undefined) data.assignmentScore = score.assignment_score !== '' ? Number(score.assignment_score) : null;
        if (score.post_test_score !== undefined) data.postTestScore = score.post_test_score !== '' ? Number(score.post_test_score) : null;

        await prisma.studentScore.upsert({
          where: {
            studentId_classroomId_lessonNumber: {
              studentId: Number(score.student_id),
              classroomId: Number(classroomId),
              lessonNumber: Number(score.lesson_number),
            },
          },
          update: data,
          create: {
            studentId: Number(score.student_id),
            classroomId: Number(classroomId),
            lessonNumber: Number(score.lesson_number),
            assignmentScore: data.assignmentScore as number | null ?? null,
            postTestScore: data.postTestScore as number | null ?? null,
          },
        });
      }
      return NextResponse.json({ message: 'Bulk scores saved' });
    }

    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Save scores error:', error);
    return NextResponse.json({ message: 'Failed to save scores' }, { status: 500 });
  }
}
