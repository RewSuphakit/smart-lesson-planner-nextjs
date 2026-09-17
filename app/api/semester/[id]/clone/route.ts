import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';

/**
 * POST /api/semester/:id/clone
 * 
 * Clones classrooms and their students from this semester to a target semester.
 * 
 * Request body:
 *   - target_semester_id: The semester to clone INTO
 *   - include_students: boolean (default true) — also copy student assignments
 *   - include_timetable: boolean (default false) — also copy weekly schedules
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;
    const sourceSemesterId = Number(id);
    const body = await request.json();
    const targetSemesterId = Number(body.target_semester_id);
    const includeStudents = body.include_students !== false; // default true
    const includeTimetable = body.include_timetable === true; // default false

    if (isNaN(sourceSemesterId) || sourceSemesterId <= 0) {
      return NextResponse.json({ message: 'Invalid source semester ID' }, { status: 400 });
    }
    if (isNaN(targetSemesterId) || targetSemesterId <= 0) {
      return NextResponse.json({ message: 'target_semester_id is required' }, { status: 400 });
    }
    if (sourceSemesterId === targetSemesterId) {
      return NextResponse.json({ message: 'ไม่สามารถคัดลอกไปยังภาคเรียนเดียวกันได้' }, { status: 400 });
    }

    // Verify ownership of both semesters
    const [sourceSemester, targetSemester] = await Promise.all([
      prisma.semester.findFirst({ where: { id: sourceSemesterId, userId: user.id } }),
      prisma.semester.findFirst({ where: { id: targetSemesterId, userId: user.id } }),
    ]);

    if (!sourceSemester) {
      return NextResponse.json({ message: 'ภาคเรียนต้นทางไม่พบ' }, { status: 404 });
    }
    if (!targetSemester) {
      return NextResponse.json({ message: 'ภาคเรียนปลายทางไม่พบ' }, { status: 404 });
    }

    // Get source classrooms with students
    const sourceClassrooms = await prisma.classroom.findMany({
      where: { semesterId: sourceSemesterId, userId: user.id },
      include: includeStudents ? {
        students: {
          select: {
            name: true,
            studentCode: true,
            gradeLevel: true,
            email: true,
            avatar: true,
          },
        },
      } : undefined,
    });

    if (sourceClassrooms.length === 0) {
      return NextResponse.json({ message: 'ไม่มีห้องเรียนในภาคเรียนต้นทาง' }, { status: 400 });
    }

    // Clone classrooms (and optionally students) in a transaction
    const clonedClassrooms = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const sourceClassroom of sourceClassrooms) {
        // Create new classroom in target semester
        const newClassroom = await tx.classroom.create({
          data: {
            userId: user.id,
            semesterId: targetSemesterId,
            name: sourceClassroom.name,
            description: sourceClassroom.description,
            lateToAbsentRatio: sourceClassroom.lateToAbsentRatio,
            leaveToAbsentRatio: sourceClassroom.leaveToAbsentRatio,
            absentToFRatio: sourceClassroom.absentToFRatio,
            totalClasses: sourceClassroom.totalClasses,
            minAttendancePercent: sourceClassroom.minAttendancePercent,
            assignmentWeight: sourceClassroom.assignmentWeight,
            postTestWeight: sourceClassroom.postTestWeight,
            affectiveWeight: sourceClassroom.affectiveWeight,
            midtermWeight: sourceClassroom.midtermWeight,
            finalWeight: sourceClassroom.finalWeight,
            midtermMaxScore: sourceClassroom.midtermMaxScore,
            finalMaxScore: sourceClassroom.finalMaxScore,
            curriculumType: sourceClassroom.curriculumType,
            totalWeeks: sourceClassroom.totalWeeks,
            // Note: semesterStartDate intentionally NOT copied — use target semester dates
          },
        });

        let studentCount = 0;

        // Clone students if requested
        if (includeStudents && 'students' in sourceClassroom && Array.isArray(sourceClassroom.students)) {
          const students = sourceClassroom.students;
          if (students.length > 0) {
            await tx.student.createMany({
              data: students.map(s => ({
                userId: user.id,
                classroomId: newClassroom.id,
                name: s.name,
                studentCode: s.studentCode,
                gradeLevel: s.gradeLevel,
                email: s.email,
                avatar: s.avatar,
                // midtermScore, finalScore, affectiveScore reset to defaults
              })),
            });
            studentCount = students.length;
          }
        }

        results.push({
          source_classroom_id: sourceClassroom.id,
          new_classroom_id: newClassroom.id,
          name: newClassroom.name,
          student_count: studentCount,
        });
      }

      // Clone timetable if requested
      if (includeTimetable) {
        const sourceTimetable = await tx.weeklySchedule.findMany({
          where: { semesterId: sourceSemesterId, userId: user.id },
        });

        if (sourceTimetable.length > 0) {
          // Build a mapping from old classroomId to new classroomId
          const classroomIdMap = new Map<number, number>();
          for (const r of results) {
            classroomIdMap.set(r.source_classroom_id, r.new_classroom_id);
          }

          await tx.weeklySchedule.createMany({
            data: sourceTimetable.map(entry => ({
              userId: user.id,
              semesterId: targetSemesterId,
              timetableName: entry.timetableName,
              dayOfWeek: entry.dayOfWeek,
              startPeriod: entry.startPeriod,
              endPeriod: entry.endPeriod,
              startTime: entry.startTime,
              endTime: entry.endTime,
              subjectCode: entry.subjectCode,
              subjectName: entry.subjectName,
              room: entry.room,
              instructor: entry.instructor,
              groupName: entry.groupName,
              hours: entry.hours,
              entryType: entry.entryType,
              color: entry.color,
              classroomId: entry.classroomId ? (classroomIdMap.get(entry.classroomId) ?? null) : null,
            })),
          });
        }
      }

      return results;
    });

    return NextResponse.json({
      data: {
        source_semester: {
          id: sourceSemester.id,
          name: sourceSemester.name,
        },
        target_semester: {
          id: targetSemester.id,
          name: targetSemester.name,
        },
        cloned_classrooms: clonedClassrooms,
        total_classrooms: clonedClassrooms.length,
        total_students: clonedClassrooms.reduce((sum, c) => sum + c.student_count, 0),
      },
      message: `คัดลอก ${clonedClassrooms.length} ห้องเรียนไปยัง "${targetSemester.name}" สำเร็จ`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Clone semester error:', error);
    return NextResponse.json({ message: 'Failed to clone semester' }, { status: 500 });
  }
}
