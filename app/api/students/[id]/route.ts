import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { invalidateCache, userCacheKey } from '@/lib/cache';
import { formatStudentListItem } from '@/lib/formatters';
import { normalizeGradeLevel, normalizeBranchDisplay } from '@/lib/studentSections';
import { sanitizeExamScore, sanitizeFinalExamPayload } from '@/lib/sanitize';
import { persistAvatarDataUri, removeAvatarFileIfLocal, resolveStudentAvatarUrl } from '@/lib/avatarStorage';

export const GET = withAuth<{ id: string }>(async (request, user, { params }) => {
  const { id } = await params;
  const numericId = Number(id);
  if (isNaN(numericId) || numericId <= 0) {
    return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: numericId, userId: user.id },
    include: {
      classroom: {
        select: { id: true, name: true },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ message: 'Student not found' }, { status: 404 });
  }

  const formatted = formatStudentListItem({
    ...student,
    avatar: resolveStudentAvatarUrl(student.id, student.avatar, student.updatedAt),
  });

  return NextResponse.json({ data: { ...student, ...formatted } });
}, 'Failed to get student');

export const PUT = withAuth<{ id: string }>(async (request, user, { params }) => {
  const { id } = await params;
  const numericId = Number(id);
  if (isNaN(numericId) || numericId <= 0) {
    return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
  }

  const body = await request.json();

  // Check ownership
  const student = await prisma.student.findFirst({
    where: { id: numericId, userId: user.id },
  });
  if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = {
    name: 'name', student_code: 'studentCode', grade_level: 'gradeLevel',
    branch: 'branch', email: 'email', classroom_id: 'classroomId',
    midterm_score: 'midtermScore', final_score: 'finalScore',
    affective_score: 'affectiveScore',
    avatar: 'avatar',
  };

  // Lookup classroom max scores if updating exam scores
  let classroomMaxScores: { midterm: number; final: number } = { midterm: 100, final: 100 };
  if (body.midterm_score !== undefined || body.final_score !== undefined || body.exam_status !== undefined) {
    const targetClassroomId =
      body.classroom_id !== undefined
        ? body.classroom_id
          ? Number(body.classroom_id)
          : null
        : student.classroomId;
    if (targetClassroomId) {
      const cls = await prisma.classroom.findUnique({
        where: { id: targetClassroomId },
        select: { midtermMaxScore: true, finalMaxScore: true },
      });
      if (cls) {
        classroomMaxScores = {
          midterm: cls.midtermMaxScore ? Number(cls.midtermMaxScore) : 100,
          final: cls.finalMaxScore ? Number(cls.finalMaxScore) : 100,
        };
      }
    }
  }

  const canSafelyRemoveOldAvatar = async (oldAvatar?: string | null) => {
    if (!oldAvatar || !oldAvatar.startsWith('/uploads/avatars/')) return false;
    const otherRefs = await prisma.student.count({
      where: { avatar: oldAvatar, id: { not: numericId } },
    });
    return otherRefs === 0;
  };

  if (body.remove_avatar === true && body.avatar === undefined) {
    if (await canSafelyRemoveOldAvatar(student.avatar)) {
      removeAvatarFileIfLocal(student.avatar);
    }
    updateData.avatar = null;
  }

  if (body.exam_status !== undefined && body.final_score === undefined) {
    const { finalScore, examStatus } = sanitizeFinalExamPayload(
      student.finalScore,
      body.exam_status,
      classroomMaxScores.final
    );
    updateData.finalScore = finalScore;
    updateData.examStatus = examStatus;
  }

  for (const [key, prismaKey] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      let val = body[key];
      if (prismaKey === 'classroomId') {
        if (val) {
          const ownedClassroom = await prisma.classroom.findFirst({
            where: { id: Number(val), userId: user.id },
          });
          if (!ownedClassroom) {
            return NextResponse.json({ message: 'Target classroom not found or unauthorized' }, { status: 403 });
          }
          val = Number(val);
        } else {
          val = null;
        }
      } else if (prismaKey === 'midtermScore') {
        if (val === '' || val === null || val === undefined) {
          val = null;
        } else {
          const num = Number(val);
          val = isNaN(num) ? null : Math.min(classroomMaxScores.midterm, Math.max(0, num));
        }
      } else if (prismaKey === 'affectiveScore') {
        val = sanitizeExamScore(val, false);
      } else if (prismaKey === 'finalScore') {
        const { finalScore, examStatus } = sanitizeFinalExamPayload(
          val,
          body.exam_status,
          classroomMaxScores.final
        );
        val = finalScore;
        updateData.examStatus = examStatus;
      } else if (prismaKey === 'avatar') {
        if (body.remove_avatar === true) {
          if (await canSafelyRemoveOldAvatar(student.avatar)) {
            removeAvatarFileIfLocal(student.avatar);
          }
          val = null;
        } else if (val && String(val).trim()) {
          val = String(val).trim();
          // Ignore avatar endpoint URLs echoed back by list responses; enforce size cap
          if (val.startsWith('/api/students/') || val.startsWith('/uploads/avatars/')) continue;
          if (val.length > 150_000) {
            return NextResponse.json({ message: 'Avatar is too large' }, { status: 400 });
          }
          const isUnshared = await canSafelyRemoveOldAvatar(student.avatar);
          val = persistAvatarDataUri(val, `student-${numericId}`, isUnshared ? student.avatar : null);
        } else {
          // Keep existing avatar if not explicitly set or removed
          continue;
        }
      } else if (prismaKey === 'gradeLevel') {
        val = val ? normalizeGradeLevel(String(val)) || null : null;
      } else if (prismaKey === 'branch') {
        val = val ? normalizeBranchDisplay(String(val)) || null : null;
      } else if (['studentCode', 'email'].includes(prismaKey)) {
        val = val ? String(val).trim() : null;
      }
      updateData[prismaKey] = val;
    }
  }

  await prisma.student.update({ where: { id: numericId }, data: updateData });
  invalidateCache(userCacheKey(user.id, 'students'));
  invalidateCache(userCacheKey(user.id, 'grades'));
  invalidateCache(userCacheKey(user.id, 'scores'));
  invalidateCache(userCacheKey(user.id, 'classrooms'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));
  return NextResponse.json({ message: 'Student updated' });
}, 'Failed to update student');

export const DELETE = withAuth<{ id: string }>(async (request, user, { params }) => {
  const { id } = await params;
  const numericId = Number(id);
  if (isNaN(numericId) || numericId <= 0) {
    return NextResponse.json({ message: 'รหัสนักเรียนไม่ถูกต้อง' }, { status: 400 });
  }

  // Check ownership
  const student = await prisma.student.findFirst({
    where: { id: numericId, userId: user.id },
  });
  if (!student) return NextResponse.json({ message: 'ไม่พบข้อมูลนักเรียนหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

  await prisma.student.delete({ where: { id: numericId } });
  invalidateCache(userCacheKey(user.id, 'students'));
  invalidateCache(userCacheKey(user.id, 'grades'));
  invalidateCache(userCacheKey(user.id, 'scores'));
  invalidateCache(userCacheKey(user.id, 'classrooms'));
  invalidateCache(userCacheKey(user.id, 'dashboard'));
  return NextResponse.json({ message: 'ลบนักเรียนเรียบร้อยแล้ว' });
}, 'เกิดข้อผิดพลาดในการลบนักเรียน');
