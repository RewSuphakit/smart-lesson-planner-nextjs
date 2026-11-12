import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { CreateStudentSchema, BulkCreateStudentSchema, BulkUpdateStudentMetaSchema, UpdateStudentExamScoresSchema, validateData } from '@/lib/validation';
import { invalidateCache, userCacheKey, getOrSetCache } from '@/lib/cache';
import { formatStudentListItem } from '@/lib/formatters';
import { sanitizeExamScore, sanitizeFinalExamPayload } from '@/lib/sanitize';
import { normalizeGradeLevel, normalizeBranchDisplay } from '@/lib/studentSections';
import { persistAvatarDataUri, resolveStudentAvatarUrl } from '@/lib/avatarStorage';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroom_id');

  const branch = searchParams.get('branch');
  const gradeLevel = searchParams.get('grade_level');

  const where: Record<string, unknown> = { userId: user.id };
  if (classroomId) where.classroomId = Number(classroomId);
  if (branch) where.branch = branch;
  if (gradeLevel) where.gradeLevel = gradeLevel;

  // Server-side search (name / student code) so clients don't need to load every row to filter
  const search = searchParams.get('search')?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { studentCode: { contains: search } },
    ];
  }

  const pageStr = searchParams.get('page');
  const limitStr = searchParams.get('limit');
  const includeAvatar = searchParams.get('include_avatar') === 'true';

  // When avatars are requested, embedded base64 images are replaced by a cacheable
  // per-student URL (/api/students/:id/avatar) so list payloads stay small.
  // Preset emoji keys / external URLs are passed through unchanged.
  const withAvatarUrl = <T extends { id: number; avatar?: string | null; updatedAt?: Date }>(s: T) => {
    const { updatedAt, ...rest } = s;
    return {
      ...rest,
      avatar: resolveStudentAvatarUrl(s.id, s.avatar, updatedAt),
    };
  };

  const selectFields = includeAvatar
    ? {
        id: true,
        name: true,
        studentCode: true,
        gradeLevel: true,
        branch: true,
        email: true,
        classroomId: true,
        classroom: { select: { name: true } },
        avatar: true,
        updatedAt: true,
        midtermScore: true,
        finalScore: true,
        examStatus: true,
        affectiveScore: true,
      }
    : {
        id: true,
        name: true,
        studentCode: true,
        gradeLevel: true,
        branch: true,
        email: true,
        classroomId: true,
        classroom: { select: { name: true } },
        midtermScore: true,
        finalScore: true,
        examStatus: true,
        affectiveScore: true,
      };

  if (pageStr || limitStr) {
    const page = Math.max(1, parseInt(pageStr || '1') || 1);
    const limit = Math.max(1, parseInt(limitStr || '25') || 25);
    const skip = (page - 1) * limit;

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        select: selectFields,
        orderBy: [{ gradeLevel: 'asc' }, { studentCode: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const mappedStudents = students.map((s) => formatStudentListItem(includeAvatar ? withAvatarUrl(s) : s));

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

  const cacheKey = userCacheKey(
    user.id,
    'students:list',
    `${classroomId || 'all'}:${branch || ''}:${gradeLevel || ''}:${search || ''}:${includeAvatar ? '1' : '0'}`
  );

  const mappedStudents = await getOrSetCache(cacheKey, 45, async () => {
    const students = await prisma.student.findMany({
      where,
      select: selectFields,
      orderBy: [{ gradeLevel: 'asc' }, { studentCode: 'asc' }, { name: 'asc' }],
    });
    return students.map((s) => formatStudentListItem(includeAvatar ? withAvatarUrl(s) : s));
  });

  return NextResponse.json({ data: mappedStudents });
}, 'Failed to get students');

export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Invalid JSON request payload' }, { status: 400 });
  }

  // Bulk create
  if (Array.isArray(body.students)) {
    const validation = validateData(body, BulkCreateStudentSchema);
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

    const data = validation.data.students.map((s, idx) => ({
      userId: user.id,
      name: s.name,
      studentCode: s.student_code || null,
      gradeLevel: s.grade_level ? normalizeGradeLevel(s.grade_level) || null : null,
      branch: s.branch ? normalizeBranchDisplay(s.branch) || null : null,
      email: s.email || null,
      classroomId: s.classroom_id ? Number(s.classroom_id) : null,
      avatar: s.avatar ? persistAvatarDataUri(s.avatar, `student-${user.id}-${idx}`) : null,
    }));

    const result = await prisma.student.createMany({ data });
    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    return NextResponse.json({ message: `Created ${result.count} students` }, { status: 201 });
  }

  // Single create
  const validation = validateData(body, CreateStudentSchema);
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
      gradeLevel: validation.data.grade_level ? normalizeGradeLevel(validation.data.grade_level) || null : null,
      branch: validation.data.branch ? normalizeBranchDisplay(validation.data.branch) || null : null,
      email: validation.data.email || null,
      classroomId: validation.data.classroom_id ? Number(validation.data.classroom_id) : null,
      avatar: validation.data.avatar
        ? persistAvatarDataUri(validation.data.avatar, `student-${user.id}`)
        : null,
    },
    include: {
      classroom: { select: { name: true } },
    },
  });

  invalidateCache(userCacheKey(user.id, 'students'));
  invalidateCache(userCacheKey(user.id, 'classrooms'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));
  invalidateCache(userCacheKey(user.id, 'grades'));
  invalidateCache(userCacheKey(user.id, 'scores'));

  return NextResponse.json({ data: formatStudentListItem(student) }, { status: 201 });
}, 'Failed to create student');

export const PATCH = withAuth(async (request, user) => {
  const body = await request.json();

  // Bulk update classroom, grade_level (section/room), and/or branch
  if (
    Array.isArray(body.student_ids) &&
    (body.classroom_id !== undefined || body.grade_level !== undefined || body.branch !== undefined)
  ) {
    const metaValidation = validateData(body, BulkUpdateStudentMetaSchema);
    if (!metaValidation.success) {
      return metaValidation.response;
    }

    const { student_ids, classroom_id, grade_level, branch } = metaValidation.data;

    if (classroom_id !== undefined && classroom_id !== null) {
      const ownedClassroom = await prisma.classroom.findFirst({
        where: { id: Number(classroom_id), userId: user.id },
      });
      if (!ownedClassroom) {
        return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (classroom_id !== undefined) {
      updatePayload.classroomId = classroom_id ? Number(classroom_id) : null;
    }
    if (grade_level !== undefined) {
      updatePayload.gradeLevel = grade_level ? normalizeGradeLevel(grade_level) || null : null;
    }
    if (branch !== undefined) {
      updatePayload.branch = branch ? normalizeBranchDisplay(branch) || null : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ message: 'No fields specified to update' }, { status: 400 });
    }

    const result = await prisma.student.updateMany({
      where: { id: { in: student_ids }, userId: user.id },
      data: updatePayload,
    });

    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    return NextResponse.json({
      message: `อัปเดตข้อมูลนักเรียนสำเร็จ ${result.count} คน`,
      count: result.count,
    });
  }

  // Bulk update exams — verify ownership + only update provided fields in a single transaction
  if (Array.isArray(body.scores)) {
    const examValidation = validateData(body, UpdateStudentExamScoresSchema);
    if (!examValidation.success) {
      return examValidation.response;
    }

    const validScores = examValidation.data.scores;
    const studentIds: number[] = Array.from(
      new Set<number>(validScores.map(s => Number(s.student_id)).filter((id: number) => !isNaN(id)))
    );

    const ownedStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, userId: user.id },
      select: { id: true },
    });
    const ownedSet = new Set(ownedStudents.map(s => s.id));

    const updateOperations = [];
    for (const score of validScores) {
      const studentId = Number(score.student_id);
      if (!ownedSet.has(studentId)) continue;

      const dataToUpdate: Record<string, unknown> = {};
      if (score.midterm_score !== undefined) {
        dataToUpdate.midtermScore = sanitizeExamScore(score.midterm_score, false);
      }
      if (score.final_score !== undefined || score.exam_status !== undefined) {
        const { finalScore, examStatus } = sanitizeFinalExamPayload(score.final_score, score.exam_status);
        dataToUpdate.finalScore = finalScore;
        dataToUpdate.examStatus = examStatus;
      }
      if (score.affective_score !== undefined) {
        dataToUpdate.affectiveScore = sanitizeExamScore(score.affective_score, false);
      }
      if (Object.keys(dataToUpdate).length > 0) {
        updateOperations.push(
          prisma.student.update({
            where: { id: studentId },
            data: dataToUpdate,
          })
        );
      }
    }

    if (updateOperations.length > 0) {
      await prisma.$transaction(updateOperations);
    }
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    return NextResponse.json({ message: 'Scores updated' });
  }

  return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
}, 'Failed to update students');

export const DELETE = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroom_id');
  const idsParam = searchParams.get('ids');
  const all = searchParams.get('all');

  // Case 1: Delete all students of this user (explicit all=true)
  if (all === 'true') {
    const result = await prisma.student.deleteMany({
      where: { userId: user.id },
    });
    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    return NextResponse.json({
      message: `ลบนักเรียนทั้งหมดสำเร็จ ${result.count} คน`,
      count: result.count,
    });
  }

  // Case 2: Delete specific students by IDs list
  if (idsParam) {
    const ids = idsParam.split(',').map(Number).filter((id) => !isNaN(id) && id > 0);
    if (ids.length === 0) {
      return NextResponse.json({ message: 'กรุณาระบุรหัสนักเรียนที่ต้องการลบ' }, { status: 400 });
    }
    const result = await prisma.student.deleteMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });
    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    return NextResponse.json({
      message: `ลบนักเรียนสำเร็จ ${result.count} คน`,
      count: result.count,
    });
  }

  // Case 3: Delete students in a specific classroom
  if (classroomId) {
    const cid = Number(classroomId);
    if (isNaN(cid) || cid <= 0) {
      return NextResponse.json({ message: 'รหัสห้องเรียนไม่ถูกต้อง' }, { status: 400 });
    }
    const ownedClassroom = await prisma.classroom.findFirst({
      where: { id: cid, userId: user.id },
    });
    if (!ownedClassroom) {
      return NextResponse.json({ message: 'ไม่พบห้องเรียนหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const result = await prisma.student.deleteMany({
      where: {
        userId: user.id,
        classroomId: cid,
      },
    });
    invalidateCache(userCacheKey(user.id, 'students'));
    invalidateCache(userCacheKey(user.id, 'classrooms'));
    invalidateCache(userCacheKey(user.id, 'dashboard'));
    invalidateCache(userCacheKey(user.id, 'grades'));
    invalidateCache(userCacheKey(user.id, 'scores'));
    return NextResponse.json({
      message: `ลบนักเรียนในห้องเรียนสำเร็จ ${result.count} คน`,
      count: result.count,
    });
  }

  return NextResponse.json(
    { message: 'กรุณาระบุ classroom_id, ids หรือ all=true ในการลบนักเรียน' },
    { status: 400 }
  );
}, 'เกิดข้อผิดพลาดในการลบนักเรียน');
