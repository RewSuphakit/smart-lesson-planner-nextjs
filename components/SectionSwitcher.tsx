'use client';

import React from 'react';
import { GitBranch } from 'lucide-react';
import type { StudentSectionGroup } from '@/lib/studentSections';

export interface SectionSwitcherProps {
  sectionGroups: StudentSectionGroup<any>[];
  selectedSectionKey: string;
  onSelectSection: (key: string) => void;
  totalStudentsCount: number;
  sharedBranch?: string | null;
  label?: string;
  allLabel?: string;
  themeColor?: 'indigo' | 'pink' | 'purple';
  rightContent?: React.ReactNode;
  className?: string;
}

export default function SectionSwitcher({
  sectionGroups,
  selectedSectionKey,
  onSelectSection,
  totalStudentsCount,
  sharedBranch,
  label = 'แยกห้องย่อย:',
  allLabel = 'รวมทุกห้อง',
  themeColor = 'indigo',
  rightContent,
  className = '',
}: SectionSwitcherProps) {
  if (!sectionGroups || sectionGroups.length <= 1) return null;

  const activeGradient =
    themeColor === 'pink'
      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20'
      : themeColor === 'purple'
      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
      : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20';

  const labelColor =
    themeColor === 'pink'
      ? 'text-pink-900'
      : themeColor === 'purple'
      ? 'text-purple-900'
      : 'text-indigo-900';

  const iconColor =
    themeColor === 'pink'
      ? 'text-pink-600'
      : themeColor === 'purple'
      ? 'text-purple-600'
      : 'text-indigo-600';

  const branchBadge =
    themeColor === 'pink'
      ? 'bg-pink-50 text-pink-700 border-pink-200/80'
      : themeColor === 'purple'
      ? 'bg-purple-50 text-purple-700 border-purple-200/80'
      : 'bg-violet-50 text-violet-700 border-violet-200/80';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 text-xs font-extrabold ${labelColor} mr-1 shrink-0`}>
          <GitBranch className={`w-4 h-4 ${iconColor} shrink-0`} />
          <span className="shrink-0">{label}</span>
          {sharedBranch && (
            <span className={`px-2 py-0.5 rounded-md ${branchBadge} border font-bold text-[11px] shrink-0`}>
              สาขา{sharedBranch}
            </span>
          )}
        </div>

        {/* Pill: รวมทุกห้อง */}
        <button
          type="button"
          onClick={() => onSelectSection('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            selectedSectionKey === 'all'
              ? activeGradient
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90'
          }`}
          title="แสดงรายชื่อรวมทุกห้องย่อย"
        >
          <span>{allLabel}</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
              selectedSectionKey === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {totalStudentsCount}
          </span>
        </button>

        {/* Pills per Sub-room / Section */}
        {sectionGroups.map((grp) => {
          const isSelected = selectedSectionKey === grp.key;
          return (
            <button
              key={grp.key}
              type="button"
              onClick={() => onSelectSection(grp.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isSelected
                  ? activeGradient
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90'
              }`}
              title={`สลับไปเฉพาะห้อง ${grp.label} (${grp.students.length} คน)`}
            >
              <span>{grp.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {grp.students.length}
              </span>
            </button>
          );
        })}
      </div>

      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </div>
  );
}
