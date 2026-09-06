'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, 
  HelpCircle, Sparkles, BookOpen, Layers, Info, Check, ArrowRight, Loader2,
  Table as TableIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export interface Student {
  id: string | number;
  student_code?: string;
  name: string;
}

export interface ScoreStructure {
  lesson_number: number;
  lesson_name: string;
  max_assignment_score: number;
  max_post_test_score: number;
  hours: number;
}

export interface StudentScoreEntry {
  student_id: string | number;
  student_name?: string;
  lesson_number: number;
  assignment_score?: number;
  post_test_score?: number;
}

interface ScoreImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomName: string;
  students: Student[];
  structures: ScoreStructure[];
  onImportScores: (scores: StudentScoreEntry[], type: 'assignment' | 'post_test') => Promise<void>;
  onImportBlueprint?: (newStructures: ScoreStructure[]) => void;
}

export default function ScoreImportModal({
  isOpen,
  onClose,
  classroomName,
  students,
  structures,
  onImportScores,
  onImportBlueprint,
}: ScoreImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'scores' | 'blueprint'>('scores');
  const [scoreType, setScoreType] = useState<'assignment' | 'post_test'>('assignment');
  
  // Parsed data state
  const [fileName, setFileName] = useState('');
  const [parsedScores, setParsedScores] = useState<StudentScoreEntry[]>([]);
  const [parsedBlueprint, setParsedBlueprint] = useState<ScoreStructure[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setParsedScores([]);
      setParsedBlueprint([]);
      setFileName('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sample students for format illustration
  const sampleStudents = useMemo(() => {
    if (students && students.length >= 3) {
      return students.slice(0, 3);
    }
    return [
      { id: '1', student_code: '67010001', name: 'นายสมชาย ใจดี' },
      { id: '2', student_code: '67010002', name: 'นางสาวสมหญิง รักเรียน' },
      { id: '3', student_code: '67010003', name: 'นายกิตติศักดิ์ พากเพียร' },
    ];
  }, [students]);

  // Download Sample Excel Template for Scores
  const handleDownloadScoreTemplate = () => {
    try {
      const weeksCount = Math.max(15, structures.length || 18);
      const headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล'];
      for (let w = 1; w <= weeksCount; w++) {
        headers.push(String(w));
      }

      const rows: (string | number)[][] = [];
      const targetStudents = students && students.length > 0 ? students : sampleStudents;

      targetStudents.forEach((student, index) => {
        const row: (string | number)[] = [
          student.student_code || `6701000${index + 1}`,
          student.name
        ];
        // Fill sample scores for week 1-4
        for (let w = 1; w <= weeksCount; w++) {
          if (w <= 4) {
            row.push(scoreType === 'assignment' ? (8 + (index % 3)) : (7 + (index % 4)));
          } else {
            row.push('');
          }
        }
        rows.push(row);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Set column widths
      const colWidths = [{ wch: 16 }, { wch: 28 }];
      for (let w = 1; w <= weeksCount; w++) {
        colWidths.push({ wch: 7 });
      }
      ws['!cols'] = colWidths;

      const typeLabel = scoreType === 'assignment' ? 'คะแนนงานเก็บ' : 'คะแนนสอบย่อย';
      XLSX.utils.book_append_sheet(wb, ws, typeLabel);
      XLSX.writeFile(wb, `เทมเพลต_${typeLabel}_${classroomName || 'ห้องเรียน'}.xlsx`);
      toast.success(`ดาวน์โหลดไฟล์ตัวอย่าง ${typeLabel} สำเร็จ`);
    } catch (err) {
      console.error('Download template error:', err);
      toast.error('ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ');
    }
  };

  // Download Sample Excel Template for Blueprint
  const handleDownloadBlueprintTemplate = () => {
    try {
      const headers = ['บทเรียนที่', 'ชื่อบทเรียน', 'ชั่วโมง', 'คะแนนทักษะ (งานเก็บ)', 'พุทธิพิสัย (สอบย่อย)'];
      const rows: (string | number)[][] = [];

      const totalWeeks = Math.max(18, structures.length || 18);
      for (let i = 1; i <= totalWeeks; i++) {
        const existing = structures.find(s => s.lesson_number === i);
        rows.push([
          i,
          existing?.lesson_name || `หน่วยการเรียนรู้ที่ ${i}`,
          existing?.hours || 4,
          existing?.max_assignment_score || 10,
          existing?.max_post_test_score || 10
        ]);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 22 }, { wch: 22 }];

      XLSX.utils.book_append_sheet(wb, ws, 'โครงสร้างคะแนน');
      XLSX.writeFile(wb, `เทมเพลต_โครงสร้างคะแนน_Blueprint.xlsx`);
      toast.success('ดาวน์โหลดเทมเพลต Blueprint สำเร็จ');
    } catch (err) {
      console.error('Download blueprint template error:', err);
      toast.error('ดาวน์โหลดเทมเพลตไม่สำเร็จ');
    }
  };

  // Parse Uploaded Score File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (activeTab === 'scores') {
          let headerRowIndex = -1;
          const weekColumns: { [key: string]: number } = {};
          let idColIndex = -1, nameColIndex = -1, lastNameColIndex = -1;

          for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i] || [];
            let foundWeeks = 0;
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j] ?? '').trim();
              if (['1', '2', '3'].includes(cell)) foundWeeks++;
            }
            if (foundWeeks >= 2) {
              headerRowIndex = i;
              for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] ?? '').trim();
                if (!isNaN(parseInt(cell)) && parseInt(cell) > 0) {
                  weekColumns[cell] = j;
                } else if (cell.includes('เลข') || cell.includes('รหัส') || cell.toLowerCase().includes('code')) {
                  idColIndex = j;
                } else if (cell.includes('ชื่อ') && !cell.includes('บทเรียน')) {
                  nameColIndex = j;
                } else if (cell.includes('นามสกุล')) {
                  lastNameColIndex = j;
                }
              }
              break;
            }
          }

          if (headerRowIndex === -1) {
            toast.error('ไม่พบคอลัมน์ที่เป็นตัวเลขสัปดาห์ (1, 2, 3...) ในไฟล์นี้');
            return;
          }

          const scores: StudentScoreEntry[] = [];
          for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i] || [];
            if (row.length === 0) continue;
            const studentCode = idColIndex !== -1 ? String(row[idColIndex] ?? '').trim() : '';
            const fullName = (nameColIndex !== -1 ? String(row[nameColIndex] ?? '').trim() : '') +
              (lastNameColIndex !== -1 && row[lastNameColIndex] ? ' ' + String(row[lastNameColIndex]).trim() : '');

            let matched = null;
            if (studentCode) matched = students.find(s => s.student_code === studentCode);
            if (!matched && fullName) {
              matched = students.find(s => fullName.includes(s.name) || s.name.includes(fullName.replace(/นาย|นางสาว|เด็กชาย|เด็กหญิง/g, '').trim()));
            }

            if (matched) {
              Object.keys(weekColumns).forEach(weekNum => {
                const colIdx = weekColumns[weekNum];
                const scoreVal = row[colIdx];
                if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
                  const numScore = parseFloat(String(scoreVal));
                  if (!isNaN(numScore)) {
                    scores.push({
                      student_id: matched!.id,
                      student_name: matched!.name,
                      lesson_number: parseInt(weekNum),
                      ...(scoreType === 'assignment' ? { assignment_score: numScore } : { post_test_score: numScore })
                    });
                  }
                }
              });
            }
          }

          if (scores.length === 0) {
            toast.error('ไม่พบข้อมูลคะแนนที่สามารถจับคู่กับนักเรียนในห้องนี้ได้ กรุณาตรวจชื่อหรือรหัสนักเรียน');
          } else {
            setParsedScores(scores);
            toast.success(`อ่านข้อมูลสำเร็จ ตรวจพบ ${scores.length} รายการคะแนน`);
          }
        } else {
          // Blueprint parse
          let lessonCol = -1, hoursCol = -1, skillCol = -1, postTestCol = -1;
          for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i] || [];
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j] || '').trim().toLowerCase();
              if (cell.includes('บทเรียนที่') || cell.includes('หน่วยที่')) lessonCol = j;
              if (cell.includes('ชั่วโมง')) hoursCol = j;
              if (cell.includes('คะแนนทักษะ') && !cell.includes('ใหม่')) skillCol = j;
              if (cell.includes('คะแนนรายบทเรียนใหม่') || cell.includes('พุทธิพิสัย')) postTestCol = j;
            }
            if (lessonCol !== -1 && skillCol !== -1 && postTestCol !== -1) break;
          }

          if (lessonCol === -1 || skillCol === -1 || postTestCol === -1) {
            toast.error('ไม่พบโครงสร้างตาราง Blueprint ที่รองรับ');
            return;
          }

          const newStructs: ScoreStructure[] = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i] || [];
            const lessonNum = parseInt(String(row[lessonCol] || '').trim());
            if (!isNaN(lessonNum) && lessonNum > 0) {
              newStructs.push({
                lesson_number: lessonNum,
                lesson_name: `บทเรียนที่ ${lessonNum}`,
                hours: hoursCol !== -1 ? (parseFloat(row[hoursCol]) || 4) : 4,
                max_assignment_score: parseFloat(row[skillCol]) || 0,
                max_post_test_score: parseFloat(row[postTestCol]) || 0,
              });
            }
          }

          if (newStructs.length === 0) {
            toast.error('ไม่พบข้อมูลบทเรียนในไฟล์');
          } else {
            setParsedBlueprint(newStructs);
            toast.success(`อ่านโครงสร้างสำเร็จ ${newStructs.length} บทเรียน`);
          }
        }
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    setIsSubmitting(true);
    try {
      if (activeTab === 'scores' && parsedScores.length > 0) {
        await onImportScores(parsedScores, scoreType);
        onClose();
      } else if (activeTab === 'blueprint' && parsedBlueprint.length > 0 && onImportBlueprint) {
        onImportBlueprint(parsedBlueprint);
        toast.success(`อัปเดตโครงสร้างคะแนน ${parsedBlueprint.length} บทเรียนแล้ว`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass w-full max-w-4xl p-6 sm:p-8 rounded-3xl border border-indigo-100 bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-indigo-100/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                นำเข้าข้อมูลจาก Excel & ตัวอย่างรูปแบบ
              </h2>
              <p className="text-xs text-slate-500">
                {classroomName} • ตรวจสอบรูปแบบตารางที่ระบบรองรับ และดาวน์โหลดเทมเพลตพร้อมใช้งาน
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200/80 shadow-xs">
            <button
              onClick={() => { setActiveTab('scores'); setParsedScores([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'scores'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>คะแนนงานเก็บ / สอบย่อย</span>
            </button>

            <button
              onClick={() => { setActiveTab('blueprint'); setParsedBlueprint([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'blueprint'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>โครงสร้างคะแนนเต็ม (Blueprint)</span>
            </button>
          </div>

          {activeTab === 'scores' && (
            <div className="inline-flex rounded-2xl bg-indigo-50/70 p-1 border border-indigo-200/60 shadow-xs">
              <button
                onClick={() => setScoreType('assignment')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  scoreType === 'assignment'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                คะแนนงานเก็บ (ปฏิบัติ)
              </button>
              <button
                onClick={() => setScoreType('post_test')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  scoreType === 'post_test'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-100'
                }`}
              >
                คะแนนสอบย่อย (ทฤษฎี)
              </button>
            </div>
          )}
        </div>

        {/* ==================== TAB 1: SCORES IMPORT & FORMAT GUIDE ==================== */}
        {activeTab === 'scores' && (
          <div className="space-y-5">
            {/* Guide Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 to-purple-50/30 border border-indigo-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      ตัวอย่างรูปแบบไฟล์ Excel สำหรับ {scoreType === 'assignment' ? 'คะแนนงานเก็บ' : 'คะแนนสอบย่อย'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      แถวแรกต้องเป็นหัวคอลัมน์ และคอลัมน์คะแนนใช้ตัวเลขสัปดาห์ (1, 2, 3...)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadScoreTemplate}
                  className="btn bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xs shrink-0"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)</span>
                </button>
              </div>

              {/* Mock Spreadsheet Preview */}
              <div className="overflow-x-auto rounded-2xl border border-indigo-200/80 bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-100/70 text-indigo-950 font-bold border-b border-indigo-200">
                      <th className="p-2.5 border-r border-indigo-200/60 font-mono">รหัสประจำตัว</th>
                      <th className="p-2.5 border-r border-indigo-200/60 min-w-[160px]">ชื่อ-นามสกุล</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-12 bg-indigo-200/50">1</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-12 bg-indigo-200/50">2</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-12 bg-indigo-200/50">3</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-12 bg-indigo-200/50">4</th>
                      <th className="p-2.5 text-center text-slate-400">...</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sampleStudents.map((s, idx) => (
                      <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-slate-600 border-r border-slate-200 font-mono">{s.student_code || `6701000${idx + 1}`}</td>
                        <td className="p-2 text-slate-800 border-r border-slate-200 font-semibold">{s.name}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-emerald-700">{scoreType === 'assignment' ? (8 + idx) : (7 + idx)}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-emerald-700">{scoreType === 'assignment' ? (9 - idx) : (8 - idx)}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-emerald-700">{scoreType === 'assignment' ? (10 - idx) : (9 - idx)}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-emerald-700">8</td>
                        <td className="p-2 text-center text-slate-300">...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Formatting Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>ระบบจับคู่อัตโนมัติจาก <strong>รหัสประจำตัว</strong> หรือ <strong>ชื่อ-นามสกุล</strong></span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>หัวคอลัมน์สัปดาห์ใช้เลข <strong>1, 2, 3, ...</strong> สัปดาห์ที่ยังไม่มีคะแนนสามารถเว้นว่างได้</span>
                </div>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="p-5 rounded-3xl border border-indigo-100 bg-white space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    อัปโหลดไฟล์ Excel เพื่อนำเข้า ({scoreType === 'assignment' ? 'คะแนนงานเก็บ' : 'คะแนนสอบย่อย'})
                  </h3>
                  <p className="text-xs text-slate-500">รองรับไฟล์นามสกุล .xlsx, .xls, .csv</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-colors relative bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {fileName ? `ไฟล์ที่เลือก: ${fileName}` : 'รองรับ .xlsx, .xls, .csv'}
                  </p>
                </div>
              </div>

              {/* Preview of Parsed Data */}
              {parsedScores.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      พบข้อมูลพร้อมนำเข้า {parsedScores.length} รายการคะแนน
                    </span>
                    <span className="text-xs text-slate-500">
                      แสดงตัวอย่าง 5 รายการแรก
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold">
                        <tr>
                          <th className="p-2">ชื่อนักเรียน</th>
                          <th className="p-2 text-center">สัปดาห์ที่</th>
                          <th className="p-2 text-center">คะแนนที่ได้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedScores.slice(0, 5).map((entry, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{entry.student_name}</td>
                            <td className="p-2 text-center">สัปดาห์ {entry.lesson_number}</td>
                            <td className="p-2 text-center font-bold text-indigo-700">
                              {scoreType === 'assignment' ? entry.assignment_score : entry.post_test_score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: BLUEPRINT IMPORT & FORMAT GUIDE ==================== */}
        {activeTab === 'blueprint' && (
          <div className="space-y-5">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 to-purple-50/30 border border-indigo-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      ตัวอย่างรูปแบบไฟล์ Excel โครงสร้างคะแนน (Blueprint)
                    </h3>
                    <p className="text-xs text-slate-500">
                      กำหนดคะแนนเต็มงานเก็บและสอบย่อยของแต่ละบทเรียนล่วงหน้า
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBlueprintTemplate}
                  className="btn bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xs shrink-0"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>ดาวน์โหลดเทมเพลต Blueprint (.xlsx)</span>
                </button>
              </div>

              {/* Mock Blueprint Table */}
              <div className="overflow-x-auto rounded-2xl border border-indigo-200/80 bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-100/70 text-indigo-950 font-bold border-b border-indigo-200">
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-20">บทเรียนที่</th>
                      <th className="p-2.5 border-r border-indigo-200/60 min-w-[150px]">ชื่อบทเรียน</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center w-16">ชั่วโมง</th>
                      <th className="p-2.5 border-r border-indigo-200/60 text-center text-emerald-800">คะแนนทักษะ (งานเก็บ)</th>
                      <th className="p-2.5 text-center text-amber-800">พุทธิพิสัย (สอบย่อย)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[1, 2, 3].map(w => (
                      <tr key={w} className={w % 2 === 1 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center border-r border-slate-200 font-bold">{w}</td>
                        <td className="p-2 text-slate-800 border-r border-slate-200 font-semibold">หน่วยการเรียนรู้ที่ {w}</td>
                        <td className="p-2 text-center border-r border-slate-200">4</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-emerald-700">10</td>
                        <td className="p-2 text-center font-bold text-amber-700">10</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upload Zone for Blueprint */}
            <div className="p-5 rounded-3xl border border-indigo-100 bg-white space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    อัปโหลดไฟล์ Excel โครงสร้างคะแนน (Blueprint)
                  </h3>
                  <p className="text-xs text-slate-500">รองรับไฟล์นามสกุล .xlsx, .xls</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-colors relative bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    คลิกเพื่อเลือกไฟล์ Blueprint หรือลากไฟล์มาวางที่นี่
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {fileName ? `ไฟล์ที่เลือก: ${fileName}` : 'รองรับ .xlsx, .xls'}
                  </p>
                </div>
              </div>

              {parsedBlueprint.length > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    พร้อมอัปเดตโครงสร้าง {parsedBlueprint.length} บทเรียน
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-semibold"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSubmitting || (activeTab === 'scores' ? parsedScores.length === 0 : parsedBlueprint.length === 0)}
            className="btn btn-primary text-xs px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>ยืนยันนำเข้าข้อมูลลงระบบ</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
