import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const lessonNumber = searchParams.get('lesson_number');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Get structures
    if (searchParams.get('type') === 'structure') {
      const structures = await prisma.scoreStructure.findMany({
        where: { classroomId: Number(classroomId) },
        orderBy: { lessonNumber: 'asc' },
      });
      return NextResponse.json(structures);
    }

    // Get student scores
    if (lessonNumber) {
      const scores = await prisma.studentScore.findMany({
        where: { classroomId: Number(classroomId), lessonNumber: Number(lessonNumber) },
      });
      return NextResponse.json(scores);
    }

    // Get all student scores for classroom
    const scores = await prisma.studentScore.findMany({
      where: { classroomId: Number(classroomId) },
    });
    return NextResponse.json(scores);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get scores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = await request.json();

    // Save structure
    if (body.type === 'structure') {
      for (const struct of body.structures) {
        await prisma.scoreStructure.upsert({
          where: {
            classroomId_lessonNumber: {
              classroomId: body.classroom_id,
              lessonNumber: struct.lesson_number,
            },
          },
          update: {
            lessonName: struct.lesson_name || '',
            maxAssignmentScore: struct.max_assignment_score || 0,
            maxPostTestScore: struct.max_post_test_score || 0,
            hours: struct.hours || 0,
          },
          create: {
            classroomId: body.classroom_id,
            lessonNumber: struct.lesson_number,
            lessonName: struct.lesson_name || '',
            maxAssignmentScore: struct.max_assignment_score || 0,
            maxPostTestScore: struct.max_post_test_score || 0,
            hours: struct.hours || 0,
          },
        });
      }
      return NextResponse.json({ message: 'Structure saved' });
    }

    // Save student scores (single lesson)
    if (body.scores && body.lesson_number !== undefined) {
      for (const score of body.scores) {
        await prisma.studentScore.upsert({
          where: {
            studentId_classroomId_lessonNumber: {
              studentId: score.student_id,
              classroomId: body.classroom_id,
              lessonNumber: body.lesson_number,
            },
          },
          update: {
            assignmentScore: score.assignment_score !== undefined && score.assignment_score !== '' ? score.assignment_score : null,
            postTestScore: score.post_test_score !== undefined && score.post_test_score !== '' ? score.post_test_score : null,
          },
          create: {
            studentId: score.student_id,
            classroomId: body.classroom_id,
            lessonNumber: body.lesson_number,
            assignmentScore: score.assignment_score !== undefined && score.assignment_score !== '' ? score.assignment_score : null,
            postTestScore: score.post_test_score !== undefined && score.post_test_score !== '' ? score.post_test_score : null,
          },
        });
      }
      return NextResponse.json({ message: 'Scores saved' });
    }

    // Bulk weekly scores
    if (body.scores && body.lesson_number === undefined) {
      for (const score of body.scores) {
        const data: Record<string, unknown> = {};
        if (score.assignment_score !== undefined) data.assignmentScore = score.assignment_score !== '' ? score.assignment_score : null;
        if (score.post_test_score !== undefined) data.postTestScore = score.post_test_score !== '' ? score.post_test_score : null;

        await prisma.studentScore.upsert({
          where: {
            studentId_classroomId_lessonNumber: {
              studentId: score.student_id,
              classroomId: body.classroom_id,
              lessonNumber: score.lesson_number,
            },
          },
          update: data,
          create: {
            studentId: score.student_id as number,
            classroomId: body.classroom_id as number,
            lessonNumber: score.lesson_number as number,
            assignmentScore: data.assignmentScore as number | null ?? null,
            postTestScore: data.postTestScore as number | null ?? null,
          },
        });
      }
      return NextResponse.json({ message: 'Bulk scores saved' });
    }

    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Save scores error:', error);
    return NextResponse.json({ message: 'Failed to save scores' }, { status: 500 });
  }
}
