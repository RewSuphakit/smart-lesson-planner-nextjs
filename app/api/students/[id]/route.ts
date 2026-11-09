import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/apiHandler';
import { invalidateCache, userCacheKey } from '@/lib/cache';
import { normalizeGradeLevel, normalizeBranchDisplay } from '@/lib/studentSections';

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

  return NextResponse.json({ data: student });
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
    avatar: 'avatar',
  };

  // Lookup classroom max scores if updating exam scores
  let classroomMaxScores: { midterm: number; final: number } = { midterm: 100, final: 100 };
  if (body.midterm_score !== undefined || body.final_score !== undefined) {
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
      } else if (prismaKey === 'midtermScore' || prismaKey === 'finalScore') {
        if (val === '' || val === null || val === undefined) {
          val = null;
        } else {
          const num = Number(val);
          if (isNaN(num)) {
            val = null;
          } else if (num === -1 || num === -2) {
            // Special scores: -1 = ขาดสอบ (absent), -2 = หมดสิทธิ์สอบ (no rights)
            val = num;
          } else {
            const maxScore = prismaKey === 'midtermScore' ? classroomMaxScores.midterm : classroomMaxScores.final;
            val = Math.min(maxScore, Math.max(0, num));
          }
        }
      } else if (prismaKey === 'avatar') {
        if (body.remove_avatar === true) {
          val = null;
        } else if (val && String(val).trim()) {
          val = String(val).trim();
          // Ignore avatar endpoint URLs echoed back by list responses; enforce size cap
          if (val.startsWith('/api/students/')) continue;
          if (val.length > 150_000) {
            return NextResponse.json({ message: 'Avatar is too large' }, { status: 400 });
          }
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
