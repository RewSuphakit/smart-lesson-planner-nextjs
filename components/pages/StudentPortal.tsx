'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  BookOpen,
  Sparkles,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Check,
  Loader2,
  School,
  Camera,
  Trash2,
  Lock,
} from 'lucide-react';
import toast from '@/lib/toast';
import UserAvatar from '@/components/UserAvatar';
import { compressImageFile } from '@/lib/avatarCompression';

interface StudentInfo {
  id: number;
  name: string;
  student_code: string;
  grade_level: string | null;
  avatar?: string | null;
}

interface ClassroomInfo {
  id: number;
  name: string;
  description: string | null;
  teacher_name: string;
  curriculum_type: string;
  total_weeks: number;
  current_teaching_week?: number;
  total_classes: number;
  is_portal_enabled?: boolean;
}

interface AttendanceSummary {
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  total_converted_absent: number;
  max_allowed_absences: number;
  remaining_absences: number;
  attendance_percent: number;
  min_attendance_percent: number;
  status: 'safe' | 'warning' | 'critical';
  is_f: boolean;
}

interface GradesSummary {
  grade: string;
  percentage: string;
  total_score: number;
  total_score_precise: number;
  max_score: number;
  raw_assignment: number;
  max_raw_assignment: number;
  scaled_assignment: number;
  max_scaled_assignment: number;
  raw_post_test: number;
  max_raw_post_test: number;
  scaled_post_test: number;
  max_scaled_post_test: number;
  midterm_score: number;
  max_midterm_score: number;
  scaled_midterm: number;
  max_scaled_midterm: number;
  final_score: number | null;
  max_final_score: number;
  scaled_final: number;
  max_scaled_final: number;
  affective_score: number;
  max_affective_score: number;
  weights: {
    assignment: number;
    post_test: number;
    affective: number;
    midterm: number;
    final: number;
  };
}

interface WeeklyLesson {
  lesson_number: number;
  lesson_name: string;
  max_assignment: number;
  max_post_test: number;
  assignment_score: number | null;
  post_test_score: number | null;
  is_submitted: boolean;
  is_missing: boolean;
}

interface AttendanceRecord {
  id: number;
  date: string;
  status: 'present' | 'late' | 'absent' | 'leave';
}

interface ClassroomOption {
  student_id: number;
  classroom_id: number;
  classroom_name: string;
  description?: string;
  teacher_name: string;
  grade_level?: string;
  is_portal_enabled?: boolean;
}

interface PortalData {
  status: 'success' | 'multiple_classrooms' | 'portal_disabled';
  student: StudentInfo;
  classroom?: ClassroomInfo;
  attendance_summary?: AttendanceSummary;
  grades_summary?: GradesSummary;
  weekly_lessons?: WeeklyLesson[];
  attendance_records?: AttendanceRecord[];
  all_classrooms?: ClassroomOption[];
  classrooms?: ClassroomOption[];
}

export default function StudentPortal() {
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [verifyNameInput, setVerifyNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'assignments' | 'attendance'>('assignments');
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'missing' | 'submitted'>('all');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const verifyNameRef = React.useRef<HTMLInputElement>(null);
  const classroomCacheRef = React.useRef<Map<number, PortalData>>(new Map());

  // Load recently searched student codes
  useEffect(() => {
    try {
      const saved = localStorage.getItem('slp_recent_student_codes');
      if (saved) {
        setRecentCodes(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentCode = (code: string) => {
    try {
      const filtered = recentCodes.filter((c) => c !== code);
      const updated = [code, ...filtered].slice(0, 4);
      setRecentCodes(updated);
      localStorage.setItem('slp_recent_student_codes', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const fetchStudentData = async (code: string, classroomId?: number, verifyName?: string) => {
    const trimmed = code.trim();
    const trimmedVerify = (verifyName ?? verifyNameInput).trim();
    if (!trimmed) {
      setError('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
      return;
    }
    if (!classroomId && trimmedVerify.length < 2) {
      setError('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¸«à¸£à¸·à¸­à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥ (à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 2 à¸•à¸±à¸§à¸­à¸±à¸à¸©à¸£) à¹€à¸žà¸·à¹ˆà¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/portal/student?code=${encodeURIComponent(trimmed)}`;
      if (trimmedVerify) {
        url += `&verify_name=${encodeURIComponent(trimmedVerify)}`;
      }
      if (classroomId) {
        url += `&classroom_id=${classroomId}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        if (classroomId && data) {
          toast.error(json.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¹„à¸”à¹‰');
        } else {
          setError(json.message || 'à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
          setData(null);
        }
      } else {
        setData(json);
        saveRecentCode(trimmed);
        if (json.classroom?.id) {
          setSelectedClassroomId(json.classroom.id);
          // Never cache locked classrooms so a re-opened subject is picked up immediately
          if (json.status === 'success') {
            classroomCacheRef.current.set(json.classroom.id, json);
          }
        }
      }
    } catch {
      if (classroomId && data) {
        toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
      } else {
        setError('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    classroomCacheRef.current.clear();
    setSelectedClassroomId(null);
    fetchStudentData(studentCodeInput);
  };

  const handleSelectClassroom = (classroomId: number) => {
    setSelectedClassroomId(classroomId);

    // Instant switch from in-memory cache if already fetched
    const cached = classroomCacheRef.current.get(classroomId);
    if (cached) {
      setData(cached);
      return;
    }

    fetchStudentData(studentCodeInput, classroomId);
  };

  const handleReset = () => {
    classroomCacheRef.current.clear();
    setData(null);
    setError(null);
    setSelectedClassroomId(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    if (!file.type.startsWith('image/')) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸ž (JPG, PNG, WebP)');
      return;
    }

    setIsUploadingAvatar(true);
    const loadingToast = toast.loading('à¸à¸³à¸¥à¸±à¸‡à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹à¸¥à¸°à¸­à¸±à¸žà¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ à¸²à¸ž...');
    try {
      // Compress client-side to compact WebP (200x200, ~4-8 KB)
      const compressed = await compressImageFile(file, 200, 0.8);

      const res = await fetch('/api/portal/student', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_code: data.student.student_code,
          avatar: compressed,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¸±à¸žà¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ à¸²à¸žà¹„à¸”à¹‰');
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          student: {
            ...prev.student,
            avatar: resData.avatar || compressed,
          },
        };
      });

      toast.success('à¸­à¸±à¸žà¹€à¸”à¸—à¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§', { id: loadingToast });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸­à¸±à¸žà¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ à¸²à¸ž';
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!data || !data.student.avatar) return;
    if (!window.confirm('à¸„à¸¸à¸“à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸šà¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¸™à¸µà¹‰à¹ƒà¸Šà¹ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?')) return;

    setIsUploadingAvatar(true);
    const loadingToast = toast.loading('à¸à¸³à¸¥à¸±à¸‡à¸¥à¸šà¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ...');
    try {
      const res = await fetch('/api/portal/student', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_code: data.student.student_code,
          remove_avatar: true,
          avatar: null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¥à¸šà¸£à¸¹à¸›à¸ à¸²à¸žà¹„à¸”à¹‰');
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          student: {
            ...prev.student,
            avatar: null,
          },
        };
      });

      toast.success('à¸¥à¸šà¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§', { id: loadingToast });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸¥à¸šà¸£à¸¹à¸›à¸ à¸²à¸ž';
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const missingAssignmentsCount =
    data?.weekly_lessons?.filter((l) => l.is_missing).length ?? 0;

  const filteredLessons = data?.weekly_lessons?.filter((lesson) => {
    if (assignmentFilter === 'missing') return lesson.is_missing;
    if (assignmentFilter === 'submitted') return lesson.is_submitted;
    return true;
  });

  // Avatar editing is only allowed while at least one of the student's classrooms is open
  const portalClassroomList = data?.all_classrooms ?? data?.classrooms ?? [];
  const canEditAvatar = data
    ? data.status === 'success' ||
    portalClassroomList.some((c) => c.is_portal_enabled !== false)
    : false;
  const hasOtherOpenClassroom = (data?.all_classrooms ?? []).some(
    (c) => c.is_portal_enabled !== false && c.classroom_id !== data?.classroom?.id
  );

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-16">
      {/* â”€â”€â”€ Top Brand Header â”€â”€â”€ */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 tracking-tight leading-tight flex items-center gap-2">
                <span>Student Portal</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  à¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                à¹€à¸Šà¹‡à¸„à¸„à¸°à¹à¸™à¸™à¹€à¸à¹‡à¸š à¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡ à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && data.status === 'success' && (
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                title="à¸žà¸´à¸¡à¸žà¹Œà¸«à¸£à¸·à¸­à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸›à¹‡à¸™ PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>à¸žà¸´à¸¡à¸žà¹Œà¸£à¸²à¸¢à¸‡à¸²à¸™</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* â”€â”€â”€ Main Content Container â”€â”€â”€ */}
      <main className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8">
        {/* â”€â”€â”€ Search Box (Hero on Empty State / Compact on Data State) â”€â”€â”€ */}
        {!data ? (
          <div className="max-w-xl mx-auto mt-6 sm:mt-12 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              à¸„à¹‰à¸™à¸«à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
              à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ à¸žà¸£à¹‰à¸­à¸¡à¸Šà¸·à¹ˆà¸­à¸«à¸£à¸·à¸­à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥à¹€à¸žà¸·à¹ˆà¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™
              à¹à¸¥à¸°à¸”à¸¹à¸ªà¸–à¸´à¸•à¸´à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡à¸ªà¹ˆà¸‡
            </p>

            <form onSubmit={handleSearch} className="mt-6 sm:mt-8 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                <div className="relative flex items-center shadow-sm rounded-2xl bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all px-3 py-1">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={studentCodeInput}
                    onChange={(e) => setStudentCodeInput(e.target.value)}
                    placeholder="à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ à¹€à¸Šà¹ˆà¸™ 68219090020"
                    className="w-full bg-transparent px-2.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
                <div className="relative flex items-center shadow-sm rounded-2xl bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all px-3 py-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <input
                    ref={verifyNameRef}
                    type="text"
                    value={verifyNameInput}
                    onChange={(e) => setVerifyNameInput(e.target.value)}
                    placeholder="à¸Šà¸·à¹ˆà¸­ à¸«à¸£à¸·à¸­ à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥ (à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™)"
                    className="w-full bg-transparent px-2.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !studentCodeInput.trim() || verifyNameInput.trim().length < 2}
                className="btn btn-primary w-full py-3 rounded-2xl font-semibold text-sm shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2.5 text-left">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Recent Searches */}
            {recentCodes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200/80 text-left">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-2.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>à¸„à¹‰à¸™à¸«à¸²à¸¥à¹ˆà¸²à¸ªà¸¸à¸”:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentCodes.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        classroomCacheRef.current.clear();
                        setSelectedClassroomId(null);
                        setStudentCodeInput(code);
                        if (verifyNameInput.trim().length >= 2) {
                          fetchStudentData(code, undefined, verifyNameInput);
                        } else {
                          setError(null);
                          verifyNameRef.current?.focus();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-xs font-mono text-slate-700 hover:text-indigo-600 transition-colors shadow-xs"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Security / Help Note */}
            <div className="mt-10 p-4 rounded-2xl bg-slate-100/60 border border-slate-200/60 text-center text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500 inline-block mr-1 -mt-0.5" />
              <span>
                à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸°à¹à¸™à¸™à¹à¸¥à¸°à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¸ˆà¸²à¸à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¸­à¸‡à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™à¹à¸šà¸š Real-time
                à¸«à¸²à¸à¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¸à¸£à¸¸à¸“à¸²à¸•à¸´à¸”à¸•à¹ˆà¸­à¸„à¸£à¸¹à¸›à¸£à¸°à¸ˆà¸³à¸§à¸´à¸Šà¸²
              </span>
            </div>
          </div>
        ) : (
          /* â”€â”€â”€ Results Dashboard View â”€â”€â”€ */
          <div className="space-y-6">
            {/* Top Bar with Student Info & Switch Class/Search */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                {/* Profile Avatar with Camera Trigger */}
                <div className="relative group shrink-0">
                  <UserAvatar
                    avatar={data.student.avatar}
                    name={data.student.name}
                    userId={data.student.id}
                    size="lg"
                    className="rounded-2xl border-2 border-indigo-200/80 shadow-md transition-all duration-200 group-hover:scale-105"
                  />
                  {canEditAvatar && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-xl shadow-md border-2 border-white transition-all hover:scale-110 disabled:opacity-50 cursor-pointer"
                      title="à¸­à¸±à¸žà¹‚à¸«à¸¥à¸”à¸«à¸£à¸·à¸­à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                      {data.student.name}
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200">
                      à¸£à¸«à¸±à¸ª {data.student.student_code}
                    </span>
                    {data.student.grade_level && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
                        {data.student.grade_level}
                      </span>
                    )}
                  </div>
                  {data.classroom && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="font-medium text-slate-700 flex items-center gap-1">
                        <School className="w-3.5 h-3.5 text-slate-400" />
                        {data.classroom.name}
                      </span>
                      <span>â€¢</span>
                      <span>à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™: {data.classroom.teacher_name}</span>
                    </div>
                  )}

                  {/* Quick Profile Photo Actions */}
                  {canEditAvatar && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 border border-indigo-200/60 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>{data.student.avatar ? 'à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸¹à¸›à¸ à¸²à¸ž' : 'à¸­à¸±à¸žà¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ'}</span>
                      </button>
                      {data.student.avatar && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={isUploadingAvatar}
                          className="text-[11px] font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="à¸¥à¸šà¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸­à¸´à¹‚à¸¡à¸ˆà¸´à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>à¸¥à¸šà¸£à¸¹à¸›</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden file input for avatar upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Classroom Selector if multiple */}
                {(data.all_classrooms?.length ?? 0) > 1 && (
                  <select
                    value={selectedClassroomId || data.classroom?.id}
                    onChange={(e) => handleSelectClassroom(Number(e.target.value))}
                    className="form-input text-xs py-1.5 px-2.5 rounded-xl border-slate-200 bg-slate-50 font-medium text-slate-700"
                  >
                    {data.all_classrooms!.map((c) => (
                      <option key={c.classroom_id} value={c.classroom_id}>
                        {c.is_portal_enabled === false ? 'ðŸ”’ ' : ''}
                        {c.classroom_name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-600 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>à¸„à¹‰à¸™à¸«à¸²à¹ƒà¸«à¸¡à¹ˆ</span>
                </button>
              </div>
            </div>

            {/* If data returned multiple classrooms requiring choice */}
            {data.status === 'multiple_classrooms' && data.classrooms && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-2">
                  à¹€à¸¥à¸·à¸­à¸à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  à¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™ {data.classrooms.length} à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²
                  à¸à¸£à¸¸à¸“à¸²à¸„à¸¥à¸´à¸à¹€à¸¥à¸·à¸­à¸à¸§à¸´à¸Šà¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸”à¸¹à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.classrooms.map((c) => {
                    const isLocked = c.is_portal_enabled === false;
                    return (
                      <button
                        key={c.classroom_id}
                        onClick={() => handleSelectClassroom(c.classroom_id)}
                        className={`p-4 rounded-xl border text-left transition-all group flex items-center justify-between shadow-xs ${isLocked
                            ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            : 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40'
                          }`}
                      >
                        <div>
                          <p
                            className={`text-sm font-semibold ${isLocked ? 'text-slate-500' : 'text-slate-800 group-hover:text-indigo-600'
                              }`}
                          >
                            {c.classroom_name}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™: {c.teacher_name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {c.grade_level && (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {c.grade_level}
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                                <Lock className="w-3 h-3" />
                                à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§
                              </span>
                            )}
                          </div>
                        </div>
                        {isLocked ? (
                          <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If the subject teacher has closed this classroom's Student Portal */}
            {data.status === 'portal_disabled' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm text-center animate-fade-in-up">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™à¸›à¸´à¸”à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸”à¸¹à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§
                </h3>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                  à¸£à¸²à¸¢à¸§à¸´à¸Šà¸² <span className="font-semibold text-slate-700">{data.classroom?.name}</span>{' '}
                  à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¸„à¸°à¹à¸™à¸™à¹ƒà¸™à¸‚à¸“à¸°à¸™à¸µà¹‰
                  à¸«à¸²à¸à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸—à¸£à¸²à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¸à¸£à¸¸à¸“à¸²à¸•à¸´à¸”à¸•à¹ˆà¸­à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™
                  {data.classroom?.teacher_name ? ` (${data.classroom.teacher_name})` : ''}
                </p>
                {hasOtherOpenClassroom && (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-xs text-slate-500 w-full">à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²à¸­à¸·à¹ˆà¸™à¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸­à¸¢à¸¹à¹ˆ:</span>
                    {(data.all_classrooms ?? [])
                      .filter((c) => c.is_portal_enabled !== false)
                      .map((c) => (
                        <button
                          key={c.classroom_id}
                          onClick={() => handleSelectClassroom(c.classroom_id)}
                          className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{c.classroom_name}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* If Single Classroom Data Ready */}
            {data.attendance_summary && data.grades_summary && (
              <>
                {/* â”€â”€â”€ Quick Alert / Dangerous à¸¡.à¸ª. Banner â”€â”€â”€ */}
                {data.attendance_summary.status === 'critical' ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-xs">
                    <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-rose-900">
                        âš ï¸ à¹€à¸•à¸·à¸­à¸™à¸ à¸±à¸¢à¸§à¸´à¸à¸¤à¸•: à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¹„à¸¡à¹ˆà¸žà¸­ (à¸•à¸´à¸” à¸‚.à¸£. / à¸¡.à¸ª.)
                      </h4>
                      <p className="text-xs text-rose-700 mt-1">
                        à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸ªà¸°à¸ªà¸¡à¸•à¹ˆà¸³à¸à¸§à¹ˆà¸²à¹€à¸à¸“à¸‘à¹Œà¸‚à¸±à¹‰à¸™à¸•à¹ˆà¸³{' '}
                        {data.attendance_summary.min_attendance_percent}% (à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹„à¸”à¹‰{' '}
                        {data.attendance_summary.attendance_percent}%)
                        à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™à¸ªà¸°à¸ªà¸¡à¹€à¸—à¸µà¸¢à¸šà¹€à¸—à¹ˆà¸²{' '}
                        {data.attendance_summary.total_converted_absent} à¸„à¸£à¸±à¹‰à¸‡
                        à¹€à¸à¸´à¸™à¹‚à¸„à¸§à¸•à¸²à¸—à¸µà¹ˆà¸­à¸™à¸¸à¸à¸²à¸• ({data.attendance_summary.max_allowed_absences}{' '}
                        à¸„à¸£à¸±à¹‰à¸‡) à¸à¸£à¸¸à¸“à¸²à¸•à¸´à¸”à¸•à¹ˆà¸­à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™à¸—à¸±à¸™à¸—à¸µà¹€à¸žà¸·à¹ˆà¸­à¹à¸à¹‰à¹„à¸‚
                      </p>
                    </div>
                  </div>
                ) : data.attendance_summary.status === 'warning' ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-xs">
                    <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">
                        âš¡ à¹€à¸à¹‰à¸²à¸£à¸°à¸§à¸±à¸‡à¹ƒà¸à¸¥à¹‰à¸«à¸¡à¸”à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸š (à¹€à¸ªà¸µà¹ˆà¸¢à¸‡à¸•à¸´à¸” à¸¡.à¸ª.)
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        à¸ªà¸²à¸¡à¸²à¸£à¸–à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™à¹„à¸”à¹‰à¸­à¸µà¸à¹€à¸žà¸µà¸¢à¸‡{' '}
                        <span className="font-bold underline">
                          {data.attendance_summary.remaining_absences} à¸„à¸£à¸±à¹‰à¸‡
                        </span>{' '}
                        à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™
                        à¸«à¸²à¸à¸‚à¸²à¸”à¹€à¸à¸´à¸™à¸à¸§à¹ˆà¸²à¸™à¸µà¹‰à¸ˆà¸°à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸šà¸›à¸¥à¸²à¸¢à¸ à¸²à¸„à¹ƒà¸™à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²à¸™à¸µà¹‰
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* â”€â”€â”€ Key Metrics 2 Cards (Attendance Meter / Missing Assignments) â”€â”€â”€ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* 2. Attendance Gauge Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸ªà¸°à¸ªà¸¡
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${data.attendance_summary.status === 'safe'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : data.attendance_summary.status === 'warning'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                      >
                        {data.attendance_summary.status === 'safe'
                          ? 'ðŸŸ¢ à¸›à¸à¸•à¸´'
                          : data.attendance_summary.status === 'warning'
                            ? 'ðŸŸ¡ à¹€à¸à¹‰à¸²à¸£à¸°à¸§à¸±à¸‡'
                            : 'ðŸ”´ à¸«à¸¡à¸”à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸š'}
                      </span>
                    </div>

                    <div className="my-3 flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-extrabold text-slate-800">
                          {data.attendance_summary.attendance_percent}%
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          à¹€à¸à¸“à¸‘à¹Œà¸œà¹ˆà¸²à¸™à¸‚à¸±à¹‰à¸™à¸•à¹ˆà¸³ {data.attendance_summary.min_attendance_percent}%
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-bold ${data.attendance_summary.remaining_absences < 0
                            ? 'text-rose-600'
                            : data.attendance_summary.remaining_absences <= 2
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                            }`}
                        >
                          {data.attendance_summary.remaining_absences >= 0
                            ? `à¸‚à¸²à¸”à¹„à¸”à¹‰à¸­à¸µà¸ ${data.attendance_summary.remaining_absences} à¸„à¸£à¸±à¹‰à¸‡`
                            : `à¹€à¸à¸´à¸™à¹‚à¸„à¸§à¸•à¸² ${Math.abs(
                              data.attendance_summary.remaining_absences
                            )} à¸„à¸£à¸±à¹‰à¸‡`}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          à¸‚à¸²à¸”à¸ªà¸°à¸ªà¸¡ {data.attendance_summary.total_converted_absent} /{' '}
                          {data.attendance_summary.max_allowed_absences} à¸„à¸£à¸±à¹‰à¸‡
                        </p>
                      </div>
                    </div>

                    {/* Attendance breakdown pills */}
                    <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-slate-100">
                      <div className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                        <span className="block text-[10px]">à¸¡à¸²</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.present_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-amber-50 text-amber-700">
                        <span className="block text-[10px]">à¸ªà¸²à¸¢</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.late_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-blue-50 text-blue-700">
                        <span className="block text-[10px]">à¸¥à¸²</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.leave_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-rose-50 text-rose-700">
                        <span className="block text-[10px]">à¸‚à¸²à¸”</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.absent_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Missing Assignments / Tasks Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-purple-500" />
                        à¸à¸²à¸£à¸ªà¹ˆà¸‡à¸‡à¸²à¸™à¸£à¸²à¸¢à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${missingAssignmentsCount === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                      >
                        {missingAssignmentsCount === 0
                          ? 'à¸ªà¹ˆà¸‡à¸‡à¸²à¸™à¸„à¸£à¸šà¸—à¸¸à¸à¸Šà¸´à¹‰à¸™'
                          : `à¸„à¹‰à¸²à¸‡à¸ªà¹ˆà¸‡ ${missingAssignmentsCount} à¸‡à¸²à¸™`}
                      </span>
                    </div>

                    <div className="my-3">
                      <div className="text-3xl font-extrabold text-slate-800">
                        {missingAssignmentsCount === 0 ? (
                          <span className="text-emerald-600 flex items-center gap-2">
                            <CheckCircle2 className="w-8 h-8" />
                            <span>à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1.5">
                            <XCircle className="w-7 h-7" />
                            <span>{missingAssignmentsCount} à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        à¸„à¸°à¹à¸™à¸™à¸‡à¸²à¸™à¹€à¸à¹‡à¸šà¸ªà¸°à¸ªà¸¡ {data.grades_summary.scaled_assignment} /{' '}
                        {data.grades_summary.max_scaled_assignment} à¹à¸•à¹‰à¸¡
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab('assignments');
                        setAssignmentFilter('missing');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <span>à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* â”€â”€â”€ Navigation Tabs â”€â”€â”€ */}
                <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto no-scrollbar pt-2">
                  <button
                    onClick={() => setActiveTab('assignments')}
                    className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'assignments'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>à¸„à¸°à¹à¸™à¸™à¸‡à¸²à¸™à¸£à¸²à¸¢à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
                    {missingAssignmentsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {missingAssignmentsCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'attendance'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™</span>
                    <span className="text-[11px] text-slate-400">
                      ({data.attendance_records?.length || 0})
                    </span>
                  </button>
                </div>



                {/* â”€â”€â”€ TAB 2: Weekly Assignments & Submissions â”€â”€â”€ */}
                {activeTab === 'assignments' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800">
                            à¸„à¸°à¹à¸™à¸™à¸à¸²à¸£à¸ªà¹ˆà¸‡à¸‡à¸²à¸™à¹à¸¥à¸°à¹à¸šà¸šà¸—à¸”à¸ªà¸­à¸šà¸£à¸²à¸¢à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ
                          </h3>
                          {data.classroom?.current_teaching_week && (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                              à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸—à¸µà¹ˆ 1 - {data.classroom.current_teaching_week} (à¸ˆà¸²à¸ {data.classroom.total_weeks} à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sub-filter buttons */}
                      <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => setAssignmentFilter('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignmentFilter === 'all'
                            ? 'bg-white text-slate-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” ({data.weekly_lessons?.length || 0})
                        </button>
                        <button
                          onClick={() => setAssignmentFilter('missing')}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignmentFilter === 'missing'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-rose-600 hover:text-rose-700'
                            }`}
                        >
                          à¸„à¹‰à¸²à¸‡à¸ªà¹ˆà¸‡ ({missingAssignmentsCount})
                        </button>
                        <button
                          onClick={() => setAssignmentFilter('submitted')}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignmentFilter === 'submitted'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-emerald-700 hover:text-emerald-800'
                            }`}
                        >
                          à¸ªà¹ˆà¸‡à¹à¸¥à¹‰à¸§
                        </button>
                      </div>
                    </div>

                    {/* Weekly lessons list */}
                    <div className="divide-y divide-slate-100">
                      {filteredLessons && filteredLessons.length > 0 ? (
                        filteredLessons.map((lesson) => (
                          <div
                            key={lesson.lesson_number}
                            className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${lesson.is_missing
                                  ? 'bg-rose-100 text-rose-700'
                                  : lesson.is_submitted
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                                  }`}
                              >
                                {lesson.lesson_number}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-800">
                                  {lesson.lesson_name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                  <span>
                                    à¸‡à¸²à¸™à¸¡à¸­à¸šà¸«à¸¡à¸²à¸¢: {lesson.assignment_score ?? 0} /{' '}
                                    {lesson.max_assignment}
                                  </span>
                                  <span>â€¢</span>
                                  <span>
                                    à¹à¸šà¸šà¸—à¸”à¸ªà¸­à¸š: {lesson.post_test_score ?? 0} /{' '}
                                    {lesson.max_post_test}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {lesson.is_missing ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span>à¸„à¹‰à¸²à¸‡à¸ªà¹ˆà¸‡</span>
                                </span>
                              ) : lesson.is_submitted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>à¸ªà¹ˆà¸‡à¹à¸¥à¹‰à¸§</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">
                                  à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          {assignmentFilter === 'missing' ? (
                            <div className="flex flex-col items-center gap-2 text-emerald-600">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <span className="font-semibold text-sm">à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡à¸ªà¹ˆà¸‡à¹ƒà¸™à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸ªà¸­à¸™à¹à¸¥à¹‰à¸§</span>
                              <span className="text-slate-400 text-xs">à¸„à¸¸à¸“à¸ªà¹ˆà¸‡à¸‡à¸²à¸™à¹à¸¥à¸°à¸—à¸³à¹à¸šà¸šà¸—à¸”à¸ªà¸­à¸šà¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢</span>
                            </div>
                          ) : (
                            'à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸™à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* â”€â”€â”€ TAB 3: Attendance History â”€â”€â”€ */}
                {activeTab === 'attendance' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹€à¸‚à¹‰à¸²à¸Šà¸±à¹‰à¸™à¹€à¸£à¸µà¸¢à¸™
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¸²à¸¢à¸§à¸±à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸—à¸µà¹ˆà¸„à¸£à¸¹à¸œà¸¹à¹‰à¸ªà¸­à¸™à¹„à¸”à¹‰à¸—à¸³à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­
                      </p>
                    </div>

                    {data.attendance_records && data.attendance_records.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="pb-3 font-semibold">à¸¥à¸³à¸”à¸±à¸š</th>
                              <th className="pb-3 font-semibold">à¸§à¸±à¸™à¸—à¸µà¹ˆ</th>
                              <th className="pb-3 font-semibold text-right">à¸ªà¸–à¸²à¸™à¸°</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.attendance_records.map((rec, index) => (
                              <tr key={rec.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 text-slate-400 font-mono">
                                  {index + 1}
                                </td>
                                <td className="py-2.5 text-slate-700 font-medium">
                                  {new Date(rec.date).toLocaleDateString('th-TH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'short',
                                  })}
                                </td>
                                <td className="py-2.5 text-right">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${rec.status === 'present'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : rec.status === 'late'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : rec.status === 'leave'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                  >
                                    {rec.status === 'present'
                                      ? 'âœ“ à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™'
                                      : rec.status === 'late'
                                        ? 'â± à¸¡à¸²à¸ªà¸²à¸¢'
                                        : rec.status === 'leave'
                                          ? 'ðŸ“ à¸¥à¸²'
                                          : 'âœ— à¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
