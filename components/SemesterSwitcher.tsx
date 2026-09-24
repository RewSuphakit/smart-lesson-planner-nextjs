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
}

export default function SemesterSwitcher({ className = '', isCompact = false }: SemesterSwitcherProps) {
  const { semesters, activeSemester, switchSemester, loading } = useSemester();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitchingId, setIsSwitchingId] = useState<number | null>(null);
  const [pendingSemester, setPendingSemester] = useState<Semester | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div ref={dropdownRef} className={`relative z-30 ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all duration-300 group text-left ${
          isCompact
            ? 'bg-indigo-50/80 hover:bg-indigo-100/70 border border-indigo-200/60 shadow-xs'
            : 'bg-white/80 hover:bg-white border border-indigo-200/50 hover:border-indigo-300 shadow-xs hover:shadow-sm'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="สลับปีการศึกษา / เทอม 1 หรือ เทอม 2"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                {activeSemester ? `ปี ${activeSemester.academic_year}` : 'เลือกภาคเรียน'}
              </span>
              {activeSemester && (
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-indigo-600 text-white shadow-2xs">
                  เทอม {activeSemester.term_number}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {activeSemester ? activeSemester.name : 'ยังไม่ได้เลือก'}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-600' : 'group-hover:text-slate-600'
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute top-full mt-2 py-2.5 bg-white/95 backdrop-blur-2xl border border-indigo-200/80 rounded-2xl shadow-2xl shadow-indigo-500/15 z-[100] animate-fade-in-up ${
          isCompact ? 'right-0 w-[290px] sm:w-80' : 'left-0 right-0 sm:right-auto sm:w-80'
        }`}>
          {/* Header */}
          <div className="px-4 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              เลือกปีการศึกษา & เทอม
            </span>
            {activeSemester && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ปัจจุบัน: เทอม {activeSemester.term_number}/{activeSemester.academic_year}
              </span>
            )}
          </div>

          {/* Quick Flip Toggle (1-click switch to opposite term) */}
          {counterpartTerm && (
            <div className="px-3 pt-2.5 pb-1">
              <button
                type="button"
                onClick={() => handleSelect(counterpartTerm.id)}
                disabled={isSwitchingId === counterpartTerm.id}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200/80 text-indigo-900 transition-all text-xs font-bold group/flip shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 group-hover/flip:rotate-180 transition-transform duration-300" />
                  <span>สลับไป <strong>เทอม {counterpartTerm.term_number}/{counterpartTerm.academic_year}</strong></span>
                </div>
                {isSwitchingId === counterpartTerm.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <span className="text-[10px] text-indigo-600 font-semibold underline">กดสลับทันที</span>
                )}
              </button>
            </div>
          )}

          {/* Grouped by Academic Year List */}
          <div className="max-h-72 overflow-y-auto p-3 space-y-3">
            {groupedByYear.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                ยังไม่มีข้อมูลภาคเรียนในระบบ
              </div>
            ) : (
              groupedByYear.map(([year, { term1, term2, term3 }]) => (
                <div key={year} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ปีการศึกษา {year}</span>
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium">
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
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          term1.is_active
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {term1.is_active && <Check className="w-3 h-3 text-white" />}
                          <span>เทอม 1</span>
                        </div>
                        <span className={`text-[10px] font-mono ${term1.is_active ? 'text-indigo-200' : 'text-slate-600'}`}>
                          {term1.classroom_count ?? 0} ห้อง
                        </span>
                      </button>
                    ) : (
                      <Link
                        href="/semesters"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-[11px] font-medium text-slate-600 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 bg-white/50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>สร้างเทอม 1</span>
                      </Link>
                    )}

                    {/* Term 2 Button */}
                    {term2 ? (
                      <button
                        type="button"
                        onClick={() => handleSelect(term2.id)}
                        disabled={isSwitchingId === term2.id}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          term2.is_active
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {term2.is_active && <Check className="w-3 h-3 text-white" />}
                          <span>เทอม 2</span>
                        </div>
                        <span className={`text-[10px] font-mono ${term2.is_active ? 'text-indigo-200' : 'text-slate-600'}`}>
                          {term2.classroom_count ?? 0} ห้อง
                        </span>
                      </button>
                    ) : (
                      <Link
                        href="/semesters"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-[11px] font-medium text-slate-600 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 bg-white/50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>สร้างเทอม 2</span>
                      </Link>
                    )}
                  </div>

                  {/* Optional Summer Term if exists */}
                  {term3 && (
                    <button
                      type="button"
                      onClick={() => handleSelect(term3.id)}
                      disabled={isSwitchingId === term3.id}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        term3.is_active
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {term3.is_active && <Check className="w-3 h-3" />}
                        <span>ภาคฤดูร้อน (Summer)</span>
                      </div>
                      <span className={`text-[10px] ${term3.is_active ? 'text-indigo-200' : 'text-slate-600'}`}>
                        {term3.classroom_count ?? 0} ห้อง
                      </span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-2 mt-1 border-t border-slate-100 px-3">
            <Link
              href="/semesters"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>จัดการและคัดลอกข้อมูลภาคเรียน</span>
            </Link>
          </div>
        </div>
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
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-indigo-500/20 border border-indigo-100 overflow-hidden animate-fade-in-up">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400" />

            {/* Close button */}
            <button
              type="button"
              onClick={handleCancelSwitch}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 py-5">
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3
                    id="confirm-semester-title"
                    className="text-sm font-extrabold text-slate-800"
                  >
                    เปลี่ยนภาคเรียน?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำลังจะสลับไปยัง{' '}
                    <span className="font-bold text-indigo-600">
                      {pendingSemester.name}
                    </span>
                  </p>
                </div>
              </div>

              {/* Warning message */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed mb-5">
                ข้อมูลทุกหน้าจะถูกโหลดใหม่ตามภาคเรียนที่เลือก<br />
                หากมีการแก้ไขที่ยังไม่ได้บันทึก ข้อมูลอาจสูญหาย
              </div>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelSwitch}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
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
