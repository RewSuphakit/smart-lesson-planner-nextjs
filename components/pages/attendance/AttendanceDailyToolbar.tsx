'use client';

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, History, Trash2, RotateCcw, Clock } from 'lucide-react';
import { DailyStats, StudentSectionGroup, Student, THAI_MONTHS_SHORT } from './types';

export interface AttendanceDailyToolbarProps {
  date: string;
  setDate: (date: string) => void;
  formattedSelectedDate: string;
  isToday: boolean;
  isPastDate: boolean;
  selectedDateWeekNumber: number | null;
  dailyStats: DailyStats;
  activeSectionGroup: StudentSectionGroup<Student> | null;
  saving: boolean;
  adjustDate: (days: number) => void;
  setToday: () => void;
  setYesterday: () => void;
  onOpenRetroactiveModal: () => void;
  onClearData: () => void;
}

export const AttendanceDailyToolbar = ({
  date,
  setDate,
  formattedSelectedDate,
  isToday,
  isPastDate,
  selectedDateWeekNumber,
  dailyStats,
  activeSectionGroup,
  saving,
  adjustDate,
  setToday,
  setYesterday,
  onOpenRetroactiveModal,
  onClearData,
}: AttendanceDailyToolbarProps) => {
  const dateObj = new Date(date);
  const dayNum = dateObj.getDate();
  const monthShort = THAI_MONTHS_SHORT[dateObj.getMonth()];

  return (
    <div className="space-y-4">
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
              onClick={onOpenRetroactiveModal}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="เปิดหน้าต่างเลือกสัปดาห์หรือวันย้อนหลังเพื่อเช็คชื่อ"
            >
              <History className="w-4 h-4" />
              <span>เช็คชื่อย้อนหลัง</span>
            </button>

            {/* ปุ่มลบข้อมูลวันที่เลือก */}
            <button
              type="button"
              onClick={onClearData}
              disabled={saving}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/60 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title={activeSectionGroup
                ? `ลบข้อมูลการเช็คชื่อเฉพาะห้อง ${activeSectionGroup.label} สำหรับวันที่เลือกอยู่`
                : 'ลบข้อมูลการเช็คชื่อทั้งห้องสำหรับวันที่เลือกอยู่'}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span className="hidden sm:inline">
                ลบข้อมูล{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''} ({dayNum} {monthShort})
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
              onClick={onOpenRetroactiveModal}
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
    </div>
  );
};
