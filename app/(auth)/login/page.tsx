'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap, Loader2, Mail, Lock, Eye, EyeOff,
  Sparkles, ArrowRight, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Load remembered email on mount if user previously checked rememberMe
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Store or clear remembered email based on rememberMe checkbox
      try {
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
      } catch {
        // Ignore localStorage write errors
      }

      await login(email, password, rememberMe);
      toast.success('เข้าสู่ระบบสำเร็จ!');
      router.push('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; requireVerification?: boolean; email?: string } } };
      if (err.response?.data?.requireVerification) {
        toast('กรุณายืนยันอีเมลก่อนเข้าใช้งาน', {
          icon: '📧',
          duration: 3000,
        });
        const targetEmail = err.response.data.email || email;
        router.push(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
      } else {
        toast.error(err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-50/50">
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

      <div className="w-full max-w-md animate-fade-in-up">
        {/* ─── Card Container ─── */}
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl shadow-indigo-500/10 rounded-3xl p-8 sm:p-9 relative">
          {/* Header Brand */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-600 text-[11px] font-medium mb-4 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>ระบบวางแผนการสอนอัจฉริยะ</span>
            </div>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white mb-3 hover:scale-105 transition-transform duration-300">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              เข้าสู่ระบบ
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ลงชื่อเข้าใช้เพื่อจัดการตารางสอนและบันทึกคะแนน
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                อีเมล
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  className="form-input pl-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all font-normal"
                  placeholder="กรุณากรอกอีเมล"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label text-xs font-semibold text-slate-700 block mb-0">
                  รหัสผ่าน
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pl-11 pr-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all font-normal"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors focus:outline-none"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Options */}
            <div className="flex items-center justify-between pt-0.5 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-500">จดจำการเข้าสู่ระบบ</span>
              </label>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                เข้าสู่ระบบปลอดภัย
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all group flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white/95 px-3 text-[11px] text-slate-400 font-normal shrink-0">
                หรือ
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            {/* Google Sign-in */}
            <GoogleSignInButton text="continue_with" />
          </form>

          {/* Switch to Register */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              ยังไม่มีบัญชีผู้ใช้งาน?{' '}
              <Link
                href="/register"
                className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors hover:underline"
              >
                สมัครสมาชิกใหม่
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Smart Lesson Planner · เพื่อการจัดการเรียนการสอนครูไทย
        </p>
      </div>
    </div>
  );
}
