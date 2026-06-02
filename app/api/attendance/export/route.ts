import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(classroomId), userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    const where: Record<string, unknown> = { classroomId: Number(classroomId) };
    if (startDate) where.date = { ...(where.date as Record<string, unknown> || {}), gte: new Date(startDate) };
    if (endDate) where.date = { ...(where.date as Record<string, unknown> || {}), lte: new Date(endDate) };

    const records = await prisma.attendance.findMany({
      where,
      include: { student: { select: { studentCode: true, name: true } } },
      orderBy: [{ date: 'asc' }, { student: { studentCode: 'asc' } }],
    });

    // Format as CSV with UTF-8 BOM to prevent Thai encoding issues in Excel
    const header = '\uFEFFรหัสนักเรียน,ชื่อ-นามสกุล,วันที่,สถานะ\n';
    const rows = records.map((r) =>
      `"${r.student.studentCode || ''}","${r.student.name.replace(/"/g, '""')}","${r.date.toISOString().split('T')[0]}","${r.status}"`
    ).join('\n');

    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=attendance_${classroomId}.csv`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    return NextResponse.json({ message: 'Failed to export' }, { status: 500 });
  }
}
