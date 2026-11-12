'use client';

import { createPortal } from 'react-dom';
import { X, Loader2, Trash2, AlertCircle, Table } from 'lucide-react';
import { TIMETABLE_DAYS, type TimetableEntry, type TimetableFormState } from './types';

interface TimetableEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget: TimetableEntry | null;
  form: TimetableFormState;
  setForm: React.Dispatch<React.SetStateAction<TimetableFormState>>;
  isFormHomeroom: boolean;
  classroomsList: Array<{ id: string | number; name: string }>;
  saving: boolean;
  onPeriodChange: (field: 'start_period' | 'end_period', val: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
}

export default function TimetableEntryModal({
  isOpen,
  onClose,
  editTarget,
  form,
  setForm,
  isFormHomeroom,
  classroomsList,
  saving,
  onPeriodChange,
  onSubmit,
  onDelete,
}: TimetableEntryModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Table className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editTarget ? 'แก้ไขคาบเรียนตารางสอน' : 'เพิ่มคาบเรียนในตาราง'}
              </h2>
              <p className="text-xs text-slate-400">กำหนดรายละเอียดคาบเรียนสำหรับตารางเรียนประจำสัปดาห์</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-50 rounded-xl">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 dark:text-slate-200 font-bold mb-1.5 block">
                รหัสวิชา {!isFormHomeroom && '*'}
                {isFormHomeroom && (
                  <span className="text-[11px] font-normal text-slate-400 ml-1">(ไม่บังคับสำหรับกิจกรรม)</span>
                )}
              </label>
              <input
                type="text"
                value={form.subject_code}
                onChange={e => setForm(f => ({ ...f, subject_code: e.target.value }))}
                className="form-input"
                placeholder={isFormHomeroom ? 'เว้นว่างได้' : 'เช่น ค21101'}
                required={!isFormHomeroom}
              />
            </div>
            <div>
              <label className="form-label text-slate-700 dark:text-slate-200 font-bold mb-1.5 block">
                ชื่อวิชา / กิจกรรม
              </label>
              <input
                type="text"
                value={form.subject_name}
                onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))}
                className="form-input"
                placeholder={isFormHomeroom ? 'เช่น กิจกรรมหน้าเสาธง, โฮมรูม' : 'เช่น คณิตศาสตร์'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">วันในสัปดาห์ *</label>
              <select
                value={form.day_of_week}
                onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="form-input"
                required
              >
                {TIMETABLE_DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">ประเภทวิชา *</label>
              <select
                value={form.entry_type}
                onChange={e => setForm(f => ({ ...f, entry_type: e.target.value }))}
                className="form-input"
                required
              >
                <option value="lecture">ทฤษฎี (Theory / Lecture)</option>
                <option value="lab">ปฏิบัติ (Lab)</option>
                <option value="activity">กิจกรรม (Activity)</option>
                <option value="homeroom">โฮมรูม (Homeroom)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">คาบเริ่มต้น *</label>
              <select
                value={form.start_period}
                onChange={e => onPeriodChange('start_period', Number(e.target.value))}
                className="form-input"
                required
              >
                <option value="0">คาบกิจกรรม (07:30 - 08:00)</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>คาบที่ {p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">คาบสิ้นสุด *</label>
              <select
                value={form.end_period}
                onChange={e => onPeriodChange('end_period', Number(e.target.value))}
                className="form-input"
                required
              >
                <option value="0">คาบกิจกรรม (07:30 - 08:00)</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>คาบที่ {p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">เวลาเริ่มต้น *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">เวลาสิ้นสุด *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">ห้องเรียน (สถานที่)</label>
              <input
                type="text"
                value={form.room}
                onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                className="form-input"
                placeholder="เช่น 311"
              />
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">กลุ่มเรียน / ชั้นเรียน</label>
              <input
                type="text"
                value={form.group_name}
                onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                className="form-input"
                placeholder="เช่น ม.1/1"
              />
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">ผู้สอน</label>
              <input
                type="text"
                value={form.instructor}
                onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))}
                className="form-input"
                placeholder="เช่น ครูสมชาย"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">เชื่อมห้องเรียนในระบบ</label>
              {isFormHomeroom ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>กิจกรรมหน้าเสาธง/โฮมรูม ไม่ต้องเชื่อมห้องเรียน (ไม่นับเป็นคาบสอน)</span>
                </div>
              ) : (
                <select
                  value={form.classroom_id}
                  onChange={e => setForm(f => ({ ...f, classroom_id: e.target.value }))}
                  className="form-input"
                >
                  <option value="">-- ไม่เชื่อม --</option>
                  {(Array.isArray(classroomsList) ? classroomsList : []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="form-label text-slate-700 font-bold mb-1.5 block">สีประจำวิชา</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color || '#3b82f6'}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer p-0"
                />
                <span className="text-xs text-slate-500 font-mono">
                  {form.color || '#3b82f6'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? 'บันทึกการแก้ไข' : 'เพิ่มคาบเรียน'}
            </button>
            {editTarget && (
              <button
                type="button"
                onClick={onDelete}
                className="btn border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3.5 flex items-center gap-1.5 font-medium transition-colors"
                title="ลบคาบเรียนนี้ออกจากตาราง"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบคาบนี้</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost px-5"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

