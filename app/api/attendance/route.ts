import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiHandler';
import { normalizeAttendanceDate } from '@/lib/formatters';
import { validateData, BulkRecordAttendanceSchema, RecordAttendanceSchema } from '@/lib/validation';
import {
  getStudentAttendanceHistory,
  getClassroomAttendanceRange,
  getClassroomAttendanceByDate,
  getClassroomAttendanceDates,
  getClassroomAttendanceRecords,
  getClassroomAttendanceStats,
  processBulkAttendance,
  processSingleAttendance,
  deleteAttendanceById,
  deleteAttendanceByFilter,
} from '@/lib/attendanceService';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroom_id');
  const date = searchParams.get('date');
  const studentId = searchParams.get('student_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // Get attendance history for a student (supports /api/attendance/history/:studentId rewrite or explicit classroom_id)
  if (studentId) {
    const records = await getStudentAttendanceHistory(user.id, studentId, classroomId ?? undefined);
    if (!records) return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    return NextResponse.json({ data: records });
  }

  // Get all records in a date range for a classroom (Matrix view)
  if (classroomId && startDate && endDate) {
    const cachedRange = await getClassroomAttendanceRange(user.id, classroomId, startDate, endDate);
    if (!cachedRange) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });
    return NextResponse.json({ data: cachedRange });
  }

  // Get by date
  if (classroomId && date) {
    const cachedByDate = await getClassroomAttendanceByDate(user.id, classroomId, date);
    if (!cachedByDate) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });
    return NextResponse.json({ data: cachedByDate });
  }

  // Distinct attendance dates for a classroom (lightweight alternative to type=records)
  if (classroomId && searchParams.get('type') === 'dates') {
    const grouped = await getClassroomAttendanceDates(user.id, classroomId);
    if (!grouped) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });
    return NextResponse.json({ data: grouped });
  }

  // Get all individual attendance records for a classroom (e.g. for Scores matrix week-date mapping)
  if (classroomId && (searchParams.get('type') === 'records' || searchParams.get('records') === 'true')) {
    const formatted = await getClassroomAttendanceRecords(user.id, classroomId);
    if (!formatted) return NextResponse.json({ message: 'Classroom not found' }, { status: 404 });
    return NextResponse.json({ data: formatted });
  }

  // Get stats (cached for 45s)
  if (classroomId) {
    const stats = await getClassroomAttendanceStats(user.id, classroomId);
    return NextResponse.json({ data: stats });
  }

  return NextResponse.json({ data: [] });
}, 'Failed to get attendance');

export const POST = withAuth(async (request, user) => {
  const body = await request.json();

  // Bulk mark attendance
  if (Array.isArray(body.records)) {
    const validation = validateData(body, BulkRecordAttendanceSchema);
    if (!validation.success) {
      return validation.response;
    }
    const result = await processBulkAttendance(user.id, validation.data.records);
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    return NextResponse.json({ message: 'Attendance marked' });
  }

  // Single mark
  const singleValidation = validateData(body, RecordAttendanceSchema);
  if (!singleValidation.success) {
    return singleValidation.response;
  }
  const result = await processSingleAttendance(user.id, singleValidation.data);
  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ message: 'Attendance marked' });
}, 'Failed to mark attendance');

export const DELETE = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroom_id');
  const date = searchParams.get('date');
  const studentId = searchParams.get('student_id');
  const studentIdsParam = searchParams.get('student_ids');
  const id = searchParams.get('id');

  if (!id && !classroomId) {
    return NextResponse.json({ message: 'Missing required parameters (id or classroom_id required)' }, { status: 400 });
  }

  if (id) {
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ message: 'Invalid attendance ID' }, { status: 400 });
    }

    const result = await deleteAttendanceById(user.id, numericId);
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    return NextResponse.json({ message: 'Attendance deleted' });
  }

  const numericClassroomId = Number(classroomId);
  if (isNaN(numericClassroomId) || numericClassroomId <= 0) {
    return NextResponse.json({ message: 'Invalid classroom ID' }, { status: 400 });
  }

  if (!date) {
    return NextResponse.json({ message: 'Date is required when deleting by classroom' }, { status: 400 });
  }

  try {
    normalizeAttendanceDate(date);
  } catch {
    return NextResponse.json({ message: 'Invalid date format' }, { status: 400 });
  }

  let studentIds: number[] | undefined;
  if (studentIdsParam) {
    studentIds = Array.from(
      new Set(
        studentIdsParam
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => !isNaN(n) && n > 0)
      )
    );
    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'Invalid student_ids parameter' }, { status: 400 });
    }
  }

  let numericStudentId: number | undefined;
  if (!studentIds && studentId) {
    numericStudentId = Number(studentId);
    if (isNaN(numericStudentId) || numericStudentId <= 0) {
      return NextResponse.json({ message: 'Invalid student ID' }, { status: 400 });
    }
  }

  const result = await deleteAttendanceByFilter(user.id, {
    classroomId: numericClassroomId,
    date,
    studentId: numericStudentId,
    studentIds,
  });

  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ message: 'Attendance deleted' });
}, 'Failed to delete attendance');
