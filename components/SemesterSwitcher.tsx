'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSemester } from '@/context/SemesterContext';
import { Semester } from '@/services/semester';
import {
  Layers,
  ChevronDown,
  Check,
  Plus,
  Calendar,
  Settings,
  ArrowRightLeft,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';

interface SemesterSwitcherProps {
  className?: string;
  isCompact?: boolean;
  isCollapsed?: boolean;
}

export default function SemesterSwitcher({ className = '', isCompact = false, isCollapsed = false }: SemesterSwitcherProps) {
  const { semesters, activeSemester, switchSemester, loading } = useSemester();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitchingId, setIsSwitchingId] = useState<number | null>(null);
  const [pendingSemester, setPendingSemester] = useState<Semester | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const collapsedButtonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position for collapsed flyout dropdown
  useEffect(() => {
    if (isOpen && isCollapsed && collapsedButtonRef.current) {
      const updatePos = () => {
        if (!collapsedButtonRef.current) return;
        const rect = collapsedButtonRef.current.getBoundingClientRect();
        const maxTop = Math.max(16, window.innerHeight - 440);
        setPortalPos({
          top: Math.max(16, Math.min(rect.top, maxTop)),
          left: rect.right + 10,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
    }
  }, [isOpen, isCollapsed]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inContainer = containerRef.current && containerRef.current.contains(target);
      const inPortal = portalMenuRef.current && portalMenuRef.current.contains(target);
      if (!inContainer && !inPortal) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (id: number) => {
    if (id === activeSemester?.id) {
      setIsOpen(false);
      return;
    }
    const target = semesters.find((s) => s.id === id);
    if (!target) return;
    setIsOpen(false);
    setPendingSemester(target);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingSemester) return;
    setIsSwitchingId(pendingSemester.id);
    setPendingSemester(null);
    try {
      await switchSemester(pendingSemester.id);
    } finally {
      setIsSwitchingId(null);
    }
  };

  const handleCancelSwitch = () => {
    setPendingSemester(null);
  };

  // Group semesters by Academic Year (ปีการศึกษา)
  const groupedByYear = useMemo(() => {
    const map = new Map<string, { term1?: Semester; term2?: Semester; term3?: Semester; all: Semester[] }>();
    for (const sem of semesters) {
      const year = sem.academic_year;
      if (!map.has(year)) {
        map.set(year, { all: [] });
      }
      const entry = map.get(year)!;
      entry.all.push(sem);
      if (sem.term_number === 1) entry.term1 = sem;
      else if (sem.term_number === 2) entry.term2 = sem;
      else if (sem.term_number === 3) entry.term3 = sem;
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [semesters]);

  // Find the other term for the currently active year for quick flip
  const counterpartTerm = useMemo(() => {
    if (!activeSemester) return null;
    const currentYearGroup = groupedByYear.find(([year]) => year === activeSemester.academic_year);
    if (!currentYearGroup) return null;
    const { term1, term2 } = currentYearGroup[1];
    if (activeSemester.term_number === 1 && term2) return term2;
    if (activeSemester.term_number === 2 && term1) return term1;
    return null;
  }, [activeSemester, groupedByYear]);

  if (loading && !activeSemester) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 animate-pulse text-xs text-slate-400 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  const dropdownBody = (
    <>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
          เลือกภาคเรียน
        </span>
        {activeSemester && (
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
            ปัจจุบัน: เทอม {activeSemester.term_number}/{activeSemester.academic_year}
          </span>
        )}
      </div>

      {/* Quick Flip Toggle (1-click switch to opposite term) */}
      {counterpartTerm && (
        <div className="px-2.5 pt-2 pb-1">
          <button
            type="button"
            onClick={() => handleSelect(counterpartTerm.id)}
            disabled={isSwitchingId === counterpartTerm.id}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 hover:from-indigo-100 hover:to-purple-100 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 dark:hover:from-slate-750 dark:hover:to-slate-750 border border-indigo-200/80 dark:border-slate-700 text-indigo-900 dark:text-indigo-300 transition-all text-xs font-bold group/flip shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover/flip:rotate-180 transition-transform duration-300" />
              <span className="truncate">สลับไป <strong>เทอม {counterpartTerm.term_number}/{counterpartTerm.academic_year}</strong></span>
            </div>
            {isSwitchingId === counterpartTerm.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold underline shrink-0 ml-1">สลับ</span>
            )}
          </button>
        </div>
      )}

      {/* Grouped by Academic Year List */}
      <div className="max-h-72 overflow-y-auto p-2.5 space-y-2.5">
        {groupedByYear.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            ยังไม่มีข้อมูลภาคเรียนในระบบ
          </div>
        ) : (
          groupedByYear.map(([year, { term1, term2, term3 }]) => (
            <div key={year} className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span>ปีการศึกษา {year}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {term1 && term2 ? 'ครบ 2 เทอม' : term1 ? 'มีเทอม 1' : 'มีเทอม 2'}
                </span>
              </div>

              {/* 2-Column Buttons for Term 1 and Term 2 */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* Term 1 Button */}
                {term1 ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(term1.id)}
                    disabled={isSwitchingId === term1.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      term1.is_active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      {term1.is_active && <Check className="w-3 h-3 text-white shrink-0" />}
                      <span className="truncate">เทอม 1</span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${term1.is_active ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      {term1.classroom_count ?? 0} ห้อง
                    </span>
                  </button>
                ) : (
                  <Link
                    href="/semesters"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white/50 dark:bg-slate-800/50 transition-colors"
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span className="truncate">สร้างเทอม 1</span>
                  </Link>
                )}

                {/* Term 2 Button */}
                {term2 ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(term2.id)}
                    disabled={isSwitchingId === term2.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      term2.is_active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      {term2.is_active && <Check className="w-3 h-3 text-white shrink-0" />}
                      <span className="truncate">เทอม 2</span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${term2.is_active ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      {term2.classroom_count ?? 0} ห้อง
                    </span>
                  </button>
                ) : (
                  <Link
                    href="/semesters"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 bg-white/50 dark:bg-slate-800/50 transition-colors"
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span className="truncate">สร้างเทอม 2</span>
                  </Link>
                )}
              </div>

              {/* Optional Summer Term if exists */}
              {term3 && (
                <button
                  type="button"
                  onClick={() => handleSelect(term3.id)}
                  disabled={isSwitchingId === term3.id}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    term3.is_active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {term3.is_active && <Check className="w-3 h-3 shrink-0" />}
                    <span className="truncate">ภาคฤดูร้อน (Summer)</span>
                  </div>
                  <span className={`text-[10px] shrink-0 ${term3.is_active ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {term3.classroom_count ?? 0} ห้อง
                  </span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Action */}
      <div className="pt-2 mt-0.5 border-t border-slate-100 dark:border-slate-800 px-2.5">
        <Link
          href="/semesters"
          onClick={() => setIsOpen(false)}
          className="flex items-center justify-center gap-1.5 w-full py-2 px-2.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-indigo-100/50 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">จัดการและคัดลอกข้อมูลภาคเรียน</span>
        </Link>
      </div>
    </>
  );

  return (
    <div ref={containerRef} className={`relative z-30 ${className}`}>
      {/* Unified Trigger Button with smooth collapse/expand transition */}
      <button
        type="button"
        ref={collapsedButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center rounded-xl transition-all duration-300 group text-left relative ${
          isCollapsed ? 'overflow-hidden lg:overflow-visible' : 'overflow-hidden'
        } ${
          isCompact
            ? 'px-3 py-2 justify-between gap-2 bg-indigo-50/80 hover:bg-indigo-100/70 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-indigo-200/60 dark:border-slate-700 shadow-xs'
            : isCollapsed
              ? 'px-3 py-2 justify-between gap-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-indigo-200/50 hover:border-indigo-300 dark:border-slate-700 shadow-xs lg:h-9 lg:w-9 lg:mx-auto lg:p-0 lg:justify-center lg:bg-transparent lg:hover:bg-transparent lg:dark:bg-transparent lg:dark:hover:bg-transparent lg:border-0 lg:dark:border-0 lg:shadow-none cursor-pointer'
              : 'px-3 py-2 justify-between gap-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-indigo-200/50 hover:border-indigo-300 dark:border-slate-700 shadow-xs hover:shadow-sm'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={
          isCollapsed && activeSemester
            ? `ปี ${activeSemester.academic_year} เทอม ${activeSemester.term_number} (${activeSemester.name}) - คลิกเพื่อเปลี่ยน`
            : 'สลับปีการศึกษา / เทอม 1 หรือ เทอม 2'
        }
      >
        <div className={`flex items-center min-w-0 ${isCollapsed ? 'gap-2.5 lg:gap-0 lg:justify-center' : 'gap-2.5'}`}>
          <div className="relative shrink-0">
            <div className={`${isCollapsed ? 'w-8 h-8 rounded-xl' : 'w-7 h-7 rounded-lg'} bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform`}>
              <Layers className={`${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
            </div>
            {activeSemester && (
              <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white border-2 border-white dark:border-slate-900 shadow-md transition-all duration-300 z-10 ${
                isCollapsed ? 'opacity-0 lg:opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              }`}>
                {activeSemester.term_number}
              </span>
            )}
          </div>
          <div
            className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
              isCollapsed
                ? 'max-w-[160px] opacity-100 lg:max-w-0 lg:w-0 lg:min-w-0 lg:opacity-0 lg:-translate-x-2'
                : 'max-w-[160px] opacity-100 translate-x-0'
            }`}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {activeSemester ? `ปี ${activeSemester.academic_year}` : 'เลือกภาคเรียน'}
              </span>
              {activeSemester && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-indigo-600 text-white shadow-2xs">
                  เทอม {activeSemester.term_number}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">
              {activeSemester ? activeSemester.name : 'ยังไม่ได้เลือก'}
            </p>
          </div>
        </div>

        <div
          className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
            isCollapsed ? 'max-w-6 opacity-100 lg:max-w-0 lg:w-0 lg:min-w-0 lg:opacity-0 lg:scale-75' : 'max-w-6 opacity-100 scale-100'
          }`}
        >
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        isCollapsed && mounted ? (
          createPortal(
            <div
              ref={portalMenuRef}
              style={{
                position: 'fixed',
                top: `${portalPos?.top ?? 75}px`,
                left: `${portalPos?.left ?? 86}px`,
                zIndex: 9999,
              }}
              className="w-[290px] py-2.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-slate-700 rounded-2xl shadow-2xl shadow-indigo-900/15 dark:shadow-black/50 animate-fade-in-up"
            >
              {dropdownBody}
            </div>,
            document.body
          )
        ) : (
          <div className={`absolute top-full mt-2 py-2.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-slate-700 rounded-2xl shadow-2xl shadow-indigo-900/10 dark:shadow-black/50 z-[100] animate-fade-in-up ${
            isCompact ? 'right-0 w-[290px] max-w-[calc(100vw-1.5rem)]' : 'left-0 right-0 w-full'
          }`}>
            {dropdownBody}
          </div>
        )
      )}

      {/* ── Confirmation Modal ── */}
      {pendingSemester && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-semester-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={handleCancelSwitch}
          />

          {/* Dialog Card */}
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-indigo-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400" />

            {/* Close button */}
            <button
              type="button"
              onClick={handleCancelSwitch}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 py-5">
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3
                    id="confirm-semester-title"
                    className="text-sm font-extrabold text-slate-800 dark:text-slate-100"
                  >
                    เปลี่ยนภาคเรียน?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    กำลังจะสลับไปยัง{' '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {pendingSemester.name}
                    </span>
                  </p>
                </div>
              </div>

              {/* Warning message */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed mb-5">
                ข้อมูลทุกหน้าจะถูกโหลดใหม่ตามภาคเรียนที่เลือก<br />
                หากมีการแก้ไขที่ยังไม่ได้บันทึก ข้อมูลอาจสูญหาย
              </div>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelSwitch}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSwitch}
                  disabled={isSwitchingId === pendingSemester.id}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 disabled:opacity-70"
                >
                  {isSwitchingId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังเปลี่ยน...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>ยืนยันเปลี่ยนภาคเรียน</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
