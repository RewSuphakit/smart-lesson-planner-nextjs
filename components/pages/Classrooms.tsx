'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Plus, Edit, Trash2, X, Loader2, Search, Calendar, ChevronDown, Users, Layers, Eye, EyeOff, Lock, Link2, ExternalLink } from 'lucide-react';
import toast from '@/lib/toast';
import { useSemester } from '@/context/SemesterContext';
import { ANIMAL_AVATARS as animalAvatars } from '@/components/UserAvatar';

export interface Classroom {
  id: string;
  name: string;
  description?: string;
  student_count?: number;
  late_to_absent_ratio?: number;
  leave_to_absent_ratio?: number;
  late_deduction_score?: number;
  absent_deduction_score?: number;
  total_classes?: number;
  min_attendance_percent?: number;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
  semester_start_date?: string | null;
  semester_end_date?: string | null;
  current_week?: number | null;
  semester_id?: number | null;
  semester_name?: string | null;
  is_portal_enabled?: boolean;
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
  onTogglePortal: (c: Classroom) => void;
  isTogglingPortal?: boolean;
}

const THAI_MONTHS_SHORT = [
  'à¸¡.à¸„.', 'à¸.à¸ž.', 'à¸¡à¸µ.à¸„.', 'à¹€à¸¡.à¸¢.', 'à¸ž.à¸„.', 'à¸¡à¸´.à¸¢.',
  'à¸.à¸„.', 'à¸ª.à¸„.', 'à¸.à¸¢.', 'à¸•.à¸„.', 'à¸ž.à¸¢.', 'à¸˜.à¸„.'
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
      label: `à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ ${currentWeek}/${totalWeeks}`,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100/80',
    };
  }
  if (endDateStr && todayStr > endDateStr) {
    return {
      label: 'à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™',
      color: 'text-slate-500 bg-slate-100 border-slate-200',
    };
  }
  if (todayStr < startDateStr) {
    return {
      label: 'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¹€à¸£à¸µà¸¢à¸™',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    };
  }
  return {
    label: 'à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™',
    color: 'text-slate-500 bg-slate-100 border-slate-200',
  };
}

function ClassroomCard({ c, onEdit, onDelete, onTogglePortal, isTogglingPortal }: ClassroomCardProps) {
  const isPvs = c.curriculum_type === 'pvs';
  const isCustom = c.curriculum_type === 'custom';
  const weeks = c.total_weeks || (isPvs ? 15 : 18);
  const endDate = c.semester_end_date || calculateEndDate(c.semester_start_date, weeks);
  const status = getSemesterStatus(c.semester_start_date, endDate, weeks, c.current_week);
  const isPortalEnabled = c.is_portal_enabled !== false;

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
              title="à¹à¸à¹‰à¹„à¸‚"
              aria-label={`à¹à¸à¹‰à¹„à¸‚à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ ${c.name}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(c.id)} 
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors" 
              title="à¸¥à¸š"
              aria-label={`à¸¥à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ ${c.name}`}
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
              {isPvs ? 'à¸›à¸§à¸ª. 15 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ' : isCustom ? `à¸à¸³à¸«à¸™à¸”à¹€à¸­à¸‡ ${weeks} à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ` : 'à¸›à¸§à¸Š. 18 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ'}
            </span>
          </div>
          {c.description && <p className="text-xs text-slate-500 line-clamp-1">{c.description}</p>}
        </div>

        {c.semester_start_date && (
          <div className="mt-3 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100/80 flex items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <div className="flex items-center gap-1 text-[11px] truncate">
                <span>à¹€à¸›à¸´à¸” {formatThaiShortDate(c.semester_start_date)}</span>
                <span className="text-slate-300">Â·</span>
                <span className="text-slate-700 font-medium">à¸›à¸´à¸” {formatThaiShortDate(endDate)}</span>
              </div>
            </div>
            {status && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border shrink-0 ${status.color}`}>
                {status.label}
              </span>
            )}
          </div>
        )}

        {/* à¸ªà¸§à¸´à¸•à¸Šà¹Œà¹€à¸›à¸´à¸”-à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹ Student Portal & LINE Bot */}
        <div
          className={`mt-3 py-2 px-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
            isPortalEnabled
              ? 'bg-emerald-50/70 border-emerald-200/70'
              : 'bg-slate-100/80 border-slate-200/80'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isPortalEnabled ? (
              <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span
              className={`text-xs font-semibold truncate ${
                isPortalEnabled ? 'text-emerald-800' : 'text-slate-600'
              }`}
            >
              {isPortalEnabled ? 'Portal: à¹€à¸›à¸´à¸”à¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸”à¸¹' : 'Portal: à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹'}
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isPortalEnabled}
            aria-label={`${isPortalEnabled ? 'à¸›à¸´à¸”' : 'à¹€à¸›à¸´à¸”'}à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹ Student Portal à¸ªà¸³à¸«à¸£à¸±à¸šà¸§à¸´à¸Šà¸² ${c.name}`}
            title={isPortalEnabled ? 'à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¸›à¸´à¸”à¹„à¸¡à¹ˆà¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸§à¸´à¸Šà¸²à¸™à¸µà¹‰' : 'à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¹€à¸›à¸´à¸”à¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸§à¸´à¸Šà¸²à¸™à¸µà¹‰'}
            disabled={isTogglingPortal}
            onClick={() => onTogglePortal(c)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 ${
              isPortalEnabled ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                isPortalEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{c.student_count || 0} à¸„à¸™</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>{weeks} à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
          <span>Â·</span>
          <span>{c.total_classes || 0} à¸„à¸²à¸š</span>
        </div>
      </div>
    </div>
  );
}

export default function Classrooms({
  initialClassrooms,
}: {
  initialClassrooms?: Classroom[];
} = {}) {
  const queryClient = useQueryClient();
  const { activeSemester } = useSemester();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const emptyForm = { 
    name: '', 
    description: '', 
    late_to_absent_ratio: 3, 
    leave_to_absent_ratio: 2, 
    late_deduction_score: 1,
    absent_deduction_score: 2,
    total_classes: 36, 
    min_attendance_percent: 80,
    curriculum_type: 'pvch' as 'pvch' | 'pvs' | 'custom',
    total_weeks: 18,
    semester_start_date: '',
    is_portal_enabled: true
  };
  const [form, setForm] = useState(emptyForm);

  // States for calculating total_classes helper
  const [periodsPerWeek, setPeriodsPerWeek] = useState(2);
  const [totalWeeks, setTotalWeeks] = useState(18);

  // States for timetable preset selection
  const [selectedTimetableKey, setSelectedTimetableKey] = useState<string>('');
  const [selectedTimetableIds, setSelectedTimetableIds] = useState<number[]>([]);
  const [showAttendanceSettings, setShowAttendanceSettings] = useState(false);

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
  const { data: classrooms = initialClassrooms || [], isLoading } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
    initialData: initialClassrooms && initialClassrooms.length > 0 ? initialClassrooms : undefined,
  });

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¸²à¸£à¸²à¸‡à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸—à¸³à¸•à¸±à¸§à¹€à¸¥à¸·à¸­à¸ â”€â”€â”€
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
      if (name.includes('à¹€à¸ªà¸²à¸˜à¸‡') || name.includes('à¹‚à¸®à¸¡à¸£à¸¹à¸¡') || name.includes('à¹€à¸‚à¹‰à¸²à¹à¸–à¸§')) return false;
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

    const DAY_NAMES = ['à¸ˆà¸±à¸™à¸—à¸£à¹Œ', 'à¸­à¸±à¸‡à¸„à¸²à¸£', 'à¸žà¸¸à¸˜', 'à¸žà¸¤à¸«à¸±à¸ªà¸šà¸”à¸µ', 'à¸¨à¸¸à¸à¸£à¹Œ', 'à¹€à¸ªà¸²à¸£à¹Œ', 'à¸­à¸²à¸—à¸´à¸•à¸¢à¹Œ'];

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

    // 1. à¸ªà¸£à¹‰à¸²à¸‡à¸Šà¸·à¹ˆà¸­à¸§à¸´à¸Šà¸²/à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™
    const nameParts = [];
    if (opt.subject_code) nameParts.push(opt.subject_code);
    if (opt.subject_name) nameParts.push(opt.subject_name);
    if (opt.group_name) nameParts.push(opt.group_name);
    const name = nameParts.join(' ');

    // 2. à¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”
    const descParts = [];
    if (opt.group_name) descParts.push(opt.group_name);
    if (opt.room) descParts.push(`à¸«à¹‰à¸­à¸‡ ${opt.room}`);
    if (opt.days.length > 0) descParts.push(`(à¹€à¸£à¸µà¸¢à¸™à¸§à¸±à¸™${opt.days.join(', ')})`);
    const description = descParts.join(' ');

    // 3. à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸«à¸¥à¸±à¸à¸ªà¸¹à¸•à¸£ (à¸–à¹‰à¸²à¸¡à¸µà¸„à¸³à¸§à¹ˆà¸² à¸›à¸§à¸ª -> pvs 15 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ, à¸­à¸·à¹ˆà¸™à¹† -> pvch 18 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ)
    const fullText = `${name} ${description}`.toLowerCase();
    const isPvs = fullText.includes('à¸›à¸§à¸ª') || opt.group_name.toLowerCase().includes('à¸›à¸§à¸ª');
    const curType: 'pvch' | 'pvs' = isPvs ? 'pvs' : 'pvch';
    const weeks = isPvs ? 15 : 18;

    // 4. à¸ˆà¸³à¸™à¸§à¸™à¸„à¸²à¸šà¸•à¹ˆà¸­à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ
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
    toast.success(`à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ "${opt.subject_name || opt.subject_code}" à¹à¸¥à¹‰à¸§`);
  };

  // â”€â”€â”€ Mutation: à¸ªà¸£à¹‰à¸²à¸‡/à¹à¸à¹‰à¹„à¸‚à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const formattedPayload = {
        ...payload,
        total_weeks: totalWeeks,
        semester_start_date: payload.semester_start_date ? payload.semester_start_date : null,
        semester_id: activeSemester?.id || undefined,
      };

      if (editing) {
        return api.put('/classrooms/' + editing, formattedPayload);
      } else {
        return api.post('/classrooms', formattedPayload);
      }
    },
    onSuccess: async (res) => {
      toast.success(editing ? 'à¸­à¸±à¸›à¹€à¸”à¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');

      // à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¹‚à¸¢à¸‡à¸„à¸²à¸šà¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸«à¸²à¸à¹€à¸¥à¸·à¸­à¸à¸¡à¸²à¸ˆà¸²à¸à¸•à¸²à¸£à¸²à¸‡
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
            toast.success('à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¹‚à¸¢à¸‡à¸„à¸²à¸šà¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸à¸±à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
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
      toast.error(err.response?.data?.message || 'à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¹€à¸›à¸´à¸”-à¸›à¸´à¸” Student Portal à¸£à¸²à¸¢à¸§à¸´à¸Šà¸² (Optimistic Update) â”€â”€â”€
  const togglePortalMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string | number; enabled: boolean }) =>
      api.put('/classrooms/' + id, { is_portal_enabled: enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['classrooms'] });
      const previous = queryClient.getQueryData<Classroom[]>(['classrooms']);
      queryClient.setQueryData<Classroom[]>(['classrooms'], (old = []) =>
        old.map(c => (String(c.id) === String(id) ? { ...c, is_portal_enabled: enabled } : c))
      );
      return { previous };
    },
    onSuccess: (_res, { enabled }) => {
      toast.success(
        enabled
          ? 'à¹€à¸›à¸´à¸”à¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸§à¸´à¸Šà¸²à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§'
          : 'à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸§à¸´à¸Šà¸²à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§'
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['classrooms'], context.previous);
      }
      toast.error('à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });

  const handleTogglePortal = (c: Classroom) => {
    const currentlyEnabled = c.is_portal_enabled !== false;
    togglePortalMutation.mutate({ id: c.id, enabled: !currentlyEnabled });
  };

  const handleCopyPortalLink = async () => {
    const url = `${window.location.origin}/portal`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ Student Portal à¹à¸¥à¹‰à¸§');
    } catch {
      toast.error('à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸„à¸±à¸”à¸¥à¸­à¸à¸”à¹‰à¸§à¸¢à¸•à¸™à¹€à¸­à¸‡: ' + url);
    }
  };

  // â”€â”€â”€ Mutation: à¸¥à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete('/classrooms/' + id),
    onSuccess: () => {
      toast.success('à¸¥à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¹‰à¸§');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
    onError: () => {
      toast.error('à¸¥à¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
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

  const [curriculumFilter, setCurriculumFilter] = useState<'all' | 'pvch' | 'pvs'>('all');

  const pvchCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('à¸›à¸§à¸ª') ? 'pvs' : 'pvch')) === 'pvch').length;
  }, [classrooms]);

  const pvsCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('à¸›à¸§à¸ª') ? 'pvs' : 'pvch')) === 'pvs').length;
  }, [classrooms]);

  const filtered = useMemo(() => {
    return classrooms.filter(c => {
      const curType = c.curriculum_type || (c.name?.includes('à¸›à¸§à¸ª') ? 'pvs' : 'pvch');
      const matchesCurriculum = curriculumFilter === 'all' || curType === curriculumFilter;
      const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase());
      return matchesCurriculum && matchesSearch;
    });
  }, [classrooms, curriculumFilter, search]);

  const handleEdit = (c: Classroom) => {
    const curType = c.curriculum_type || (c.name?.includes('à¸›à¸§à¸ª') ? 'pvs' : 'pvch');
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
      late_deduction_score: c.late_deduction_score !== undefined && c.late_deduction_score !== null ? Number(c.late_deduction_score) : 1,
      absent_deduction_score: c.absent_deduction_score !== undefined && c.absent_deduction_score !== null ? Number(c.absent_deduction_score) : 2,
      total_classes: total,
      min_attendance_percent: c.min_attendance_percent || 80,
      curriculum_type: curType,
      total_weeks: weeks,
      semester_start_date: c.semester_start_date || '',
      is_portal_enabled: c.is_portal_enabled !== false
    });
    setEditing(c.id);
    setShowForm(true);
  };

  const handleDelete = (id: string | number) => {
    if (!confirm('à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ? à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸ˆà¸°à¸–à¸¹à¸à¸¥à¸šà¹„à¸›à¸”à¹‰à¸§à¸¢')) return;
    deleteMutation.mutate(id);
  };

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
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">à¸ˆà¸±à¸”à¸à¸²à¸£à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™</h1>
            {activeSemester && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-xs">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>{activeSemester.name}</span>
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {classrooms.length} à¸«à¹‰à¸­à¸‡ ({pvchCount > 0 ? `à¸›à¸§à¸Š. ${pvchCount} à¸«à¹‰à¸­à¸‡ ` : ''}{pvsCount > 0 ? `Â· à¸›à¸§à¸ª. ${pvsCount} à¸«à¹‰à¸­à¸‡` : ''}) {activeSemester ? `à¹ƒà¸™ ${activeSemester.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyPortalLink}
            className="btn btn-ghost text-xs"
            title="à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ Student Portal à¹€à¸žà¸·à¹ˆà¸­à¸ªà¹ˆà¸‡à¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™"
            aria-label="à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ Student Portal"
          >
            <Link2 className="w-4 h-4" /> à¸„à¸±à¸”à¸¥à¸­à¸à¸¥à¸´à¸‡à¸à¹Œ Portal
          </button>
          <a
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-xs"
            title="à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸² Student Portal à¹ƒà¸™à¹à¸—à¹‡à¸šà¹ƒà¸«à¸¡à¹ˆ"
            aria-label="à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸² Student Portal à¹ƒà¸™à¹à¸—à¹‡à¸šà¹ƒà¸«à¸¡à¹ˆ"
          >
            <ExternalLink className="w-4 h-4" /> à¹€à¸›à¸´à¸”à¸”à¸¹ Portal
          </a>
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
            <Plus className="w-4 h-4" /> à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-11"
            placeholder="à¸„à¹‰à¸™à¸«à¸²à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™..."
            id="search-classrooms"
            aria-label="à¸„à¹‰à¸™à¸«à¸²à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™"
          />
        </div>

        {/* Level Filter Tabs: à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” / à¸›à¸§à¸Š. / à¸›à¸§à¸ª. */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setCurriculumFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              curriculumFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” ({classrooms.length})
          </button>
          <button
            type="button"
            onClick={() => setCurriculumFilter('pvch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              curriculumFilter === 'pvch'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            à¸›à¸§à¸Š. ({pvchCount})
          </button>
          <button
            type="button"
            onClick={() => setCurriculumFilter('pvs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              curriculumFilter === 'pvs'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            à¸›à¸§à¸ª. ({pvsCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full glass p-14 text-center rounded-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 text-3xl">
              ðŸ«
            </div>
            <p className="text-slate-500 text-sm font-medium">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™</p>
            <p className="text-slate-600 text-xs mt-1">à¸à¸”à¸›à¸¸à¹ˆà¸¡ &quot;à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™&quot; à¹€à¸žà¸·à¹ˆà¸­à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™</p>
          </div>
        ) : filtered.map((c, i) => (
          <ClassroomCard
            key={c.id}
            c={c}
            i={i}
            colors={colors}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTogglePortal={handleTogglePortal}
            isTogglingPortal={
              togglePortalMutation.isPending &&
              String(togglePortalMutation.variables?.id) === String(c.id)
            }
          />
        ))}
      </div>

      {showForm && createPortal(
        <div className="modal-overlay">
          <div 
            className="bg-white border border-slate-200/90 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-fade-in-up rounded-2xl shadow-2xl" 
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800">
                {editing ? 'à¹à¸à¹‰à¹„à¸‚à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™' : 'à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™'}
              </h2>
              <button 
                onClick={() => setShowForm(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                aria-label="à¸›à¸´à¸”"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeSemester && !editing && (
              <div className="mb-4 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center gap-2 text-xs text-indigo-800">
                <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>à¸ˆà¸°à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡à¹ƒà¸™: <strong>{activeSemester.name}</strong></span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™ Presets */}
              {timetableOptions.length > 0 && !editing && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="timetable-preset" className="text-xs font-medium text-slate-600">
                      à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸²à¸à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™
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
                        à¸¥à¹‰à¸²à¸‡
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
                      <option value="">à¹€à¸¥à¸·à¸­à¸à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²à¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™...</option>
                      {timetableOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.subject_code ? `${opt.subject_code} ` : ''}{opt.subject_name || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­'}{opt.group_name ? ` (${opt.group_name})` : ''} Â· {opt.total_hours} à¸„à¸²à¸š
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="classroom-name" className="text-xs font-medium text-slate-700 mb-1.5 block">
                  à¸Šà¸·à¹ˆà¸­à¸£à¸²à¸¢à¸§à¸´à¸Šà¸² / à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="classroom-name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="form-input text-sm rounded-xl"
                  required
                  placeholder="à¹€à¸Šà¹ˆà¸™ à¸à¸²à¸£à¹€à¸‚à¸µà¸¢à¸™à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¹€à¸§à¹‡à¸š à¸«à¸£à¸·à¸­ 20000-1101"
                />
              </div>

              <div>
                <label htmlFor="classroom-desc" className="text-xs font-medium text-slate-700 mb-1.5 block">
                  à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”
                </label>
                <input
                  id="classroom-desc"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="form-input text-sm rounded-xl"
                  placeholder="à¹€à¸Šà¹ˆà¸™ à¸Šà¸„.2/1 à¸«à¸£à¸·à¸­ à¸«à¹‰à¸­à¸‡ 735"
                />
              </div>

              {/* à¸«à¸¥à¸±à¸à¸ªà¸¹à¸•à¸£ Segmented Control */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  à¸«à¸¥à¸±à¸à¸ªà¸¹à¸•à¸£
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {[
                    { id: 'pvch', label: 'à¸›à¸§à¸Š. 18 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ' },
                    { id: 'pvs', label: 'à¸›à¸§à¸ª. 15 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ' },
                    { id: 'custom', label: 'à¸à¸³à¸«à¸™à¸”à¹€à¸­à¸‡' },
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
                    <span className="text-xs text-slate-500">à¸ˆà¸³à¸™à¸§à¸™à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ:</span>
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

              {/* à¸§à¸±à¸™à¹€à¸›à¸´à¸”à¹€à¸—à¸­à¸¡ & à¸„à¸²à¸šà¸•à¹ˆà¸­à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="classroom-start-date" className="text-xs font-medium text-slate-700 mb-1.5 block">
                    à¸§à¸±à¸™à¹€à¸›à¸´à¸”à¹€à¸—à¸­à¸¡
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
                      <span>à¸§à¸±à¸™à¸›à¸´à¸”à¹€à¸—à¸­à¸¡:</span>
                      <span className="font-semibold text-indigo-600">
                        {formatThaiShortDate(calculateEndDate(form.semester_start_date, totalWeeks))}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="classroom-periods" className="text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>à¸„à¸²à¸š / à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
                    <span className="text-[11px] text-slate-400 font-normal">à¸£à¸§à¸¡ {form.total_classes} à¸„à¸²à¸š</span>
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

              {/* à¹€à¸à¸“à¸‘à¹Œà¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¹€à¸£à¸µà¸¢à¸™ (Collapsible) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAttendanceSettings(!showAttendanceSettings)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-600 hover:bg-slate-100/60 transition-colors"
                >
                  <span className="font-medium text-slate-700">à¹€à¸à¸“à¸‘à¹Œà¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¹€à¸£à¸µà¸¢à¸™ & à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    à¸ªà¸²à¸¢ {form.late_to_absent_ratio}:1 Â· à¸«à¸±à¸à¸‚à¸²à¸” {form.absent_deduction_score} Â· à¸«à¸±à¸à¸ªà¸²à¸¢ {form.late_deduction_score}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAttendanceSettings ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {showAttendanceSettings && (
                  <div className="p-3 pt-1 space-y-3 border-t border-slate-200/60 bg-white">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">à¹€à¸à¸“à¸‘à¹Œà¸•à¸±à¸”à¸ªà¸´à¸™à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸š (à¸¡à¸ª.)</p>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label htmlFor="classroom-late-ratio" className="text-[11px] text-slate-500 mb-1 block text-center">
                            à¸ªà¸²à¸¢ (à¸„à¸£à¸±à¹‰à¸‡)
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
                            à¸¥à¸² (à¸„à¸£à¸±à¹‰à¸‡)
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
                            à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ (%)
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
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">à¸ªà¸¹à¸•à¸£à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (à¸•à¹ˆà¸­à¸„à¸£à¸±à¹‰à¸‡)</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label htmlFor="classroom-absent-deduction" className="text-[11px] text-slate-500 mb-1 block text-center">
                            à¸‚à¸²à¸” 1 à¸„à¸£à¸±à¹‰à¸‡ à¸«à¸±à¸ (à¸„à¸°à¹à¸™à¸™)
                          </label>
                          <input
                            id="classroom-absent-deduction"
                            type="number"
                            step="0.5"
                            min="0"
                            max="50"
                            value={form.absent_deduction_score}
                            onChange={e => setForm({ ...form, absent_deduction_score: parseFloat(e.target.value) || 0 })}
                            className="form-input text-xs text-center py-1.5 rounded-lg border-amber-200 focus:border-amber-400"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="classroom-late-deduction" className="text-[11px] text-slate-500 mb-1 block text-center">
                            à¸ªà¸²à¸¢ 1 à¸„à¸£à¸±à¹‰à¸‡ à¸«à¸±à¸ (à¸„à¸°à¹à¸™à¸™)
                          </label>
                          <input
                            id="classroom-late-deduction"
                            type="number"
                            step="0.5"
                            min="0"
                            max="50"
                            value={form.late_deduction_score}
                            onChange={e => setForm({ ...form, late_deduction_score: parseFloat(e.target.value) || 0 })}
                            className="form-input text-xs text-center py-1.5 rounded-lg border-amber-200 focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* à¹€à¸›à¸´à¸”-à¸›à¸´à¸” Student Portal */}
              <div
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  form.is_portal_enabled
                    ? 'bg-emerald-50/70 border-emerald-200/70'
                    : 'bg-slate-100/80 border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    {form.is_portal_enabled ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    à¹€à¸›à¸´à¸”à¹ƒà¸«à¹‰à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ (Student Portal / LINE Bot)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {form.is_portal_enabled
                      ? 'à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¸„à¸°à¹à¸™à¸™à¸§à¸´à¸Šà¸²à¸™à¸µà¹‰à¹„à¸”à¹‰'
                      : 'à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ˆà¸°à¹€à¸«à¹‡à¸™à¸§à¹ˆà¸²à¸„à¸£à¸¹à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_portal_enabled}
                  aria-label="à¹€à¸›à¸´à¸”à¸«à¸£à¸·à¸­à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹ Student Portal"
                  title={form.is_portal_enabled ? 'à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¸›à¸´à¸”' : 'à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¹€à¸›à¸´à¸”'}
                  onClick={() => setForm({ ...form, is_portal_enabled: !form.is_portal_enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                    form.is_portal_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      form.is_portal_enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  à¸¢à¸à¹€à¸¥à¸´à¸
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn btn-primary px-5 py-2 text-sm rounded-xl font-medium shadow-sm transition-all"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'à¸šà¸±à¸™à¸—à¸¶à¸' : 'à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™')}
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
