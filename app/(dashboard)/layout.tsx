'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Calendar, Users,
  LogOut, Menu, GraduationCap,
  Presentation, CheckCircle, Award, CheckSquare,
  Smile, UserCog, Mail, Layers, ChevronsLeft,
  type LucideIcon
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

function NavItem({
  path,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onNavigate,
}: {
  path: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const itemRef = useRef<HTMLAnchorElement>(null);

  const handleMouseEnter = () => {
    if (isCollapsed && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  useEffect(() => {
    if (!showTooltip) return;
    const hide = () => setShowTooltip(false);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [showTooltip]);

  return (
    <>
      <Link
        ref={itemRef}
        href={path}
        onClick={() => {
          setShowTooltip(false);
          onNavigate();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={isCollapsed ? label : undefined}
        className={`flex items-center rounded-xl text-[0.82rem] font-medium transition-colors duration-150 group relative h-10 w-full overflow-hidden ${
          isCollapsed
            ? 'px-3 justify-start gap-3 lg:px-2.5 lg:justify-center lg:gap-0'
            : 'px-3 justify-start gap-3'
        } ${
          isActive
            ? 'bg-indigo-100/80 text-indigo-700 font-bold shadow-xs border border-indigo-200/60'
            : 'text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-600 border border-transparent'
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <Icon
            className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110 shrink-0 ${
              isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'
            }`}
          />
        </div>
        <span
          className={`truncate whitespace-nowrap transition-all duration-300 ease-in-out ${
            isCollapsed
              ? 'max-w-[160px] opacity-100 translate-x-0 lg:max-w-0 lg:opacity-0 lg:-translate-x-2'
              : 'max-w-[160px] opacity-100 translate-x-0'
          }`}
        >
          {label}
        </span>
      </Link>

      {/* Floating Tooltip when collapsed on desktop */}
      {showTooltip && isCollapsed && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 99999,
          }}
          className="pointer-events-none px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold rounded-xl shadow-xl shadow-slate-950/25 whitespace-nowrap animate-fade-in flex items-center gap-1.5 border border-slate-700/60"
        >
          <span>{label}</span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function CollapsedTooltip<T extends HTMLElement>({
  label,
  enabled = true,
  children,
}: {
  label: string;
  enabled?: boolean;
  children: (props: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    ref: React.RefObject<T | null>;
  }) => React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<T | null>(null);

  const onMouseEnter = () => {
    if (!enabled) return;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
      setShow(true);
    }
  };

  const onMouseLeave = () => setShow(false);

  useEffect(() => {
    if (!show) return;
    const hide = () => setShow(false);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [show]);

  return (
    <>
      {children({ onMouseEnter, onMouseLeave, ref })}
      {show && enabled && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 99999,
          }}
          className="pointer-events-none px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold rounded-xl shadow-xl shadow-slate-950/25 whitespace-nowrap animate-fade-in border border-slate-700/60"
        >
          {label}
        </div>,
        document.body
      )}
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore collapsed preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smart_planner_sidebar_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('smart_planner_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [sidebarOpen]);

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
    <div className="flex min-h-screen w-full overflow-x-hidden">
      {/* Mobile overlay - zero blur for 60fps mobile animation */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - GPU accelerated with smooth width and transform transitions */}
      <aside className={`
        fixed lg:sticky lg:top-0 h-screen h-[100dvh] max-h-screen inset-y-0 left-0 z-50 shrink-0
        ${isCollapsed ? 'w-[270px] lg:w-[76px]' : 'w-[270px]'}
        bg-white lg:bg-white/80 lg:backdrop-blur-2xl
        border-r border-indigo-200/40
        flex flex-col justify-between overflow-x-hidden
        ${mounted ? 'transition-[width,transform] duration-300 ease-in-out' : ''}
        shadow-2xl shadow-indigo-950/20 lg:shadow-lg lg:shadow-indigo-100/30
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo and Collapse Toggle */}
        <div className={`shrink-0 transition-all duration-300 ${isCollapsed ? 'p-3.5 lg:p-3 pb-2' : 'p-4 pb-2'}`}>
          <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'justify-between lg:flex-col lg:gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <div
                className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shadow-md shadow-indigo-300/30 animate-pulse-glow shrink-0 border border-indigo-200/50 cursor-pointer hover:scale-105 transition-transform"
                onClick={isCollapsed ? toggleSidebar : undefined}
                title={isCollapsed ? 'คลิกเพื่อขยายเมนู' : 'Smart Planner'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Smart Planner Logo" className="w-full h-full object-cover" />
              </div>
              <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? 'max-w-[140px] opacity-100 lg:max-w-0 lg:opacity-0 lg:-translate-x-2'
                  : 'max-w-[140px] opacity-100 translate-x-0'
              }`}>
                <h1 className="text-[1.05rem] font-bold gradient-text whitespace-nowrap">
                  Smart Planner
                </h1>
              </div>
            </div>

            {/* Collapse / Expand Toggle Button (Desktop) */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู (เหลือแต่ไอคอน)'}
              aria-label={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
              className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 shrink-0 ${
                isCollapsed
                  ? 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-600 shadow-2xs'
                  : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
              }`}
            >
              <ChevronsLeft className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Semester Switcher */}
        <div className={`pb-2 relative z-30 shrink-0 transition-all duration-300 ${isCollapsed ? 'px-3 lg:px-2' : 'px-3'}`}>
          <SemesterSwitcher isCollapsed={isCollapsed} />
        </div>

        <div className={`shrink-0 transition-all duration-300 ${isCollapsed ? 'divider mx-3 lg:mx-2 opacity-50' : 'divider mx-4 opacity-100'}`} />

        {/* Navigation */}
        <nav className={`flex-1 py-2 space-y-3 overflow-y-auto min-h-0 transition-all duration-300 ${
          isCollapsed ? 'px-3 lg:px-2' : 'px-3'
        }`}>
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.title && (
                <div className="overflow-hidden transition-all duration-300 ease-in-out">
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                    isCollapsed
                      ? 'max-h-8 opacity-100 my-1 lg:max-h-0 lg:opacity-0 lg:-translate-y-1 lg:my-0'
                      : 'max-h-8 opacity-100 translate-y-0 my-1'
                  }`}>
                    <p className="text-[0.62rem] font-bold text-slate-400 uppercase tracking-wider px-3.5 pt-1.5 pb-0.5">
                      {section.title}
                    </p>
                  </div>
                  {/* Subtle separator when collapsed on desktop */}
                  <div className={`transition-all duration-300 ease-in-out hidden lg:flex justify-center overflow-hidden ${
                    isCollapsed
                      ? 'max-h-4 opacity-100 my-2'
                      : 'max-h-0 opacity-0 my-0 pointer-events-none'
                  }`}>
                    <div className="w-7 h-[1px] bg-slate-200/80 shrink-0" />
                  </div>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ path, icon, label }) => (
                  <NavItem
                    key={path}
                    path={path}
                    icon={icon}
                    label={label}
                    isActive={pathname === path}
                    isCollapsed={isCollapsed}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className={`pt-2 shrink-0 border-t border-indigo-100/60 bg-white/95 transition-all duration-300 ${
          isCollapsed ? 'p-3 lg:p-2' : 'p-3'
        }`}>
          <div className={`rounded-2xl transition-all duration-300 ${
            isCollapsed
              ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/40 p-2.5 shadow-2xs lg:bg-transparent lg:border-transparent lg:p-0 lg:shadow-none'
              : 'bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/40 p-2.5 shadow-2xs'
          }`}>
            <div className={`flex items-center transition-all duration-300 ${
              isCollapsed ? 'justify-between gap-2.5 lg:flex-col lg:gap-2' : 'justify-between gap-2.5'
            }`}>
              <CollapsedTooltip<HTMLAnchorElement>
                label={`โปรไฟล์: ${user?.name || ''} (${user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'})`}
                enabled={isCollapsed}
              >
                {({ onMouseEnter, onMouseLeave, ref }) => (
                  <Link
                    ref={ref}
                    href="/profile"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    className={`flex items-center rounded-xl transition-all duration-300 min-w-0 group ${
                      isCollapsed ? 'gap-2.5 flex-1 lg:p-1 lg:hover:bg-indigo-50 lg:justify-center lg:flex-initial' : 'gap-2.5 flex-1'
                    }`}
                    title="แก้ไขข้อมูลส่วนตัว"
                  >
                    <UserAvatar
                      avatar={user?.avatar}
                      name={user?.name}
                      userId={user?.id}
                      size="md"
                      className="transition-transform duration-300 group-hover:scale-105 shadow-xs shrink-0"
                    />
                    <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
                      isCollapsed
                        ? 'max-w-[130px] opacity-100 lg:max-w-0 lg:opacity-0 lg:-translate-x-2'
                        : 'max-w-[130px] opacity-100 translate-x-0'
                    }`}>
                      <p className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                        {user?.name}
                      </p>
                      <p className="text-[0.65rem] text-indigo-700 font-semibold truncate whitespace-nowrap">
                        {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
                      </p>
                    </div>
                  </Link>
                )}
              </CollapsedTooltip>

              <CollapsedTooltip<HTMLButtonElement>
                label="ออกจากระบบ"
                enabled={isCollapsed}
              >
                {({ onMouseEnter, onMouseLeave, ref }) => (
                  <button
                    ref={ref}
                    onClick={handleLogout}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    className={`rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                      isCollapsed
                        ? 'p-2 hover:bg-rose-100 text-slate-400 hover:text-rose-600 lg:w-9 lg:h-9 lg:p-0 lg:hover:bg-rose-50 lg:hover:text-rose-500'
                        : 'p-2 hover:bg-rose-100 text-slate-400 hover:text-rose-600'
                    }`}
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                  </button>
                )}
              </CollapsedTooltip>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 lg:hidden bg-white/95 border-b border-indigo-200/40 px-3 py-2.5 flex items-center justify-between gap-2 shadow-xs">
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
          <div className="flex items-center gap-1.5 max-w-[62%]">
            <div className="flex-1 min-w-0">
              <SemesterSwitcher isCompact />
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
            </button>
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
