'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import toast from 'react-hot-toast';
import {
  KeyRound, Loader2, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, RefreshCw,
  Sparkles, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

interface ApiError {
  response?: {
    data?: {
      message?: string;
      devCode?: string;
      isDevMode?: boolean;
    };
  };
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Step 1: 'request' (enter email) | Step 2: 'reset' (enter OTP + new password) | Step 3: 'success'
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Step 1: Request OTP code
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('กรุณากรอกอีเมลของคุณ');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: cleanEmail });
      toast.success(data.message || 'ส่งรหัส OTP เรียบร้อยแล้ว');

      setCountdown(60);
      setStep('reset');
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err.response?.data?.message || 'ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend OTP code
  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: cleanEmail });
      toast.success('ส่งรหัส OTP ใหม่เรียบร้อยแล้ว');

      setCountdown(60);
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err.response?.data?.message || 'ส่งรหัสไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      toast.error('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: cleanEmail,
        code: cleanCode,
        newPassword,
      });

      toast.success(data.message || 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว');
      setStep('success');
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err.response?.data?.message || 'การรีเซ็ตรหัสผ่านล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-50/50">
      {/* ─── Ambient Glowing Background Effects ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 -right-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-100/50 rounded-full blur-3xl animate-pulse delay-1000" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        {/* ─── Main Card ─── */}
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl shadow-indigo-500/10 rounded-3xl p-8 sm:p-9 relative">

          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-[11px] font-medium mb-4 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>ระบบกู้คืนบัญชีผู้ใช้งาน</span>
            </div>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/25 text-white mb-3 hover:scale-105 transition-transform duration-300">
              <KeyRound className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {step === 'success'
                ? 'เปลี่ยนรหัสผ่านสำเร็จ!'
                : step === 'reset'
                ? 'ตั้งรหัสผ่านใหม่'
                : 'ลืมรหัสผ่าน?'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {step === 'success'
                ? 'คุณสามารถใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที'
                : step === 'reset'
                ? `กรอกรหัส OTP 6 หลักที่ส่งไปยัง ${email}`
                : 'ระบุอีเมลที่ใช้ลงทะเบียนเพื่อรับรหัส OTP รีเซ็ตรหัสผ่าน'}
            </p>
          </div>

          {/* ─── STEP 1: Enter Email ─── */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                  อีเมลของคุณ
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-amber-600 transition-colors flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    className="form-input pl-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-amber-500 transition-all font-normal"
                    placeholder="กรอกอีเมลที่ใช้ลงทะเบียน"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all group flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-600 hover:opacity-95 text-white border-none"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>ส่งรหัส OTP ยืนยัน</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ─── STEP 2: Enter OTP & New Password ─── */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Target Email display with change button */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 truncate">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-amber-600 hover:text-amber-700 font-semibold text-[11px] shrink-0 hover:underline ml-2"
                >
                  เปลี่ยนอีเมล
                </button>
              </div>

              {/* OTP Code Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label text-xs font-semibold text-slate-700 block mb-0">
                    รหัส OTP 6 หลัก
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || loading}
                    className={`text-[11px] flex items-center gap-1 transition-colors ${
                      countdown > 0
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-amber-600 hover:text-amber-700 font-medium hover:underline'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    {countdown > 0 ? `ขอรหัสใหม่ใน (${countdown}s)` : 'ส่งรหัสใหม่'}
                  </button>
                </div>
                <div className="relative group">
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input text-center py-2.5 text-lg font-mono tracking-[0.5em] rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-amber-500 transition-all font-bold text-slate-800"
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 text-center leading-relaxed">
                  รหัสมีอายุ 15 นาที (หากไม่พบในกล่องข้อความ โปรดตรวจดูในโฟลเดอร์ <strong>อีเมลขยะ / Spam</strong>)
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                  รหัสผ่านใหม่
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-amber-600 transition-colors flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pl-11 pr-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-amber-500 transition-all font-normal"
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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

              {/* Confirm New Password */}
              <div>
                <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-amber-600 transition-colors flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input pl-11 pr-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-amber-500 transition-all font-normal"
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors focus:outline-none"
                    aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all group flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-600 hover:opacity-95 text-white border-none"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>ยืนยันและเปลี่ยนรหัสผ่าน</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ─── STEP 3: Success Screen ─── */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-5 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-slate-800">
                  ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  ระบบได้อัปเดตรหัสผ่านใหม่ของคุณเรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <span>เข้าสู่ระบบทันที</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── Back to Login Link ─── */}
          {step !== 'success' && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>จำรหัสผ่านได้แล้ว? กลับไปหน้าเข้าสู่ระบบ</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Smart Lesson Planner · เพื่อความปลอดภัยของข้อมูลคุณครู
        </p>
      </div>
    </div>
  );
}
