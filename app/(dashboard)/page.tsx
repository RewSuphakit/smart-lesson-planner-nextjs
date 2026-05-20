'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { BookOpen, Users, Calendar, TrendingUp, Clock, Sparkles, Loader2, ArrowUpRight, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function DashboardPage() {
  const [data, setData] = useState<{
    totalLessons: number;
    totalStudents: number;
    upcomingSchedules: Array<{
      scheduled_date: string;
      start_time: string;
      end_time: string;
      status: string;
      lesson_title: string;
      subject: string;
    }>;
    evaluation: {
      total_evaluations: number;
      avg_score_percent: number;
      excellent_count: number;
      good_count: number;
      average_count: number;
      poor_count: number;
    };
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'แผนการสอนทั้งหมด',
      value: data?.totalLessons || 0,
      icon: BookOpen,
      gradient: 'from-indigo-500 to-purple-600',
      shadow: 'shadow-indigo-500/20',
      accent: '#6366f1',
      change: '+3 สัปดาห์นี้'
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
    {
      label: 'คะแนนเฉลี่ย',
      value: data?.evaluation?.avg_score_percent ? `${Math.round(data.evaluation.avg_score_percent)}%` : 'ยังไม่มี',
      icon: TrendingUp,
      gradient: 'from-rose-500 to-pink-600',
      shadow: 'shadow-rose-500/20',
      accent: '#f43f5e',
      change: 'ของนักเรียนทั้งหมด'
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
        <div className="glass-light px-4 py-2 rounded-xl flex items-center gap-2 text-slate-600 text-xs">
          <Clock className="w-3.5 h-3.5" />
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Performance Summary */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
              ผลการเรียนของนักเรียน
            </h2>
          </div>

          {data?.evaluation && data.evaluation.total_evaluations > 0 ? (
            <div className="space-y-5">
              {/* Participation grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'excellent', label: 'ดีเยี่ยม', count: data.evaluation.excellent_count || 0, color: 'bg-emerald-500', bg: 'from-emerald-500/10 to-emerald-500/5' },
                  { key: 'good', label: 'ดี', count: data.evaluation.good_count || 0, color: 'bg-blue-500', bg: 'from-blue-500/10 to-blue-500/5' },
                  { key: 'average', label: 'ปานกลาง', count: data.evaluation.average_count || 0, color: 'bg-amber-500', bg: 'from-amber-500/10 to-amber-500/5' },
                  { key: 'poor', label: 'ต้องปรับปรุง', count: data.evaluation.poor_count || 0, color: 'bg-red-500', bg: 'from-red-500/10 to-red-500/5' },
                ].map((item, i) => (
                  <div key={i} className={`bg-gradient-to-br ${item.bg} border border-indigo-100 rounded-xl p-3.5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-xs text-slate-600 font-medium">{item.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{item.count}</p>
                    <p className="text-[0.6rem] text-slate-600 mt-0.5">คน</p>
                  </div>
                ))}
              </div>

              {/* Average score bar */}
              <div className="glass-light p-5 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-600 font-medium">คะแนนเฉลี่ยรวม</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {Math.round(data.evaluation.avg_score_percent || 0)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(data.evaluation.avg_score_percent || 0, 100)}%` }}
                  />
                </div>
                <p className="text-[0.65rem] text-slate-600 mt-2">
                  จากการประเมินทั้งหมด {data.evaluation.total_evaluations} ครั้ง
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                <BarChart3 className="w-7 h-7 text-slate-700" />
              </div>
              <p className="text-slate-600 text-sm">ยังไม่มีข้อมูลการประเมิน</p>
              <p className="text-slate-700 text-xs mt-1">เริ่มบันทึกผลการเรียนของนักเรียนได้เลย</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
