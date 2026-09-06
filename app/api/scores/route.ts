import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const lessonNumber = searchParams.get('lesson_number');
    const mode = searchParams.get('mode');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    const numericClassroomId = Number(classroomId);

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericClassroomId, userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    // Composite Matrix Mode (Single payload response)
    if (mode === 'matrix') {
      const [students, structures, scores] = await Promise.all([
        prisma.student.findMany({
          where: { classroomId: numericClassroomId, userId: user.id },
          select: {
            id: true,
            studentCode: true,
            name: true,
            classroomId: true,
            midtermScore: true,
            finalScore: true,
            affectiveScore: true,
          },
          orderBy: [{ studentCode: 'asc' }, { name: 'asc' }],
        }),
        prisma.scoreStructure.findMany({
          where: { classroomId: numericClassroomId },
          orderBy: { lessonNumber: 'asc' },
        }),
        prisma.studentScore.findMany({
          where: { classroomId: numericClassroomId },
        }),
      ]);

      const mappedStudents = students.map(s => ({
        id: s.id,
        student_code: s.studentCode,
        name: s.name,
        classroom_id: s.classroomId,
        midterm_score: s.midtermScore ? Number(s.midtermScore) : null,
        final_score: s.finalScore ? Number(s.finalScore) : null,
        affective_score: s.affectiveScore ? Number(s.affectiveScore) : null,
      }));

      const mappedStructures = structures.map(s => ({
        id: s.id,
        classroom_id: s.classroomId,
        lesson_number: s.lessonNumber,
        lesson_name: s.lessonName,
        max_assignment_score: s.maxAssignmentScore,
        max_post_test_score: s.maxPostTestScore,
        hours: s.hours,
      }));

      const mappedScores = scores.map(s => ({
        id: s.id,
        student_id: s.studentId,
        classroom_id: s.classroomId,
        lesson_number: s.lessonNumber,
        assignment_score: s.assignmentScore !== null ? Number(s.assignmentScore) : null,
        post_test_score: s.postTestScore !== null ? Number(s.postTestScore) : null,
      }));

      return NextResponse.json({
        data: {
          classroom,
          students: mappedStudents,
          structures: mappedStructures,
          scores: mappedScores,
        }
      });
    }

    // Get structures
    if (searchParams.get('type') === 'structure') {
      const structures = await prisma.scoreStructure.findMany({
        where: { classroomId: numericClassroomId },
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

    // Get student scores for a specific lesson
    if (lessonNumber) {
      const scores = await prisma.studentScore.findMany({
        where: { classroomId: numericClassroomId, lessonNumber: Number(lessonNumber) },
      });
      const mappedScores = scores.map(s => ({
        id: s.id,
        student_id: s.studentId,
        classroom_id: s.classroomId,
        lesson_number: s.lessonNumber,
        assignment_score: s.assignmentScore !== null ? Number(s.assignmentScore) : null,
        post_test_score: s.postTestScore !== null ? Number(s.postTestScore) : null,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      }));
      return NextResponse.json({ data: mappedScores });
    }

    // Get all student scores for classroom
    const scores = await prisma.studentScore.findMany({
      where: { classroomId: numericClassroomId },
    });
    const mappedScores = scores.map(s => ({
      id: s.id,
      student_id: s.studentId,
      classroom_id: s.classroomId,
      lesson_number: s.lessonNumber,
      assignment_score: s.assignmentScore !== null ? Number(s.assignmentScore) : null,
      post_test_score: s.postTestScore !== null ? Number(s.postTestScore) : null,
      created_at: s.createdAt,
      updated_at: s.updatedAt
    }));
    return NextResponse.json({ data: mappedScores });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('GET scores error:', error);
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

    // Helper to sanitize score values: converts empty/null to null, validates numbers, and clamps between 0 and 999.99
    const sanitizeScore = (val: unknown): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      if (isNaN(num)) return null;
      return Math.min(999.99, Math.max(0, num));
    };

    // Save score structure (Batch Transaction)
    if (body.type === 'structure' || searchParams.get('type') === 'structure' || body.structures) {
      const structures = body.structures || [];
      if (!Array.isArray(structures) || structures.length === 0) {
        return NextResponse.json({ message: 'No structures provided' }, { status: 400 });
      }

      const structOperations = structures
        .map((struct: {
          lesson_number: number | string;
          lesson_name?: string;
          max_assignment_score?: number | string | null;
          max_post_test_score?: number | string | null;
          hours?: number | string;
        }) => {
          const lessonNum = Number(struct.lesson_number);
          if (isNaN(lessonNum) || lessonNum < 1) return null;

          const maxAssign = sanitizeScore(struct.max_assignment_score) ?? 0;
          const maxPost = sanitizeScore(struct.max_post_test_score) ?? 0;
          const hrs = Math.max(0, Number(struct.hours) || 0);

          return prisma.scoreStructure.upsert({
            where: {
              classroomId_lessonNumber: {
                classroomId,
                lessonNumber: lessonNum,
              },
            },
            update: {
              lessonName: struct.lesson_name || '',
              maxAssignmentScore: maxAssign,
              maxPostTestScore: maxPost,
              hours: hrs,
            },
            create: {
              classroomId,
              lessonNumber: lessonNum,
              lessonName: struct.lesson_name || '',
              maxAssignmentScore: maxAssign,
              maxPostTestScore: maxPost,
              hours: hrs,
            },
          });
        })
        .filter((op): op is NonNullable<typeof op> => op !== null);

      if (structOperations.length > 0) {
        await prisma.$transaction(structOperations);

        // Delete any leftover structures beyond the highest submitted lesson number (e.g. switching from 18 to 15 weeks)
        const validLessonNums = structures
          .map((s: { lesson_number: number | string }) => Number(s.lesson_number))
          .filter(n => !isNaN(n) && n > 0);
        const maxLesson = Math.max(...validLessonNums);
        if (maxLesson > 0) {
          await prisma.scoreStructure.deleteMany({
            where: {
              classroomId,
              lessonNumber: { gt: maxLesson }
            }
          });
        }
      }
      return NextResponse.json({ message: 'Structure saved successfully' });
    }

    // Save student scores for a single lesson (Batch Transaction)
    if (body.scores && body.lesson_number !== undefined) {
      interface ScoreInput {
        student_id: number | string;
        assignment_score?: number | string | null;
        post_test_score?: number | string | null;
      }
      const scores = body.scores as ScoreInput[];
      const studentIds = Array.from(new Set(scores.map(s => Number(s.student_id)).filter(id => !isNaN(id))));
      
      const ownedStudents = await prisma.student.findMany({
        where: { id: { in: studentIds }, userId: user.id },
        select: { id: true },
      });
      const ownedStudentIds = new Set(ownedStudents.map(s => s.id));

      const lessonNum = Number(body.lesson_number);
      if (isNaN(lessonNum) || lessonNum < 1) {
        return NextResponse.json({ message: 'Invalid lesson number' }, { status: 400 });
      }

      const scoreOperations = [];

      for (const score of scores) {
        const studentId = Number(score.student_id);
        if (!ownedStudentIds.has(studentId) || isNaN(studentId)) continue; // Security isolation check

        const assignVal = sanitizeScore(score.assignment_score);
        const postVal = sanitizeScore(score.post_test_score);

        scoreOperations.push(
          prisma.studentScore.upsert({
            where: {
              studentId_classroomId_lessonNumber: {
                studentId,
                classroomId,
                lessonNumber: lessonNum,
              },
            },
            update: {
              assignmentScore: assignVal,
              postTestScore: postVal,
            },
            create: {
              studentId,
              classroomId,
              lessonNumber: lessonNum,
              assignmentScore: assignVal,
              postTestScore: postVal,
            },
          })
        );
      }

      if (scoreOperations.length > 0) {
        await prisma.$transaction(scoreOperations);
      }
      return NextResponse.json({ message: 'Scores saved successfully', updatedCount: scoreOperations.length });
    }

    // Bulk weekly scores (Full Matrix Save via Batch Transaction)
    if (body.scores && body.lesson_number === undefined) {
      interface BulkScoreInput {
        student_id: number | string;
        lesson_number: number | string;
        assignment_score?: number | string | null;
        post_test_score?: number | string | null;
      }
      const bulkScores = body.scores as BulkScoreInput[];
      const studentIds = Array.from(new Set(bulkScores.map(s => Number(s.student_id)).filter(id => !isNaN(id))));

      const ownedStudents = await prisma.student.findMany({
        where: { id: { in: studentIds }, userId: user.id },
        select: { id: true },
      });
      const ownedStudentIds = new Set(ownedStudents.map(s => s.id));

      const bulkOperations = [];
      for (const score of bulkScores) {
        const studentId = Number(score.student_id);
        const lessonNum = Number(score.lesson_number);
        if (!ownedStudentIds.has(studentId) || isNaN(lessonNum) || lessonNum < 1) continue;

        const data: { assignmentScore?: number | null; postTestScore?: number | null } = {};
        if (score.assignment_score !== undefined) {
          data.assignmentScore = sanitizeScore(score.assignment_score);
        }
        if (score.post_test_score !== undefined) {
          data.postTestScore = sanitizeScore(score.post_test_score);
        }

        bulkOperations.push(
          prisma.studentScore.upsert({
            where: {
              studentId_classroomId_lessonNumber: {
                studentId,
                classroomId,
                lessonNumber: lessonNum,
              },
            },
            update: data,
            create: {
              studentId,
              classroomId,
              lessonNumber: lessonNum,
              assignmentScore: data.assignmentScore ?? null,
              postTestScore: data.postTestScore ?? null,
            },
          })
        );
      }

      if (bulkOperations.length > 0) {
        await prisma.$transaction(bulkOperations);
      }
      return NextResponse.json({ message: 'Bulk scores saved successfully', updatedCount: bulkOperations.length });
    }

    return NextResponse.json({ message: 'Invalid request payload' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Save scores error:', error);
    return NextResponse.json({ message: 'Failed to save scores' }, { status: 500 });
  }
}

