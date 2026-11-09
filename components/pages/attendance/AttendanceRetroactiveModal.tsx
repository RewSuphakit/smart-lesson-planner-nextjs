'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { History, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import toast from '@/lib/toast';
import { Classroom, SemesterInfo, RetroactiveTab, ActiveTab } from './types';

export interface AttendanceRetroactiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClassData?: Classroom;
  semesterInfo?: SemesterInfo;
  date: string;
  setDate: (date: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  teachingDays: number[];
  todayStr: string;
}

export const AttendanceRetroactiveModal = ({
  isOpen,
  onClose,
  selectedClassData,
  semesterInfo,
  date,
  setDate,
  setActiveTab,
  teachingDays,
  todayStr,
}: AttendanceRetroactiveModalProps) => {
  const [retroactiveTab, setRetroactiveTab] = useState<RetroactiveTab>('weeks');
  const [customRetroDate, setCustomRetroDate] = useState<string>(todayStr);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
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
            onClick={onClose}
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
                                  onClose();
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
                        onClose();
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
                    onClose();
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
  );
};
