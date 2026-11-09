'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import UserAvatar from '@/components/UserAvatar';
import {
  Presentation,
  Users,
  Calendar,
  Clock,
  Loader2,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  ArrowRight,
  BellRing,
  ChevronRight,
  Smile,
  CheckSquare,
  Award,
  Layers,
  CalendarDays,
  Clock3,
  TrendingUp,
  X,
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
    label: 'à¸—à¸¤à¸©à¸Žà¸µ',
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
    border: 'border-indigo-500',
    dot: 'bg-indigo-500'
  },
  lab: {
    label: 'à¸›à¸à¸´à¸šà¸±à¸•à¸´',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    border: 'border-emerald-500',
    dot: 'bg-emerald-500'
  },
  activity: {
    label: 'à¸à¸´à¸ˆà¸à¸£à¸£à¸¡',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    border: 'border-amber-500',
    dot: 'bg-amber-500'
  },
  homeroom: {
    label: 'à¹‚à¸®à¸¡à¸£à¸¹à¸¡',
    badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
    border: 'border-purple-500',
    dot: 'bg-purple-500'
  },
};

const teacherQuotes = [
  'â€œà¸à¸²à¸£à¸ªà¸­à¸™à¸—à¸µà¹ˆà¸”à¸µà¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¹à¸„à¹ˆà¸à¸²à¸£à¸–à¹ˆà¸²à¸¢à¸—à¸­à¸”à¸„à¸§à¸²à¸¡à¸£à¸¹à¹‰ à¹à¸•à¹ˆà¸„à¸·à¸­à¸à¸²à¸£à¸ˆà¸¸à¸”à¸›à¸£à¸°à¸à¸²à¸¢à¸„à¸§à¸²à¸¡à¸„à¸´à¸”â€',
  'â€œà¸—à¸¸à¸à¸„à¸§à¸²à¸¡à¸žà¸¢à¸²à¸¢à¸²à¸¡à¹ƒà¸™à¸à¸²à¸£à¸ªà¸­à¸™à¸‚à¸­à¸‡à¸„à¸¸à¸“à¸„à¸£à¸¹ à¸à¸³à¸¥à¸±à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸­à¸™à¸²à¸„à¸•à¸‚à¸­à¸‡à¹€à¸”à¹‡à¸à¸—à¸¸à¸à¸„à¸™â€',
  'â€œà¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™à¸§à¸±à¸™à¹ƒà¸«à¸¡à¹ˆà¸”à¹‰à¸§à¸¢à¸žà¸¥à¸±à¸‡à¸šà¸§à¸ à¹€à¸žà¸·à¹ˆà¸­à¸Šà¸±à¹‰à¸™à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¸¡à¸µà¸„à¸§à¸²à¸¡à¸ªà¸¸à¸‚à¹à¸¥à¸°à¸¡à¸µà¸Šà¸µà¸§à¸´à¸•à¸Šà¸µà¸§à¸²â€',
  'â€œà¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£à¸Šà¸±à¹‰à¸™à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¸”à¸µ à¸Šà¹ˆà¸§à¸¢à¸ªà¸£à¹‰à¸²à¸‡à¸šà¸£à¸£à¸¢à¸²à¸à¸²à¸¨à¹à¸«à¹ˆà¸‡à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰à¸­à¸¢à¹ˆà¸²à¸‡à¸¢à¸±à¹ˆà¸‡à¸¢à¸·à¸™â€',
];

function LiveClock() {
  const [time, setTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hours}:${mins}:${secs} à¸™.`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="min-w-[85px]">{time || '--:--:-- à¸™.'}</span>;
}

export default function DashboardClient({
  initialData = null,
}: {
  initialData?: DashboardData | null;
}) {
  const { user } = useAuth();
  // Fetch Dashboard Data with TanStack Query (SSR hydrated + Instant navigation caching)
  const { data = initialData, isLoading } = useQuery<DashboardData | null>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data.data;
    },
    initialData: initialData ?? undefined,
    staleTime: 1000 * 60, // 1 minute fresh cache
  });
  const loading = isLoading && !data;

  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<'all' | 'attendance_f' | 'attendance_warning'>('all');
  const [searchRisk, setSearchRisk] = useState('');

  // Greeting based on Thai time of day (Asia/Bangkok deterministic for SSR/CSR consistency)
  const greeting = useMemo(() => {
    const bangkokHourStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = Number.parseInt(bangkokHourStr, 10) % 24;
    if (hour >= 5 && hour < 12) {
      return {
        title: 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸•à¸­à¸™à¹€à¸Šà¹‰à¸²',
        subtext: 'à¸‚à¸­à¹ƒà¸«à¹‰à¹€à¸›à¹‡à¸™à¹€à¸Šà¹‰à¸²à¸—à¸µà¹ˆà¸ªà¸”à¹ƒà¸ª à¹€à¸›à¸µà¹ˆà¸¢à¸¡à¸”à¹‰à¸§à¸¢à¸žà¸¥à¸±à¸‡à¹à¸¥à¸°à¸„à¸§à¸²à¸¡à¸ªà¸¸à¸‚à¹ƒà¸™à¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰à¸™à¸°à¸„à¸£à¸±à¸š',
        icon: 'â˜€ï¸',
        quote: teacherQuotes[0],
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        title: 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸•à¸­à¸™à¸šà¹ˆà¸²à¸¢',
        subtext: 'à¸Šà¹ˆà¸§à¸‡à¸šà¹ˆà¸²à¸¢à¸‚à¸­à¸‡à¸à¸²à¸£à¸ªà¸­à¸™ à¸‚à¸­à¹ƒà¸«à¹‰à¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸´à¸ˆà¸à¸£à¸£à¸¡à¹ƒà¸™à¸Šà¸±à¹‰à¸™à¹€à¸£à¸µà¸¢à¸™à¸£à¸²à¸šà¸£à¸·à¹ˆà¸™à¹à¸¥à¸°à¸¡à¸µà¸Šà¸µà¸§à¸´à¸•à¸Šà¸µà¸§à¸²',
        icon: 'ðŸŒ¤ï¸',
        quote: teacherQuotes[1],
      };
    }
    if (hour >= 17 && hour < 20) {
      return {
        title: 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸•à¸­à¸™à¹€à¸¢à¹‡à¸™',
        subtext: 'à¹ƒà¸à¸¥à¹‰à¸«à¸¡à¸”à¸§à¸±à¸™à¹à¸¥à¹‰à¸§ à¸­à¸¢à¹ˆà¸²à¸¥à¸·à¸¡à¸•à¸£à¸§à¸ˆà¹€à¸Šà¹‡à¸„à¸„à¸§à¸²à¸¡à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¸‚à¸­à¸‡à¸„à¸°à¹à¸™à¸™à¹à¸¥à¸°à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸™à¸°à¸„à¸£à¸±à¸š',
        icon: 'ðŸŒ…',
        quote: teacherQuotes[2],
      };
    }
    return {
      title: 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸•à¸­à¸™à¸„à¹ˆà¸³',
      subtext: 'à¸žà¸±à¸à¸œà¹ˆà¸­à¸™à¹ƒà¸«à¹‰à¹€à¸•à¹‡à¸¡à¸—à¸µà¹ˆà¹€à¸žà¸·à¹ˆà¸­à¹€à¸•à¸£à¸µà¸¢à¸¡à¸žà¸£à¹‰à¸­à¸¡à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰à¹ƒà¸™à¸§à¸±à¸™à¸–à¸±à¸”à¹„à¸›à¸™à¸°à¸„à¸£à¸±à¸š',
      icon: 'ðŸŒ™',
      quote: teacherQuotes[3],
    };
  }, []);

  // Backup Export
  const exportAllData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export');
      const exportData = res.data.data;

      const toCSV = (rows: Record<string, unknown>[]) => {
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

      const { buildZipBlob } = await import('@/lib/zip');
      const zipEntries: Array<{ name: string; content: string }> = [];

      if (exportData.classrooms?.length) zipEntries.push({ name: 'classrooms.csv', content: toCSV(exportData.classrooms) });
      if (exportData.students?.length) zipEntries.push({ name: 'students.csv', content: toCSV(exportData.students) });
      if (exportData.attendance?.length) zipEntries.push({ name: 'attendance.csv', content: toCSV(exportData.attendance) });
      if (exportData.scores?.length) zipEntries.push({ name: 'scores.csv', content: toCSV(exportData.scores) });
      if (exportData.schedules?.length) zipEntries.push({ name: 'schedules.csv', content: toCSV(exportData.schedules) });
      if (exportData.timetable?.length) zipEntries.push({ name: 'timetable.csv', content: toCSV(exportData.timetable) });

      const summary = `à¸£à¸°à¸šà¸šà¸§à¸²à¸‡à¹à¸œà¸™à¸à¸²à¸£à¸ªà¸­à¸™à¸­à¸±à¸ˆà¸‰à¸£à¸´à¸¢à¸° (Smart Lesson Planner)\nExported: ${exportData.exported_at}\n\n` +
        Object.entries(exportData.total_counts || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      zipEntries.push({ name: 'summary.txt', content: summary });

      const blob = await buildZipBlob(zipEntries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-lesson-planner-backup-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const { toast } = await import('@/lib/toast');
      const totalItems = Object.values((exportData.total_counts || {}) as Record<string, unknown>).reduce<number>(
        (sum, val) => sum + Number(val),
        0
      );
      toast.success(`à¸ªà¸³à¸£à¸­à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ! à¸£à¸§à¸¡ ${totalItems} à¸£à¸²à¸¢à¸à¸²à¸£`);
    } catch (err) {
      console.error('Export failed:', err);
      const { toast } = await import('@/lib/toast');
      toast.error('à¸ªà¸³à¸£à¸­à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
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
      title: 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”',
      value: data?.totalClassrooms || 0,
      unit: 'à¸«à¹‰à¸­à¸‡',
      subtitle: 'à¸ˆà¸±à¸”à¸à¸²à¸£à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸£à¸µà¸¢à¸™ & à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²',
      icon: Presentation,
      gradient: 'from-indigo-500 to-indigo-700',
      iconBg: 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60',
      accent: '#6366f1',
      link: '/classrooms',
      badgeText: isSemesterEnded ? 'à¸„à¸£à¸šà¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™' : 'à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™',
      badgeColor: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60',
    },
    {
      title: 'à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™à¸£à¸°à¸šà¸š',
      value: data?.totalStudents || 0,
      unit: 'à¸„à¸™',
      subtitle: 'à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ & à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-700',
      iconBg: 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60',
      accent: '#10b981',
      link: '/students',
      badgeText: 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”',
      badgeColor: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60',
    },
    {
      title: 'à¸„à¸²à¸šà¸ªà¸­à¸™à¸§à¸±à¸™à¸™à¸µà¹‰',
      value: todayClassesCount,
      unit: 'à¸„à¸²à¸š',
      subtitle: isSemesterEnded
        ? 'à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸à¸²à¸£à¸ªà¸­à¸™à¸›à¸£à¸°à¸ˆà¸³à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¹‰à¸§'
        : `à¸ à¸²à¸£à¸°à¸‡à¸²à¸™à¸ªà¸­à¸™à¸£à¸§à¸¡ ${totalWeeklyHours} à¸Šà¸¡./à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ`,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-50/90 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/60',
      accent: '#f59e0b',
      link: '/schedule',
      badgeText: isSemesterEnded ? 'à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™' : (todayClassesCount > 0 ? 'à¸¡à¸µà¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™' : 'à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸­à¸™'),
      badgeColor: isSemesterEnded
        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60'
        : (todayClassesCount > 0 ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200/60 dark:border-amber-800/60' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'),
    },
    {
      title: 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸§à¸±à¸™à¸™à¸µà¹‰',
      value: isSemesterEnded ? 'à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢' : (todayClassesCount > 0 ? `${checkedClassesCount}/${todayClassesCount}` : 'à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢'),
      unit: isSemesterEnded || todayClassesCount === 0 ? 'ðŸŽ‰' : 'à¸«à¹‰à¸­à¸‡',
      subtitle: isSemesterEnded
        ? 'à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸‚à¸­à¸‡à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§'
        : (todayClassesCount > 0 && checkedClassesCount === todayClassesCount
          ? 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¸—à¸¸à¸à¸„à¸²à¸šà¹à¸¥à¹‰à¸§'
          : (todayClassesCount === 0
            ? 'à¹„à¸¡à¹ˆà¸¡à¸µà¸„à¸²à¸šà¸ªà¸­à¸™à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰'
            : `à¸£à¸­à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸­à¸µà¸ ${todayClassesCount - checkedClassesCount} à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™`)),
      icon: CheckCircle2,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-50/90 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60',
      accent: '#8b5cf6',
      link: '/attendance',
      badgeText: isSemesterEnded ? 'à¸„à¸£à¸šà¸–à¹‰à¸§à¸™' : `${attendancePercent}%`,
      badgeColor: (isSemesterEnded || (checkedClassesCount === todayClassesCount && todayClassesCount > 0))
        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60'
        : 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 border-violet-200/60 dark:border-violet-800/60',
      progressBar: (!isSemesterEnded && todayClassesCount > 0) ? attendancePercent : null,
    },
  ];

  return (
    <div className="space-y-7 pb-10">
      {/* ==================== HERO GREETING BANNER ==================== */}
      <section
        aria-label="à¸ªà¸£à¸¸à¸›à¸ à¸²à¸žà¸£à¸§à¸¡à¹à¸¥à¸°à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¹‰à¸­à¸™à¸£à¸±à¸š"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-950 text-white shadow-xl shadow-indigo-950/15 p-6 sm:p-8 lg:p-10 border border-white/10"
      >
        {/* Ambient Decorative Light Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-400/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            {/* Top Date & Live Clock Pill with Zero CLS */}
            <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-indigo-100 shadow-xs">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-300" />
                <span suppressHydrationWarning>{format(new Date(), 'EEEEà¸—à¸µà¹ˆ d MMMM yyyy', { locale: th })}</span>
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
                  title="à¸ˆà¸±à¸”à¸à¸²à¸£à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™"
                >
                  <Layers className="w-3 h-3 text-indigo-300" />
                  <span>{data.activeSemester.name}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-indigo-300 group-hover/sem:translate-x-0.5 transition-transform" />
                </Link>
              ) : isSemesterEnded ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[0.68rem] font-bold">
                  à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¹‰à¸§ ðŸŽ‰
                </span>
              ) : (
                <span className="text-white/80">à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</span>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="à¸£à¸°à¸šà¸šà¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­à¸›à¸à¸•à¸´" />
            </div>

            {/* Greeting Header */}
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl select-none animate-float">{greeting.icon}</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {greeting.title}, <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent inline-block min-w-[100px]">à¸„à¸¸à¸“à¸„à¸£à¸¹{user?.name || 'à¸œà¸¹à¹‰à¸ªà¸­à¸™'}</span>
              </h1>
            </div>

            {/* Teacher Subtitle & Motivational Quote */}
            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-normal">
              {isSemesterEnded
                ? 'à¸‚à¸­à¹à¸ªà¸”à¸‡à¸„à¸§à¸²à¸¡à¸¢à¸´à¸™à¸”à¸µà¸à¸±à¸šà¸„à¸¸à¸“à¸„à¸£à¸¹à¸—à¸µà¹ˆà¸ˆà¸±à¸”à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰à¹à¸¥à¸°à¸ªà¸­à¸™à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¸•à¸¥à¸­à¸”à¸—à¸±à¹‰à¸‡à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¹‰à¸§à¸„à¸£à¸±à¸š'
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
                  <span>à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸à¸²à¸£à¸ªà¸­à¸™à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-white/95 flex items-center gap-2 shadow-xs transition-all hover:bg-white/15">
                  <Clock3 className="w-3.5 h-3.5 text-amber-300" />
                  <span>à¸§à¸±à¸™à¸™à¸µà¹‰à¸¡à¸µ <strong>{todayClassesCount}</strong> à¸„à¸²à¸šà¸ªà¸­à¸™</span>
                </div>
              )}

              {pendingTasksCount > 0 ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/25 backdrop-blur-sm border border-amber-400/40 text-xs text-amber-200 flex items-center gap-2 shadow-xs transition-all hover:bg-amber-500/35">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³ <strong>{pendingTasksCount}</strong> à¸£à¸²à¸¢à¸à¸²à¸£</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/25 backdrop-blur-sm border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰</span>
                </div>
              )}

              {atRiskCount > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/25 backdrop-blur-sm border border-rose-400/40 text-xs text-rose-200 flex items-center gap-2 shadow-xs transition-all hover:bg-rose-500/35">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  <span>à¹€à¸à¹‰à¸²à¸£à¸°à¸§à¸±à¸‡ <strong>{atRiskCount}</strong> à¸„à¸™</span>
                </div>
              )}

              {attendanceRate !== null && !isSemesterEnded && (
                <div className="px-3 py-1.5 rounded-xl bg-violet-500/25 backdrop-blur-sm border border-violet-400/40 text-xs text-violet-200 flex items-center gap-2 shadow-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-300" />
                  <span>à¹€à¸‚à¹‰à¸²à¹€à¸£à¸µà¸¢à¸™à¸§à¸±à¸™à¸™à¸µà¹‰ <strong>{attendanceRate}%</strong></span>
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
                <span>à¸•à¸±à¸”à¹€à¸à¸£à¸” & à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸œà¸¥</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/attendance"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                <span>à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸”à¹ˆà¸§à¸™</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            )}

            <Link
              href="/schedule"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 backdrop-blur-md transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <Calendar className="w-4 h-4 text-indigo-200 transition-transform duration-300 group-hover:scale-110" />
              <span>à¸”à¸¹à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™</span>
            </Link>

            <button
              onClick={exportAllData}
              disabled={exporting}
              aria-label="à¸ªà¸³à¸£à¸­à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸±à¹‰à¸‡à¸£à¸°à¸šà¸šà¹€à¸›à¹‡à¸™à¹„à¸Ÿà¸¥à¹Œ ZIP"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 backdrop-blur-md transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-indigo-200" />
              )}
              <span>{exporting ? 'à¸à¸³à¸¥à¸±à¸‡à¸ªà¸³à¸£à¸­à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...' : 'à¸ªà¸³à¸£à¸­à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ (ZIP)'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================== 4 METRIC BENTO CARDS ==================== */}
      <section
        aria-label="à¸•à¸±à¸§à¸Šà¸µà¹‰à¸§à¸±à¸”à¸ªà¸³à¸„à¸±à¸à¸‚à¸­à¸‡à¸£à¸°à¸šà¸š"
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
                <div className="w-7 h-7 rounded-xl bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600 dark:group-hover:text-white group-hover:rotate-12 border border-slate-200/50 dark:border-slate-700/60">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Middle: Title & Value */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">{card.title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-mono tabular-nums">{card.value}</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{card.unit}</span>
              </div>
              <p className="text-[0.72rem] text-slate-600 dark:text-slate-400 font-normal pt-0.5 line-clamp-1">{card.subtitle}</p>
            </div>

            {/* Optional Progress Bar for Attendance */}
            {card.progressBar !== null && card.progressBar !== undefined && (
              <div className="mt-3 pt-2.5 border-t border-slate-100/80 dark:border-slate-800">
                <div className="flex items-center justify-between text-[0.68rem] text-slate-600 dark:text-slate-400 font-medium mb-1">
                  <span>à¸„à¸§à¸²à¸¡à¸à¹‰à¸²à¸§à¸«à¸™à¹‰à¸²</span>
                  <span className="font-bold text-violet-700 dark:text-violet-300">{card.progressBar}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
        aria-label="à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™à¸™à¸µà¹‰"
        className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-300"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs transition-transform duration-300 hover:scale-105">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™à¸™à¸µà¹‰
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {format(new Date(), 'EEEE', { locale: th })}
                </span>
                {todayClassesCount > 0 && (
                  <span className="hidden sm:inline-block text-xs font-medium text-slate-600 dark:text-slate-400">
                    ({todayClassesCount} à¸„à¸²à¸š)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                à¸£à¸²à¸¢à¸à¸²à¸£à¸„à¸²à¸šà¹€à¸£à¸µà¸¢à¸™à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸§à¸±à¸™à¸™à¸µà¹‰ à¸žà¸£à¹‰à¸­à¸¡à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­
              </p>
            </div>
          </div>

          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 transition-all duration-200 group"
          >
            <span>à¸”à¸¹à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¹€à¸•à¹‡à¸¡à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
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
                  className={`p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg flex flex-col justify-between group relative overflow-hidden ${entry.is_attendance_checked
                      ? 'bg-gradient-to-br from-white via-white to-emerald-50/30 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/60 shadow-emerald-500/5'
                      : 'bg-white/95 dark:bg-slate-900/90 border-indigo-100/90 dark:border-slate-800 shadow-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                >
                  {/* Left Accent Bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${entry.is_attendance_checked ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                  <div className="space-y-3 pl-1.5">
                    {/* Period & Time header */}
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                        <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        <span>à¸„à¸²à¸šà¸—à¸µà¹ˆ {entry.start_period === entry.end_period ? entry.start_period : `${entry.start_period}-${entry.end_period}`}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        {entry.start_time} - {entry.end_time} à¸™.
                      </span>
                    </div>

                    {/* Subject info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {entry.subject_code && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                            {entry.subject_code}
                          </span>
                        )}
                        <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full border ${typeInfo.badge}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={entry.subject_name}>
                        {entry.subject_name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>ðŸ« {entry.room ? `à¸«à¹‰à¸­à¸‡ ${entry.room}` : 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸«à¹‰à¸­à¸‡'}</span>
                        {entry.group_name && <span>â€¢ ðŸ‘¥ {entry.group_name}</span>}
                        {entry.classroom_name && <span>â€¢ {entry.classroom_name}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Status & CTA Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between pl-1.5">
                    {entry.is_attendance_checked ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹à¸¥à¹‰à¸§</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>à¸£à¸­à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­</span>
                      </div>
                    )}

                    {entry.classroom_id ? (
                      <Link
                        href={`/attendance?classroom_id=${entry.classroom_id}`}
                        className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-200 ${entry.is_attendance_checked
                            ? 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-transparent hover:border-indigo-200 dark:hover:border-slate-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:scale-[1.02]'
                          }`}
                      >
                        <span>{entry.is_attendance_checked ? 'à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥' : 'à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸—à¸±à¸™à¸—à¸µ'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-[0.7rem] text-slate-500 dark:text-slate-400">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸œà¸¹à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : isSemesterEnded ? (
          /* Celebratory Semester Concluded Card */
          <div className="text-center py-10 px-6 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-indigo-950/40 rounded-2xl border border-indigo-100/90 dark:border-slate-800 shadow-xs min-h-[190px] flex flex-col items-center justify-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600 text-white shadow-md shadow-emerald-500/20 flex items-center justify-center mb-3 text-3xl animate-float">
              ðŸŽ“
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-2 border border-emerald-200 dark:border-emerald-800/70 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸à¸²à¸£à¸ªà¸­à¸™à¸›à¸£à¸°à¸ˆà¸³à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§</span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-100">
              à¸¢à¸´à¸™à¸”à¸µà¸”à¹‰à¸§à¸¢à¸„à¸£à¸±à¸šà¸„à¸¸à¸“à¸„à¸£à¸¹ à¸à¸²à¸£à¸ªà¸­à¸™à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™à¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œà¹à¸¥à¹‰à¸§ ðŸŽ‰
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-lg mx-auto leading-relaxed">
              à¸‚à¸“à¸°à¸™à¸µà¹‰à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸Šà¹ˆà¸§à¸‡à¹€à¸§à¸¥à¸²à¸à¸²à¸£à¸ªà¸­à¸™à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡à¸‚à¸­à¸‡à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§ à¸„à¸¸à¸“à¸„à¸£à¸¹à¸ªà¸²à¸¡à¸²à¸£à¸–à¹ƒà¸Šà¹‰à¹€à¸§à¸¥à¸²à¸™à¸µà¹‰à¹ƒà¸™à¸à¸²à¸£à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸„à¸°à¹à¸™à¸™à¹€à¸à¹‡à¸š à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ à¹à¸¥à¸°à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸•à¸±à¸”à¹€à¸à¸£à¸”à¹€à¸žà¸·à¹ˆà¸­à¸­à¸­à¸à¸£à¸²à¸¢à¸‡à¸²à¸™à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸„à¸£à¸±à¸š
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/grades"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <Award className="w-4 h-4" />
                <span>à¹„à¸›à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸±à¸”à¹€à¸à¸£à¸” & à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸œà¸¥</span>
              </Link>
              <Link
                href="/scores"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0"
              >
                <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸„à¸°à¹à¸™à¸™à¹€à¸à¹‡à¸š</span>
              </Link>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 border border-transparent dark:border-slate-700"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>à¸”à¸¹à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸ à¸²à¸žà¸£à¸§à¸¡</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Daily Coffee Break State */
          <div className="text-center py-10 px-4 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-indigo-950/40 rounded-2xl border border-indigo-100/70 dark:border-slate-800 min-h-[180px] flex flex-col items-center justify-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-indigo-100 dark:border-slate-700 flex items-center justify-center mb-3 text-2xl animate-float">
              â˜•
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">à¸§à¸±à¸™à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸¡à¸µà¸„à¸²à¸šà¸ªà¸­à¸™à¸•à¸²à¸¡à¸•à¸²à¸£à¸²à¸‡</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm mx-auto">
              à¸„à¸¸à¸“à¸„à¸£à¸¹à¸ªà¸²à¸¡à¸²à¸£à¸–à¹ƒà¸Šà¹‰à¹€à¸§à¸¥à¸²à¸™à¸µà¹‰à¹ƒà¸™à¸à¸²à¸£à¹€à¸•à¸£à¸µà¸¢à¸¡à¹à¸œà¸™à¸à¸²à¸£à¸ªà¸­à¸™ à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ à¸«à¸£à¸·à¸­à¸•à¸£à¸§à¸ˆà¹€à¸Šà¹‡à¸„à¸‡à¸²à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹„à¸”à¹‰à¸„à¸£à¸±à¸š
            </p>
            <div className="mt-4">
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-xs hover:shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>à¸ˆà¸±à¸”à¸à¸²à¸£à¸•à¸²à¸£à¸²à¸‡à¸ªà¸­à¸™à¸›à¸£à¸°à¸ˆà¸³à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ==================== ACTION CENTER: PENDING TASKS & AT-RISK STUDENTS ==================== */}
      <section
        aria-label="à¸¨à¸¹à¸™à¸¢à¹Œà¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¹à¸¥à¸°à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸ªà¸µà¹ˆà¸¢à¸‡"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Card 1: Pending Tasks */}
        <div className="glass p-6 rounded-3xl border border-indigo-100/60 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰
                    {pendingTasksCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        {pendingTasksCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹à¸¥à¸°à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸„à¹‰à¸²à¸‡à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸£à¸°à¸šà¸š</p>
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
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 hover:bg-amber-100/80 dark:hover:bg-amber-950/50 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-200 group shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 group-hover:text-amber-950 dark:group-hover:text-amber-100 truncate">
                            {task.message}
                          </p>
                          <p className="text-[0.68rem] text-amber-700 dark:text-amber-400">à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸—à¸±à¸™à¸—à¸µ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
                        <span>à¸—à¸³à¹€à¸¥à¸¢</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 min-h-[220px] flex flex-col items-center justify-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡à¹ƒà¸™à¸§à¸±à¸™à¸™à¸µà¹‰ ðŸŽ‰</p>
                  <p className="text-[0.72rem] text-emerald-700 dark:text-emerald-400 mt-1 max-w-xs">
                    {isSemesterEnded
                      ? 'à¸„à¸¸à¸“à¸„à¸£à¸¹à¹„à¸”à¹‰à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹à¸¥à¸°à¸—à¸³à¸‡à¸²à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¸•à¸¥à¸­à¸”à¸—à¸±à¹‰à¸‡à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¹‰à¸§à¸„à¸£à¸±à¸š'
                      : 'à¸„à¸¸à¸“à¸„à¸£à¸¹à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹à¸¥à¸°à¸—à¸³à¸‡à¸²à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¸„à¸£à¸šà¸—à¸¸à¸à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸¥à¹‰à¸§à¸„à¸£à¸±à¸š'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/attendance"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-slate-800/80 transition-all"
            >
              <span>à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸£à¸°à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: At-Risk Students Early Warning */}
        <div className="glass p-6 rounded-3xl border border-indigo-100/60 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸à¹‰à¸²à¸£à¸°à¸§à¸±à¸‡
                    {atRiskCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                        {atRiskCount} à¸„à¸™
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¹„à¸¡à¹ˆà¸–à¸¶à¸‡à¹€à¸à¸“à¸‘à¹Œ à¸«à¸£à¸·à¸­ à¹€à¸ªà¸µà¹ˆà¸¢à¸‡à¸«à¸¡à¸”à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸š</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            {atRiskCount > 0 && (
              <div className="space-y-2.5 mb-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <button
                    onClick={() => setRiskFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${riskFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” ({atRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_f')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${riskFilter === 'attendance_f'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                      }`}
                  >
                    à¸«à¸¡à¸”à¸ªà¸´à¸—à¸˜à¸´à¹Œ ({fRiskCount})
                  </button>
                  <button
                    onClick={() => setRiskFilter('attendance_warning')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${riskFilter === 'attendance_warning'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                      }`}
                  >
                    à¹€à¸ªà¸µà¹ˆà¸¢à¸‡ ({warningRiskCount})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchRisk}
                    onChange={(e) => setSearchRisk(e.target.value)}
                    placeholder="à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ à¸«à¸£à¸·à¸­à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-all"
                  />
                  {searchRisk && (
                    <button
                      onClick={() => setSearchRisk('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-xs ${isF
                            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/50 hover:bg-rose-100/70 dark:hover:bg-rose-950/50'
                            : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50 hover:bg-amber-100/70 dark:hover:bg-amber-950/50'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            avatar={student.avatar}
                            name={student.student_name}
                            userId={student.student_id}
                            size="sm"
                            className="rounded-xl border border-indigo-200 dark:border-slate-700 shadow-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                              {student.student_name}
                              {student.student_code && (
                                <span className="ml-1 text-[0.68rem] text-slate-500 dark:text-slate-400 font-normal">
                                  ({student.student_code})
                                </span>
                              )}
                            </p>
                            <p className="text-[0.68rem] text-slate-600 dark:text-slate-400 truncate">
                              {student.classroom_name} â€¢ <span className={`font-semibold ${isF ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>{student.reason}</span>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${isF ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                            }`}>
                            {isF ? 'à¸«à¸¡à¸”à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¸­à¸š' : 'à¹€à¸•à¸·à¸­à¸™'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : atRiskCount > 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                  <Search className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-1" />
                  <span>à¹„à¸¡à¹ˆà¸žà¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸•à¸²à¸¡à¸„à¸³à¸„à¹‰à¸™à¸«à¸²</span>
                </div>
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">à¸¢à¸­à¸”à¹€à¸¢à¸µà¹ˆà¸¢à¸¡à¸¡à¸²à¸! à¹„à¸¡à¹ˆà¸¡à¸µà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸ªà¸µà¹ˆà¸¢à¸‡</p>
                  <p className="text-[0.72rem] text-emerald-700 dark:text-emerald-400 mt-1 max-w-xs">
                    à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸¸à¸à¸„à¸™à¸¡à¸µà¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¸•à¸²à¸¡à¹€à¸à¸“à¸‘à¹Œà¸—à¸µà¹ˆà¸à¸³à¸«à¸™à¸”
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/grades"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-slate-800/80 transition-all"
            >
              <span>à¸”à¸¹à¸£à¸²à¸¢à¸‡à¸²à¸™à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¸à¸²à¸£à¸•à¸±à¸”à¹€à¸à¸£à¸”</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== QUICK ACTIONS ==================== */}
      <section
        aria-label="à¸—à¸²à¸‡à¸¥à¸±à¸”à¸£à¸°à¸šà¸šà¸‡à¸²à¸™"
        className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-300"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                à¸—à¸²à¸‡à¸¥à¸±à¸”à¸£à¸°à¸šà¸šà¸‡à¸²à¸™
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">à¹€à¸‚à¹‰à¸²à¸–à¸¶à¸‡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸¡à¸·à¸­à¸«à¸¥à¸±à¸à¹„à¸”à¹‰à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸§à¸”à¹€à¸£à¹‡à¸§</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <Link
            href="/semesters"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-indigo-100/60 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-all duration-200 group shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/70 dark:to-purple-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate">à¸ à¸²à¸„à¹€à¸£à¸µà¸¢à¸™ & à¸›à¸µà¸à¸²à¸£à¸¨à¸¶à¸à¸©à¸²</p>
                <p className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">à¸ˆà¸±à¸”à¸à¸²à¸£à¹€à¸—à¸­à¸¡à¹à¸¥à¸°à¸›à¸µà¸à¸²à¸£à¸¨à¸¶à¸à¸©à¸²</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </Link>

          <Link
            href="/attendance"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-indigo-100/60 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:bg-emerald-50/30 dark:hover:bg-slate-800/50 transition-all duration-200 group shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold border border-emerald-100 dark:border-emerald-800/50 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors truncate">à¸£à¸°à¸šà¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­</p>
                <p className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ à¸‚à¸²à¸” à¸¥à¸² à¸¡à¸² à¸ªà¸²à¸¢</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </Link>

          <Link
            href="/scores"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-indigo-100/60 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-all duration-200 group shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors truncate">à¸„à¸°à¹à¸™à¸™à¹€à¸à¹‡à¸šà¸£à¸²à¸¢à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ</p>
                <p className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¹€à¸à¹‡à¸šà¹à¸¥à¸°à¹à¸šà¸šà¸—à¸”à¸ªà¸­à¸š</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </Link>

          <Link
            href="/affective"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-indigo-100/60 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700/60 hover:bg-amber-50/30 dark:hover:bg-slate-800/50 transition-all duration-200 group shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/50 shrink-0">
                <Smile className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors truncate">à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢</p>
                <p className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¹à¸¥à¸°à¸à¸²à¸£à¸¡à¸µà¸ªà¹ˆà¸§à¸™à¸£à¹ˆà¸§à¸¡</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </Link>

          <Link
            href="/grades"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-indigo-100/60 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/60 hover:bg-purple-50/30 dark:hover:bg-slate-800/50 transition-all duration-200 group shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800/50 shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors truncate">à¸•à¸±à¸”à¹€à¸à¸£à¸” & à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸œà¸¥</p>
                <p className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">à¸„à¸³à¸™à¸§à¸“à¹€à¸à¸£à¸”à¹€à¸‰à¸¥à¸µà¹ˆà¸¢à¹à¸¥à¸°à¸ªà¹ˆà¸‡à¸­à¸­à¸à¸£à¸²à¸¢à¸‡à¸²à¸™</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </Link>
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
    <div className="space-y-7 pb-10 animate-fade-in-up" aria-busy="true" aria-label="à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”">
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
      <div className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100/60 dark:border-slate-800">
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
            <div key={i} className="p-4 rounded-2xl border border-indigo-100/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="skeleton h-5 w-20 rounded-lg" />
                  <div className="skeleton h-4 w-24 rounded" />
                </div>
                <div className="skeleton h-4 w-32 rounded mt-2" />
                <div className="skeleton h-5 w-48 rounded" />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
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

      {/* 5. Quick Actions Skeleton */}
      <div className="glass p-6 sm:p-7 rounded-3xl min-h-[140px]">
        <div className="flex items-center gap-3 mb-5">
          <div className="skeleton w-10 h-10 rounded-2xl" />
          <div className="space-y-1.5">
            <div className="skeleton h-5 w-28 rounded-lg" />
            <div className="skeleton h-3 w-36 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
