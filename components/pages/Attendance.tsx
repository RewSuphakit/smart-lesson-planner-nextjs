'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import { 
  Loader2, Users, Save, Calendar as CalendarIcon, CheckCircle, Clock, XCircle, 
  FileText, AlertCircle, X, History, Trash2, Download, ChevronLeft, ChevronRight, 
  Search, Check, Grid, List, RefreshCw, Sparkles, Filter, ArrowRight, RotateCcw,
  FileSpreadsheet, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import AttendanceCsvModal from '@/components/AttendanceCsvModal';
import AttendanceImportModal from '@/components/AttendanceImportModal';

import { getThaiHolidays, checkThaiHoliday, HolidayInfo } from '@/lib/thaiHolidays';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const getSchemaDayOfWeek = (dateStr: string): number => {
  const jsDay = new Date(dateStr).getDay();
  return (jsDay + 6) % 7; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
};

interface MemoizedAttendanceCellProps {
  status: string | null;
  isEditing: boolean;
  onEditClick: () => void;
  onStatusSelect: (status: string) => void;
  onDeleteClick?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  holiday?: HolidayInfo | null;
}

const MemoizedAttendanceCell = memo(({ status, isEditing, onEditClick, onStatusSelect, onDeleteClick, popoverRef, holiday }: MemoizedAttendanceCellProps) => {
  const isGovHoliday = holiday?.type === 'government';
  const isWeekend = holiday?.type === 'weekend';

  return (
    <td className={`p-2 border-r border-indigo-100/40 text-center relative h-14 min-w-[80px] transition-colors ${
      isGovHoliday ? 'bg-amber-50/40' : isWeekend ? 'bg-slate-50/50' : ''
    }`}>
      {!status ? (
        <button 
          onClick={onEditClick}
          className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto transition-all text-xs font-semibold touch-manipulation ${
            isGovHoliday
              ? 'border-amber-300 bg-amber-100/80 text-amber-800 hover:bg-amber-200 hover:border-amber-400 shadow-sm'
              : isWeekend
              ? 'border-slate-200 bg-slate-100/80 text-slate-400 hover:bg-slate-200'
              : 'border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
          }`}
          title={holiday ? `วันหยุด: ${holiday.name} (คลิกเพื่อลงชื่อย้อนหลัง)` : 'คลิกเพื่อลงชื่อย้อนหลัง'}
        >
          {isGovHoliday ? '🏖️' : '+'}
        </button>
      ) : (
        <button
          onClick={onEditClick}
          className={`w-14 py-1.5 rounded-xl text-[10px] font-bold mx-auto flex items-center justify-center border transition-all hover:scale-105 touch-manipulation ${
            status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' :
            status === 'late' ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' :
            status === 'absent' ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' :
            'bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100'
          }`}
        >
          {status === 'present' ? 'มา' : status === 'late' ? 'สาย' : status === 'absent' ? 'ขาด' : 'ลา'}
        </button>
      )}

      {isEditing && (
        <div 
          ref={popoverRef}
          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white p-2 rounded-xl border border-indigo-100 shadow-xl flex items-center gap-1.5 animate-scale-up"
        >
          <button 
            onClick={() => onStatusSelect('present')}
            className="w-7 h-7 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center justify-center hover:bg-emerald-600 shadow-sm touch-manipulation"
            title="มาเรียน"
          >
            มา
          </button>
          <button 
            onClick={() => onStatusSelect('late')}
            className="w-7 h-7 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center justify-center hover:bg-amber-600 shadow-sm touch-manipulation"
            title="สาย"
          >
            สาย
          </button>
          <button 
            onClick={() => onStatusSelect('absent')}
            className="w-7 h-7 rounded-lg bg-red-500 text-white font-bold text-xs flex items-center justify-center hover:bg-red-600 shadow-sm touch-manipulation"
            title="ขาด"
          >
            ขาด
          </button>
          <button 
            onClick={() => onStatusSelect('leave')}
            className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center hover:bg-blue-600 shadow-sm touch-manipulation"
            title="ลา"
          >
            ลา
          </button>
          {status && onDeleteClick && (
            <button 
              onClick={onDeleteClick}
              className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs flex items-center justify-center border border-red-200 shadow-sm touch-manipulation"
              title="ลบ/ยกเลิกการเช็คชื่อช่องนี้"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </td>
  );
});

MemoizedAttendanceCell.displayName = 'MemoizedAttendanceCell';

interface ThaiDateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  matrixDatesCount: number;
}

const ThaiDateRangePicker = memo(({ startDate, endDate, onChange, matrixDatesCount }: ThaiDateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [pickingStep, setPickingStep] = useState<'start' | 'end'>('start');

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = window.innerWidth < 640 ? 320 : 360;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(16, left)
      });
    }
  }, []);

  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
  }, [startDate, endDate, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const formatShortThai = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const yearBE = d.getFullYear() + 543;
    return `${day} ${month} ${yearBE}`;
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleDateClick = (dayNum: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${viewYear}-${monthStr}-${dayStr}`;

    if (pickingStep === 'start' || !draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd('');
      setPickingStep('end');
    } else {
      if (dateStr < draftStart) {
        setDraftStart(dateStr);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(dateStr);
      }
      setPickingStep('start');
    }
  };

  const isSelectedStart = (dayNum: number) => {
    if (!draftStart) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    return draftStart === `${viewYear}-${monthStr}-${dayStr}`;
  };

  const isSelectedEnd = (dayNum: number) => {
    if (!draftEnd) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    return draftEnd === `${viewYear}-${monthStr}-${dayStr}`;
  };

  const isInRange = (dayNum: number) => {
    if (!draftStart || !draftEnd) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
    return dateStr >= draftStart && dateStr <= draftEnd;
  };

  const handlePresetSelect = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toISOString().split('T')[0];
    setDraftStart(start);
    setDraftEnd(end);
  };

  const handleApply = () => {
    onChange(draftStart, draftEnd);
    setIsOpen(false);
  };

  const isPresetActive = (days: number) => {
    if (!draftStart || !draftEnd) return false;
    const end = new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toISOString().split('T')[0];
    return draftStart === start && draftEnd === end;
  };

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-indigo-100/90 shadow-md hover:shadow-lg shadow-indigo-500/5 transition-all duration-200 cursor-pointer select-none"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <CalendarIcon className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500">ช่วงวันที่แสดงผล</span>
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            {startDate ? formatShortThai(startDate) : 'ทั้งหมด'}
            <span className="text-slate-400">→</span>
            {endDate ? formatShortThai(endDate) : 'ปัจจุบัน'}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-90 text-indigo-600' : ''}`} />
      </button>

      {/* Thai Calendar Popover via Portal */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          className="fixed z-[9999] w-[320px] sm:w-[360px] bg-white/98 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-indigo-100 shadow-2xl shadow-indigo-500/20 animate-scale-up text-slate-800"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="font-extrabold text-slate-800 text-sm sm:text-base">
                {thaiMonths[viewMonth]} {viewYear + 543}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Presets Pills */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => handlePresetSelect(days)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  isPresetActive(days)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {days} วัน
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                setDraftStart(firstDay);
                setDraftEnd(now.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 transition-all"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftStart('');
                setDraftEnd('');
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              ทั้งหมด
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[11px] text-slate-500 mb-2">
            <span className="text-rose-500">อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span className="text-indigo-500">ส</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="h-8 sm:h-9" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isStart = isSelectedStart(dayNum);
              const isEnd = isSelectedEnd(dayNum);
              const inRange = isInRange(dayNum);

              const monthStr = String(viewMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
              const dayHoliday = checkThaiHoliday(dateStr);

              let bgClass = 'hover:bg-indigo-50 text-slate-700';
              if (isStart || isEnd) {
                bgClass = 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black shadow-md shadow-indigo-500/30 rounded-xl';
              } else if (inRange) {
                bgClass = 'bg-indigo-100/80 text-indigo-800 font-bold rounded-lg';
              } else if (dayHoliday?.type === 'government') {
                bgClass = 'bg-amber-50 text-amber-900 font-bold hover:bg-amber-100 border border-amber-200/60';
              }

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleDateClick(dayNum)}
                  title={dayHoliday ? dayHoliday.name : undefined}
                  className={`h-8 sm:h-9 text-xs font-semibold rounded-xl flex flex-col items-center justify-center transition-all duration-150 relative ${bgClass}`}
                >
                  <span>{dayNum}</span>
                  {dayHoliday?.type === 'government' && !isStart && !isEnd && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute bottom-1"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover Footer Actions */}
          <div className="mt-4 pt-3 border-t border-indigo-50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[170px]">
              {draftStart ? formatShortThai(draftStart) : 'ทั้งหมด'} {draftEnd ? `→ ${formatShortThai(draftEnd)}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

ThaiDateRangePicker.displayName = 'ThaiDateRangePicker';

interface TimetableEntry {
  id: number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  subject_name?: string;
  subject_code?: string;
  room?: string;
  group_name?: string;
  classroom_id?: number;
  hours: number;
  entry_type: string;
}

interface Classroom {
  id: string;
  name: string;
  total_classes?: number;
  min_attendance_percent?: number;
  late_to_absent_ratio?: number;
  leave_to_absent_ratio?: number;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
  semester_start_date?: string | null;
  semester_end_date?: string | null;
  current_week?: number | null;
}

interface SemesterWeek {
  week: number;
  start: string;
  end: string;
  isCurrent: boolean;
}

interface SemesterInfo {
  classroomId: number;
  curriculumType: 'pvch' | 'pvs' | 'custom';
  totalWeeks: number;
  semesterStartDate: string | null;
  semesterEndDate: string | null;
  currentWeek: number | null;
  isSemesterActive: boolean;
  weeks: SemesterWeek[];
}

interface Student {
  id: string;
  student_code?: string;
  name: string;
  classroom_id: string;
  email?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
}

interface StudentStats {
  student_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  converted_absent_count: number;
  remaining_late_count: number;
  remaining_leave_count: number;
  is_f?: boolean;
}

export default function Attendance() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-Save state
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendance_autosave');
      return saved !== 'false';
    }
    return true;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync autoSave choice to localStorage
  useEffect(() => {
    localStorage.setItem('attendance_autosave', String(autoSave));
  }, [autoSave]);

  const renderAutoSaveStatus = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>กำลังบันทึกอัตโนมัติ...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold animate-all">
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกสำเร็จ</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>บันทึกไม่สำเร็จ</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute duration-1000 inline-flex" style={{ width: '6px', height: '6px' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative" style={{ width: '6px', height: '6px' }}></div>
            <span>บันทึกอัตโนมัติพร้อมใช้งาน</span>
          </div>
        );
    }
  };

  // Tabs state
  const [activeTab, setActiveTab] = useState<'daily' | 'matrix'>('daily');
  
  // Matrix history grid state
  const [matrixStartDate, setMatrixStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default to last 14 days
    return d.toISOString().split('T')[0];
  });
  const [matrixEndDate, setMatrixEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matrixEditingCell, setMatrixEditingCell] = useState<{ studentId: string; date: string } | null>(null);
  
  // History Modal state
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  
  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // ─── Retroactive Attendance Modal State ───
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);
  const [retroactiveTab, setRetroactiveTab] = useState<'weeks' | 'calendar'>('weeks');
  const [customRetroDate, setCustomRetroDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

  const cellPopoverRef = useRef<HTMLDivElement>(null);

  // ─── Query: ดึงข้อมูลห้องเรียน (shared cache) ───
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    }
  });

  // ─── Query: ข้อมูลภาคเรียนและสัปดาห์ (Semester Info) ───
  const { data: semesterInfo } = useQuery<SemesterInfo>({
    queryKey: ['semester-info', selectedClass],
    queryFn: async () => {
      const res = await api.get(`/semester?classroom_id=${selectedClass}`);
      return res.data.data;
    },
    enabled: !!selectedClass
  });

  // ─── Query: ดึงข้อมูลตารางเรียนทั้งหมด (All Timetable Entries) ───
  const { data: allTimetableEntries = [] } = useQuery<TimetableEntry[]>({
    queryKey: ['timetable-all'],
    queryFn: async () => {
      const res = await api.get('/timetable');
      return res.data.data?.entries || [];
    }
  });

  const todayEntries = useMemo(() => {
    const jsDay = new Date().getDay();
    const schemaDayOfWeek = (jsDay + 6) % 7;
    return allTimetableEntries.filter(e => e.day_of_week === schemaDayOfWeek);
  }, [allTimetableEntries]);

  // ─── State: วันที่มีการสอนของห้องเรียนนี้ (0=Mon .. 6=Sun) ───
  const [teachingDays, setTeachingDays] = useState<number[]>([0, 1, 2, 3, 4]);

  useEffect(() => {
    if (!selectedClass) return;
    const classEntries = allTimetableEntries.filter(
      e => String(e.classroom_id) === String(selectedClass)
    );
    const timetableDays = Array.from(new Set(classEntries.map(e => e.day_of_week)));

    if (timetableDays.length > 0) {
      setTeachingDays(timetableDays.sort((a, b) => a - b));
    } else {
      setTeachingDays([0, 1, 2, 3, 4]);
    }
  }, [selectedClass, allTimetableEntries]);

  // ─── Query: ดึงข้อมูลการเช็คชื่อวันนี้ + นักเรียน + สถิติ ───
  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-data', selectedClass, date],
    queryFn: async () => {
      const [stuRes, attRes, statsRes] = await Promise.all([
        api.get(`/students?classroom_id=${selectedClass}`),
        api.get(`/attendance?classroom_id=${selectedClass}&date=${date}`),
        api.get(`/attendance?classroom_id=${selectedClass}`)
      ]);
      
      const classStudents = stuRes.data.data || [];
      const existing = attRes.data.data || [];
      
      const newAtt: Record<string, string> = {};
      classStudents.forEach((s: Student) => {
        const found = existing.find((e: { student_id: string | number }) => String(e.student_id) === String(s.id));
        newAtt[s.id] = found ? found.status : '';
      });

      return {
        students: classStudents,
        attendance: newAtt,
        stats: statsRes.data.data || []
      };
    },
    enabled: !!selectedClass
  });

  // Sync daily query data to local editing states
  useEffect(() => {
    if (attendanceData) {
      setStudents(attendanceData.students);
      setAttendance(attendanceData.attendance);
      setStats(attendanceData.stats);
    }
  }, [attendanceData]);

  // Reset local state if no class is selected
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setAttendance({});
      setStats([]);
    }
  }, [selectedClass]);

  const isPresetActive = (days: number) => {
    if (!matrixStartDate || !matrixEndDate) return false;
    const end = new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toISOString().split('T')[0];
    return matrixStartDate === start && matrixEndDate === end;
  };

  const isThisMonthActive = () => {
    if (!matrixStartDate || !matrixEndDate) return false;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    return matrixStartDate === firstDay && matrixEndDate === today;
  };

  // ─── Query: ดึงข้อมูล Matrix ย้อนหลัง ───
  const { data: matrixRecords = [], isLoading: loadingMatrix } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate],
    queryFn: async () => {
      const res = await api.get(`/attendance?classroom_id=${selectedClass}&start_date=${matrixStartDate}&end_date=${matrixEndDate}`);
      return res.data.data || [];
    },
    enabled: !!selectedClass && activeTab === 'matrix'
  });

  // ─── Query: ดึงข้อมูลประวัติการเช็คชื่อรายบุคคล ───
  const { data: historyData = [], isLoading: loadingHistory } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history', selectedClass, historyStudent?.id],
    queryFn: async () => {
      const res = await api.get(`/attendance?student_id=${historyStudent?.id}&classroom_id=${selectedClass}`);
      return res.data.data || [];
    },
    enabled: !!selectedClass && !!historyStudent?.id
  });

  // Close cell editing popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cellPopoverRef.current && !cellPopoverRef.current.contains(event.target as Node)) {
        setMatrixEditingCell(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // (Queries defined above)



  // ─── Mutation: บันทึกการเข้าเรียนรายบุคคล (Auto Save) ───
  const singleStatusMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      return api.post('/attendance', {
        student_id: Number(studentId),
        classroom_id: Number(selectedClass),
        date: date,
        status: status
      });
    },
    onMutate: () => {
      setAutoSaveStatus('saving');
    },
    onSuccess: () => {
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      setAutoSaveStatus('error');
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ');
    }
  });

  const handleStatusChange = (studentId: string, status: string) => {
    const current = attendance[studentId];
    // Toggle off if clicking the active status
    const newStatus = current === status ? '' : status;

    setAttendance(prev => ({ ...prev, [studentId]: newStatus }));
    
    if (newStatus === '') {
      api.delete(`/attendance?student_id=${studentId}&classroom_id=${selectedClass}&date=${date}`)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
          toast.success('ลบข้อมูลการเช็คชื่อรายบุคคลเรียบร้อยแล้ว');
        })
        .catch(() => {
          toast.error('ลบข้อมูลไม่สำเร็จ');
        });
    } else if (autoSave) {
      singleStatusMutation.mutate({ studentId, status: newStatus });
    }
  };

  // ─── Mutation: บันทึกข้อมูลการเข้าเรียนด้วยตนเอง (Manual Save) ───
  const saveMutation = useMutation({
    mutationFn: async (records: any[]) => {
      return api.post('/attendance', { records });
    },
    onSuccess: () => {
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
    },
    onError: () => {
      toast.error('บันทึกไม่สำเร็จ');
    }
  });

  const handleSave = () => {
    if (!selectedClass || students.length === 0) return;

    const uncheckedStudents = students.filter(s => !attendance[s.id]);
    if (uncheckedStudents.length > 0) {
      toast.error(`กรุณาเช็คชื่อนักเรียนให้ครบทุกคนก่อนบันทึก (เหลืออีก ${uncheckedStudents.length} คน)`);
      return;
    }

    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id: Number(student_id),
      classroom_id: Number(selectedClass),
      date: date,
      status: status
    }));

    saveMutation.mutate(records);
  };

  // ─── Mutation: อัปเดตข้อมูลเข้าเรียน Matrix ───
  const matrixCellUpdateMutation = useMutation({
    mutationFn: async ({ studentId, dateStr, status }: { studentId: string; dateStr: string; status: string }) => {
      return api.post('/attendance', {
        records: [{
          student_id: Number(studentId),
          classroom_id: Number(selectedClass),
          date: dateStr,
          status: status
        }]
      });
    },
    onSuccess: (_, variables) => {
      toast.success('อัปเดตข้อมูลการเข้าเรียนเรียบร้อย');
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      toast.error('อัปเดตไม่สำเร็จ');
    }
  });

  const handleMatrixCellUpdate = (studentId: string, dateStr: string, status: string) => {
    setMatrixEditingCell(null);
    matrixCellUpdateMutation.mutate({ studentId, dateStr, status });
  };

  // ─── Mutation: ลบข้อมูลเข้าเรียน Matrix ───
  const matrixCellDeleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      return api.delete(`/attendance?id=${recordId}`);
    },
    onSuccess: () => {
      toast.success('ลบข้อมูลการเข้าเรียนเรียบร้อย');
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      toast.error('ลบข้อมูลไม่สำเร็จ');
    }
  });

  const handleMatrixCellDelete = (studentId: string, dateStr: string) => {
    setMatrixEditingCell(null);
    const record = matrixRecords.find(r => 
      (String(r.student_id) === String(studentId)) && 
      (r.date ? r.date.split('T')[0] === dateStr : false)
    );
    if (!record) return;
    matrixCellDeleteMutation.mutate(record.id);
  };

  const getStudentStats = (studentId: string) => {
    return stats.find(s => String(s.student_id) === String(studentId)) || {
      student_id: studentId,
      present_count: 0, late_count: 0, absent_count: 0,
      leave_count: 0, converted_absent_count: 0, remaining_late_count: 0, remaining_leave_count: 0
    };
  };

  const statusBtn = (id: string, status: string, icon: React.ReactNode, label: string, activeClass: string) => {
    const isActive = attendance[id] === status;
    return (
      <button
        onClick={() => handleStatusChange(id, status)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive 
            ? `${activeClass} shadow-md scale-[1.03]` 
            : 'bg-white/50 border border-indigo-50/50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
        }`}
      >
        {icon} {label}
      </button>
    );
  };

  // ─── Mutation: ลบประวัติการเช็คชื่อรายคน ───
  const deleteHistoryMutation = useMutation({
    mutationFn: async (recordId: string) => {
      return api.delete(`/attendance?id=${recordId}`);
    },
    onSuccess: () => {
      toast.success('ลบประวัติเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['attendance-history', selectedClass, historyStudent?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      toast.error('ลบประวัติไม่สำเร็จ');
    }
  });

  const handleDeleteHistory = (recordId: string) => {
    if (!confirm('ต้องการลบประวัติการเช็คชื่อนี้หรือไม่?')) return;
    deleteHistoryMutation.mutate(recordId);
  };

  // ─── Mutation: ล้างข้อมูลการเข้าเรียน ───
  const clearDataMutation = useMutation({
    mutationFn: async () => {
      return api.delete(`/attendance?classroom_id=${selectedClass}&date=${date}`);
    },
    onSuccess: () => {
      toast.success('ลบข้อมูลการเช็คชื่อของวันที่เลือกเรียบร้อยแล้ว');
      setAttendance({});
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass] });
    },
    onError: () => {
      toast.error('ลบข้อมูลไม่สำเร็จ');
    }
  });

  const handleClearData = () => {
    if (!selectedClass || students.length === 0) return;
    
    const dateObj = new Date(date);
    const formattedDateForConfirm = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    if (!confirm(`⚠️ ยืนยันการลบข้อมูลเช็คชื่อ?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของทุกคนในห้องนี้\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(เหมาะสำหรับกรณีลงชื่อผิดวัน หรือต้องการเริ่มลงใหม่ของวันนี้)`)) {
      return;
    }
    clearDataMutation.mutate();
  };

  const handleExportCSV = async () => {
    if (!selectedClass) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('classroom_id', selectedClass);
      if (exportStartDate) params.append('start_date', exportStartDate);
      if (exportEndDate) params.append('end_date', exportEndDate);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'attendance_export.csv';
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/i);
        if (match) filename = decodeURIComponent(match[1]);
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('ส่งออก CSV เรียบร้อยแล้ว');
      setShowExportModal(false);
    } catch {
      toast.error('ส่งออก CSV ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'present': return <span className="text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs font-semibold">มาเรียน</span>;
      case 'late': return <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-semibold">สาย</span>;
      case 'absent': return <span className="text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ขาด</span>;
      case 'leave': return <span className="text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ลา</span>;
      default: return <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-xs font-semibold">{status}</span>;
    }
  };

  // ─── Mutation: เลือกสถานะทั้งหมด ───
  const markAllMutation = useMutation({
    mutationFn: async ({ status, records }: { status: string; records: any[] }) => {
      return api.post('/attendance', { records });
    },
    onMutate: () => {
      setAutoSaveStatus('saving');
    },
    onSuccess: () => {
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
    },
    onError: () => {
      setAutoSaveStatus('error');
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ');
    }
  });

  const handleMarkAll = (status: string) => {
    const newAtt = { ...attendance };
    filteredStudents.forEach(student => {
      newAtt[student.id] = status;
    });
    setAttendance(newAtt);
    toast.success(`เลือก ${status === 'present' ? 'มาเรียน' : status === 'absent' ? 'ขาด' : status === 'late' ? 'สาย' : 'ลา'} ให้กับรายชื่อที่แสดงอยู่`);

    if (autoSave) {
      const records = filteredStudents.map(student => ({
        student_id: Number(student.id),
        classroom_id: Number(selectedClass),
        date: date,
        status: status
      }));
      markAllMutation.mutate({ status, records });
    }
  };

  const handleResetDraft = () => {
    if (attendanceData) {
      setAttendance(attendanceData.attendance);
    }
    toast.success('คืนค่าการกรอกข้อมูลแล้ว');
  };

  // Adjust Date (Daily tab)
  const adjustDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const setToday = () => setDate(new Date().toISOString().split('T')[0]);
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  // Filters students by search query
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.student_code && student.student_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Daily statistics calculated in real-time
  const dailyStats = {
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    total: students.length,
    marked: 0
  };

  students.forEach(s => {
    const sStatus = attendance[s.id];
    if (sStatus) {
      dailyStats.marked++;
      if (sStatus === 'present') dailyStats.present++;
      else if (sStatus === 'late') dailyStats.late++;
      else if (sStatus === 'absent') dailyStats.absent++;
      else if (sStatus === 'leave') dailyStats.leave++;
    }
  });

  // Calculate unique dates in range for Matrix View
  // ─── Holiday Calculation ───
  const holidayMap = useMemo(() => {
    if (!matrixStartDate || !matrixEndDate) return {};
    const list = getThaiHolidays(matrixStartDate, matrixEndDate);
    const map: Record<string, HolidayInfo> = {};
    list.forEach(h => {
      map[h.date] = h;
    });
    return map;
  }, [matrixStartDate, matrixEndDate]);

  const teachingDayGovHolidays = useMemo(() => {
    return Object.values(holidayMap).filter(h => {
      if (h.type !== 'government') return false;
      const dayOfWeek = getSchemaDayOfWeek(h.date);
      return teachingDays.includes(dayOfWeek);
    });
  }, [holidayMap, teachingDays]);

  const getUniqueDates = () => {
    const dates = new Set<string>();
    
    // Add dates that have records
    matrixRecords.forEach(r => {
      if (r.date) {
        const dStr = r.date.split('T')[0];
        if (dStr) dates.add(dStr);
      }
    });

    // Include government holidays ONLY if they fall on teaching days of this classroom
    if (matrixStartDate && matrixEndDate) {
      const holidays = getThaiHolidays(matrixStartDate, matrixEndDate);
      holidays.forEach(h => {
        if (h.type === 'government') {
          const dayOfWeek = getSchemaDayOfWeek(h.date);
          if (teachingDays.includes(dayOfWeek)) {
            dates.add(h.date);
          }
        }
      });
    }

    // Sort dates ascending
    return Array.from(dates).sort();
  };

  const matrixDates = getUniqueDates();
  const selectedClassData = classrooms.find(c => String(c.id) === String(selectedClass));
  const maxAllowedAbsences = selectedClassData ? Math.floor((Number(selectedClassData.total_classes) || 40) * (100 - (Number(selectedClassData.min_attendance_percent) || 80)) / 100) : 0;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isPastDate = date < todayStr;
  const isToday = date === todayStr;

  const selectedDateWeekNumber = useMemo(() => {
    if (!semesterInfo?.semesterStartDate) return null;
    const start = new Date(semesterInfo.semesterStartDate);
    const current = new Date(date);
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    const weekNum = Math.floor(diffDays / 7) + 1;
    return (weekNum >= 1 && weekNum <= (semesterInfo.totalWeeks || 18)) ? weekNum : null;
  }, [semesterInfo, date]);

  const formattedSelectedDate = new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const loading = loadingClassrooms || (!!selectedClass && loadingAttendance);
  const saving = saveMutation.isPending || clearDataMutation.isPending || markAllMutation.isPending;
  const matrixLoading = loadingMatrix;
  const historyLoading = loadingHistory;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <p className="text-slate-500 font-medium animate-pulse">กำลังดาวน์โหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight bg-gradient-to-r from-slate-800 to-indigo-900 bg-clip-text text-transparent mb-1">
            เช็คชื่อเข้าเรียน
          </h1>
          <p className="text-slate-500 text-sm">บันทึก ติดตาม และประเมินผลสถิติการมาเรียนของนักเรียนย้อนหลัง</p>
        </div>

        {/* Global Action Tools */}
        {selectedClass && students.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => { setExportStartDate(''); setExportEndDate(''); setShowExportModal(true); }}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200/50 font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              title="พรีวิวและส่งออกข้อมูลการเช็คชื่อเป็น CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>พรีวิว & ส่งออก CSV</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-xs"
              title="นำเข้าข้อมูลการเช็คชื่อจากไฟล์ Excel พร้อมดูตัวอย่างรูปแบบและดาวน์โหลดเทมเพลต"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>นำเข้าจาก Excel & ตัวอย่างไฟล์</span>
            </button>
            
            <button
              onClick={handleClearData}
              disabled={saving}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/60 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
              title="ลบข้อมูลการเช็คชื่อทั้งห้องสำหรับวันที่เลือกอยู่"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>ลบข้อมูลวันที่เลือก ({new Date(date).getDate()} {THAI_MONTHS_SHORT[new Date(date).getMonth()]})</span>
            </button>
          </div>
        )}
      </div>

      {/* Today's Classes from Timetable */}
      {todayEntries.length > 0 && (
        <div className="glass p-5 rounded-2xl border border-white/40 shadow-xl shadow-indigo-100/20">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-700">📅 คาบเรียนวันนี้ ({new Date().toLocaleDateString('th-TH', { weekday: 'long' })})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayEntries.map((entry) => {
              const matchedClassroom = entry.classroom_id ? classrooms.find(c => String(c.id) === String(entry.classroom_id)) : null;
              const isActive = matchedClassroom && String(matchedClassroom.id) === selectedClass;
              const periodLabel = entry.start_period === entry.end_period ? `คาบ ${entry.start_period}` : `คาบ ${entry.start_period}-${entry.end_period}`;
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (matchedClassroom) {
                      setSelectedClass(String(matchedClassroom.id));
                      setDate(new Date().toISOString().split('T')[0]);
                      setActiveTab('daily');
                    }
                  }}
                  disabled={!matchedClassroom}
                  className={`px-4 py-2.5 rounded-xl border text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200'
                      : matchedClassroom
                        ? 'bg-white hover:bg-emerald-50 border-emerald-200 text-slate-700 hover:border-emerald-400 hover:shadow-md cursor-pointer'
                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="font-bold text-sm">{entry.subject_name || 'ไม่ระบุวิชา'}</div>
                  <div className={`text-xs mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {periodLabel} · {entry.room || '-'}
                    {matchedClassroom && <span className="ml-1">· {matchedClassroom.name}</span>}
                    {!matchedClassroom && <span className="ml-1 text-amber-500">· ยังไม่เชื่อมห้องเรียน</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {todayEntries.some(e => !e.classroom_id) && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              บางคาบยังไม่ได้เชื่อมกับห้องเรียน — ไปตั้งค่าที่เมนู &quot;ตารางเรียน&quot;
            </p>
          )}
        </div>
      )}

      {/* Classroom selector card */}
      <div className="glass p-5 rounded-2xl flex flex-col md:flex-row gap-5 items-center justify-between border border-white/40 shadow-xl shadow-indigo-100/20">
        <div className="w-full md:w-2/3">
          <label className="form-label text-slate-700 font-semibold mb-1.5 block">ห้องเรียน</label>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)} 
              className="form-input text-lg py-2.5 bg-white/70 border-indigo-100/80 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 transition-all font-medium text-slate-800 max-w-md w-full"
            >
              <option value="">-- เลือกห้องเรียน --</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            
            {selectedClassData && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 text-indigo-800 shadow-sm shrink-0">
                <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="text-xs font-semibold leading-relaxed">
                  <span className="block sm:inline">เวลาเรียนขั้นต่ำ: <strong className="text-indigo-900 font-black">{selectedClassData.min_attendance_percent || 80}%</strong></span>
                  <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                  <span className="block sm:inline">สิทธิ์เรียน/สอบ: ขาดได้ไม่เกิน <strong className="text-red-600 font-black">{maxAllowedAbsences} คาบ</strong> <span className="text-slate-500 font-medium">(จากทั้งหมด {selectedClassData.total_classes || 40} คาบ)</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedClass && (
          <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <List className="w-4 h-4" />
              เช็คชื่อประจำวัน
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'matrix'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <Grid className="w-4 h-4" />
              ตารางประวัติย้อนหลัง
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="glass p-20 text-center rounded-2xl border border-white/30">
          <Users className="w-16 h-16 text-indigo-300 mx-auto mb-4 stroke-1" />
          <h3 className="text-xl font-bold text-slate-700 mb-1">ยังไม่ได้เลือกห้องเรียน</h3>
          <p className="text-slate-600 text-sm max-w-sm mx-auto">กรุณาเลือกห้องเรียนด้านบนเพื่อเริ่มเช็คชื่อรายวัน หรือจัดการประวัติเช็คชื่อย้อนหลัง</p>
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-20 text-center rounded-2xl border border-white/30">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4 stroke-1" />
          <h3 className="text-xl font-bold text-slate-700 mb-1">ไม่พบนักเรียน</h3>
          <p className="text-slate-600 text-sm max-w-sm mx-auto mb-4">ไม่มีรายชื่อนักเรียนอยู่ในห้องเรียนนี้ในระบบขณะนี้</p>
          <a href="#students" className="btn btn-primary px-6 py-2.5 inline-flex items-center gap-2">
            <Users className="w-4 h-4" /> เพิ่มนักเรียนเข้าห้องเรียน
          </a>
        </div>
      ) : (
        <>
          {activeTab === 'daily' ? (
            /* ================= DAILY ROLL CALL TAB ================= */
            <div className="space-y-6">
              
              {/* Date Control Panel */}
              <div className="glass p-5 rounded-2xl border border-white/50 shadow-md">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-indigo-50/50 p-1.5 rounded-xl border border-indigo-100/50">
                    <button 
                      onClick={() => adjustDate(-1)} 
                      className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors"
                      title="วันก่อนหน้า"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="relative flex items-center gap-2 px-3 font-semibold text-slate-800 cursor-pointer group">
                      <CalendarIcon className="w-4 h-4 text-indigo-500" />
                      <span>{formattedSelectedDate}</span>
                      <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                    </div>

                    <button 
                      onClick={() => adjustDate(1)} 
                      className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors"
                      title="วันถัดไป"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                    <button 
                      onClick={setToday} 
                      className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all ${
                        isToday
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      วันนี้
                    </button>
                    <button 
                      onClick={setYesterday} 
                      className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      เมื่อวาน
                    </button>

                    {/* ปุ่มเช็คชื่อย้อนหลัง */}
                    <button 
                      type="button"
                      onClick={() => setShowRetroactiveModal(true)} 
                      className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                      title="เปิดหน้าต่างเลือกสัปดาห์หรือวันย้อนหลังเพื่อเช็คชื่อ"
                    >
                      <History className="w-4 h-4" />
                      <span>เช็คชื่อย้อนหลัง</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Retroactive Alert Banner (เมื่อเลือกวันในอดีต) */}
              {isPastDate && (
                <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 p-4 rounded-2xl border border-amber-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-amber-950 text-sm">
                          🕒 กำลังเช็คชื่อย้อนหลัง:
                        </span>
                        <span className="text-xs bg-white text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300 shadow-xs">
                          {formattedSelectedDate}
                        </span>
                        {selectedDateWeekNumber && (
                          <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                            สัปดาห์ที่ {selectedDateWeekNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {dailyStats.marked === dailyStats.total && dailyStats.total > 0
                          ? `บันทึกครบแล้ว (${dailyStats.marked}/${dailyStats.total} คน)`
                          : dailyStats.marked > 0
                          ? `เช็คแล้ว ${dailyStats.marked} คน (ยังค้างอีก ${dailyStats.total - dailyStats.marked} คน)`
                          : 'ยังไม่มีประวัติการเช็คชื่อของวันนี้ — สามารถเช็คสถานะและบันทึกได้ทันที'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRetroactiveModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>เปลี่ยนวันย้อนหลัง</span>
                    </button>
                    <button
                      type="button"
                      onClick={setToday}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 hover:scale-105 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>กลับไปวันนี้</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Counters Card */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="glass p-4 rounded-2xl border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">มาเรียน</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.present}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-amber-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">สาย</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.late}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-red-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">ขาด</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.absent}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-blue-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">ลา</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.leave}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-indigo-600 flex items-center justify-between col-span-2 md:col-span-1 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">บันทึกผล</p>
                    <p className="text-2xl font-black text-slate-800">
                      {dailyStats.marked} <span className="text-sm font-semibold text-slate-500">/ {dailyStats.total}</span>
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-700">
                      {Math.round((dailyStats.marked / (dailyStats.total || 1)) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Student List View */}
              <div className="glass overflow-hidden rounded-2xl border border-white/50 shadow-xl">
                {/* Search and Bulk Operations Bar */}
                <div className="p-4 border-b border-indigo-50/50 bg-white/40 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-2 text-sm bg-white/70 border-indigo-100/50 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <span className="text-xs text-slate-600 font-semibold mr-1">กำหนดเร็ว:</span>
                    <button 
                      onClick={() => handleMarkAll('present')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-semibold border border-emerald-200/40 transition-colors"
                    >
                      มาเรียนทุกคน
                    </button>
                    <button 
                      onClick={() => handleMarkAll('absent')}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold border border-red-200/40 transition-colors"
                    >
                      ขาดทุกคน
                    </button>
                    <button 
                      onClick={handleResetDraft}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300/40 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> คืนค่า
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/70 border-b border-indigo-100/80">
                        <th className="p-4 font-bold text-slate-700 w-24">รหัส</th>
                        <th className="p-4 font-bold text-slate-700">ชื่อ-นามสกุล</th>
                        <th className="p-4 font-bold text-slate-700 min-w-[340px]">สถานะการมาเรียน</th>
                        <th className="p-4 font-bold text-slate-700 text-center w-40">สถิติสะสม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, idx) => {
                        const sStats = getStudentStats(student.id);
                        const isCloseToFRisk = sStats.converted_absent_count >= maxAllowedAbsences * 0.75;
                        return (
                          <tr 
                            key={student.id} 
                            className={`border-b border-indigo-50/50 transition-colors duration-150 hover:bg-indigo-50/30 ${
                              idx % 2 === 0 ? 'bg-white/20' : 'bg-transparent'
                            }`}
                          >
                            <td className="p-4 text-slate-600 text-sm font-semibold">{student.student_code || '-'}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center">
                                  {student.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-800">{student.name}</span>
                                <button 
                                  onClick={() => setHistoryStudent(student)} 
                                  className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-100/50 transition-all" 
                                  title="ดูประวัติการมาเรียนอย่างละเอียด"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                {statusBtn(student.id, 'present', <CheckCircle className="w-4 h-4" />, 'มาเรียน', 'bg-emerald-500 text-white border border-emerald-600')}
                                {statusBtn(student.id, 'late', <Clock className="w-4 h-4" />, 'สาย', 'bg-amber-500 text-white border border-amber-600')}
                                {statusBtn(student.id, 'absent', <XCircle className="w-4 h-4" />, 'ขาด', 'bg-red-500 text-white border border-red-600')}
                                {statusBtn(student.id, 'leave', <FileText className="w-4 h-4" />, 'ลา', 'bg-blue-500 text-white border border-blue-600')}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                {sStats.is_f ? (
                                  <span className="text-[10px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse border border-red-700">
                                    หมดสิทธิ์เรียน
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center w-full">
                                    <div className="flex justify-between w-full max-w-[90px] text-xs font-semibold mb-1">
                                      <span className={sStats.converted_absent_count > 0 ? 'text-red-500' : 'text-slate-600'}>
                                        ขาด {sStats.converted_absent_count}
                                      </span>
                                      <span className="text-slate-600">/ {maxAllowedAbsences}</span>
                                    </div>
                                    <div className="w-full max-w-[90px] bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${
                                          isCloseToFRisk ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'
                                        }`} 
                                        style={{ width: `${Math.min((sStats.converted_absent_count / (maxAllowedAbsences || 1)) * 100, 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                                
                                {(sStats.remaining_late_count > 0 || sStats.remaining_leave_count > 0) && (
                                  <div className="flex gap-1 text-[9px] mt-1 font-semibold opacity-70">
                                    {sStats.remaining_late_count > 0 && <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">สายสะสม {sStats.remaining_late_count}</span>}
                                    {sStats.remaining_leave_count > 0 && <span className="text-blue-500 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 font-semibold">ลาสะสม {sStats.remaining_leave_count}</span>}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sticky Save Bar */}
                <div className="p-4 border-t border-indigo-50/50 bg-indigo-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Auto Save Toggle */}
                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={autoSave} 
                        onChange={(e) => {
                          setAutoSave(e.target.checked);
                          if (e.target.checked) {
                            setAutoSaveStatus('idle');
                          }
                        }} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2.5 text-sm font-bold text-slate-700">บันทึกอัตโนมัติ</span>
                    </label>
                    
                    {autoSave && renderAutoSaveStatus()}
                  </div>

                  {/* Right: Manual save/reset actions */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!autoSave ? (
                      <>
                        <button
                          onClick={handleResetDraft}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-all duration-200 text-sm"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="btn btn-primary px-8 py-2.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 text-sm"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>บันทึกประวัติการเช็คชื่อ</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">ทุกการเปลี่ยนแปลงจะถูกบันทึกลงระบบทันที</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= ATTENDANCE HISTORY MATRIX GRID ================= */
            <div className="space-y-6">
              
              {/* Modern Thai Date range filter card */}
              <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-blue-500/10 p-4 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-lg shadow-indigo-500/5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Header Title */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 text-base">ตัวเลือกช่วงวันที่แสดงผล</h3>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200/60">
                          <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" /> ปฏิทินไทย
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">คลิกเพื่อเลือกวันเริ่มต้น-สิ้นสุดบนปฏิทินไทย หรือใช้ปุ่มลัดเลือกช่วงเวลา</p>
                    </div>
                  </div>

                  {/* Right: Thai Custom Date Range Picker Component & Counter */}
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                    <ThaiDateRangePicker
                      startDate={matrixStartDate}
                      endDate={matrixEndDate}
                      onChange={(start, end) => {
                        setMatrixStartDate(start);
                        setMatrixEndDate(end);
                      }}
                      matrixDatesCount={matrixDates.length}
                    />

                    {/* Range Summary Status */}
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-600 font-bold bg-white/80 px-3 py-2 rounded-2xl border border-indigo-100/80 shadow-sm flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>{matrixDates.length > 0 ? `${matrixDates.length} คาบเรียน/วันในตาราง` : '0 คาบ'}</span>
                      </div>
                      {teachingDayGovHolidays.length > 0 && (
                        <div 
                          className="text-xs text-amber-900 font-bold bg-amber-50 px-3 py-2 rounded-2xl border border-amber-200/80 shadow-sm flex items-center gap-1.5 shrink-0" 
                          title={`วันหยุดตรงกับวันที่มีสอน: ${teachingDayGovHolidays.map(h => `${h.date} (${h.name})`).join(', ')}`}
                        >
                          <span>🏖️</span>
                          <span>ตรงวันสอน {teachingDayGovHolidays.length} วัน</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Teaching Days Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-indigo-100/90 shadow-sm mt-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">วันที่มีตารางสอนของห้องนี้:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 0, label: 'จันทร์' },
                      { id: 1, label: 'อังคาร' },
                      { id: 2, label: 'พุธ' },
                      { id: 3, label: 'พฤหัสบดี' },
                      { id: 4, label: 'ศุกร์' },
                      { id: 5, label: 'เสาร์' },
                      { id: 6, label: 'อาทิตย์' },
                    ].map(day => {
                      const isSelected = teachingDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (teachingDays.length > 1) {
                                setTeachingDays(prev => prev.filter(d => d !== day.id));
                              }
                            } else {
                              setTeachingDays(prev => [...prev, day.id].sort((a, b) => a - b));
                            }
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Matrix Grid Table */}
              <div className="glass overflow-hidden rounded-2xl border border-white/50 shadow-xl">
                <div className="p-4 border-b border-indigo-50/50 bg-white/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Grid className="w-5 h-5 text-indigo-500" />
                    <span className="font-bold text-slate-800">ตารางการเช็คชื่อสะสม ({matrixDates.length} คาบเรียน/วัน)</span>
                  </div>
                  
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-1.5 text-xs bg-white/70 border-indigo-100/50 rounded-xl"
                    />
                  </div>
                </div>

                {matrixLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="text-slate-500 font-semibold animate-pulse text-sm">กำลังคำนวณข้อมูลประวัติ...</p>
                  </div>
                ) : matrixDates.length === 0 ? (
                  <div className="p-20 text-center">
                    <CalendarIcon className="w-16 h-16 text-indigo-200 mx-auto mb-4 stroke-1" />
                    <h4 className="text-lg font-bold text-slate-700 mb-1">ไม่พบข้อมูลการเช็คชื่อ</h4>
                    <p className="text-slate-600 text-sm max-w-xs mx-auto">ไม่มีประวัติการบันทึกการเช็คชื่อในช่วงวันที่กำหนด</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <div style={{ minWidth: `${Math.max(1000, 176 + (matrixDates.length * 96))}px` }}>
                      <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-indigo-50/70 border-b border-indigo-100/80 sticky top-0 z-20 backdrop-blur-md">
                          <th className="p-4 font-bold text-slate-700 w-44 sticky left-0 bg-indigo-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-indigo-100">
                            นักเรียน ({filteredStudents.length} คน)
                          </th>
                          {matrixDates.map(dateStr => {
                            const dateObj = new Date(dateStr);
                            const day = dateObj.getDate();
                            const month = dateObj.toLocaleDateString('th-TH', { month: 'short' });
                            const holiday = holidayMap[dateStr] || checkThaiHoliday(dateStr);

                            const isGovHoliday = holiday?.type === 'government';
                            const isWeekend = holiday?.type === 'weekend';

                            return (
                              <th 
                                key={dateStr} 
                                className={`p-3 font-bold text-center w-24 text-xs border-r transition-colors ${
                                  isGovHoliday 
                                    ? 'bg-amber-100/90 border-amber-200/90 text-amber-900' 
                                    : isWeekend
                                    ? 'bg-slate-150/80 bg-slate-200/60 border-slate-200/80 text-slate-600'
                                    : 'bg-indigo-50/70 border-indigo-100/50 text-slate-700'
                                }`}
                                title={holiday ? holiday.name : undefined}
                              >
                                <div className="flex flex-col items-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDate(dateStr);
                                      setActiveTab('daily');
                                      toast.success(`เปิดหน้าเช็คชื่อวันที่ ${day} ${month}`);
                                    }}
                                    className="group/btn flex flex-col items-center hover:opacity-85 transition-all cursor-pointer"
                                    title={`คลิกเพื่อเปิดหน้าเช็คชื่อทั้งห้องของวันที่ ${day} ${month}`}
                                  >
                                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                      {dateObj.toLocaleDateString('th-TH', { weekday: 'short' })}
                                      {isGovHoliday && <span>🏖️</span>}
                                    </span>
                                    <span className={`text-sm font-black ${isGovHoliday ? 'text-amber-950' : 'text-indigo-800'} group-hover/btn:underline`}>
                                      {day} {month}
                                    </span>
                                    <span className="text-[9px] text-indigo-600 font-bold bg-white/90 hover:bg-white px-1.5 py-0.5 rounded-md border border-indigo-200/80 mt-0.5 opacity-80 group-hover/btn:opacity-100 shadow-xs">
                                      เช็คทั้งห้อง
                                    </span>
                                  </button>
                                  {isGovHoliday && (
                                    <span className="text-[9px] font-bold text-amber-800 truncate max-w-[84px] leading-tight mt-0.5" title={holiday.name}>
                                      {holiday.name}
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => {
                          return (
                            <tr 
                              key={student.id} 
                              className={`border-b border-indigo-50/50 hover:bg-indigo-50/20 transition-colors ${
                                idx % 2 === 0 ? 'bg-white/20' : 'bg-transparent'
                              }`}
                            >
                              <td className="p-4 font-semibold text-slate-800 text-sm sticky left-0 bg-white/95 backdrop-blur-md z-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-indigo-100 flex items-center gap-2 h-14 overflow-hidden text-ellipsis whitespace-nowrap">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                  {student.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 text-xs truncate leading-snug">{student.name}</p>
                                  {student.student_code && (
                                    <p className="text-[10px] text-slate-500 leading-none mt-0.5">{student.student_code}</p>
                                  )}
                                </div>
                              </td>
                              
                              {matrixDates.map(dateStr => {
                                // Find matching record
                                const record = matrixRecords.find(r => 
                                  (String(r.student_id) === String(student.id)) && 
                                  (r.date ? r.date.split('T')[0] === dateStr : false)
                                );
                                
                                const status = record ? record.status : null;
                                const isEditing = matrixEditingCell?.studentId === student.id && matrixEditingCell?.date === dateStr;
                                const holiday = holidayMap[dateStr] || checkThaiHoliday(dateStr);

                                return (
                                  <MemoizedAttendanceCell
                                    key={dateStr}
                                    status={status}
                                    isEditing={isEditing}
                                    onEditClick={() => setMatrixEditingCell({ studentId: student.id, date: dateStr })}
                                    onStatusSelect={statusVal => handleMatrixCellUpdate(student.id, dateStr, statusVal)}
                                    onDeleteClick={status ? () => handleMatrixCellDelete(student.id, dateStr) : undefined}
                                    popoverRef={isEditing ? cellPopoverRef : undefined}
                                    holiday={holiday}
                                  />
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="p-4 border-t border-indigo-50/50 bg-indigo-50/30">
                  <p className="text-xs text-slate-600 font-medium">💡 คลิกที่ชื่อย่อสถานะเพื่อเปิดเมนูสำหรับแก้ไขสถิติการมาเรียนย้อนหลังของนักเรียนได้โดยตรง</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= HISTORY LIST MODAL FOR SINGLE STUDENT ================= */}
      {historyStudent && createPortal(
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="glass w-full max-w-md p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">ประวัติการเช็คชื่อ</h2>
                  <p className="text-sm text-slate-600">{historyStudent.name}</p>
                </div>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-slate-500 text-sm font-semibold">ไม่พบสถิติการเช็คชื่อใดๆ</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {historyData.map(record => {
                  const dateObj = new Date(record.date);
                  const formattedDate = dateObj.toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'short'
                  });
                  return (
                    <div key={record.id} className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 hover:bg-indigo-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm text-slate-700 font-semibold">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusDisplay(record.status)}
                        <button 
                          onClick={() => handleDeleteHistory(record.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-150"
                          title="ลบสถิตินี้ออก"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-5 pt-4 border-t border-indigo-50/50 flex justify-end">
              <button 
                onClick={() => setHistoryStudent(null)} 
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= ATTENDANCE CSV PREVIEW & EXPORT MODAL ================= */}
      <AttendanceCsvModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        classroom={selectedClassData ? {
          id: selectedClassData.id,
          name: selectedClassData.name,
          min_attendance_percent: selectedClassData.min_attendance_percent,
          total_classes: selectedClassData.total_classes,
          late_to_absent_ratio: selectedClassData.late_to_absent_ratio,
          leave_to_absent_ratio: selectedClassData.leave_to_absent_ratio,
        } : null}
        initialStartDate={exportStartDate}
        initialEndDate={exportEndDate}
      />

      {/* ================= ATTENDANCE EXCEL IMPORT & TEMPLATE MODAL ================= */}
      {selectedClass && (
        <AttendanceImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          classroomId={selectedClass}
          classroomName={classrooms.find(c => String(c.id) === selectedClass)?.name || 'ห้องเรียน'}
          students={students}
          currentDate={date}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            toast.success('อัปเดตข้อมูลการเช็คชื่อในตารางเรียบร้อยแล้ว');
          }}
        />
      )}

      {/* ================= RETROACTIVE ATTENDANCE MODAL ================= */}
      {showRetroactiveModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowRetroactiveModal(false)}>
          <div 
            className="glass w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto animate-scale-up" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">เลือกวัน/สัปดาห์ที่ต้องการเช็คชื่อย้อนหลัง</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ห้องเรียน: <span className="font-semibold text-indigo-700">{selectedClassData?.name || 'ห้องเรียน'}</span>
                    {selectedClassData?.curriculum_type && (
                      <span className="ml-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                        {selectedClassData.curriculum_type === 'pvs' ? 'ปวส. 15 สัปดาห์' : selectedClassData.curriculum_type === 'custom' ? `กำหนดเอง ${selectedClassData.total_weeks || 18} สัปดาห์` : 'ปวช. 18 สัปดาห์'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowRetroactiveModal(false)} 
                className="p-2 hover:bg-indigo-50 rounded-xl transition-colors" 
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl mb-5 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setRetroactiveTab('weeks')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  retroactiveTab === 'weeks'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                <span>เลือกตามสัปดาห์ภาคเรียน ({semesterInfo?.totalWeeks || selectedClassData?.total_weeks || 18} สัปดาห์)</span>
              </button>
              <button
                type="button"
                onClick={() => setRetroactiveTab('calendar')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  retroactiveTab === 'calendar'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                <Clock className="w-4 h-4 text-violet-600" />
                <span>ปฏิทินเลือกวันที่ด่วน</span>
              </button>
            </div>

            {/* Tab 1: Week Navigator */}
            {retroactiveTab === 'weeks' && (
              <div className="space-y-4">
                {semesterInfo?.weeks && semesterInfo.weeks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      คลิกเลือกวันที่มีการสอนในสัปดาห์ที่ต้องการ เพื่อเปิดหน้าเช็คชื่อย้อนหลังของวันนั้น:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                      {semesterInfo.weeks.map(w => {
                        const weekStart = new Date(w.start);
                        const daysInThisWeek = [];
                        for (let i = 0; i < 7; i++) {
                          const curD = new Date(weekStart);
                          curD.setDate(weekStart.getDate() + i);
                          const curDateStr = curD.toISOString().split('T')[0];
                          const dayOfWeek = (curD.getDay() + 6) % 7; // 0=Mon..6=Sun
                          daysInThisWeek.push({
                            dateStr: curDateStr,
                            dateObj: curD,
                            dayOfWeek,
                            isTeachingDay: teachingDays.includes(dayOfWeek),
                            isFuture: curDateStr > todayStr,
                            isSelected: curDateStr === date
                          });
                        }

                        const thaiDayNames = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

                        return (
                          <div 
                            key={w.week} 
                            className={`p-3.5 rounded-2xl border transition-all ${
                              w.isCurrent
                                ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-200 shadow-sm'
                                : 'bg-white border-slate-200/80 hover:border-indigo-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                                <span>สัปดาห์ที่ {w.week}</span>
                                {w.isCurrent && (
                                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                                    สัปดาห์ปัจจุบัน
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {new Date(w.start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - {new Date(w.end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>

                            {/* Days buttons in this week */}
                            <div className="flex flex-wrap gap-1.5">
                              {daysInThisWeek.map(d => {
                                if (!d.isTeachingDay && d.dayOfWeek >= 5) return null;

                                return (
                                  <button
                                    key={d.dateStr}
                                    type="button"
                                    disabled={d.isFuture}
                                    onClick={() => {
                                      setDate(d.dateStr);
                                      setShowRetroactiveModal(false);
                                      setActiveTab('daily');
                                      toast.success(`เลือกเช็คชื่อวันที่ ${d.dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} (สัปดาห์ที่ ${w.week})`);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center min-w-[50px] ${
                                      d.isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : d.isFuture
                                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                        : d.isTeachingDay
                                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/70 hover:scale-105'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                    title={d.isFuture ? 'ยังไม่ถึงวันที่นี้' : `เช็คชื่อวันที่ ${d.dateStr}`}
                                  >
                                    <span className="text-[10px] opacity-75">{thaiDayNames[d.dayOfWeek]}</span>
                                    <span>{d.dateObj.getDate()}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <CalendarIcon className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">ยังไม่ได้กำหนดวันเปิดภาคเรียนของห้องนี้</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      สามารถไปตั้งค่า &quot;วันเปิดภาคเรียน&quot; ได้ที่เมนู <strong>ห้องเรียน</strong> หรือใช้แท็บ <strong>&quot;ปฏิทินเลือกวันที่ด่วน&quot;</strong> เพื่อเลือกวันที่ย้อนหลังได้ทันทีครับ
                    </p>
                    <button
                      type="button"
                      onClick={() => setRetroactiveTab('calendar')}
                      className="btn btn-primary text-xs px-4 py-2 mt-4"
                    >
                      ใช้ปฏิทินเลือกวันที่ด่วน
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Quick Presets & Calendar */}
            {retroactiveTab === 'calendar' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">
                    ปุ่มลัดเลือกวันย้อนหลัง:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'เมื่อวาน', days: 1 },
                      { label: '2 วันก่อน', days: 2 },
                      { label: '3 วันก่อน', days: 3 },
                      { label: '1 สัปดาห์ก่อน', days: 7 },
                    ].map(p => {
                      const d = new Date();
                      d.setDate(d.getDate() - p.days);
                      const dStr = d.toISOString().split('T')[0];
                      const isSel = date === dStr;

                      return (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => {
                            setDate(dStr);
                            setShowRetroactiveModal(false);
                            setActiveTab('daily');
                            toast.success(`เลือกเช็คชื่อวันที่ ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`);
                          }}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            isSel
                              ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm'
                              : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 font-semibold'
                          }`}
                        >
                          <div className="text-xs">{p.label}</div>
                          <div className={`text-[10px] mt-0.5 ${isSel ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block" htmlFor="retro-custom-date">
                    หรือระบุวันที่ในอดีตที่ต้องการ:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="retro-custom-date"
                      type="date"
                      max={todayStr}
                      value={customRetroDate}
                      onChange={e => setCustomRetroDate(e.target.value)}
                      className="form-input text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customRetroDate) return;
                        setDate(customRetroDate);
                        setShowRetroactiveModal(false);
                        setActiveTab('daily');
                        const parsed = new Date(customRetroDate);
                        toast.success(`เลือกเช็คชื่อวันที่ ${parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`);
                      }}
                      className="btn btn-primary px-6 py-2.5 text-sm"
                    >
                      ยืนยันเลือกวันนี้
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
