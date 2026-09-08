import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveTargetWeeks } from '@/lib/semester';
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

    // Resolve target weeks from classroom settings (replaces old name-guessing logic)
    let targetWeeks = resolveTargetWeeks(classroom as Parameters<typeof resolveTargetWeeks>[0]);

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

    // If teacher already defined custom structures (e.g. 15 weeks for ปวส. or 18 for ปวช.), use that exact count
    if (structures.length > 0) {
      targetWeeks = structures.length;
    }

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

    } else if (exportType === 'full_matrix' || exportType === 'multi_sheet') {
      filenameBase += exportType === 'multi_sheet' ? '_scores_workbook' : '_full_scores_matrix';
      sheetName = 'ตารางคะแนนรวม';

      headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล'];
      for (let w = 1; w <= targetWeeks; w++) {
        headers.push(`W${w} - งานเก็บ`);
        headers.push(`W${w} - สอบย่อย`);
      }
      headers.push('กลางภาค', 'ปลายภาค', 'จิตพิสัย', 'รวมคะแนนสุทธิ');

      rows = students.map(student => {
        const studentRow: (string | number)[] = [
          student.studentCode || '',
          student.name
        ];

        let totalScore = 0;
        for (let w = 1; w <= targetWeeks; w++) {
          const score = scoreMap.get(`${student.id}_${w}`);
          const assignVal = score && score.assignmentScore !== null ? Number(score.assignmentScore) : '';
          const postVal = score && score.postTestScore !== null ? Number(score.postTestScore) : '';
          
          if (typeof assignVal === 'number') totalScore += assignVal;
          if (typeof postVal === 'number') totalScore += postVal;

          studentRow.push(assignVal);
          studentRow.push(postVal);
        }

        const midVal = student.midtermScore !== null ? Number(student.midtermScore) : '';
        const finVal = student.finalScore !== null ? Number(student.finalScore) : '';
        const affVal = student.affectiveScore !== null ? Number(student.affectiveScore) : '';

        if (typeof midVal === 'number') totalScore += midVal;
        if (typeof finVal === 'number') totalScore += finVal;
        if (typeof affVal === 'number') totalScore += affVal;

        studentRow.push(midVal);
        studentRow.push(finVal);
        studentRow.push(affVal);
        studentRow.push(Math.round(totalScore * 100) / 100);

        return studentRow;
      });
    } else {
      return NextResponse.json({ message: 'Invalid export_type' }, { status: 400 });
    }

    if (fileFormat === 'json') {
      return NextResponse.json({
        data: {
          classroom,
          targetWeeks,
          structures,
          headers,
          rows
        }
      });
    }

    if (fileFormat === 'xlsx') {
      const filename = `${filenameBase}.xlsx`;
      const wb = XLSX.utils.book_new();

      if (exportType === 'multi_sheet') {
        // Sheet 1: ตารางคะแนนรวม
        const wsMatrix = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, wsMatrix, 'ตารางคะแนนรวม');

        // Sheet 2: คะแนนงานเก็บ
        const assignHeaders = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', ...Array.from({ length: targetWeeks }, (_, i) => `W${i + 1} งานเก็บ`), 'รวมงานเก็บ'];
        const assignRows = students.map(student => {
          const r: (string | number)[] = [student.studentCode || '', student.name];
          let sumAssign = 0;
          for (let w = 1; w <= targetWeeks; w++) {
            const score = scoreMap.get(`${student.id}_${w}`);
            const val = score && score.assignmentScore !== null ? Number(score.assignmentScore) : '';
            if (typeof val === 'number') sumAssign += val;
            r.push(val);
          }
          r.push(Math.round(sumAssign * 100) / 100);
          return r;
        });
        const wsAssign = XLSX.utils.aoa_to_sheet([assignHeaders, ...assignRows]);
        XLSX.utils.book_append_sheet(wb, wsAssign, 'คะแนนงานเก็บ');

        // Sheet 3: คะแนนสอบย่อย
        const testHeaders = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', ...Array.from({ length: targetWeeks }, (_, i) => `W${i + 1} สอบย่อย`), 'รวมสอบย่อย'];
        const testRows = students.map(student => {
          const r: (string | number)[] = [student.studentCode || '', student.name];
          let sumTest = 0;
          for (let w = 1; w <= targetWeeks; w++) {
            const score = scoreMap.get(`${student.id}_${w}`);
            const val = score && score.postTestScore !== null ? Number(score.postTestScore) : '';
            if (typeof val === 'number') sumTest += val;
            r.push(val);
          }
          r.push(Math.round(sumTest * 100) / 100);
          return r;
        });
        const wsTests = XLSX.utils.aoa_to_sheet([testHeaders, ...testRows]);
        XLSX.utils.book_append_sheet(wb, wsTests, 'คะแนนสอบย่อย');

        // Sheet 4: สรุปและคะแนนสอบ
        const summaryHeaders = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', 'กลางภาค', 'ปลายภาค', 'จิตพิสัย', 'คะแนนรวมสุทธิ'];
        const summaryRows = students.map(student => {
          let total = 0;
          for (let w = 1; w <= targetWeeks; w++) {
            const score = scoreMap.get(`${student.id}_${w}`);
            if (score && score.assignmentScore !== null) total += Number(score.assignmentScore);
            if (score && score.postTestScore !== null) total += Number(score.postTestScore);
          }
          const mid = student.midtermScore !== null ? Number(student.midtermScore) : '';
          const fin = student.finalScore !== null ? Number(student.finalScore) : '';
          const aff = student.affectiveScore !== null ? Number(student.affectiveScore) : '';
          if (typeof mid === 'number') total += mid;
          if (typeof fin === 'number') total += fin;
          if (typeof aff === 'number') total += aff;
          return [student.studentCode || '', student.name, mid, fin, aff, Math.round(total * 100) / 100];
        });
        const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปและคะแนนสอบ');
      } else {
        const data = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      
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
