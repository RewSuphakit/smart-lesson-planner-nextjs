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
  Award,
  BookOpen,
  User,
  Sparkles,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Check,
  ArrowLeft,
  Loader2,
  School,
} from 'lucide-react';
import Link from 'next/link';

interface StudentInfo {
  id: number;
  name: string;
  student_code: string;
  grade_level: string | null;
}

interface ClassroomInfo {
  id: number;
  name: string;
  description: string | null;
  teacher_name: string;
  curriculum_type: string;
  total_weeks: number;
  total_classes: number;
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
}

interface PortalData {
  status: 'success' | 'multiple_classrooms';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'assignments' | 'attendance'>('assignments');
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'missing' | 'submitted'>('all');

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

  const fetchStudentData = async (code: string, classroomId?: number) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('กรุณากรอกรหัสประจำตัวนักเรียน');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/portal/student?code=${encodeURIComponent(trimmed)}`;
      if (classroomId) {
        url += `&classroom_id=${classroomId}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        setError(json.message || 'ไม่พบข้อมูลนักเรียน');
        setData(null);
      } else {
        setData(json);
        saveRecentCode(trimmed);
        if (json.classroom?.id) {
          setSelectedClassroomId(json.classroom.id);
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedClassroomId(null);
    fetchStudentData(studentCodeInput);
  };

  const handleSelectClassroom = (classroomId: number) => {
    setSelectedClassroomId(classroomId);
    fetchStudentData(studentCodeInput, classroomId);
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    setSelectedClassroomId(null);
  };

  const getGradeBadgeColor = (grade: string) => {
    if (grade === '4' || grade === '3.5') return 'bg-emerald-500 text-white';
    if (grade === '3' || grade === '2.5') return 'bg-blue-500 text-white';
    if (grade === '2' || grade === '1.5') return 'bg-amber-500 text-white';
    if (grade === '1') return 'bg-orange-500 text-white';
    if (grade === '0' || grade === 'ข.ร.' || grade === 'ม.ส.' || grade === 'ข.ส.')
      return 'bg-rose-500 text-white';
    return 'bg-slate-500 text-white';
  };

  const missingAssignmentsCount =
    data?.weekly_lessons?.filter((l) => l.is_missing).length ?? 0;

  const filteredLessons = data?.weekly_lessons?.filter((lesson) => {
    if (assignmentFilter === 'missing') return lesson.is_missing;
    if (assignmentFilter === 'submitted') return lesson.is_submitted;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-16">
      {/* ─── Top Brand Header ─── */}
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
                  ระบบตรวจสอบผลการเรียน
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                เช็คคะแนนเก็บ งานค้าง เวลาเรียน .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                title="พิมพ์หรือบันทึกเป็น PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>พิมพ์รายงาน</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8">
        {/* ─── Search Box (Hero on Empty State / Compact on Data State) ─── */}
        {!data ? (
          <div className="max-w-xl mx-auto mt-6 sm:mt-12 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              ค้นหาข้อมูลผลการเรียน
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
              กรอกรหัสประจำตัวนักเรียน เพื่อดูสถิติเวลาเรียน เกรดที่คาดว่าจะได้รับ
              และรายการงานที่ค้างส่ง
            </p>

            <form onSubmit={handleSearch} className="mt-6 sm:mt-8">
              <div className="relative flex items-center shadow-lg shadow-indigo-500/5 rounded-2xl bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all p-1.5">
                <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
                <input
                  type="text"
                  value={studentCodeInput}
                  onChange={(e) => setStudentCodeInput(e.target.value)}
                  placeholder="เช่น 6XXXXXX001"
                  className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !studentCodeInput.trim()}
                  className="btn btn-primary px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-md shadow-indigo-500/20 disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>ค้นหา</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
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
                  <span>ค้นหาล่าสุด:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentCodes.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setStudentCodeInput(code);
                        fetchStudentData(code);
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
                ข้อมูลคะแนนและเวลาเรียนอ้างอิงจากบันทึกของครูผู้สอนแบบ Real-time
                หากพบข้อมูลไม่ถูกต้องกรุณาติดต่อครูประจำวิชา
              </span>
            </div>
          </div>
        ) : (
          /* ─── Results Dashboard View ─── */
          <div className="space-y-6">
            {/* Top Bar with Student Info & Switch Class/Search */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/20 shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                      {data.student.name}
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200">
                      รหัส {data.student.student_code}
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
                      <span>•</span>
                      <span>ครูผู้สอน: {data.classroom.teacher_name}</span>
                    </div>
                  )}
                </div>
              </div>

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
                  <span>ค้นหาใหม่</span>
                </button>
              </div>
            </div>

            {/* If data returned multiple classrooms requiring choice */}
            {data.status === 'multiple_classrooms' && data.classrooms && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-2">
                  เลือกรายวิชาที่ต้องการตรวจสอบ
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  พบข้อมูลของนักเรียนใน {data.classrooms.length} รายวิชา
                  กรุณาคลิกเลือกวิชาที่ต้องการดูผลการเรียน
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.classrooms.map((c) => (
                    <button
                      key={c.classroom_id}
                      onClick={() => handleSelectClassroom(c.classroom_id)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all group flex items-center justify-between shadow-xs"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                          {c.classroom_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          ครูผู้สอน: {c.teacher_name}
                        </p>
                        {c.grade_level && (
                          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {c.grade_level}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If Single Classroom Data Ready */}
            {data.attendance_summary && data.grades_summary && (
              <>
                {/* ─── Quick Alert / Dangerous ม.ส. Banner ─── */}
                {data.attendance_summary.status === 'critical' ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-xs">
                    <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-rose-900">
                        ⚠️ เตือนภัยวิกฤต: เวลาเรียนไม่พอ (ติด ข.ร. / ม.ส.)
                      </h4>
                      <p className="text-xs text-rose-700 mt-1">
                        เวลาเรียนสะสมต่ำกว่าเกณฑ์ขั้นต่ำ{' '}
                        {data.attendance_summary.min_attendance_percent}% (ปัจจุบันได้{' '}
                        {data.attendance_summary.attendance_percent}%)
                        ขาดเรียนสะสมเทียบเท่า{' '}
                        {data.attendance_summary.total_converted_absent} ครั้ง
                        เกินโควตาที่อนุญาต ({data.attendance_summary.max_allowed_absences}{' '}
                        ครั้ง) กรุณาติดต่อครูผู้สอนทันทีเพื่อแก้ไข
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
                        ⚡ เฝ้าระวังใกล้หมดสิทธิ์สอบ (เสี่ยงติด ม.ส.)
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        สามารถขาดเรียนได้อีกเพียง{' '}
                        <span className="font-bold underline">
                          {data.attendance_summary.remaining_absences} ครั้ง
                        </span>{' '}
                        เท่านั้น
                        หากขาดเกินกว่านี้จะไม่มีสิทธิ์สอบปลายภาคในรายวิชานี้
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* ─── Key Metrics 3 Cards (Grade / Attendance Meter / Missing Assignments) ─── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Grade Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-indigo-500" />
                        เกรดคาดการณ์
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        ร้อยละ {data.grades_summary.percentage}%
                      </span>
                    </div>

                    <div className="my-4 flex items-baseline gap-3">
                      <span
                        className={`text-4xl font-extrabold px-3 py-1 rounded-2xl shadow-sm ${getGradeBadgeColor(
                          data.grades_summary.grade
                        )}`}
                      >
                        {data.grades_summary.grade}
                      </span>
                      <div>
                        <div className="text-lg font-bold text-slate-800">
                          {data.grades_summary.total_score} / {data.grades_summary.max_score}
                        </div>
                        <p className="text-[11px] text-slate-400">คะแนนรวมทั้งหมด</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${data.attendance_summary.is_f
                            ? 'bg-rose-500'
                            : Number(data.grades_summary.percentage) >= 80
                              ? 'bg-emerald-500'
                              : Number(data.grades_summary.percentage) >= 60
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, Number(data.grades_summary.percentage))
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5">
                        <span>0 คะแนน</span>
                        <span>เกณฑ์เกรด 4 (80 คะแนน)</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Attendance Gauge Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        เวลาเรียนสะสม
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
                          ? '🟢 ปกติ'
                          : data.attendance_summary.status === 'warning'
                            ? '🟡 เฝ้าระวัง'
                            : '🔴 หมดสิทธิ์สอบ'}
                      </span>
                    </div>

                    <div className="my-3 flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-extrabold text-slate-800">
                          {data.attendance_summary.attendance_percent}%
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          เกณฑ์ผ่านขั้นต่ำ {data.attendance_summary.min_attendance_percent}%
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
                            ? `ขาดได้อีก ${data.attendance_summary.remaining_absences} ครั้ง`
                            : `เกินโควตา ${Math.abs(
                              data.attendance_summary.remaining_absences
                            )} ครั้ง`}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          ขาดสะสม {data.attendance_summary.total_converted_absent} /{' '}
                          {data.attendance_summary.max_allowed_absences} ครั้ง
                        </p>
                      </div>
                    </div>

                    {/* Attendance breakdown pills */}
                    <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-slate-100">
                      <div className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                        <span className="block text-[10px]">มา</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.present_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-amber-50 text-amber-700">
                        <span className="block text-[10px]">สาย</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.late_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-blue-50 text-blue-700">
                        <span className="block text-[10px]">ลา</span>
                        <span className="font-bold text-xs">
                          {data.attendance_summary.leave_count}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-rose-50 text-rose-700">
                        <span className="block text-[10px]">ขาด</span>
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
                        การส่งงานรายสัปดาห์
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${missingAssignmentsCount === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                      >
                        {missingAssignmentsCount === 0
                          ? 'ส่งงานครบทุกชิ้น'
                          : `ค้างส่ง ${missingAssignmentsCount} งาน`}
                      </span>
                    </div>

                    <div className="my-3">
                      <div className="text-3xl font-extrabold text-slate-800">
                        {missingAssignmentsCount === 0 ? (
                          <span className="text-emerald-600 flex items-center gap-2">
                            <CheckCircle2 className="w-8 h-8" />
                            <span>เรียบร้อย</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1.5">
                            <XCircle className="w-7 h-7" />
                            <span>{missingAssignmentsCount} สัปดาห์</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        คะแนนงานเก็บสะสม {data.grades_summary.scaled_assignment} /{' '}
                        {data.grades_summary.max_scaled_assignment} แต้ม
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab('assignments');
                        setAssignmentFilter('missing');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <span>ดูรายการงานค้าง</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* ─── Navigation Tabs ─── */}
                <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto no-scrollbar pt-2">
                  <button
                    onClick={() => setActiveTab('assignments')}
                    className={`pb-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'assignments'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>คะแนนงานรายสัปดาห์</span>
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
                    <span>ประวัติบันทึกเวลาเรียน</span>
                    <span className="text-[11px] text-slate-400">
                      ({data.attendance_records?.length || 0})
                    </span>
                  </button>
                </div>



                {/* ─── TAB 2: Weekly Assignments & Submissions ─── */}
                {activeTab === 'assignments' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">
                          คะแนนการส่งงานและแบบทดสอบรายสัปดาห์
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ตรวจสอบว่าสัปดาห์ไหนส่งงานแล้ว หรือยังมีงานค้างส่ง
                        </p>
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
                          ทั้งหมด ({data.weekly_lessons?.length || 0})
                        </button>
                        <button
                          onClick={() => setAssignmentFilter('missing')}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignmentFilter === 'missing'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-rose-600 hover:text-rose-700'
                            }`}
                        >
                          ค้างส่ง ({missingAssignmentsCount})
                        </button>
                        <button
                          onClick={() => setAssignmentFilter('submitted')}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignmentFilter === 'submitted'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-emerald-700 hover:text-emerald-800'
                            }`}
                        >
                          ส่งแล้ว
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
                                    งานมอบหมาย: {lesson.assignment_score ?? 0} /{' '}
                                    {lesson.max_assignment}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    แบบทดสอบ: {lesson.post_test_score ?? 0} /{' '}
                                    {lesson.max_post_test}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {lesson.is_missing ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span>ค้างส่ง</span>
                                </span>
                              ) : lesson.is_submitted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>ส่งแล้ว</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">
                                  ไม่มีงาน
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          ไม่มีข้อมูลในเงื่อนไขที่เลือก
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── TAB 3: Attendance History ─── */}
                {activeTab === 'attendance' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        ประวัติการเช็คชื่อเข้าชั้นเรียน
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        บันทึกรายวันทั้งหมดที่ครูผู้สอนได้ทำการเช็คชื่อ
                      </p>
                    </div>

                    {data.attendance_records && data.attendance_records.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="pb-3 font-semibold">ลำดับ</th>
                              <th className="pb-3 font-semibold">วันที่</th>
                              <th className="pb-3 font-semibold text-right">สถานะ</th>
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
                                      ? '✓ มาเรียน'
                                      : rec.status === 'late'
                                        ? '⏱ มาสาย'
                                        : rec.status === 'leave'
                                          ? '📝 ลา'
                                          : '✗ ขาดเรียน'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        ยังไม่มีประวัติการเช็คชื่อ
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
