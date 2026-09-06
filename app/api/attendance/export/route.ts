import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import * as XLSX from 'xlsx';

function getExcelColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroom_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const fileFormat = searchParams.get('file_format') || searchParams.get('format') || 'xlsx';

    if (!classroomId) {
      return NextResponse.json({ message: 'classroom_id required' }, { status: 400 });
    }

    // Verify classroom ownership and get settings
    const classroom = await prisma.classroom.findFirst({
      where: { id: Number(classroomId), userId: user.id }
    });
    if (!classroom) return NextResponse.json({ message: 'Classroom not found or unauthorized' }, { status: 404 });

    const ratioLate = classroom.lateToAbsentRatio || 3;
    const ratioLeave = classroom.leaveToAbsentRatio || 2;
    const totalClasses = classroom.totalClasses || 40;
    const minAttPercent = classroom.minAttendancePercent || 80;
    const maxAllowedAbsences = Math.floor(totalClasses * ((100 - minAttPercent) / 100));

    // Fetch all students in the classroom
    const students = await prisma.student.findMany({
      where: { classroomId: Number(classroomId), userId: user.id },
      orderBy: [{ studentCode: 'asc' }, { name: 'asc' }]
    });

    // Build the query filter for records within range
    const where: Record<string, unknown> = { classroomId: Number(classroomId) };
    if (startDate) where.date = { ...(where.date as Record<string, unknown> || {}), gte: new Date(startDate) };
    if (endDate) where.date = { ...(where.date as Record<string, unknown> || {}), lte: new Date(endDate) };

    // Fetch attendance records in the target range
    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Fetch all attendance records for overall classroom statistics (used for overall term F-grade status)
    const allRecordsForClass = await prisma.attendance.findMany({
      where: { classroomId: Number(classroomId) }
    });

    // Find unique dates in sorted order
    const uniqueDates = Array.from(
      new Set(records.map(r => r.date.toISOString().split('T')[0]))
    ).sort();

    // Map range records by student_id
    const rangeMap = new Map<number, { present: number; late: number; absent: number; leave: number }>();
    records.forEach(r => {
      if (!rangeMap.has(r.studentId)) {
        rangeMap.set(r.studentId, { present: 0, late: 0, absent: 0, leave: 0 });
      }
      const s = rangeMap.get(r.studentId)!;
      if (r.status === 'present') s.present++;
      else if (r.status === 'late') s.late++;
      else if (r.status === 'absent') s.absent++;
      else if (r.status === 'leave') s.leave++;
    });

    // Map overall records by student_id
    const overallMap = new Map<number, { present: number; late: number; absent: number; leave: number }>();
    allRecordsForClass.forEach(r => {
      if (!overallMap.has(r.studentId)) {
        overallMap.set(r.studentId, { present: 0, late: 0, absent: 0, leave: 0 });
      }
      const s = overallMap.get(r.studentId)!;
      if (r.status === 'present') s.present++;
      else if (r.status === 'late') s.late++;
      else if (r.status === 'absent') s.absent++;
      else if (r.status === 'leave') s.leave++;
    });

    // Calculate initial dashboard stats
    let totalPercentsSum = 0;
    let fCount = 0;
    students.forEach(student => {
      const studentRangeRecords = records.filter(r => r.studentId === student.id);
      const rPresent = rangeMap.get(student.id)?.present || 0;
      const rLate = rangeMap.get(student.id)?.late || 0;
      const rAbsent = rangeMap.get(student.id)?.absent || 0;
      const rLeave = rangeMap.get(student.id)?.leave || 0;

      const rangeConvertedAbsent = rAbsent + Math.floor(rLate / ratioLate) + Math.floor(rLeave / ratioLeave);
      const rangeTotalChecked = studentRangeRecords.length;
      const rangePercent = rangeTotalChecked > 0 
        ? Math.max(0, Math.min(100, Math.round(((rangeTotalChecked - rangeConvertedAbsent) / rangeTotalChecked) * 10000) / 100)) 
        : 100;
      totalPercentsSum += rangePercent;

      const oLate = overallMap.get(student.id)?.late || 0;
      const oAbsent = overallMap.get(student.id)?.absent || 0;
      const oLeave = overallMap.get(student.id)?.leave || 0;
      const overallConvertedAbsent = oAbsent + Math.floor(oLate / ratioLate) + Math.floor(oLeave / ratioLeave);
      if (overallConvertedAbsent > maxAllowedAbsences) {
        fCount++;
      }
    });

    const classAverageInit = students.length > 0 ? Math.round((totalPercentsSum / students.length) * 100) / 100 : 100;
    const classFCountInit = fCount;

    const filenameBase = `attendance_${classroom.name.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')}`;

    if (fileFormat === 'xlsx') {
      const filename = `${filenameBase}.xlsx`;

      const lastDateColLetter = getExcelColumnLetter(uniqueDates.length + 1);
      
      const colPresentLetter = getExcelColumnLetter(uniqueDates.length + 2);
      const colLateLetter = getExcelColumnLetter(uniqueDates.length + 3);
      const colAbsentLetter = getExcelColumnLetter(uniqueDates.length + 4);
      const colLeaveLetter = getExcelColumnLetter(uniqueDates.length + 5);
      const colRangeConvertedLetter = getExcelColumnLetter(uniqueDates.length + 6);
      const colRangePercentLetter = getExcelColumnLetter(uniqueDates.length + 7);
      const colVisualChartLetter = getExcelColumnLetter(uniqueDates.length + 8);
      const colOverallConvertedLetter = getExcelColumnLetter(uniqueDates.length + 9);
      const colOverallStatusLetter = getExcelColumnLetter(uniqueDates.length + 10);

      // Dashboard rows (Top 5 rows of the Excel sheet)
      const dashboardRows = [
        [`แดชบอร์ดสรุปสถิติเข้าเรียน: ห้องเรียน ${classroom.name}`, '', '', '', '', ''],
        [`ช่วงวันที่: ${startDate || 'ทั้งหมด'} ถึง ${endDate || 'ปัจจุบัน'}`, '', '', '', '', ''],
        [`จำนวนนักเรียนทั้งหมด: ${students.length} คน`, `จำนวนคาบเรียนที่เช็คชื่อ: ${uniqueDates.length} คาบ`, '', '', '', ''],
        [`เปอร์เซ็นต์เข้าเรียนเฉลี่ยของห้อง:`, { t: 'n', f: `AVERAGE(${colRangePercentLetter}7:${colRangePercentLetter}${students.length+6})`, v: classAverageInit }, `นักเรียนติด มส. ทั้งห้อง:`, { t: 'n', f: `COUNTIF(${colOverallStatusLetter}7:${colOverallStatusLetter}${students.length+6},"หมดสิทธิ์สอบ (มส.)")`, v: classFCountInit }, '', ''],
        ['', '', '', '', '', ''] // Padding row
      ];

      // Matrix sheet headers (row 6)
      const headers = [
        'รหัสนักเรียน',
        'ชื่อ-นามสกุล',
        ...uniqueDates,
        'มา (ครั้ง)',
        'สาย (ครั้ง)',
        'ขาด (ครั้ง)',
        'ลา (ครั้ง)',
        'เทียบขาดสะสม (ช่วงนี้)',
        'เปอร์เซ็นต์เข้าเรียน (ช่วงนี้)',
        'แผนภูมิความสม่ำเสมอ (0-100%)',
        'เทียบขาดสะสม (ทั้งเทอม)',
        'สถานะ (ทั้งเทอม)'
      ];

      // Matrix sheet rows (starting at row 7)
      const rows = students.map((student, idx) => {
        const studentRangeRecords = records.filter(r => r.studentId === student.id);
        const rPresent = rangeMap.get(student.id)?.present || 0;
        const rLate = rangeMap.get(student.id)?.late || 0;
        const rAbsent = rangeMap.get(student.id)?.absent || 0;
        const rLeave = rangeMap.get(student.id)?.leave || 0;

        const rangeConvertedAbsent = rAbsent + Math.floor(rLate / ratioLate) + Math.floor(rLeave / ratioLeave);
        const rangeTotalChecked = studentRangeRecords.length;
        const rangePercent = rangeTotalChecked > 0 
          ? Math.max(0, Math.min(100, Math.round(((rangeTotalChecked - rangeConvertedAbsent) / rangeTotalChecked) * 10000) / 100)) 
          : 100;

        const oLate = overallMap.get(student.id)?.late || 0;
        const oAbsent = overallMap.get(student.id)?.absent || 0;
        const oLeave = overallMap.get(student.id)?.leave || 0;
        const overallConvertedAbsent = oAbsent + Math.floor(oLate / ratioLate) + Math.floor(oLeave / ratioLeave);
        const isF = overallConvertedAbsent > maxAllowedAbsences;
        const statusLabel = isF ? 'หมดสิทธิ์สอบ (มส.)' : 'ปกติ';

        const studentRow: any[] = [
          student.studentCode || '',
          student.name
        ];

        // Add status mapping per date
        uniqueDates.forEach(dateStr => {
          const rec = studentRangeRecords.find(r => r.date.toISOString().split('T')[0] === dateStr);
          if (!rec) {
            studentRow.push('-');
          } else {
            const thaiStatus = rec.status === 'present' ? 'มา' :
                               rec.status === 'late' ? 'สาย' :
                               rec.status === 'absent' ? 'ขาด' :
                               rec.status === 'leave' ? 'ลา' : '-';
            studentRow.push(thaiStatus);
          }
        });

        // Add summary columns (using formulas if there are dates checked)
        if (uniqueDates.length > 0) {
          const R = idx + 7; // Row number (1-based, student rows start at row 7)

          studentRow.push(
            { t: 'n', f: `COUNTIF(C${R}:${lastDateColLetter}${R},"มา")`, v: rPresent },
            { t: 'n', f: `COUNTIF(C${R}:${lastDateColLetter}${R},"สาย")`, v: rLate },
            { t: 'n', f: `COUNTIF(C${R}:${lastDateColLetter}${R},"ขาด")`, v: rAbsent },
            { t: 'n', f: `COUNTIF(C${R}:${lastDateColLetter}${R},"ลา")`, v: rLeave },
            { t: 'n', f: `${colAbsentLetter}${R}+INT(${colLateLetter}${R}/${ratioLate})+INT(${colLeaveLetter}${R}/${ratioLeave})`, v: rangeConvertedAbsent },
            { t: 'n', f: `IF((${colPresentLetter}${R}+${colLateLetter}${R}+${colAbsentLetter}${R}+${colLeaveLetter}${R})>0,ROUND(((${colPresentLetter}${R}+${colLateLetter}${R}+${colAbsentLetter}${R}+${colLeaveLetter}${R})-${colRangeConvertedLetter}${R})/(${colPresentLetter}${R}+${colLateLetter}${R}+${colAbsentLetter}${R}+${colLeaveLetter}${R})*100,2),100)`, v: rangePercent },
            { t: 's', f: `REPT("🟢",ROUND(${colRangePercentLetter}${R}/10,0))&REPT("🔴",10-ROUND(${colRangePercentLetter}${R}/10,0))`, v: '🟢'.repeat(Math.round(rangePercent/10)) + '🔴'.repeat(10 - Math.round(rangePercent/10)) },
            { t: 'n', v: overallConvertedAbsent },
            { t: 's', f: `IF(${colOverallConvertedLetter}${R}>${maxAllowedAbsences},"หมดสิทธิ์สอบ (มส.)","ปกติ")`, v: statusLabel }
          );
        } else {
          // If no dates, output static default values
          studentRow.push(0, 0, 0, 0, 0, 100, '🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢', overallConvertedAbsent, statusLabel);
        }

        return studentRow;
      });

      // Sheet 2 headers and rows (Detailed Log)
      const detailedHeaders = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'วันที่', 'สถานะ'];
      const detailedRows = records.map(r => {
        const student = students.find(s => s.id === r.studentId);
        const thaiStatus = r.status === 'present' ? 'มาเรียน' :
                           r.status === 'late' ? 'สาย' :
                           r.status === 'absent' ? 'ขาด' :
                           r.status === 'leave' ? 'ลา' : r.status;
        return [
          student?.studentCode || '',
          student?.name || '',
          r.date.toISOString().split('T')[0],
          thaiStatus
        ];
      });

      // Build SheetJS Workbook
      const wb = XLSX.utils.book_new();

      // Matrix sheet
      const ws1 = XLSX.utils.aoa_to_sheet([...dashboardRows, headers, ...rows]);
      
      // Merge dashboard cells (row 0 title, row 1 date range)
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title A1:F1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }  // Dates A2:F2
      ];

      const ws1ColWidths = headers.map(h => ({ wch: Math.max(h.length * 2, 10) }));
      ws1ColWidths[0] = { wch: 15 }; // studentCode
      ws1ColWidths[1] = { wch: 25 }; // name
      ws1ColWidths[uniqueDates.length + 8] = { wch: 22 }; // chart column width
      ws1['!cols'] = ws1ColWidths;
      XLSX.utils.book_append_sheet(wb, ws1, 'ตารางสรุปเข้าเรียน');

      // Detailed sheet
      const ws2 = XLSX.utils.aoa_to_sheet([detailedHeaders, ...detailedRows]);
      ws2['!cols'] = [
        { wch: 15 }, // studentCode
        { wch: 25 }, // name
        { wch: 15 }, // date
        { wch: 15 }  // status
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'ประวัติแบบละเอียด');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    } else if (fileFormat === 'json') {
      const summaryList = students.map((s, idx) => {
        const studentRangeRecords = records.filter(r => r.studentId === s.id);
        const rPresent = rangeMap.get(s.id)?.present || 0;
        const rLate = rangeMap.get(s.id)?.late || 0;
        const rAbsent = rangeMap.get(s.id)?.absent || 0;
        const rLeave = rangeMap.get(s.id)?.leave || 0;
        const rangeConvertedAbsent = rAbsent + Math.floor(rLate / ratioLate) + Math.floor(rLeave / ratioLeave);
        const rangeTotalChecked = studentRangeRecords.length;
        const rangePercent = rangeTotalChecked > 0 
          ? Math.max(0, Math.min(100, Math.round(((rangeTotalChecked - rangeConvertedAbsent) / rangeTotalChecked) * 10000) / 100)) 
          : 100;
        const oLate = overallMap.get(s.id)?.late || 0;
        const oAbsent = overallMap.get(s.id)?.absent || 0;
        const oLeave = overallMap.get(s.id)?.leave || 0;
        const overallConvertedAbsent = oAbsent + Math.floor(oLate / ratioLate) + Math.floor(oLeave / ratioLeave);
        const isF = overallConvertedAbsent > maxAllowedAbsences;

        const dateStatusMap: Record<string, string> = {};
        uniqueDates.forEach(d => {
          const rec = studentRangeRecords.find(r => r.date.toISOString().split('T')[0] === d);
          dateStatusMap[d] = rec ? (rec.status === 'present' ? 'มา' : rec.status === 'late' ? 'สาย' : rec.status === 'absent' ? 'ขาด' : rec.status === 'leave' ? 'ลา' : '-') : '-';
        });

        return {
          no: idx + 1,
          id: s.id,
          student_code: s.studentCode || '',
          name: s.name,
          present: rPresent,
          late: rLate,
          absent: rAbsent,
          leave: rLeave,
          converted_absent: rangeConvertedAbsent,
          attendance_percent: rangePercent,
          overall_converted_absent: overallConvertedAbsent,
          status: isF ? 'หมดสิทธิ์สอบ (ข.ร.)' : rangePercent < minAttPercent ? 'เฝ้าระวัง' : 'ปกติ',
          is_f: isF,
          date_records: dateStatusMap,
        };
      });

      const detailedList = records.map((r, idx) => {
        const student = students.find(s => s.id === r.studentId);
        const thaiStatus = r.status === 'present' ? 'มาเรียน' :
                           r.status === 'late' ? 'สาย' :
                           r.status === 'absent' ? 'ขาด' :
                           r.status === 'leave' ? 'ลา' : r.status;
        return {
          no: idx + 1,
          student_code: student?.studentCode || '',
          name: student?.name || '',
          date: r.date.toISOString().split('T')[0],
          status: thaiStatus,
        };
      });

      return NextResponse.json({
        data: {
          classroom: {
            id: classroom.id,
            name: classroom.name,
            totalClasses,
            maxAllowedAbsences,
            minAttPercent,
            ratioLate,
            ratioLeave,
          },
          uniqueDates,
          summaryStats: {
            totalStudents: students.length,
            recordsCount: records.length,
            datesCount: uniqueDates.length,
            fCount,
            avgPercent: (totalPercentsSum / (students.length || 1)).toFixed(1),
          },
          summaryList,
          detailedList,
        }
      });
    } else {
      // Fallback: CSV
      const filename = `${filenameBase}.csv`;
      const BOM = '\uFEFF';
      const csvHeaders = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'วันที่', 'สถานะ'];
      const csvRows = records.map(r => {
        const student = students.find(s => s.id === r.studentId);
        const thaiStatus = r.status === 'present' ? 'มาเรียน' :
                           r.status === 'late' ? 'สาย' :
                           r.status === 'absent' ? 'ขาด' :
                           r.status === 'leave' ? 'ลา' : r.status;
        return [
          student?.studentCode || '',
          student?.name || '',
          r.date.toISOString().split('T')[0],
          thaiStatus
        ];
      });

      const formattedHeaders = csvHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
      const formattedRows = csvRows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      return new NextResponse(BOM + formattedHeaders + '\n' + formattedRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Attendance Export error:', error);
    return NextResponse.json({ message: 'Failed to export' }, { status: 500 });
  }
}


