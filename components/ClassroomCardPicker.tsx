'use client';

import { useState, useMemo } from 'react';
import { Search, X, Users, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { parseClassroomName } from '@/lib/classroom';

export interface ClassroomPickerItem {
  id: string | number;
  name: string;
  student_count?: number;
  total_classes?: number;
  total_weeks?: number;
  min_attendance_percent?: number;
  curriculum_type?: string;
  description?: string | null;
  affective_weight?: number;
  assignment_weight?: number;
  post_test_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
  [key: string]: any;
}

interface ClassroomCardPickerProps {
  classrooms: ClassroomPickerItem[];
  onSelect: (classroomId: string) => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actionText?: string;
  themeColor?: 'indigo' | 'pink' | 'emerald' | 'amber' | 'purple';
  customCardStat?: (c: ClassroomPickerItem) => React.ReactNode;
}

export default function ClassroomCardPicker({
  classrooms,
  onSelect,
  title,
  subtitle = 'เลือกรายวิชาและห้องเรียนที่ต้องการจัดการข้อมูล',
  icon,
  actionText = 'เข้าสู่ห้องเรียนนี้',
  themeColor = 'indigo',
  customCardStat,
}: ClassroomCardPickerProps) {
  const [classFilter, setClassFilter] = useState<'all' | 'pvch' | 'pvs'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const pvchCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch').length;
  }, [classrooms]);

  const pvsCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs').length;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    let list = classrooms;
    if (classFilter === 'pvch') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch');
    } else if (classFilter === 'pvs') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name?.toLowerCase().includes(q));
    }
    return list;
  }, [classrooms, classFilter, searchQuery]);

  // Color schemes for theme
  const themeGradients = {
    indigo: 'from-indigo-500 via-indigo-600 to-purple-600 shadow-indigo-500/25',
    pink: 'from-pink-500 via-rose-500 to-purple-600 shadow-pink-500/25',
    emerald: 'from-emerald-500 via-teal-600 to-cyan-600 shadow-emerald-500/25',
    amber: 'from-amber-500 via-orange-500 to-red-500 shadow-amber-500/25',
    purple: 'from-purple-500 via-fuchsia-600 to-indigo-600 shadow-purple-500/25',
  };

  const actionTextColors = {
    indigo: 'text-indigo-600 group-hover:text-indigo-700',
    pink: 'text-pink-600 group-hover:text-pink-700',
    emerald: 'text-emerald-600 group-hover:text-emerald-700',
    amber: 'text-amber-700 group-hover:text-amber-800',
    purple: 'text-purple-600 group-hover:text-purple-700',
  };

  const actionButtonBgs = {
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    pink: 'bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white',
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & Filters */}
      <div className="glass p-5 rounded-2xl border border-white/40 shadow-xl shadow-indigo-100/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${themeGradients[themeColor]} text-white flex items-center justify-center shadow-lg shrink-0`}>
            {icon || <BookOpen className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {classrooms.length} ห้อง
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Category Filter Pills */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setClassFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                classFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({classrooms.length})
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('pvch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                classFilter === 'pvch'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ปวช. ({pvchCount})
            </button>
            <button
              type="button"
              onClick={() => setClassFilter('pvs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                classFilter === 'pvs'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ปวส. ({pvsCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสวิชา, ชื่อวิชา..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Classroom Cards Grid */}
      {filteredClassrooms.length === 0 ? (
        <div className="glass p-12 text-center rounded-2xl border border-white/40 shadow-sm">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">ไม่พบห้องเรียนที่ตรงกับเงื่อนไข</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery ? `ไม่มีห้องเรียนที่ตรงกับคำค้นหา "${searchQuery}"` : 'ยังไม่มีห้องเรียนในกลุ่มนี้'}
          </p>
          {(searchQuery || classFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setClassFilter('all'); }}
              className="mt-3.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredClassrooms.map(c => {
            const parsed = parseClassroomName(c.name);
            const isPvs = parsed.curriculumType === 'pvs';

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(String(c.id))}
                className="group relative bg-white/85 hover:bg-white backdrop-blur-xl rounded-2xl p-5 border border-indigo-100/80 hover:border-indigo-300 text-left flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer overflow-hidden shadow-sm"
              >
                {/* Top Accent Gradient Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all ${
                  isPvs
                    ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500'
                    : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500'
                }`} />

                <div>
                  {/* Badge Header Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {parsed.code && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100/90 text-slate-700 border border-slate-200 shadow-2xs">
                          {parsed.code}
                        </span>
                      )}
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                        isPvs
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {isPvs ? 'ปวส.' : 'ปวช.'}
                      </span>
                      {parsed.groupName && (
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
                          {parsed.groupName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Course Title */}
                  <h4 className="font-black text-base text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug mb-3.5">
                    {parsed.subjectTitle}
                  </h4>

                  {/* Info Box */}
                  <div className="space-y-2 bg-slate-50/80 group-hover:bg-indigo-50/40 p-3 rounded-xl border border-slate-100 group-hover:border-indigo-100/60 transition-colors mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>นักเรียน</span>
                      </span>
                      <strong className="text-slate-800 font-bold">{c.student_count || 0} คน</strong>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>แผนการสอน</span>
                      </span>
                      <span className="text-slate-700 font-medium">
                        {c.total_weeks || (isPvs ? 15 : 18)} สัปดาห์ · {c.total_classes || 40} คาบ
                      </span>
                    </div>

                    {customCardStat && customCardStat(c)}
                  </div>
                </div>

                {/* Footer Prompt */}
                <div className={`pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold ${actionTextColors[themeColor]}`}>
                  <span>{actionText}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all group-hover:translate-x-1 shadow-xs ${actionButtonBgs[themeColor]}`}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
