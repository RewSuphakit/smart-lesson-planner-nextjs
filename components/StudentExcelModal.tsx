'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, X, Download, Copy, Check, Search, 
  CheckSquare, Square, Eye, Users, FileText, 
  Settings2, TableProperties, Sparkles
} from 'lucide-react';
import toast from '@/lib/toast';
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
  branch?: string | null;
  email?: string;
  classroom_id?: string | number | null;
  avatar?: string | null;
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
    if (!filterClassroomId) return 'à¸—à¸¸à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™';
    return classrooms.find(c => String(c.id) === String(filterClassroomId))?.name || 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™';
  }, [filterClassroomId, classrooms]);

  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
  const [includeHeaderSummary, setIncludeHeaderSummary] = useState(true);

  // Available Column Definitions
  const availableColumns: ColumnOption[] = useMemo(() => [
    {
      id: 'no',
      label: 'à¸¥à¸³à¸”à¸±à¸š',
      defaultChecked: true,
      wch: 8,
      getValue: (_, idx) => idx + 1
    },
    {
      id: 'student_code',
      label: 'à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§',
      defaultChecked: true,
      wch: 16,
      getValue: s => s.student_code || '-'
    },
    {
      id: 'name',
      label: 'à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥',
      defaultChecked: true,
      wch: 28,
      getValue: s => s.name || '-'
    },
    {
      id: 'grade_level',
      label: 'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™',
      defaultChecked: true,
      wch: 16,
      getValue: s => s.grade_level || '-'
    },
    {
      id: 'branch',
      label: 'à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²',
      defaultChecked: true,
      wch: 22,
      getValue: s => s.branch || '-'
    },
    {
      id: 'classroom',
      label: 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™',
      defaultChecked: true,
      wch: 26,
      getValue: (s, _, cls) => cls.find(c => String(c.id) === String(s.classroom_id))?.name || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™'
    },
    {
      id: 'email',
      label: 'à¸­à¸µà¹€à¸¡à¸¥',
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
      const cleanClassName = currentClassName.replace(/[^a-zA-Z0-9à¸-à¹™_-]/g, '_');
      setFileName(`à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™_${cleanClassName}_${todayStr}`);
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
          toast.error('à¸•à¹‰à¸­à¸‡à¹€à¸¥à¸·à¸­à¸à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ');
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

  // â”€â”€â”€ Export Logic â”€â”€â”€
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
      toast.error('à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸­à¸­à¸');
      return;
    }
    if (activeCols.length === 0) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ');
      return;
    }

    try {
      const { headers, rows } = generateExportData();
      const wb = XLSX.utils.book_new();

      const sheetData: (string | number)[][] = [];

      if (includeHeaderSummary) {
        sheetData.push([`à¸£à¸²à¸¢à¸‡à¸²à¸™à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ â€” ${currentClassName}`]);
        sheetData.push([`à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¸“ à¸§à¸±à¸™à¸—à¸µà¹ˆ: ${new Date().toLocaleDateString('th-TH')} | à¸ˆà¸³à¸™à¸§à¸™à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”: ${targetStudents.length} à¸„à¸™`]);
        sheetData.push([]); // Blank separator
      }

      sheetData.push(headers);
      rows.forEach(r => sheetData.push(r));

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths
      ws['!cols'] = activeCols.map(col => ({ wch: col.wch }));

      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Students');
      const finalFileName = `${fileName.trim() || 'à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™'}.xlsx`;

      XLSX.writeFile(wb, finalFileName);
      toast.success(`à¸ªà¹ˆà¸‡à¸­à¸­à¸à¹„à¸Ÿà¸¥à¹Œ Excel à¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${targetStudents.length} à¸„à¸™)`);
      onClose();
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸ªà¹ˆà¸‡à¸­à¸­à¸ Excel');
    }
  };

  // 2. Download .csv
  const handleDownloadCsv = () => {
    if (targetStudents.length === 0) {
      toast.error('à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸­à¸­à¸');
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
      link.setAttribute('download', `${fileName.trim() || 'à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`à¸ªà¹ˆà¸‡à¸­à¸­à¸à¹„à¸Ÿà¸¥à¹Œ CSV à¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${targetStudents.length} à¸„à¸™)`);
      onClose();
    } catch (err) {
      console.error('Export CSV error:', err);
      toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸ªà¹ˆà¸‡à¸­à¸­à¸ CSV');
    }
  };

  // 3. Copy to Clipboard
  const handleCopyClipboard = async () => {
    if (targetStudents.length === 0) {
      toast.error('à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸±à¸”à¸¥à¸­à¸');
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
      toast.success('à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢ (à¸§à¸²à¸‡à¹ƒà¸™ Excel à¸«à¸£à¸·à¸­ Google Sheets à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ)');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸”à¹‰');
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
        className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
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
                à¸žà¸£à¸µà¸§à¸´à¸§à¹à¸¥à¸°à¸à¸³à¸«à¸™à¸”à¸„à¹ˆà¸²à¸à¸²à¸£à¸ªà¹ˆà¸‡à¸­à¸­à¸à¹„à¸Ÿà¸¥à¹Œ Excel
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {targetStudents.length} à¸„à¸™
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸•à¸²à¸£à¸²à¸‡à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ à¹€à¸¥à¸·à¸­à¸à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ à¹à¸¥à¸°à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ Excel (.xlsx) à¸ªà¸³à¸«à¸£à¸±à¸šà¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
              title="à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸›à¸§à¸²à¸‡à¹ƒà¸™ Excel à¸«à¸£à¸·à¸­ Google Sheets"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'à¸„à¸±à¸”à¸¥à¸­à¸à¹à¸¥à¹‰à¸§' : 'à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸‡ Excel'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              title="à¸ªà¹ˆà¸‡à¸­à¸­à¸à¹„à¸Ÿà¸¥à¹Œ CSV à¸žà¸£à¹‰à¸­à¸¡à¸£à¸­à¸‡à¸£à¸±à¸šà¸ à¸²à¸©à¸²à¹„à¸—à¸¢"
            >
              <FileText className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={handleDownloadExcel}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/25 transition-all"
            >
              <Download className="w-4 h-4" /> à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” Excel (.xlsx)
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
                à¸‚à¸­à¸šà¹€à¸‚à¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥:
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
                  à¸•à¸²à¸¡à¸•à¸±à¸§à¸à¸£à¸­à¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ ({currentClassName})
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
                  à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸™à¸£à¸°à¸šà¸š ({students.length} à¸„à¸™)
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
                    à¹€à¸‰à¸žà¸²à¸°à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ ({selectedStudentIds.length} à¸„à¸™)
                  </button>
                )}
              </div>
            </div>

            {/* Quick Column Selection Tools */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">à¹€à¸¥à¸·à¸­à¸ {activeCols.length}/{availableColumns.length} à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ</span>
              <button
                type="button"
                onClick={selectAllColumns}
                className="text-xs font-semibold text-emerald-700 hover:underline px-2 py-0.5"
              >
                à¹€à¸¥à¸·à¸­à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={resetColumns}
                className="text-xs font-semibold text-slate-500 hover:underline px-2 py-0.5"
              >
                à¸£à¸µà¹€à¸‹à¹‡à¸•
              </button>
            </div>
          </div>

          {/* Column Checkboxes */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0 mr-1">
              <TableProperties className="w-3.5 h-3.5 text-emerald-600" />
              à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ:
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
              <label className="font-semibold text-slate-600 shrink-0">à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ:</label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="form-input text-xs py-1 px-2.5 bg-white border-slate-300 rounded-lg flex-1"
                placeholder="à¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ..."
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
                <span>à¹ƒà¸ªà¹ˆà¸«à¸±à¸§à¹€à¸­à¸à¸ªà¸²à¸£à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¹ƒà¸™à¹„à¸Ÿà¸¥à¹Œ Excel</span>
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
                à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸«à¸™à¹‰à¸²à¸•à¸²à¸•à¸²à¸£à¸²à¸‡ Excel à¹€à¸ªà¸¡à¸·à¸­à¸™à¸ˆà¸£à¸´à¸‡ (Live Spreadsheet Preview)
              </span>
              <span className="text-[11px] text-slate-400">
                (à¹à¸ªà¸”à¸‡ {previewStudents.length} à¸£à¸²à¸¢à¸à¸²à¸£)
              </span>
            </div>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchPreview}
                onChange={e => setSearchPreview(e.target.value)}
                placeholder="à¸„à¹‰à¸™à¸«à¸²à¹ƒà¸™à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡..."
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
                      à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸à¸²à¸£à¸„à¹‰à¸™à¸«à¸²
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
              à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸ˆà¸°à¸›à¸£à¸±à¸šà¸„à¸§à¸²à¸¡à¸à¸§à¹‰à¸²à¸‡à¸‚à¸­à¸‡à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸•à¸²à¸¡à¹€à¸™à¸·à¹‰à¸­à¸«à¸²à¸ à¸²à¸©à¸²à¹„à¸—à¸¢
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              à¸£à¸§à¸¡ {targetStudents.length} à¹à¸–à¸§ â€¢ {activeCols.length} à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            à¸£à¸¹à¸›à¹à¸šà¸šà¹€à¸­à¸à¸ªà¸²à¸£: <strong className="text-slate-700">Microsoft Excel Spreadsheet (.xlsx)</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl transition-all"
            >
              à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” Excel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
