'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode?: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export interface TurnstileRef {
  reset: () => void;
}

interface TurnstileProps {
  onSuccess: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

// Canonical Site key provided for this project
const PROJECT_TURNSTILE_SITE_KEY = '0x4AAAAAAFCRQit4e4wzNoHm';

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onSuccess, onError, onExpire, action = 'login', theme = 'light', className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    // Keep latest callbacks in refs so parent re-renders never destroy/re-mount the widget
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
      onSuccessRef.current = onSuccess;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    }, [onSuccess, onError, onExpire]);

    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || PROJECT_TURNSTILE_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current !== null && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // Ignore reset errors if widget is not ready
          }
        }
      },
    }));

    useEffect(() => {
      if (!siteKey) return;

      let cancelled = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const mountWidget = () => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) {
          return;
        }

        try {
          containerRef.current.innerHTML = '';
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme,
            size: 'normal',
            callback: (token: string) => {
              if (!cancelled) {
                onSuccessRef.current(token);
              }
            },
            'error-callback': (err?: string) => {
              if (!cancelled) {
                onErrorRef.current?.(err);
              }
            },
            'expired-callback': () => {
              if (!cancelled) {
                onExpireRef.current?.();
              }
            },
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.error('[Turnstile render error]:', err);
        }
      };

      const scriptId = 'cf-turnstile-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', mountWidget);
        document.head.appendChild(script);
      } else if (window.turnstile) {
        mountWidget();
      } else {
        script.addEventListener('load', mountWidget);
        intervalId = setInterval(() => {
          if (window.turnstile) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            mountWidget();
          }
        }, 100);
      }

      return () => {
        cancelled = true;
        if (script) {
          script.removeEventListener('load', mountWidget);
        }
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (widgetIdRef.current !== null && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore on cleanup
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, action, theme]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className={`flex justify-center items-center min-h-[65px] ${className}`}>
        <div ref={containerRef} />
      </div>
    );
  }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
