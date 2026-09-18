'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import UserAvatar from '@/components/UserAvatar';
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
  CalendarDays,
  XCircle,
  Clock3,
  Flame,
  TrendingUp,
  X,
  ExternalLink,
  ShieldAlert,
  Compass
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface DashboardData {
  totalClassrooms: number;
  totalStudents: number;
  isSemesterEnded?: boolean;
  activeSemester?: {
    id: number;
    name: string;
    term_number: number;
    academic_year: string;
    is_active: boolean;
  } | null;
  todayStats?: {
    totalClasses: number;
    checkedClasses: number;
    totalWeeklyHours: number;
    todayAttendanceRate: number | null;
    isSemesterEnded?: boolean;
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
    avatar?: string | null;
  }>;
  pendingTasks?: Array<{
    type: string;
    classroom_name: string;
    message: string;
    link: string;
  }>;
}

const entryTypeConfig: Record<string, { label: string; badge: string; border: string; dot: string }> = {
  lecture: {
    label: 'ทฤษฎี',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    border: 'border-indigo-500',
    dot: 'bg-indigo-500'
  },
  lab: {
    label: 'ปฏิบัติ',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    border: 'border-emerald-500',
    dot: 'bg-emerald-500'
  },
  activity: {
    label: 'กิจกรรม',
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    border: 'border-amber-500',
    dot: 'bg-amber-500'
  },
  homeroom: {
    label: 'โฮมรูม',
    badge: 'bg-purple-50 text-purple-700 border-purple-200/80',
    border: 'border-purple-500',
    dot: 'bg-purple-500'
  },
};

const teacherQuotes = [
  '“การสอนที่ดีไม่ใช่แค่การถ่ายทอดความรู้ แต่คือการจุดประกายความคิด”',
  '“ทุกความพยายามในการสอนของคุณครู กำลังสร้างอนาคตของเด็กทุกคน”',
  '“เริ่มต้นวันใหม่ด้วยพลังบวก เพื่อชั้นเรียนที่มีความสุขและมีชีวิตชีวา”',
  '“การจัดการชั้นเรียนที่ดี ช่วยสร้างบรรยากาศแห่งการเรียนรู้อย่างยั่งยืน”',
];

function LiveClock() {
  const [time, setTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hours}:${mins}:${secs} น.`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="min-w-[85px]">{time || '--:--:-- น.'}</span>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<'all' | 'attendance_f' | 'attendance_warning'>('all');
  const [searchRisk, setSearchRisk] = useState('');

  // Fetch Dashboard Data
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
        subtext: 'ขอให้เป็นเช้าที่สดใส เปี่ยมด้วยพลังและความสุขในการจัดการเรียนรู้นะครับ',
        icon: '☀️',
        quote: teacherQuotes[0],
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        title: 'สวัสดีตอนบ่าย',
        subtext: 'ช่วงบ่ายของการสอน ขอให้การจัดกิจกรรมในชั้นเรียนราบรื่นและมีชีวิตชีวา',
        icon: '🌤️',
        quote: teacherQuotes[1],
      };
    }
    if (hour >= 17 && hour < 20) {
      return {
        title: 'สวัสดีตอนเย็น',
        subtext: 'ใกล้หมดวันแล้ว อย่าลืมตรวจเช็คความเรียบร้อยของคะแนนและการเช็คชื่อนะครับ',
        icon: '🌅',
        quote: teacherQuotes[2],
      };
    }
    return {
      title: 'สวัสดีตอนค่ำ',
      subtext: 'พักผ่อนให้เต็มที่เพื่อเตรียมพร้อมสำหรับการจัดการเรียนรู้ในวันถัดไปนะครับ',
      icon: '🌙',
      quote: teacherQuotes[3],
    };
  }, []);

  // Backup Export
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

  // If loading: Render high-fidelity 1:1 skeleton matching the EXACT layout to eliminate CLS!
  if (loading) {
    return <DashboardSkeleton />;
  }

  const isSemesterEnded = Boolean(data?.isSemesterEnded);
  const todayClassesCount = data?.todayStats?.totalClasses || data?.todaySchedule?.length || 0;
  const checkedClassesCount = data?.todayStats?.checkedClasses || 0;
  const totalWeeklyHours = data?.todayStats?.totalWeeklyHours || 0;
  const pendingTasksCount = data?.pendingTasks?.length || 0;
  const atRiskCount = data?.atRiskStudents?.length || 0;
  const fRiskCount = data?.atRiskStudents?.filter(s => s.type === 'attendance_f').length || 0;
  const warningRiskCount = data?.atRiskStudents?.filter(s => s.type === 'attendance_warning').length || 0;
  const attendanceRate = data?.todayStats?.todayAttendanceRate ?? null;

  // Completion calculation for attendance progress
  const attendancePercent = todayClassesCount > 0
    ? Math.round((checkedClassesCount / todayClassesCount) * 100)
    : 100;

  const metricCards = [
    {
      title: 'ห้องเรียนทั้งหมด',
      value: data?.totalClassrooms || 0,
      unit: 'ห้อง',
      subtitle: 'จัดการกลุ่มเรียน & รายวิชา',
      icon: Presentation,
      gradient: 'from-indigo-500 to-indigo-700',
      iconBg: 'bg-indigo-50/90 text-indigo-600 border border-indigo-100',
      accent: '#6366f1',
      link: '/classrooms',
      badgeText: isSemesterEnded ? 'ครบภาคเรียน' : 'เปิดใช้งาน',
      badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200/60',
    },
    {
      title: 'นักเรียนในระบบ',
      value: data?.totalStudents || 0,
      unit: 'คน',
      subtitle: 'บันทึกเวลาเรียน & ผลการเรียน',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-700',
      iconBg: 'bg-emerald-50/90 text-emerald-600 border border-emerald-100',
      accent: '#10b981',
      link: '/students',
      badgeText: 'ข้อมูลล่าสุด',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    },
    {
      title: 'คาบสอนวันนี้',
      value: todayClassesCount,
      unit: 'คาบ',
      subtitle: isSemesterEnded
        ? 'สิ้นสุดการสอนประจำภาคเรียนแล้ว'
        : `ภาระงานสอนรวม ${totalWeeklyHours} ชม./สัปดาห์`,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-50/90 text-amber-600 border border-amber-100',
      accent: '#f59e0b',
      link: '/schedule',
      badgeText: isSemesterEnded ? 'สิ้นสุดภาคเรียน' : (todayClassesCount > 0 ? 'มีตารางสอน' : 'ไม่มีสอน'),
      badgeColor: isSemesterEnded
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
        : (todayClassesCount > 0 ? 'text-amber-700 bg-amber-50 border-amber-200/60' : 'text-slate-600 bg-slate-100 border-slate-200'),
    },
    {
      title: 'เช็คชื่อวันนี้',
      value: isSemesterEnded ? 'เรียบร้อย' : (todayClassesCount > 0 ? `${checkedClassesCount}/${todayClassesCount}` : 'เรียบร้อย'),
      unit: isSemesterEnded || todayClassesCount === 0 ? '🎉' : 'ห้อง',
      subtitle: isSemesterEnded
        ? 'สิ้นสุดการเช็คชื่อของภาคเรียนนี้แล้ว'
        : (todayClassesCount > 0 && checkedClassesCount === todayClassesCount
            ? 'เช็คชื่อครบถ้วนทุกคาบแล้ว'
            : (todayClassesCount === 0
                ? 'ไม่มีคาบสอนตามตารางวันนี้'
                : `รอเช็คชื่ออีก ${todayClassesCount - checkedClassesCount} ห้องเรียน`)),
      icon: CheckCircle2,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-50/90 text-violet-600 border border-violet-100',
      accent: '#8b5cf6',
      link: '/attendance',
      badgeText: isSemesterEnded ? 'ครบถ้วน' : `${attendancePercent}%`,
      badgeColor: (isSemesterEnded || (checkedClassesCount === todayClassesCount && todayClassesCount > 0))
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
        : 'text-violet-700 bg-violet-50 border-violet-200/60',
      progressBar: (!isSemesterEnded && todayClassesCount > 0) ? attendancePercent : null,
    },
  ];

  return (
    <div className="space-y-7 pb-10">
      {/* ==================== HERO GREETING BANNER ==================== */}
      <section
        aria-label="สรุปภาพรวมและข้อมูลต้อนรับ"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-950 text-white shadow-xl shadow-indigo-950/15 p-6 sm:p-8 lg:p-10 border border-white/10 animate-fade-in-up"
      >
        {/* Ambient Decorative Light Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/25 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-400/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            {/* Top Date & Live Clock Pill with Zero CLS */}
            <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-indigo-100 shadow-xs">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-300" />
                <span>{format(new Date(), 'EEEEที่ d MMMM yyyy', { locale: th })}</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-indigo-300/80" />
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-indigo-200">
                <Clock className="w-3 h-3 text-indigo-300" />
                <LiveClock />
              </div>
              {data?.activeSemester ? (
                <Link
                  href="/semesters"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[0.72rem] font-bold border border-white/20 transition-colors group/sem"
                  title="จัดการภาคเรียน"
                >
                  <Layers className="w-3 h-3 text-indigo-300" />
                  <span>{data.activeSemester.name}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-indigo-300 group-hover/sem:translate-x-0.5 transition-transform" />
                </Link>
              ) : isSemesterEnded ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[0.68rem] font-bold">
                  สิ้นสุดภาคเรียนแล้ว 🎉
                </span>
              ) : (
                <span className="text-white/80">ภาคเรียนปัจจุบัน</span>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="ระบบเชื่อมต่อปกติ" />
            </div>

            {/* Greeting Header */}
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl select-none animate-float">{greeting.icon}</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {greeting.title}, <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent inline-block min-w-[100px]">คุณครู{user?.name || 'ผู้สอน'}</span>
              </h1>
            </div>

            {/* Teacher Subtitle & Motivational Quote */}
            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-normal">
              {isSemesterEnded
                ? 'ขอแสดงความยินดีกับคุณครูที่จัดการเรียนรู้และสอนเสร็จสิ้นครบถ้วนตลอดทั้งภาคเรียนแล้วครับ'
                : greeting.subtext}
            </p>
            <p className="text-xs text-indigo-200/75 italic font-light">
              {greeting.quote}
            </p>

            {/* Quick Micro-Badges with stable min-height */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {isSemesterEnded ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/25 backdrop-blur-sm border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2 shadow-xs">
                  <Award className="w-3.5 h-3.5 text-emerald-300" />
                  <span>สิ้นสุดการเรียนการสอนภาคเรียนนี้แล้ว</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-white/95 flex items-center gap-2 shadow-xs transition-all hover:bg-white/15">
                  <Clock3 className="w-3.5 h-3.5 text-amber-300" />
                  <span>วันนี้มี <strong>{todayClassesCount}</strong> คาบสอน</span>
                </div>
              )}

              {pendingTasksCount > 0 ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/25 backdrop-blur-sm border border-amber-400/40 text-xs text-amber-200 flex items-center gap-2 shadow-xs transition-all hover:bg-amber-500/35">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>งานที่ต้องทำ <strong>{pendingTasksCount}</strong> รายการ</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/25 backdrop-blur-sm border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>ไม่มีงานค้างวันนี้</span>
                </div>
              )}

              {atRiskCount > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/25 backdrop-blur-sm border border-rose-400/40 text-xs text-rose-200 flex items-center gap-2 shadow-xs transition-all hover:bg-rose-500/35">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  <span>เฝ้าระวัง <strong>{atRiskCount}</strong> คน</span>
                </div>
              )}

              {attendanceRate !== null && !isSemesterEnded && (
                <div className="px-3 py-1.5 rounded-xl bg-violet-500/25 backdrop-blur-sm border border-violet-400/40 text-xs text-violet-200 flex items-center gap-2 shadow-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-300" />
                  <span>เข้าเรียนวันนี้ <strong>{attendanceRate}%</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons inside Hero */}
          <div className="flex flex-wrap sm:flex-col lg:flex-row items-stretch gap-2.5 w-full sm:w-auto shrink-0 pt-2 lg:pt-0">
            {isSemesterEnded ? (
              <Link
                href="/grades"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <Award className="w-4 h-4 text-purple-600 transition-transform duration-300 group-hover:scale-110" />
                <span>ตัดเกรด & ประเมินผล</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/attendance"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                <span>เช็คชื่อด่วน</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            )}

            <Link
              href="/schedule"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 backdrop-blur-md transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <Calendar className="w-4 h-4 text-indigo-200 transition-transform duration-300 group-hover:scale-110" />
              <span>ดูตารางสอน</span>
            </Link>

            <button
              onClick={exportAllData}
              disabled={exporting}
              aria-label="สำรองข้อมูลทั้งระบบเป็นไฟล์ ZIP"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 backdrop-blur-md transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-indigo-200" />
              )}
              <span>{exporting ? 'กำลังสำรองข้อมูล...' : 'สำรองข้อมูล (ZIP)'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================== 4 METRIC BENTO CARDS ==================== */}
      <section
        aria-label="ตัวชี้วัดสำคัญของระบบ"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {metricCards.map((card, i) => (
          <Link
            key={i}
            href={card.link}
            className="stat-card group block transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 active:translate-y-0"
            style={{ '--card-accent': card.accent } as React.CSSProperties}
          >
            {/* Top row: Icon and Badge / Arrow */}
            <div className="flex items-start justify-between mb-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 ${card.iconBg}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}>
                  {card.badgeText}
                </span>
                <div className="w-7 h-7 rounded-xl bg-slate-100/90 text-slate-600 flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-12">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Middle: Title & Value */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 tracking-wide">{card.title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-mono tabular-nums">{card.value}</span>
                <span className="text-xs font-semibold text-slate-600">{card.unit}</span>
              </div>
              <p className="text-[0.72rem] text-slate-600 font-normal pt-0.5 line-clamp-1">{card.subtitle}</p>
            </div>

            {/* Optional Progress Bar for Attendance */}
            {card.progressBar !== null && card.progressBar !== undefined && (
              <div className="mt-3 pt-2.5 border-t border-slate-100/80">
                <div className="flex items-center justify-between text-[0.68rem] text-slate-600 font-medium mb-1">
                  <span>ความก้าวหน้า</span>
                  <span className="font-bold text-violet-700">{card.progressBar}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 ease-out"
                    style={{ width: `${card.progressBar}%` }}
                  />
                </div>
              </div>
            )}
          </Link>
        ))}
      </section>

      {/* ==================== TODAY'S TEACHING SCHEDULE ==================== */}
      <section
        aria-label="ตารางสอนประจำวันนี้"
        className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 shadow-xs hover:shadow-md transition-all duration-300"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs transition-transform duration-300 hover:scale-105">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  ตารางสอนประจำวันนี้
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700 border border-indigo-200/60">
                  {format(new Date(), 'EEEE', { locale: th })}
                </span>
                {todayClassesCount > 0 && (
                  <span className="hidden sm:inline-block text-xs font-medium text-slate-600">
                    ({todayClassesCount} คาบ)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                รายการคาบเรียนตามตารางสอนสำหรับวันนี้ พร้อมสถานะการเช็คชื่อ
              </p>
            </div>
          </div>

          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-50/80 transition-all duration-200 group"
          >
            <span>ดูตารางสอนเต็มสัปดาห์</span>
            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Schedule Cards Grid or Semester Concluded Banner */}
        {data?.todaySchedule && data.todaySchedule.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.todaySchedule.map((entry, idx) => {
              const typeInfo = entryTypeConfig[entry.entry_type] || entryTypeConfig.lecture;
              return (
                <div
                  key={entry.id || idx}
                  className={`p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg flex flex-col justify-between group relative overflow-hidden ${
                    entry.is_attendance_checked
                      ? 'bg-gradient-to-br from-white via-white to-emerald-50/30 border-emerald-200/90 shadow-emerald-500/5'
                      : 'bg-white/95 border-indigo-100/90 shadow-indigo-500/5 hover:border-indigo-300'
                  }`}
                >
                  {/* Left Accent Bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${entry.is_attendance_checked ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                  <div className="space-y-3 pl-1.5">
                    {/* Period & Time header */}
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>คาบที่ {entry.start_period === entry.end_period ? entry.start_period : `${entry.start_period}-${entry.end_period}`}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 font-mono tabular-nums">
                        {entry.start_time} - {entry.end_time} น.
                      </span>
                    </div>

                    {/* Subject info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {entry.subject_code && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {entry.subject_code}
                          </span>
                        )}
                        <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full border ${typeInfo.badge}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={entry.subject_name}>
                        {entry.subject_name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                        <span>🏫 {entry.room ? `ห้อง ${entry.room}` : 'ไม่ระบุห้อง'}</span>
                        {entry.group_name && <span>• 👥 {entry.group_name}</span>}
                        {entry.classroom_name && <span>• {entry.classroom_name}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Status & CTA Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between pl-1.5">
                    {entry.is_attendance_checked ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>เช็คชื่อแล้ว</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200/80">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>รอเช็คชื่อ</span>
                      </div>
                    )}

                    {entry.classroom_id ? (
                      <Link
                        href={`/attendance?classroom_id=${entry.classroom_id}`}
                        className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-200 ${
                          entry.is_attendance_checked
                            ? 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:scale-[1.02]'
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
        ) : isSemesterEnded ? (
          /* Celebratory Semester Concluded Card */
          <div className="text-center py-10 px-6 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 rounded-2xl border border-indigo-100/90 shadow-xs min-h-[190px] flex flex-col items-center justify-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600 text-white shadow-md shadow-emerald-500/20 flex items-center justify-center mb-3 text-3xl animate-float">
              🎓
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold mb-2 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>สิ้นสุดการเรียนการสอนประจำภาคเรียนนี้แล้ว</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-800">
              ยินดีด้วยครับคุณครู การสอนตามตารางเสร็จสิ้นสมบูรณ์แล้ว 🎉
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-lg mx-auto leading-relaxed">
              ขณะนี้สิ้นสุดช่วงเวลาการสอนตามตารางของภาคเรียนเรียบร้อยแล้ว คุณครูสามารถใช้เวลานี้ในการตรวจสอบคะแนนเก็บ บันทึกคะแนนจิตพิสัย และดำเนินการตัดเกรดเพื่อออกรายงานผลการเรียนครับ
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/grades"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <Award className="w-4 h-4" />
                <span>ไปที่ระบบตัดเกรด & ประเมินผล</span>
              </Link>
              <Link
                href="/scores"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition-all shadow-xs hover:shadow-sm hover:-translate-y-0.5"
              >
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <span>ตรวจสอบคะแนนเก็บ</span>
              </Link>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>ดูตารางสอนภาพรวม</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Daily Coffee Break State */
          <div className="text-center py-10 px-4 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 rounded-2xl border border-indigo-100/70 min-h-[180px] flex flex-col items-center justify-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center mb-3 text-2xl animate-float">
              ☕
            </div>
            <h3 className="text-sm font-bold text-slate-800">วันนี้ไม่มีคาบสอนตามตาราง</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              คุณครูสามารถใช้เวลานี้ในการเตรียมแผนการสอน บันทึกคะแนนจิตพิสัย หรือตรวจเช็คงานของนักเรียนได้ครับ
            </p>
            <div className="mt-4">
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all shadow-xs hover:shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>จัดการตารางสอนประจำสัปดาห์</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ==================== ACTION CENTER: PENDING TASKS & AT-RISK STUDENTS ==================== */}
      <section
        aria-label="ศูนย์การแจ้งเตือนและนักเรียนกลุ่มเสี่ยง"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Card 1: Pending Tasks */}
        <div className="glass p-6 rounded-3xl border border-indigo-100/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    งานที่ต้องทำวันนี้
                    {pendingTasksCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {pendingTasksCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600">การเช็คชื่อและงานที่ยังค้างอยู่ในระบบ</p>
                </div>
              </div>
            </div>

            {/* Stable height container to completely avoid CLS */}
            <div className="min-h-[220px]">
              {data?.pendingTasks && data.pendingTasks.length > 0 ? (
                <div className="space-y-2.5">
                  {data.pendingTasks.map((task, i) => (
                    <Link
                      key={i}
                      href={task.link}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:bg-amber-100/80 hover:border-amber-300 transition-all duration-200 group shadow-xs"
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
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-800 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
                        <span>ทำเลย</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 min-h-[220px] flex flex-col items-center justify-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-emerald-900">ไม่มีงานค้างในวันนี้ 🎉</p>
                  <p className="text-[0.72rem] text-emerald-700 mt-1 max-w-xs">
                    {isSemesterEnded
                      ? 'คุณครูได้ตรวจสอบการเช็คชื่อและทำงานเรียบร้อยตลอดทั้งภาคเรียนแล้วครับ'
                      : 'คุณครูเช็คชื่อและทำงานเรียบร้อยครบทุกรายการแล้วครับ'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/attendance"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all"
            >
              <span>เปิดหน้าระบบเช็คชื่อทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: At-Risk Students Early Warning */}
        <div className="glass p-6 rounded-3xl border border-indigo-100/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    นักเรียนกลุ่มเฝ้าระวัง
                    {atRiskCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {atRiskCount} คน
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600">เวลาเรียนไม่ถึงเกณฑ์ หรือ เสี่ยงหมดสิทธิ์สอบ</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            {atRiskCount > 0 && (
              <div className="space-y-2.5 mb-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
                  <button
                    onClick={() => setRiskFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      riskFilter === 'all'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    ทั้งหมด ({atRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_f')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      riskFilter === 'attendance_f'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    หมดสิทธิ์ ({fRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_warning')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      riskFilter === 'attendance_warning'
                        ? 'bg-amber-600 text-white shadow-xs'
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
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                  {searchRisk && (
                    <button
                      onClick={() => setSearchRisk('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Stable Height Scrollable Container: Eliminates Layout Shifts (CLS) */}
            <div className="min-h-[220px] max-h-[220px] overflow-y-auto pr-1">
              {filteredRiskStudents.length > 0 ? (
                <div className="space-y-2">
                  {filteredRiskStudents.map((student, i) => {
                    const isF = student.type === 'attendance_f';
                    return (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-xs ${
                          isF
                            ? 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70'
                            : 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            avatar={student.avatar}
                            name={student.student_name}
                            userId={student.student_id}
                            size="sm"
                            className="rounded-xl border border-indigo-200 shadow-xs shrink-0"
                          />
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
                </div>
              ) : atRiskCount > 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-xs text-slate-500">
                  <Search className="w-5 h-5 text-slate-300 mb-1" />
                  <span>ไม่พบนักเรียนตามคำค้นหา</span>
                </div>
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-emerald-900">ยอดเยี่ยมมาก! ไม่มีนักเรียนกลุ่มเสี่ยง</p>
                  <p className="text-[0.72rem] text-emerald-700 mt-1 max-w-xs">
                    นักเรียนทุกคนมีเวลาเรียนครบถ้วนตามเกณฑ์ที่กำหนด
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/grades"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all"
            >
              <span>ดูรายงานผลการเรียนและการตัดเกรด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== UPCOMING TEACHING SCHEDULE & QUICK ACTIONS ==================== */}
      <section
        aria-label="กำหนดการสอนที่จะมาถึงและทางลัดระบบ"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Upcoming Teaching Plans (2 Cols) */}
        <div className="lg:col-span-2 glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs">
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
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
            >
              <span>เพิ่มกำหนดการ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {data?.upcomingSchedules && data.upcomingSchedules.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingSchedules.map((s, i) => (
                <div
                  key={i}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white/85 border border-indigo-100/70 hover:border-indigo-300 flex items-center gap-4 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-500/10 shrink-0">
                    <span className="text-[0.55rem] uppercase font-bold tracking-wider text-indigo-200">
                      {format(new Date(s.scheduled_date), 'MMM', { locale: th })}
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold leading-none font-mono tabular-nums">
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
          ) : isSemesterEnded ? (
            <div className="text-center py-10 px-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/80 min-h-[200px] flex flex-col items-center justify-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-800">ไม่มีกำหนดการสอนค้างอยู่ (สิ้นสุดภาคเรียนแล้ว)</p>
              <p className="text-[0.72rem] text-slate-600 mt-0.5 max-w-sm">
                คุณครูจัดการเรียนการสอนครบถ้วนตามแผนของภาคเรียนนี้เรียบร้อยแล้วครับ
              </p>
              <Link
                href="/schedule"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold transition-all shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>ดูปฏิทินและแผนการสอน</span>
              </Link>
            </div>
          ) : (
            <div className="text-center py-10 px-4 bg-slate-50/70 rounded-2xl border border-slate-100 min-h-[200px] flex flex-col items-center justify-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2 shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">ยังไม่มีกำหนดการสอนที่นัดหมายไว้</p>
              <p className="text-[0.72rem] text-slate-500 mt-0.5">คุณครูสามารถเพิ่มแผนและกำหนดการสอนลงในปฏิทินได้เลย</p>
              <Link
                href="/schedule"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs"
              >
                <span>เพิ่มกำหนดการสอน</span>
              </Link>
            </div>
          )}
        </div>

        {/* Quick Menu Access Hub (1 Col) */}
        <div className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs">
                <Compass className="w-5 h-5" />
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
                href="/semesters"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/75 border border-indigo-100/60 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">ภาคเรียน & ปีการศึกษา</p>
                    <p className="text-[0.68rem] text-slate-500">จัดการเทอม 1 / เทอม 2 และคัดลอกข้อมูล</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/attendance"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/75 border border-indigo-100/60 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all duration-200 group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">ระบบเช็คชื่อ</p>
                    <p className="text-[0.68rem] text-slate-500">บันทึกเวลาเรียน ขาด ลา มา สาย</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/scores"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/75 border border-indigo-100/60 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">คะแนนเก็บรายสัปดาห์</p>
                    <p className="text-[0.68rem] text-slate-500">บันทึกคะแนนเก็บและแบบทดสอบ</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/affective"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/75 border border-indigo-100/60 hover:border-amber-300 hover:bg-amber-50/30 transition-all duration-200 group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors">คะแนนจิตพิสัย</p>
                    <p className="text-[0.68rem] text-slate-500">ประเมินพฤติกรรมและการมีส่วนร่วม</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/grades"
                className="flex items-center justify-between p-3 rounded-2xl bg-white/75 border border-indigo-100/60 hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-200 group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">ตัดเกรด & ประเมินผล</p>
                    <p className="text-[0.68rem] text-slate-500">คำนวณเกรดเฉลี่ยและส่งออกรายงาน</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/70 text-center">
            <p className="text-[0.72rem] text-slate-600 font-medium">ต้องการความช่วยเหลือหรือคำแนะนำ?</p>
            <p className="text-[0.68rem] text-indigo-600 font-bold mt-0.5">ระบบบันทึกและซิงค์ข้อมูลให้โดยอัตโนมัติ</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==================== 1:1 ZERO-CLS SKELETON COMPONENT ====================
// This component mirrors every single block, padding, grid dimension, and height of the actual Dashboard
// to ensure Cumulative Layout Shift (CLS) = 0!
function DashboardSkeleton() {
  return (
    <div className="space-y-7 pb-10 animate-fade-in-up" aria-busy="true" aria-label="กำลังโหลดข้อมูลแดชบอร์ด">
      {/* 1. Hero Skeleton */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/90 via-indigo-800/90 to-purple-950/90 p-6 sm:p-8 lg:p-10 border border-white/10 min-h-[260px] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3.5 max-w-2xl w-full">
          {/* Top Pill skeleton */}
          <div className="skeleton h-7 w-64 rounded-full" />
          {/* Title skeleton */}
          <div className="skeleton h-10 w-80 rounded-2xl" />
          {/* Subtitle skeleton */}
          <div className="skeleton h-5 w-full max-w-lg rounded-xl" />
          {/* Badges skeleton */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="skeleton h-8 w-32 rounded-xl" />
            <div className="skeleton h-8 w-36 rounded-xl" />
            <div className="skeleton h-8 w-28 rounded-xl" />
          </div>
        </div>
        {/* Buttons skeleton */}
        <div className="flex flex-wrap sm:flex-col lg:flex-row gap-2.5 w-full sm:w-auto shrink-0">
          <div className="skeleton h-10 w-28 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* 2. Metric Bento Cards Skeleton (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass p-6 rounded-3xl min-h-[148px] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="skeleton w-12 h-12 rounded-2xl" />
              <div className="skeleton w-14 h-5 rounded-full" />
            </div>
            <div className="space-y-2 mt-4">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-8 w-24 rounded-lg" />
              <div className="skeleton h-3 w-36 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Today's Schedule Skeleton (Full Width) */}
      <div className="glass p-6 sm:p-7 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="skeleton w-11 h-11 rounded-2xl" />
            <div className="space-y-1.5">
              <div className="skeleton h-5 w-44 rounded-lg" />
              <div className="skeleton h-3 w-56 rounded" />
            </div>
          </div>
          <div className="skeleton h-4 w-32 rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-2xl border border-indigo-100/60 bg-white/70 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="skeleton h-5 w-20 rounded-lg" />
                  <div className="skeleton h-4 w-24 rounded" />
                </div>
                <div className="skeleton h-4 w-32 rounded mt-2" />
                <div className="skeleton h-5 w-48 rounded" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="skeleton h-6 w-20 rounded-xl" />
                <div className="skeleton h-7 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action Center Skeleton (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending tasks skeleton */}
        <div className="glass p-6 rounded-3xl min-h-[310px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="skeleton w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5">
                <div className="skeleton h-5 w-32 rounded-lg" />
                <div className="skeleton h-3 w-40 rounded" />
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="skeleton h-14 w-full rounded-2xl" />
              <div className="skeleton h-14 w-full rounded-2xl" />
            </div>
          </div>
          <div className="skeleton h-8 w-full rounded-xl mt-4" />
        </div>

        {/* At-Risk students skeleton */}
        <div className="glass p-6 rounded-3xl min-h-[310px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="skeleton w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5">
                <div className="skeleton h-5 w-36 rounded-lg" />
                <div className="skeleton h-3 w-44 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="skeleton h-8 w-full rounded-xl mb-2" />
              <div className="skeleton h-12 w-full rounded-xl" />
              <div className="skeleton h-12 w-full rounded-xl" />
            </div>
          </div>
          <div className="skeleton h-8 w-full rounded-xl mt-4" />
        </div>
      </div>

      {/* 5. Upcoming Schedules & Quick Actions Skeleton (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1-2: Upcoming */}
        <div className="lg:col-span-2 glass p-6 sm:p-7 rounded-3xl min-h-[260px]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="skeleton w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5">
                <div className="skeleton h-5 w-40 rounded-lg" />
                <div className="skeleton h-3 w-48 rounded" />
              </div>
            </div>
            <div className="skeleton h-4 w-20 rounded" />
          </div>
          <div className="space-y-3">
            <div className="skeleton h-16 w-full rounded-2xl" />
            <div className="skeleton h-16 w-full rounded-2xl" />
          </div>
        </div>

        {/* Col 3: Quick shortcuts */}
        <div className="glass p-6 sm:p-7 rounded-3xl min-h-[260px] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-5">
            <div className="skeleton w-10 h-10 rounded-2xl" />
            <div className="space-y-1.5">
              <div className="skeleton h-5 w-28 rounded-lg" />
              <div className="skeleton h-3 w-36 rounded" />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
