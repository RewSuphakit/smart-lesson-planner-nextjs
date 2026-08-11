import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const lessonNumberParam = searchParams.get('lesson_number');
    const exportType = searchParams.get('export_type') || 'current_week';
    const fileFormat = searchParams.get('file_format') || 'csv'; // 'csv' or 'xlsx'

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(classroomId), userId: user.id }
    });
    if (!classroom) {
      return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });
    }

    // Determine target weeks based on total_classes of the classroom
    const totalClasses = classroom.totalClasses || 40;
    let targetWeeks = 18;
    if (totalClasses % 18 !== 0) {
      for (let w = 15; w <= 20; w++) {
        if (totalClasses % w === 0) {
          targetWeeks = w;
          break;
        }
      }
    }

    // Fetch students
    const students = await prisma.student.findMany({
      where: { classroomId: Number(classroomId), userId: user.id },
      orderBy: [
        { studentCode: 'asc' },
        { name: 'asc' }
      ]
    });

    // Fetch score structures (weeks definition)
    const structures = await prisma.scoreStructure.findMany({
      where: { classroomId: Number(classroomId) },
      orderBy: { lessonNumber: 'asc' }
    });

    // Map structures by lessonNumber for quick lookup
    const structureMap = new Map();
    structures.forEach(s => structureMap.set(s.lessonNumber, s));

    // Fetch scores
    const allScores = await prisma.studentScore.findMany({
      where: { classroomId: Number(classroomId) }
    });

    // Map scores by studentId_lessonNumber for quick lookup
    const scoreMap = new Map();
    allScores.forEach(s => {
      scoreMap.set(`${s.studentId}_${s.lessonNumber}`, s);
    });

    let filenameBase = `scores_${classroom.name.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')}`;
    let headers: string[] = [];
    let rows: any[][] = [];
    let sheetName = 'Scores';

    if (exportType === 'current_week') {
      const lessonNumber = Number(lessonNumberParam || 1);
      const struct = structureMap.get(lessonNumber) || {
        maxAssignmentScore: 10,
        maxPostTestScore: 10,
        lessonName: `บทที่/สัปดาห์ที่ ${lessonNumber}`
      };

      const maxAssign = struct.maxAssignmentScore !== null ? Number(struct.maxAssignmentScore) : 10;
      const maxPost = struct.maxPostTestScore !== null ? Number(struct.maxPostTestScore) : 10;

      filenameBase += `_week_${lessonNumber}`;
      sheetName = `สัปดาห์ที่ ${lessonNumber}`;
      
      headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', `คะแนนงานเก็บ (เต็ม ${maxAssign})`, `คะแนนสอบย่อย (เต็ม ${maxPost})`];
      rows = students.map(student => {
        const score = scoreMap.get(`${student.id}_${lessonNumber}`);
        const assignVal = score && score.assignmentScore !== null ? Number(score.assignmentScore) : '';
        const postVal = score && score.postTestScore !== null ? Number(score.postTestScore) : '';
        
        return [
          student.studentCode || '',
          student.name,
          assignVal,
          postVal
        ];
      });

    } else if (exportType === 'all_assignments') {
      filenameBase += '_assignments_template';
      sheetName = 'คะแนนงานเก็บ';

      headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', ...Array.from({ length: targetWeeks }, (_, i) => `สัปดาห์ที่ ${i + 1}`)];
      rows = students.map(student => {
        const studentRow: (string | number)[] = [
          student.studentCode || '',
          student.name
        ];

        for (let w = 1; w <= targetWeeks; w++) {
          const score = scoreMap.get(`${student.id}_${w}`);
          const val = score && score.assignmentScore !== null ? Number(score.assignmentScore) : '';
          studentRow.push(val);
        }

        return studentRow;
      });

    } else if (exportType === 'all_post_tests') {
      filenameBase += '_post_tests_template';
      sheetName = 'คะแนนสอบย่อย';

      headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', ...Array.from({ length: targetWeeks }, (_, i) => `สัปดาห์ที่ ${i + 1}`)];
      rows = students.map(student => {
        const studentRow: (string | number)[] = [
          student.studentCode || '',
          student.name
        ];

        for (let w = 1; w <= targetWeeks; w++) {
          const score = scoreMap.get(`${student.id}_${w}`);
          const val = score && score.postTestScore !== null ? Number(score.postTestScore) : '';
          studentRow.push(val);
        }

        return studentRow;
      });

    } else if (exportType === 'full_matrix') {
      filenameBase += '_full_scores_matrix';
      sheetName = 'ตารางคะแนนรวม';

      headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล'];
      for (let w = 1; w <= targetWeeks; w++) {
        headers.push(`สัปดาห์ที่ ${w} - งานเก็บ`);
        headers.push(`สัปดาห์ที่ ${w} - สอบย่อย`);
      }

      rows = students.map(student => {
        const studentRow: (string | number)[] = [
          student.studentCode || '',
          student.name
        ];

        for (let w = 1; w <= targetWeeks; w++) {
          const score = scoreMap.get(`${student.id}_${w}`);
          const assignVal = score && score.assignmentScore !== null ? Number(score.assignmentScore) : '';
          const postVal = score && score.postTestScore !== null ? Number(score.postTestScore) : '';
          
          studentRow.push(assignVal);
          studentRow.push(postVal);
        }

        return studentRow;
      });
    } else {
      return NextResponse.json({ message: 'Invalid export_type' }, { status: 400 });
    }

    if (fileFormat === 'xlsx') {
      const filename = `${filenameBase}.xlsx`;
      
      // Build SheetJS Workbook
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Write workbook to buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    } else {
      const filename = `${filenameBase}.csv`;
      const BOM = '\uFEFF';
      
      // Format rows for CSV (handling wrapping and quoting strings)
      const csvHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
      const csvRows = rows.map(row => 
        row.map(cell => {
          if (typeof cell === 'string') {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      );

      const csvContent = BOM + [csvHeaders, ...csvRows].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Scores Export error:', error);
    return NextResponse.json({ message: 'Failed to export scores' }, { status: 500 });
  }
}
