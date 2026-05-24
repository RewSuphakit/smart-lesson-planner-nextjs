'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { BookOpen, Users, Calendar, TrendingUp, Clock, Sparkles, Loader2, ArrowUpRight, BarChart3, AlertTriangle, CheckCircle, Download, Presentation } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function DashboardPage() {
  const [data, setData] = useState<{
    totalClassrooms: number;
    totalStudents: number;
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
    }>;
    pendingTasks?: Array<{
      type: string;
      classroom_name: string;
      message: string;
      link: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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

  const [exporting, setExporting] = useState(false);

  const exportAllData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export');
      const exportData = res.data.data;

      // Convert object array to CSV string
      const toCSV = (rows: Record<string, any>[]) => {
        if (rows.length === 0) return '';
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

      // Load JSZip from CDN dynamically using a script tag
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

      // Add summary
      const summary = `ข้อมูลทั้งระบบ\nExported: ${exportData.exported_at}\n\n` +
        Object.entries(exportData.total_counts || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      zip.file('summary.txt', summary);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-lesson-planner-export-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const { toast } = await import('react-hot-toast');
      toast.success(`Export สำเร็จ! ${Object.values(exportData.total_counts || {}).reduce((a: number, b: any) => a + Number(b), 0)} รายการ`);
    } catch (err) {
      console.error('Export failed:', err);
      const { toast } = await import('react-hot-toast');
      toast.error('Export ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'ห้องเรียนทั้งหมด',
      value: data?.totalClassrooms || 0,
      icon: Presentation,
      gradient: 'from-indigo-500 to-purple-600',
      shadow: 'shadow-indigo-500/20',
      accent: '#6366f1',
      change: 'ทั้งหมด'
    },
    {
      label: 'นักเรียน',
      value: data?.totalStudents || 0,
      icon: Users,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
      accent: '#10b981',
      change: 'ทั้งหมด'
    },
    {
      label: 'กำหนดการสอน',
      value: data?.upcomingSchedules?.length || 0,
      icon: Calendar,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
      accent: '#f59e0b',
      change: 'ที่กำลังจะมาถึง'
    },
  ];

  return (
    <div className="space-y-7 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">แดชบอร์ด</h1>
          <p className="text-slate-500 text-sm">ภาพรวมกิจกรรมการสอนของคุณ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportAllData}
            disabled={exporting}
            className="btn bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25 flex items-center gap-2 text-xs font-semibold"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'กำลัง Export...' : '📤 Export ข้อมูลทั้งระบบ'}
          </button>
          <div className="glass-light px-4 py-2 rounded-xl flex items-center gap-2 text-slate-600 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="stat-card opacity-0 animate-fade-in-up"
            style={{ '--card-accent': stat.accent, animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' } as React.CSSProperties}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.shadow}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</p>
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className="text-[0.65rem] text-slate-600 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Pending Tasks */}
      {data?.pendingTasks && data.pendingTasks.length > 0 && (
        <div className="glass p-5 border-l-4 border-amber-400">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-amber-500" />
            </div>
            📋 งานที่ต้องทำวันนี้ ({data.pendingTasks.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.pendingTasks.map((task, i) => (
              <a key={i} href={task.link} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-all cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm text-amber-800 font-medium">{task.message}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* At-Risk Students */}
      {data?.atRiskStudents && data.atRiskStudents.length > 0 && (
        <div className="glass p-5 border-l-4 border-red-400">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            ⚠️ นักเรียนที่ต้องเฝ้าระวัง ({data.atRiskStudents.length} คน)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.atRiskStudents.slice(0, 12).map((student, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                student.type === 'attendance_f'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  student.type === 'attendance_f' ? 'bg-red-100' : 'bg-amber-100'
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${student.type === 'attendance_f' ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{student.student_name}</p>
                  <p className="text-[10px] text-slate-500">{student.classroom_name}</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${
                    student.type === 'attendance_f' ? 'text-red-600' : 'text-amber-600'
                  }`}>{student.reason}</p>
                </div>
              </div>
            ))}
          </div>
          {data.atRiskStudents.length > 12 && (
            <p className="text-xs text-slate-500 mt-2">...และอีก {data.atRiskStudents.length - 12} คน</p>
          )}
        </div>
      )}

      <div className="w-full">
        {/* Upcoming Schedule */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-indigo-400" />
              </div>
              กำหนดการสอนที่จะมาถึง
            </h2>
          </div>

          {data?.upcomingSchedules && data.upcomingSchedules.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingSchedules.map((s, i) => (
                <div key={i} className="glass-light p-4 flex items-center gap-4 list-item rounded-xl">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[0.55rem] text-indigo-700 uppercase font-bold tracking-wider">
                      {format(new Date(s.scheduled_date), 'MMM', { locale: th })}
                    </span>
                    <span className="text-xl font-bold text-indigo-700 leading-none">
                      {format(new Date(s.scheduled_date), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.lesson_title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.subject} • {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)} น.
                    </p>
                  </div>
                  <span className="badge badge-primary text-[0.6rem]">
                    {s.status === 'scheduled' ? 'รอสอน' : s.status === 'completed' ? 'สอนแล้ว' : 'ยกเลิก'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                <Calendar className="w-7 h-7 text-slate-700" />
              </div>
              <p className="text-slate-600 text-sm">ยังไม่มีกำหนดการสอน</p>
              <p className="text-slate-700 text-xs mt-1">เพิ่มแผนการสอนลงในตารางได้เลย</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
