'use client';

import { memo } from 'react';
import { CheckCircle, Clock, XCircle, FileText, History } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { Student, StudentStats } from './types';

export interface DesktopStudentRowProps {
  student: Student;
  idx: number;
  showRoomPill?: boolean;
  status: string | undefined;
  stats: StudentStats;
  maxAllowedAbsences: number;
  onStatusSelect: (studentId: string, status: string) => void;
  onViewHistory: (student: Student) => void;
}

export const MemoizedDesktopStudentRow = memo(({
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
