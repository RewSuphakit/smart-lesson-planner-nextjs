'use client';

import { memo } from 'react';

export interface MemoizedScoreInputProps {
  value: number | string;
  maxScore: number;
  focusColor: 'indigo' | 'amber';
  onChange: (value: string) => void;
}

const MemoizedScoreInput = memo(function MemoizedScoreInput({
  value,
  maxScore,
  focusColor,
  onChange,
}: MemoizedScoreInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const num = parseFloat(val);
    if (!isNaN(num) && maxScore > 0 && num > maxScore) {
      val = String(maxScore);
    }
    onChange(val);
  };

  const focusClass = focusColor === 'indigo'
    ? 'focus:border-indigo-500 focus:bg-indigo-50/50'
    : 'focus:border-amber-500 focus:bg-amber-50/50';

  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.5"
      min="0"
      max={maxScore > 0 ? maxScore : undefined}
      value={value !== null && value !== undefined ? value : ''}
      onChange={handleChange}
      className={`w-full text-center py-1 px-1 rounded-lg border border-indigo-100 bg-white font-medium text-slate-800 text-xs touch-manipulation focus:outline-none transition-colors ${focusClass}`}
    />
  );
}, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.maxScore === next.maxScore &&
    prev.focusColor === next.focusColor
  );
});

MemoizedScoreInput.displayName = 'MemoizedScoreInput';

export default MemoizedScoreInput;

