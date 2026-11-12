'use client';

import { memo, Fragment } from 'react';
import MemoizedScoreInput from './MemoizedScoreInput';
import type { Student, ScoreStructure, FullMatrixScoresMap } from './types';

export interface MatrixStudentRowProps {
  student: Student;
  idx: number;
  structures: ScoreStructure[];
  matrixScores: FullMatrixScoresMap;
  onScoreChange: (studentId: string | number, lessonNum: number, field: 'assignment_score' | 'post_test_score', value: string) => void;
  hasMidterm?: boolean;
}

const MatrixStudentRow = memo(function MatrixStudentRow({
  student,
  idx,
  structures,
  matrixScores,
  onScoreChange,
  hasMidterm = true,
}: MatrixStudentRowProps) {
  let totalStudentScore = 0;
  for (let i = 0; i < structures.length; i++) {
    const struct = structures[i];
    const key = `${student.id}_${struct.lesson_number}`;
    const val = matrixScores[key];
    if (val) {
      if (val.assignment_score !== '' && val.assignment_score !== null && val.assignment_score !== undefined) {
        totalStudentScore += Number(val.assignment_score);
      }
      if (val.post_test_score !== '' && val.post_test_score !== null && val.post_test_score !== undefined) {
        totalStudentScore += Number(val.post_test_score);
      }
    }
  }
  totalStudentScore += (hasMidterm ? Number(student.midterm_score || 0) : 0) + Number(Math.max(0, Number(student.final_score || 0))) + Number(student.affective_score || 0);

  const roundedTotal = Math.round(totalStudentScore * 10) / 10;
  const isEven = idx % 2 === 0;
  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/50';
  const cellBg = isEven ? '#ffffff' : '#f8fafc';

  return (
    <tr className={`border-b border-indigo-50 hover:bg-indigo-50/60 ${rowBg} h-9`}>
      <td
        className="p-2 sticky left-0 z-10 font-medium text-slate-500 text-center shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-indigo-100 whitespace-nowrap overflow-hidden text-ellipsis text-xs h-9"
        style={{ left: 0, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: cellBg, backfaceVisibility: 'hidden' }}
      >
        {student.student_code || '-'}
      </td>
      <td
        className="p-2 pl-3 sticky z-10 font-semibold text-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-indigo-100 whitespace-nowrap overflow-hidden text-ellipsis text-xs h-9"
        style={{ left: 120, width: 200, minWidth: 200, maxWidth: 200, backgroundColor: cellBg, backfaceVisibility: 'hidden' }}
        title={student.name}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate">{student.name}</span>
          {student.grade_level && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              {student.grade_level}
            </span>
          )}
        </div>
      </td>
      {structures.map(struct => {
        const key = `${student.id}_${struct.lesson_number}`;
        const val = matrixScores[key];
        return (
          <Fragment key={struct.lesson_number}>
            <td className="p-1 border-l border-indigo-100 text-center h-9">
              <MemoizedScoreInput
                value={val?.assignment_score ?? ''}
                maxScore={Number(struct.max_assignment_score || 0)}
                focusColor="indigo"
                onChange={valStr => onScoreChange(student.id, struct.lesson_number, 'assignment_score', valStr)}
              />
            </td>
            <td className="p-1 border-l border-indigo-50 text-center h-9">
              <MemoizedScoreInput
                value={val?.post_test_score ?? ''}
                maxScore={Number(struct.max_post_test_score || 0)}
                focusColor="amber"
                onChange={valStr => onScoreChange(student.id, struct.lesson_number, 'post_test_score', valStr)}
              />
            </td>
          </Fragment>
        );
      })}
      {hasMidterm && (
        <td className="p-1 border-l border-indigo-100 bg-cyan-50/30 text-center font-bold text-cyan-800 text-xs h-9" title="คะแนนสอบกลางภาค (W9)">
          {student.midterm_score ?? '-'}
        </td>
      )}
      <td className="p-1 border-l border-indigo-50 bg-blue-50/30 text-center font-bold text-blue-800 text-xs h-9" title="คะแนนสอบปลายภาค">
        {student.final_score === -1 ? 'ข.ส.' : student.final_score === -2 ? 'ม.ส.' : (student.final_score ?? '-')}
      </td>
      <td className="p-1 border-l border-indigo-50 bg-pink-50/30 text-center font-bold text-pink-800 text-xs h-9" title="คะแนนจิตพิสัย">
        {student.affective_score ?? '-'}
      </td>
      <td className="p-2 border-l border-indigo-100 bg-indigo-50 text-center font-black text-indigo-700 text-sm h-9">
        {roundedTotal}
      </td>
    </tr>
  );
}, (prev, next) => {
  if (prev.student !== next.student) return false;
  if (prev.idx !== next.idx) return false;
  if (prev.structures !== next.structures) return false;
  if (prev.hasMidterm !== next.hasMidterm) return false;
  if (prev.onScoreChange !== next.onScoreChange) return false;

  for (let i = 0; i < next.structures.length; i++) {
    const lessonNum = next.structures[i].lesson_number;
    const key = `${next.student.id}_${lessonNum}`;
    const pVal = prev.matrixScores[key];
    const nVal = next.matrixScores[key];
    if ((pVal?.assignment_score ?? '') !== (nVal?.assignment_score ?? '')) return false;
    if ((pVal?.post_test_score ?? '') !== (nVal?.post_test_score ?? '')) return false;
  }
  return true;
});

MatrixStudentRow.displayName = 'MatrixStudentRow';

export default MatrixStudentRow;

