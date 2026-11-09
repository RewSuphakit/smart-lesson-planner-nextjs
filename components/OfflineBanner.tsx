'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOfflinePendingQueue,
  syncOfflineAttendance
} from '@/lib/offlineAttendance';
import api from '@/services/api';
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';
import toast from '@/lib/toast';

export default function OfflineBanner({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const updateQueueCount = useCallback(() => {
    const queue = getOfflinePendingQueue();
    setPendingCount(queue.length);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      updateQueueCount();

      const handleOnline = () => {
        setIsOnline(true);
        updateQueueCount();
      };

      const handleOffline = () => {
        setIsOnline(false);
        updateQueueCount();
      };

      const handleQueueChange = () => {
        updateQueueCount();
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('offline-attendance-queue-changed', handleQueueChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('offline-attendance-queue-changed', handleQueueChange);
      };
    }
  }, [updateQueueCount]);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineAttendance(api);
      if (result.success && result.syncedCount > 0) {
        toast.success(`ซิงค์ข้อมูล ${result.syncedCount} รายการขึ้นระบบเรียบร้อย`, { icon: '☁️' });
        updateQueueCount();
        if (onSyncComplete) onSyncComplete();
      } else if (!result.success) {
        toast.error(result.error || 'ซิงค์ข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      } else {
        toast('ไม่มีข้อมูลที่ค้างรอซิงค์', { icon: '✅' });
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no items pending, render nothing
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="w-full transition-all animate-fade-in-up mb-4">
      {!isOnline ? (
        // Offline State
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight flex items-center gap-1.5 flex-wrap">
                <span>กำลังทำงานในโหมดออฟไลน์</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  ออฟไลน์
                </span>
              </p>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5 truncate">
                {pendingCount > 0
                  ? `บันทึกข้อมูลในเครื่องแล้ว (${pendingCount} รายการจะถูกส่งขึ้นระบบอัตโนมัติเมื่อต่อเน็ต)`
                  : 'สามารถเช็คชื่อได้ตามปกติ ระบบจะเก็บข้อมูลไว้ในเครื่อง'}
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 text-xs font-black shrink-0 border border-amber-200 dark:border-amber-700">
              {pendingCount} รอซิงค์
            </span>
          )}
        </div>
      ) : (
        // Online with pending items waiting to sync
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CloudUpload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight">มีข้อมูลเช็คชื่อค้างอยู่ในเครื่อง {pendingCount} รายการ</p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">เชื่อมต่ออินเทอร์เน็ตแล้ว กดซิงค์เพื่ออัปเดตขึ้นฐานข้อมูล</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ทันที'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

