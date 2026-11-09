'use client';

import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { HolidayInfo } from './types';

export interface MemoizedAttendanceCellProps {
  status: string | null;
  isEditing: boolean;
  onEditClick: () => void;
  onStatusSelect: (status: string) => void;
  onDeleteClick?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  holiday?: HolidayInfo | null;
}

export const MemoizedAttendanceCell = memo(({
  status,
  isEditing,
  onEditClick,
  onStatusSelect,
  onDeleteClick,
  popoverRef,
  holiday
}: MemoizedAttendanceCellProps) => {
  const isGovHoliday = holiday?.type === 'government';
  const isWeekend = holiday?.type === 'weekend';

  return (
    <td className={`p-2 border-r border-indigo-100/40 text-center relative h-14 min-w-[80px] transition-colors ${isGovHoliday ? 'bg-amber-50/40' : isWeekend ? 'bg-slate-50/50' : ''
      }`}>
      {!status ? (
        <button
          onClick={onEditClick}
          className={`w-8 h-8 rounded-full border flex items-center justify-center mx-auto transition-all text-xs font-semibold touch-manipulation ${isGovHoliday
            ? 'border-amber-300 bg-amber-100/80 text-amber-800 hover:bg-amber-200 hover:border-amber-400 shadow-sm'
            : isWeekend
              ? 'border-slate-200 bg-slate-100/80 text-slate-400 hover:bg-slate-200'
              : 'border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
            }`}
          title={holiday ? `วันหยุด: ${holiday.name} (คลิกเพื่อลงชื่อย้อนหลัง)` : 'คลิกเพื่อลงชื่อย้อนหลัง'}
        >
          {isGovHoliday ? '🏖️' : '+'}
        </button>
      ) : (
        <button
          onClick={onEditClick}
          className={`w-14 py-1.5 rounded-xl text-[10px] font-bold mx-auto flex items-center justify-center border transition-all hover:scale-105 touch-manipulation ${status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' :
            status === 'late' ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' :
              status === 'absent' ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' :
                'bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100'
            }`}
        >
          {status === 'present' ? 'มา' : status === 'late' ? 'สาย' : status === 'absent' ? 'ขาด' : 'ลา'}
        </button>
      )}

      {isEditing && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white p-2 rounded-xl border border-indigo-100 shadow-xl flex items-center gap-1.5 animate-scale-up"
        >
          <button
            onClick={() => onStatusSelect('present')}
            className="w-7 h-7 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center justify-center hover:bg-emerald-600 shadow-sm touch-manipulation cursor-pointer"
            title="มาเรียน"
          >
            มา
          </button>
          <button
            onClick={() => onStatusSelect('late')}
            className="w-7 h-7 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center justify-center hover:bg-amber-600 shadow-sm touch-manipulation cursor-pointer"
            title="สาย"
          >
            สาย
          </button>
          <button
            onClick={() => onStatusSelect('absent')}
            className="w-7 h-7 rounded-lg bg-red-500 text-white font-bold text-xs flex items-center justify-center hover:bg-red-600 shadow-sm touch-manipulation cursor-pointer"
            title="ขาด"
          >
            ขาด
          </button>
          <button
            onClick={() => onStatusSelect('leave')}
            className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center hover:bg-blue-600 shadow-sm touch-manipulation cursor-pointer"
            title="ลา"
          >
            ลา
          </button>
          {status && onDeleteClick && (
            <button
              onClick={onDeleteClick}
              className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs flex items-center justify-center border border-red-200 shadow-sm touch-manipulation cursor-pointer"
              title="ลบ/ยกเลิกการเช็คชื่อช่องนี้"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </td>
  );
}, (prev, next) => (
  prev.status === next.status &&
  prev.isEditing === next.isEditing &&
  prev.holiday?.date === next.holiday?.date &&
  prev.holiday?.type === next.holiday?.type
));

MemoizedAttendanceCell.displayName = 'MemoizedAttendanceCell';
