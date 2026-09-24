'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap, Loader2, Mail, Lock, User,
  Eye, EyeOff, ArrowRight, Check,
  KeyRound, RotateCcw, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import Turnstile, { TurnstileRef } from '@/components/Turnstile';

interface AuthSlideCardProps {
  initialMode?: 'login' | 'register';
}

export default function AuthSlideCard({ initialMode = 'login' }: AuthSlideCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, verifyEmail, resendCode } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // ─── Login States ───
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);

  // ─── Register States ───
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('remembered_email');
      if (savedEmail) {
        setLoginEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Check URL query parameters (e.g. redirected with ?step=verify&email=...)
  useEffect(() => {
    const urlStep = searchParams.get('step');
    const urlEmail = searchParams.get('email');
    if (urlStep === 'verify' && urlEmail) {
      setRegEmail(urlEmail);
      setMode('register');
      setRegisterStep('verify');
      setCountdown(60);
    }
  }, [searchParams]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Password strength calculation (minimal 3-level)
  const getPasswordLevel = () => {
    if (!regPassword) return 0;
    if (regPassword.length < 6) return 1;
    let score = 1;
    if (regPassword.length >= 8) score++;
    if (/[A-Z]/.test(regPassword) || /[0-9]/.test(regPassword) || /[^A-Za-z0-9]/.test(regPassword)) score++;
    return score;
  };

  const passwordLevel = getPasswordLevel();
  const isMatch = regConfirmPassword.length > 0 && regPassword === regConfirmPassword;
  const isMismatch = regConfirmPassword.length > 0 && regPassword !== regConfirmPassword;

  // Switch mode handler with smooth URL update
  const handleSwitchMode = (newMode: 'login' | 'register') => {
    if (mode === newMode) return;
    setMode(newMode);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', newMode === 'login' ? '/login' : '/register');
    }
  };

  // ─── Submit Login ───
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      try {
        if (rememberMe) {
          localStorage.setItem('remembered_email', loginEmail);
        } else {
          localStorage.removeItem('remembered_email');
        }
      } catch {
        // Ignore
      }

      await login(loginEmail, loginPassword, rememberMe, turnstileToken || undefined);
      toast.success('เข้าสู่ระบบสำเร็จ!');
      router.push('/');
    } catch (error: unknown) {
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      const err = error as { response?: { data?: { message?: string; requireVerification?: boolean; email?: string } } };
      if (err.response?.data?.requireVerification) {
        toast('กรุณายืนยันอีเมลก่อนเข้าใช้งาน', {
          icon: '📧',
          duration: 3000,
        });
        const targetEmail = err.response.data.email || loginEmail;
        router.push(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
      } else {
        toast.error(err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── Submit Registration Form ───
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setRegLoading(true);
    try {
      const res = (await register(regName, regEmail, regPassword)) as {
        requireVerification?: boolean;
        message?: string;
        devCode?: string;
      };
      if (res.requireVerification) {
        setRegisterStep('verify');
        setCountdown(60);
        if (res.devCode) {
          setDevOtp(res.devCode);
        }
        toast.success(res.message || 'ส่งรหัสยืนยันไปยังอีเมลแล้ว');
      } else {
        toast.success('สมัครสมาชิกสำเร็จ!');
        router.push('/');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setRegLoading(false);
    }
  };

  // ─── Submit OTP Verification ───
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otp.trim();
    if (cleanCode.length !== 6) {
      toast.error('กรุณากรอกรหัสยืนยัน 6 หลัก');
      return;
    }

    setRegLoading(true);
    try {
      await verifyEmail(regEmail, cleanCode);
      toast.success('ยืนยันอีเมลสำเร็จ กำลังเข้าสู่ระบบ...');
      router.push('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'รหัสยืนยันไม่ถูกต้อง');
    } finally {
      setRegLoading(false);
    }
  };

  // ─── Resend OTP Code ───
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      const res = (await resendCode(regEmail)) as { message?: string; devCode?: string };
      setCountdown(60);
      if (res.devCode) {
        setDevOtp(res.devCode);
      }
      toast.success(res.message || 'ส่งรหัสใหม่เรียบร้อยแล้ว');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'การส่งรหัสล้มเหลว');
    } finally {
      setResending(false);
    }
  };

  const isRegisterMode = mode === 'register';

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* ─── Main Card Container ─── */}
      <div className="relative bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-2xl shadow-indigo-950/5 rounded-3xl overflow-hidden min-h-[580px] flex flex-col md:flex-row transition-all duration-500">

        {/* ─── Mobile Segmented Control Tab (Visible only on < md) ─── */}
        <div className="md:hidden p-4 pb-0 z-30">
          <div className="relative bg-slate-100/90 p-1 rounded-2xl flex items-center">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm border border-slate-200/50 transition-transform duration-300 ease-out ${isRegisterMode ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                }`}
            />
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`relative z-10 flex-1 py-2 text-xs font-semibold text-center transition-colors ${!isRegisterMode ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`relative z-10 flex-1 py-2 text-xs font-semibold text-center transition-colors ${isRegisterMode ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              สมัครสมาชิก
            </button>
          </div>
        </div>

        {/* ─── Forms Area (Desktop: 50% width, sliding smoothly) ─── */}
        <div
          className={`w-full md:w-1/2 p-6 sm:p-10 z-10 transition-transform duration-700 ease-in-out md:absolute md:top-0 md:bottom-0 ${isRegisterMode ? 'md:translate-x-full' : 'md:translate-x-0'
            }`}
        >
          <div className="h-full flex flex-col justify-center">

            {/* ────── LOGIN FORM VIEW ────── */}
            <div
              className={`transition-all duration-500 ${!isRegisterMode
                ? 'opacity-100 translate-x-0 pointer-events-auto block'
                : 'opacity-0 -translate-x-6 pointer-events-none hidden md:hidden'
                }`}
            >
              {/* Clean Header */}
              <div className="mb-6">

                <h1 className="text-center text-3xl font-bold text-slate-800 tracking-tight">
                  เข้าสู่ระบบ
                </h1>

              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                    อีเมล
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      className="form-input pl-10 py-2.5 text-sm rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all w-full"
                      placeholder="teacher@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      รหัสผ่าน
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                    >
                      ลืมรหัสผ่าน?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      className="form-input pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all w-full"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                      aria-label={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>จดจำการเข้าสู่ระบบ</span>
                  </label>
                </div>

                {/* Cloudflare Turnstile Verification */}
                <Turnstile
                  ref={turnstileRef}
                  action="login"
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {loginLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white/95 px-3 text-[11px] text-slate-400 font-normal shrink-0">
                    หรือ
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                {/* Google Sign-in */}
                {!isRegisterMode && <GoogleSignInButton text="continue_with" />}
              </form>

              {/* Mobile Switch Link */}
              <div className="mt-5 pt-4 border-t border-slate-100 text-center md:hidden">
                <p className="text-xs text-slate-500">
                  ยังไม่มีบัญชี?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors hover:underline"
                  >
                    สมัครสมาชิก
                  </button>
                </p>
              </div>
            </div>

            {/* ────── REGISTER FORM VIEW ────── */}
            <div
              className={`transition-all duration-500 ${isRegisterMode
                ? 'opacity-100 translate-x-0 pointer-events-auto block'
                : 'opacity-0 translate-x-6 pointer-events-none hidden md:hidden'
                }`}
            >
              {registerStep === 'form' ? (
                <>
                  {/* Clean Register Header */}
                  <div className="mb-5">

                    <h2 className=" text-center  text-3xl font-bold text-slate-800 tracking-tight">
                      สร้างบัญชีใหม่
                    </h2>

                  </div>

                  {/* Register Form */}
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    {/* Name */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        ชื่อ-นามสกุล
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          className="form-input pl-10 py-2 text-sm rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all w-full"
                          placeholder="Name - Surname "
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        อีเมล
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          className="form-input pl-10 py-2 text-sm rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all w-full"
                          placeholder="Teacher@xample.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Password & Confirm Password (Clean Layout) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Password */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          รหัสผ่าน
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            className="form-input pl-9 pr-8 py-2 text-sm rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all w-full"
                            placeholder="6 ตัวขึ้นไป"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 block">
                            ยืนยันรหัส
                          </label>
                          {isMatch && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            className={`form-input pl-9 pr-8 py-2 text-sm rounded-xl bg-slate-50/70 focus:bg-white transition-all w-full ${isMismatch
                              ? 'border-rose-300 focus:border-rose-500'
                              : isMatch
                                ? 'border-emerald-300 focus:border-emerald-500'
                                : 'border-slate-200 focus:border-indigo-500'
                              }`}
                            placeholder="พิมพ์ซ้ำอีกครั้ง"
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Minimal Password Strength Indicator */}
                    {regPassword && (
                      <div className="flex gap-1 h-1 pt-0.5">
                        <div className={`flex-1 rounded-full transition-colors ${passwordLevel >= 1 ? (passwordLevel === 1 ? 'bg-rose-400' : passwordLevel === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${passwordLevel >= 2 ? (passwordLevel === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${passwordLevel >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={regLoading}
                      className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-sm mt-2"
                    >
                      {regLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>สร้างบัญชีและรับรหัส OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center my-2.5">
                      <div className="border-t border-slate-200 w-full" />
                      <span className="bg-white/95 px-3 text-[11px] text-slate-400 font-normal shrink-0">
                        หรือ
                      </span>
                      <div className="border-t border-slate-200 w-full" />
                    </div>

                    {/* Google Sign-in */}
                    {isRegisterMode && <GoogleSignInButton text="signup_with" />}
                  </form>

                  {/* Mobile Switch Link */}
                  <div className="mt-4 pt-3 border-t border-slate-100 text-center md:hidden">
                    <p className="text-xs text-slate-500">
                      มีบัญชีอยู่แล้ว?{' '}
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('login')}
                        className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors hover:underline"
                      >
                        เข้าสู่ระบบ
                      </button>
                    </p>
                  </div>
                </>
              ) : (
                /* ────── STEP 2: EMAIL OTP VERIFICATION ────── */
                <div className="py-2">
                  <button
                    type="button"
                    onClick={() => setRegisterStep('form')}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium mb-4 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>แก้ไขข้อมูล</span>
                  </button>

                  <div className="text-center mb-6">
                    <div className="w-11 h-11 mx-auto rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2.5">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                      ยืนยันอีเมล
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      กรอกรหัส 6 หลักที่ส่งไปที่ <span className="font-medium text-slate-700">{regEmail}</span>
                    </p>
                  </div>

                  {devOtp && (
                    <div className="mb-4 py-2 px-3 bg-amber-50 border border-amber-200/70 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-amber-800">
                        รหัสทดสอบ: <strong className="font-mono">{devOtp}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtp(devOtp)}
                        className="text-amber-700 hover:text-amber-900 underline font-medium"
                      >
                        ใส่รหัส
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        className="form-input pl-10 py-3 text-center text-2xl font-mono tracking-[0.4em] font-bold rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all text-indigo-900 w-full"
                        placeholder="······"
                        value={otp}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                          setOtp(val);
                        }}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading || otp.length !== 6}
                      className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      {regLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>ยืนยันรหัส OTP</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || resending}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 transition-colors"
                    >
                      {resending ? (
                        <span>กำลังส่งรหัสใหม่...</span>
                      ) : countdown > 0 ? (
                        <span>ส่งรหัสใหม่อีกครั้งได้ใน ({countdown}s)</span>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>กดส่งรหัสใหม่อีกครั้ง</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ─── Desktop Sliding Welcome Overlay Panel (50% width, minimal & elegant) ─── */}
        <div
          className={`hidden md:flex absolute top-0 bottom-0 w-1/2 z-20 transition-transform duration-700 ease-in-out ${isRegisterMode ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white p-10 flex flex-col justify-between items-center text-center shadow-2xl">
            {/* Soft Ambient Glows inside overlay */}
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top brand */}
            <div className="relative z-10 flex items-center gap-2 text-indigo-200 text-xs font-medium tracking-wide">
              <GraduationCap className="w-4 h-4 text-indigo-300" />
              <span>SMART LESSON PLANNER</span>
            </div>

            {/* Center Minimal Hero */}
            <div className="relative z-10 max-w-xs my-auto py-8">
              {isRegisterMode ? (
                <div className="animate-fade-in-up">
                  <h3 className="text-2xl font-bold mb-2.5 tracking-tight text-white">
                    มีบัญชีอยู่แล้ว?
                  </h3>
                  <p className="text-xs text-indigo-100/80 leading-relaxed mb-7 font-normal">

                  </p>

                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="px-7 py-2.5 rounded-full bg-white text-slate-800 hover:bg-indigo-50 font-semibold text-xs shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center gap-2"
                  >
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in-up">
                  <h3 className="text-2xl font-bold mb-2.5 tracking-tight text-white">
                    ยังไม่มีบัญชีผู้ใช้?
                  </h3>
                  <p className="text-xs text-indigo-100/80 leading-relaxed mb-7 font-normal">

                  </p>

                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="px-7 py-2.5 rounded-full bg-white text-slate-800 hover:bg-indigo-50 font-semibold text-xs shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center gap-2"
                  >
                    <span>สมัครสมาชิกใหม่</span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom minimal spacer */}
            <div className="relative z-10 text-[11px] text-indigo-200/50">
              @2026 RewSuphakit
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
