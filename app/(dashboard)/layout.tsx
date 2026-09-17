'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Calendar, Users,
  LogOut, Menu, GraduationCap,
  Presentation, CheckCircle, Award, CheckSquare,
  Smile, UserCog, Mail, Layers, type LucideIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import UserAvatar from '@/components/UserAvatar';
import SemesterSwitcher from '@/components/SemesterSwitcher';

interface NavSection {
  title?: string;
  items: {
    path: string;
    icon: LucideIcon;
    label: string;
  }[];
}

const navSections: NavSection[] = [
  {
    items: [
      { path: '/', icon: LayoutDashboard, label: 'แดชบอร์ด' },
    ],
  },
  {
    title: 'การจัดการชั้นเรียน',
    items: [
      { path: '/semesters', icon: Layers, label: 'ภาคเรียน' },
      { path: '/classrooms', icon: Presentation, label: 'ห้องเรียน' },
      { path: '/schedule', icon: Calendar, label: 'ตารางสอน' },
      { path: '/students', icon: Users, label: 'นักเรียน' },
    ],
  },
  {
    title: 'การวัดและประเมินผล',
    items: [
      { path: '/attendance', icon: CheckCircle, label: 'เช็คชื่อ' },
      { path: '/affective', icon: Smile, label: 'คะแนนจิตพิสัย' },
      { path: '/scores', icon: CheckSquare, label: 'คะแนนรายสัปดาห์' },
      { path: '/grades', icon: Award, label: 'ตัดเกรด' },
    ],
  },
  {
    title: 'ระบบและบัญชี',
    items: [
      { path: '/profile', icon: UserCog, label: 'โปรไฟล์' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      document.cookie = 'token=; Max-Age=0; path=/;';
      window.location.href = '/login';
      return;
    }
    if (!loading && user && user.emailVerified === false) {
      router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-600 text-sm font-medium">กำลังโหลด...</p>
      </div>
    );
  }

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
        <div className="p-6 pb-3">
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

        {/* Semester Switcher */}
        <div className="px-4 pb-2">
          <SemesterSwitcher />
        </div>

        <div className="divider mx-5" />

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-3 overflow-y-auto min-h-0">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.title && (
                <p className="text-[0.62rem] font-bold text-slate-400 uppercase tracking-wider px-3 pt-1.5 pb-0.5">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ path, icon: Icon, label }) => {
                  const isActive = pathname === path;
                  return (
                    <Link
                      key={path}
                      href={path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-[0.82rem] font-medium transition-all duration-200 group ${
                        isActive
                          ? 'bg-indigo-100/80 text-indigo-700 font-bold shadow-xs shadow-indigo-200/40 border border-indigo-200/60'
                          : 'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-600 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 pt-2">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/30 p-3.5 rounded-2xl transition-all duration-300 hover:shadow-md hover:border-indigo-300/60">
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-3 flex-1 min-w-0 group"
                title="แก้ไขข้อมูลส่วนตัว"
              >
                <UserAvatar
                  avatar={user?.avatar}
                  name={user?.name}
                  userId={user?.id}
                  size="md"
                  className="transition-transform duration-300 group-hover:scale-110 shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                    {user?.name}
                  </p>
                  <p className="text-[0.62rem] text-indigo-400 font-medium">
                    {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
                  </p>
                </div>
              </Link>
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
        <header className="lg:hidden bg-white/80 backdrop-blur-xl border-b border-indigo-200/30 px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-500" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <GraduationCap className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-sm font-bold gradient-text hidden xs:inline-block">Smart Planner</h1>
            </div>
          </div>
          <div className="w-48 max-w-[55%]">
            <SemesterSwitcher isCompact />
          </div>
        </header>

        {/* Unverified Email Warning Banner */}
        {user && user.emailVerified === false && (
          <div className="mt-4 mx-4 lg:mx-8 p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-amber-900 font-medium truncate">
                กรุณายืนยันอีเมล ({user.email})
              </span>
            </div>
            <Link
              href={`/verify-email?email=${encodeURIComponent(user.email)}`}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-all shrink-0"
            >
              ยืนยันอีเมล
            </Link>
          </div>
        )}

        <div className="flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
