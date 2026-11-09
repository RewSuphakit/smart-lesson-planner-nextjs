'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from '@/lib/toast';
import { Mail, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';

interface ApiError {
  response?: {
    data?: {
      message?: string;
      devCode?: string;
      isDevMode?: boolean;
    };
  };
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const { updateUser, logout } = useAuth();

  const [activeMode, setActiveMode] = useState<'change' | 'existing'>('change');
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState('');
  const [changeStep, setChangeStep] = useState<'request' | 'verify'>('request');
  const [changeOtp, setChangeOtp] = useState('');
  const [loadingChange, setLoadingChange] = useState(false);
  const [devOtpChange, setDevOtpChange] = useState<string | null>(null);
  const [changeCountdown, setChangeCountdown] = useState(0);

  const [existingOtp, setExistingOtp] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [devOtpExisting, setDevOtpExisting] = useState<string | null>(null);
  const [existingCountdown, setExistingCountdown] = useState(0);

  useEffect(() => {
    if (initialEmail) {
      setCurrentEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (changeCountdown <= 0) return;
    const t = setInterval(() => setChangeCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [changeCountdown]);

  useEffect(() => {
    if (existingCountdown <= 0) return;
    const t = setInterval(() => setExistingCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [existingCountdown]);

  const handleRequestChangeOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCurrent = currentEmail.trim().toLowerCase();
    const cleanNew = newEmail.trim().toLowerCase();

    if (!cleanCurrent) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸à¸­à¸µà¹€à¸¡à¸¥à¹€à¸”à¸´à¸¡');
      return;
    }
    if (!cleanNew) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸à¸­à¸µà¹€à¸¡à¸¥à¹ƒà¸«à¸¡à¹ˆ');
      return;
    }
    if (cleanCurrent === cleanNew) {
      toast.error('à¸­à¸µà¹€à¸¡à¸¥à¹ƒà¸«à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¸­à¸µà¹€à¸¡à¸¥à¹€à¸”à¸´à¸¡');
      return;
    }

    setLoadingChange(true);
    try {
      const res = await api.post('/auth/change-email-unverified', {
        currentEmail: cleanCurrent,
        newEmail: cleanNew,
      });

      toast.success(res.data.message || 'à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ª OTP à¹à¸¥à¹‰à¸§');
      if (res.data.isDevMode && res.data.devCode) {
        setDevOtpChange(res.data.devCode);
      } else {
        setDevOtpChange(null);
      }
      setChangeStep('verify');
      setChangeCountdown(60);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ªà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    } finally {
      setLoadingChange(false);
    }
  };

  const handleVerifyChangeOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = changeOtp.trim();
    if (cleanCode.length !== 6) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ª 6 à¸«à¸¥à¸±à¸');
      return;
    }

    setLoadingChange(true);
    try {
      const res = await api.post('/auth/change-email-unverified/verify', {
        currentEmail: currentEmail.trim().toLowerCase(),
        code: cleanCode,
      });

      if (res.data.user) {
        updateUser(res.data.user);
      }

      toast.success('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'à¸£à¸«à¸±à¸ªà¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
    } finally {
      setLoadingChange(false);
    }
  };

  const handleVerifyExistingOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = existingOtp.trim();
    if (cleanCode.length !== 6) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ª 6 à¸«à¸¥à¸±à¸');
      return;
    }

    setLoadingExisting(true);
    try {
      const res = await api.post('/auth/verify-email', {
        email: currentEmail.trim().toLowerCase(),
        code: cleanCode,
      });

      if (res.data.user) {
        updateUser(res.data.user);
      }

      toast.success('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      router.push('/');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'à¸£à¸«à¸±à¸ªà¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleResendExistingOtp = async () => {
    if (existingCountdown > 0 || loadingExisting) return;
    setLoadingExisting(true);
    try {
      const res = await api.post('/auth/resend-code', {
        email: currentEmail.trim().toLowerCase(),
      });
      setExistingCountdown(60);
      if (res.data.devCode) {
        setDevOtpExisting(res.data.devCode);
      }
      toast.success(res.data.message || 'à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ªà¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ªà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    } finally {
      setLoadingExisting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50/70">
      {/* Background soft ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 rounded-3xl p-7 sm:p-8">
          {/* Minimal Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100/70 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              à¸à¸£à¸¸à¸“à¸²à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥à¹€à¸žà¸·à¹ˆà¸­à¹€à¸£à¸´à¹ˆà¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™
            </p>
          </div>

          {/* Current Email Info */}
          {currentEmail ? (
            <div className="text-center text-xs text-slate-500 mb-5 pb-4 border-b border-slate-100">
              à¸­à¸µà¹€à¸¡à¸¥à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™: <span className="font-semibold text-slate-700">{currentEmail}</span>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                à¸­à¸µà¹€à¸¡à¸¥à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™
              </label>
              <input
                type="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                placeholder="à¸£à¸°à¸šà¸¸à¸­à¸µà¹€à¸¡à¸¥à¸—à¸µà¹ˆà¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¹„à¸§à¹‰"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          )}

          {/* Clean Segmented Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveMode('change')}
              className={`py-2 rounded-lg transition-all ${
                activeMode === 'change'
                  ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸­à¸µà¹€à¸¡à¸¥
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('existing')}
              className={`py-2 rounded-lg transition-all ${
                activeMode === 'existing'
                  ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              à¹ƒà¸Šà¹‰à¸­à¸µà¹€à¸¡à¸¥à¹€à¸”à¸´à¸¡
            </button>
          </div>

          {/* Mode 1: Change to Real Email */}
          {activeMode === 'change' && (
            <div>
              {changeStep === 'request' ? (
                <form onSubmit={handleRequestChangeOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      à¸­à¸µà¹€à¸¡à¸¥à¹ƒà¸«à¸¡à¹ˆ
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingChange || !newEmail.trim()}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {loadingChange ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ª OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyChangeOtp} className="space-y-4">
                  <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                    <span className="truncate">à¸ªà¹ˆà¸‡à¹„à¸›à¸—à¸µà¹ˆ <strong className="text-slate-700">{newEmail}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeStep('request');
                        setChangeOtp('');
                      }}
                      className="text-indigo-600 hover:underline shrink-0 ml-2 font-medium"
                    >
                      à¹à¸à¹‰à¹„à¸‚
                    </button>
                  </div>

                  {devOtpChange && (
                    <div className="py-2 px-3 bg-amber-50 border border-amber-200/70 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-amber-800">
                        à¸£à¸«à¸±à¸ªà¸—à¸”à¸ªà¸­à¸š: <strong className="font-mono">{devOtpChange}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setChangeOtp(devOtpChange)}
                        className="text-amber-700 hover:text-amber-900 underline font-medium"
                      >
                        à¹ƒà¸ªà¹ˆà¸£à¸«à¸±à¸ª
                      </button>
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={changeOtp}
                      onChange={(e) => setChangeOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      autoFocus
                      className="w-full py-3 text-center text-2xl font-mono tracking-[0.4em] font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                    {changeCountdown > 0 ? (
                      <span className="text-slate-400">à¸ªà¹ˆà¸‡à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡à¹ƒà¸™ {changeCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestChangeOtp()}
                        disabled={loadingChange}
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingChange ? 'animate-spin' : ''}`} />
                        à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ªà¹ƒà¸«à¸¡à¹ˆ
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loadingChange || changeOtp.length !== 6}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {loadingChange ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>à¸¢à¸·à¸™à¸¢à¸±à¸™</span>
                        <Check className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Mode 2: Verify Existing Email */}
          {activeMode === 'existing' && (
            <form onSubmit={handleVerifyExistingOtp} className="space-y-4">
              <div className="text-xs px-1 text-slate-500">
                à¸ªà¹ˆà¸‡à¹„à¸›à¸—à¸µà¹ˆ <strong className="text-slate-700">{currentEmail}</strong>
              </div>

              {devOtpExisting && (
                <div className="py-2 px-3 bg-amber-50 border border-amber-200/70 rounded-xl text-xs flex items-center justify-between">
                  <span className="text-amber-800">
                    à¸£à¸«à¸±à¸ªà¸—à¸”à¸ªà¸­à¸š: <strong className="font-mono">{devOtpExisting}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExistingOtp(devOtpExisting)}
                    className="text-amber-700 hover:text-amber-900 underline font-medium"
                  >
                    à¹ƒà¸ªà¹ˆà¸£à¸«à¸±à¸ª
                  </button>
                </div>
              )}

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={existingOtp}
                  onChange={(e) => setExistingOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="w-full py-3 text-center text-2xl font-mono tracking-[0.4em] font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                {existingCountdown > 0 ? (
                  <span className="text-slate-400">à¸ªà¹ˆà¸‡à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡à¹ƒà¸™ {existingCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendExistingOtp}
                    disabled={loadingExisting}
                    className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingExisting ? 'animate-spin' : ''}`} />
                    à¸ªà¹ˆà¸‡à¸£à¸«à¸±à¸ªà¹ƒà¸«à¸¡à¹ˆ
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loadingExisting || existingOtp.length !== 6}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {loadingExisting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>à¸¢à¸·à¸™à¸¢à¸±à¸™</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Minimal Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸š
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
