'use client';

import { Eye, EyeOff } from 'lucide-react';
import {
  formatThaiFullDateHeader,
  type Student,
  type ScoreStructure,
  type ScoresMap,
  type WeeklyAttendanceCounts,
} from './types';

interface WeeklyFocusViewProps {
  structures: ScoreStructure[];
  selectedLesson: string;
  onLessonChange: (newLesson: string) => void;
  calculatedWeekDates: Record<number, string>;
  weekDateMap: Record<number, string>;
  currentStruct: { max_assignment_score: number; max_post_test_score: number };
  showAttendance: boolean;
  setShowAttendance: (show: boolean) => void;
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  weeklyAttendanceCounts: WeeklyAttendanceCounts;
  hideAbsentInWeekly: boolean;
  setHideAbsentInWeekly: (hide: boolean) => void;
  studentsCount: number;
  weeklyDisplayedStudents: Student[];
  scores: ScoresMap;
  getStudentAttendanceStatus: (studentId: string | number, weekLesson: string | number, targetDate?: string) => string;
  onFillZeroForAbsentees: (targetWeekNum?: number) => void;
  onFillSingleStudentZero: (studentId: string | number, lessonNum?: number) => void;
  onWeeklyScoreChange: (studentId: string | number, field: 'assignment_score' | 'post_test_score', value: string) => void;
}

function getAttendanceBadge(status: string) {
  switch (status) {
    case 'present':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">มาเรียน</span>;
    case 'late':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">สาย</span>;
    case 'absent':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold border border-rose-500/20">ขาด (0)</span>;
    case 'leave':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20">ลา (0)</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold border border-slate-200">ไม่มีข้อมูล</span>;
  }
}

export default function WeeklyFocusView({
  structures,
  selectedLesson,
  onLessonChange,
  calculatedWeekDates,
  weekDateMap,
  currentStruct,
  showAttendance,
  setShowAttendance,
  attendanceDate,
  setAttendanceDate,
  weeklyAttendanceCounts,
  hideAbsentInWeekly,
  setHideAbsentInWeekly,
  studentsCount,
  weeklyDisplayedStudents,
  scores,
  getStudentAttendanceStatus,
  onFillZeroForAbsentees,
  onFillSingleStudentZero,
  onWeeklyScoreChange,
}: WeeklyFocusViewProps) {
  return (
    <div className="glass rounded-2xl overflow-hidden border border-indigo-100 shadow-sm bg-white">
      <div className="p-4 border-b border-indigo-100 flex flex-col md:flex-row gap-4 items-end justify-between bg-indigo-50/60">
        <div className="w-full md:w-1/3">
          <label className="form-label text-indigo-800 font-bold">เลือกบทเรียน / สัปดาห์</label>
          <select
            value={selectedLesson}
            onChange={e => onLessonChange(e.target.value)}
            className="form-input bg-white border-indigo-200"
          >
            {structures.map(s => {
              const dateStr = calculatedWeekDates[s.lesson_number] || weekDateMap[s.lesson_number];
              const dateInfo = formatThaiFullDateHeader(dateStr);
              const dateText = dateInfo ? ` (${dateInfo.label})` : '';
              return (
                <option key={s.lesson_number} value={s.lesson_number}>
                  สัปดาห์ที่ {s.lesson_number}{dateText}: {s.lesson_name || 'ไม่มีชื่อ'}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
          <div className="bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-bold">
            คะแนนงานเก็บเต็ม: {currentStruct.max_assignment_score}
          </div>
          <div className="bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs font-bold">
            คะแนนสอบเต็ม: {currentStruct.max_post_test_score}
          </div>
        </div>
      </div>

      {/* Attendance Integration Toolbar */}
      <div className="p-4 border-b border-indigo-100 bg-slate-50/50 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-attendance"
              checked={showAttendance}
              onChange={e => setShowAttendance(e.target.checked)}
              className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
            />
            <label htmlFor="show-attendance" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
              🔗 แสดงสถานะการเข้าเรียนประกอบการกรอกคะแนน
            </label>
          </div>

          {showAttendance && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <span>📅 วันที่เช็คชื่อ:</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="form-input py-1 px-2.5 text-xs bg-white border-indigo-300 rounded-xl font-medium text-slate-800 focus:border-indigo-500 shadow-2xs cursor-pointer"
                  title="เลือกวันที่เช็คชื่อที่ต้องการดึงข้อมูลมาแสดง"
                />
                {(() => {
                  const weekNum = parseInt(selectedLesson);
                  const targetWeekDate = !isNaN(weekNum) ? (calculatedWeekDates[weekNum] || weekDateMap[weekNum]) : null;
                  const isSynced = targetWeekDate ? targetWeekDate === attendanceDate : true;
                  const dateInfo = formatThaiFullDateHeader(attendanceDate);

                  return (
                    <div className="flex items-center gap-2">
                      {dateInfo && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                          {dateInfo.label}
                        </span>
                      )}
                      {!isSynced && targetWeekDate && (
                        <button
                          type="button"
                          onClick={() => setAttendanceDate(targetWeekDate)}
                          className="btn bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] py-0.5 px-2 rounded-lg flex items-center gap-1 transition-all shadow-2xs font-semibold"
                          title={`คลิกเพื่อรีเซ็ตวันที่ให้ตรงกับสัปดาห์ที่ ${weekNum} (${targetWeekDate})`}
                        >
                          🔄 ซิงค์ตามสัปดาห์ที่ {weekNum}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Focus: Absent & Leave Status & Visibility Controller */}
      <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-rose-50/60 border-b border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>สถานะสัปดาห์นี้:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 font-bold border border-emerald-200">
              มา: {weeklyAttendanceCounts.present}
            </span>
            {weeklyAttendanceCounts.late > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-800 font-bold border border-amber-200">
                สาย: {weeklyAttendanceCounts.late}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-blue-100/90 text-blue-800 font-bold border border-blue-200">
              ลา: {weeklyAttendanceCounts.leave} (คะแนน 0)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100/90 text-rose-800 font-black border border-rose-300">
              ขาด: {weeklyAttendanceCounts.absent} (คะแนน 0)
            </span>
            {weeklyAttendanceCounts.noData > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                ยังไม่เช็ค: {weeklyAttendanceCounts.noData}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          <button
            type="button"
            onClick={() => setHideAbsentInWeekly(!hideAbsentInWeekly)}
            className={`btn text-xs py-1 px-2.5 rounded-xl flex items-center gap-1.5 font-bold transition-all shadow-2xs ${
              hideAbsentInWeekly
                ? 'bg-rose-100/90 hover:bg-rose-200 text-rose-800 border border-rose-300 ring-2 ring-rose-300/30'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
            }`}
            title={hideAbsentInWeekly ? 'กำลังซ่อนคนขาดเรียน (คลิกเพื่อแสดงทุกคน)' : 'กำลังแสดงทุกคน (คลิกเพื่อซ่อนคนขาดเรียน)'}
          >
            {hideAbsentInWeekly ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                <span>ซ่อนคนขาด ({weeklyAttendanceCounts.absent})</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>แสดงทุกคน ({studentsCount})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onFillZeroForAbsentees(Number(selectedLesson))}
            className="btn bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs py-1 px-2.5 rounded-xl font-bold flex items-center gap-1 transition-all shadow-2xs active:scale-95"
            title="เติมคะแนน 0 ให้คนที่ขาดหรือลาในสัปดาห์นี้ทันที"
          >
            ⚡ ใส่ 0 คนขาด/ลา
          </button>
        </div>
      </div>

      {/* Mobile Weekly Score Cards */}
      <div className="block md:hidden p-3 space-y-3">
        {weeklyDisplayedStudents.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <p className="text-sm font-semibold text-slate-600">ไม่มีรายชื่อนักเรียนที่ต้องกรอกคะแนนในสัปดาห์นี้</p>
            <p className="text-xs text-slate-400">
              {weeklyAttendanceCounts.absent > 0 && hideAbsentInWeekly
                ? `(มีนักเรียนขาด ${weeklyAttendanceCounts.absent} คน ซึ่งถูกซ่อนและใส่คะแนน 0 ไว้แล้ว)`
                : 'ไม่มีข้อมูลนักเรียน'}
            </p>
            {hideAbsentInWeekly && weeklyAttendanceCounts.absent > 0 && (
              <button
                type="button"
                onClick={() => setHideAbsentInWeekly(false)}
                className="mt-2 text-xs font-bold text-indigo-600 underline"
              >
                คลิกเพื่อแสดงรายชื่อคนที่ขาด
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {weeklyDisplayedStudents.map(student => {
              const scoreData = scores[student.id] || { assignment_score: '', post_test_score: '' };
              const attStatus = getStudentAttendanceStatus(student.id, selectedLesson, attendanceDate);

              return (
                <div key={student.id} className="p-3.5 bg-white dark:bg-slate-850 rounded-2xl border border-indigo-100/90 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{student.name}</span>
                        {student.grade_level && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                            {student.grade_level}
                          </span>
                        )}
                        {getAttendanceBadge(attStatus)}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">รหัส: {student.student_code || '-'}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onFillSingleStudentZero(student.id)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-colors shadow-2xs shrink-0 active:scale-95"
                      title="กำหนดคะแนนเป็น 0 สำหรับนักเรียนที่ขาดเรียนหรือลา"
                    >
                      ขาด/ลา = 0
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                        <span>งานเก็บ</span>
                        <span className="text-[10px] text-emerald-600 font-normal">เต็ม {currentStruct.max_assignment_score}</span>
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        max={currentStruct.max_assignment_score}
                        value={scoreData.assignment_score}
                        onChange={e => onWeeklyScoreChange(student.id, 'assignment_score', e.target.value)}
                        className="w-full text-center text-base py-2 font-black border border-emerald-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                        placeholder={`0 - ${currentStruct.max_assignment_score}`}
                      />
                    </div>

                    <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                        <span>สอบย่อย</span>
                        <span className="text-[10px] text-amber-600 font-normal">เต็ม {currentStruct.max_post_test_score}</span>
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        max={currentStruct.max_post_test_score}
                        value={scoreData.post_test_score}
                        onChange={e => onWeeklyScoreChange(student.id, 'post_test_score', e.target.value)}
                        className="w-full text-center text-base py-2 font-black border border-amber-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        placeholder={`0 - ${currentStruct.max_post_test_score}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-indigo-100/50 border-b border-indigo-200 font-bold text-slate-700">
              <th className="p-3 w-20">รหัส</th>
              <th className="p-3">ชื่อ-นามสกุล</th>
              <th className="p-3 text-center text-emerald-600 w-44">งานเก็บ (ภาคผลงาน)</th>
              <th className="p-3 text-center text-amber-600 w-44">สอบย่อย (ภาคผลงาน)</th>
            </tr>
          </thead>
          <tbody>
            {weeklyDisplayedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 bg-slate-50/50">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">ไม่มีรายชื่อนักเรียนที่ต้องกรอกคะแนนในสัปดาห์นี้</p>
                    <p className="text-xs text-slate-400">
                      {weeklyAttendanceCounts.absent > 0 && hideAbsentInWeekly
                        ? `(มีนักเรียนขาด ${weeklyAttendanceCounts.absent} คน ซึ่งถูกซ่อนและใส่คะแนน 0 ไว้แล้ว)`
                        : 'ไม่มีข้อมูลนักเรียน'}
                    </p>
                    {hideAbsentInWeekly && weeklyAttendanceCounts.absent > 0 && (
                      <button
                        type="button"
                        onClick={() => setHideAbsentInWeekly(false)}
                        className="mt-2 text-xs font-bold text-indigo-600 underline"
                      >
                        คลิกเพื่อแสดงรายชื่อคนที่ขาด
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              weeklyDisplayedStudents.map(student => {
                const scoreData = scores[student.id] || { assignment_score: '', post_test_score: '' };
                const attStatus = getStudentAttendanceStatus(student.id, selectedLesson, attendanceDate);
                return (
                  <tr key={student.id} className="border-b border-indigo-100 hover:bg-indigo-50/50">
                    <td className="p-3 text-slate-500 font-medium">{student.student_code || '-'}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{student.name}</span>
                          {student.grade_level && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                              {student.grade_level}
                            </span>
                          )}
                          {getAttendanceBadge(attStatus)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onFillSingleStudentZero(student.id)}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold rounded-lg transition-colors shadow-2xs"
                          title="กำหนดคะแนนเป็น 0 สำหรับนักเรียนที่ขาดเรียนหรือลา"
                        >
                          ขาด/ลา = 0
                        </button>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        max={currentStruct.max_assignment_score}
                        value={scoreData.assignment_score}
                        onChange={e => onWeeklyScoreChange(student.id, 'assignment_score', e.target.value)}
                        className="form-input text-center text-base md:text-sm py-1 font-bold border-indigo-200"
                        placeholder={`/${currentStruct.max_assignment_score}`}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        max={currentStruct.max_post_test_score}
                        value={scoreData.post_test_score}
                        onChange={e => onWeeklyScoreChange(student.id, 'post_test_score', e.target.value)}
                        className="form-input text-center text-base md:text-sm py-1 font-bold border-indigo-200"
                        placeholder={`/${currentStruct.max_post_test_score}`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

