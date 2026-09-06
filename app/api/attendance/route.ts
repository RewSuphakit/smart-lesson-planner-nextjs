import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

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
      const mapped = records.map(r => ({
        id: r.id,
        student_id: r.studentId,
        classroom_id: r.classroomId,
        date: r.date,
        status: r.status,
        created_at: r.createdAt,
        updated_at: r.updatedAt
      }));
      return NextResponse.json({ data: mapped });
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
      const mapped = records.map(r => ({
        id: r.id,
        student_id: r.studentId,
        classroom_id: r.classroomId,
        date: r.date,
        status: r.status,
        created_at: r.createdAt,
        updated_at: r.updatedAt
      }));
      return NextResponse.json({ data: mapped });
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
      const mapped = records.map(r => ({
        id: r.id,
        student_id: r.studentId,
        classroom_id: r.classroomId,
        date: r.date,
        status: r.status,
        created_at: r.createdAt,
        updated_at: r.updatedAt
      }));
      return NextResponse.json({ data: mapped });
    }

    // Get stats
    if (classroomId) {
      // Verify classroom ownership
      const classroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id },
      });
      if (!classroom) return NextResponse.json([], { status: 200 });

      const ratioLate = classroom.lateToAbsentRatio || 3;
      const ratioLeave = classroom.leaveToAbsentRatio || 2;
      const totalClasses = classroom.totalClasses || 40;
      const minAttPercent = classroom.minAttendancePercent || 80;
      const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

      const records = await prisma.attendance.findMany({
        where: { classroomId: Number(classroomId) },
      });

      // Group by student
      const studentMap = new Map<number, { present: number; late: number; absent: number; leave: number }>();
      for (const r of records) {
        if (!studentMap.has(r.studentId)) {
          studentMap.set(r.studentId, { present: 0, late: 0, absent: 0, leave: 0 });
        }
        const s = studentMap.get(r.studentId)!;
        if (r.status === 'present') s.present++;
        else if (r.status === 'late') s.late++;
        else if (r.status === 'absent') s.absent++;
        else if (r.status === 'leave') s.leave++;
      }

      const stats = Array.from(studentMap.entries()).map(([studentId, s]) => {
        const convertedFromLate = Math.floor(s.late / ratioLate);
        const convertedFromLeave = Math.floor(s.leave / ratioLeave);
        const totalConverted = s.absent + convertedFromLate + convertedFromLeave;
        return {
          student_id: studentId,
          present_count: s.present,
          late_count: s.late,
          absent_count: s.absent,
          leave_count: s.leave,
          converted_absent_count: totalConverted,
          remaining_late_count: s.late % ratioLate,
          remaining_leave_count: s.leave % ratioLeave,
          is_f: totalConverted > maxAllowedAbsences,
          max_allowed_absences: maxAllowedAbsences,
          total_classes: totalClasses,
          converted_from_late: convertedFromLate,
          converted_from_leave: convertedFromLeave,
        };
      });

      return NextResponse.json({ data: stats });
    }

    return NextResponse.json({ data: [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
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
      // Find unique classroom IDs and verify ownership
      const classroomIds = Array.from(new Set(records.map(r => Number(r.classroom_id)))) as number[];
      for (const cid of classroomIds) {
        const classroom = await prisma.classroom.findFirst({
          where: { id: cid, userId: user.id }
        });
        if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
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
    // Verify classroom and student ownership
    const [classroom, student] = await Promise.all([
      prisma.classroom.findFirst({
        where: { id: Number(body.classroom_id), userId: user.id }
      }),
      prisma.student.findFirst({
        where: { id: Number(body.student_id), userId: user.id }
      }),
    ]);
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
    if (!student) return NextResponse.json({ message: 'Student not found or unauthorized' }, { status: 404 });

    await prisma.attendance.upsert({
      where: {
        studentId_classroomId_date: {
          studentId: body.student_id,
          classroomId: body.classroom_id,
          date: new Date(body.date),
        },
      },
      update: { status: body.status },
      create: {
        studentId: body.student_id,
        classroomId: body.classroom_id,
        date: new Date(body.date),
        status: body.status,
      },
    });

    return NextResponse.json({ message: 'Attendance marked' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
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
        where: { id: numericId, classroom: { userId: user.id } }
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
      where: { id: numericClassroomId, userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });

    if (studentId) {
      const numericStudentId = Number(studentId);
      if (isNaN(numericStudentId) || numericStudentId <= 0) {
        return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
      }

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
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete attendance' }, { status: 500 });
  }
}
