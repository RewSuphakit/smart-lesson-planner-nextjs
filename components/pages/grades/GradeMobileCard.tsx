'use client';

import { memo } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { ReportStudent, Weights, getGradeStyle } from './types';

interface GradeMobileCardProps {
  student: ReportStudent;
  weights: Weights;
  onExamScoreChange: (
    studentId: string,
    field: 'midterm_score' | 'final_score' | 'affective_score',
    value: string
  ) => void;
}

export const GradeMobileCard = memo(function GradeMobileCard({
  student,
  weights,
  onExamScoreChange,
}: GradeMobileCardProps) {
  const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
  const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
  const isKs =
    student.grade === 'ข.ส.' ||
    student.is_absent_final ||
    student.exam_status === 'absent_final' ||
    student.final_score === -1;
  const isMs =
    student.grade === 'ม.ส.' ||
    student.is_incomplete ||
    student.exam_status === 'incomplete' ||
    student.final_score === -2;

  return (
    <div
      className={`p-4 rounded-3xl border transition-all space-y-3 ${
        isKr
          ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60'
          : isKs
            ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60'
            : isMs
              ? 'bg-purple-50/70 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900/60'
              : 'bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-slate-600 shadow-xs'
      }`}
    >
      {/* Card Header: Avatar, Name, Student Code, Grade Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            avatar={student.avatar}
            name={student.name}
            userId={student.student_id}
            size="md"
            className="rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {student.name}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                รหัส: {student.student_code || '-'}
              </p>
              {student.grade_level && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                  {student.grade_level}
                </span>
              )}
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-xs shadow-xs shrink-0 ${getGradeStyle(student.grade)}`}
        >
          เกรด {student.grade}
        </span>
      </div>

      {/* Warnings / Special Status Pills */}
      {(isKr ||
        isKs ||
        isMs ||
        (student.remaining_absences !== undefined && student.remaining_absences <= 2)) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {isKr && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              ⚠️ หมดสิทธิ์สอบ (ข.ร.)
            </span>
          )}
          {isKs && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              ⚠️ ขาดสอบ (ข.ส.)
            </span>
          )}
          {isMs && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              ⚠️ ผลการเรียนไม่สมบูรณ์ (ม.ส.)
            </span>
          )}
          {!isKr && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              ขาดได้อีก {student.remaining_absences} ครั้ง
            </span>
          )}
        </div>
      )}

      {/* Scores Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-2xl bg-pink-50/50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/50">
          <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300 uppercase">
            จิตพิสัย ({weights.affective_weight}%)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max={weights.affective_weight}
            value={student.affective_score ?? ''}
            onChange={(e) => onExamScoreChange(student.student_id, 'affective_score', e.target.value)}
            className="form-input text-center py-1.5 px-1 w-full text-pink-900 dark:text-pink-200 font-bold border-pink-200 dark:border-pink-800 focus:border-pink-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
            placeholder="0"
          />
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
            สอบย่อย ({weights.post_test_weight}%)
          </span>
          <div className="font-extrabold text-amber-800 dark:text-amber-200 text-base font-mono">
            {Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}
          </div>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">
            ดิบ {Number(student.raw_post_test || 0).toFixed(0)}/{student.max_post_test || 0}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
            งานเก็บ ({weights.assignment_weight}%)
          </span>
          <div className="font-extrabold text-emerald-800 dark:text-emerald-200 text-base font-mono">
            {Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}
          </div>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">
            ดิบ {Number(student.raw_assign || 0).toFixed(0)}/{student.max_assign || 0}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
          <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase">
            กลางภาค ({weights.midterm_weight}%)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max={weights.midterm_max_score}
            value={student.midterm_score ?? ''}
            onChange={(e) => onExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
            className="form-input text-center py-1.5 px-1 w-full text-cyan-900 dark:text-cyan-200 font-bold border-cyan-200 dark:border-cyan-800 focus:border-cyan-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
            placeholder="0"
          />
        </div>

        <div className="p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
              ปลายภาค ({weights.final_weight}%)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="ขาดสอบ (ข.ส.)"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '-1')}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-800 dark:hover:text-amber-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
              >
                ข.ส.
              </button>
              <button
                type="button"
                title="ไม่สมบูรณ์ (ม.ส.)"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '-2')}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-950/60 hover:text-purple-800 dark:hover:text-purple-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
              >
                ม.ส.
              </button>
            </div>
          </div>
          {isKs ? (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-600 text-white inline-block shadow-2xs">
                ข.ส.
              </span>
              <button
                type="button"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '0')}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                แก้คะแนน
              </button>
            </div>
          ) : isMs ? (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-purple-600 text-white inline-block shadow-2xs">
                ม.ส.
              </span>
              <button
                type="button"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '0')}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                แก้คะแนน
              </button>
            </div>
          ) : (
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max={weights.final_max_score}
              value={student.final_score ?? ''}
              onChange={(e) => onExamScoreChange(student.student_id, 'final_score', e.target.value)}
              className="form-input text-center py-1.5 px-1 w-full text-blue-900 dark:text-blue-200 font-bold border-blue-200 dark:border-blue-800 focus:border-blue-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
              placeholder="0"
            />
          )}
        </div>

        <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex flex-col justify-center text-center">
          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">
            รวม (100)
          </span>
          <span className="text-lg font-black text-indigo-900 dark:text-indigo-200 font-mono">
            {totalScore.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
});

