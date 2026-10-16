/**
 * LINE Student Bindings API (Teacher/Admin)
 *
 * GET  /api/line/bindings — List all student LINE bindings under this teacher
 * DELETE /api/line/bindings — Unbind specific student(s) by id or student_code
 *
 * Protected by requireAuth()
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

// GET — List student bindings
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');

    // Get this teacher's students
    const teacherStudents = await prisma.student.findMany({
      where: {
        userId: user.id,
        ...(classroomId ? { classroomId: parseInt(classroomId, 10) } : {}),
      },
      select: {
        id: true,
        name: true,
        studentCode: true,
        classroomId: true,
        classroom: {
          select: { id: true, name: true },
        },
      },
    });

    const studentCodes = teacherStudents
      .map((s) => s.studentCode)
      .filter((c): c is string => !!c);

    if (studentCodes.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Find bindings for these students
    const bindings = await prisma.lineBinding.findMany({
      where: {
        studentCode: { in: studentCodes },
      },
      include: {
        classroom: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map student details
    const studentMap = new Map<string, (typeof teacherStudents)[0]>();
    for (const s of teacherStudents) {
      if (s.studentCode) studentMap.set(s.studentCode, s);
    }

    const data = bindings.map((b) => {
      const s = studentMap.get(b.studentCode);
      return {
        id: b.id,
        lineUserId: b.lineUserId,
        studentCode: b.studentCode,
        studentName: s?.name || 'ไม่พบชื่อ',
        classroomId: b.classroomId || s?.classroomId || null,
        classroomName: b.classroom?.name || s?.classroom?.name || 'ไม่ได้ระบุ',
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    return NextResponse.json({ data, count: data.length });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE bindings GET error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE — Unbind student(s)
export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const studentCode = searchParams.get('student_code');
    const unbindAll = searchParams.get('all') === 'true';

    // Get this teacher's student codes for authorization
    const teacherStudents = await prisma.student.findMany({
      where: { userId: user.id },
      select: { studentCode: true },
    });

    const allowedCodes = new Set(
      teacherStudents.map((s) => s.studentCode).filter((c): c is string => !!c)
    );

    if (unbindAll) {
      // Unbind all students of this teacher
      const deleted = await prisma.lineBinding.deleteMany({
        where: {
          studentCode: { in: Array.from(allowedCodes) },
        },
      });

      return NextResponse.json({
        message: `ลบการผูกบัญชีทั้งหมดเรียบร้อย (${deleted.count} รายการ)`,
        count: deleted.count,
      });
    }

    if (studentCode) {
      if (!allowedCodes.has(studentCode)) {
        return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการนักเรียนคนนี้' }, { status: 403 });
      }

      const deleted = await prisma.lineBinding.deleteMany({
        where: { studentCode },
      });

      return NextResponse.json({
        message: `ลบการผูกบัญชีของรหัส ${studentCode} เรียบร้อย`,
        count: deleted.count,
      });
    }

    if (id) {
      const bindingId = parseInt(id, 10);
      const binding = await prisma.lineBinding.findUnique({
        where: { id: bindingId },
      });

      if (!binding) {
        return NextResponse.json({ message: 'ไม่พบรายการผูกบัญชี' }, { status: 404 });
      }

      if (!allowedCodes.has(binding.studentCode)) {
        return NextResponse.json({ message: 'ไม่มีสิทธิ์จัดการนักเรียนคนนี้' }, { status: 403 });
      }

      await prisma.lineBinding.delete({
        where: { id: bindingId },
      });

      return NextResponse.json({
        message: 'ลบการผูกบัญชีเรียบร้อย',
        id: bindingId,
      });
    }

    return NextResponse.json(
      { message: 'กรุณาระบุ id หรือ student_code ที่ต้องการลบ' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE bindings DELETE error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
