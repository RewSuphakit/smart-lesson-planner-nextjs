'use client';

import { memo } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { ReportStudent, Weights, getGradeStyle } from './types';

interface GradeTableRowProps {
  student: ReportStudent;
  idx: number;
  weights: Weights;
  activeNameStyle: React.CSSProperties;
  onExamScoreChange: (
    studentId: string,
    field: 'midterm_score' | 'final_score' | 'affective_score',
    value: string
  ) => void;
}

export const GradeTableRow = memo(function GradeTableRow({
  student,
  idx,
  weights,
  activeNameStyle,
  onExamScoreChange,
}: GradeTableRowProps) {
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
  const isAtRisk =
    !isKr &&
    !isKs &&
    !isMs &&
    (totalScore < 50 ||
      (student.remaining_absences !== undefined &&
        student.remaining_absences <= 2 &&
        student.remaining_absences >= 0));

  let rowClass = 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50';
  let stickyClass = 'bg-white dark:bg-slate-900';
  let borderAccent = 'border-l-4 border-l-transparent';

  if (isKr) {
    rowClass = 'bg-rose-50/25 dark:bg-rose-950/20 hover:bg-rose-50/45 dark:hover:bg-rose-950/30';
    stickyClass = 'bg-rose-50/50 dark:bg-slate-900';
    borderAccent = 'border-l-4 border-l-rose-500';
  } else if (isKs) {
    rowClass = 'bg-amber-50/25 dark:bg-amber-950/20 hover:bg-amber-50/45 dark:hover:bg-amber-950/30';
    stickyClass = 'bg-amber-50/50 dark:bg-slate-900';
    borderAccent = 'border-l-4 border-l-amber-500';
  } else if (isMs) {
    rowClass = 'bg-purple-50/25 dark:bg-purple-950/20 hover:bg-purple-50/45 dark:hover:bg-purple-950/30';
    stickyClass = 'bg-purple-50/50 dark:bg-slate-900';
    borderAccent = 'border-l-4 border-l-purple-500';
  } else if (isAtRisk) {
    rowClass = 'bg-amber-50/15 dark:bg-amber-950/10 hover:bg-amber-50/30 dark:hover:bg-amber-950/20';
    stickyClass = 'bg-amber-50/30 dark:bg-slate-900';
    borderAccent = 'border-l-4 border-l-amber-400';
  } else if (idx % 2 === 1) {
    rowClass = 'bg-slate-50/40 dark:bg-slate-800/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/50';
    stickyClass = 'bg-slate-50/60 dark:bg-slate-900';
  }

  return (
    <tr className={`transition-colors ${rowClass} ${borderAccent}`}>
      <td className="py-2 px-1 text-slate-500 dark:text-slate-400 font-semibold text-center font-mono text-xs whitespace-nowrap">
        {student.student_code || '-'}
      </td>
      <td
        className={`py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-10 ${stickyClass} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]`}
        style={activeNameStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar
              avatar={student.avatar}
              name={student.name}
              userId={student.student_id}
              size="sm"
              className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate" title={student.name}>
                  {student.name}
                </span>
                {student.grade_level && (
                  <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                    {student.grade_level}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                #{student.student_code || '-'}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            {isKr && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[9px] font-extrabold border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" /> ข.ร.
              </span>
            )}
            {isKs && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> ข.ส.
              </span>
            )}
            {isMs && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 text-[9px] font-extrabold border border-purple-200 dark:border-purple-800">
                <AlertCircle className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" /> ม.ส.
              </span>
            )}
            {isAtRisk && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold border border-amber-200 dark:border-amber-800">
                ขาดได้อีก {student.remaining_absences}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Affective Editable Score */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        <input
          type="number"
          step="0.5"
          min="0"
          max={weights.affective_weight}
          value={student.affective_score ?? ''}
          onChange={(e) => onExamScoreChange(student.student_id, 'affective_score', e.target.value)}
          className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-pink-200 dark:border-pink-900/60 bg-white dark:bg-slate-800 text-pink-700 dark:text-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 shadow-2xs transition-all mx-auto"
          placeholder="0"
        />
      </td>

      {/* Raw & Scaled Post-test Breakdown */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        <div className="font-black text-amber-600 dark:text-amber-400 text-xs font-mono">
          {Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
          ดิบ: {Number(student.raw_post_test || 0).toFixed(1)}/{student.max_post_test || 0}
        </div>
      </td>

      {/* Raw & Scaled Assignment Breakdown */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs font-mono">
          {Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
          ดิบ: {Number(student.raw_assign || 0).toFixed(1)}/{student.max_assign || 0}
        </div>
      </td>

      {/* Midterm Editable Score */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-col items-center">
          <input
            type="number"
            step="0.5"
            min="0"
            max={weights.midterm_max_score}
            value={student.midterm_score ?? ''}
            onChange={(e) => onExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
            className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs transition-all mx-auto"
            placeholder="0"
          />
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold mt-0.5 font-mono">
            ได้: {Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1)}
          </div>
        </div>
      </td>

      {/* Final Editable Score with Std02 Vocational Controls */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        {isKs ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-amber-500 text-white shadow-xs">
              ข.ส.
            </span>
            <button
              type="button"
              onClick={() => onExamScoreChange(student.student_id, 'final_score', '0')}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              กรอกคะแนน
            </button>
          </div>
        ) : isMs ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-purple-600 text-white shadow-xs">
              ม.ส.
            </span>
            <button
              type="button"
              onClick={() => onExamScoreChange(student.student_id, 'final_score', '0')}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              กรอกคะแนน
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <input
              type="number"
              step="0.5"
              min="0"
              max={weights.final_max_score}
              value={student.final_score ?? ''}
              onChange={(e) => onExamScoreChange(student.student_id, 'final_score', e.target.value)}
              className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs transition-all mx-auto"
              placeholder="0"
            />
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 font-mono">
              ได้: {Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <button
                type="button"
                title="ทำเครื่องหมายขาดสอบ (ข.ส.)"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '-1')}
                className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/80 border border-amber-200 dark:border-amber-800 transition-colors"
              >
                ข.ส.
              </button>
              <button
                type="button"
                title="ทำเครื่องหมายผลการเรียนไม่สมบูรณ์ (ม.ส.)"
                onClick={() => onExamScoreChange(student.student_id, 'final_score', '-2')}
                className="px-1 py-0.2 rounded text-[8px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 transition-colors"
              >
                ม.ส.
              </button>
            </div>
          </div>
        )}
      </td>

      {/* Precise Total Score */}
      <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-slate-100 text-xs font-mono shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
          {totalScore.toFixed(1)}
        </span>
      </td>

      {/* Grade Pill Badge */}
      <td className="py-2 px-1 text-center">
        <span
          className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg font-black text-xs shadow-xs transition-transform hover:scale-105 ${getGradeStyle(student.grade)}`}
        >
          {student.grade}
        </span>
      </td>
    </tr>
  );
});

