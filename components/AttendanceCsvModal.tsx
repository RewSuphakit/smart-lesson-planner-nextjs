'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet, X, Download, Copy, Check, Search,
  Calendar as CalendarIcon, Eye, CheckSquare, Square,
  Sparkles, Loader2, TableProperties, RefreshCw, GraduationCap, GitBranch
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from '@/services/api';
import { toSafeExcelSheetName } from '@/lib/studentSections';

export interface ClassroomData {
  id: string | number;
  name: string;
  min_attendance_percent?: number;
  total_classes?: number;
  late_to_absent_ratio?: number;
  leave_to_absent_ratio?: number;
}

interface AttendanceCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: ClassroomData | null;
  initialStartDate?: string;
  initialEndDate?: string;
  initialSectionKey?: string;
}

interface SectionOption {
  key: string;
  label: string;
  fullLabel: string;
  shortSheetName: string;
  branch: string | null;
  gradeLevel: string | null;
  isUnassigned: boolean;
  count: number;
}

interface SummaryStudentRow {
  no: number;
  id: number | string;
  student_code: string;
  name: string;
  grade_level?: string;
  branch?: string;
  section_key?: string;
  section_label?: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  converted_absent: number;
  attendance_percent: number;
  overall_converted_absent: number;
  status: string;
  is_f: boolean;
  date_records?: Record<string, string>;
}

interface DetailedRow {
  no: number;
  student_code: string;
  name: string;
  grade_level?: string;
  branch?: string;
  section_key?: string;
  section_label?: string;
  date: string;
  status: string;
}

interface ColumnOption {
  id: string;
  label: string;
  defaultChecked: boolean;
  wch: number;
  getValue: (s: SummaryStudentRow) => string | number;
}

export default function AttendanceCsvModal({
  isOpen,
  onClose,
  classroom,
  initialStartDate = '',
  initialEndDate = '',
  initialSectionKey = 'all',
}: AttendanceCsvModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchPreview, setSearchPreview] = useState('');

  // Date range filter
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  // Section (sub-room) filter & multi-sheet Excel option
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [hasMultipleSections, setHasMultipleSections] = useState(false);
  const [sharedBranch, setSharedBranch] = useState<string | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>(initialSectionKey || 'all');
  const [splitExcelBySection, setSplitExcelBySection] = useState<boolean>(true);

  // Active view mode: 'summary' | 'matrix' | 'detailed'
  const [viewMode, setViewMode] = useState<'summary' | 'matrix' | 'detailed'>('summary');

  // Loading state
  const [loading, setLoading] = useState(false);

  // Data from backend
  const [summaryList, setSummaryList] = useState<SummaryStudentRow[]>([]);
  const [detailedList, setDetailedList] = useState<DetailedRow[]>([]);
  const [uniqueDates, setUniqueDates] = useState<string[]>([]);

  // Summary Column Definitions
  const summaryColumns: ColumnOption[] = useMemo(() => [
    { id: 'no', label: 'ลำดับ', defaultChecked: true, wch: 8, getValue: s => s.no },
    { id: 'student_code', label: 'รหัสประจำตัว', defaultChecked: true, wch: 16, getValue: s => s.student_code || '-' },
    { id: 'name', label: 'ชื่อ-นามสกุล', defaultChecked: true, wch: 28, getValue: s => s.name || '-' },
    {
      id: 'grade_level',
      label: 'ระดับชั้น/ห้อง',
      defaultChecked: true,
      wch: 16,
      getValue: s => (hasMultipleSections ? (s.section_label || s.grade_level || '-') : (s.grade_level || '-')),
    },
    { id: 'branch', label: 'สาขาวิชา', defaultChecked: false, wch: 20, getValue: s => s.branch || '-' },
    { id: 'present', label: 'มา (ครั้ง)', defaultChecked: true, wch: 12, getValue: s => s.present },
    { id: 'late', label: 'สาย (ครั้ง)', defaultChecked: true, wch: 12, getValue: s => s.late },
    { id: 'absent', label: 'ขาด (ครั้ง)', defaultChecked: true, wch: 12, getValue: s => s.absent },
    { id: 'leave', label: 'ลา (ครั้ง)', defaultChecked: true, wch: 12, getValue: s => s.leave },
    { id: 'converted_absent', label: 'ขาดสุทธิ (แปลงสาย/ลา)', defaultChecked: true, wch: 22, getValue: s => s.converted_absent },
    { id: 'attendance_percent', label: 'ร้อยละเข้าเรียน (%)', defaultChecked: true, wch: 18, getValue: s => `${s.attendance_percent}%` },
    { id: 'status', label: 'สถานะสิทธิ์', defaultChecked: true, wch: 18, getValue: s => s.status },
  ], [hasMultipleSections]);

  const [selectedColIds, setSelectedColIds] = useState<string[]>([
    'no', 'student_code', 'name', 'grade_level', 'present', 'late', 'absent', 'leave',
    'converted_absent', 'attendance_percent', 'status',
  ]);

  const activeCols = useMemo(() => {
    return summaryColumns.filter(c => selectedColIds.includes(c.id));
  }, [summaryColumns, selectedColIds]);

  const toggleCol = (id: string) => {
    setSelectedColIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast.error('ต้องเลือกอย่างน้อย 1 คอลัมน์');
          return prev;
        }
        return prev.filter(cId => cId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial section key when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSectionKey(initialSectionKey || 'all');
    }
  }, [isOpen, initialSectionKey]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch export data for preview
  const fetchPreviewData = async () => {
    if (!classroom?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('classroom_id', String(classroom.id));
      params.append('file_format', 'json');
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await api.get(`/attendance/export?${params.toString()}`);
      if (res.data?.data) {
        const d = res.data.data;
        setSummaryList(d.summaryList || []);
        setDetailedList(d.detailedList || []);
        setUniqueDates(d.uniqueDates || []);
        setSections(d.sections || []);
        setHasMultipleSections(Boolean(d.hasMultipleSections));
        setSharedBranch(d.sharedBranch || null);
      }
    } catch (err) {
      console.error('Fetch attendance preview error:', err);
      toast.error('ไม่สามารถโหลดตัวอย่างข้อมูลเช็คชื่อได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && classroom?.id) {
      fetchPreviewData();
    }
  }, [isOpen, classroom?.id, startDate, endDate]);

  // Validate selectedSectionKey exists in fetched sections
  useEffect(() => {
    if (selectedSectionKey !== 'all' && sections.length > 0) {
      const exists = sections.some(sec => sec.key === selectedSectionKey);
      if (!exists) setSelectedSectionKey('all');
    }
  }, [sections, selectedSectionKey]);

  const activeSection = useMemo(
    () => (selectedSectionKey !== 'all' ? sections.find(s => s.key === selectedSectionKey) ?? null : null),
    [sections, selectedSectionKey]
  );

  // Scoped datasets for the currently selected section (renumbered 1..N)
  const sectionSummaryList = useMemo(() => {
    const base =
      selectedSectionKey === 'all'
        ? summaryList
        : summaryList.filter(s => s.section_key === selectedSectionKey);
    return base.map((item, idx) => ({ ...item, no: idx + 1 }));
  }, [summaryList, selectedSectionKey]);

  const sectionDetailedList = useMemo(() => {
    const base =
      selectedSectionKey === 'all'
        ? detailedList
        : detailedList.filter(r => r.section_key === selectedSectionKey);
    return base.map((item, idx) => ({ ...item, no: idx + 1 }));
  }, [detailedList, selectedSectionKey]);

  const scopedSummaryStats = useMemo(() => {
    return {
      totalStudents: sectionSummaryList.length,
      recordsCount: sectionDetailedList.length,
      datesCount: uniqueDates.length,
    };
  }, [sectionSummaryList.length, sectionDetailedList.length, uniqueDates.length]);

  // Quick Preset Handlers
  const applyPreset = (days: number | 'all' | 'month') => {
    if (days === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const end = new Date().toISOString().split('T')[0];
    if (days === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(end);
      return;
    }
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    setStartDate(startObj.toISOString().split('T')[0]);
    setEndDate(end);
  };

  // Filtered lists for live search
  const filteredSummary = useMemo(() => {
    if (!searchPreview.trim()) return sectionSummaryList;
    const q = searchPreview.toLowerCase();
    return sectionSummaryList.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.student_code && s.student_code.toLowerCase().includes(q)) ||
      (s.grade_level && s.grade_level.toLowerCase().includes(q)) ||
      (s.section_label && s.section_label.toLowerCase().includes(q)) ||
      s.status.toLowerCase().includes(q)
    );
  }, [sectionSummaryList, searchPreview]);

  const filteredDetailed = useMemo(() => {
    if (!searchPreview.trim()) return sectionDetailedList;
    const q = searchPreview.toLowerCase();
    return sectionDetailedList.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.student_code && r.student_code.toLowerCase().includes(q)) ||
      (r.grade_level && r.grade_level.toLowerCase().includes(q)) ||
      r.status.toLowerCase().includes(q) ||
      r.date.includes(q)
    );
  }, [sectionDetailedList, searchPreview]);

  // ─── Export Generators ───
  const getFileBaseName = () => {
    const today = new Date().toISOString().split('T')[0];
    const cName = (classroom?.name || 'ห้องเรียน').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    const secPart = activeSection
      ? `_${activeSection.shortSheetName.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')}`
      : '';
    const range = (startDate || endDate) ? `_${startDate || 'start'}_ถึง_${endDate || 'now'}` : '_ทั้งเทอม';
    return `รายงานเช็คชื่อ_${cName}${secPart}${range}_${today}`;
  };

  // 1. Download CSV
  const handleDownloadCsv = () => {
    if (sectionSummaryList.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];

      if (viewMode === 'summary') {
        headers = activeCols.map(c => c.label);
        rows = sectionSummaryList.map(s => activeCols.map(c => c.getValue(s)));
      } else if (viewMode === 'detailed') {
        headers = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น/ห้อง', 'วันที่', 'สถานะ'];
        rows = sectionDetailedList.map((r, i) => [
          i + 1,
          r.student_code,
          r.name,
          r.section_label || r.grade_level || '-',
          r.date,
          r.status,
        ]);
      } else {
        // Matrix
        headers = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น/ห้อง', ...uniqueDates, 'มา', 'สาย', 'ขาด', 'ลา', 'ขาดสุทธิ', 'ร้อยละ'];
        rows = sectionSummaryList.map(s => [
          s.student_code,
          s.name,
          s.section_label || s.grade_level || '-',
          ...uniqueDates.map(d => s.date_records?.[d] || '-'),
          s.present,
          s.late,
          s.absent,
          s.leave,
          s.converted_absent,
          `${s.attendance_percent}%`
        ]);
      }

      const csvLines = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      ];

      // UTF-8 BOM
      const BOM = '\uFEFF';
      const csvContent = BOM + csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${getFileBaseName()}_${viewMode}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        activeSection
          ? `ส่งออกไฟล์ CSV เฉพาะห้อง "${activeSection.label}" สำเร็จ`
          : 'ส่งออกไฟล์ CSV สำเร็จ (รองรับ Excel ภาษาไทยสมบูรณ์)'
      );
      onClose();
    } catch (err) {
      console.error('Download CSV error:', err);
      toast.error('ส่งออก CSV ไม่สำเร็จ');
    }
  };

  // 2. Download Excel (.xlsx)
  const handleDownloadExcel = () => {
    if (sectionSummaryList.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();
      const registerSheetName = (rawName: string) => {
        const base = toSafeExcelSheetName(rawName, 'Sheet');
        let candidate = base;
        let idx = 2;
        while (usedSheetNames.has(candidate)) {
          candidate = `${base.slice(0, 28)}_${idx++}`;
        }
        usedSheetNames.add(candidate);
        return candidate;
      };

      const buildSummarySheet = (rowsList: SummaryStudentRow[], subtitleLabel?: string) => {
        const renumbered = rowsList.map((item, idx) => ({ ...item, no: idx + 1 }));
        const summaryHeaders = activeCols.map(c => c.label);
        const summaryRows = renumbered.map(s => activeCols.map(c => c.getValue(s)));
        const ws = XLSX.utils.aoa_to_sheet([
          [`รายงานการเข้าเรียน — ${classroom?.name || 'ห้องเรียน'}${subtitleLabel ? ` (${subtitleLabel})` : ''}`],
          [`ช่วงเวลา: ${startDate || 'เริ่มต้น'} ถึง ${endDate || 'ปัจจุบัน'} | จำนวนนักเรียน: ${renumbered.length} คน`],
          [],
          summaryHeaders,
          ...summaryRows
        ]);
        ws['!cols'] = activeCols.map(c => ({ wch: c.wch }));
        return ws;
      };

      const buildMatrixSheet = (rowsList: SummaryStudentRow[], subtitleLabel?: string) => {
        const renumbered = rowsList.map((item, idx) => ({ ...item, no: idx + 1 }));
        const matrixHeaders = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น/ห้อง', ...uniqueDates, 'มา', 'สาย', 'ขาด', 'ลา', 'ขาดสุทธิ', 'ร้อยละ'];
        const matrixRows = renumbered.map(s => [
          s.no,
          s.student_code,
          s.name,
          s.section_label || s.grade_level || '-',
          ...uniqueDates.map(d => s.date_records?.[d] || '-'),
          s.present,
          s.late,
          s.absent,
          s.leave,
          s.converted_absent,
          `${s.attendance_percent}%`
        ]);
        const ws = XLSX.utils.aoa_to_sheet([
          [`ตารางเช็คชื่อรายวัน — ${classroom?.name || 'ห้องเรียน'}${subtitleLabel ? ` (${subtitleLabel})` : ''}`],
          [],
          matrixHeaders,
          ...matrixRows,
        ]);
        ws['!cols'] = [
          { wch: 8 },
          { wch: 16 },
          { wch: 26 },
          { wch: 15 },
          ...uniqueDates.map(() => ({ wch: 8 })),
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          { wch: 10 },
          { wch: 10 },
        ];
        return ws;
      };

      // If exporting all sections AND splitExcelBySection is enabled, put individual section sheets first or alongside combined!
      if (hasMultipleSections && selectedSectionKey === 'all' && splitExcelBySection) {
        // 1) Separate sheets per sub-room (ปวช.1-1, ปวช.1-2, ...)
        for (const sec of sections) {
          const secRows = summaryList.filter(s => s.section_key === sec.key);
          if (secRows.length === 0) continue;

          if (uniqueDates.length > 0) {
            const wsSecMatrix = buildMatrixSheet(secRows, sec.fullLabel);
            XLSX.utils.book_append_sheet(wb, wsSecMatrix, registerSheetName(sec.shortSheetName));
          } else {
            const wsSecSummary = buildSummarySheet(secRows, sec.fullLabel);
            XLSX.utils.book_append_sheet(wb, wsSecSummary, registerSheetName(sec.shortSheetName));
          }
        }

        // 2) Combined overview sheets
        XLSX.utils.book_append_sheet(
          wb,
          buildSummarySheet(sectionSummaryList, 'รวมทุกห้อง'),
          registerSheetName('สรุปรวมทุกห้อง')
        );
        if (uniqueDates.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            buildMatrixSheet(sectionSummaryList, 'รวมทุกห้อง'),
            registerSheetName('ตารางรายวันรวม')
          );
        }
      } else {
        // Single section or non-split export
        const subTitle = activeSection?.fullLabel;
        XLSX.utils.book_append_sheet(
          wb,
          buildSummarySheet(sectionSummaryList, subTitle),
          registerSheetName(activeSection ? `สรุป_${activeSection.shortSheetName}` : 'สรุปสถิติรายคน')
        );

        if (uniqueDates.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            buildMatrixSheet(sectionSummaryList, subTitle),
            registerSheetName(activeSection ? `รายวัน_${activeSection.shortSheetName}` : 'ตารางรายวัน')
          );
        }
      }

      // Detailed Log sheet
      const detailedHeaders = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น/ห้อง', 'วันที่', 'สถานะ'];
      const detailedRows = sectionDetailedList.map((r, i) => [
        i + 1,
        r.student_code,
        r.name,
        r.section_label || r.grade_level || '-',
        r.date,
        r.status,
      ]);
      const wsDetailed = XLSX.utils.aoa_to_sheet([detailedHeaders, ...detailedRows]);
      wsDetailed['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsDetailed, registerSheetName('ประวัติเช็คชื่อละเอียด'));

      XLSX.writeFile(wb, `${getFileBaseName()}.xlsx`);
      toast.success(
        hasMultipleSections && selectedSectionKey === 'all' && splitExcelBySection
          ? `ส่งออกไฟล์ Excel (.xlsx) แยกชีตตามห้องย่อย (${sections.length} ห้อง) สำเร็จ`
          : activeSection
            ? `ส่งออกไฟล์ Excel เฉพาะห้อง "${activeSection.label}" สำเร็จ`
            : 'ส่งออกไฟล์ Excel (.xlsx) ครบทุกชีตสำเร็จ'
      );
      onClose();
    } catch (err) {
      console.error('Download Excel error:', err);
      toast.error('ส่งออก Excel ไม่สำเร็จ');
    }
  };

  // 3. Copy to Clipboard
  const handleCopyClipboard = async () => {
    if (sectionSummaryList.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับคัดลอก');
      return;
    }

    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];

      if (viewMode === 'summary') {
        headers = activeCols.map(c => c.label);
        rows = sectionSummaryList.map(s => activeCols.map(c => c.getValue(s)));
      } else {
        headers = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ระดับชั้น/ห้อง', 'วันที่', 'สถานะ'];
        rows = sectionDetailedList.map((r, i) => [
          i + 1,
          r.student_code,
          r.name,
          r.section_label || r.grade_level || '-',
          r.date,
          r.status,
        ]);
      }

      const tsv = [
        headers.join('\t'),
        ...rows.map(r => r.join('\t'))
      ].join('\n');

      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      toast.success('คัดลอกข้อมูลเรียบร้อย (วางใน Excel หรือ Google Sheets ได้ทันที)');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('ไม่สามารถคัดลอกข้อมูลได้');
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-slate-50 rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                <span>พรีวิวและกำหนดค่าส่งออกข้อมูลการเช็คชื่อ</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {classroom?.name || 'ห้องเรียน'}
                </span>
                {activeSection && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    เฉพาะ {activeSection.label}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                ตรวจสอบข้อมูลก่อนส่งออก เลือกห้องย่อย ช่วงวันที่ ปรับแต่งคอลัมน์ และดาวน์โหลดเป็นไฟล์ CSV หรือ Excel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyClipboard}
              className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
              title="คัดลอกข้อมูลไปวางใน Excel หรือ Google Sheets"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลง Excel'}
            </button>
            <button
              onClick={handleDownloadExcel}
              className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
              title="ดาวน์โหลดเป็นไฟล์ Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadCsv}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/25 transition-all"
            >
              <Download className="w-4 h-4" /> ดาวน์โหลด CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Preferences Bar */}
        <div className="p-4 bg-white border-b border-slate-200 shrink-0 space-y-3">
          {/* Sub-room / Section Selector (shown automatically when combined classroom has >1 room) */}
          {hasMultipleSections && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mr-1">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>เลือกห้องย่อย:</span>
                </span>
                {sharedBranch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold mr-1">
                    <GitBranch className="w-3 h-3" />
                    สาขา{sharedBranch}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSectionKey('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                    selectedSectionKey === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                  }`}
                >
                  รวมทุกห้อง ({summaryList.length})
                </button>
                {sections.map(sec => {
                  const isActive = selectedSectionKey === sec.key;
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => setSelectedSectionKey(sec.key)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      {sec.label} ({sec.count})
                    </button>
                  );
                })}
              </div>

              {selectedSectionKey === 'all' && (
                <button
                  type="button"
                  onClick={() => setSplitExcelBySection(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                    splitExcelBySection
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                  title="เมื่อกดดาวน์โหลด Excel (.xlsx) ระบบจะสร้างชีตแยกแต่ละห้องย่อยให้อัตโนมัติ"
                >
                  {splitExcelBySection ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>แยกชีต Excel ตามห้องย่อยอัตโนมัติ</span>
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
                ช่วงวันที่:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-emerald-500"
                  title="วันเริ่มต้น"
                />
                <span className="text-slate-400 font-medium">ถึง</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-emerald-500"
                  title="วันสิ้นสุด"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    !startDate && !endDate
                      ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมด (ทั้งเทอม)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(7)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  7 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  30 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('month')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  เดือนนี้
                </button>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'summary'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 สรุปสถิติรายบุคคล
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ ตารางเมทริกซ์รายวัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'detailed'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📝 บันทึกประวัติละเอียด
              </button>
            </div>
          </div>

          {/* Column Checkboxes (Only shown for Summary Mode) */}
          {viewMode === 'summary' && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0 mr-1">
                <TableProperties className="w-3.5 h-3.5 text-emerald-600" />
                คอลัมน์สรุป:
              </span>
              {summaryColumns.map(col => {
                const isChecked = selectedColIds.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCol(col.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border ${
                      isChecked
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isChecked ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Spreadsheet Preview Container */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-100/70">
          <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" />
                ตัวอย่างหน้าตาตาราง CSV / Excel (Live Spreadsheet Preview)
              </span>
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                <span>นักเรียน {scopedSummaryStats.totalStudents} คน</span>
                <span>•</span>
                <span>พบเช็คชื่อ {scopedSummaryStats.recordsCount} รายการ</span>
                <span>•</span>
                <span>{scopedSummaryStats.datesCount} คาบเรียน</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchPreviewData}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
                title="รีเฟรชข้อมูลตัวอย่าง"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchPreview}
                  onChange={e => setSearchPreview(e.target.value)}
                  placeholder="ค้นหาชื่อ หรือ รหัส..."
                  className="form-input text-xs pl-8 py-1 bg-white border-slate-300 rounded-lg w-full"
                />
              </div>
            </div>
          </div>

          {/* Spreadsheet Table View */}
          <div className="flex-1 overflow-auto rounded-xl border border-slate-300 bg-white shadow-inner">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-xs">กำลังประมวลผลตัวอย่างข้อมูลเช็คชื่อ...</span>
              </div>
            ) : viewMode === 'summary' ? (
              /* Summary Table */
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-emerald-50/90 backdrop-blur-sm z-10 border-b-2 border-emerald-300">
                  <tr>
                    <th className="p-2 w-10 text-center font-bold text-slate-400 bg-slate-100 border-r border-slate-300 select-none">
                      #
                    </th>
                    {activeCols.map((col, idx) => (
                      <th key={col.id} className="p-2.5 font-bold text-slate-700 border-r border-slate-200">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-emerald-700 font-mono text-[10px] bg-emerald-100/70 px-1 rounded">
                            {String.fromCharCode(65 + (idx % 26))}
                          </span>
                          <span>{col.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan={activeCols.length + 1} className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลการเช็คชื่อในเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((s, idx) => (
                      <tr key={s.id} className={`border-b border-slate-200 hover:bg-emerald-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2 text-center text-slate-400 font-mono text-[10px] bg-slate-50 border-r border-slate-300 select-none">
                          {idx + 1}
                        </td>
                        {activeCols.map(col => {
                          const val = col.getValue(s);
                          const isName = col.id === 'name';
                          const isPercent = col.id === 'attendance_percent';
                          const isStatus = col.id === 'status';

                          return (
                            <td
                              key={col.id}
                              className={`p-2.5 border-r border-slate-200 ${
                                isName ? 'font-semibold text-slate-800' :
                                isPercent ? 'font-bold text-indigo-700' :
                                isStatus ? (s.is_f ? 'text-rose-600 font-bold' : s.status === 'เฝ้าระวัง' ? 'text-amber-600 font-bold' : 'text-emerald-600 font-semibold') :
                                'text-slate-600'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : viewMode === 'detailed' ? (
              /* Detailed Table */
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-emerald-50/90 backdrop-blur-sm z-10 border-b-2 border-emerald-300">
                  <tr>
                    <th className="p-2 w-12 text-center font-bold text-slate-700 border-r border-slate-200">#</th>
                    <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200">รหัสนักเรียน</th>
                    <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200">ชื่อ-นามสกุล</th>
                    <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200">ระดับชั้น/ห้อง</th>
                    <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200">วันที่</th>
                    <th className="p-2.5 font-bold text-slate-700">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetailed.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        ไม่พบประวัติการเช็คชื่อในเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredDetailed.map((r, idx) => (
                      <tr key={idx} className={`border-b border-slate-200 hover:bg-emerald-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2 text-center text-slate-400 font-mono text-[10px] bg-slate-50 border-r border-slate-300 select-none">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-mono font-medium text-slate-700 border-r border-slate-200">{r.student_code || '-'}</td>
                        <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200">{r.name}</td>
                        <td className="p-2.5 text-slate-600 border-r border-slate-200">{r.section_label || r.grade_level || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-200">{r.date}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            r.status === 'มาเรียน' ? 'bg-emerald-100 text-emerald-800' :
                            r.status === 'สาย' ? 'bg-amber-100 text-amber-800' :
                            r.status === 'ขาด' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* Matrix Grid Table */
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-emerald-50/90 backdrop-blur-sm z-10 border-b-2 border-emerald-300">
                  <tr>
                    <th className="p-2 w-10 text-center font-bold text-slate-700 border-r border-slate-200">#</th>
                    <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200 min-w-[140px]">ชื่อ-นามสกุล</th>
                    {hasMultipleSections && (
                      <th className="p-2.5 font-bold text-slate-700 border-r border-slate-200 min-w-[90px]">ห้องย่อย</th>
                    )}
                    {uniqueDates.map(d => (
                      <th key={d} className="p-2 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[50px]">
                        <div className="text-[10px] font-mono">{d.slice(5)}</div>
                      </th>
                    ))}
                    <th className="p-2 text-center font-bold text-emerald-700 bg-emerald-100/50">มา</th>
                    <th className="p-2 text-center font-bold text-amber-700 bg-amber-100/50">สาย</th>
                    <th className="p-2 text-center font-bold text-rose-700 bg-rose-100/50">ขาด</th>
                    <th className="p-2 text-center font-bold text-blue-700 bg-blue-100/50">ลา</th>
                    <th className="p-2 text-center font-bold text-indigo-900 bg-indigo-100/60">%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan={uniqueDates.length + (hasMultipleSections ? 9 : 8)} className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลในตาราง Matrix
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((s, idx) => (
                      <tr key={s.id} className={`border-b border-slate-200 hover:bg-emerald-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2 text-center text-slate-400 font-mono text-[10px] bg-slate-50 border-r border-slate-300 select-none">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap">{s.name}</td>
                        {hasMultipleSections && (
                          <td className="p-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                            {s.section_label || s.grade_level || '-'}
                          </td>
                        )}
                        {uniqueDates.map(d => {
                          const st = s.date_records?.[d] || '-';
                          return (
                            <td key={d} className="p-2 text-center border-r border-slate-200 font-bold">
                              <span className={`text-[11px] ${
                                st === 'มา' ? 'text-emerald-600' :
                                st === 'สาย' ? 'text-amber-600' :
                                st === 'ขาด' ? 'text-rose-600' :
                                st === 'ลา' ? 'text-blue-600' : 'text-slate-300'
                              }`}>
                                {st}
                              </span>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center text-emerald-700 font-bold border-r border-slate-200">{s.present}</td>
                        <td className="p-2 text-center text-amber-700 font-bold border-r border-slate-200">{s.late}</td>
                        <td className="p-2 text-center text-rose-700 font-bold border-r border-slate-200">{s.absent}</td>
                        <td className="p-2 text-center text-blue-700 font-bold border-r border-slate-200">{s.leave}</td>
                        <td className="p-2 text-center text-indigo-900 font-extrabold bg-indigo-50/50">{s.attendance_percent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1 flex-wrap gap-2">
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              ไฟล์ CSV เข้ารหัส UTF-8 with BOM รองรับการเปิดอ่านภาษาไทยบน Excel 100%
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {viewMode === 'summary' ? `รวม ${filteredSummary.length} แถว • ${activeCols.length} คอลัมน์` :
               viewMode === 'detailed' ? `รวม ${filteredDetailed.length} รายการ` :
               `รวม ${filteredSummary.length} คน • ${uniqueDates.length} วัน`}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="text-xs text-slate-500">
            โหมดส่งออกปัจจุบัน: <strong className="text-slate-800">{
              viewMode === 'summary' ? 'สรุปสถิติการเข้าเรียนรายบุคคล' :
              viewMode === 'detailed' ? 'บันทึกประวัติเช็คชื่อรายวัน' :
              'ตารางเมทริกซ์สรุปรายวัน'
            }</strong>
            {activeSection && (
              <span className="ml-2 text-emerald-700 font-bold">
                (เฉพาะกลุ่ม {activeSection.label})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl transition-all"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> ยืนยันการส่งออก CSV
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
