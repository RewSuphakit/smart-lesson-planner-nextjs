'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import {
  Presentation,
  Users,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  BookOpen,
  ArrowRight,
  GraduationCap,
  BellRing,
  ChevronRight,
  Smile,
  CheckSquare,
  Award,
  Layers,
  Sparkle,
  CalendarDays,
  XCircle,
  HelpCircle,
  Clock3
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface DashboardData {
  totalClassrooms: number;
  totalStudents: number;
  todayStats?: {
    totalClasses: number;
    checkedClasses: number;
    totalWeeklyHours: number;
    todayAttendanceRate: number | null;
  };
  todaySchedule?: Array<{
    id: number;
    subject_code: string;
    subject_name: string;
    room: string;
    group_name: string;
    start_period: number;
    end_period: number;
    start_time: string;
    end_time: string;
    hours: number;
    entry_type: string;
    color: string;
    classroom_id: number | null;
    classroom_name: string | null;
    is_attendance_checked: boolean;
  }>;
  upcomingSchedules: Array<{
    scheduled_date: string;
    start_time: string;
    end_time: string;
    status: string;
    lesson_title: string;
    subject: string;
  }>;
  atRiskStudents?: Array<{
    student_id: number;
    student_name: string;
    student_code: string | null;
    classroom_name: string;
    reason: string;
    type: string;
    absent_count?: number;
    max_allowed?: number;
    remaining?: number;
  }>;
  pendingTasks?: Array<{
    type: string;
    classroom_name: string;
    message: string;
    link: string;
  }>;
}

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

const entryTypeConfig: Record<string, { label: string; badge: string }> = {
  lecture: { label: 'ทฤษฎี', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  lab: { label: 'ปฏิบัติ', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  activity: { label: 'กิจกรรม', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  homeroom: { label: 'โฮมรูม', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<'all' | 'attendance_f' | 'attendance_warning'>('all');
  const [searchRisk, setSearchRisk] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    api.get('/dashboard', { signal: controller.signal })
      .then(res => {
        if (active) {
          setData(res.data.data);
        }
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          console.error(err);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Greeting based on Thai time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        title: 'สวัสดีตอนเช้า',
        subtext: 'ขอให้เป็นวันที่สดใสและมีความสุขกับการจัดการเรียนรู้นะครับ',
        icon: '☀️',
        glow: 'from-amber-500/20 to-indigo-500/20',
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        title: 'สวัสดีตอนบ่าย',
        subtext: 'ช่วงบ่ายของการสอน ขอให้การจัดการชั้นเรียนราบรื่นและมีพลัง',
        icon: '🌤️',
        glow: 'from-blue-500/20 to-purple-500/20',
      };
    }
    if (hour >= 17 && hour < 20) {
      return {
        title: 'สวัสดีตอนเย็น',
        subtext: 'ใกล้หมดวันแล้ว อย่าลืมตรวจเช็คความเรียบร้อยของคะแนนและการเช็คชื่อ',
        icon: '🌅',
        glow: 'from-orange-500/20 to-purple-500/20',
      };
    }
    return {
      title: 'สวัสดีตอนค่ำ',
      subtext: 'พักผ่อนให้เต็มที่เพื่อเตรียมพร้อมสำหรับการสอนในวันถัดไปนะครับ',
      icon: '🌙',
      glow: 'from-indigo-900/30 to-purple-900/30',
    };
  }, []);

  const exportAllData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export');
      const exportData = res.data.data;

      const toCSV = (rows: Record<string, any>[]) => {
        if (!rows || rows.length === 0) return '';
        const headers = Object.keys(rows[0]);
        const bom = '\uFEFF';
        const lines = [headers.join(',')];
        for (const row of rows) {
          lines.push(headers.map(h => {
            const val = String(row[h] ?? '').replace(/"/g, '""');
            return `"${val}"`;
          }).join(','));
        }
        return bom + lines.join('\n');
      };

      if (!(window as any).JSZip) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load JSZip script'));
          document.body.appendChild(script);
        });
      }
      const JSZip = (window as any).JSZip;
      const zip = new JSZip();

      if (exportData.classrooms?.length) zip.file('classrooms.csv', toCSV(exportData.classrooms));
      if (exportData.students?.length) zip.file('students.csv', toCSV(exportData.students));
      if (exportData.attendance?.length) zip.file('attendance.csv', toCSV(exportData.attendance));
      if (exportData.scores?.length) zip.file('scores.csv', toCSV(exportData.scores));
      if (exportData.schedules?.length) zip.file('schedules.csv', toCSV(exportData.schedules));
      if (exportData.timetable?.length) zip.file('timetable.csv', toCSV(exportData.timetable));

      const summary = `ระบบวางแผนการสอนอัจฉริยะ (Smart Lesson Planner)\nExported: ${exportData.exported_at}\n\n` +
        Object.entries(exportData.total_counts || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      zip.file('summary.txt', summary);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-lesson-planner-backup-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const { toast } = await import('react-hot-toast');
      toast.success(`สำรองข้อมูลสำเร็จ! รวม ${Object.values(exportData.total_counts || {}).reduce((a: number, b: any) => a + Number(b), 0)} รายการ`);
    } catch (err) {
      console.error('Export failed:', err);
      const { toast } = await import('react-hot-toast');
      toast.error('สำรองข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setExporting(false);
    }
  };

  // Filtered at-risk students
  const filteredRiskStudents = useMemo(() => {
    if (!data?.atRiskStudents) return [];
    return data.atRiskStudents.filter(student => {
      const matchType = riskFilter === 'all' || student.type === riskFilter;
      const matchSearch = searchRisk.trim() === '' ||
        student.student_name.toLowerCase().includes(searchRisk.toLowerCase()) ||
        student.classroom_name.toLowerCase().includes(searchRisk.toLowerCase()) ||
        (student.student_code && student.student_code.toLowerCase().includes(searchRisk.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [data?.atRiskStudents, riskFilter, searchRisk]);

  if (loading) {
    return (
      <div className="space-y-7 animate-fade-in-up">
        {/* Hero skeleton */}
        <div className="skeleton h-56 w-full rounded-3xl" />

        {/* Metric cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>

        {/* Content sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const todayClassesCount = data?.todayStats?.totalClasses || data?.todaySchedule?.length || 0;
  const checkedClassesCount = data?.todayStats?.checkedClasses || 0;
  const totalWeeklyHours = data?.todayStats?.totalWeeklyHours || 0;
  const pendingTasksCount = data?.pendingTasks?.length || 0;
  const atRiskCount = data?.atRiskStudents?.length || 0;
  const fRiskCount = data?.atRiskStudents?.filter(s => s.type === 'attendance_f').length || 0;
  const warningRiskCount = data?.atRiskStudents?.filter(s => s.type === 'attendance_warning').length || 0;

  const metricCards = [
    {
      title: 'ห้องเรียนทั้งหมด',
      value: data?.totalClassrooms || 0,
      unit: 'ห้อง',
      subtitle: 'จัดการกลุ่มเรียน & รายวิชา',
      icon: Presentation,
      gradient: 'from-indigo-500 to-indigo-700',
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      shadow: 'hover:shadow-indigo-500/10',
      accent: '#6366f1',
      link: '/classrooms',
    },
    {
      title: 'นักเรียนในระบบ',
      value: data?.totalStudents || 0,
      unit: 'คน',
      subtitle: 'บันทึกเวลาเรียน & ผลการเรียน',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-700',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      shadow: 'hover:shadow-emerald-500/10',
      accent: '#10b981',
      link: '/students',
    },
    {
      title: 'คาบสอนวันนี้',
      value: todayClassesCount,
      unit: 'คาบ',
      subtitle: `ภาระงานสอนสัปดาห์ ${totalWeeklyHours} ชม.`,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      shadow: 'hover:shadow-amber-500/10',
      accent: '#f59e0b',
      link: '/schedule',
    },
    {
      title: 'เช็คชื่อวันนี้',
      value: todayClassesCount > 0 ? `${checkedClassesCount}/${todayClassesCount}` : 'เรียบร้อย',
      unit: todayClassesCount > 0 ? 'ห้อง' : '🎉',
      subtitle: todayClassesCount > 0 && checkedClassesCount === todayClassesCount
        ? 'เช็คชื่อครบทุกคาบแล้ว'
        : todayClassesCount === 0
          ? 'ไม่มีคาบสอนตามตารางวันนี้'
          : `รอเช็คชื่ออีก ${todayClassesCount - checkedClassesCount} ห้อง`,
      icon: CheckCircle2,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-50 text-violet-600 border border-violet-100',
      shadow: 'hover:shadow-violet-500/10',
      accent: '#8b5cf6',
      link: '/attendance',
    },
  ];

  return (
    <div className="space-y-7 animate-fade-in-up pb-10">
      {/* ==================== HERO GREETING BANNER ==================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 text-white shadow-xl shadow-indigo-950/10 p-6 sm:p-8 lg:p-10">
        {/* Ambient Decorative Glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-indigo-100">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-300" />
              <span>{format(new Date(), 'EEEEที่ d MMMM yyyy', { locale: th })}</span>
              <span className="w-1 h-1 rounded-full bg-indigo-300" />
              <span className="text-white/80">ภาคเรียนปัจจุบัน</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">{greeting.icon}</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {greeting.title}, <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">คุณครู{user?.name || 'ผู้สอน'}</span>
              </h1>
            </div>

            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-light">
              {greeting.subtext}
            </p>

            {/* Quick Badges inside Hero */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <div className="px-3 py-1 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-white/90 flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5 text-amber-300" />
                <span>วันนี้มี <strong>{todayClassesCount}</strong> คาบสอน</span>
              </div>

              {pendingTasksCount > 0 ? (
                <div className="px-3 py-1 rounded-xl bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 text-xs text-amber-200 flex items-center gap-1.5 animate-pulse">
                  <BellRing className="w-3.5 h-3.5 text-amber-300" />
                  <span>เหลืองานที่ต้องทำ <strong>{pendingTasksCount}</strong> รายการ</span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-xs text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>ไม่มีงานค้างวันนี้</span>
                </div>
              )}

              {atRiskCount > 0 && (
                <div className="px-3 py-1 rounded-xl bg-rose-500/20 backdrop-blur-sm border border-rose-400/30 text-xs text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  <span>เฝ้าระวัง <strong>{atRiskCount}</strong> คน</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons inside Hero */}
          <div className="flex flex-wrap sm:flex-col lg:flex-row items-stretch gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              href="/attendance"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-semibold text-xs transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>เช็คชื่อด่วน</span>
            </Link>

            <Link
              href="/schedule"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/20 backdrop-blur-md transition-all hover:-translate-y-0.5"
            >
              <Calendar className="w-4 h-4 text-indigo-200" />
              <span>ดูตารางสอน</span>
            </Link>

            <button
              onClick={exportAllData}
              disabled={exporting}
              aria-label="สำรองข้อมูลทั้งระบบ"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/20 backdrop-blur-md transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-indigo-200" />}
              <span>{exporting ? 'กำลังสำรองข้อมูล...' : 'สำรองข้อมูล (ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================== 4 METRIC CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metricCards.map((card, i) => (
          <Link
            key={i}
            href={card.link}
            className={`stat-card group block transition-all duration-300 hover:-translate-y-1 ${card.shadow}`}
            style={{ '--card-accent': card.accent } as React.CSSProperties}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 ${card.iconBg}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center opacity-70 group-hover:opacity-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{card.title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{card.value}</span>
                <span className="text-xs font-medium text-slate-600">{card.unit}</span>
              </div>
              <p className="text-[0.72rem] text-slate-600 font-normal pt-1">{card.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ==================== TODAY'S TEACHING SCHEDULE ==================== */}
      <div className="glass p-6 sm:p-7 rounded-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                ตารางสอนประจำวันนี้
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {format(new Date(), 'EEEE', { locale: th })}
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                รายการคาบเรียนตามตารางสอนสำหรับวันนี้
              </p>
            </div>
          </div>

          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            <span>ดูตารางสอนเต็มสัปดาห์</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {data?.todaySchedule && data.todaySchedule.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.todaySchedule.map((entry, idx) => {
              const typeInfo = entryTypeConfig[entry.entry_type] || entryTypeConfig.lecture;
              return (
                <div
                  key={entry.id || idx}
                  className={`p-4 rounded-2xl border transition-all duration-300 hover:shadow-md flex flex-col justify-between ${
                    entry.is_attendance_checked
                      ? 'bg-white/80 border-emerald-200/80 shadow-emerald-500/5'
                      : 'bg-white/95 border-indigo-100/90 shadow-indigo-500/5 hover:border-indigo-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Period & Time */}
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>คาบที่ {entry.start_period === entry.end_period ? entry.start_period : `${entry.start_period}-${entry.end_period}`}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {entry.start_time} - {entry.end_time} น.
                      </span>
                    </div>

                    {/* Subject info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {entry.subject_code && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {entry.subject_code}
                          </span>
                        )}
                        <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${typeInfo.badge}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-1" title={entry.subject_name}>
                        {entry.subject_name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                        <span>🏫 {entry.room ? `ห้อง ${entry.room}` : 'ไม่ระบุห้อง'}</span>
                        {entry.group_name && <span>• 👥 {entry.group_name}</span>}
                        {entry.classroom_name && <span>• {entry.classroom_name}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {entry.is_attendance_checked ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>เช็คชื่อแล้ว</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>รอเช็คชื่อ</span>
                      </div>
                    )}

                    {entry.classroom_id ? (
                      <Link
                        href={`/attendance?classroom_id=${entry.classroom_id}`}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                          entry.is_attendance_checked
                            ? 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20'
                        }`}
                      >
                        <span>{entry.is_attendance_checked ? 'ดูข้อมูล' : 'เช็คชื่อทันที'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-[0.7rem] text-slate-600">ยังไม่ผูกห้องเรียน</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 px-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 text-2xl">
              ☕
            </div>
            <h3 className="text-sm font-bold text-slate-800">วันนี้ไม่มีคาบสอนตามตาราง</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              คุณครูสามารถใช้เวลานี้ในการเตรียมแผนการสอน บันทึกคะแนน หรือตรวจเช็คงานของนักเรียนได้ครับ
            </p>
            <div className="mt-4">
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-semibold transition-all shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>จัดการตารางสอนประจำสัปดาห์</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ==================== ACTION CENTER: PENDING TASKS & AT-RISK STUDENTS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <div className="glass p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    งานที่ต้องทำวันนี้
                    {pendingTasksCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {pendingTasksCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600">การเช็คชื่อและงานที่ยังไม่เสร็จสิ้น</p>
                </div>
              </div>
            </div>

            {data?.pendingTasks && data.pendingTasks.length > 0 ? (
              <div className="space-y-2.5">
                {data.pendingTasks.map((task, i) => (
                  <Link
                    key={i}
                    href={task.link}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100 hover:border-amber-300 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-900 group-hover:text-amber-950 truncate">
                          {task.message}
                        </p>
                        <p className="text-[0.68rem] text-amber-700">คลิกเพื่อดำเนินการทันที</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-800 group-hover:translate-x-0.5 transition-transform shrink-0">
                      <span>ทำเลย</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-emerald-900">ไม่มีงานค้างในวันนี้ 🎉</p>
                <p className="text-[0.72rem] text-emerald-700 mt-0.5">คุณครูเช็คชื่อและทำงานเรียบร้อยครบทุกรายการแล้วครับ</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/attendance"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <span>เปิดหน้าระบบเช็คชื่อทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* At-Risk Students Early Warning */}
        <div className="glass p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    นักเรียนกลุ่มเฝ้าระวัง
                    {atRiskCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        {atRiskCount} คน
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600">เวลาเรียนไม่ถึงเกณฑ์ หรือ เสี่ยงหมดสิทธิ์สอบ</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            {atRiskCount > 0 && (
              <div className="space-y-2.5 mb-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
                  <button
                    onClick={() => setRiskFilter('all')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                      riskFilter === 'all'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    ทั้งหมด ({atRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_f')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                      riskFilter === 'attendance_f'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    หมดสิทธิ์สอบ ({fRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_warning')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                      riskFilter === 'attendance_warning'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    เสี่ยง ({warningRiskCount})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchRisk}
                    onChange={(e) => setSearchRisk(e.target.value)}
                    placeholder="ค้นหาชื่อนักเรียน หรือห้องเรียน..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            )}

            {/* Student List */}
            {filteredRiskStudents.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredRiskStudents.slice(0, 8).map((student, i) => {
                  const isF = student.type === 'attendance_f';
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isF
                          ? 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70'
                          : 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-xs shrink-0 ${
                          isF ? 'bg-rose-100 border border-rose-200' : 'bg-amber-100 border border-amber-200'
                        }`}>
                          {animalAvatars[student.student_id % animalAvatars.length]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {student.student_name}
                            {student.student_code && (
                              <span className="ml-1 text-[0.68rem] text-slate-500 font-normal">
                                ({student.student_code})
                              </span>
                            )}
                          </p>
                          <p className="text-[0.68rem] text-slate-600 truncate">
                            {student.classroom_name} • <span className={`font-semibold ${isF ? 'text-rose-700' : 'text-amber-700'}`}>{student.reason}</span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                          isF ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {isF ? 'หมดสิทธิ์สอบ' : 'เตือน'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredRiskStudents.length > 8 && (
                  <p className="text-center text-[0.7rem] text-slate-500 pt-1">
                    ...และอีก {filteredRiskStudents.length - 8} คน (ดูทั้งหมดได้ในหน้าระบบเช็คชื่อ)
                  </p>
                )}
              </div>
            ) : atRiskCount > 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                ไม่พบนักเรียนตามเงื่อนไขที่ค้นหา
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-emerald-900">ยอดเยี่ยมมาก! ไม่มีนักเรียนกลุ่มเสี่ยง</p>
                <p className="text-[0.72rem] text-emerald-700 mt-0.5">นักเรียนทุกคนมีเวลาเรียนตามเกณฑ์ที่กำหนด</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/grades"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <span>ดูรายงานผลการเรียนและการตัดเกรด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ==================== UPCOMING TEACHING SCHEDULE & QUICK ACTIONS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Teaching Plans */}
        <div className="lg:col-span-2 glass p-6 sm:p-7 rounded-3xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  กำหนดการสอนที่จะมาถึง
                </h2>
                <p className="text-xs text-slate-600">แผนและหัวข้อการสอนที่นัดหมายไว้ล่วงหน้า</p>
              </div>
            </div>

            <Link
              href="/schedule"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              เพิ่มกำหนดการ
            </Link>
          </div>

          {data?.upcomingSchedules && data.upcomingSchedules.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingSchedules.map((s, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/80 border border-indigo-100/70 hover:border-indigo-200 flex items-center gap-4 transition-all hover:shadow-sm"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-500/10 shrink-0">
                    <span className="text-[0.55rem] uppercase font-bold tracking-wider text-indigo-200">
                      {format(new Date(s.scheduled_date), 'MMM', { locale: th })}
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold leading-none">
                      {format(new Date(s.scheduled_date), 'd')}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {s.lesson_title || 'ไม่มีชื่อหัวข้อ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {s.subject} • {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)} น.
                    </p>
                  </div>

                  <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    s.status === 'scheduled'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : s.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {s.status === 'scheduled' ? 'รอสอน' : s.status === 'completed' ? 'สอนแล้ว' : 'ยกเลิก'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 bg-slate-50/60 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">ยังไม่มีกำหนดการสอนที่นัดหมายไว้</p>
              <p className="text-[0.72rem] text-slate-500 mt-0.5">คุณครูสามารถเพิ่มแผนและกำหนดการสอนลงในปฏิทินได้เลย</p>
              <Link
                href="/schedule"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <span>เพิ่มกำหนดการสอน</span>
              </Link>
            </div>
          )}
        </div>

        {/* Quick Menu Access Hub */}
        <div className="glass p-6 sm:p-7 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  ทางลัดระบบงาน
                </h2>
                <p className="text-xs text-slate-600">เข้าถึงเครื่องมือหลักได้อย่างรวดเร็ว</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              <Link
                href="/attendance"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-indigo-100/60 hover:border-indigo-300 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">ระบบเช็คชื่อ</p>
                    <p className="text-[0.68rem] text-slate-500">บันทึกเวลาเรียน ขาด ลา มา สาย</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/scores"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-indigo-100/60 hover:border-indigo-300 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">คะแนนเก็บรายสัปดาห์</p>
                    <p className="text-[0.68rem] text-slate-500">บันทึกคะแนนเก็บและแบบทดสอบ</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/affective"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-indigo-100/60 hover:border-indigo-300 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">คะแนนจิตพิสัย</p>
                    <p className="text-[0.68rem] text-slate-500">ประเมินพฤติกรรมและการมีส่วนร่วม</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/grades"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-indigo-100/60 hover:border-indigo-300 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">ตัดเกรด & ประเมินผล</p>
                    <p className="text-[0.68rem] text-slate-500">คำนวณเกรดเฉลี่ยและส่งออกรายงาน</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/70 text-center">
            <p className="text-[0.72rem] text-slate-600 font-medium">ต้องการคำแนะนำการใช้งานหรือความช่วยเหลือ?</p>
            <p className="text-[0.68rem] text-indigo-600 font-bold mt-0.5">ระบบพร้อมช่วยเหลือและบันทึกข้อมูลอัตโนมัติ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
