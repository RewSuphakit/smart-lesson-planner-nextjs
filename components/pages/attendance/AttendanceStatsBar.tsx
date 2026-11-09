'use client';

import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { DailyStats } from './types';

export interface AttendanceStatsBarProps {
  dailyStats: DailyStats;
}

export const AttendanceStatsBar = ({ dailyStats }: AttendanceStatsBarProps) => {
  const percentage = Math.round((dailyStats.marked / (dailyStats.total || 1)) * 100);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* มาเรียน */}
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

      {/* สาย */}
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

      {/* ขาด */}
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

      {/* ลา */}
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

      {/* บันทึกผลแล้ว */}
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
            {percentage}%
          </div>
        </div>
        <div className="w-full bg-indigo-100/70 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
