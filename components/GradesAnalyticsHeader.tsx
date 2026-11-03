'use client';

import { Award, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface GradesAnalytics {
  gpa: string;
  passRate: number;
  passCount: number;
  failCount: number;
  krCount: number;
  ksCount: number;
  msCount: number;
  distribution: Record<string, number>;
}

export interface GradesAnalyticsHeaderProps {
  analytics: GradesAnalytics;
  totalStudents: number;
  gradeFilter: string;
  setGradeFilter: (filter: string) => void;
}

export default function GradesAnalyticsHeader({
  analytics,
  totalStudents,
  gradeFilter,
  setGradeFilter,
}: GradesAnalyticsHeaderProps) {
  const gradeKeys = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ข.ร.', 'ข.ส.', 'ม.ส.'];

  return (
    <div className="space-y-4">
      {/* ==================== ANALYTICS SUMMARY CARDS ==================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="glass p-4 sm:p-5 rounded-3xl border border-indigo-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 font-black text-sm border border-indigo-100">
            GPA
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              เกรดเฉลี่ยห้อง
            </p>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">
              {analytics.gpa}
            </div>
          </div>
        </div>

        <div className="glass p-4 sm:p-5 rounded-3xl border border-emerald-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              อัตราผ่านเกณฑ์
            </p>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
              {analytics.passRate}%
              <span className="text-[10px] font-normal text-slate-500 ml-1.5 hidden sm:inline">
                ({analytics.passCount}/{totalStudents})
              </span>
            </div>
          </div>
        </div>

        <div className="glass p-4 sm:p-5 rounded-3xl border border-rose-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              ขาดเรียนเกิน (ข.ร.)
            </p>
            <div className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
              {analytics.krCount} <span className="text-xs font-medium text-slate-500">คน</span>
            </div>
          </div>
        </div>

        <div className="glass p-4 sm:p-5 rounded-3xl border border-amber-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs border border-amber-100">
            ขส/มส
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              ขาดสอบ / ไม่สมบูรณ์
            </p>
            <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
              {analytics.ksCount + analytics.msCount}
              <span className="text-[10px] font-normal text-slate-500 ml-1.5 hidden sm:inline">
                (ข.ส. {analytics.ksCount} | ม.ส. {analytics.msCount})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== GRADE DISTRIBUTION BAR (RESPONSIVE SCROLL) ==================== */}
      <div className="glass p-4 sm:p-5 rounded-3xl border border-indigo-100/80 bg-white shadow-xs">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-indigo-600" />
          สถิติการกระจายเกรด (คลิกเพื่อกรองรายชื่อ)
        </h4>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
          {gradeKeys.map((gKey) => {
            const count =
              analytics.distribution[gKey] ||
              (gKey === 'ข.ร.' ? analytics.distribution['ขร'] || 0 : 0);
            const isSelected =
              gradeFilter === gKey ||
              (gradeFilter === 'KR' && (gKey === 'ข.ร.' || gKey === 'ขร')) ||
              (gradeFilter === 'KS' && gKey === 'ข.ส.') ||
              (gradeFilter === 'MS' && gKey === 'ม.ส.');

            return (
              <button
                key={gKey}
                type="button"
                onClick={() => {
                  if (gKey === 'ข.ร.') setGradeFilter(isSelected ? 'ALL' : 'KR');
                  else if (gKey === 'ข.ส.') setGradeFilter(isSelected ? 'ALL' : 'KS');
                  else if (gKey === 'ม.ส.') setGradeFilter(isSelected ? 'ALL' : 'MS');
                  else setGradeFilter(isSelected ? 'ALL' : gKey);
                }}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <span>{gKey}:</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected
                      ? 'bg-white text-indigo-700'
                      : 'bg-white text-slate-800 font-extrabold shadow-xs'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {gradeFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setGradeFilter('ALL')}
              className="px-3 py-1.5 rounded-2xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

