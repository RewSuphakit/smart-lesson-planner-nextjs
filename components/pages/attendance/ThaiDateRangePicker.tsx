'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { checkThaiHoliday } from '@/lib/thaiHolidays';
import { THAI_MONTHS_SHORT, THAI_MONTHS_FULL } from './types';

export interface ThaiDateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const ThaiDateRangePicker = memo(({ startDate, endDate, onChange }: ThaiDateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [pickingStep, setPickingStep] = useState<'start' | 'end'>('start');

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = window.innerWidth < 640 ? 320 : 360;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(16, left)
      });
    }
  }, []);

  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
  }, [startDate, endDate, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, { capture: true });
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const thaiMonths = THAI_MONTHS_FULL;

  const formatShortThai = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const yearBE = d.getFullYear() + 543;
    return `${day} ${month} ${yearBE}`;
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleDateClick = (dayNum: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${viewYear}-${monthStr}-${dayStr}`;

    if (pickingStep === 'start' || !draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd('');
      setPickingStep('end');
    } else {
      if (dateStr < draftStart) {
        setDraftStart(dateStr);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(dateStr);
      }
      setPickingStep('start');
    }
  };

  const isSelectedStart = (dayNum: number) => {
    if (!draftStart) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    return draftStart === `${viewYear}-${monthStr}-${dayStr}`;
  };

  const isSelectedEnd = (dayNum: number) => {
    if (!draftEnd) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    return draftEnd === `${viewYear}-${monthStr}-${dayStr}`;
  };

  const isInRange = (dayNum: number) => {
    if (!draftStart || !draftEnd) return false;
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
    return dateStr >= draftStart && dateStr <= draftEnd;
  };

  const handlePresetSelect = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toISOString().split('T')[0];
    setDraftStart(start);
    setDraftEnd(end);
  };

  const handleApply = () => {
    onChange(draftStart, draftEnd);
    setIsOpen(false);
  };

  const isPresetActive = (days: number) => {
    if (!draftStart || !draftEnd) return false;
    const end = new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toISOString().split('T')[0];
    return draftStart === start && draftEnd === end;
  };

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-indigo-100/90 shadow-md hover:shadow-lg shadow-indigo-500/5 transition-all duration-200 cursor-pointer select-none"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <CalendarIcon className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500">ช่วงวันที่แสดงผล</span>
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            {startDate ? formatShortThai(startDate) : 'ทั้งหมด'}
            <span className="text-slate-400">→</span>
            {endDate ? formatShortThai(endDate) : 'ปัจจุบัน'}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-90 text-indigo-600' : ''}`} />
      </button>

      {/* Thai Calendar Popover via Portal */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          className="fixed z-[9999] w-[320px] sm:w-[360px] bg-white p-4 sm:p-5 rounded-3xl border border-indigo-100 shadow-2xl shadow-indigo-500/20 animate-scale-up text-slate-800"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="font-extrabold text-slate-800 text-sm sm:text-base">
                {thaiMonths[viewMonth]} {viewYear + 543}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Presets Pills */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => handlePresetSelect(days)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${isPresetActive(days)
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100'
                  }`}
              >
                {days} วัน
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                setDraftStart(firstDay);
                setDraftEnd(now.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftStart('');
                setDraftEnd('');
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              ทั้งหมด
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[11px] text-slate-500 mb-2">
            <span className="text-rose-500">อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span className="text-indigo-500">ส</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="h-8 sm:h-9" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isStart = isSelectedStart(dayNum);
              const isEnd = isSelectedEnd(dayNum);
              const inRange = isInRange(dayNum);

              const monthStr = String(viewMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const dateStr = `${viewYear}-${monthStr}-${dayStr}`;
              const dayHoliday = checkThaiHoliday(dateStr);

              let bgClass = 'hover:bg-indigo-50 text-slate-700';
              if (isStart || isEnd) {
                bgClass = 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black shadow-md shadow-indigo-500/30 rounded-xl';
              } else if (inRange) {
                bgClass = 'bg-indigo-100/80 text-indigo-800 font-bold rounded-lg';
              } else if (dayHoliday?.type === 'government') {
                bgClass = 'bg-amber-50 text-amber-900 font-bold hover:bg-amber-100 border border-amber-200/60';
              }

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleDateClick(dayNum)}
                  title={dayHoliday ? dayHoliday.name : undefined}
                  className={`h-8 sm:h-9 text-xs font-semibold rounded-xl flex flex-col items-center justify-center transition-all duration-150 relative cursor-pointer ${bgClass}`}
                >
                  <span>{dayNum}</span>
                  {dayHoliday?.type === 'government' && !isStart && !isEnd && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute bottom-1"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Popover Footer Actions */}
          <div className="mt-4 pt-3 border-t border-indigo-50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[170px]">
              {draftStart ? formatShortThai(draftStart) : 'ทั้งหมด'} {draftEnd ? `→ ${formatShortThai(draftEnd)}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

ThaiDateRangePicker.displayName = 'ThaiDateRangePicker';
