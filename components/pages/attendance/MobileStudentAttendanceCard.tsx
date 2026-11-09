'use client';

import { memo } from 'react';
import { CheckCircle, Clock, XCircle, FileText, History } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { Student, StudentStats } from './types';

export interface MobileStudentAttendanceCardProps {
  student: Student;
  status: string | undefined;
  stats: StudentStats;
  maxAllowedAbsences: number;
  sectionBadge?: string | null;
  onStatusSelect: (studentId: string, status: string) => void;
  onViewHistory: (student: Student) => void;
}

export const MobileStudentAttendanceCard = memo(({
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
