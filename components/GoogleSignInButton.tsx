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

  const initializedRef = useRef(false);

  useEffect(() => {
    if (!clientId) return;

    // Load Google Identity Services script
    const scriptId = 'google-jssdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initGsi = () => {
      if (window.google?.accounts?.id && btnContainerRef.current) {
        if (!initializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
          });
          initializedRef.current = true;
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
      <div className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>กำลังเข้าสู่ระบบด้วย Google...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={btnContainerRef}
        className="w-full min-h-[44px] flex justify-center [&>div]:!w-full [&_iframe]:!w-full [&_iframe]:!mx-auto"
      />
    </div>
  );
}
