'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, BookOpen, Calendar, Users,
  FileText, LogOut, Menu, GraduationCap,
  Presentation, CheckCircle, Award, CheckSquare
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'แดชบอร์ด' },
  { path: '/classrooms', icon: Presentation, label: 'ห้องเรียน' },
  { path: '/schedule', icon: Calendar, label: 'ตารางสอน' },
  { path: '/students', icon: Users, label: 'นักเรียน' },
  { path: '/attendance', icon: CheckCircle, label: 'เช็คชื่อ' },
  { path: '/scores', icon: CheckSquare, label: 'คะแนนรายสัปดาห์' },
  { path: '/grades', icon: Award, label: 'ตัดเกรด' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-slate-500 text-sm">กำลังโหลด...</p>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-indigo-100/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[270px]
        bg-white/80 backdrop-blur-2xl
        border-r border-indigo-200/40
        flex flex-col
        transition-transform duration-300 ease-in-out
        shadow-lg shadow-indigo-100/30
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-400 via-purple-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-300/30 animate-pulse-glow">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[1.05rem] font-bold gradient-text">
                Smart Planner
              </h1>
              <p className="text-[0.62rem] text-slate-600 tracking-wider font-medium">
                ระบบวางแผนการสอนอัจฉริยะ
              </p>
            </div>
          </div>
        </div>

        <div className="divider mx-5" />

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1">
          <p className="text-[0.6rem] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
            เมนูหลัก
          </p>
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[0.82rem] font-medium transition-all duration-300 group ${
                  isActive
                    ? 'bg-indigo-100/70 text-indigo-600 shadow-sm shadow-indigo-200/40 border border-indigo-200/50'
                    : 'text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-600 border border-transparent'
                }`}
              >
                <Icon className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-110" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 pt-2">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/30 p-3.5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xl shadow-sm">
                {animalAvatars[(user?.id || 1) % animalAvatars.length]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
                <p className="text-[0.62rem] text-indigo-400 font-medium">
                  {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl hover:bg-rose-100 text-slate-600 hover:text-rose-500 transition-all duration-300"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white/80 backdrop-blur-xl border-b border-indigo-200/30 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold gradient-text">Smart Planner</h1>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
