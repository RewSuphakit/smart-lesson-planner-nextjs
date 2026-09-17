'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSemester } from '@/context/SemesterContext';
import { Semester, CreateSemesterInput } from '@/services/semester';
import {
  Layers,
  Plus,
  Copy,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Clock,
  Check,
  Sparkles,
  Info,
  X,
  Loader2
} from 'lucide-react';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'ไม่ได้ระบุ';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
    const shortYear = (year + 543) % 100;
    return `${day} ${THAI_MONTHS_SHORT[month]} ${shortYear}`;
  } catch {
    return dateStr;
  }
}

function computeAutoEndDate(startDateStr: string, weeks: number): string {
  if (!startDateStr) return '';
  try {
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + (weeks * 7) - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

export default function SemestersPage() {
  const {
    semesters,
    activeSemester,
    loading,
    switchSemester,
    createSemester,
    updateSemester,
    deleteSemester,
    cloneSemester
  } = useSemester();

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  // Form State for Create
  const currentThaiYear = String(new Date().getFullYear() + 543);
  const [createForm, setCreateForm] = useState<CreateSemesterInput>({
    term_number: 1,
    academic_year: currentThaiYear,
    name: `ภาคเรียนที่ 1/${currentThaiYear}`,
    curriculum_type: 'pvch',
    total_weeks: 18,
    start_date: '',
    end_date: '',
    is_active: false,
  });

  // Form State for Clone
  const [cloneSourceId, setCloneSourceId] = useState<number | null>(null);
  const [cloneTargetId, setCloneTargetId] = useState<number | null>(null);
  const [includeStudents, setIncludeStudents] = useState(true);
  const [includeTimetable, setIncludeTimetable] = useState(false);

  // Helper when term or year changes in create form
  const handleTermOrYearChange = (term: number, year: string) => {
    const name = `ภาคเรียนที่ ${term}/${year}`;
    setCreateForm(prev => ({
      ...prev,
      term_number: term,
      academic_year: year,
      name,
    }));
  };

  const handleCurriculumChange = (type: 'pvch' | 'pvs' | 'custom') => {
    const weeks = type === 'pvch' ? 18 : type === 'pvs' ? 15 : createForm.total_weeks || 18;
    const endDate = createForm.start_date ? computeAutoEndDate(createForm.start_date, weeks) : createForm.end_date;
    setCreateForm(prev => ({
      ...prev,
      curriculum_type: type,
      total_weeks: weeks,
      end_date: endDate || prev.end_date,
    }));
  };

  const handleStartDateChange = (startDate: string) => {
    const weeks = createForm.total_weeks || 18;
    const autoEnd = computeAutoEndDate(startDate, weeks);
    setCreateForm(prev => ({
      ...prev,
      start_date: startDate,
      end_date: autoEnd,
    }));
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await createSemester(createForm);
      if (result) {
        setShowCreateModal(false);
        // Reset form
        setCreateForm({
          term_number: 1,
          academic_year: currentThaiYear,
          name: `ภาคเรียนที่ 1/${currentThaiYear}`,
          curriculum_type: 'pvch',
          total_weeks: 18,
          start_date: '',
          end_date: '',
          is_active: false,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester) return;
    setIsSubmitting(true);
    try {
      const result = await updateSemester(editingSemester.id, {
        name: editingSemester.name,
        term_number: editingSemester.term_number,
        academic_year: editingSemester.academic_year,
        start_date: editingSemester.start_date,
        end_date: editingSemester.end_date,
        curriculum_type: editingSemester.curriculum_type,
        total_weeks: editingSemester.total_weeks,
      });
      if (result) {
        setEditingSemester(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Clone
  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceId || !cloneTargetId) return;
    setIsSubmitting(true);
    try {
      const success = await cloneSemester(cloneSourceId, {
        target_semester_id: cloneTargetId,
        include_students: includeStudents,
        include_timetable: includeTimetable,
      });
      if (success) {
        setShowCloneModal(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch Active
  const handleActivate = async (id: number) => {
    setActivatingId(id);
    try {
      await switchSemester(id);
    } finally {
      setActivatingId(null);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await deleteSemester(deletingId);
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Clone Modal with Source
  const handleOpenClone = (sourceId?: number) => {
    setCloneSourceId(sourceId || activeSemester?.id || semesters[0]?.id || null);
    const otherSemester = semesters.find(s => s.id !== (sourceId || activeSemester?.id));
    setCloneTargetId(otherSemester?.id || null);
    setShowCloneModal(true);
  };

  // Keyboard Escape listener to dismiss any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowCloneModal(false);
        setEditingSemester(null);
        setDeletingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Group semesters by Academic Year (1 Academic Year has 2 Terms)
  const groupedYears = useMemo(() => {
    const map = new Map<string, {
      year: string;
      term1?: Semester;
      term2?: Semester;
      otherTerms: Semester[];
      totalClassrooms: number;
    }>();

    // Sort descending by year, then ascending by term
    const sorted = [...semesters].sort((a, b) => {
      const yDiff = Number(b.academic_year) - Number(a.academic_year);
      if (yDiff !== 0) return yDiff;
      return a.term_number - b.term_number;
    });

    for (const sem of sorted) {
      const y = sem.academic_year || String(currentThaiYear);
      if (!map.has(y)) {
        map.set(y, {
          year: y,
          otherTerms: [],
          totalClassrooms: 0,
        });
      }
      const group = map.get(y)!;
      group.totalClassrooms += sem.classroom_count ?? 0;
      if (sem.term_number === 1 && !group.term1) {
        group.term1 = sem;
      } else if (sem.term_number === 2 && !group.term2) {
        group.term2 = sem;
      } else {
        group.otherTerms.push(sem);
      }
    }

    return Array.from(map.values());
  }, [semesters, currentThaiYear]);

  // Quick Create a specific term for a year
  const handleQuickCreateTerm = (termNumber: number, year: string) => {
    const christianYear = Number(year) - 543;
    let estStart = '';
    if (termNumber === 1) {
      estStart = `${christianYear}-05-18`;
    } else if (termNumber === 2) {
      estStart = `${christianYear}-11-01`;
    }
    const autoEnd = estStart ? computeAutoEndDate(estStart, 18) : '';

    setCreateForm({
      term_number: termNumber,
      academic_year: year,
      name: `ภาคเรียนที่ ${termNumber}/${year}`,
      curriculum_type: 'pvch',
      total_weeks: 18,
      start_date: estStart,
      end_date: autoEnd,
      is_active: false,
    });
    setShowCreateModal(true);
  };

  const renderSemesterCard = (sem: Semester) => {
    const isActive = sem.is_active;
    const isPvs = sem.curriculum_type === 'pvs';
    const isCustom = sem.curriculum_type === 'custom';

    return (
      <div
        key={sem.id}
        className={`glass p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden h-full ${
          isActive
            ? 'border-2 border-indigo-500 shadow-lg shadow-indigo-500/10 bg-gradient-to-br from-white via-white to-indigo-50/40'
            : 'hover:border-indigo-300 hover:shadow-md bg-white'
        }`}
      >
        {/* Top Status & Badge */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                เทอม {sem.term_number}
              </span>
              <div>
                <span className="text-[11px] font-bold text-slate-600">
                  ปีการศึกษา {sem.academic_year}
                </span>
              </div>
            </div>

            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>ใช้งานอยู่</span>
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingSemester(sem)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors"
                  title="แก้ไข"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(sem.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <h3 className="text-base font-extrabold text-slate-800 tracking-tight mb-2">
            {sem.name}
          </h3>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              {(sem.pvch_count ?? 0) > 0 && (sem.pvs_count ?? 0) > 0 ? (
                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-gradient-to-r from-emerald-50 to-purple-50 text-indigo-700 border border-indigo-200">
                  รวม ปวช. & ปวส.
                </span>
              ) : isPvs ? (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-purple-50 text-purple-700 border border-purple-100">
                  ปวส. 15 สัปดาห์
                </span>
              ) : isCustom ? (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-50 text-amber-700 border border-amber-100">
                  กำหนดเอง {sem.total_weeks} สัปดาห์
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                  ปวช. 18 สัปดาห์
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                (รอบการสอน {sem.total_weeks} สัปดาห์)
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px]">
                {formatThaiDate(sem.start_date)} - {formatThaiDate(sem.end_date)}
              </span>
            </div>
          </div>

          {/* Stats summary */}
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100/80">
              <span className="text-[10px] text-slate-600 block">ห้องเรียน</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {sem.classroom_count ?? 0} ห้อง
              </span>
              {((sem.pvch_count ?? 0) > 0 || (sem.pvs_count ?? 0) > 0) && (
                <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                  {sem.pvch_count ? `ปวช. ${sem.pvch_count} ` : ''}
                  {sem.pvs_count ? `ปวส. ${sem.pvs_count}` : ''}
                </span>
              )}
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100/80">
              <span className="text-[10px] text-slate-600 block">ตารางสอน</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {sem.timetable_count ?? 0} คาบ
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ในภาคเรียนนี้
              </span>
            </div>
          </div>
        </div>

        {/* Actions Bottom Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {isActive ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>กำลังใช้งานในระบบ</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleActivate(sem.id)}
              disabled={activatingId === sem.id}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            >
              {activatingId === sem.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>ตั้งเป็นภาคเรียนปัจจุบัน</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenClone(sem.id)}
            className="p-2 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-transparent hover:border-indigo-100 transition-colors"
            title="คัดลอกห้องเรียนจากภาคเรียนนี้"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderEmptyTermSlot = (termNumber: number, year: string, counterpart?: Semester) => {
    return (
      <div className="h-full min-h-[260px] border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-5 bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col justify-between items-center text-center">
        <div className="w-full">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">
            ยังไม่ได้สร้างเทอม {termNumber}/{year}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {termNumber === 2
              ? 'เปิดสอนในภาคเรียนที่ 2 (ปลายปี) สามารถสร้างใหม่หรือคัดลอกข้อมูลจากเทอม 1 ได้ทันที'
              : 'เปิดสอนในภาคเรียนที่ 1 (ต้นปีการศึกษา) เริ่มต้นสร้างเพื่อเตรียมจัดตารางสอน'}
          </p>
        </div>

        <div className="w-full space-y-2 pt-4">
          <button
            type="button"
            onClick={() => handleQuickCreateTerm(termNumber, year)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างเทอม {termNumber}/{year}</span>
          </button>

          {counterpart && (
            <button
              type="button"
              onClick={() => handleOpenClone(counterpart.id)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs transition-all"
              title={`คัดลอกโครงสร้างห้องเรียนจากเทอม ${counterpart.term_number}`}
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>คัดลอกจากเทอม {counterpart.term_number} ({counterpart.classroom_count ?? 0} ห้อง)</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-7 pb-12 animate-fade-in">
      {/* ==================== PAGE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                จัดการภาคเรียน (Semesters & Terms)
              </h1>
              <p className="text-xs text-slate-600">
                1 ปีการศึกษาประกอบด้วย 2 เทอม จัดกลุ่มห้องเรียน ตารางสอน และการเช็คชื่อตามภาคเรียน
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenClone()}
            disabled={semesters.length < 2}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-indigo-200/80 shadow-xs hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
            title={semesters.length < 2 ? 'ต้องมีอย่างน้อย 2 ภาคเรียนเพื่อคัดลอก' : 'คัดลอกห้องเรียนข้ามภาคเรียน'}
          >
            <Copy className="w-4 h-4 text-purple-600" />
            <span>คัดลอกข้อมูลข้ามเทอม</span>
          </button>

          <button
            type="button"
            onClick={() => {
              // Intelligent auto-suggest: If Term 1 exists for current year but Term 2 doesn't, suggest Term 2
              const curSemesters = semesters.filter(s => s.academic_year === currentThaiYear);
              const hasTerm1 = curSemesters.some(s => s.term_number === 1);
              const hasTerm2 = curSemesters.some(s => s.term_number === 2);
              const nextTerm = hasTerm1 && !hasTerm2 ? 2 : 1;
              const christianYear = Number(currentThaiYear) - 543;
              const estStart = nextTerm === 2 ? `${christianYear}-11-01` : `${christianYear}-05-18`;
              const autoEnd = computeAutoEndDate(estStart, 18);

              setCreateForm(prev => ({
                ...prev,
                term_number: nextTerm,
                academic_year: currentThaiYear,
                name: `ภาคเรียนที่ ${nextTerm}/${currentThaiYear}`,
                start_date: estStart,
                end_date: autoEnd,
                is_active: semesters.length === 0,
              }));
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างภาคเรียนใหม่</span>
          </button>
        </div>
      </div>

      {/* ==================== ACTIVE SEMESTER HERO CARD ==================== */}
      {activeSemester && (
        <section
          aria-label="ภาคเรียนที่กำลังใช้งานอยู่"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white shadow-xl shadow-indigo-950/15 p-6 sm:p-8 border border-white/10"
        >
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ภาคเรียนปัจจุบันที่กำลังใช้งาน (Active Term)</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {activeSemester.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white text-xs font-bold">
                  {(activeSemester.pvch_count ?? 0) > 0 && (activeSemester.pvs_count ?? 0) > 0
                    ? `รวม ปวช. (${activeSemester.pvch_count}) & ปวส. (${activeSemester.pvs_count})`
                    : activeSemester.curriculum_type === 'pvs'
                    ? 'ปวส. 15 สัปดาห์'
                    : activeSemester.curriculum_type === 'custom'
                    ? `กำหนดเอง ${activeSemester.total_weeks} สัปดาห์`
                    : 'ปวช. / รวม (18 สัปดาห์)'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-100/90 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-300" />
                  <span>
                    ระยะเวลา: {formatThaiDate(activeSemester.start_date)} - {formatThaiDate(activeSemester.end_date)}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-300" />
                  <span>จำนวนสัปดาห์: {activeSemester.total_weeks} สัปดาห์</span>
                </div>
              </div>
            </div>

            {/* Quick Stats on Active Semester */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-initial px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[100px]">
                <p className="text-[11px] text-indigo-200 font-medium">ห้องเรียน</p>
                <p className="text-2xl font-black text-white font-mono">{activeSemester.classroom_count ?? 0}</p>
              </div>
              <div className="flex-1 md:flex-initial px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[100px]">
                <p className="text-[11px] text-indigo-200 font-medium">คาบสอน</p>
                <p className="text-2xl font-black text-white font-mono">{activeSemester.timetable_count ?? 0}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== SEMESTERS LIST ==================== */}
      <section aria-label="รายการภาคเรียนทั้งหมด" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>ภาคเรียนทั้งหมดในระบบ</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {semesters.length} รายการ
            </span>
          </h2>
          <span className="text-xs text-slate-600 hidden sm:inline">
            คลิก &quot;ตั้งเป็นภาคเรียนปัจจุบัน&quot; เพื่อสลับการแสดงผลห้องเรียนและตารางสอน
          </span>
        </div>

        {loading ? (
          <div className="glass p-12 text-center text-slate-600 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">กำลังโหลดข้อมูลภาคเรียน...</p>
          </div>
        ) : semesters.length === 0 ? (
          <div className="glass p-12 text-center rounded-3xl border border-indigo-100">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-4">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">ยังไม่มีภาคเรียนในระบบ</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
              เริ่มต้นสร้างภาคเรียนแรก เช่น ภาคเรียนที่ 1/2569 เพื่อจัดกลุ่มห้องเรียน ตารางสอน และการเช็คชื่อ
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างภาคเรียนแรก</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedYears.map((group) => {
              const hasBothTerms = Boolean(group.term1 && group.term2);

              return (
                <div
                  key={group.year}
                  className="rounded-3xl bg-slate-50/70 border border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-xs"
                >
                  {/* Year Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black shadow-sm">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                            ปีการศึกษา {group.year}
                          </h3>
                          {hasBothTerms ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>มีครบ 2 เทอม (เทอม 1 & เทอม 2)</span>
                            </span>
                          ) : group.term1 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold border border-amber-200">
                              <span>มีเฉพาะเทอม 1 (ยังไม่มีเทอม 2)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold border border-amber-200">
                              <span>มีเฉพาะเทอม 2 (ยังไม่มีเทอม 1)</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          1 ปีการศึกษา = 2 ภาคเรียน (เทอม 1 และ เทอม 2) • รวมห้องเรียนทั้งหมดในปีนี้: {group.totalClassrooms} ห้อง
                        </p>
                      </div>
                    </div>

                    {/* Quick Action in Year Header if Term 2 is missing */}
                    {!group.term2 && group.term1 && (
                      <button
                        type="button"
                        onClick={() => handleQuickCreateTerm(2, group.year)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all w-fit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>สร้างเทอม 2/{group.year} ทันที</span>
                      </button>
                    )}
                  </div>

                  {/* 2-Column Grid for Term 1 and Term 2 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Term 1 Slot */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black tracking-wide text-slate-700 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                          <span>ภาคเรียนที่ 1 (เทอม 1/{group.year})</span>
                        </span>
                        {group.term1?.is_active && (
                          <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ใช้งานอยู่</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        {group.term1
                          ? renderSemesterCard(group.term1)
                          : renderEmptyTermSlot(1, group.year, group.term2)}
                      </div>
                    </div>

                    {/* Term 2 Slot */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black tracking-wide text-slate-700 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                          <span>ภาคเรียนที่ 2 (เทอม 2/{group.year})</span>
                        </span>
                        {group.term2?.is_active && (
                          <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ใช้งานอยู่</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        {group.term2
                          ? renderSemesterCard(group.term2)
                          : renderEmptyTermSlot(2, group.year, group.term1)}
                      </div>
                    </div>
                  </div>

                  {/* Summer or Extra Terms if any */}
                  {group.otherTerms.length > 0 && (
                    <div className="pt-4 border-t border-slate-200/70 space-y-3">
                      <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>ภาคเรียนพิเศษ / ภาคฤดูร้อน (Summer) ของปี {group.year}</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.otherTerms.map(sem => renderSemesterCard(sem))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== CREATE SEMESTER MODAL ==================== */}
      {showCreateModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">สร้างภาคเรียนใหม่</h3>
                  <p className="text-xs text-slate-600">เพิ่มภาคเรียน เทอม 1 หรือ เทอม 2 สำหรับปีการศึกษา</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {/* Term Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ภาคเรียน (เทอม)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleTermOrYearChange(term, createForm.academic_year)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                        createForm.term_number === term
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {term === 3 ? 'ภาคฤดูร้อน' : `ภาคเรียนที่ ${term}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Academic Year & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ปีการศึกษา (พ.ศ.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 2569"
                    value={createForm.academic_year}
                    onChange={(e) => handleTermOrYearChange(createForm.term_number, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อภาคเรียน *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Curriculum Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ประเภทหลักสูตรในภาคเรียนนี้
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'pvch', label: 'รวม ปวช. & ปวส.', desc: '18 สัปดาห์ (แนะนำ)' },
                    { id: 'pvs', label: 'เฉพาะ ปวส.', desc: '15 สัปดาห์' },
                    { id: 'custom', label: 'กำหนดเอง', desc: 'ระบุสัปดาห์เอง' },
                  ].map((cur) => (
                    <button
                      key={cur.id}
                      type="button"
                      onClick={() => handleCurriculumChange(cur.id as 'pvch' | 'pvs' | 'custom')}
                      className={`p-2.5 text-center rounded-xl text-xs border transition-all ${
                        createForm.curriculum_type === cur.id
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block font-bold">{cur.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{cur.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>ใน 1 ภาคเรียนสามารถมีทั้งห้องเรียน ปวช. และ ปวส. ร่วมกันได้ โดยระบบจะคำนวณสัปดาห์เรียนแยกตามแต่ละห้อง</span>
                </p>
              </div>

              {/* Total Weeks & Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนสัปดาห์
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={createForm.total_weeks || 18}
                    onChange={(e) => {
                      const w = Number(e.target.value) || 18;
                      const end = createForm.start_date ? computeAutoEndDate(createForm.start_date, w) : createForm.end_date;
                      setCreateForm(prev => ({ ...prev, total_weeks: w, end_date: end }));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันเปิดภาคเรียน
                  </label>
                  <input
                    type="date"
                    value={createForm.start_date || ''}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันปิดภาคเรียน
                  </label>
                  <input
                    type="date"
                    value={createForm.end_date || ''}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Activate Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={createForm.is_active}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>ตั้งเป็นภาคเรียนปัจจุบันทันทีหลังจากสร้าง</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>สร้างภาคเรียน</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CLONE SEMESTER MODAL ==================== */}
      {showCloneModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCloneModal(false); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">คัดลอกข้อมูลข้ามภาคเรียน</h3>
                  <p className="text-xs text-slate-600">คัดลอกห้องเรียนและรายชื่อนักเรียนเพื่อเริ่มเทอมใหม่ได้ทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloneSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  ระบบจะคัดลอกห้องเรียน เกณฑ์คะแนน และรายชื่อนักเรียนไปยังภาคเรียนปลายทาง โดยประวัติการเช็คชื่อและคะแนนสอบจะเริ่มต้นใหม่สำหรับภาคเรียนใหม่
                </p>
              </div>

              {/* Source Semester */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ภาคเรียนต้นทาง (ที่จะคัดลอกข้อมูลมา) *
                </label>
                <select
                  value={cloneSourceId || ''}
                  onChange={(e) => setCloneSourceId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>เลือกภาคเรียนต้นทาง</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.classroom_count ?? 0} ห้องเรียน)
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Semester */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ภาคเรียนปลายทาง (ที่จะรับข้อมูล) *
                </label>
                <select
                  value={cloneTargetId || ''}
                  onChange={(e) => setCloneTargetId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>เลือกภาคเรียนปลายทาง</option>
                  {semesters
                    .filter(s => s.id !== cloneSourceId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.classroom_count ?? 0} ห้องเรียนเดิม)
                      </option>
                    ))}
                </select>
              </div>

              {/* Options */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeStudents}
                    onChange={(e) => setIncludeStudents(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>คัดลอกรายชื่อนักเรียนในแต่ละห้องเรียนด้วย (แนะนำ)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeTimetable}
                    onChange={(e) => setIncludeTimetable(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>คัดลอกตารางสอนประจำสัปดาห์ด้วย (หากตารางสอนเดิมยังใช้ได้)</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cloneSourceId || !cloneTargetId || cloneSourceId === cloneTargetId}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>ยืนยันการคัดลอก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT SEMESTER MODAL ==================== */}
      {editingSemester && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setEditingSemester(null); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">แก้ไขข้อมูลภาคเรียน</h3>
                  <p className="text-xs text-slate-600">แก้ไขชื่อ วันเปิด-ปิด และจำนวนสัปดาห์</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSemester(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อภาคเรียน *
                </label>
                <input
                  type="text"
                  required
                  value={editingSemester.name}
                  onChange={(e) => setEditingSemester(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ภาคเรียน (เทอม)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={editingSemester.term_number}
                    onChange={(e) => setEditingSemester(prev => prev ? { ...prev, term_number: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ปีการศึกษา
                  </label>
                  <input
                    type="text"
                    value={editingSemester.academic_year}
                    onChange={(e) => setEditingSemester(prev => prev ? { ...prev, academic_year: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนสัปดาห์
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={editingSemester.total_weeks || 18}
                    onChange={(e) => setEditingSemester(prev => prev ? { ...prev, total_weeks: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันเปิดภาคเรียน
                  </label>
                  <input
                    type="date"
                    value={editingSemester.start_date || ''}
                    onChange={(e) => setEditingSemester(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันปิดภาคเรียน
                  </label>
                  <input
                    type="date"
                    value={editingSemester.end_date || ''}
                    onChange={(e) => setEditingSemester(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingSemester(null)}
                  className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRM MODAL ==================== */}
      {deletingId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center animate-fade-in-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">ยืนยันการลบภาคเรียน?</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              การลบภาคเรียนนี้จะไม่ลบห้องเรียนเดิม แต่ห้องเรียนจะถูกปลดออกจากภาคเรียนนี้ (ไม่สามารถลบภาคเรียนที่กำลังใช้งานอยู่ได้)
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
