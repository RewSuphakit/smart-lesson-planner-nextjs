'use client';

import { createPortal } from 'react-dom';
import { History, X, Loader2, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Student, AttendanceRecord } from './types';

export interface AttendanceHistoryModalProps {
  student: Student | null;
  onClose: () => void;
  isLoading: boolean;
  records: AttendanceRecord[];
  onDeleteRecord: (recordId: string) => void;
  getStatusDisplay: (status: string) => React.ReactNode;
}

export const AttendanceHistoryModal = ({
  student,
  onClose,
  isLoading,
  records,
  onDeleteRecord,
  getStatusDisplay,
}: AttendanceHistoryModalProps) => {
  if (!student || typeof window === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-black/60 w-full max-w-md p-6 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg text-white">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">ประวัติการเช็คชื่อ</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{student.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">ไม่พบสถิติการเช็คชื่อใดๆ</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {records.map(record => {
              const dateObj = new Date(record.date);
              const formattedDate = dateObj.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              });
              return (
                <div key={record.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50/60 dark:hover:bg-slate-750 transition-colors group">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-200 font-semibold">{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusDisplay(record.status)}
                    <button
                      onClick={() => onDeleteRecord(record.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
                      title="ลบสถิตินี้ออก"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-indigo-50/50 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
