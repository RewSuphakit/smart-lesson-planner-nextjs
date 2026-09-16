'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  GraduationCap, Loader2, Mail, Lock, User, 
  Eye, EyeOff, Sparkles, ArrowRight, Check, X,
  KeyRound, RotateCcw, ArrowLeft, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import GoogleSignInButton from '@/components/GoogleSignInButton';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, verifyEmail, resendCode } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Check URL query parameters (e.g. redirected from login with ?step=verify&email=...)
  useEffect(() => {
    const urlStep = searchParams.get('step');
    const urlEmail = searchParams.get('email');
    if (urlStep === 'verify' && urlEmail) {
      setEmail(urlEmail);
      setStep('verify');
      setCountdown(60);
    }
  }, [searchParams]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: 'bg-slate-200' };
    if (password.length < 6) return { level: 1, text: 'สั้นเกินไป (อย่างน้อย 6 ตัว)', color: 'bg-rose-500' };
    
    let score = 1;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 2, text: 'ปานกลาง', color: 'bg-amber-500' };
    return { level: 3, text: 'ปลอดภัยสูง', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength();
  const isMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Step 1: Submit Registration Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    if (password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setLoading(true);
    try {
      const res = (await register(name, email, password)) as { requireVerification?: boolean; message?: string; devCode?: string; warning?: string };
      if (res.requireVerification) {
        setStep('verify');
        setCountdown(60);
        if (res.devCode) {
          setDevOtp(res.devCode);
        }
        if (res.warning) {
          setWarningMsg(res.warning);
        }
        toast.success(res.message || 'ส่งรหัสยืนยัน 6 หลักไปยังอีเมลของคุณแล้ว!');
      } else {
        toast.success('สมัครสมาชิกสำเร็จ!');
        router.push('/');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP Verification Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otp.trim();
    if (cleanCode.length !== 6) {
      toast.error('กรุณากรอกรหัสยืนยัน 6 หลักให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(email, cleanCode);
      toast.success('ยืนยันอีเมลและเปิดใช้งานบัญชีสำเร็จ! กำลังเข้าสู่ระบบ...');
      router.push('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      const res = (await resendCode(email)) as { message?: string; devCode?: string; warning?: string };
      setCountdown(60);
      if (res.devCode) {
        setDevOtp(res.devCode);
      }
      if (res.warning) {
        setWarningMsg(res.warning);
      }
      toast.success(res.message || 'ส่งรหัสยืนยันใหม่ไปยังอีเมลเรียบร้อยแล้ว!');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'การส่งรหัสล้มเหลว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-8 overflow-hidden bg-slate-50/50">
      {/* ─── Ambient Glowing Background Effects ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200/50 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl animate-pulse delay-1000" />
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
          
          {/* STEP 1: Registration Form */}
          {step === 'form' && (
            <>
              {/* Header Brand */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-600 text-[11px] font-medium mb-3 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>สร้างบัญชีผู้ใช้งานใหม่</span>
                </div>

                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white mb-3 hover:scale-105 transition-transform duration-300">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  สมัครสมาชิก
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  กรอกข้อมูลเพื่อเริ่มต้นใช้งานระบบวางแผนการสอน
                </p>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-3.5">
                {/* Full Name Field */}
                <div>
                  <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                    ชื่อ-นามสกุล
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      className="form-input pl-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all font-normal"
                      placeholder="ครูสมชาย ใจดี"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

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
                      placeholder="teacher@school.ac.th"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-500 inline" />
                    ระบบจะส่งรหัส 6 หลักไปยังอีเมลจริงเพื่อยืนยันตัวตน
                  </p>
                </div>

                {/* Password Field */}
                <div>
                  <label className="form-label text-xs font-semibold text-slate-700 mb-1.5 block">
                    รหัสผ่าน
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input pl-11 pr-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all font-normal"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
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

                  {/* Password Strength Meter */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 h-1">
                        <div className={`flex-1 rounded-full transition-colors ${strength.level >= 1 ? strength.color : 'bg-slate-200'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${strength.level >= 2 ? strength.color : 'bg-slate-200'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${strength.level >= 3 ? strength.color : 'bg-slate-200'}`} />
                      </div>
                      <p className="text-[10px] text-slate-400 flex justify-between">
                        <span>ความปลอดภัย: <span className="font-medium text-slate-600">{strength.text}</span></span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label text-xs font-semibold text-slate-700 block mb-0">
                      ยืนยันรหัสผ่าน
                    </label>
                    {confirmPassword && (
                      <span className={`text-[11px] flex items-center gap-1 font-medium ${isMatch ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {isMatch ? (
                          <>
                            <Check className="w-3 h-3" />
                            รหัสผ่านตรงกัน
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            ไม่ตรงกัน
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`form-input pl-11 pr-11 py-2.5 text-sm rounded-xl bg-slate-50/60 focus:bg-white transition-all font-normal ${
                        isMismatch 
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200' 
                          : isMatch 
                          ? 'border-emerald-300 focus:border-emerald-500' 
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                      placeholder="พิมพ์รหัสผ่านอีกครั้ง"
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
                        <span>สมัครสมาชิกและรับรหัส OTP</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white/95 px-3 text-[11px] text-slate-400 font-normal shrink-0">
                    หรือสมัครสมาชิกด้วย
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                {/* Google Sign-in */}
                <GoogleSignInButton text="signup_with" />
              </form>

              {/* Switch to Login */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  มีบัญชีผู้ใช้งานอยู่แล้ว?{' '}
                  <Link 
                    href="/login" 
                    className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors hover:underline"
                  >
                    เข้าสู่ระบบที่นี่
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* STEP 2: Email OTP Verification */}
          {step === 'verify' && (
            <div className="animate-fade-in">
              {/* Back to Edit Button */}
              <button
                type="button"
                onClick={() => setStep('form')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium mb-4 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูล / เปลี่ยนอีเมล</span>
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100/70 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                  <Mail className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  ยืนยันอีเมล
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ส่งรหัส 6 หลักไปที่ <span className="font-semibold text-slate-700">{email}</span>
                </p>
              </div>

              {/* Dev Mode Banner if SMTP is not configured */}
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
                <div>
                  <label className="form-label text-xs font-semibold text-slate-700 mb-2 text-center block">
                    กรอกรหัสยืนยัน 6 หลัก
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center justify-center">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      className="form-input pl-11 py-3 text-center text-2xl font-mono tracking-[0.5em] font-bold rounded-xl bg-slate-50/70 focus:bg-white border-slate-200 focus:border-indigo-500 transition-all text-indigo-900"
                      placeholder="······"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(val);
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn btn-primary w-full py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>ยืนยันรหัส OTP และเริ่มใช้งาน</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend Section */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-2">
                  ไม่ได้รับอีเมลหรือรหัสหมดอายุ?
                </p>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={countdown > 0 || resending}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 transition-colors"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งรหัสใหม่...</span>
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 opacity-50" />
                      <span>ส่งรหัสใหม่อีกครั้งได้ใน ({countdown}s)</span>
                    </>
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

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Smart Lesson Planner · เพื่อการจัดการเรียนการสอนครูไทย
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
