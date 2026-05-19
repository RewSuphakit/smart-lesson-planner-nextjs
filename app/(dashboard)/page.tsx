'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, BookOpen, Users, Calendar, Loader2 } from 'lucide-react';
import api from '@/services/api';

export default function DashboardPage() {
  const [data, setData] = useState<{
    lessonCount: number;
    studentCount: number;
    upcomingSchedules: Array<{
      id: number;
      scheduledDate: string;
      lessonPlan: { title: string; subject: string };
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const stats = [
    {
      label: 'แผนการสอน',
      value: data?.lessonCount || 0,
      icon: BookOpen,
      color: 'from-indigo-400 to-indigo-600',
      accent: '#818cf8',
    },
    {
      label: 'นักเรียนทั้งหมด',
      value: data?.studentCount || 0,
      icon: Users,
      color: 'from-emerald-400 to-emerald-600',
      accent: '#34d399',
    },
    {
      label: 'กิจกรรมที่กำลังจะมาถึง',
      value: data?.upcomingSchedules?.length || 0,
      icon: Calendar,
      color: 'from-purple-400 to-purple-600',
      accent: '#a78bfa',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
        </div>
        <p className="text-slate-500 text-sm">ภาพรวมระบบวางแผนการสอนอัจฉริยะ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ '--card-accent': stat.accent } as React.CSSProperties}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Schedules */}
      <div className="glass p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          กิจกรรมที่กำลังจะมาถึง
        </h2>
        {data?.upcomingSchedules && data.upcomingSchedules.length > 0 ? (
          <div className="space-y-3">
            {data.upcomingSchedules.map((schedule) => (
              <div key={schedule.id} className="glass-light p-4 list-item">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{schedule.lessonPlan.title}</p>
                    <p className="text-sm text-slate-500">{schedule.lessonPlan.subject}</p>
                  </div>
                  <span className="badge badge-primary">
                    {new Date(schedule.scheduledDate).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-8">ไม่มีกิจกรรมที่กำลังจะมาถึง</p>
        )}
      </div>
    </div>
  );
}
