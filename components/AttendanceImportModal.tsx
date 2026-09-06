'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, 
  HelpCircle, Calendar, Check, Info, Loader2, ArrowRight, Table as TableIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from '@/services/api';

export interface Student {
  id: string | number;
  student_code?: string;
  name: string;
}

export interface AttendanceRecordPayload {
  student_id: number;
  classroom_id: number;
  date: string; // YYYY-MM-DD
  status: 'present' | 'late' | 'absent' | 'leave';
}

interface AttendanceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string | number;
  classroomName: string;
  students: Student[];
  currentDate?: string; // YYYY-MM-DD
  onSuccess: () => void;
}

export default function AttendanceImportModal({
  isOpen,
  onClose,
  classroomId,
  classroomName,
  students,
  currentDate = new Date().toISOString().split('T')[0],
  onSuccess,
}: AttendanceImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formatMode, setFormatMode] = useState<'matrix' | 'daily'>('matrix');
  const [selectedSingleDate, setSelectedSingleDate] = useState(currentDate);

  // Parsed data
  const [fileName, setFileName] = useState('');
  const [parsedRecords, setParsedRecords] = useState<AttendanceRecordPayload[]>([]);
  const [statsSummary, setStatsSummary] = useState({
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    total: 0,
    dates: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setParsedRecords([]);
      setFileName('');
      setStatsSummary({ present: 0, late: 0, absent: 0, leave: 0, total: 0, dates: 0 });
    }
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sample students
  const sampleStudents = useMemo(() => {
    if (students && students.length >= 3) return students.slice(0, 3);
    return [
      { id: 1, student_code: '67010001', name: 'นายสมชาย ใจดี' },
      { id: 2, student_code: '67010002', name: 'นางสาวสมหญิง รักเรียน' },
      { id: 3, student_code: '67010003', name: 'นายกิตติศักดิ์ พากเพียร' },
    ];
  }, [students]);

  // Helper to normalize status values from Excel
  const normalizeStatus = (val: unknown): 'present' | 'late' | 'absent' | 'leave' | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim().toLowerCase();
    if (!str) return null;

    // Present patterns
    if (['มา', 'มาเรียน', 'present', 'p', '1', '/', '✓', 'v', 'ดี'].includes(str)) return 'present';
    // Late patterns
    if (['สาย', 'มาสาย', 'late', 'l', 'ส'].includes(str)) return 'late';
    // Absent patterns
    if (['ขาด', 'ขาดเรียน', 'absent', 'a', '0', 'x', 'ข'].includes(str)) return 'absent';
    // Leave patterns
    if (['ลา', 'ลากิจ', 'ลาป่วย', 'leave', 'ล'].includes(str)) return 'leave';

    return null;
  };

  // Helper to parse dates from header or column
  const parseHeaderDate = (cellVal: string): string | null => {
    const clean = cellVal.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    // DD/MM/YYYY
    const ddmmyyyy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      let year = parseInt(ddmmyyyy[3]);
      if (year > 2500) year -= 543; // Buddhist era conversion
      const month = String(ddmmyyyy[2]).padStart(2, '0');
      const day = String(ddmmyyyy[1]).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Number from Excel serial date
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
    return null;
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    try {
      const targetStudents = students && students.length > 0 ? students : sampleStudents;

      if (formatMode === 'matrix') {
        // Generate 4 sample weekly dates based on today
        const today = new Date();
        const sampleDates: string[] = [];
        for (let i = 0; i < 4; i++) {
          const d = new Date(today.getTime() + i * 7 * 86400 * 1000);
          sampleDates.push(d.toISOString().split('T')[0]);
        }

        const headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', ...sampleDates];
        const rows: (string | number)[][] = [];

        const statuses = ['มา', 'สาย', 'ขาด', 'ลา'];
        targetStudents.forEach((student, idx) => {
          const row: (string | number)[] = [
            student.student_code || `6701000${idx + 1}`,
            student.name
          ];
          for (let i = 0; i < sampleDates.length; i++) {
            row.push(statuses[(idx + i) % statuses.length]);
          }
          rows.push(row);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

        XLSX.utils.book_append_sheet(wb, ws, 'เช็คชื่อ');
        XLSX.writeFile(wb, `เทมเพลต_เช็คชื่อMatrix_${classroomName || 'ห้องเรียน'}.xlsx`);
        toast.success('ดาวน์โหลดเทมเพลต Matrix สำเร็จ');
      } else {
        // Daily Format
        const headers = ['รหัสประจำตัว', 'ชื่อ-นามสกุล', 'สถานะ (มา/สาย/ขาด/ลา)'];
        const rows: (string | number)[][] = [];

        const statuses = ['มา', 'สาย', 'ขาด', 'ลา'];
        targetStudents.forEach((student, idx) => {
          rows.push([
            student.student_code || `6701000${idx + 1}`,
            student.name,
            statuses[idx % statuses.length]
          ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 24 }];

        XLSX.utils.book_append_sheet(wb, ws, 'เช็คชื่อรายวัน');
        XLSX.writeFile(wb, `เทมเพลต_เช็คชื่อรายวัน_${classroomName || 'ห้องเรียน'}.xlsx`);
        toast.success('ดาวน์โหลดเทมเพลตรายวัน สำเร็จ');
      }
    } catch (err) {
      console.error(err);
      toast.error('ดาวน์โหลดเทมเพลตไม่สำเร็จ');
    }
  };

  // Upload and Parse
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

        let headerRowIndex = -1;
        let idColIndex = -1, nameColIndex = -1, lastNameColIndex = -1, statusColIndex = -1;
        const dateColumns: { [dateStr: string]: number } = {};

        // Detect header row
        for (let i = 0; i < Math.min(15, data.length); i++) {
          const row = data[i] || [];
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] ?? '').trim();
            if (cell.includes('รหัส') || cell.includes('เลขประจำตัว') || cell.toLowerCase().includes('code')) {
              idColIndex = j;
            } else if (cell.includes('ชื่อ') && !cell.includes('ห้อง')) {
              nameColIndex = j;
            } else if (cell.includes('นามสกุล')) {
              lastNameColIndex = j;
            } else if (cell.includes('สถานะ') || cell.toLowerCase().includes('status')) {
              statusColIndex = j;
            } else {
              // Try parsing as date header
              const parsedDate = parseHeaderDate(cell);
              if (parsedDate) {
                dateColumns[parsedDate] = j;
              }
            }
          }

          if ((idColIndex !== -1 || nameColIndex !== -1) && (statusColIndex !== -1 || Object.keys(dateColumns).length > 0)) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error('ไม่พบหัวคอลัมน์ที่รองรับ (รหัสประจำตัว, ชื่อ-นามสกุล, วันที่ หรือ สถานะ)');
          return;
        }

        const cidNum = Number(classroomId);
        const records: AttendanceRecordPayload[] = [];
        const uniqueDates = new Set<string>();

        let countP = 0, countL = 0, countA = 0, countLeave = 0;

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
            const sidNum = Number(matched.id);

            // If Matrix mode (multiple dates)
            if (Object.keys(dateColumns).length > 0) {
              Object.entries(dateColumns).forEach(([dateStr, colIdx]) => {
                const rawVal = row[colIdx];
                const status = normalizeStatus(rawVal);
                if (status) {
                  records.push({
                    student_id: sidNum,
                    classroom_id: cidNum,
                    date: dateStr,
                    status,
                  });
                  uniqueDates.add(dateStr);
                  if (status === 'present') countP++;
                  else if (status === 'late') countL++;
                  else if (status === 'absent') countA++;
                  else if (status === 'leave') countLeave++;
                }
              });
            } else if (statusColIndex !== -1) {
              // Single status column mode
              const rawVal = row[statusColIndex];
              const status = normalizeStatus(rawVal);
              if (status) {
                records.push({
                  student_id: sidNum,
                  classroom_id: cidNum,
                  date: selectedSingleDate,
                  status,
                });
                uniqueDates.add(selectedSingleDate);
                if (status === 'present') countP++;
                else if (status === 'late') countL++;
                else if (status === 'absent') countA++;
                else if (status === 'leave') countLeave++;
              }
            }
          }
        }

        if (records.length === 0) {
          toast.error('ไม่พบข้อมูลการเช็คชื่อที่สามารถจับคู่กับนักเรียนในห้องนี้ได้ กรุณาตรวจรหัสหรือชื่อ');
        } else {
          setParsedRecords(records);
          setStatsSummary({
            present: countP,
            late: countL,
            absent: countA,
            leave: countLeave,
            total: records.length,
            dates: uniqueDates.size,
          });
          toast.success(`อ่านข้อมูลสำเร็จ ตรวจพบ ${records.length} รายการเช็คชื่อ (${uniqueDates.size} วัน)`);
        }
      } catch (err) {
        console.error(err);
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (parsedRecords.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.post('/attendance', { records: parsedRecords });
      toast.success(`บันทึกเวลาเรียนสำเร็จ ${parsedRecords.length} รายการ`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('บันทึกเวลาเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                นำเข้าข้อมูลการเช็คชื่อจาก Excel & ตัวอย่างรูปแบบ
              </h2>
              <p className="text-xs text-slate-500">
                {classroomName} • ตรวจสอบรูปแบบตารางเวลาเรียนที่ระบบรองรับ และดาวน์โหลดเทมเพลตพร้อมใช้งาน
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

        {/* Format Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200/80 shadow-xs">
            <button
              onClick={() => { setFormatMode('matrix'); setParsedRecords([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                formatMode === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>แบบตารางหลายวัน (Matrix - แนะนำ)</span>
            </button>

            <button
              onClick={() => { setFormatMode('daily'); setParsedRecords([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                formatMode === 'daily'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>แบบเช็คชื่อรายวัน (Single Date)</span>
            </button>
          </div>

          {formatMode === 'daily' && (
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-slate-600">วันที่บันทึก:</label>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={e => setSelectedSingleDate(e.target.value)}
                className="form-input text-xs py-1.5 px-2.5 rounded-xl border-emerald-200 bg-white"
              />
            </div>
          )}
        </div>

        {/* Step 1: Format Guide & Example Mockup */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-indigo-50/30 border border-emerald-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  ตัวอย่างรูปแบบไฟล์ Excel ({formatMode === 'matrix' ? 'ตารางหลายวันที่' : 'เช็คชื่อรายวัน'})
                </h3>
                <p className="text-xs text-slate-500">
                  {formatMode === 'matrix' 
                    ? 'หัวคอลัมน์ใช้วันที่ เช่น 2026-09-01 หรือ 01/09/2026'
                    : 'คอลัมน์ที่ 3 เป็นสถานะการมาเรียนของนักเรียนแต่ละคน'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xs shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)</span>
            </button>
          </div>

          {/* Mock Spreadsheet Preview */}
          <div className="overflow-x-auto rounded-2xl border border-emerald-200/80 bg-white shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-emerald-100/70 text-emerald-950 font-bold border-b border-emerald-200">
                  <th className="p-2.5 border-r border-emerald-200/60 font-mono">รหัสประจำตัว</th>
                  <th className="p-2.5 border-r border-emerald-200/60 min-w-[160px]">ชื่อ-นามสกุล</th>
                  {formatMode === 'matrix' ? (
                    <>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-01</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-08</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-15</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-22</th>
                    </>
                  ) : (
                    <th className="p-2.5 text-center bg-emerald-200/50">สถานะ (มา/สาย/ขาด/ลา)</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sampleStudents.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-2 text-slate-600 border-r border-slate-200 font-mono">{s.student_code || `6701000${idx + 1}`}</td>
                    <td className="p-2 text-slate-800 border-r border-slate-200 font-semibold">{s.name}</td>
                    {formatMode === 'matrix' ? (
                      <>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">มา</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">สาย</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">ขาด</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px]">ลา</span></td>
                      </>
                    ) : (
                      <td className="p-2 text-center">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                          idx === 0 ? 'bg-emerald-100 text-emerald-800' : idx === 1 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {idx === 0 ? 'มา' : idx === 1 ? 'สาย' : 'ขาด'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recognized Legend / Values */}
          <div className="pt-1">
            <p className="text-[11px] font-bold text-slate-700 mb-1">สัญลักษณ์และคำที่ระบบตรวจจับอัตโนมัติ:</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <strong>มาเรียน:</strong> &quot;มา&quot;, &quot;1&quot;, &quot;/&quot;, &quot;✓&quot;, &quot;present&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <strong>มาสาย:</strong> &quot;สาย&quot;, &quot;ส&quot;, &quot;late&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <strong>ขาดเรียน:</strong> &quot;ขาด&quot;, &quot;ข&quot;, &quot;0&quot;, &quot;x&quot;, &quot;absent&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                <strong>ลา:</strong> &quot;ลา&quot;, &quot;ล&quot;, &quot;leave&quot;
              </span>
            </div>
          </div>
        </div>

        {/* Step 2: Upload Zone */}
        <div className="p-5 rounded-3xl border border-indigo-100 bg-white space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                อัปโหลดไฟล์ Excel เพื่อนำเข้าเวลาเรียน
              </h3>
              <p className="text-xs text-slate-500">รองรับไฟล์ .xlsx, .xls, .csv</p>
            </div>
          </div>

          <div className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-2xl p-6 text-center transition-colors relative bg-slate-50/50">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
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

          {/* Parsed Result Stats */}
          {parsedRecords.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-center font-bold">
                  <div>รวมทั้งหมด</div>
                  <div className="text-base text-indigo-700">{statsSummary.total} ครั้ง</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-center font-bold">
                  <div>มาเรียน</div>
                  <div className="text-base text-emerald-700">{statsSummary.present}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-center font-bold">
                  <div>มาสาย</div>
                  <div className="text-base text-amber-700">{statsSummary.late}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-center font-bold">
                  <div>ขาดเรียน</div>
                  <div className="text-base text-rose-700">{statsSummary.absent}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 text-center font-bold">
                  <div>ลา</div>
                  <div className="text-base text-blue-700">{statsSummary.leave}</div>
                </div>
              </div>
            </div>
          )}
        </div>

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
            disabled={isSubmitting || parsedRecords.length === 0}
            className="btn btn-accent text-xs px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>ยืนยันบันทึกเวลาเรียน ({parsedRecords.length} รายการ)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
