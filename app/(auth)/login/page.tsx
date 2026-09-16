'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AuthSlideCard from '@/components/AuthSlideCard';

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-8 overflow-hidden bg-slate-50/50">
      {/* ─── Ambient Glowing Background Effects ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 -right-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl animate-pulse delay-1000" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="w-full max-w-4xl animate-fade-in-up">
        <Suspense
          fallback={
            <div className="min-h-[620px] bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          }
        >
          <AuthSlideCard initialMode="login" />
        </Suspense>
      </div>
    </div>
  );
}
