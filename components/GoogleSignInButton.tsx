'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt?: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

// Global tracker to avoid multiple initialize() warnings across component mounts
let gsiInitializedClientId: string | null = null;
let activeCredentialCallback: ((response: { credential: string }) => void) | null = null;

export default function GoogleSignInButton({ text = 'continue_with' }: GoogleSignInButtonProps) {
  const btnContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string>(
    (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '')
  );
  const { googleLogin } = useAuth();
  const router = useRouter();

  // Always fetch clientId from API to ensure it stays in sync with server .env
  useEffect(() => {
    api.get('/auth/google')
      .then((res) => {
        if (res.data?.clientId) {
          const cleanId = String(res.data.clientId).trim().replace(/^["']|["']$/g, '');
          setClientId(cleanId);
        }
      })
      .catch(() => {
        // Silent fallback
      });
  }, []);

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    if (!response?.credential) {
      toast.error('ไม่พบข้อมูลการเข้าสู่ระบบจาก Google');
      return;
    }

    setLoading(true);
    try {
      await googleLogin(response.credential);
      toast.success('เข้าสู่ระบบด้วย Google สำเร็จ!');
      router.push('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [googleLogin, router]);

  // Keep the latest callback reference active
  useEffect(() => {
    activeCredentialCallback = handleCredentialResponse;
  }, [handleCredentialResponse]);

  useEffect(() => {
    if (!clientId) return;

    // Load Google Identity Services script
    const scriptId = 'google-jssdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initGsi = () => {
      if (window.google?.accounts?.id && btnContainerRef.current) {
        if (gsiInitializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (res) => {
              if (activeCredentialCallback) {
                activeCredentialCallback(res);
              }
            },
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
          });
          gsiInitializedClientId = clientId;
        }

        // Clear previous button render if any
        btnContainerRef.current.innerHTML = '';

        const containerWidth = btnContainerRef.current.clientWidth || 360;
        const validWidth = Math.min(Math.max(Math.floor(containerWidth), 200), 400);

        window.google.accounts.id.renderButton(btnContainerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width: validWidth,
          locale: 'th',
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initGsi();
    }
  }, [clientId, handleCredentialResponse, text]);

  if (loading) {
    return (
      <div className="w-full h-[42px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>กำลังเข้าสู่ระบบด้วย Google...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full h-[42px] rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/70 transition-all shadow-xs flex items-center justify-center gap-2.5 select-none overflow-hidden cursor-pointer group">
        {/* Google Multi-color Icon */}
        <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>

        {/* Text */}
        <span className="text-xs font-semibold text-slate-700">
          {text === 'signup_with' ? 'สมัครสมาชิกด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
        </span>

        {/* Invisible Google GSI overlay to capture official OAuth click */}
        <div
          ref={btnContainerRef}
          className="absolute inset-0 opacity-[0.001] overflow-hidden flex items-center justify-center pointer-events-auto cursor-pointer [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!scale-125"
        />
      </div>
    </div>
  );
}
