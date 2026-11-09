'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, 
  HelpCircle, Calendar, Check, Info, Loader2, ArrowRight, Table as TableIcon
} from 'lucide-react';
import toast from '@/lib/toast';
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
      { id: 1, student_code: '67010001', name: 'à¸™à¸²à¸¢à¸ªà¸¡à¸Šà¸²à¸¢ à¹ƒà¸ˆà¸”à¸µ' },
      { id: 2, student_code: '67010002', name: 'à¸™à¸²à¸‡à¸ªà¸²à¸§à¸ªà¸¡à¸«à¸à¸´à¸‡ à¸£à¸±à¸à¹€à¸£à¸µà¸¢à¸™' },
      { id: 3, student_code: '67010003', name: 'à¸™à¸²à¸¢à¸à¸´à¸•à¸•à¸´à¸¨à¸±à¸à¸”à¸´à¹Œ à¸žà¸²à¸à¹€à¸žà¸µà¸¢à¸£' },
    ];
  }, [students]);

  // Helper to normalize status values from Excel
  const normalizeStatus = (val: unknown): 'present' | 'late' | 'absent' | 'leave' | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim().toLowerCase();
    if (!str) return null;

    // Present patterns
    if (['à¸¡à¸²', 'à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™', 'present', 'p', '1', '/', 'âœ“', 'v', 'à¸”à¸µ'].includes(str)) return 'present';
    // Late patterns
    if (['à¸ªà¸²à¸¢', 'à¸¡à¸²à¸ªà¸²à¸¢', 'late', 'l', 'à¸ª'].includes(str)) return 'late';
    // Absent patterns
    if (['à¸‚à¸²à¸”', 'à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™', 'absent', 'a', '0', 'x', 'à¸‚'].includes(str)) return 'absent';
    // Leave patterns
    if (['à¸¥à¸²', 'à¸¥à¸²à¸à¸´à¸ˆ', 'à¸¥à¸²à¸›à¹ˆà¸§à¸¢', 'leave', 'à¸¥'].includes(str)) return 'leave';

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

        const headers = ['à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§', 'à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥', ...sampleDates];
        const rows: (string | number)[][] = [];

        const statuses = ['à¸¡à¸²', 'à¸ªà¸²à¸¢', 'à¸‚à¸²à¸”', 'à¸¥à¸²'];
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

        XLSX.utils.book_append_sheet(wb, ws, 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­');
        XLSX.writeFile(wb, `à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•_à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­Matrix_${classroomName || 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™'}.xlsx`);
        toast.success('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹€à¸—à¸¡à¹€à¸žà¸¥à¸• Matrix à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      } else {
        // Daily Format
        const headers = ['à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§', 'à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥', 'à¸ªà¸–à¸²à¸™à¸° (à¸¡à¸²/à¸ªà¸²à¸¢/à¸‚à¸²à¸”/à¸¥à¸²)'];
        const rows: (string | number)[][] = [];

        const statuses = ['à¸¡à¸²', 'à¸ªà¸²à¸¢', 'à¸‚à¸²à¸”', 'à¸¥à¸²'];
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

        XLSX.utils.book_append_sheet(wb, ws, 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸£à¸²à¸¢à¸§à¸±à¸™');
        XLSX.writeFile(wb, `à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•_à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸£à¸²à¸¢à¸§à¸±à¸™_${classroomName || 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™'}.xlsx`);
        toast.success('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•à¸£à¸²à¸¢à¸§à¸±à¸™ à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      }
    } catch (err) {
      console.error(err);
      toast.error('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    }
  };

  // Upload and Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('à¸‚à¸™à¸²à¸”à¹„à¸Ÿà¸¥à¹Œà¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸” (à¸ªà¸¹à¸‡à¸ªà¸¸à¸”à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5MB)');
      e.target.value = '';
      return;
    }
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
            if (cell.includes('à¸£à¸«à¸±à¸ª') || cell.includes('à¹€à¸¥à¸‚à¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§') || cell.toLowerCase().includes('code')) {
              idColIndex = j;
            } else if (cell.includes('à¸Šà¸·à¹ˆà¸­') && !cell.includes('à¸«à¹‰à¸­à¸‡')) {
              nameColIndex = j;
            } else if (cell.includes('à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥')) {
              lastNameColIndex = j;
            } else if (cell.includes('à¸ªà¸–à¸²à¸™à¸°') || cell.toLowerCase().includes('status')) {
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
          toast.error('à¹„à¸¡à¹ˆà¸žà¸šà¸«à¸±à¸§à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸—à¸µà¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š (à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§, à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥, à¸§à¸±à¸™à¸—à¸µà¹ˆ à¸«à¸£à¸·à¸­ à¸ªà¸–à¸²à¸™à¸°)');
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
            matched = students.find(s => fullName.includes(s.name) || s.name.includes(fullName.replace(/à¸™à¸²à¸¢|à¸™à¸²à¸‡à¸ªà¸²à¸§|à¹€à¸”à¹‡à¸à¸Šà¸²à¸¢|à¹€à¸”à¹‡à¸à¸«à¸à¸´à¸‡/g, '').trim()));
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
          toast.error('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸à¸±à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™à¸«à¹‰à¸­à¸‡à¸™à¸µà¹‰à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸£à¸«à¸±à¸ªà¸«à¸£à¸·à¸­à¸Šà¸·à¹ˆà¸­');
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
          toast.success(`à¸­à¹ˆà¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸•à¸£à¸§à¸ˆà¸žà¸š ${records.length} à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­ (${uniqueDates.size} à¸§à¸±à¸™)`);
        }
      } catch (err) {
        console.error(err);
        toast.error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œ');
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
      toast.success(`à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${parsedRecords.length} à¸£à¸²à¸¢à¸à¸²à¸£`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="w-full max-w-4xl p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/60 relative max-h-[90vh] overflow-y-auto space-y-6 text-slate-800 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-indigo-100/70 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                à¸™à¸³à¹€à¸‚à¹‰à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸ˆà¸²à¸ Excel & à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸š
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {classroomName} â€¢ à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸£à¸¹à¸›à¹à¸šà¸šà¸•à¸²à¸£à¸²à¸‡à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸£à¸­à¸‡à¸£à¸±à¸š à¹à¸¥à¸°à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700 shadow-xs">
            <button
              onClick={() => { setFormatMode('matrix'); setParsedRecords([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                formatMode === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>à¹à¸šà¸šà¸•à¸²à¸£à¸²à¸‡à¸«à¸¥à¸²à¸¢à¸§à¸±à¸™ (Matrix - à¹à¸™à¸°à¸™à¸³)</span>
            </button>

            <button
              onClick={() => { setFormatMode('daily'); setParsedRecords([]); setFileName(''); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                formatMode === 'daily'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>à¹à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸£à¸²à¸¢à¸§à¸±à¸™ (Single Date)</span>
            </button>
          </div>

          {formatMode === 'daily' && (
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-slate-600">à¸§à¸±à¸™à¸—à¸µà¹ˆà¸šà¸±à¸™à¸—à¸¶à¸:</label>
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
                  à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œ Excel ({formatMode === 'matrix' ? 'à¸•à¸²à¸£à¸²à¸‡à¸«à¸¥à¸²à¸¢à¸§à¸±à¸™à¸—à¸µà¹ˆ' : 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸£à¸²à¸¢à¸§à¸±à¸™'})
                </h3>
                <p className="text-xs text-slate-500">
                  {formatMode === 'matrix' 
                    ? 'à¸«à¸±à¸§à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¹ƒà¸Šà¹‰à¸§à¸±à¸™à¸—à¸µà¹ˆ à¹€à¸Šà¹ˆà¸™ 2026-09-01 à¸«à¸£à¸·à¸­ 01/09/2026'
                    : 'à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸—à¸µà¹ˆ 3 à¹€à¸›à¹‡à¸™à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹à¸•à¹ˆà¸¥à¸°à¸„à¸™'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xs shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ (.xlsx)</span>
            </button>
          </div>

          {/* Mock Spreadsheet Preview */}
          <div className="overflow-x-auto rounded-2xl border border-emerald-200/80 bg-white shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-emerald-100/70 text-emerald-950 font-bold border-b border-emerald-200">
                  <th className="p-2.5 border-r border-emerald-200/60 font-mono">à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§</th>
                  <th className="p-2.5 border-r border-emerald-200/60 min-w-[160px]">à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥</th>
                  {formatMode === 'matrix' ? (
                    <>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-01</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-08</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-15</th>
                      <th className="p-2.5 border-r border-emerald-200/60 text-center font-mono bg-emerald-200/50">2026-09-22</th>
                    </>
                  ) : (
                    <th className="p-2.5 text-center bg-emerald-200/50">à¸ªà¸–à¸²à¸™à¸° (à¸¡à¸²/à¸ªà¸²à¸¢/à¸‚à¸²à¸”/à¸¥à¸²)</th>
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
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">à¸¡à¸²</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">à¸ªà¸²à¸¢</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">à¸‚à¸²à¸”</span></td>
                        <td className="p-2 text-center border-r border-slate-200"><span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px]">à¸¥à¸²</span></td>
                      </>
                    ) : (
                      <td className="p-2 text-center">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                          idx === 0 ? 'bg-emerald-100 text-emerald-800' : idx === 1 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {idx === 0 ? 'à¸¡à¸²' : idx === 1 ? 'à¸ªà¸²à¸¢' : 'à¸‚à¸²à¸”'}
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
            <p className="text-[11px] font-bold text-slate-700 mb-1">à¸ªà¸±à¸à¸¥à¸±à¸à¸©à¸“à¹Œà¹à¸¥à¸°à¸„à¸³à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´:</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <strong>à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™:</strong> &quot;à¸¡à¸²&quot;, &quot;1&quot;, &quot;/&quot;, &quot;âœ“&quot;, &quot;present&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <strong>à¸¡à¸²à¸ªà¸²à¸¢:</strong> &quot;à¸ªà¸²à¸¢&quot;, &quot;à¸ª&quot;, &quot;late&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <strong>à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™:</strong> &quot;à¸‚à¸²à¸”&quot;, &quot;à¸‚&quot;, &quot;0&quot;, &quot;x&quot;, &quot;absent&quot;
              </span>
              <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                <strong>à¸¥à¸²:</strong> &quot;à¸¥à¸²&quot;, &quot;à¸¥&quot;, &quot;leave&quot;
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
                à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ Excel à¹€à¸žà¸·à¹ˆà¸­à¸™à¸³à¹€à¸‚à¹‰à¸²à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™
              </h3>
              <p className="text-xs text-slate-500">à¸£à¸­à¸‡à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ .xlsx, .xls, .csv</p>
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
                à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œ Excel à¸«à¸£à¸·à¸­à¸¥à¸²à¸à¹„à¸Ÿà¸¥à¹Œà¸¡à¸²à¸§à¸²à¸‡à¸—à¸µà¹ˆà¸™à¸µà¹ˆ
              </p>
              <p className="text-[10px] text-slate-400">
                {fileName ? `à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸: ${fileName}` : 'à¸£à¸­à¸‡à¸£à¸±à¸š .xlsx, .xls, .csv'}
              </p>
            </div>
          </div>

          {/* Parsed Result Stats */}
          {parsedRecords.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-center font-bold">
                  <div>à¸£à¸§à¸¡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</div>
                  <div className="text-base text-indigo-700">{statsSummary.total} à¸„à¸£à¸±à¹‰à¸‡</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-center font-bold">
                  <div>à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™</div>
                  <div className="text-base text-emerald-700">{statsSummary.present}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-center font-bold">
                  <div>à¸¡à¸²à¸ªà¸²à¸¢</div>
                  <div className="text-base text-amber-700">{statsSummary.late}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-center font-bold">
                  <div>à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™</div>
                  <div className="text-base text-rose-700">{statsSummary.absent}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 text-center font-bold">
                  <div>à¸¥à¸²</div>
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
            à¸¢à¸à¹€à¸¥à¸´à¸
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSubmitting || parsedRecords.length === 0}
            className="btn btn-accent text-xs px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ ({parsedRecords.length} à¸£à¸²à¸¢à¸à¸²à¸£)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
