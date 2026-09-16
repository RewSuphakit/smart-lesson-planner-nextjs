'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Plus, Edit, Trash2, X, Loader2, Search, Calendar, ChevronDown, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

interface Classroom {
  id: string;
  name: string;
  description?: string;
  student_count?: number;
  late_to_absent_ratio?: number;
  leave_to_absent_ratio?: number;
  total_classes?: number;
  min_attendance_percent?: number;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
  semester_start_date?: string | null;
  semester_end_date?: string | null;
  current_week?: number | null;
}

interface TimetableEntry {
  id: number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  subject_code?: string | null;
  subject_name?: string | null;
  room?: string | null;
  instructor?: string | null;
  group_name?: string | null;
  hours?: number;
  entry_type?: string;
  color?: string | null;
  classroom_id?: number | null;
}

interface ClassroomCardProps {
  c: Classroom;
  i: number;
  colors: string[];
  onEdit: (c: Classroom) => void;
  onDelete: (id: string) => void;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function formatThaiShortDate(dateStr: string | null | undefined, includeYear = true): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11) {
      return dateStr;
    }

    const monthName = THAI_MONTHS_SHORT[month];
    if (!includeYear) {
      return `${day} ${monthName}`;
    }
    const shortYear = (year + 543) % 100;
    return `${day} ${monthName} ${shortYear}`;
  } catch {
    return dateStr;
  }
}

function calculateEndDate(startDateStr: string | null | undefined, totalWeeks: number): string | null {
  if (!startDateStr) return null;
  try {
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + (totalWeeks * 7) - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function getSemesterStatus(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
  totalWeeks: number,
  currentWeek: number | null | undefined
) {
  if (!startDateStr) return null;
  const now = new Date();
  const thaiOffsetMs = 7 * 60 * 60 * 1000;
  const nowThai = new Date(now.getTime() + thaiOffsetMs);
  const todayStr = nowThai.toISOString().split('T')[0];

  if (currentWeek) {
    return {
      label: `สัปดาห์ ${currentWeek}/${totalWeeks}`,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100/80',
    };
  }
  if (endDateStr && todayStr > endDateStr) {
    return {
      label: 'สิ้นสุดภาคเรียน',
      color: 'text-slate-500 bg-slate-100 border-slate-200',
    };
  }
  if (todayStr < startDateStr) {
    return {
      label: 'ยังไม่เปิดเรียน',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    };
  }
  return {
    label: 'สิ้นสุดภาคเรียน',
    color: 'text-slate-500 bg-slate-100 border-slate-200',
  };
}

function ClassroomCard({ c, onEdit, onDelete }: ClassroomCardProps) {
  const isPvs = c.curriculum_type === 'pvs';
  const isCustom = c.curriculum_type === 'custom';
  const weeks = c.total_weeks || (isPvs ? 15 : 18);
  const endDate = c.semester_end_date || calculateEndDate(c.semester_start_date, weeks);
  const status = getSemesterStatus(c.semester_start_date, endDate, weeks, c.current_week);

  return (
    <div className="glass p-5 rounded-2xl flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-xl shadow-xs shrink-0">
            {animalAvatars[Number(c.id || 0) % animalAvatars.length]}
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => onEdit(c)} 
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" 
              title="แก้ไข"
              aria-label={`แก้ไขห้องเรียน ${c.name}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(c.id)} 
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors" 
              title="ลบ"
              aria-label={`ลบห้องเรียน ${c.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-800 leading-snug">{c.name}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              isPvs 
                ? 'bg-purple-50 text-purple-700' 
                : isCustom
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {isPvs ? 'ปวส. 15 สัปดาห์' : isCustom ? `กำหนดเอง ${weeks} สัปดาห์` : 'ปวช. 18 สัปดาห์'}
            </span>
          </div>
          {c.description && <p className="text-xs text-slate-500 line-clamp-1">{c.description}</p>}
        </div>

        {c.semester_start_date && (
          <div className="mt-3 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100/80 flex items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <div className="flex items-center gap-1 text-[11px] truncate">
                <span>เปิด {formatThaiShortDate(c.semester_start_date)}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-700 font-medium">ปิด {formatThaiShortDate(endDate)}</span>
              </div>
            </div>
            {status && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border shrink-0 ${status.color}`}>
                {status.label}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{c.student_count || 0} คน</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>{weeks} สัปดาห์</span>
          <span>·</span>
          <span>{c.total_classes || 0} คาบ</span>
        </div>
      </div>
    </div>
  );
}

export default function Classrooms() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const emptyForm = { 
    name: '', 
    description: '', 
    late_to_absent_ratio: 3, 
    leave_to_absent_ratio: 2, 
    total_classes: 36, 
    min_attendance_percent: 80,
    curriculum_type: 'pvch' as 'pvch' | 'pvs' | 'custom',
    total_weeks: 18,
    semester_start_date: ''
  };
  const [form, setForm] = useState(emptyForm);

  // States for calculating total_classes helper
  const [periodsPerWeek, setPeriodsPerWeek] = useState(2);
  const [totalWeeks, setTotalWeeks] = useState(18);

  // States for timetable preset selection
  const [selectedTimetableKey, setSelectedTimetableKey] = useState<string>('');
  const [selectedTimetableIds, setSelectedTimetableIds] = useState<number[]>([]);
  const [showAttendanceSettings, setShowAttendanceSettings] = useState(false);

  // ─── Query: ดึงข้อมูลห้องเรียน ───
  const { data: classrooms = [], isLoading } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  // ─── Query: ดึงข้อมูลตารางเรียนสำหรับทำตัวเลือก ───
  const { data: rawTimetableData = [] } = useQuery<TimetableEntry[]>({
    queryKey: ['timetable-classroom-options'],
    queryFn: async () => {
      const res = await api.get('/timetable');
      return res.data.data?.entries || [];
    },
  });

  const timetableData: TimetableEntry[] = useMemo(() => {
    if (Array.isArray(rawTimetableData)) return rawTimetableData;
    if (rawTimetableData && Array.isArray((rawTimetableData as any).entries)) {
      return (rawTimetableData as any).entries;
    }
    return [];
  }, [rawTimetableData]);

  const timetableOptions = useMemo(() => {
    if (!timetableData || !Array.isArray(timetableData)) return [];

    const academicEntries = timetableData.filter(e => {
      if (e.start_period === 0) return false;
      if (e.entry_type === 'homeroom') return false;
      const name = `${e.subject_name || ''} ${e.subject_code || ''}`.toLowerCase();
      if (name.includes('เสาธง') || name.includes('โฮมรูม') || name.includes('เข้าแถว')) return false;
      return Boolean(e.subject_code || e.subject_name);
    });

    const groups = new Map<string, {
      key: string;
      subject_code: string;
      subject_name: string;
      group_name: string;
      room: string;
      total_hours: number;
      days: string[];
      timetable_ids: number[];
    }>();

    const DAY_NAMES = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

    academicEntries.forEach(e => {
      const key = `${e.subject_code || ''}__${e.subject_name || ''}__${e.group_name || ''}`;
      const hours = e.hours || (e.end_period - e.start_period + 1) || 1;
      const dayName = DAY_NAMES[e.day_of_week] || '';

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          subject_code: e.subject_code || '',
          subject_name: e.subject_name || '',
          group_name: e.group_name || '',
          room: e.room || '',
          total_hours: hours,
          days: dayName ? [dayName] : [],
          timetable_ids: [e.id]
        });
      } else {
        const g = groups.get(key)!;
        g.total_hours += hours;
        if (dayName && !g.days.includes(dayName)) g.days.push(dayName);
        if (!g.room && e.room) g.room = e.room;
        g.timetable_ids.push(e.id);
      }
    });

    return Array.from(groups.values());
  }, [timetableData]);

  const handleSelectTimetablePreset = (key: string) => {
    setSelectedTimetableKey(key);
    if (!key) return;

    const opt = timetableOptions.find(o => o.key === key);
    if (!opt) return;

    // 1. สร้างชื่อวิชา/ห้องเรียน
    const nameParts = [];
    if (opt.subject_code) nameParts.push(opt.subject_code);
    if (opt.subject_name) nameParts.push(opt.subject_name);
    if (opt.group_name) nameParts.push(opt.group_name);
    const name = nameParts.join(' ');

    // 2. สร้างรายละเอียด
    const descParts = [];
    if (opt.group_name) descParts.push(opt.group_name);
    if (opt.room) descParts.push(`ห้อง ${opt.room}`);
    if (opt.days.length > 0) descParts.push(`(เรียนวัน${opt.days.join(', ')})`);
    const description = descParts.join(' ');

    // 3. ตรวจสอบหลักสูตร (ถ้ามีคำว่า ปวส -> pvs 15 สัปดาห์, อื่นๆ -> pvch 18 สัปดาห์)
    const fullText = `${name} ${description}`.toLowerCase();
    const isPvs = fullText.includes('ปวส') || opt.group_name.toLowerCase().includes('ปวส');
    const curType: 'pvch' | 'pvs' = isPvs ? 'pvs' : 'pvch';
    const weeks = isPvs ? 15 : 18;

    // 4. จำนวนคาบต่อสัปดาห์
    const periods = opt.total_hours || 2;
    setPeriodsPerWeek(periods);
    setTotalWeeks(weeks);

    setForm(prev => ({
      ...prev,
      name,
      description,
      curriculum_type: curType,
      total_weeks: weeks,
      total_classes: periods * weeks
    }));

    setSelectedTimetableIds(opt.timetable_ids);
    toast.success(`ดึงข้อมูล "${opt.subject_name || opt.subject_code}" แล้ว`);
  };

  // ─── Mutation: สร้าง/แก้ไขห้องเรียน ───
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const formattedPayload = {
        ...payload,
        total_weeks: totalWeeks,
        semester_start_date: payload.semester_start_date ? payload.semester_start_date : null,
      };

      if (editing) {
        return api.put('/classrooms/' + editing, formattedPayload);
      } else {
        return api.post('/classrooms', formattedPayload);
      }
    },
    onSuccess: async (res) => {
      toast.success(editing ? 'อัปเดตข้อมูลห้องเรียนเรียบร้อย' : 'เพิ่มห้องเรียนเรียบร้อย');

      // เชื่อมโยงคาบในตารางสอนอัตโนมัติหากเลือกมาจากตาราง
      if (selectedTimetableIds.length > 0) {
        const classroomId = editing ? Number(editing) : res?.data?.data?.id;
        if (classroomId) {
          try {
            await Promise.all(
              selectedTimetableIds.map(tid =>
                api.put(`/timetable/${tid}`, { classroom_id: Number(classroomId) }).catch(() => {})
              )
            );
            queryClient.invalidateQueries({ queryKey: ['timetable'] });
            queryClient.invalidateQueries({ queryKey: ['timetable-schedule'] });
            queryClient.invalidateQueries({ queryKey: ['timetable-classroom-options'] });
            queryClient.invalidateQueries({ queryKey: ['timetable-all'] });
            toast.success('เชื่อมโยงคาบในตารางสอนกับห้องเรียนนี้เรียบร้อย');
          } catch {
            // ignore linking error
          }
        }
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setSelectedTimetableKey('');
      setSelectedTimetableIds([]);
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    },
  });

  // ─── Mutation: ลบห้องเรียน ───
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete('/classrooms/' + id),
    onSuccess: () => {
      toast.success('ลบห้องเรียนแล้ว');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
    onError: () => {
      toast.error('ลบไม่สำเร็จ');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleCurriculumChange = (type: 'pvch' | 'pvs' | 'custom') => {
    let weeks = totalWeeks;
    if (type === 'pvch') weeks = 18;
    else if (type === 'pvs') weeks = 15;

    setTotalWeeks(weeks);
    setForm(prev => ({
      ...prev,
      curriculum_type: type,
      total_weeks: weeks,
      total_classes: periodsPerWeek * weeks
    }));
  };

  const handlePeriodsChange = (val: number) => {
    setPeriodsPerWeek(val);
    setForm(prev => ({ ...prev, total_classes: val * totalWeeks }));
  };

  const handleWeeksChange = (val: number) => {
    setTotalWeeks(val);
    setForm(prev => ({ ...prev, total_weeks: val, total_classes: periodsPerWeek * val }));
  };

  const handleEdit = (c: Classroom) => {
    const curType = c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch');
    const weeks = c.total_weeks || (curType === 'pvs' ? 15 : 18);
    const total = c.total_classes || (weeks * 2);
    const periods = Math.round(total / weeks) || 2;

    setPeriodsPerWeek(periods);
    setTotalWeeks(weeks);
    setSelectedTimetableKey('');
    setSelectedTimetableIds([]);
    setShowAttendanceSettings(false);

    setForm({ 
      name: c.name, 
      description: c.description || '', 
      late_to_absent_ratio: c.late_to_absent_ratio || 3,
      leave_to_absent_ratio: c.leave_to_absent_ratio || 2,
      total_classes: total,
      min_attendance_percent: c.min_attendance_percent || 80,
      curriculum_type: curType,
      total_weeks: weeks,
      semester_start_date: c.semester_start_date || ''
    });
    setEditing(c.id);
    setShowForm(true);
  };

  const handleDelete = (id: string | number) => {
    if (!confirm('ต้องการลบห้องเรียนนี้หรือไม่? ข้อมูลการเช็คชื่อจะถูกลบไปด้วย')) return;
    deleteMutation.mutate(id);
  };

  const filtered = classrooms.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
  ];

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">จัดการห้องเรียน</h1>
          <p className="text-slate-500 text-sm">ทั้งหมด {classrooms.length} ห้อง</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditing(null);
            setSelectedTimetableKey('');
            setSelectedTimetableIds([]);
            setShowAttendanceSettings(false);
            setPeriodsPerWeek(2);
            setTotalWeeks(18);
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" /> สร้างห้องเรียน
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-11"
          placeholder="ค้นหาห้องเรียน..."
          id="search-classrooms"
          aria-label="ค้นหาห้องเรียน"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full glass p-14 text-center rounded-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 text-3xl">
              🏫
            </div>
            <p className="text-slate-500 text-sm font-medium">ยังไม่มีข้อมูลห้องเรียน</p>
            <p className="text-slate-600 text-xs mt-1">กดปุ่ม "สร้างห้องเรียน" เพื่อเริ่มต้น</p>
          </div>
        ) : filtered.map((c, i) => (
          <ClassroomCard
            key={c.id}
            c={c}
            i={i}
            colors={colors}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showForm && createPortal(
        <div className="modal-overlay">
          <div 
            className="bg-white border border-slate-200/90 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-fade-in-up rounded-2xl shadow-2xl" 
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800">
                {editing ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียน'}
              </h2>
              <button 
                onClick={() => setShowForm(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                aria-label="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ตารางสอน Presets */}
              {timetableOptions.length > 0 && !editing && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="timetable-preset" className="text-xs font-medium text-slate-600">
                      ดึงข้อมูลจากตารางสอน
                    </label>
                    {selectedTimetableKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTimetableKey('');
                          setSelectedTimetableIds([]);
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        ล้าง
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="timetable-preset"
                      value={selectedTimetableKey}
                      onChange={e => handleSelectTimetablePreset(e.target.value)}
                      className="form-input text-xs pr-8 py-2 bg-slate-50 border-slate-200 text-slate-700 rounded-xl focus:bg-white focus:border-indigo-500 transition-all font-medium appearance-none w-full"
                    >
                      <option value="">เลือกรายวิชาในตารางสอน...</option>
                      {timetableOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.subject_code ? `${opt.subject_code} ` : ''}{opt.subject_name || 'ไม่ระบุชื่อ'}{opt.group_name ? ` (${opt.group_name})` : ''} · {opt.total_hours} คาบ
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="classroom-name" className="text-xs font-medium text-slate-700 mb-1.5 block">
                  ชื่อรายวิชา / ห้องเรียน <span className="text-rose-500">*</span>
                </label>
                <input
                  id="classroom-name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="form-input text-sm rounded-xl"
                  required
                  placeholder="เช่น การเขียนโปรแกรมเว็บ หรือ 20000-1101"
                />
              </div>

              <div>
                <label htmlFor="classroom-desc" className="text-xs font-medium text-slate-700 mb-1.5 block">
                  รายละเอียด
                </label>
                <input
                  id="classroom-desc"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="form-input text-sm rounded-xl"
                  placeholder="เช่น ชค.2/1 หรือ ห้อง 735"
                />
              </div>

              {/* หลักสูตร Segmented Control */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  หลักสูตร
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {[
                    { id: 'pvch', label: 'ปวช. 18 สัปดาห์' },
                    { id: 'pvs', label: 'ปวส. 15 สัปดาห์' },
                    { id: 'custom', label: 'กำหนดเอง' },
                  ].map(item => {
                    const isActive = form.curriculum_type === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCurriculumChange(item.id as 'pvch' | 'pvs' | 'custom')}
                        className={`py-1.5 text-xs rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {form.curriculum_type === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">จำนวนสัปดาห์:</span>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={totalWeeks}
                      onChange={e => handleWeeksChange(parseInt(e.target.value) || 1)}
                      className="form-input text-xs w-20 py-1 text-center rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* วันเปิดเทอม & คาบต่อสัปดาห์ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="classroom-start-date" className="text-xs font-medium text-slate-700 mb-1.5 block">
                    วันเปิดเทอม
                  </label>
                  <input
                    id="classroom-start-date"
                    type="date"
                    value={form.semester_start_date || ''}
                    onChange={e => setForm({ ...form, semester_start_date: e.target.value })}
                    className="form-input text-xs py-2 rounded-xl"
                  />
                  {form.semester_start_date && (
                    <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>วันปิดเทอม:</span>
                      <span className="font-semibold text-indigo-600">
                        {formatThaiShortDate(calculateEndDate(form.semester_start_date, totalWeeks))}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="classroom-periods" className="text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>คาบ / สัปดาห์</span>
                    <span className="text-[11px] text-slate-400 font-normal">รวม {form.total_classes} คาบ</span>
                  </label>
                  <input
                    id="classroom-periods"
                    type="number"
                    min="1"
                    max="20"
                    value={periodsPerWeek}
                    onChange={e => handlePeriodsChange(parseInt(e.target.value) || 1)}
                    className="form-input text-xs py-2 rounded-xl text-center font-medium"
                    required
                  />
                </div>
              </div>

              {/* เกณฑ์การเข้าเรียน (Collapsible) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAttendanceSettings(!showAttendanceSettings)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-600 hover:bg-slate-100/60 transition-colors"
                >
                  <span className="font-medium text-slate-700">เกณฑ์การเข้าเรียน</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    สาย {form.late_to_absent_ratio}:1 · ลา {form.leave_to_absent_ratio}:1 · {form.min_attendance_percent}%
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAttendanceSettings ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {showAttendanceSettings && (
                  <div className="p-3 pt-1 grid grid-cols-3 gap-2.5 border-t border-slate-200/60 bg-white">
                    <div>
                      <label htmlFor="classroom-late-ratio" className="text-[11px] text-slate-500 mb-1 block text-center">
                        สาย (ครั้ง)
                      </label>
                      <input
                        id="classroom-late-ratio"
                        type="number"
                        min="1"
                        max="10"
                        value={form.late_to_absent_ratio}
                        onChange={e => setForm({ ...form, late_to_absent_ratio: parseInt(e.target.value) || 1 })}
                        className="form-input text-xs text-center py-1.5 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="classroom-leave-ratio" className="text-[11px] text-slate-500 mb-1 block text-center">
                        ลา (ครั้ง)
                      </label>
                      <input
                        id="classroom-leave-ratio"
                        type="number"
                        min="1"
                        max="10"
                        value={form.leave_to_absent_ratio}
                        onChange={e => setForm({ ...form, leave_to_absent_ratio: parseInt(e.target.value) || 1 })}
                        className="form-input text-xs text-center py-1.5 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="classroom-min-attendance" className="text-[11px] text-slate-500 mb-1 block text-center">
                        เวลาเรียน (%)
                      </label>
                      <input
                        id="classroom-min-attendance"
                        type="number"
                        min="1"
                        max="100"
                        value={form.min_attendance_percent}
                        onChange={e => setForm({ ...form, min_attendance_percent: parseInt(e.target.value) || 80 })}
                        className="form-input text-xs text-center py-1.5 rounded-lg"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn btn-primary px-5 py-2 text-sm rounded-xl font-medium shadow-sm transition-all"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'บันทึก' : 'สร้างห้องเรียน')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
