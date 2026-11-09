'use client';

import { useEffect, useState } from 'react';
import { syncOfflineAttendance, getOfflinePendingQueue } from '@/lib/offlineAttendance';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Wifi, WifiOff, Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Auto-sync offline attendance when online returns
    const handleOnline = async () => {
      const queue = getOfflinePendingQueue();
      if (queue.length > 0) {
        toast.loading(`กำลังซิงค์ข้อมูลการเช็คชื่อ ${queue.length} รายการขึ้นระบบ...`, { id: 'offline-sync' });
        const result = await syncOfflineAttendance(api);
        if (result.success && result.syncedCount > 0) {
          toast.success(`ซิงค์ข้อมูลการเช็คชื่อ ${result.syncedCount} รายการเรียบร้อยแล้ว`, {
            id: 'offline-sync',
            icon: '✅',
          });
        } else if (!result.success) {
          toast.error('ซิงค์ข้อมูลไม่สำเร็จ จะลองใหม่อีกครั้งเมื่อการเชื่อมต่อเสถียร', { id: 'offline-sync' });
        }
      } else {
        toast.success('เชื่อมต่ออินเทอร์เน็ตแล้ว', { icon: '🟢', duration: 2500 });
      }
    };

    const handleOffline = () => {
      toast('คุณอยู่ในโหมดออฟไลน์ — ระบบจะบันทึกข้อมูลลงเครื่องอัตโนมัติ', {
        icon: '📡',
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: '16px',
        },
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Catch PWA Install Prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show install banner only if user hasn't dismissed it in this session
      const dismissed = sessionStorage.getItem('smart_planner_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowInstallBanner(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('ติดตั้งแอปลงอุปกรณ์เรียบร้อยแล้ว', { icon: '📲' });
    }
    setDeferredPrompt(null);
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('smart_planner_pwa_dismissed', 'true');
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fade-in-up">
      <div className="glass bg-white/95 dark:bg-slate-900/95 border border-indigo-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">ติดตั้ง Smart Planner</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">เปิดใช้งานได้เร็วและเช็คชื่อแบบออฟไลน์ได้</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            ติดตั้ง
          </button>
          <button
            onClick={handleDismissBanner}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

