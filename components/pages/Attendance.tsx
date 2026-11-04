'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo, Fragment, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import {
  Loader2, Users, Save, Calendar as CalendarIcon, CheckCircle, Clock, XCircle,
  FileText, AlertCircle, X, History, Trash2, ChevronLeft, ChevronRight,
  Search, Check, Grid, List, RefreshCw, Sparkles, RotateCcw,
  FileSpreadsheet, Upload, BookOpen, GraduationCap, ArrowRight,
  GitBranch, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const AttendanceCsvModal = dynamic(() => import('@/components/AttendanceCsvModal'), { ssr: false });
const AttendanceImportModal = dynamic(() => import('@/components/AttendanceImportModal'), { ssr: false });

import { getThaiHolidays, checkThaiHoliday, HolidayInfo } from '@/lib/thaiHolidays';
import { buildStudentSectionGroups } from '@/lib/studentSections';
import UserAvatar from '@/components/UserAvatar';
import OfflineBanner from '@/components/OfflineBanner';
import {
  enqueueOfflineAttendance,
  enqueueBatchOfflineAttendance,
  cacheClassroomRoster,
  cacheAttendanceState,
} from '@/lib/offlineAttendance';

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
    <td className={`p-2 border-r border-indigo-100/40 text-center relative h-14 min-w-[80px] transition-colors ${isGovHoliday ? 'bg-amber-50/40' : isWeekend ? 'bg-slate-50/50' : ''
      }`}>
      {!status ? (
        <button
          onClick={onEditClick}
          className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto transition-all text-xs font-semibold touch-manipulation ${isGovHoliday
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
          className={`w-14 py-1.5 rounded-xl text-[10px] font-bold mx-auto flex items-center justify-center border transition-all hover:scale-105 touch-manipulation ${status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' :
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
}, (prev, next) => (
  prev.status === next.status &&
  prev.isEditing === next.isEditing &&
  prev.holiday?.date === next.holiday?.date &&
  prev.holiday?.type === next.holiday?.type
));

MemoizedAttendanceCell.displayName = 'MemoizedAttendanceCell';

interface ThaiDateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const ThaiDateRangePicker = memo(({ startDate, endDate, onChange }: ThaiDateRangePickerProps) => {
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
      window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, { capture: true });
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
          className="fixed z-[9999] w-[320px] sm:w-[360px] bg-white p-4 sm:p-5 rounded-3xl border border-indigo-100 shadow-2xl shadow-indigo-500/20 animate-scale-up text-slate-800"
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
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${isPresetActive(days)
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
  student_count?: number;
}

export interface ParsedClassroomName {
  code: string | null;
  subjectTitle: string;
  groupName: string | null;
  curriculumType: 'pvs' | 'pvch' | 'other';
}

export function parseClassroomName(fullName: string): ParsedClassroomName {
  if (!fullName) {
    return { code: null, subjectTitle: '', groupName: null, curriculumType: 'other' };
  }

  const trimmed = fullName.trim();
  const codeMatch = trimmed.match(/^([0-9]{4,5}-[0-9]{4}|[A-Za-z0-9-]{5,12})\s+/);
  const code = codeMatch ? codeMatch[1] : null;
  const afterCode = codeMatch ? trimmed.slice(codeMatch[0].length).trim() : trimmed;

  const groupMatch = afterCode.match(/\s+((?:\([^\)]+\)\s*)?(?:ชก|ชย|ชค|ชอ|ชส|บช|กต|คธ|ทธ|อส)?\s*(?:ปวช\.|ปวส\.|ม\.)\s*[0-9]+(?:\/[0-9]+)?|[0-9]+\/[0-9]+)$/);

  let groupName: string | null = null;
  let subjectTitle = afterCode;

  if (groupMatch && groupMatch.index !== undefined) {
    groupName = groupMatch[1].trim();
    subjectTitle = afterCode.slice(0, groupMatch.index).trim();
  }

  const isPvs = fullName.includes('ปวส') || (groupName?.includes('ปวส') ?? false);
  const isPvch = fullName.includes('ปวช') || (groupName?.includes('ปวช') ?? false);

  return {
    code,
    subjectTitle: subjectTitle || fullName,
    groupName,
    curriculumType: isPvs ? 'pvs' : isPvch ? 'pvch' : 'other',
  };
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
  grade_level?: string | null;
  branch?: string | null;
  avatar?: string | null;
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

interface MobileStudentAttendanceCardProps {
  student: Student;
  status: string | undefined;
  stats: StudentStats;
  maxAllowedAbsences: number;
  sectionBadge?: string | null;
  onStatusSelect: (studentId: string, status: string) => void;
  onViewHistory: (student: Student) => void;
}

const MobileStudentAttendanceCard = memo(({
  student,
  status,
  stats,
  maxAllowedAbsences,
  sectionBadge,
  onStatusSelect,
  onViewHistory,
}: MobileStudentAttendanceCardProps) => {
  const isCloseToFRisk = stats.converted_absent_count >= maxAllowedAbsences * 0.75;

  return (
    <div className="p-3.5 bg-white dark:bg-slate-850 rounded-2xl border border-indigo-100/90 dark:border-slate-800 shadow-sm space-y-2.5 transition-all">
      {/* Header: Avatar, Name, Code, History, and Absence Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar avatar={student.avatar} name={student.name} userId={student.id} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{student.name}</span>
              <button
                type="button"
                onClick={() => onViewHistory(student)}
                className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="ดูประวัติการมาเรียน"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">รหัส: {student.student_code || '-'}</p>
              {sectionBadge && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                  {sectionBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Absence Warning Pill */}
        <div className="shrink-0 text-right">
          {stats.is_f ? (
            <span className="text-[10px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse border border-red-700">
              หมดสิทธิ์เรียน
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${isCloseToFRisk
              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse'
              : stats.converted_absent_count > 0
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
              ขาด {stats.converted_absent_count}/{maxAllowedAbsences}
            </span>
          )}
        </div>
      </div>

      {/* Status Buttons Grid - 4 large thumb-friendly buttons (min-h-[44px]) */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => onStatusSelect(student.id, 'present')}
          className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 cursor-pointer ${status === 'present'
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400 font-black'
            : 'bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200/80 dark:border-slate-700'
            }`}
        >
          <CheckCircle className={`w-4 h-4 ${status === 'present' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
          <span>มา</span>
        </button>

        <button
          type="button"
          onClick={() => onStatusSelect(student.id, 'late')}
          className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 cursor-pointer ${status === 'late'
            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-400 font-black'
            : 'bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200/80 dark:border-slate-700'
            }`}
        >
          <Clock className={`w-4 h-4 ${status === 'late' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
          <span>สาย</span>
        </button>

        <button
          type="button"
          onClick={() => onStatusSelect(student.id, 'absent')}
          className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 cursor-pointer ${status === 'absent'
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-400 font-black'
            : 'bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 border border-slate-200/80 dark:border-slate-700'
            }`}
        >
          <XCircle className={`w-4 h-4 ${status === 'absent' ? 'text-white' : 'text-rose-500 dark:text-rose-400'}`} />
          <span>ขาด</span>
        </button>

        <button
          type="button"
          onClick={() => onStatusSelect(student.id, 'leave')}
          className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 cursor-pointer ${status === 'leave'
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-400 font-black'
            : 'bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-700'
            }`}
        >
          <FileText className={`w-4 h-4 ${status === 'leave' ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
          <span>ลา</span>
        </button>
      </div>

      {(stats.remaining_late_count > 0 || stats.remaining_leave_count > 0) && (
        <div className="flex gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
          {stats.remaining_late_count > 0 && <span>สายสะสม {stats.remaining_late_count}</span>}
          {stats.remaining_leave_count > 0 && <span>ลาสะสม {stats.remaining_leave_count}</span>}
        </div>
      )}
    </div>
  );
});

MobileStudentAttendanceCard.displayName = 'MobileStudentAttendanceCard';

interface DesktopStudentRowProps {
  student: Student;
  idx: number;
  showRoomPill?: boolean;
  status: string | undefined;
  stats: StudentStats;
  maxAllowedAbsences: number;
  onStatusSelect: (studentId: string, status: string) => void;
  onViewHistory: (student: Student) => void;
}

const MemoizedDesktopStudentRow = memo(({
  student,
  idx,
  showRoomPill = false,
  status,
  stats,
  maxAllowedAbsences,
  onStatusSelect,
  onViewHistory,
}: DesktopStudentRowProps) => {
  const isCloseToFRisk = stats.converted_absent_count >= maxAllowedAbsences * 0.75;
  const sId = String(student.id);

  const renderStatusBtn = (statusVal: string, icon: React.ReactNode, label: string, activeClass: string) => {
    const isActive = status === statusVal;
    return (
      <button
        type="button"
        onClick={() => onStatusSelect(sId, statusVal)}
        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer select-none ${isActive
          ? `${activeClass} [&>svg]:text-white shadow-xs scale-[1.02]`
          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
        }`}
        title={`ทำเครื่องหมาย: ${label}`}
      >
        {icon} <span>{label}</span>
      </button>
    );
  };

  return (
    <div
      key={student.id}
      className={`px-4 py-3 sm:py-3.5 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-4 shadow-2xs hover:shadow-xs ${
        status === 'present'
          ? 'bg-emerald-50/20 dark:bg-slate-850/95 border-emerald-300 dark:border-emerald-800/80 ring-1 ring-emerald-400/20'
          : status === 'absent'
          ? 'bg-rose-50/20 dark:bg-slate-850/95 border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-400/20'
          : status === 'late'
          ? 'bg-amber-50/20 dark:bg-slate-850/95 border-amber-300 dark:border-amber-800/80 ring-1 ring-amber-400/20'
          : status === 'leave'
          ? 'bg-sky-50/20 dark:bg-slate-850/95 border-sky-300 dark:border-sky-800/80 ring-1 ring-sky-400/20'
          : 'bg-white dark:bg-slate-850/90 border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-750'
      }`}
    >
      {/* Left Side: Number, Avatar, Name, Code, Room Badge, and Risk Tag */}
      <div className="flex items-center gap-3 min-w-0 w-80 lg:w-96 shrink-0">
        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-6 text-right shrink-0">
          {idx + 1}
        </span>
        <UserAvatar
          avatar={student.avatar}
          name={student.name}
          userId={student.id}
          size="md"
          className="rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-xs shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate" title={student.name}>
              {student.name}
            </span>
            {stats.is_f ? (
              <span className="text-[10px] font-extrabold text-white bg-rose-600 px-2 py-0.5 rounded-md animate-pulse border border-rose-700 shadow-2xs whitespace-nowrap">
                มส. (หมดสิทธิ์สอบ)
              </span>
            ) : isCloseToFRisk ? (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 whitespace-nowrap">
                ⚠️ เสี่ยง มส.
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {student.student_code ? `รหัส ${student.student_code}` : '-'}
            </span>
            {showRoomPill && student.grade_level && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {student.grade_level}
              </span>
            )}
            <button
              type="button"
              onClick={() => onViewHistory(student)}
              className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer ml-1"
              title="ดูประวัติการมาเรียนอย่างละเอียด"
            >
              <History className="w-3 h-3" />
              <span>ประวัติ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Center: Large, Tactile Check-in Buttons */}
      <div className="inline-flex items-center gap-2 shrink-0">
        {renderStatusBtn('present', <CheckCircle className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-400 shrink-0" />, 'มาเรียน', 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/20')}
        {renderStatusBtn('late', <Clock className="w-[18px] h-[18px] text-amber-500 dark:text-amber-400 shrink-0" />, 'สาย', 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-400/20')}
        {renderStatusBtn('absent', <XCircle className="w-[18px] h-[18px] text-rose-500 dark:text-rose-400 shrink-0" />, 'ขาด', 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/20')}
        {renderStatusBtn('leave', <FileText className="w-[18px] h-[18px] text-sky-500 dark:text-sky-400 shrink-0" />, 'ลา', 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-500/20')}
      </div>

      {/* Right Side: Attendance Quota Progress Bar & Secondary Stats */}
      <div className="flex items-center gap-3 w-56 lg:w-64 justify-end shrink-0">
        <div className="w-full">
          <div className="flex justify-between items-center text-[11px] font-bold mb-1">
            <span className={stats.converted_absent_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}>
              ขาด {stats.converted_absent_count} / {maxAllowedAbsences} คาบ
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              {stats.is_f ? 'หมดสิทธิ์สอบ' : `ขาดได้อีก ${Math.max(0, maxAllowedAbsences - stats.converted_absent_count)} คาบ`}
            </span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCloseToFRisk
                  ? 'bg-rose-500 animate-pulse'
                  : stats.converted_absent_count >= maxAllowedAbsences * 0.5
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min((stats.converted_absent_count / (maxAllowedAbsences || 1)) * 100, 100)}%` }}
            />
          </div>
          {(stats.remaining_late_count > 0 || stats.remaining_leave_count > 0) && (
            <div className="flex gap-1.5 text-[9px] mt-1 font-bold justify-end">
              {stats.remaining_late_count > 0 && (
                <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800">
                  สาย {stats.remaining_late_count}
                </span>
              )}
              {stats.remaining_leave_count > 0 && (
                <span className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-200/60 dark:border-sky-800">
                  ลา {stats.remaining_leave_count}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.student.id === next.student.id &&
    prev.student.name === next.student.name &&
    prev.student.avatar === next.student.avatar &&
    prev.student.student_code === next.student.student_code &&
    prev.idx === next.idx &&
    prev.showRoomPill === next.showRoomPill &&
    prev.status === next.status &&
    prev.maxAllowedAbsences === next.maxAllowedAbsences &&
    prev.stats.converted_absent_count === next.stats.converted_absent_count &&
    prev.stats.remaining_late_count === next.stats.remaining_late_count &&
    prev.stats.remaining_leave_count === next.stats.remaining_leave_count &&
    prev.stats.is_f === next.stats.is_f &&
    prev.onStatusSelect === next.onStatusSelect &&
    prev.onViewHistory === next.onViewHistory
  );
});

MemoizedDesktopStudentRow.displayName = 'MemoizedDesktopStudentRow';

export default function Attendance() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>กำลังบันทึกอัตโนมัติ...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-all">
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกสำเร็จ</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>บันทึกไม่สำเร็จ</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 font-medium">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
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
    return allTimetableEntries.filter(e => {
      if (e.day_of_week !== schemaDayOfWeek) return false;
      // กรองคาบหน้าเสาธง/โฮมรูม/เข้าแถว ออก ไม่นำมาแสดงเป็นคาบเรียนวันนี้
      if (e.start_period === 0) return false;
      if (e.entry_type === 'homeroom') return false;
      const name = `${e.subject_name || ''} ${e.subject_code || ''}`.toLowerCase();
      if (name.includes('เสาธง') || name.includes('โฮมรูม') || name.includes('เข้าแถว')) return false;
      return true;
    });
  }, [allTimetableEntries]);

  // ─── State: วันที่มีการสอนของห้องเรียนนี้ (0=Mon .. 6=Sun) ───
  const [teachingDays, setTeachingDays] = useState<number[]>([0, 1, 2, 3, 4]);

  useEffect(() => {
    if (!selectedClass) return;
    const classEntries = allTimetableEntries.filter(
      e => String(e.classroom_id) === String(selectedClass) &&
        e.start_period !== 0 &&
        e.entry_type !== 'homeroom' &&
        !e.subject_name?.includes('เสาธง') &&
        !e.subject_name?.includes('เข้าแถว')
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
        api.get(`/students?classroom_id=${selectedClass}&include_avatar=true`),
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

  // Reset local state if no class is selected, and reset section filter when switching classrooms
  useEffect(() => {
    setSelectedSectionKey('all');
    setCollapsedSections({});
    if (!selectedClass) {
      setStudents([]);
      setAttendance({});
      setStats([]);
    }
  }, [selectedClass]);

  // ─── Sub-room / Section Grouping (แยกห้องย่อยเมื่อเรียนรวม เช่น ปวช.1/1 + ปวช.1/2) ───
  const { groups: sectionGroups, hasMultipleSections, sharedBranch } = useMemo(
    () => buildStudentSectionGroups(students),
    [students]
  );

  useEffect(() => {
    if (selectedSectionKey !== 'all' && !sectionGroups.some(g => g.key === selectedSectionKey)) {
      setSelectedSectionKey('all');
    }
  }, [selectedSectionKey, sectionGroups]);

  const activeSectionGroup = useMemo(
    () => (selectedSectionKey === 'all' ? null : sectionGroups.find(g => g.key === selectedSectionKey) || null),
    [selectedSectionKey, sectionGroups]
  );

  const sectionScopedStudents = useMemo(() => {
    if (activeSectionGroup) return activeSectionGroup.students;
    if (sectionGroups.length > 0) return sectionGroups.flatMap(g => g.students);
    return students;
  }, [activeSectionGroup, sectionGroups, students]);

  // Filters students by search query within active section scope (Memoized)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionScopedStudents;
    return sectionScopedStudents.filter(student =>
      student.name.toLowerCase().includes(q) ||
      (student.student_code && student.student_code.toLowerCase().includes(q)) ||
      (student.grade_level && student.grade_level.toLowerCase().includes(q)) ||
      (student.branch && student.branch.toLowerCase().includes(q))
    );
  }, [sectionScopedStudents, searchQuery]);

  // Grouped sections filtered by searchQuery (for combined 'all' mode when hasMultipleSections)
  const visibleSectionGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionGroups;
    return sectionGroups
      .map(grp => ({
        ...grp,
        students: grp.students.filter(student =>
          student.name.toLowerCase().includes(q) ||
          (student.student_code && student.student_code.toLowerCase().includes(q)) ||
          (student.grade_level && student.grade_level.toLowerCase().includes(q)) ||
          (student.branch && student.branch.toLowerCase().includes(q))
        ),
      }))
      .filter(grp => grp.students.length > 0);
  }, [sectionGroups, searchQuery]);

  // Live daily statistics per section (for section switcher badges & group headers)
  const sectionDailyStatsMap = useMemo(() => {
    const map: Record<string, { present: number; late: number; absent: number; leave: number; marked: number; total: number }> = {};
    sectionGroups.forEach(grp => {
      const st = { present: 0, late: 0, absent: 0, leave: 0, marked: 0, total: grp.students.length };
      grp.students.forEach(s => {
        const val = attendance[s.id];
        if (val) {
          st.marked++;
          if (val === 'present') st.present++;
          else if (val === 'late') st.late++;
          else if (val === 'absent') st.absent++;
          else if (val === 'leave') st.leave++;
        }
      });
      map[grp.key] = st;
    });
    return map;
  }, [sectionGroups, attendance]);

  const overallDailyMarked = useMemo(
    () => students.reduce((acc, s) => (attendance[s.id] ? acc + 1 : acc), 0),
    [students, attendance]
  );

  // Daily statistics calculated in real-time for active scope (Memoized)
  const dailyStats = useMemo(() => {
    const scStats = {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      total: sectionScopedStudents.length,
      marked: 0
    };

    sectionScopedStudents.forEach(s => {
      const sStatus = attendance[s.id];
      if (sStatus) {
        scStats.marked++;
        if (sStatus === 'present') scStats.present++;
        else if (sStatus === 'late') scStats.late++;
        else if (sStatus === 'absent') scStats.absent++;
        else if (sStatus === 'leave') scStats.leave++;
      }
    });
    return scStats;
  }, [sectionScopedStudents, attendance]);

  const toggleSectionCollapse = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }, []);



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

  // Cache roster and attendance state for offline use
  useEffect(() => {
    if (selectedClass && students && students.length > 0) {
      cacheClassroomRoster(selectedClass, students);
    }
  }, [selectedClass, students]);

  useEffect(() => {
    if (selectedClass && date && Object.keys(attendance).length > 0) {
      cacheAttendanceState(selectedClass, date, attendance);
    }
  }, [selectedClass, date, attendance]);

  // ─── Mutation: บันทึกการเข้าเรียนรายบุคคล (Auto Save with Offline Fallback) ───
  const singleStatusMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: date,
          status: status,
        });
        return { offline: true };
      }
      return api.post('/attendance', {
        student_id: Number(studentId),
        classroom_id: Number(selectedClass),
        date: date,
        status: status
      }).catch(() => {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: date,
          status: status,
        });
        return { offline: true };
      });
    },
    onMutate: () => {
      setAutoSaveStatus('saving');
    },
    onSuccess: (res: { offline?: boolean } | unknown) => {
      setAutoSaveStatus('saved');
      if ((res as { offline?: boolean })?.offline) {
        toast('บันทึกข้อมูลในเครื่องแล้ว (โหมดออฟไลน์)', { icon: '💾', duration: 2000 });
      } else {
        queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
      }
    },
    onError: () => {
      setAutoSaveStatus('error');
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ');
    }
  });

  const handleStatusChange = useCallback((studentId: string, status: string) => {
    const current = attendance[studentId];
    // Toggle off if clicking the active status
    const newStatus = current === status ? '' : status;

    setAttendance(prev => ({ ...prev, [studentId]: newStatus }));

    if (newStatus === '') {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        toast('ลบสถานะในเครื่องแล้ว (โหมดออฟไลน์)', { icon: '🗑️' });
        return;
      }
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
  }, [attendance, selectedClass, date, autoSave, singleStatusMutation, queryClient]);

  // ─── Mutation: บันทึกข้อมูลการเข้าเรียนด้วยตนเอง (Manual Save with Offline Fallback) ───
  const saveMutation = useMutation({
    mutationFn: async (records: Array<{ student_id: number; classroom_id: number; date: string; status: string }>) => {
      return api.post('/attendance', { records });
    },
    onSuccess: () => {
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
    onError: (_err, variables) => {
      // If network failed, save to offline queue as fallback
      enqueueBatchOfflineAttendance(variables.map(r => ({
        studentId: r.student_id,
        classroomId: r.classroom_id,
        date: r.date,
        status: r.status,
      })));
      toast.success('บันทึกข้อมูลการเช็คชื่อลงเครื่องแล้ว (จะซิงค์ขึ้นระบบเมื่อมีอินเทอร์เน็ต)', { icon: '💾' });
    }
  });

  const handleSave = () => {
    if (!selectedClass || sectionScopedStudents.length === 0) return;

    const uncheckedInScope = sectionScopedStudents.filter(s => !attendance[s.id]);
    if (activeSectionGroup) {
      if (uncheckedInScope.length > 0) {
        toast.error(`กรุณาเช็คชื่อนักเรียนห้อง ${activeSectionGroup.label} ให้ครบทุกคนก่อนบันทึก (เหลืออีก ${uncheckedInScope.length} คน)`);
        return;
      }
    } else if (uncheckedInScope.length > 0) {
      const checkedCount = sectionScopedStudents.length - uncheckedInScope.length;
      if (!hasMultipleSections || checkedCount === 0) {
        toast.error(`กรุณาเช็คชื่อนักเรียนให้ครบทุกคนก่อนบันทึก (เหลืออีก ${uncheckedInScope.length} คน)`);
        return;
      }
      if (!confirm(`ยังมีนักเรียนที่ไม่ได้เช็คชื่ออีก ${uncheckedInScope.length} คน (เช็คแล้ว ${checkedCount}/${sectionScopedStudents.length} คน)\n\nต้องการบันทึกเฉพาะรายชื่อที่เช็คแล้วหรือไม่?`)) {
        return;
      }
    }

    const records = students
      .filter(s => Boolean(attendance[s.id]))
      .map(s => ({
        student_id: Number(s.id),
        classroom_id: Number(selectedClass),
        date: date,
        status: attendance[s.id]
      }));

    if (records.length === 0) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueBatchOfflineAttendance(records.map(r => ({
        studentId: r.student_id,
        classroomId: r.classroom_id,
        date: r.date,
        status: r.status,
      })));
      toast.success('บันทึกข้อมูลการเช็คชื่อลงเครื่องเรียบร้อย (โหมดออฟไลน์) จะซิงค์เมื่อมีเน็ต', { icon: '💾' });
      return;
    }

    saveMutation.mutate(records);
  };

  // ─── Mutation: อัปเดตข้อมูลเข้าเรียน Matrix (พร้อมโหมดออฟไลน์) ───
  const matrixCellUpdateMutation = useMutation({
    mutationFn: async ({ studentId, dateStr, status }: { studentId: string; dateStr: string; status: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: dateStr,
          status: status,
        });
        return { offline: true };
      }
      return api.post('/attendance', {
        records: [{
          student_id: Number(studentId),
          classroom_id: Number(selectedClass),
          date: dateStr,
          status: status
        }]
      }).catch(() => {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: dateStr,
          status: status,
        });
        return { offline: true };
      });
    },
    onSuccess: (res: { offline?: boolean } | unknown) => {
      if ((res as { offline?: boolean })?.offline) {
        toast.success('บันทึกข้อมูลในเครื่องแล้ว (โหมดออฟไลน์)', { icon: '💾' });
      } else {
        toast.success('อัปเดตข้อมูลการเข้าเรียนเรียบร้อย');
        queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate] });
        queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
        queryClient.invalidateQueries({ queryKey: ['grades'] });
      }
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

  const statsMap = useMemo(() => {
    const map = new Map<string, (typeof stats)[number]>();
    (stats || []).forEach(s => map.set(String(s.student_id), s));
    return map;
  }, [stats]);

  const getStudentStats = useCallback((studentId: string) => {
    return statsMap.get(String(studentId)) || {
      student_id: studentId,
      present_count: 0, late_count: 0, absent_count: 0,
      leave_count: 0, converted_absent_count: 0, remaining_late_count: 0, remaining_leave_count: 0
    };
  }, [statsMap]);

  const statusBtn = (id: string, status: string, icon: React.ReactNode, label: string, activeClass: string) => {
    const isActive = attendance[id] === status;
    return (
      <button
        type="button"
        onClick={() => handleStatusChange(id, status)}
        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer select-none ${isActive
          ? `${activeClass} [&>svg]:text-white shadow-xs scale-[1.02]`
          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        {icon} <span>{label}</span>
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

  // ─── Mutation: ล้างข้อมูลการเข้าเรียน (ทั้งห้อง หรือ เฉพาะห้องย่อยที่เลือก) ───
  const clearDataMutation = useMutation({
    mutationFn: async (params?: { studentIds?: string[]; sectionLabel?: string }) => {
      const idsQuery = params?.studentIds && params.studentIds.length > 0
        ? `&student_ids=${params.studentIds.join(',')}`
        : '';
      return api.delete(`/attendance?classroom_id=${selectedClass}&date=${date}${idsQuery}`);
    },
    onSuccess: (_res, params) => {
      if (params?.studentIds && params.studentIds.length > 0) {
        const idSet = new Set(params.studentIds.map(String));
        setAttendance(prev => {
          const next = { ...prev };
          idSet.forEach(id => {
            delete next[id];
          });
          return next;
        });
        toast.success(`ลบข้อมูลการเช็คชื่อห้อง ${params.sectionLabel || ''} ของวันที่เลือกเรียบร้อยแล้ว`);
      } else {
        setAttendance({});
        toast.success('ลบข้อมูลการเช็คชื่อของวันที่เลือกเรียบร้อยแล้ว');
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass] });
    },
    onError: () => {
      toast.error('ลบข้อมูลไม่สำเร็จ');
    }
  });

  const handleClearData = () => {
    if (!selectedClass || sectionScopedStudents.length === 0) return;

    const dateObj = new Date(date);
    const formattedDateForConfirm = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    if (activeSectionGroup) {
      if (!confirm(`⚠️ ยืนยันการลบข้อมูลเช็คชื่อเฉพาะห้องย่อย?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของห้อง "${activeSectionGroup.label}" (${activeSectionGroup.students.length} คน)\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(ข้อมูลของห้องย่อยอื่นในรายวิชานี้จะไม่ถูกลบ)`)) {
        return;
      }
      clearDataMutation.mutate({
        studentIds: activeSectionGroup.students.map(s => String(s.id)),
        sectionLabel: activeSectionGroup.label,
      });
      return;
    }

    if (!confirm(`⚠️ ยืนยันการลบข้อมูลเช็คชื่อ?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของทุกคนในห้องนี้\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(เหมาะสำหรับกรณีลงชื่อผิดวัน หรือต้องการเริ่มลงใหม่ของวันนี้)`)) {
      return;
    }
    clearDataMutation.mutate(undefined);
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
    mutationFn: async ({ records }: { status?: string; records: Array<{ student_id: number; classroom_id: number; date: string; status: string }> }) => {
      return api.post('/attendance', { records });
    },
    onMutate: () => {
      setAutoSaveStatus('saving');
    },
    onSuccess: () => {
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
    onError: () => {
      setAutoSaveStatus('error');
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ');
    }
  });

  const handleMarkStudents = useCallback((targetStudents: Student[], status: string, scopeLabel?: string) => {
    if (targetStudents.length === 0) return;
    setAttendance(prev => {
      const next = { ...prev };
      targetStudents.forEach(student => {
        next[student.id] = status;
      });
      return next;
    });
    const statusText = status === 'present' ? 'มาเรียน' : status === 'absent' ? 'ขาด' : status === 'late' ? 'สาย' : 'ลา';
    toast.success(`เลือก "${statusText}" ให้กับ${scopeLabel ? `ห้อง ${scopeLabel}` : 'รายชื่อที่แสดงอยู่'} (${targetStudents.length} คน)`);

    if (autoSave) {
      const records = targetStudents.map(student => ({
        student_id: Number(student.id),
        classroom_id: Number(selectedClass),
        date: date,
        status: status
      }));
      markAllMutation.mutate({ status, records });
    }
  }, [autoSave, selectedClass, date, markAllMutation]);

  const handleMarkAll = (status: string) => {
    handleMarkStudents(filteredStudents, status, activeSectionGroup?.label);
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

  const matrixDates = useMemo(() => {
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
  }, [matrixRecords, matrixStartDate, matrixEndDate, teachingDays]);

  // O(1) lookup map for matrix cells instead of O(N) .find() inside nested student x date loops
  const matrixRecordMap = useMemo(() => {
    const map = new Map<string, string>();
    matrixRecords.forEach(r => {
      if (r.date && r.student_id !== undefined) {
        const dStr = r.date.split('T')[0];
        if (dStr) {
          map.set(`${r.student_id}_${dStr}`, r.status);
        }
      }
    });
    return map;
  }, [matrixRecords]);
  const selectedClassData = classrooms.find(c => String(c.id) === String(selectedClass));
  const maxAllowedAbsences = selectedClassData ? Math.floor((Number(selectedClassData.total_classes) || 40) * (100 - (Number(selectedClassData.min_attendance_percent) || 80)) / 100) : 0;

  const activeParsed = useMemo(() => {
    return selectedClassData ? parseClassroomName(selectedClassData.name) : null;
  }, [selectedClassData]);

  const [classFilter, setClassFilter] = useState<'all' | 'today' | 'pvch' | 'pvs'>('all');
  const [classSearch, setClassSearch] = useState('');

  const todayClassroomIds = useMemo(() => {
    return new Set(
      todayEntries
        .filter(e => e.classroom_id)
        .map(e => String(e.classroom_id))
    );
  }, [todayEntries]);

  const todayCount = useMemo(() => {
    return classrooms.filter(c => todayClassroomIds.has(String(c.id))).length;
  }, [classrooms, todayClassroomIds]);

  const pvchCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch').length;
  }, [classrooms]);

  const pvsCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs').length;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    let list = classrooms;
    if (classFilter === 'today') {
      list = list.filter(c => todayClassroomIds.has(String(c.id)));
    } else if (classFilter === 'pvch') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch');
    } else if (classFilter === 'pvs') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs');
    }
    if (classSearch.trim()) {
      const q = classSearch.toLowerCase().trim();
      list = list.filter(c => c.name?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aToday = todayClassroomIds.has(String(a.id)) ? 1 : 0;
      const bToday = todayClassroomIds.has(String(b.id)) ? 1 : 0;
      return bToday - aToday;
    });
  }, [classrooms, classFilter, classSearch, todayClassroomIds]);

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

  const renderMatrixStudentRow = (student: Student, idx: number, showRoomSubtitle = false) => (
    <tr
      key={student.id}
      className={`border-b border-indigo-50/50 dark:border-slate-800/80 hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 transition-colors ${
        idx % 2 === 0 ? 'bg-slate-50/40 dark:bg-slate-800/25' : 'bg-transparent'
      }`}
    >
      <td className="p-4 font-semibold text-slate-800 dark:text-slate-100 text-sm sticky left-0 bg-white dark:bg-slate-900 z-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] border-r border-indigo-100 dark:border-slate-800 flex items-center gap-2 h-14 overflow-hidden text-ellipsis whitespace-nowrap">
        <UserAvatar avatar={student.avatar} name={student.name} userId={student.id} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs truncate leading-snug">{student.name}</p>
          {(student.student_code || (showRoomSubtitle && student.grade_level)) && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5 truncate">
              {student.student_code || '-'}
              {showRoomSubtitle && student.grade_level ? ` · ${student.grade_level}` : ''}
            </p>
          )}
        </div>
      </td>

      {matrixDates.map(dateStr => {
        const status = matrixRecordMap.get(`${student.id}_${dateStr}`) ?? null;
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <p className="text-slate-500 font-medium animate-pulse">กำลังดาวน์โหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Offline Status & Sync Banner */}
      <OfflineBanner
        onSyncComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
          queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass] });
        }}
      />

      {/* Active Classroom Bar (เมื่อเลือกห้องแล้ว) */}
      {selectedClass && selectedClassData && activeParsed && (
        <div className="glass dark:bg-slate-900/85 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 shadow-xl shadow-indigo-100/30 dark:shadow-black/40 space-y-4 backdrop-blur-xl">
          {/* Top Row: Course Info & Quick Switcher + Tools */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeParsed.code && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                      {activeParsed.code}
                    </span>
                  )}
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${activeParsed.curriculumType === 'pvs'
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    }`}>
                    {activeParsed.curriculumType === 'pvs' ? 'ปวส.' : 'ปวช.'}
                  </span>
                  {activeParsed.groupName && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shadow-2xs">
                      {activeParsed.groupName}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    (👥 {selectedClassData.student_count || students.length || 0} คน)
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-tight mt-1 truncate" title={activeParsed.subjectTitle}>
                  {activeParsed.subjectTitle}
                </h2>
              </div>
            </div>

            {/* Quick Switch / เปลี่ยนห้อง & Action Tools */}
            <div className="flex items-center gap-2 shrink-0 self-start lg:self-center flex-wrap">
              <button
                type="button"
                onClick={() => { setExportStartDate(''); setExportEndDate(''); setShowExportModal(true); }}
                className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                title="พรีวิวและส่งออกข้อมูลการเช็คชื่อเป็น CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ส่งออก CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                title="นำเข้าข้อมูลการเช็คชื่อจากไฟล์ Excel พร้อมดูตัวอย่างรูปแบบและดาวน์โหลดเทมเพลต"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>นำเข้า Excel</span>
              </button>

              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="form-input text-xs font-bold py-2 pl-3 pr-8 bg-white/90 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 transition-all text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs max-w-[200px] sm:max-w-[240px] truncate"
                  title="สลับห้องเรียนเร็ว"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-800 dark:text-slate-200">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClass('')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all shadow-xs cursor-pointer shrink-0"
                title="ย้อนกลับไปดูการ์ดห้องเรียนทั้งหมด"
              >
                <Grid className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>การ์ดทั้งหมด</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100/80 dark:border-slate-800" />

          {/* Bottom Row: Tab Switcher & Attendance Threshold Badge */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-0.5">
            {/* View Mode Tabs */}
            <div className="flex bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shrink-0">
              <button
                onClick={() => setActiveTab('daily')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'daily'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                  }`}
              >
                <List className="w-4 h-4" />
                <span>เช็คชื่อประจำวัน</span>
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                  }`}
              >
                <Grid className="w-4 h-4" />
                <span>ตารางประวัติย้อนหลัง</span>
              </button>
            </div>

            {/* Attendance Threshold Info Pill */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-indigo-100/90 dark:border-slate-700 text-indigo-950 dark:text-indigo-200 text-xs font-medium shrink-0 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="leading-tight">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">เวลาเรียนขั้นต่ำ: </span>
                  <strong className="font-black text-indigo-900 dark:text-indigo-300">{selectedClassData.min_attendance_percent || 80}%</strong>
                </div>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
                <div className="leading-tight">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">ขาดได้ไม่เกิน: </span>
                  <strong className="font-black text-rose-600 dark:text-rose-400">{maxAllowedAbsences} คาบ</strong>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] font-normal"> / {selectedClassData.total_classes || 40} คาบ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-room / Section Switcher Bar (แสดงอัตโนมัติเมื่อห้องเรียนมีหลายห้องย่อย เช่น ปวช.1/1 เรียนรวมกับ ปวช.1/2) */}
          {hasMultipleSections && (
            <>
              <div className="border-t border-slate-100/80 dark:border-slate-800" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-800 dark:text-indigo-300 mr-1">
                    <GitBranch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>แยกห้องเช็คชื่อ:</span>
                    {sharedBranch && (
                      <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800 font-bold text-[11px]">
                        สาขา{sharedBranch}
                      </span>
                    )}
                  </div>

                  {/* Pill: รวมทุกห้อง */}
                  <button
                    type="button"
                    onClick={() => setSelectedSectionKey('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${selectedSectionKey === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-white/90 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700'
                      }`}
                    title="แสดงรายชื่อรวมทุกห้องย่อย (จัดกลุ่มแยกหัวข้อให้ตามห้อง)"
                  >
                    <span>รวมทุกห้อง</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${selectedSectionKey === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                      {students.length}
                    </span>
                  </button>

                  {/* Pills per Sub-room / Section */}
                  {sectionGroups.map(grp => {
                    const isSelected = selectedSectionKey === grp.key;
                    const secStats = sectionDailyStatsMap[grp.key];
                    const isAllMarked = secStats && secStats.total > 0 && secStats.marked === secStats.total;
                    const isPartialMarked = secStats && secStats.marked > 0 && secStats.marked < secStats.total;

                    return (
                      <button
                        key={grp.key}
                        type="button"
                        onClick={() => setSelectedSectionKey(grp.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isSelected
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-white/90 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700'
                          }`}
                        title={`สลับไปเช็คชื่อเฉพาะห้อง ${grp.label} (${grp.students.length} คน)`}
                      >
                        <span>{grp.label}</span>
                        {activeTab === 'daily' && secStats ? (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-0.5 ${isSelected
                            ? isAllMarked
                              ? 'bg-emerald-400/30 text-white border border-emerald-200/40'
                              : 'bg-white/20 text-white'
                            : isAllMarked
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isPartialMarked
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                            {isAllMarked && <Check className="w-2.5 h-2.5" />}
                            <span>{secStats.marked}/{secStats.total}</span>
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                            {grp.students.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeTab === 'daily' && selectedSectionKey !== 'all' && (
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 shrink-0">
                    <span>เช็ครวมทั้งวิชาวันนี้:</span>
                    <strong className={overallDailyMarked === students.length ? 'text-emerald-600 font-extrabold' : 'text-indigo-700 font-extrabold'}>
                      {overallDailyMarked}/{students.length} คน
                    </strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Classroom Card Grid Selector (เมื่อยังไม่ได้เลือกห้องเรียน) */}
      {!selectedClass ? (
        <div className="space-y-5 animate-fade-in">
          {/* Header & Filters */}
          <div className="glass dark:bg-slate-900/85 p-5 sm:p-6 rounded-3xl border border-white/60 dark:border-slate-800 bg-white/95 dark:bg-slate-900 shadow-xl shadow-indigo-100/20 dark:shadow-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>เลือกห้องเรียนเพื่อบันทึกเวลาเรียน</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                    {classrooms.length} ห้อง
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">เลือกห้องเรียนเพื่อเริ่มเช็คชื่อรายวันหรือดูตารางเวลาเรียนสะสม</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setClassFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${classFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  ทั้งหมด ({classrooms.length})
                </button>
                {todayCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setClassFilter('today')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${classFilter === 'today'
                      ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-400'
                      : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/50'
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    มีสอนวันนี้ ({todayCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setClassFilter('pvch')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${classFilter === 'pvch'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  ปวช. ({pvchCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClassFilter('pvs')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${classFilter === 'pvs'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  ปวส. ({pvsCount})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={e => setClassSearch(e.target.value)}
                  placeholder="ค้นหารหัสวิชา, ชื่อวิชา..."
                  className="w-full pl-9 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-500 shadow-2xs"
                />
                {classSearch && (
                  <button
                    type="button"
                    onClick={() => setClassSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Classroom Cards Grid */}
          {filteredClassrooms.length === 0 ? (
            <div className="glass dark:bg-slate-900/80 p-12 text-center rounded-2xl border border-white/40 dark:border-slate-800 shadow-sm">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">ไม่พบห้องเรียนที่ตรงกับเงื่อนไข</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {classSearch ? `ไม่มีห้องเรียนที่ตรงกับคำค้นหา "${classSearch}"` : 'ยังไม่มีห้องเรียนในกลุ่มนี้'}
              </p>
              {(classSearch || classFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setClassSearch(''); setClassFilter('all'); }}
                  className="mt-3.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-slate-700 transition-colors"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredClassrooms.map(c => {
                const parsed = parseClassroomName(c.name);
                const hasToday = todayEntries.some(e => String(e.classroom_id) === String(c.id));
                const todayEntry = todayEntries.find(e => String(e.classroom_id) === String(c.id));
                const classMaxAbs = Math.floor((Number(c.total_classes) || 40) * (100 - (Number(c.min_attendance_percent) || 80)) / 100);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClass(String(c.id));
                      setActiveTab('daily');
                    }}
                    className={`group relative bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border text-left flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/15 dark:hover:shadow-black/50 cursor-pointer overflow-hidden ${hasToday
                      ? 'border-emerald-300 dark:border-emerald-600/60 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-400/40'
                      : 'border-indigo-100/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-xs'
                      }`}
                  >
                    {/* Top Accent Gradient Bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all ${hasToday
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500'
                      : parsed.curriculumType === 'pvs'
                        ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500'
                        : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500'
                      }`} />

                    <div>
                      {/* Badge Header Row */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {parsed.code && (
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                              {parsed.code}
                            </span>
                          )}
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${parsed.curriculumType === 'pvs'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                            }`}>
                            {parsed.curriculumType === 'pvs' ? 'ปวส.' : 'ปวช.'}
                          </span>
                          {parsed.groupName && (
                            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/90 dark:border-amber-800 shadow-2xs">
                              {parsed.groupName}
                            </span>
                          )}
                        </div>

                        {hasToday && (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs animate-pulse shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            มีสอนวันนี้
                          </span>
                        )}
                      </div>

                      {/* Course Title */}
                      <h4 className="font-black text-base text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug mb-3.5">
                        {parsed.subjectTitle}
                      </h4>

                      {/* Info & Criteria Box */}
                      <div className="space-y-2 bg-slate-50/80 dark:bg-slate-800/60 group-hover:bg-indigo-50/40 dark:group-hover:bg-slate-800/90 p-3 rounded-xl border border-slate-100 dark:border-slate-800 group-hover:border-indigo-100/60 dark:group-hover:border-slate-700 transition-colors mb-4">
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                            <span>นักเรียน</span>
                          </span>
                          <strong className="text-slate-800 dark:text-slate-100 font-bold">{c.student_count || 0} คน</strong>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                            <span>แผนการสอน</span>
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {c.total_weeks || (parsed.curriculumType === 'pvs' ? 15 : 18)} สัปดาห์ · {c.total_classes || 40} คาบ
                          </span>
                        </div>

                        {todayEntry && (
                          <div className="pt-1.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                            <span>คาบสอนวันนี้</span>
                            <span>คาบ {todayEntry.start_period}{todayEntry.start_period !== todayEntry.end_period ? `-${todayEntry.end_period}` : ''} ({todayEntry.room || 'ห้องปกติ'})</span>
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                          <span>เกณฑ์เข้าเรียน</span>
                          <span>
                            ขั้นต่ำ <strong className="text-indigo-900 font-bold">{c.min_attendance_percent || 80}%</strong> (ขาดได้ {classMaxAbs} คาบ)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Prompt */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                      <span>เริ่มเช็คชื่อห้องนี้</span>
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all group-hover:translate-x-1 shadow-xs">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
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
              <div className="glass dark:bg-slate-900/85 p-4 sm:p-5 rounded-3xl border border-indigo-100/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 shadow-xl shadow-indigo-100/20 dark:shadow-black/40">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
                  {/* Left: Date Stepper & Picker */}
                  <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => adjustDate(-1)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                      title="วันก่อนหน้า"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="relative flex items-center gap-2 px-3 py-1 font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer group bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500 transition-all">
                      <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">{formattedSelectedDate}</span>
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustDate(1)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                      title="วันถัดไป"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Right: Quick Date Filters & Actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
                    <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={setToday}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${isToday
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700'
                          }`}
                      >
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        <span>วันนี้</span>
                      </button>
                      <button
                        type="button"
                        onClick={setYesterday}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        เมื่อวาน
                      </button>
                    </div>

                    {/* ปุ่มเช็คชื่อย้อนหลัง */}
                    <button
                      type="button"
                      onClick={() => setShowRetroactiveModal(true)}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="เปิดหน้าต่างเลือกสัปดาห์หรือวันย้อนหลังเพื่อเช็คชื่อ"
                    >
                      <History className="w-4 h-4" />
                      <span>เช็คชื่อย้อนหลัง</span>
                    </button>

                    {/* ปุ่มลบข้อมูลวันที่เลือก */}
                    <button
                      type="button"
                      onClick={handleClearData}
                      disabled={saving}
                      className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/60 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                      title={activeSectionGroup
                        ? `ลบข้อมูลการเช็คชื่อเฉพาะห้อง ${activeSectionGroup.label} สำหรับวันที่เลือกอยู่`
                        : 'ลบข้อมูลการเช็คชื่อทั้งห้องสำหรับวันที่เลือกอยู่'}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="hidden sm:inline">
                        ลบข้อมูล{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''} ({new Date(date).getDate()} {THAI_MONTHS_SHORT[new Date(date).getMonth()]})
                      </span>
                      <span className="sm:hidden">
                        ลบข้อมูล
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Retroactive Alert Banner (เมื่อเลือกวันในอดีต) */}
              {isPastDate && (
                <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-4 rounded-3xl border border-amber-200/90 dark:border-amber-900/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-amber-950 dark:text-amber-200 text-sm">
                          🕒 กำลังเช็คชื่อย้อนหลัง:
                        </span>
                        <span className="text-xs bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 shadow-xs">
                          {formattedSelectedDate}
                        </span>
                        {selectedDateWeekNumber && (
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                            สัปดาห์ที่ {selectedDateWeekNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
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
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>เปลี่ยนวันย้อนหลัง</span>
                    </button>
                    <button
                      type="button"
                      onClick={setToday}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 hover:scale-105 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>กลับไปวันนี้</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Counters Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-emerald-100/80 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/30 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 flex items-center justify-between shadow-xs hover:shadow-md transition-all">
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">มาเรียน</p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight tabular-nums">{dailyStats.present}</p>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">คน</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-amber-100/80 dark:border-amber-950/60 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 flex items-center justify-between shadow-xs hover:shadow-md transition-all">
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-0.5">สาย</p>
                    <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 tracking-tight tabular-nums">{dailyStats.late}</p>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">คน</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-rose-100/80 dark:border-rose-950/60 bg-gradient-to-br from-rose-50/70 via-white to-red-50/30 dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900 flex items-center justify-between shadow-xs hover:shadow-md transition-all">
                  <div>
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300 mb-0.5">ขาด</p>
                    <p className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-400 tracking-tight tabular-nums">{dailyStats.absent}</p>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">คน</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-2xs">
                    <XCircle className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-sky-100/80 dark:border-sky-950/60 bg-gradient-to-br from-sky-50/70 via-white to-blue-50/30 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900 flex items-center justify-between shadow-xs hover:shadow-md transition-all">
                  <div>
                    <p className="text-xs font-bold text-sky-800 dark:text-sky-300 mb-0.5">ลา</p>
                    <p className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-400 tracking-tight tabular-nums">{dailyStats.leave}</p>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">คน</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-2xs">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-indigo-100/80 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 col-span-2 sm:col-span-1 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-0.5">บันทึกผลแล้ว</p>
                      <p className="text-2xl sm:text-3xl font-black text-indigo-800 dark:text-indigo-200 tracking-tight tabular-nums">
                        {dailyStats.marked}
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">/ {dailyStats.total}</span>
                      </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-xs shadow-2xs">
                      {Math.round((dailyStats.marked / (dailyStats.total || 1)) * 100)}%
                    </div>
                  </div>
                  <div className="w-full bg-indigo-100/70 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((dailyStats.marked / (dailyStats.total || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Student List View */}
              <div className="glass dark:bg-slate-900/85 overflow-hidden rounded-3xl border border-indigo-100/80 dark:border-slate-800 shadow-xl shadow-indigo-100/20 dark:shadow-black/40 pb-16 md:pb-0 bg-white/95 dark:bg-slate-900">
                {/* Search and Bulk Operations Bar */}
                <div className="p-4 sm:p-5 border-b border-indigo-50/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัสประจำตัว..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-10 pr-8 py-2 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 rounded-xl focus:border-indigo-500 shadow-2xs w-full"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mr-1">
                      กำหนดเร็ว{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkAll('present')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/70 dark:border-emerald-800 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>มาทุกคน{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkAll('absent')}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-200/70 dark:border-rose-900/60 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>ขาดทุกคน{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>คืนค่า</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Card List View (Thumb-Friendly & Super Fast) */}
                <div className="block md:hidden p-3 space-y-3">
                  {filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 font-semibold">
                      ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้นหา
                    </div>
                  ) : hasMultipleSections && selectedSectionKey === 'all' ? (
                    visibleSectionGroups.map(grp => {
                      const isCollapsed = Boolean(collapsedSections[grp.key]);
                      const secStats = sectionDailyStatsMap[grp.key];
                      return (
                        <div key={grp.key} className="space-y-2.5">
                          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-50/95 via-violet-50/70 to-white dark:from-slate-800/95 dark:via-slate-800/70 dark:to-slate-800 border border-indigo-100/90 dark:border-slate-700 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => toggleSectionCollapse(grp.key)}
                                className="flex items-center gap-2 min-w-0 text-left"
                                title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                              >
                                <ChevronDown className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                <span className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200 truncate">{grp.fullLabel}</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-600 shrink-0">
                                  {grp.students.length} คน
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedSectionKey(grp.key)}
                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-700/90 border border-indigo-200/70 dark:border-slate-600 shrink-0"
                              >
                                แยกห้องนี้ →
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                              {secStats && (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                                  <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/70 dark:border-emerald-800/70">มา {secStats.present}</span>
                                  <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/70 dark:border-amber-800/70">สาย {secStats.late}</span>
                                  <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200/70 dark:border-rose-800/70">ขาด {secStats.absent}</span>
                                  <span className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/70 dark:border-blue-800/70">ลา {secStats.leave}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'present', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-2xs"
                                >
                                  ✓ มาทั้งห้อง
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'absent', grp.label)}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold"
                                >
                                  ขาดทั้งห้อง
                                </button>
                              </div>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="space-y-2.5 pl-1">
                              {grp.students.map(student => (
                                <MobileStudentAttendanceCard
                                  key={student.id}
                                  student={student}
                                  status={attendance[student.id]}
                                  stats={getStudentStats(student.id)}
                                  maxAllowedAbsences={maxAllowedAbsences}
                                  sectionBadge={grp.label}
                                  onStatusSelect={handleStatusChange}
                                  onViewHistory={setHistoryStudent}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-2.5">
                      {filteredStudents.map((student) => (
                        <MobileStudentAttendanceCard
                          key={student.id}
                          student={student}
                          status={attendance[student.id]}
                          stats={getStudentStats(student.id)}
                          maxAllowedAbsences={maxAllowedAbsences}
                          sectionBadge={hasMultipleSections ? (student.grade_level || null) : null}
                          onStatusSelect={handleStatusChange}
                          onViewHistory={setHistoryStudent}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Modern Horizontal Card Rows */}
                <div className="hidden md:block p-4 sm:p-5">
                  <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-2.5">
                    {/* Column Guideline Header */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                      <div className="w-80 lg:w-96 flex items-center gap-3">
                        <span className="w-6 text-right">#</span>
                        <span>ข้อมูลนักเรียน & ความเสี่ยง</span>
                      </div>
                      <div className="text-center font-bold">
                        สถานะการมาเรียน
                      </div>
                      <div className="w-56 lg:w-64 text-right">
                        โควตาขาด & สถิติสะสม
                      </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้นหา
                      </div>
                    ) : hasMultipleSections && selectedSectionKey === 'all' ? (
                      visibleSectionGroups.map(grp => {
                        const isCollapsed = Boolean(collapsedSections[grp.key]);
                        const secStats = sectionDailyStatsMap[grp.key];
                        const isAllMarked = secStats && secStats.total > 0 && secStats.marked === secStats.total;
                        return (
                          <div key={grp.key} className="space-y-2.5">
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-violet-50/50 to-indigo-50/30 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/40 border border-indigo-100 dark:border-slate-750 flex items-center justify-between gap-3 shadow-2xs">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleSectionCollapse(grp.key)}
                                  className="flex items-center gap-2 text-left group cursor-pointer"
                                  title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                                >
                                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-750 border border-indigo-200/80 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                  </div>
                                  <span className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200">{grp.fullLabel}</span>
                                </button>

                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-slate-750 shadow-2xs">
                                  {grp.students.length} คน
                                </span>

                                {secStats && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold ml-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">มา {secStats.present}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800">สาย {secStats.late}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800">ขาด {secStats.absent}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">ลา {secStats.leave}</span>
                                    <span className={`px-2 py-0.5 rounded-md border ${isAllMarked
                                      ? 'bg-emerald-500 text-white border-emerald-600'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                      }`}>
                                      เช็คแล้ว {secStats.marked}/{secStats.total}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'present', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition-colors cursor-pointer"
                                  title={`เช็คชื่อมาเรียนทั้งห้อง ${grp.fullLabel}`}
                                >
                                  ✓ มาทั้งห้อง {grp.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'absent', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                  title={`เช็คชื่อขาดทั้งห้อง ${grp.fullLabel}`}
                                >
                                  ขาดทั้งห้อง
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSectionKey(grp.key)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                  title={`สลับไปแสดงเฉพาะห้อง ${grp.label}`}
                                >
                                  แยกห้องนี้ →
                                </button>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div className="space-y-2.5">
                                {grp.students.map((student, idx) => (
                                  <MemoizedDesktopStudentRow
                                    key={student.id}
                                    student={student}
                                    idx={idx}
                                    showRoomPill={Boolean(searchQuery.trim())}
                                    status={attendance[student.id]}
                                    stats={getStudentStats(student.id)}
                                    maxAllowedAbsences={maxAllowedAbsences}
                                    onStatusSelect={handleStatusChange}
                                    onViewHistory={setHistoryStudent}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      filteredStudents.map((student, idx) => (
                        <MemoizedDesktopStudentRow
                          key={student.id}
                          student={student}
                          idx={idx}
                          showRoomPill={false}
                          status={attendance[student.id]}
                          stats={getStudentStats(student.id)}
                          maxAllowedAbsences={maxAllowedAbsences}
                          onStatusSelect={handleStatusChange}
                          onViewHistory={setHistoryStudent}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Sticky Save Bar */}
                <div className="p-4 sm:p-5 border-t border-indigo-100/70 dark:border-slate-800 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/40 dark:from-slate-900/95 dark:via-slate-900 dark:to-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Auto Save Toggle */}
                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
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
                      <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600 shrink-0"></div>
                      <span className="ml-2.5 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-200">บันทึกอัตโนมัติ</span>
                    </label>

                    {autoSave && renderAutoSaveStatus()}
                  </div>

                  {/* Right: Manual save/reset actions */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!autoSave ? (
                      <>
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-xs cursor-pointer shadow-2xs"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="btn btn-primary px-6 py-2.5 shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>บันทึกประวัติการเช็คชื่อ</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-2xs">
                        ⚡ บันทึกข้อมูลอัตโนมัติเมื่อกดเลือกสถานะ
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Sticky Quick Summary & Action Bar */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-indigo-100 dark:border-slate-800 px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div className="text-xs">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{dailyStats.marked}/{dailyStats.total}</span>
                      <span className="text-slate-500 dark:text-slate-400 ml-1">เช็คแล้ว</span>
                    </div>
                    {autoSave && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                        {autoSaveStatus === 'saving' ? 'บันทึก...' : 'บันทึกอัตโนมัติ'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!autoSave && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || dailyStats.marked === 0}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>บันทึก</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                      title="เลื่อนขึ้นบนสุด"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= ATTENDANCE HISTORY MATRIX GRID ================= */
            <div className="space-y-6">

              {/* Modern Thai Date range filter card */}
              <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-blue-500/10 dark:from-slate-850 dark:via-slate-850 dark:to-slate-850 p-4 sm:p-5 rounded-3xl border border-indigo-100/80 dark:border-slate-800 shadow-lg shadow-indigo-500/5 dark:shadow-black/40 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Header Title */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">ตัวเลือกช่วงวันที่แสดงผล</h3>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800">
                          <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-pulse" /> ปฏิทินไทย
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">คลิกเพื่อเลือกวันเริ่มต้น-สิ้นสุดบนปฏิทินไทย หรือใช้ปุ่มลัดเลือกช่วงเวลา</p>
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
                    />

                    {/* Range Summary Status */}
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-bold bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-indigo-100/80 dark:border-slate-700 shadow-sm flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>{matrixDates.length > 0 ? `${matrixDates.length} คาบเรียน/วันในตาราง` : '0 คาบ'}</span>
                      </div>
                      {teachingDayGovHolidays.length > 0 && (
                        <div
                          className="text-xs text-amber-900 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-3 py-2 rounded-2xl border border-amber-200/80 dark:border-amber-800 shadow-sm flex items-center gap-1.5 shrink-0"
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
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-indigo-100/90 dark:border-slate-700 shadow-sm mt-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">วันที่มีตารางสอนของห้องนี้:</span>
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
                          className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-650'
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
              <div className="glass dark:bg-slate-900/85 overflow-hidden rounded-2xl border border-white/50 dark:border-slate-800 shadow-xl dark:shadow-black/40">
                <div className="p-4 border-b border-indigo-50/50 dark:border-slate-800 bg-white/40 dark:bg-slate-900/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Grid className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <span className="font-bold text-slate-800 dark:text-slate-100">ตารางการเช็คชื่อสะสม ({matrixDates.length} คาบเรียน/วัน)</span>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-1.5 text-xs bg-white/70 dark:bg-slate-800 dark:text-slate-100 border-indigo-100/50 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                {matrixLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="text-slate-500 dark:text-slate-400 font-semibold animate-pulse text-sm">กำลังคำนวณข้อมูลประวัติ...</p>
                  </div>
                ) : matrixDates.length === 0 ? (
                  <div className="p-20 text-center">
                    <CalendarIcon className="w-16 h-16 text-indigo-200 dark:text-indigo-800 mx-auto mb-4 stroke-1" />
                    <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">ไม่พบข้อมูลการเช็คชื่อ</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs mx-auto">ไม่มีประวัติการบันทึกการเช็คชื่อในช่วงวันที่กำหนด</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <div style={{ minWidth: `${Math.max(1000, 176 + (matrixDates.length * 96))}px` }}>
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-indigo-50 dark:bg-slate-900 border-b border-indigo-100/80 dark:border-slate-800 sticky top-0 z-20">
                            <th className="p-4 font-bold text-slate-700 dark:text-slate-200 w-44 sticky left-0 bg-indigo-50 dark:bg-slate-850 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.4)] border-r border-indigo-100 dark:border-slate-800">
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
                                  className={`p-3 font-bold text-center w-24 text-xs border-r transition-colors ${isGovHoliday
                                    ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-200/90 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                                    : isWeekend
                                      ? 'bg-slate-200/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                      : 'bg-indigo-50/70 dark:bg-slate-850 border-indigo-100/50 dark:border-slate-800 text-slate-700 dark:text-slate-300'
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
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                        {dateObj.toLocaleDateString('th-TH', { weekday: 'short' })}
                                        {isGovHoliday && <span>🏖️</span>}
                                      </span>
                                      <span className={`text-sm font-black ${isGovHoliday ? 'text-amber-950 dark:text-amber-200' : 'text-indigo-800 dark:text-indigo-300'} group-hover/btn:underline`}>
                                        {day} {month}
                                      </span>
                                      <span className="text-[9px] text-indigo-600 dark:text-indigo-300 font-bold bg-white/90 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 px-1.5 py-0.5 rounded-md border border-indigo-200/80 dark:border-slate-700 mt-0.5 opacity-80 group-hover/btn:opacity-100 shadow-xs">
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
                          {hasMultipleSections && selectedSectionKey === 'all' ? (
                            visibleSectionGroups.map(grp => {
                              const isCollapsed = Boolean(collapsedSections[grp.key]);
                              return (
                                <Fragment key={grp.key}>
                                  <tr className="border-y border-indigo-200/80 dark:border-slate-800 bg-indigo-50/90 dark:bg-slate-800/80">
                                    <td className="px-3 py-2 sticky left-0 bg-indigo-100/95 dark:bg-slate-850 z-20 border-r border-indigo-200 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                                      <button
                                        type="button"
                                        onClick={() => toggleSectionCollapse(grp.key)}
                                        className="flex items-center justify-between gap-1.5 w-full text-left cursor-pointer"
                                        title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                                      >
                                        <span className="flex items-center gap-1.5 min-w-0">
                                          <ChevronDown className={`w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                          <span className="font-extrabold text-xs text-indigo-950 dark:text-indigo-200 truncate">{grp.label}</span>
                                        </span>
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 shrink-0">
                                          {grp.students.length} คน
                                        </span>
                                      </button>
                                    </td>
                                    <td colSpan={matrixDates.length} className="px-3 py-2 bg-gradient-to-r from-indigo-50/90 to-violet-50/40 dark:from-slate-800/80 dark:to-slate-800/40 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                                      <div className="flex items-center gap-2">
                                        <span>กลุ่มเรียน: {grp.fullLabel} ({grp.students.length} คน)</span>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSectionKey(grp.key)}
                                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline cursor-pointer"
                                        >
                                          ดูเฉพาะห้องนี้ →
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {!isCollapsed && grp.students.map((student, idx) => renderMatrixStudentRow(student, idx, true))}
                                </Fragment>
                              );
                            })
                          ) : (
                            filteredStudents.map((student, idx) => renderMatrixStudentRow(student, idx, false))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


              </div>
            </div>
          )}
        </>
      )}

      {/* ================= HISTORY LIST MODAL FOR SINGLE STUDENT ================= */}
      {historyStudent && createPortal(
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-black/60 w-full max-w-md p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg text-white">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">ประวัติการเช็คชื่อ</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{historyStudent.name}</p>
                </div>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="p-2 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">ไม่พบสถิติการเช็คชื่อใดๆ</p>
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
                    <div key={record.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50/60 dark:hover:bg-slate-750 transition-colors group">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-semibold">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusDisplay(record.status)}
                        <button
                          onClick={() => handleDeleteHistory(record.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
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

            <div className="mt-5 pt-4 border-t border-indigo-50/50 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryStudent(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
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
        initialSectionKey={selectedSectionKey}
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
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-black/60 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">เลือกวัน/สัปดาห์ที่ต้องการเช็คชื่อย้อนหลัง</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ห้องเรียน: <span className="font-semibold text-indigo-700 dark:text-indigo-400">{selectedClassData?.name || 'ห้องเรียน'}</span>
                    {selectedClassData?.curriculum_type && (
                      <span className="ml-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200 dark:border-indigo-800">
                        {selectedClassData.curriculum_type === 'pvs' ? 'ปวส. 15 สัปดาห์' : selectedClassData.curriculum_type === 'custom' ? `กำหนดเอง ${selectedClassData.total_weeks || 18} สัปดาห์` : 'ปวช. 18 สัปดาห์'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRetroactiveModal(false)}
                className="p-2 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-5 border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRetroactiveTab('weeks')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${retroactiveTab === 'weeks'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                  }`}
              >
                <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>เลือกตามสัปดาห์ภาคเรียน ({semesterInfo?.totalWeeks || selectedClassData?.total_weeks || 18} สัปดาห์)</span>
              </button>
              <button
                type="button"
                onClick={() => setRetroactiveTab('calendar')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${retroactiveTab === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                  }`}
              >
                <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>ปฏิทินเลือกวันที่ด่วน</span>
              </button>
            </div>

            {/* Tab 1: Week Navigator */}
            {retroactiveTab === 'weeks' && (
              <div className="space-y-4">
                {semesterInfo?.weeks && semesterInfo.weeks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
                            className={`p-3.5 rounded-2xl border transition-all ${w.isCurrent
                              ? 'bg-indigo-50/90 dark:bg-slate-800 border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/30 shadow-sm'
                              : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 shadow-xs'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>สัปดาห์ที่ {w.week}</span>
                                {w.isCurrent && (
                                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                                    สัปดาห์ปัจจุบัน
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
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
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center min-w-[50px] cursor-pointer ${d.isSelected
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : d.isFuture
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                        : d.isTeachingDay
                                          ? 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 hover:scale-105'
                                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
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
                  <div className="p-8 text-center bg-indigo-50/50 dark:bg-slate-800/60 rounded-2xl border border-indigo-100 dark:border-slate-700">
                    <CalendarIcon className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">ยังไม่ได้กำหนดวันเปิดภาคเรียนของห้องนี้</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                      สามารถไปตั้งค่า &quot;วันเปิดภาคเรียน&quot; ได้ที่เมนู <strong>ห้องเรียน</strong> หรือใช้แท็บ <strong>&quot;ปฏิทินเลือกวันที่ด่วน&quot;</strong> เพื่อเลือกวันที่ย้อนหลังได้ทันทีครับ
                    </p>
                    <button
                      type="button"
                      onClick={() => setRetroactiveTab('calendar')}
                      className="btn btn-primary text-xs px-4 py-2 mt-4 cursor-pointer"
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
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
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${isSel
                            ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold'
                            }`}
                        >
                          <div className="text-xs">{p.label}</div>
                          <div className={`text-[10px] mt-0.5 ${isSel ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block" htmlFor="retro-custom-date">
                    หรือระบุวันที่ในอดีตที่ต้องการ:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="retro-custom-date"
                      type="date"
                      max={todayStr}
                      value={customRetroDate}
                      onChange={e => setCustomRetroDate(e.target.value)}
                      className="form-input text-sm flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
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
                      className="btn btn-primary px-6 py-2.5 text-sm cursor-pointer"
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
