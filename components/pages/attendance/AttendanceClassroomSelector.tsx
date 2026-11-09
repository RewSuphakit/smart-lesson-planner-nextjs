'use client';

import { Users, BookOpen, Clock, Search, X, ArrowRight } from 'lucide-react';
import { Classroom, TimetableEntry, ClassFilter, parseClassroomName } from './types';

export interface AttendanceClassroomSelectorProps {
  classrooms: Classroom[];
  classFilter: ClassFilter;
  setClassFilter: (filter: ClassFilter) => void;
  classSearch: string;
  setClassSearch: (search: string) => void;
  todayCount: number;
  pvchCount: number;
  pvsCount: number;
  filteredClassrooms: Classroom[];
  todayEntries: TimetableEntry[];
  onSelectClassroom: (classroomId: string) => void;
}

export const AttendanceClassroomSelector = ({
  classrooms,
  classFilter,
  setClassFilter,
  classSearch,
  setClassSearch,
  todayCount,
  pvchCount,
  pvsCount,
  filteredClassrooms,
  todayEntries,
  onSelectClassroom,
}: AttendanceClassroomSelectorProps) => {
  return (
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
              className="mt-3.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-slate-700 transition-colors cursor-pointer"
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
                onClick={() => onSelectClassroom(String(c.id))}
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
                      <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                        <span>คาบสอนวันนี้</span>
                        <span>คาบ {todayEntry.start_period}{todayEntry.start_period !== todayEntry.end_period ? `-${todayEntry.end_period}` : ''} ({todayEntry.room || 'ห้องปกติ'})</span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>เกณฑ์เข้าเรียน</span>
                      <span>
                        ขั้นต่ำ <strong className="text-indigo-900 dark:text-indigo-300 font-bold">{c.min_attendance_percent || 80}%</strong> (ขาดได้ {classMaxAbs} คาบ)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Prompt */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  <span>เริ่มเช็คชื่อห้องนี้</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all group-hover:translate-x-1 shadow-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
