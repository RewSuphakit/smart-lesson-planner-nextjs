'use client';

import {
  GraduationCap, FileSpreadsheet, Upload, Grid, List,
  AlertCircle, GitBranch, Check
} from 'lucide-react';
import { Classroom, ParsedClassroomName, Student, ActiveTab, SectionDailyStats } from './types';
import { StudentSectionGroup } from '@/lib/studentSections';

export interface AttendanceHeaderProps {
  selectedClass: string;
  setSelectedClass: (id: string) => void;
  classrooms: Classroom[];
  selectedClassData?: Classroom;
  activeParsed: ParsedClassroomName | null;
  studentsCount: number;
  maxAllowedAbsences: number;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenExportModal: () => void;
  onOpenImportModal: () => void;
  hasMultipleSections: boolean;
  sharedBranch?: string | null;
  sectionGroups: StudentSectionGroup<Student>[];
  selectedSectionKey: string;
  setSelectedSectionKey: (key: string) => void;
  sectionDailyStatsMap: Record<string, SectionDailyStats>;
  overallDailyMarked: number;
}

export const AttendanceHeader = ({
  selectedClass,
  setSelectedClass,
  classrooms,
  selectedClassData,
  activeParsed,
  studentsCount,
  maxAllowedAbsences,
  activeTab,
  setActiveTab,
  onOpenExportModal,
  onOpenImportModal,
  hasMultipleSections,
  sharedBranch,
  sectionGroups,
  selectedSectionKey,
  setSelectedSectionKey,
  sectionDailyStatsMap,
  overallDailyMarked,
}: AttendanceHeaderProps) => {
  if (!selectedClass || !selectedClassData || !activeParsed) return null;

  return (
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
                (👥 {selectedClassData.student_count || studentsCount || 0} คน)
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
            onClick={onOpenExportModal}
            className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
            title="พรีวิวและส่งออกข้อมูลการเช็คชื่อเป็น CSV / Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>ส่งออก CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportModal}
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
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all shadow-xs cursor-pointer shrink-0"
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
            type="button"
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
            type="button"
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

      {/* Sub-room / Section Switcher Bar */}
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
                  {studentsCount}
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
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                <span>เช็ครวมทั้งวิชาวันนี้:</span>
                <strong className={overallDailyMarked === studentsCount ? 'text-emerald-600 font-extrabold' : 'text-indigo-700 dark:text-indigo-400 font-extrabold'}>
                  {overallDailyMarked}/{studentsCount} คน
                </strong>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
