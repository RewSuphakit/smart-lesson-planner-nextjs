'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, X, Download, Copy, Check, Search, 
  Eye, CheckSquare, Square, Sparkles, Filter, 
  Layers, Calendar, Award, CheckCircle2, TrendingUp,
  TableProperties, Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export interface Classroom {
  id: string | number;
  name: string;
  description?: string;
  total_classes?: number;
  assignment_weight?: number;
  post_test_weight?: number;
  affective_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
}

export interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  classroom_id?: string | number;
  midterm_score?: number | null;
  final_score?: number | null;
  affective_score?: number | null;
}

export interface ScoreStructure {
  lesson_number: number;
  lesson_name: string;
  max_assignment_score: number;
  max_post_test_score: number;
  hours: number;
}

export interface ScoreValue {
  assignment_score: number | string;
  post_test_score: number | string;
}

export interface FullMatrixScoresMap {
  [key: string]: ScoreValue;
}

interface ScoreExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: Classroom | null;
  students: Student[];
  structures: ScoreStructure[];
  matrixScores: FullMatrixScoresMap;
  calculatedWeekDates?: Record<number, string>;
  weekAttendanceMap?: Record<string, string>;
  analyticsSummary?: {
    avgScore: number;
    completionRate: number;
    highestScore: number;
    lowestScore: number;
    totalMaxScore: number;
  };
}

export default function ScoreExcelModal({
  isOpen,
  onClose,
  classroom,
  students,
  structures,
  matrixScores,
  calculatedWeekDates = {},
  weekAttendanceMap = {},
  analyticsSummary
}: ScoreExcelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchPreview, setSearchPreview] = useState('');

  // Export mode: 'full_matrix' | 'multi_sheet' | 'assignments_only' | 'post_tests_only' | 'single_week'
  const [exportMode, setExportMode] = useState<'full_matrix' | 'multi_sheet' | 'assignments_only' | 'post_tests_only' | 'single_week'>('full_matrix');
  
  // For multi-sheet preview navigation
  const [activePreviewSheet, setActivePreviewSheet] = useState<'matrix' | 'assignments' | 'tests' | 'summary'>('matrix');

  // For single week selection
  const [selectedSingleWeek, setSelectedSingleWeek] = useState<number>(1);

  // Student filter
  const [studentFilter, setStudentFilter] = useState<'all' | 'came_only'>('all');

  // Customization checkboxes
  const [includeMidterm, setIncludeMidterm] = useState(true);
  const [includeFinal, setIncludeFinal] = useState(true);
  const [includeAffective, setIncludeAffective] = useState(true);
  const [includeTotalScore, setIncludeTotalScore] = useState(true);
  const [includeMaxScoreRow, setIncludeMaxScoreRow] = useState(true);
  const [includeDatesInHeader, setIncludeDatesInHeader] = useState(true);
  const [includeHeaderSummary, setIncludeHeaderSummary] = useState(true);

  // Custom filenames & sheets
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('ตารางคะแนน');

  // SSR hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Set default file name when modal opens or classroom changes
  useEffect(() => {
    if (isOpen && classroom) {
      const safeName = classroom.name.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
      const today = new Date().toISOString().split('T')[0];
      setFileName(`ตารางคะแนน_${safeName}_${today}`);
      setSheetName(exportMode === 'multi_sheet' ? 'สมุดงานคะแนน' : 'ตารางคะแนนรวม');
    }
  }, [isOpen, classroom, exportMode]);

  // Thai Date Formatter for headers
  const formatThaiDateShort = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${d.getDate()} ${THAI_SHORT_MONTHS[d.getMonth()]}`;
    } catch {
      return '';
    }
  };

  // Filtered students by came_only if applicable
  const targetStudents = useMemo(() => {
    if (studentFilter === 'came_only' && Object.keys(weekAttendanceMap).length > 0) {
      return students.filter(s => {
        // check if student attended any class
        const hasPresent = structures.some(st => {
          const stt = weekAttendanceMap[`${s.id}_${st.lesson_number}`];
          return stt === 'present' || stt === 'late';
        });
        return hasPresent;
      });
    }
    return students;
  }, [students, studentFilter, weekAttendanceMap, structures]);

  // Search filtered students for preview
  const displayedStudents = useMemo(() => {
    if (!searchPreview.trim()) return targetStudents;
    const q = searchPreview.toLowerCase().trim();
    return targetStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.student_code && s.student_code.toLowerCase().includes(q))
    );
  }, [targetStudents, searchPreview]);

  // Helper: Convert cell to number if numeric
  const toNumOrBlank = (val: any): number | string => {
    if (val === '' || val === null || val === undefined) return '';
    const n = Number(val);
    return isNaN(n) ? val : n;
  };

  // ─── Table Builders for each View/Sheet ───

  // 1. Full Matrix Data
  const fullMatrixData = useMemo(() => {
    const headers: string[] = ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล'];
    const maxScoreRow: (string | number)[] = ['-', '-', 'คะแนนเต็ม'];
    const colWidths: { wch: number }[] = [
      { wch: 8 },  // ลำดับ
      { wch: 16 }, // รหัส
      { wch: 28 }, // ชื่อ
    ];

    structures.forEach(st => {
      const dateStr = calculatedWeekDates[st.lesson_number];
      const dateText = includeDatesInHeader && dateStr ? ` (${formatThaiDateShort(dateStr)})` : '';
      
      headers.push(`W${st.lesson_number} งาน${dateText}`);
      headers.push(`W${st.lesson_number} สอบ${dateText}`);

      maxScoreRow.push(Number(st.max_assignment_score) || 0);
      maxScoreRow.push(Number(st.max_post_test_score) || 0);

      colWidths.push({ wch: 14 });
      colWidths.push({ wch: 14 });
    });

    if (includeMidterm) {
      headers.push('กลางภาค');
      maxScoreRow.push(Number(classroom?.midterm_max_score) || 20);
      colWidths.push({ wch: 12 });
    }
    if (includeFinal) {
      headers.push('ปลายภาค');
      maxScoreRow.push(Number(classroom?.final_max_score) || 30);
      colWidths.push({ wch: 12 });
    }
    if (includeAffective) {
      headers.push('จิตพิสัย');
      maxScoreRow.push(Number(classroom?.affective_weight) || 20);
      colWidths.push({ wch: 12 });
    }
    if (includeTotalScore) {
      headers.push('รวมคะแนน');
      let totalPossible = structures.reduce((sum, s) => sum + Number(s.max_assignment_score || 0) + Number(s.max_post_test_score || 0), 0);
      if (includeMidterm) totalPossible += Number(classroom?.midterm_max_score || 0);
      if (includeFinal) totalPossible += Number(classroom?.final_max_score || 0);
      if (includeAffective) totalPossible += Number(classroom?.affective_weight || 0);
      maxScoreRow.push(totalPossible || 100);
      colWidths.push({ wch: 14 });
    }

    const rows = targetStudents.map((s, idx) => {
      const r: (string | number)[] = [
        idx + 1,
        s.student_code || '-',
        s.name
      ];

      let studentTotal = 0;

      structures.forEach(st => {
        const key = `${s.id}_${st.lesson_number}`;
        const val = matrixScores[key];
        const assign = val && val.assignment_score !== '' && val.assignment_score !== null ? Number(val.assignment_score) : '';
        const post = val && val.post_test_score !== '' && val.post_test_score !== null ? Number(val.post_test_score) : '';

        if (typeof assign === 'number') studentTotal += assign;
        if (typeof post === 'number') studentTotal += post;

        r.push(toNumOrBlank(assign));
        r.push(toNumOrBlank(post));
      });

      if (includeMidterm) {
        const mid = s.midterm_score !== undefined && s.midterm_score !== null ? Number(s.midterm_score) : '';
        if (typeof mid === 'number') studentTotal += mid;
        r.push(toNumOrBlank(mid));
      }
      if (includeFinal) {
        const fin = s.final_score !== undefined && s.final_score !== null ? Number(s.final_score) : '';
        if (typeof fin === 'number') studentTotal += fin;
        r.push(toNumOrBlank(fin));
      }
      if (includeAffective) {
        const aff = s.affective_score !== undefined && s.affective_score !== null ? Number(s.affective_score) : '';
        if (typeof aff === 'number') studentTotal += aff;
        r.push(toNumOrBlank(aff));
      }
      if (includeTotalScore) {
        r.push(Math.round(studentTotal * 100) / 100);
      }

      return r;
    });

    return { headers, maxScoreRow, rows, colWidths };
  }, [structures, calculatedWeekDates, includeDatesInHeader, includeMidterm, includeFinal, includeAffective, includeTotalScore, classroom, targetStudents, matrixScores]);

  // 2. Assignments Only Data
  const assignmentsOnlyData = useMemo(() => {
    const headers: string[] = ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล'];
    const maxScoreRow: (string | number)[] = ['-', '-', 'คะแนนเต็ม'];
    const colWidths: { wch: number }[] = [{ wch: 8 }, { wch: 16 }, { wch: 28 }];

    structures.forEach(st => {
      const dateStr = calculatedWeekDates[st.lesson_number];
      const dateText = includeDatesInHeader && dateStr ? ` (${formatThaiDateShort(dateStr)})` : '';
      headers.push(`W${st.lesson_number} งานเก็บ${dateText}`);
      maxScoreRow.push(Number(st.max_assignment_score) || 0);
      colWidths.push({ wch: 14 });
    });

    headers.push('รวมงานเก็บ');
    const totalAssignMax = structures.reduce((sum, s) => sum + Number(s.max_assignment_score || 0), 0);
    maxScoreRow.push(totalAssignMax);
    colWidths.push({ wch: 14 });

    const rows = targetStudents.map((s, idx) => {
      const r: (string | number)[] = [idx + 1, s.student_code || '-', s.name];
      let sumAssign = 0;

      structures.forEach(st => {
        const key = `${s.id}_${st.lesson_number}`;
        const val = matrixScores[key];
        const assign = val && val.assignment_score !== '' && val.assignment_score !== null ? Number(val.assignment_score) : '';
        if (typeof assign === 'number') sumAssign += assign;
        r.push(toNumOrBlank(assign));
      });

      r.push(Math.round(sumAssign * 100) / 100);
      return r;
    });

    return { headers, maxScoreRow, rows, colWidths };
  }, [structures, calculatedWeekDates, includeDatesInHeader, targetStudents, matrixScores]);

  // 3. Post-Tests Only Data
  const postTestsOnlyData = useMemo(() => {
    const headers: string[] = ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล'];
    const maxScoreRow: (string | number)[] = ['-', '-', 'คะแนนเต็ม'];
    const colWidths: { wch: number }[] = [{ wch: 8 }, { wch: 16 }, { wch: 28 }];

    structures.forEach(st => {
      const dateStr = calculatedWeekDates[st.lesson_number];
      const dateText = includeDatesInHeader && dateStr ? ` (${formatThaiDateShort(dateStr)})` : '';
      headers.push(`W${st.lesson_number} สอบย่อย${dateText}`);
      maxScoreRow.push(Number(st.max_post_test_score) || 0);
      colWidths.push({ wch: 14 });
    });

    headers.push('รวมสอบย่อย');
    const totalTestMax = structures.reduce((sum, s) => sum + Number(s.max_post_test_score || 0), 0);
    maxScoreRow.push(totalTestMax);
    colWidths.push({ wch: 14 });

    const rows = targetStudents.map((s, idx) => {
      const r: (string | number)[] = [idx + 1, s.student_code || '-', s.name];
      let sumTest = 0;

      structures.forEach(st => {
        const key = `${s.id}_${st.lesson_number}`;
        const val = matrixScores[key];
        const post = val && val.post_test_score !== '' && val.post_test_score !== null ? Number(val.post_test_score) : '';
        if (typeof post === 'number') sumTest += post;
        r.push(toNumOrBlank(post));
      });

      r.push(Math.round(sumTest * 100) / 100);
      return r;
    });

    return { headers, maxScoreRow, rows, colWidths };
  }, [structures, calculatedWeekDates, includeDatesInHeader, targetStudents, matrixScores]);

  // 4. Summary & Stats Data
  const summaryStatsData = useMemo(() => {
    const headers = ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'รวมงานเก็บ', 'รวมสอบย่อย', 'กลางภาค', 'ปลายภาค', 'จิตพิสัย', 'คะแนนรวมสุทธิ'];
    const maxScoreRow = [
      '-', '-', 'คะแนนเต็ม',
      structures.reduce((sum, s) => sum + Number(s.max_assignment_score || 0), 0),
      structures.reduce((sum, s) => sum + Number(s.max_post_test_score || 0), 0),
      Number(classroom?.midterm_max_score) || 20,
      Number(classroom?.final_max_score) || 30,
      Number(classroom?.affective_weight) || 20,
      analyticsSummary?.totalMaxScore || 100
    ];
    const colWidths = [
      { wch: 8 }, { wch: 16 }, { wch: 28 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }
    ];

    const rows = targetStudents.map((s, idx) => {
      let sumAssign = 0;
      let sumTest = 0;

      structures.forEach(st => {
        const key = `${s.id}_${st.lesson_number}`;
        const val = matrixScores[key];
        if (val && val.assignment_score !== '' && val.assignment_score !== null) sumAssign += Number(val.assignment_score);
        if (val && val.post_test_score !== '' && val.post_test_score !== null) sumTest += Number(val.post_test_score);
      });

      const mid = Number(s.midterm_score || 0);
      const fin = Number(s.final_score || 0);
      const aff = Number(s.affective_score || 0);
      const grandTotal = Math.round((sumAssign + sumTest + mid + fin + aff) * 100) / 100;

      return [
        idx + 1,
        s.student_code || '-',
        s.name,
        Math.round(sumAssign * 100) / 100,
        Math.round(sumTest * 100) / 100,
        toNumOrBlank(s.midterm_score),
        toNumOrBlank(s.final_score),
        toNumOrBlank(s.affective_score),
        grandTotal
      ];
    });

    return { headers, maxScoreRow, rows, colWidths };
  }, [structures, classroom, analyticsSummary, targetStudents, matrixScores]);

  // 5. Single Week Focus Data
  const singleWeekData = useMemo(() => {
    const st = structures.find(s => s.lesson_number === selectedSingleWeek) || structures[0] || {
      lesson_number: 1,
      lesson_name: 'บทเรียนที่ 1',
      max_assignment_score: 10,
      max_post_test_score: 10,
      hours: 4
    };

    const dateStr = calculatedWeekDates[st.lesson_number];
    const dateText = dateStr ? ` (${formatThaiDateShort(dateStr)})` : '';

    const headers = [
      'ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล',
      `งานเก็บ W${st.lesson_number} (เต็ม ${st.max_assignment_score})${dateText}`,
      `สอบย่อย W${st.lesson_number} (เต็ม ${st.max_post_test_score})${dateText}`,
      `รวมสัปดาห์ที่ ${st.lesson_number} (เต็ม ${Number(st.max_assignment_score) + Number(st.max_post_test_score)})`
    ];

    const maxScoreRow = [
      '-', '-', 'คะแนนเต็ม',
      Number(st.max_assignment_score),
      Number(st.max_post_test_score),
      Number(st.max_assignment_score) + Number(st.max_post_test_score)
    ];

    const colWidths = [
      { wch: 8 }, { wch: 16 }, { wch: 28 },
      { wch: 22 }, { wch: 22 }, { wch: 22 }
    ];

    const rows = targetStudents.map((s, idx) => {
      const key = `${s.id}_${st.lesson_number}`;
      const val = matrixScores[key];
      const assign = val && val.assignment_score !== '' && val.assignment_score !== null ? Number(val.assignment_score) : '';
      const post = val && val.post_test_score !== '' && val.post_test_score !== null ? Number(val.post_test_score) : '';
      const weekTotal = (typeof assign === 'number' ? assign : 0) + (typeof post === 'number' ? post : 0);

      return [
        idx + 1,
        s.student_code || '-',
        s.name,
        toNumOrBlank(assign),
        toNumOrBlank(post),
        assign !== '' || post !== '' ? Math.round(weekTotal * 100) / 100 : ''
      ];
    });

    return { headers, maxScoreRow, rows, colWidths, currentStruct: st };
  }, [structures, selectedSingleWeek, calculatedWeekDates, targetStudents, matrixScores]);

  // Select active preview dataset
  const activePreviewData = useMemo(() => {
    if (exportMode === 'multi_sheet') {
      if (activePreviewSheet === 'assignments') return assignmentsOnlyData;
      if (activePreviewSheet === 'tests') return postTestsOnlyData;
      if (activePreviewSheet === 'summary') return summaryStatsData;
      return fullMatrixData;
    }
    if (exportMode === 'assignments_only') return assignmentsOnlyData;
    if (exportMode === 'post_tests_only') return postTestsOnlyData;
    if (exportMode === 'single_week') return singleWeekData;
    return fullMatrixData;
  }, [exportMode, activePreviewSheet, fullMatrixData, assignmentsOnlyData, postTestsOnlyData, summaryStatsData, singleWeekData]);

  // Filter preview rows by search
  const filteredPreviewRows = useMemo(() => {
    if (!searchPreview.trim()) return activePreviewData.rows;
    const q = searchPreview.toLowerCase().trim();
    return activePreviewData.rows.filter(r => {
      const code = String(r[1] || '').toLowerCase();
      const name = String(r[2] || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [activePreviewData, searchPreview]);

  // Excel Column Letters (A, B, C... AA, AB...)
  const getExcelColLetter = (index: number) => {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  // Helper: Build SheetJS WorkSheet
  const buildSheet = (dataset: { headers: string[]; maxScoreRow: (string | number)[]; rows: (string | number)[][]; colWidths: { wch: number }[] }, title?: string) => {
    const sheetData: (string | number)[][] = [];

    if (includeHeaderSummary) {
      sheetData.push([`รายงานตารางคะแนน — ${classroom?.name || 'ห้องเรียน'}`]);
      sheetData.push([`${title || 'ตารางคะแนน'} | ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')} | จำนวนนักเรียน: ${targetStudents.length} คน`]);
      sheetData.push([]); // Blank separator
    }

    sheetData.push(dataset.headers);

    if (includeMaxScoreRow) {
      sheetData.push(dataset.maxScoreRow);
    }

    dataset.rows.forEach(r => sheetData.push(r));

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = dataset.colWidths;
    return ws;
  };

  // ─── 1. Download Excel (.xlsx) ───
  const handleDownloadExcel = () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      if (exportMode === 'multi_sheet') {
        // Multi-Sheet Workbook with 4 separate worksheets
        const wsMatrix = buildSheet(fullMatrixData, 'ตารางคะแนนรวมทั้งเทอม (Full Matrix)');
        XLSX.utils.book_append_sheet(wb, wsMatrix, 'ตารางคะแนนรวม');

        const wsAssign = buildSheet(assignmentsOnlyData, 'คะแนนงานเก็บรายสัปดาห์ (Assignments)');
        XLSX.utils.book_append_sheet(wb, wsAssign, 'คะแนนงานเก็บ');

        const wsTests = buildSheet(postTestsOnlyData, 'คะแนนสอบย่อยรายสัปดาห์ (Post-Tests)');
        XLSX.utils.book_append_sheet(wb, wsTests, 'คะแนนสอบย่อย');

        const wsSummary = buildSheet(summaryStatsData, 'สรุปผลคะแนนและสถิติ (Summary & Stats)');
        XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปผลและสถิติ');
      } else {
        // Single Sheet Mode
        let curData = fullMatrixData;
        let titleName = 'ตารางคะแนนรวม';

        if (exportMode === 'assignments_only') {
          curData = assignmentsOnlyData;
          titleName = 'คะแนนงานเก็บ';
        } else if (exportMode === 'post_tests_only') {
          curData = postTestsOnlyData;
          titleName = 'คะแนนสอบย่อย';
        } else if (exportMode === 'single_week') {
          curData = singleWeekData;
          titleName = `คะแนนสัปดาห์ที่_${selectedSingleWeek}`;
        }

        const ws = buildSheet(curData, titleName);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || titleName);
      }

      const finalFileName = `${fileName.trim() || 'ตารางคะแนน'}.xlsx`;
      XLSX.writeFile(wb, finalFileName);
      toast.success(`ดาวน์โหลดไฟล์ Excel เรียบร้อย (${exportMode === 'multi_sheet' ? 'สมุดงาน 4 แผ่นงาน' : 'แผ่นงานเดียว'})`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel');
    }
  };

  // ─── 2. Copy to Clipboard (TSV) ───
  const handleCopyToClipboard = async () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับคัดลอก');
      return;
    }

    try {
      const curData = activePreviewData;
      const lines: string[] = [];

      if (includeHeaderSummary) {
        lines.push(`รายงานตารางคะแนน — ${classroom?.name || 'ห้องเรียน'}`);
        lines.push(`ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')} | จำนวนนักเรียน: ${targetStudents.length} คน`);
        lines.push('');
      }

      lines.push(curData.headers.join('\t'));

      if (includeMaxScoreRow) {
        lines.push(curData.maxScoreRow.join('\t'));
      }

      curData.rows.forEach(row => {
        lines.push(row.join('\t'));
      });

      const tsvContent = lines.join('\n');
      await navigator.clipboard.writeText(tsvContent);

      setCopied(true);
      toast.success('คัดลอกข้อมูลตาราง (TSV) ลงคลิปบอร์ดแล้ว! สามารถกด Ctrl+V วางลงใน Excel หรือ Google Sheets ได้ทันที');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error('ไม่สามารถคัดลอกลงคลิปบอร์ดได้');
    }
  };

  // ─── 3. Download CSV (UTF-8 BOM) ───
  const handleDownloadCsv = () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    try {
      const curData = activePreviewData;
      const escapeCsv = (val: any) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines: string[] = [];

      if (includeHeaderSummary) {
        lines.push(escapeCsv(`รายงานตารางคะแนน — ${classroom?.name || 'ห้องเรียน'}`));
        lines.push(escapeCsv(`ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')} | จำนวน: ${targetStudents.length} คน`));
        lines.push('');
      }

      lines.push(curData.headers.map(escapeCsv).join(','));

      if (includeMaxScoreRow) {
        lines.push(curData.maxScoreRow.map(escapeCsv).join(','));
      }

      curData.rows.forEach(row => {
        lines.push(row.map(escapeCsv).join(','));
      });

      const BOM = '\uFEFF';
      const csvContent = BOM + lines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName.trim() || 'ตารางคะแนน'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว (รองรับภาษาไทย)');
      onClose();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ CSV');
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-emerald-100 flex flex-col w-full max-w-6xl max-h-[92vh] overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">พรีวิวและส่งออกคะแนน (Excel & CSV)</h2>
                <span className="bg-emerald-500/40 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Live Preview
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 flex items-center gap-2">
                <span>ห้องเรียน: <strong>{classroom?.name || 'ไม่ระบุห้องเรียน'}</strong></span>
                <span>•</span>
                <span>หลักสูตร: <strong>{structures.length} สัปดาห์</strong> ({structures.length === 15 ? 'ปวส.' : 'ปวช.'})</span>
                <span>•</span>
                <span>นักเรียนทั้งหมด: <strong>{students.length} คน</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/20 flex items-center justify-center transition-colors text-white/80 hover:text-white"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
          {/* Section 1: Mode Selection Cards */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              1. เลือกรูปแบบและโครงสร้างไฟล์ส่งออก (Export Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                {
                  id: 'full_matrix',
                  label: '📊 ตารางรวมทั้งเทอม',
                  desc: 'รวมงานเก็บ สอบย่อย สอบกลาง/ปลายภาค ในแผ่นงานเดียว',
                  badge: 'นิยมที่สุด'
                },
                {
                  id: 'multi_sheet',
                  label: '📑 สมุดงานแยกแผ่น',
                  desc: 'สร้าง 4 ชีตใน 1 ไฟล์ (ตารางรวม, งาน, สอบ, สถิติ)',
                  badge: '✨ แนะนำ'
                },
                {
                  id: 'assignments_only',
                  label: '📝 เฉพาะงานเก็บ',
                  desc: 'แสดงคะแนนงานเก็บทุกสัปดาห์ + รวมงานเก็บ',
                  badge: null
                },
                {
                  id: 'post_tests_only',
                  label: '🎯 เฉพาะสอบย่อย',
                  desc: 'แสดงคะแนนสอบย่อยทุกสัปดาห์ + รวมสอบย่อย',
                  badge: null
                },
                {
                  id: 'single_week',
                  label: '📌 เฉพาะสัปดาห์',
                  desc: 'เลือกเจาะจงดูเฉพาะสัปดาห์ใดสัปดาห์หนึ่ง',
                  badge: null
                },
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setExportMode(mode.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    exportMode === mode.id
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${exportMode === mode.id ? 'text-emerald-900' : 'text-slate-800'}`}>
                        {mode.label}
                      </span>
                      {mode.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shadow-2xs">
                          {mode.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {mode.desc}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                    <span className={`w-2 h-2 rounded-full ${exportMode === mode.id ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                    {exportMode === mode.id ? 'เลือกอยู่' : 'คลิกเพื่อเลือก'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Single Week Selector (If in single_week mode) */}
          {exportMode === 'single_week' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-900">เลือกสัปดาห์ที่ต้องการส่งออก:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {structures.map(st => (
                  <button
                    key={st.lesson_number}
                    type="button"
                    onClick={() => setSelectedSingleWeek(st.lesson_number)}
                    className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all ${
                      selectedSingleWeek === st.lesson_number
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-100'
                    }`}
                  >
                    W{st.lesson_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Customization Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <TableProperties className="w-4 h-4 text-emerald-600" />
                2. ตัวเลือกคอลัมน์และการจัดรูปแบบ
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">กรองรายชื่อ:</span>
                <button
                  type="button"
                  onClick={() => setStudentFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                    studentFilter === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ทั้งหมด ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentFilter('came_only')}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                    studentFilter === 'came_only'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  เฉพาะมีประวัติเข้าเรียน ({targetStudents.length})
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                <input
                  type="checkbox"
                  checked={includeMaxScoreRow}
                  onChange={e => setIncludeMaxScoreRow(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>แสดงแถว &quot;คะแนนเต็ม&quot; (Max Score)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                <input
                  type="checkbox"
                  checked={includeDatesInHeader}
                  onChange={e => setIncludeDatesInHeader(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>แสดงวันที่สอนกำกับแต่ละสัปดาห์</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                <input
                  type="checkbox"
                  checked={includeHeaderSummary}
                  onChange={e => setIncludeHeaderSummary(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>ใส่หัวรายงานด้านบน (ชื่อวิชา/ห้องเรียน/วันที่)</span>
              </label>

              {exportMode === 'full_matrix' && (
                <>
                  <span className="text-slate-300">|</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeMidterm}
                      onChange={e => setIncludeMidterm(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>กลางภาค</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeFinal}
                      onChange={e => setIncludeFinal(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>ปลายภาค</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeAffective}
                      onChange={e => setIncludeAffective(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>จิตพิสัย</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-emerald-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeTotalScore}
                      onChange={e => setIncludeTotalScore(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-indigo-700">รวมคะแนนสุทธิ</span>
                  </label>
                </>
              )}
            </div>

            {/* File & Sheet Name Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">ชื่อไฟล์เมื่อดาวน์โหลด (.xlsx / .csv)</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  className="form-input text-xs w-full py-1.5 px-2.5 bg-slate-50 border-slate-300 rounded-lg focus:bg-white"
                  placeholder="ระบุชื่อไฟล์..."
                />
              </div>
              {exportMode !== 'multi_sheet' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">ชื่อแผ่นงาน (Sheet Name ใน Excel)</label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={e => setSheetName(e.target.value)}
                    className="form-input text-xs w-full py-1.5 px-2.5 bg-slate-50 border-slate-300 rounded-lg focus:bg-white"
                    placeholder="เช่น ตารางคะแนนรวม..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Live Spreadsheet Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>ตัวอย่างตาราง Excel จริง (Live Spreadsheet Preview)</span>
                </div>

                {/* Multi-sheet preview switcher tabs */}
                {exportMode === 'multi_sheet' && (
                  <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setActivePreviewSheet('matrix')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        activePreviewSheet === 'matrix' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      ชีต 1: ตารางรวม
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePreviewSheet('assignments')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        activePreviewSheet === 'assignments' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      ชีต 2: งานเก็บ
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePreviewSheet('tests')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        activePreviewSheet === 'tests' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      ชีต 3: สอบย่อย
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePreviewSheet('summary')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        activePreviewSheet === 'summary' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      ชีต 4: สรุปผล
                    </button>
                  </div>
                )}
              </div>

              {/* Instant Search Box in Preview */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchPreview}
                  onChange={e => setSearchPreview(e.target.value)}
                  placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Excel Preview Container */}
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto relative text-[11px] font-mono">
              <table className="w-full border-collapse border border-slate-300">
                {/* Excel Column Letters (A, B, C...) */}
                <thead className="sticky top-0 z-30 bg-slate-200 text-slate-600 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-1.5 w-10 text-center bg-slate-300 border-r border-slate-300 sticky left-0 z-40 text-[10px]">
                      ◢
                    </th>
                    {activePreviewData.headers.map((_, idx) => (
                      <th key={idx} className="p-1 text-center border-r border-slate-300 min-w-[80px] font-semibold text-[10px] bg-slate-200">
                        {getExcelColLetter(idx)}
                      </th>
                    ))}
                  </tr>
                  {/* Table Header Labels */}
                  <tr className="bg-emerald-700 text-white font-sans font-bold">
                    <th className="p-2 text-center bg-slate-300 border-r border-slate-300 sticky left-0 z-40 text-slate-700 font-mono text-[10px]">
                      1
                    </th>
                    {activePreviewData.headers.map((h, idx) => (
                      <th 
                        key={idx} 
                        className={`p-2 border-r border-emerald-600/60 whitespace-nowrap text-center ${
                          idx === 1 ? 'sticky left-10 z-20 bg-emerald-800' : ''
                        } ${idx === 2 ? 'sticky left-26 z-20 bg-emerald-800' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                  {/* Optional Max Score Row */}
                  {includeMaxScoreRow && (
                    <tr className="bg-emerald-50 text-emerald-900 font-sans font-bold border-b border-emerald-200">
                      <th className="p-1.5 text-center bg-slate-200 border-r border-slate-300 sticky left-0 z-40 text-slate-600 font-mono text-[10px]">
                        2
                      </th>
                      {activePreviewData.maxScoreRow.map((val, idx) => (
                        <td 
                          key={idx} 
                          className={`p-1.5 text-center border-r border-emerald-200 whitespace-nowrap ${
                            idx === 1 ? 'sticky left-10 z-20 bg-emerald-100' : ''
                          } ${idx === 2 ? 'sticky left-26 z-20 bg-emerald-100 text-left' : ''}`}
                        >
                          {val !== '-' ? <span className="font-extrabold">{val}</span> : '-'}
                        </td>
                      ))}
                    </tr>
                  )}
                </thead>

                {/* Table Rows */}
                <tbody className="divide-y divide-slate-200 bg-white font-sans">
                  {filteredPreviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={activePreviewData.headers.length + 1} className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลนักเรียนที่ค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewRows.map((row, rIdx) => {
                      const excelRowNum = rIdx + (includeMaxScoreRow ? 3 : 2);
                      const isEven = rIdx % 2 === 0;
                      const rowBg = isEven ? 'bg-white' : 'bg-slate-50/70';

                      return (
                        <tr key={rIdx} className={`hover:bg-emerald-50/50 transition-colors ${rowBg}`}>
                          {/* Row Number */}
                          <td className="p-1 text-center bg-slate-100 border-r border-slate-300 font-mono text-[10px] text-slate-500 font-medium sticky left-0 z-20">
                            {excelRowNum}
                          </td>

                          {row.map((cell, cIdx) => {
                            const isCode = cIdx === 1;
                            const isName = cIdx === 2;
                            const isTotal = cIdx === row.length - 1 && includeTotalScore;

                            return (
                              <td
                                key={cIdx}
                                className={`p-1.5 border-r border-slate-200 whitespace-nowrap ${
                                  isCode 
                                    ? `sticky left-10 z-10 ${rowBg} font-mono font-medium text-slate-600 text-center border-r border-slate-300 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]` 
                                    : ''
                                } ${
                                  isName 
                                    ? `sticky left-26 z-10 ${rowBg} font-medium text-slate-800 border-r border-slate-300 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]` 
                                    : ''
                                } ${
                                  !isCode && !isName ? 'text-center font-mono' : ''
                                } ${
                                  isTotal ? 'font-extrabold text-indigo-700 bg-indigo-50/40' : ''
                                }`}
                              >
                                {cell !== '' && cell !== null && cell !== undefined ? cell : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Preview Stats Bar */}
            <div className="p-3 bg-slate-100/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  แสดงผล: <strong>{filteredPreviewRows.length}</strong> / {targetStudents.length} คน
                </span>
                <span>•</span>
                <span>จำนวนคอลัมน์: <strong>{activePreviewData.headers.length}</strong> คอลัมน์</span>
                <span>•</span>
                <span>โครงสร้าง: <strong>{structures.length} สัปดาห์</strong></span>
                {analyticsSummary && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      คะแนนเฉลี่ย: {analyticsSummary.avgScore} / {analyticsSummary.totalMaxScore}
                    </span>
                  </>
                )}
              </div>

              <div className="text-[11px] text-slate-500 italic">
                * ตารางพรีวิวเสมือนจริง ข้อมูลตัวเลขส่งออกเป็น Number พร้อมใช้สูตร SUM / AVERAGE ใน Excel ได้ทันที
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>กดปุ่ม <strong>Esc</strong> เพื่อปิด</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4"
            >
              ยกเลิก
            </button>

            {/* Copy to Clipboard */}
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className={`btn border text-xs px-3.5 flex items-center gap-1.5 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
              }`}
              title="คัดลอกข้อมูลตารางสำหรับวางลง Excel หรือ Google Sheets ด้วย Ctrl+V"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'คัดลอกสำเร็จ!' : 'คัดลอกลงคลิปบอร์ด'}
            </button>

            {/* Download CSV */}
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-3.5 flex items-center gap-1.5 shadow-2xs"
              title="ดาวน์โหลดไฟล์ CSV (UTF-8 พร้อม BOM ภาษาไทยไม่เพี้ยน)"
            >
              <Download className="w-4 h-4 text-slate-600" />
              ดาวน์โหลด CSV (.csv)
            </button>

            {/* Download Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs px-5 flex items-center gap-2 shadow-md shadow-emerald-600/25 font-bold"
            >
              <Download className="w-4 h-4 text-white" />
              {exportMode === 'multi_sheet' ? 'ดาวน์โหลด Excel (4 แผ่นงาน)' : 'ดาวน์โหลด Excel (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
