'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, X, Download, Copy, Check, Search, 
  CheckSquare, Square, Eye, Users, FileText, 
  Settings2, TableProperties, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export interface Classroom {
  id: string | number;
  name: string;
}

export interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  grade_level?: string;
  email?: string;
  classroom_id?: string | number | null;
}

interface StudentExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classrooms: Classroom[];
  filterClassroomId?: string;
  selectedStudentIds?: Array<string | number>;
}

interface ColumnOption {
  id: string;
  label: string;
  defaultChecked: boolean;
  wch: number; // Width in characters for Excel
  getValue: (s: Student, index: number, classrooms: Classroom[]) => string | number;
}

export default function StudentExcelModal({
  isOpen,
  onClose,
  students,
  classrooms,
  filterClassroomId = '',
  selectedStudentIds = [],
}: StudentExcelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchPreview, setSearchPreview] = useState('');
  
  // Scope of export: 'current_filter' | 'all' | 'selected_only'
  const [exportScope, setExportScope] = useState<'current_filter' | 'all' | 'selected_only'>(
    selectedStudentIds.length > 0 ? 'selected_only' : 'current_filter'
  );

  // File customization
  const currentClassName = useMemo(() => {
    if (!filterClassroomId) return 'ทุกห้องเรียน';
    return classrooms.find(c => String(c.id) === String(filterClassroomId))?.name || 'ห้องเรียน';
  }, [filterClassroomId, classrooms]);

  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('รายชื่อนักเรียน');
  const [includeHeaderSummary, setIncludeHeaderSummary] = useState(true);

  // Available Column Definitions
  const availableColumns: ColumnOption[] = useMemo(() => [
    {
      id: 'no',
      label: 'ลำดับ',
      defaultChecked: true,
      wch: 8,
      getValue: (_, idx) => idx + 1
    },
    {
      id: 'student_code',
      label: 'รหัสประจำตัว',
      defaultChecked: true,
      wch: 16,
      getValue: s => s.student_code || '-'
    },
    {
      id: 'name',
      label: 'ชื่อ-นามสกุล',
      defaultChecked: true,
      wch: 28,
      getValue: s => s.name || '-'
    },
    {
      id: 'grade_level',
      label: 'ระดับชั้น',
      defaultChecked: true,
      wch: 16,
      getValue: s => s.grade_level || '-'
    },
    {
      id: 'classroom',
      label: 'ห้องเรียน / สาขาวิชา',
      defaultChecked: true,
      wch: 26,
      getValue: (s, _, cls) => cls.find(c => String(c.id) === String(s.classroom_id))?.name || 'ไม่ระบุห้องเรียน'
    },
    {
      id: 'email',
      label: 'อีเมล',
      defaultChecked: true,
      wch: 28,
      getValue: s => s.email || '-'
    },
  ], []);

  // Selected column IDs
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(
    availableColumns.filter(c => c.defaultChecked).map(c => c.id)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync default file name when filter changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];
      const cleanClassName = currentClassName.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
      setFileName(`รายชื่อนักเรียน_${cleanClassName}_${todayStr}`);
      if (selectedStudentIds.length > 0) {
        setExportScope('selected_only');
      } else {
        setExportScope('current_filter');
      }
    }
  }, [isOpen, currentClassName, selectedStudentIds.length]);

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

  // Filtered dataset according to selected scope
  const targetStudents = useMemo(() => {
    let list: Student[] = [];
    if (exportScope === 'selected_only') {
      const idSet = new Set(selectedStudentIds.map(String));
      list = students.filter(s => idSet.has(String(s.id)));
    } else if (exportScope === 'all') {
      list = [...students];
    } else {
      // current_filter
      if (filterClassroomId) {
        list = students.filter(s => String(s.classroom_id) === String(filterClassroomId));
      } else {
        list = [...students];
      }
    }
    return list;
  }, [exportScope, selectedStudentIds, students, filterClassroomId]);

  // Preview filtered students for search
  const previewStudents = useMemo(() => {
    if (!searchPreview.trim()) return targetStudents;
    const q = searchPreview.toLowerCase();
    return targetStudents.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.student_code && s.student_code.toLowerCase().includes(q)) ||
      (s.grade_level && s.grade_level.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [targetStudents, searchPreview]);

  // Active columns
  const activeCols = useMemo(() => {
    return availableColumns.filter(c => selectedColumnIds.includes(c.id));
  }, [availableColumns, selectedColumnIds]);

  const toggleColumn = (colId: string) => {
    setSelectedColumnIds(prev => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) {
          toast.error('ต้องเลือกอย่างน้อย 1 คอลัมน์');
          return prev;
        }
        return prev.filter(id => id !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(availableColumns.map(c => c.id));
  };

  const resetColumns = () => {
    setSelectedColumnIds(availableColumns.filter(c => c.defaultChecked).map(c => c.id));
  };

  // ─── Export Logic ───
  const generateExportData = () => {
    const headers = activeCols.map(c => c.label);
    const rows = targetStudents.map((s, idx) => {
      return activeCols.map(col => col.getValue(s, idx, classrooms));
    });
    return { headers, rows };
  };

  // 1. Download .xlsx
  const handleDownloadExcel = () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
      return;
    }
    if (activeCols.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 คอลัมน์');
      return;
    }

    try {
      const { headers, rows } = generateExportData();
      const wb = XLSX.utils.book_new();

      let sheetData: (string | number)[][] = [];

      if (includeHeaderSummary) {
        sheetData.push([`รายงานรายชื่อนักเรียน — ${currentClassName}`]);
        sheetData.push([`ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')} | จำนวนนักเรียนทั้งหมด: ${targetStudents.length} คน`]);
        sheetData.push([]); // Blank separator
      }

      sheetData.push(headers);
      rows.forEach(r => sheetData.push(r));

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths
      ws['!cols'] = activeCols.map(col => ({ wch: col.wch }));

      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Students');
      const finalFileName = `${fileName.trim() || 'รายชื่อนักเรียน'}.xlsx`;

      XLSX.writeFile(wb, finalFileName);
      toast.success(`ส่งออกไฟล์ Excel สำเร็จ (${targetStudents.length} คน)`);
      onClose();
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งออก Excel');
    }
  };

  // 2. Download .csv
  const handleDownloadCsv = () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
      return;
    }

    try {
      const { headers, rows } = generateExportData();
      const csvLines = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ];

      // UTF-8 BOM for Thai support in Microsoft Excel
      const csvContent = '\uFEFF' + csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName.trim() || 'รายชื่อนักเรียน'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`ส่งออกไฟล์ CSV สำเร็จ (${targetStudents.length} คน)`);
      onClose();
    } catch (err) {
      console.error('Export CSV error:', err);
      toast.error('เกิดข้อผิดพลาดในการส่งออก CSV');
    }
  };

  // 3. Copy to Clipboard
  const handleCopyClipboard = async () => {
    if (targetStudents.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับคัดลอก');
      return;
    }

    try {
      const { headers, rows } = generateExportData();
      // Tab-separated for direct paste into Excel or Google Sheets
      const tsvContent = [
        headers.join('\t'),
        ...rows.map(r => r.join('\t'))
      ].join('\n');

      await navigator.clipboard.writeText(tsvContent);
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
        className="bg-slate-50 rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                พรีวิวและกำหนดค่าการส่งออกไฟล์ Excel
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {targetStudents.length} คน
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                ตรวจสอบตารางตัวอย่าง เลือกคอลัมน์ และดาวน์โหลดไฟล์ Excel (.xlsx) สำหรับใช้งานได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
              title="คัดลอกข้อมูลไปวางใน Excel หรือ Google Sheets"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลง Excel'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              title="ส่งออกไฟล์ CSV พร้อมรองรับภาษาไทย"
            >
              <FileText className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={handleDownloadExcel}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/25 transition-all"
            >
              <Download className="w-4 h-4" /> ดาวน์โหลด Excel (.xlsx)
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: Scope & Columns */}
        <div className="p-4 bg-white border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Scope Selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                ขอบเขตข้อมูล:
              </span>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium border border-slate-200">
                <button
                  type="button"
                  onClick={() => setExportScope('current_filter')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    exportScope === 'current_filter'
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ตามตัวกรองปัจจุบัน ({currentClassName})
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    exportScope === 'all'
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมดในระบบ ({students.length} คน)
                </button>
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExportScope('selected_only')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      exportScope === 'selected_only'
                        ? 'bg-white text-emerald-800 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    เฉพาะที่เลือก ({selectedStudentIds.length} คน)
                  </button>
                )}
              </div>
            </div>

            {/* Quick Column Selection Tools */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">เลือก {activeCols.length}/{availableColumns.length} คอลัมน์</span>
              <button
                type="button"
                onClick={selectAllColumns}
                className="text-xs font-semibold text-emerald-700 hover:underline px-2 py-0.5"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={resetColumns}
                className="text-xs font-semibold text-slate-500 hover:underline px-2 py-0.5"
              >
                รีเซ็ต
              </button>
            </div>
          </div>

          {/* Column Checkboxes */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0 mr-1">
              <TableProperties className="w-3.5 h-3.5 text-emerald-600" />
              คอลัมน์:
            </span>
            {availableColumns.map(col => {
              const isChecked = selectedColumnIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleColumn(col.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isChecked
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{col.label}</span>
                </button>
              );
            })}
          </div>

          {/* Optional: File Name & Settings Customization */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <label className="font-semibold text-slate-600 shrink-0">ชื่อไฟล์:</label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="form-input text-xs py-1 px-2.5 bg-white border-slate-300 rounded-lg flex-1"
                placeholder="ระบุชื่อไฟล์..."
              />
              <span className="text-slate-400 font-mono">.xlsx</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={includeHeaderSummary}
                  onChange={e => setIncludeHeaderSummary(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>ใส่หัวเอกสารและวันที่ในไฟล์ Excel</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Section (Excel Spreadsheet Styled) */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-100/70">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" />
                ตัวอย่างหน้าตาตาราง Excel เสมือนจริง (Live Spreadsheet Preview)
              </span>
              <span className="text-[11px] text-slate-400">
                (แสดง {previewStudents.length} รายการ)
              </span>
            </div>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchPreview}
                onChange={e => setSearchPreview(e.target.value)}
                placeholder="ค้นหาในตัวอย่าง..."
                className="form-input text-xs pl-8 py-1 bg-white border-slate-300 rounded-lg w-full"
              />
            </div>
          </div>

          {/* Spreadsheet Container */}
          <div className="flex-1 overflow-auto rounded-xl border border-slate-300 bg-white shadow-inner">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="sticky top-0 bg-emerald-50/90 backdrop-blur-sm z-10 border-b-2 border-emerald-300">
                <tr>
                  {/* Excel row header indicator */}
                  <th className="p-2 w-10 text-center font-bold text-slate-400 bg-slate-100 border-r border-slate-300 select-none">
                    #
                  </th>
                  {activeCols.map((col, idx) => (
                    <th
                      key={col.id}
                      className="p-2.5 font-bold text-slate-700 border-r border-slate-200"
                    >
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
                {previewStudents.length === 0 ? (
                  <tr>
                    <td colSpan={activeCols.length + 1} className="p-8 text-center text-slate-400">
                      ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  previewStudents.map((student, rIdx) => (
                    <tr 
                      key={student.id} 
                      className={`border-b border-slate-200 transition-colors ${
                        rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                      } hover:bg-emerald-50/40`}
                    >
                      {/* Excel row number */}
                      <td className="p-2 text-center text-slate-400 font-mono text-[10px] bg-slate-50 border-r border-slate-300 select-none">
                        {rIdx + 1}
                      </td>
                      {activeCols.map(col => {
                        const val = col.getValue(student, rIdx, classrooms);
                        const isNo = col.id === 'no';
                        const isCode = col.id === 'student_code';
                        const isName = col.id === 'name';

                        return (
                          <td
                            key={col.id}
                            className={`p-2.5 border-r border-slate-200 ${
                              isNo ? 'text-center font-mono text-slate-500' :
                              isCode ? 'font-mono text-slate-700 font-semibold' :
                              isName ? 'font-semibold text-slate-800' :
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
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              ไฟล์ที่ดาวน์โหลดจะปรับความกว้างของคอลัมน์อัตโนมัติตามเนื้อหาภาษาไทย
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              รวม {targetStudents.length} แถว • {activeCols.length} คอลัมน์
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            รูปแบบเอกสาร: <strong className="text-slate-700">Microsoft Excel Spreadsheet (.xlsx)</strong>
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
              onClick={handleDownloadExcel}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> ยืนยันการดาวน์โหลด Excel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
