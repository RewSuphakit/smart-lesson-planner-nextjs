import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { formatAttendanceRecord, calculateAttendanceStatsFromGrouped } from '@/lib/formatters';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const date = searchParams.get('date');
    const studentId = searchParams.get('student_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get attendance history for a student
    if (studentId && classroomId) {
      // Validate ownership
      const student = await prisma.student.findFirst({
        where: { id: Number(studentId), userId: user.id },
      });
      if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });

      const records = await prisma.attendance.findMany({
        where: { studentId: Number(studentId), classroomId: Number(classroomId) },
        orderBy: { date: 'desc' },
      });
      return NextResponse.json({ data: records.map(formatAttendanceRecord) });
    }

    // Get all records in a date range for a classroom (Matrix view)
    if (classroomId && startDate && endDate) {
      // Verify classroom ownership
      const classroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id },
      });
      if (!classroom) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });

      const records = await prisma.attendance.findMany({
        where: {
          classroomId: Number(classroomId),
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { date: 'asc' },
      });
      return NextResponse.json({ data: records.map(formatAttendanceRecord) });
    }

    // Get by date
    if (classroomId && date) {
      // Verify classroom ownership
      const classroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id },
      });
      if (!classroom) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });

      const records = await prisma.attendance.findMany({
        where: { classroomId: Number(classroomId), date: new Date(date) },
      });
      return NextResponse.json({ data: records.map(formatAttendanceRecord) });
    }

    // Get stats
    if (classroomId) {
      // Verify classroom ownership
      const classroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id },
      });
      if (!classroom) return NextResponse.json([], { status: 200 });

      const groupedCounts = await prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { classroomId: Number(classroomId) },
        _count: true,
      });

      const stats = calculateAttendanceStatsFromGrouped(groupedCounts, classroom);
      return NextResponse.json({ data: stats });
    }

    return NextResponse.json({ data: [] });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to get attendance' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    // Bulk mark attendance
    if (Array.isArray(body.records)) {
      interface RecordInput {
        student_id: number;
        classroom_id: number;
        date: string;
        status: 'present' | 'late' | 'absent' | 'leave';
      }
      const records = body.records as RecordInput[];
      // Find unique classroom IDs and verify ownership in a single query
      const classroomIds = Array.from(new Set(records.map(r => Number(r.classroom_id)))) as number[];
      if (classroomIds.length > 0) {
        const ownedClassrooms = await prisma.classroom.findMany({
          where: { id: { in: classroomIds }, userId: user.id },
          select: { id: true },
        });
        const ownedClassroomIds = new Set(ownedClassrooms.map(c => c.id));
        const hasUnauthorizedClassroom = classroomIds.some(cid => !ownedClassroomIds.has(cid));
        if (hasUnauthorizedClassroom) {
          return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
        }
      }

      // Verify student ownership for all students in the request
      const studentIds = Array.from(new Set(records.map(r => Number(r.student_id)))) as number[];
      const ownedStudents = await prisma.student.findMany({
        where: { id: { in: studentIds }, userId: user.id },
        select: { id: true },
      });
      const ownedStudentIds = new Set(ownedStudents.map(s => s.id));
      const unauthorizedIds = studentIds.filter(id => !ownedStudentIds.has(id));
      if (unauthorizedIds.length > 0) {
        return NextResponse.json({ message: 'Some students not found or unauthorized' }, { status: 403 });
      }

      const attendanceOperations = records.map(record =>
        prisma.attendance.upsert({
          where: {
            studentId_classroomId_date: {
              studentId: record.student_id,
              classroomId: record.classroom_id,
              date: new Date(record.date),
            },
          },
          update: { status: record.status },
          create: {
            studentId: record.student_id,
            classroomId: record.classroom_id,
            date: new Date(record.date),
            status: record.status,
          },
        })
      );

      if (attendanceOperations.length > 0) {
        await prisma.$transaction(attendanceOperations);
      }
      return NextResponse.json({ message: 'Attendance marked' });
    }

    // Single mark
    if (!body.student_id || !body.classroom_id || !body.date || !body.status) {
      return NextResponse.json(
        { message: 'Missing required fields (student_id, classroom_id, date, status)' },
        { status: 400 }
      );
    }

    const validStatuses = ['present', 'late', 'absent', 'leave'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { message: 'Invalid attendance status. Must be present, late, absent, or leave' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(body.date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ message: 'Invalid date format' }, { status: 400 });
    }

    // Verify classroom and student ownership
    const [classroom, student] = await Promise.all([
      prisma.classroom.findFirst({
        where: { id: Number(body.classroom_id), userId: user.id },
      }),
      prisma.student.findFirst({
        where: { id: Number(body.student_id), userId: user.id },
      }),
    ]);
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
    if (!student) return NextResponse.json({ message: 'Student not found or unauthorized' }, { status: 404 });

    await prisma.attendance.upsert({
      where: {
        studentId_classroomId_date: {
          studentId: Number(body.student_id),
          classroomId: Number(body.classroom_id),
          date: parsedDate,
        },
      },
      update: { status: body.status },
      create: {
        studentId: Number(body.student_id),
        classroomId: Number(body.classroom_id),
        date: parsedDate,
        status: body.status,
      },
    });

    return NextResponse.json({ message: 'Attendance marked' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Mark attendance error:', error);
    return NextResponse.json({ message: 'Failed to mark attendance' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const date = searchParams.get('date');
    const studentId = searchParams.get('student_id');
    const id = searchParams.get('id');

    if (!id && !classroomId) {
      return NextResponse.json({ message: 'Missing required parameters (id or classroom_id required)' }, { status: 400 });
    }

    if (id) {
      const numericId = Number(id);
      if (isNaN(numericId) || numericId <= 0) {
        return NextResponse.json({ message: 'Invalid attendance ID' }, { status: 400 });
      }

      // Verify ownership of the attendance record
      const attendance = await prisma.attendance.findFirst({
        where: { id: numericId, classroom: { userId: user.id } },
      });
      if (!attendance) return NextResponse.json({ message: 'Attendance record not found' }, { status: 404 });

      await prisma.attendance.delete({ where: { id: numericId } });
      return NextResponse.json({ message: 'Attendance deleted' });
    }

    const numericClassroomId = Number(classroomId);
    if (isNaN(numericClassroomId) || numericClassroomId <= 0) {
      return NextResponse.json({ message: 'Invalid classroom ID' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ message: 'Date is required when deleting by classroom' }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ message: 'Invalid date format' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: numericClassroomId, userId: user.id },
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });

    if (studentId) {
      const numericStudentId = Number(studentId);
      if (isNaN(numericStudentId) || numericStudentId <= 0) {
        return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
      }

      // Verify student ownership
      const student = await prisma.student.findFirst({
        where: { id: numericStudentId, userId: user.id },
      });
      if (!student) return NextResponse.json({ message: 'Student not found or unauthorized' }, { status: 404 });

      await prisma.attendance.deleteMany({
        where: {
          studentId: numericStudentId,
          classroomId: numericClassroomId,
          date: parsedDate,
        },
      });
    } else {
      await prisma.attendance.deleteMany({
        where: { classroomId: numericClassroomId, date: parsedDate },
      });
    }

    return NextResponse.json({ message: 'Attendance deleted' });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to delete attendance' }, { status: 500 });
  }
}
