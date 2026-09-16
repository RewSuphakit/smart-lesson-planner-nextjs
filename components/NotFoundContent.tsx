'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Search,
  RotateCcw,
} from 'lucide-react';

export default function NotFoundContent() {
  const router = useRouter();

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-50/60">
      {/* ─── Ambient Glow Background ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl animate-pulse delay-1000" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="w-full max-w-lg animate-fade-in-up py-8">
        {/* ─── Main Glass Card ─── */}
        <div className="bg-white/90 backdrop-blur-2xl border border-slate-200/80 shadow-2xl shadow-indigo-500/10 rounded-3xl p-6 sm:p-10 relative overflow-hidden text-center">
          {/* Top Decorative Gradient Bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />

          {/* System Tag */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100/90 text-indigo-600 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Smart Lesson Planner • ระบบวางแผนการสอนอัจฉริยะ</span>
          </div>

          {/* Central Animated Illustration */}
          <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
            {/* Pulsing Backlight Rings */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-200/50 to-purple-200/50 blur-xl animate-pulse" />
            <div className="absolute -inset-2 rounded-full border border-indigo-200/60 border-dashed animate-spin-slow" style={{ animationDuration: '30s' }} />

            {/* Central Mascot Badge */}
            <div className="relative w-22 h-22 p-5 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 transform hover:scale-105 transition-transform duration-300">
              <GraduationCap className="w-12 h-12 text-white drop-shadow-md animate-float" />
              
              {/* Search Badge Floating */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-amber-950">
                <Search className="w-4 h-4" />
              </div>
            </div>

            {/* Floating Error Badge */}
            <div className="absolute -top-1 -left-1 px-2.5 py-0.5 rounded-full bg-rose-500/90 backdrop-blur-md text-white text-[11px] font-bold shadow-md border border-white/80">
              404
            </div>
          </div>

          {/* Big Gradient 404 & Heading */}
          <div className="space-y-2 mb-6">
            <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight gradient-text leading-none select-none">
              404
            </h1>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              ไม่พบหน้าที่คุณค้นหา
            </h2>
            <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
              ขออภัย หน้าเว็บที่คุณกำลังเรียกดูอาจถูกย้าย ลบ เปลี่ยนชื่อ หรือที่อยู่ URL ไม่ถูกต้องในระบบ
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <Link
              href="/"
              className="btn btn-primary px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/25 text-white font-medium inline-flex items-center gap-2 group transition-all"
              id="btn-back-home"
            >
              <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>กลับสู่หน้าหลัก</span>
            </Link>

            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-ghost px-5 py-3 rounded-xl text-slate-700 bg-white/80 hover:bg-slate-100/80 border border-slate-200/90 font-medium inline-flex items-center gap-2 transition-all shadow-xs"
              id="btn-go-back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ย้อนกลับไปหน้าเดิม</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="p-3 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60 border border-transparent hover:border-indigo-100 transition-all"
              title="โหลดหน้าเว็บใหม่"
              aria-label="โหลดหน้าเว็บใหม่"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* ─── Footer Support Hint ─── */}
          <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              พบปัญหาการใช้งาน?{' '}
              <span className="text-slate-600 font-medium">
                ติดต่อฝ่ายสนับสนุน
              </span>
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Error Code: 404_PAGE_NOT_FOUND
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
