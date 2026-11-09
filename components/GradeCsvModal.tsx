'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, X, Download, Copy, Check, Filter, Search, 
  CheckSquare, Square, Eye, FileText, ArrowUpDown
} from 'lucide-react';
import toast from '@/lib/toast';

import type { Classroom, ReportStudent, Weights } from '@/components/pages/Grades';

interface GradeCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: Classroom | null;
  report: ReportStudent[];
  weights: Weights;
}

interface ColumnOption {
  id: string;
  label: string;
  defaultChecked: boolean;
  getValue: (s: ReportStudent, w: Weights, isPws: boolean) => string | number;
}

export default function GradeCsvModal({
  isOpen,
  onClose,
  classroom,
  report,
  weights,
}: GradeCsvModalProps) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const isPws: boolean = useMemo(() => {
    return Boolean(weights.is_pws || classroom?.name?.includes('à¸›à¸§à¸ª') || classroom?.name?.includes('à¸›à¸§à¸ª.'));
  }, [weights, classroom]);

  // Define available CSV columns
  const availableColumns: ColumnOption[] = useMemo(() => [
    {
      id: 'student_code',
      label: 'à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§',
      defaultChecked: true,
      getValue: s => s.student_code || '-'
    },
    {
      id: 'name',
      label: 'à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥',
      defaultChecked: true,
      getValue: s => s.name
    },
    {
      id: 'affective',
      label: `à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (${weights.affective_weight}%)`,
      defaultChecked: true,
      getValue: s => Number(s.affective_score || 0).toFixed(1)
    },
    {
      id: 'post_scaled',
      label: `à¸ªà¸­à¸šà¸¢à¹ˆà¸­à¸¢ (${weights.post_test_weight}%)`,
      defaultChecked: true,
      getValue: s => Number(s.precise_scaled_post_test || s.scaled_post_test || 0).toFixed(1)
    },
    {
      id: 'post_raw',
      label: `à¸ªà¸­à¸šà¸¢à¹ˆà¸­à¸¢à¸”à¸´à¸š (à¹€à¸•à¹‡à¸¡ ${weights.max_post_test_raw || (isPws ? 150 : 180)})`,
      defaultChecked: true,
      getValue: s => Number(s.raw_post_test || 0).toFixed(1)
    },
    {
      id: 'assign_scaled',
      label: `à¸‡à¸²à¸™à¹€à¸à¹‡à¸š (${weights.assignment_weight}%)`,
      defaultChecked: true,
      getValue: s => Number(s.precise_scaled_assign || s.scaled_assign || 0).toFixed(1)
    },
    {
      id: 'assign_raw',
      label: `à¸‡à¸²à¸™à¹€à¸à¹‡à¸šà¸”à¸´à¸š (à¹€à¸•à¹‡à¸¡ ${weights.max_assign_raw || (isPws ? 150 : 180)})`,
      defaultChecked: true,
      getValue: s => Number(s.raw_assign || 0).toFixed(1)
    },
    {
      id: 'midterm',
      label: `à¸à¸¥à¸²à¸‡à¸ à¸²à¸„ (${weights.midterm_weight}%)`,
      defaultChecked: weights.midterm_weight > 0,
      getValue: s => Number(s.precise_scaled_midterm || s.scaled_midterm || 0).toFixed(1)
    },
    {
      id: 'final',
      label: `à¸›à¸¥à¸²à¸¢à¸ à¸²à¸„ (${weights.final_weight}%)`,
      defaultChecked: true,
      getValue: s => s.is_absent_final ? 'à¸‚.à¸ª.' : s.is_incomplete ? 'à¸¡.à¸ª.' : Number(s.precise_scaled_final || s.scaled_final || 0).toFixed(1)
    },
    {
      id: 'total_score',
      label: 'à¸£à¸§à¸¡à¸„à¸°à¹à¸™à¸™ (100)',
      defaultChecked: true,
      getValue: s => (s.is_absent_final || s.is_incomplete) ? '-' : Number(s.total_score_precise ?? s.total_score ?? 0).toFixed(1)
    },
    {
      id: 'attendance',
      label: 'à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ (%)',
      defaultChecked: true,
      getValue: s => `${s.attendance_percent ?? 100}%`
    },
    {
      id: 'grade',
      label: 'à¸£à¸°à¸”à¸±à¸šà¹€à¸à¸£à¸”',
      defaultChecked: true,
      getValue: s => s.grade || '-'
    }
  ], [weights, isPws]);

  // Selected column IDs
  const [selectedColIds, setSelectedColIds] = useState<string[]>(() => 
    availableColumns.filter(c => c.defaultChecked).map(c => c.id)
  );

  const activeColumns = useMemo(() => {
    return availableColumns.filter(c => selectedColIds.includes(c.id));
  }, [availableColumns, selectedColIds]);

  const toggleColumn = (id: string) => {
    setSelectedColIds(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(c => c !== id) : prev) 
        : [...prev, id]
    );
  };

  const selectAllColumns = () => {
    setSelectedColIds(availableColumns.map(c => c.id));
  };

  const selectStandardColumns = () => {
    setSelectedColIds(['student_code', 'name', 'assign_scaled', 'post_scaled', 'midterm', 'final', 'affective', 'total_score', 'grade']);
  };

  // Filtered Students
  const filteredReport = useMemo(() => {
    if (!searchQuery.trim()) return report;
    const q = searchQuery.toLowerCase();
    return report.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.student_code && s.student_code.toLowerCase().includes(q)) ||
      (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [report, searchQuery]);

  // Generate CSV text string
  const generateCsvContent = () => {
    const headers = activeColumns.map(c => `"${c.label}"`);
    const rows = report.map(student => {
      return activeColumns.map(col => {
        const val = col.getValue(student, weights, isPws);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    // Add UTF-8 BOM for Excel Thai language support
    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  };

  // Download CSV file
  const handleDownloadCsv = () => {
    const csvContent = generateCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const className = classroom?.name ? classroom.name.replace(/[^a-zA-Z0-9à¸-à¹™_-]/g, '_') : 'Classroom';
    link.setAttribute('download', `à¸•à¸²à¸£à¸²à¸‡à¸„à¸°à¹à¸™à¸™_${className}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ CSV à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§');
  };

  // Copy CSV to Clipboard
  const handleCopyClipboard = async () => {
    try {
      const headers = activeColumns.map(c => c.label).join('\t');
      const rows = report.map(student => {
        return activeColumns.map(col => col.getValue(student, weights, isPws)).join('\t');
      }).join('\n');

      const fullText = `${headers}\n${rows}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success('à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¸‡ Clipboard à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢ (à¸ªà¸²à¸¡à¸²à¸£à¸–à¸§à¸²à¸‡à¹ƒà¸™ Excel à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ)');
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
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                à¸žà¸£à¸µà¸§à¸´à¸§à¹à¸¥à¸°à¹€à¸¥à¸·à¸­à¸à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸ªà¹ˆà¸‡à¸­à¸­à¸ CSV (Excel)
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {report.length} à¸„à¸™
                </span>
              </h2>
              <p className="text-xs text-slate-500">à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸•à¸²à¸£à¸²à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¹€à¸¥à¸·à¸­à¸à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£ à¹à¸¥à¸°à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ CSV à¸ªà¸³à¸«à¸£à¸±à¸šà¹€à¸›à¸´à¸”à¹ƒà¸™ Microsoft Excel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'à¸„à¸±à¸”à¸¥à¸­à¸à¹à¸¥à¹‰à¸§' : 'à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸‡ Excel'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/25 transition-all"
            >
              <Download className="w-4 h-4" /> à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Column Checkboxes Control Bar */}
        <div className="p-4 bg-white border-b border-slate-200 shrink-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> à¹€à¸¥à¸·à¸­à¸à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸—à¸µà¹ˆà¸ˆà¸° Export ({activeColumns.length}/{availableColumns.length}):
              </span>
              <button
                onClick={selectAllColumns}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                à¹€à¸¥à¸·à¸­à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={selectStandardColumns}
                className="text-[11px] text-slate-600 hover:underline font-medium"
              >
                à¹€à¸‰à¸žà¸²à¸°à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸¡à¸²à¸•à¸£à¸à¸²à¸™
              </button>
            </div>

            {/* In-table Search */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­ à¸«à¸£à¸·à¸­ à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²..."
                className="form-input text-xs pl-8 py-1 w-full bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {availableColumns.map(col => {
              const isChecked = selectedColIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleColumn(col.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                    isChecked
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isChecked ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <Square className="w-3 h-3 text-slate-300" />}
                  {col.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Data Table Preview */}
        <div className="flex-1 overflow-auto p-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-2.5 w-12 text-center">à¸¥à¸³à¸”à¸±à¸š</th>
                  {activeColumns.map(col => (
                    <th key={col.id} className="p-2.5 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReport.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="p-8 text-center text-slate-400">
                      à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¸„à¸³à¸„à¹‰à¸™à¸«à¸²
                    </td>
                  </tr>
                ) : (
                  filteredReport.map((student, idx) => {
                    return (
                      <tr
                        key={student.student_id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        {activeColumns.map(col => {
                          const val = col.getValue(student, weights, isPws);
                          const isGrade = col.id === 'grade';
                          const isName = col.id === 'name';
                          return (
                            <td 
                              key={col.id} 
                              className={`p-2 whitespace-nowrap ${
                                isGrade ? 'font-extrabold text-indigo-700' : isName ? 'font-medium text-slate-800' : 'text-slate-600'
                              }`}
                            >
                              {val}
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
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>à¹à¸ªà¸”à¸‡à¸œà¸¥ <strong className="text-slate-800">{filteredReport.length}</strong> à¸ˆà¸²à¸ {report.length} à¹à¸–à¸§</span>
            <span className="text-slate-300">â€¢</span>
            <span>à¸£à¸¹à¸›à¹à¸šà¸š: <strong className="text-slate-800">CSV (UTF-8 with BOM)</strong> à¸£à¸­à¸‡à¸£à¸±à¸š Excel 100%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-1.5 rounded-xl"
            >
              à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡
            </button>
            <button
              onClick={handleDownloadCsv}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” CSV
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
