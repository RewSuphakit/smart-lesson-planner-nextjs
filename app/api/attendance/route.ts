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
      // Find unique classroom IDs and verify ownership
      const classroomIds = Array.from(new Set(body.records.map((r: any) => Number(r.classroom_id)))) as number[];
      for (const cid of classroomIds) {
        const classroom = await prisma.classroom.findFirst({
          where: { id: cid, userId: user.id }
        });
        if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
      }

      for (const record of body.records) {
        await prisma.attendance.upsert({
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
        });
      }
      return NextResponse.json({ message: 'Attendance marked' });
    }

    // Single mark
    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(body.classroom_id), userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

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
    const id = searchParams.get('id');

    if (id) {
      // Verify ownership of the attendance record
      const attendance = await prisma.attendance.findFirst({
        where: { id: Number(id), classroom: { userId: user.id } }
      });
      if (!attendance) return NextResponse.json({ message: 'Attendance record not found' }, { status: 404 });

      await prisma.attendance.delete({ where: { id: Number(id) } });
    } else if (classroomId && date) {
      // Verify classroom ownership
      const classroom = await prisma.classroom.findFirst({
        where: { id: Number(classroomId), userId: user.id }
      });
      if (!classroom) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });

      await prisma.attendance.deleteMany({
        where: { classroomId: Number(classroomId), date: new Date(date) },
      });
    }

    return NextResponse.json({ message: 'Attendance deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete attendance' }, { status: 500 });
  }
}
