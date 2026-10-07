'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  X, Loader2, Trash2, AlertCircle,
  UploadCloud, FileText, Table
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  format as _format,
  startOfMonth as _startOfMonth,
  endOfMonth as _endOfMonth,
  startOfWeek as _startOfWeek,
  endOfWeek as _endOfWeek,
  addDays as _addDays,
  addMonths as _addMonths,
  subMonths as _subMonths,
  isSameDay as _isSameDay,
  isSameMonth as _isSameMonth,
  parseISO as _parseISO
} from 'date-fns';
import { th as _th } from 'date-fns/locale';
void [_format, _startOfMonth, _endOfMonth, _startOfWeek, _endOfWeek, _addDays, _addMonths, _subMonths, _isSameDay, _isSameMonth, _parseISO, _th];

const TIMETABLE_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface TimetableEntry {
  id: string | number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  subject_code: string;
  subject_name?: string;
  room?: string;
  group_name?: string;
  entry_type: 'lecture' | 'lab' | 'activity' | 'homeroom' | 'theory' | string;
  hours?: number;
  classroom_id?: number | null;
  instructor?: string;
  start_time?: string;
  end_time?: string;
  color?: string | null;
}

interface TimetableSummaryItem {
  subject_code: string;
  subject_name: string;
  total_hours: number;
}

interface HoverTooltip {
  entry: TimetableEntry;
  rect: DOMRect;
}

export default function Schedule() {
  const queryClient = useQueryClient();

  const invalidateAllTimetableQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['timetable-schedule'] });
    queryClient.invalidateQueries({ queryKey: ['timetable'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-classroom-options'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-all'] });
  };

  // Weekly timetable modal states
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [editTimetableTarget, setEditTimetableTarget] = useState<TimetableEntry | null>(null);
  const [timetableForm, setTimetableForm] = useState({
    day_of_week: 0,
    start_period: 1,
    end_period: 1,
    start_time: '08:00',
    end_time: '09:00',
    subject_code: '',
    subject_name: '',
    room: '',
    group_name: '',
    instructor: '',
    entry_type: 'lecture',
    color: '#3b82f6',
    classroom_id: '' as string | number
  });

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draggedEntry, setDraggedEntry] = useState<TimetableEntry | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  // ─── Query: ดึงข้อมูลห้องเรียน ───
  const { data: classroomsList = [] } = useQuery<Array<{
    id: string | number;
    name: string;
    semester_start_date?: string | null;
    semester_end_date?: string | null;
    total_weeks?: number;
  }>>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    }
  });

  // ─── Query: ดึงข้อมูลตารางเรียนรายสัปดาห์ (Timetable) ───
  const { data: timetableData = { entries: [], summary: [] }, isLoading: loadingTimetable } = useQuery<{
    entries: TimetableEntry[];
    summary: TimetableSummaryItem[];
  }>({
    queryKey: ['timetable-schedule'],
    queryFn: async () => {
      const res = await api.get('/timetable');
      const data = res.data.data || {};
      return {
        entries: Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []),
        summary: Array.isArray(data.summary) ? data.summary : []
      };
    }
  });

  const rawEntries = (timetableData as { entries?: TimetableEntry[] })?.entries;
  const timetableEntries: TimetableEntry[] = Array.isArray(rawEntries)
    ? rawEntries
    : Array.isArray(timetableData)
      ? (timetableData as unknown as TimetableEntry[])
      : [];

  const rawSummary = (timetableData as { summary?: TimetableSummaryItem[] })?.summary;
  const timetableSummary: TimetableSummaryItem[] = Array.isArray(rawSummary)
    ? rawSummary
    : [];

  const loading = loadingTimetable;

  const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
    0:  { start: '07:30', end: '08:00' },
    1:  { start: '08:00', end: '09:00' },
    2:  { start: '09:00', end: '10:00' },
    3:  { start: '10:00', end: '11:00' },
    4:  { start: '11:00', end: '12:00' },
    5:  { start: '13:00', end: '14:00' },
    6:  { start: '14:00', end: '15:00' },
    7:  { start: '15:00', end: '16:00' },
    8:  { start: '16:00', end: '17:00' },
    9:  { start: '17:00', end: '18:00' },
    10: { start: '18:00', end: '19:00' },
    11: { start: '19:00', end: '20:00' },
    12: { start: '20:00', end: '21:00' },
  };

  const openCreateTimetable = (dayIdx: number, periodId: number | string) => {
    const period = typeof periodId === 'number' ? periodId : 1;
    const defaultTime = PERIOD_TIMES[period] || { start: '08:00', end: '09:00' };
    
    setEditTimetableTarget(null);
    setTimetableForm({
      day_of_week: dayIdx,
      start_period: period,
      end_period: period,
      start_time: defaultTime.start,
      end_time: defaultTime.end,
      subject_code: '',
      subject_name: '',
      room: '',
      group_name: '',
      instructor: '',
      entry_type: 'lecture',
      color: '#3b82f6',
      classroom_id: ''
    });
    setShowTimetableModal(true);
  };

  const openEditTimetable = (entry: TimetableEntry) => {
    setEditTimetableTarget(entry);
    setTimetableForm({
      day_of_week: entry.day_of_week,
      start_period: entry.start_period,
      end_period: entry.end_period,
      start_time: entry.start_time || PERIOD_TIMES[entry.start_period]?.start || '08:00',
      end_time: entry.end_time || PERIOD_TIMES[entry.end_period]?.end || '09:00',
      subject_code: entry.subject_code || '',
      subject_name: entry.subject_name || '',
      room: entry.room || '',
      group_name: entry.group_name || '',
      instructor: entry.instructor || '',
      entry_type: (entry.entry_type === 'theory' ? 'lecture' : entry.entry_type) || 'lecture',
      color: entry.color || '#3b82f6',
      classroom_id: entry.classroom_id !== null && entry.classroom_id !== undefined ? entry.classroom_id : ''
    });
    setShowTimetableModal(true);
  };

  const handlePeriodChange = (field: 'start_period' | 'end_period', val: number) => {
    setTimetableForm(prev => {
      const nextForm = { ...prev, [field]: val };
      
      // Keep start <= end
      if (field === 'start_period' && nextForm.start_period > nextForm.end_period) {
        nextForm.end_period = nextForm.start_period;
      } else if (field === 'end_period' && nextForm.end_period < nextForm.start_period) {
        nextForm.start_period = nextForm.end_period;
      }
      
      // Auto set times based on start/end periods
      const startT = PERIOD_TIMES[nextForm.start_period]?.start;
      const endT = PERIOD_TIMES[nextForm.end_period]?.end;
      
      if (startT) nextForm.start_time = startT;
      if (endT) nextForm.end_time = endT;
      
      return nextForm;
    });
  };

  // ─── Mutation: จัดการคาบเรียนตารางเรียนรายสัปดาห์ (Timetable Entry) ───
  const timetableMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editTimetableTarget) {
        return api.put(`/timetable/${editTimetableTarget.id}`, payload);
      } else {
        return api.post('/timetable', payload);
      }
    },
    onSuccess: () => {
      toast.success(editTimetableTarget ? 'อัปเดตคาบเรียนเรียบร้อย' : 'เพิ่มคาบเรียนเรียบร้อย');
      setShowTimetableModal(false);
      setEditTimetableTarget(null);
      invalidateAllTimetableQueries();
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'บันทึกคาบเรียนไม่สำเร็จ');
    }
  });

  const handleTimetableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timetableForm.subject_code.trim()) return toast.error('กรุณากรอกรหัสวิชา');
    if (Number(timetableForm.start_period) > Number(timetableForm.end_period)) return toast.error('คาบเรียนสิ้นสุดต้องไม่น้อยกว่าคาบเรียนเริ่มต้น');
    if (timetableForm.start_time >= timetableForm.end_time) return toast.error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');

    const isHomeroomOrFlagpole = 
      timetableForm.entry_type === 'homeroom' || 
      Number(timetableForm.start_period) === 0 || 
      timetableForm.subject_name?.includes('เสาธง') || 
      timetableForm.subject_name?.includes('โฮมรูม') || 
      timetableForm.subject_name?.includes('เข้าแถว');

    const payload = {
      day_of_week: Number(timetableForm.day_of_week),
      start_period: Number(timetableForm.start_period),
      end_period: Number(timetableForm.end_period),
      start_time: timetableForm.start_time,
      end_time: timetableForm.end_time,
      subject_code: timetableForm.subject_code.trim(),
      subject_name: timetableForm.subject_name.trim() || null,
      room: timetableForm.room.trim() || null,
      group_name: timetableForm.group_name.trim() || null,
      instructor: timetableForm.instructor.trim() || null,
      entry_type: timetableForm.entry_type,
      color: timetableForm.color || null,
      classroom_id: isHomeroomOrFlagpole ? null : (timetableForm.classroom_id ? Number(timetableForm.classroom_id) : null)
    };

    timetableMutation.mutate(payload);
  };

  // ─── Mutation: ลบคาบเรียนจากตารางเรียน ───
  const deleteTimetableMutation = useMutation({
    mutationFn: async (id: string | number) => {
      return api.delete(`/timetable/${id}`);
    },
    onSuccess: () => {
      toast.success('ลบคาบเรียนแล้ว');
      setShowTimetableModal(false);
      setEditTimetableTarget(null);
      invalidateAllTimetableQueries();
    },
    onError: () => {
      toast.error('ลบคาบเรียนไม่สำเร็จ');
    }
  });

  const handleDeleteTimetableEntry = () => {
    if (!editTimetableTarget) return;
    if (!window.confirm('ต้องการลบคาบเรียนนี้ใช่หรือไม่?')) return;
    deleteTimetableMutation.mutate(editTimetableTarget.id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  // ─── Mutation: อัพโหลดไฟล์ตารางสอน ───
  const timetableUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.post('/timetable/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'อัพโหลดสำเร็จ');
      setShowUpload(false);
      setUploadFile(null);
      invalidateAllTimetableQueries();
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'อัพโหลดไม่สำเร็จ กรุณาตรวจสอบรูปแบบไฟล์');
    }
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return toast.error('กรุณาเลือกไฟล์');
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('replace', 'true');
    
    timetableUploadMutation.mutate(formData);
  };

  // ─── Mutation: ล้างข้อมูลตารางเรียน ───
  const clearTimetableMutation = useMutation({
    mutationFn: async () => {
      return api.delete('/timetable/clear');
    },
    onSuccess: () => {
      toast.success('ล้างตารางสอนแล้ว');
      invalidateAllTimetableQueries();
    },
    onError: () => {
      toast.error('ทำรายการไม่สำเร็จ');
    }
  });

  const clearTimetable = () => {
    if (!window.confirm('ต้องการลบตารางสอนทั้งหมดใช่หรือไม่?')) return;
    clearTimetableMutation.mutate();
  };

  const handleDragStart = (e: React.DragEvent, entry: TimetableEntry, type = 'move') => {
    setDraggedEntry(entry);
    setDragType(type);
    e.dataTransfer.effectAllowed = 'move';
    if (type === 'move') {
      const target = e.target as HTMLElement;
      setTimeout(() => { if (target) target.style.opacity = '0.5'; }, 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    if (target) target.style.opacity = '1';
    setDraggedEntry(null);
    setDragType(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e: React.DragEvent, dayIdx: number, slotId: string | number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell(`${dayIdx}-${slotId}`);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  // ─── Mutations: ย้ายและปรับขนาดคาบเรียน ───
  const moveTimetableMutation = useMutation({
    mutationFn: async ({ id, day_of_week, start_period }: { id: string | number; day_of_week: number; start_period: number }) => {
      return api.put(`/timetable/${id}/move`, { day_of_week, start_period });
    },
    onSuccess: () => {
      toast.success('ย้ายตารางสอนสำเร็จ');
      invalidateAllTimetableQueries();
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    }
  });

  const resizeTimetableMutation = useMutation({
    mutationFn: async ({ id, end_period }: { id: string | number; end_period: number }) => {
      return api.put(`/timetable/${id}/resize`, { end_period });
    },
    onSuccess: () => {
      toast.success('ปรับขนาดคาบเรียนสำเร็จ');
      invalidateAllTimetableQueries();
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    }
  });

  const handleDrop = (e: React.DragEvent, dayIdx: number, slotId: string | number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedEntry) return;

    if (dragType === 'resize') {
      if (dayIdx !== draggedEntry.day_of_week) {
        toast.error('ไม่สามารถยืดคาบเรียนข้ามวันได้');
        setDraggedEntry(null);
        setDragType(null);
        return;
      }
      if (Number(slotId) < draggedEntry.start_period) {
        toast.error('เวลาสิ้นสุดต้องไม่น้อยกว่าคาบเริ่มต้น');
        setDraggedEntry(null);
        setDragType(null);
        return;
      }
      resizeTimetableMutation.mutate({ id: draggedEntry.id, end_period: Number(slotId) });
    } else {
      moveTimetableMutation.mutate({ id: draggedEntry.id, day_of_week: dayIdx, start_period: Number(slotId) });
    }
    setDraggedEntry(null);
    setDragType(null);
  };

  const savingTimetable = timetableMutation.isPending || deleteTimetableMutation.isPending;
  const uploading = timetableUploadMutation.isPending;

  const renderTimetable = () => {
    const entriesByDay: Record<number, TimetableEntry[]> = {};
    for (let i = 0; i < 7; i++) entriesByDay[i] = [];
    
    const safeEntries = Array.isArray(timetableEntries) ? timetableEntries : [];
    safeEntries.forEach(entry => {
      if (entry && typeof entry.day_of_week === 'number' && entriesByDay[entry.day_of_week]) {
        entriesByDay[entry.day_of_week].push(entry);
      }
    });

    const getBgColor = (type?: string) => {
      if (type === 'lab') return 'bg-amber-100/80 border-amber-300 text-amber-800';
      if (type === 'activity') return 'bg-emerald-100/80 border-emerald-300 text-emerald-800';
      if (type === 'homeroom') return 'bg-rose-100/80 border-rose-300 text-rose-800';
      return 'bg-blue-100/80 border-blue-300 text-blue-800';
    };

    const TIME_SLOTS = [
      { id: 0, label: 'กิจกรรม', start: '07:30', end: '08:00', isBreak: false },
      { id: 1, label: '1', start: '08:00', end: '09:00', isBreak: false },
      { id: 2, label: '2', start: '09:00', end: '10:00', isBreak: false },
      { id: 3, label: '3', start: '10:00', end: '11:00', isBreak: false },
      { id: 4, label: '4', start: '11:00', end: '12:00', isBreak: false },
      { id: 'lunch', label: 'พักกลางวัน', start: '12:00', end: '13:00', isBreak: true },
      { id: 5, label: '5', start: '13:00', end: '14:00', isBreak: false },
      { id: 6, label: '6', start: '14:00', end: '15:00', isBreak: false },
      { id: 7, label: '7', start: '15:00', end: '16:00', isBreak: false },
      { id: 8, label: '8', start: '16:00', end: '17:00', isBreak: false },
      { id: 9, label: '9', start: '17:00', end: '18:00', isBreak: false },
      { id: 10, label: '10', start: '18:00', end: '19:00', isBreak: false },
      { id: 11, label: '11', start: '19:00', end: '20:00', isBreak: false },
      { id: 12, label: '12', start: '20:00', end: '21:00', isBreak: false },
    ];

    const slotIndex = (slotId: number | string) => TIME_SLOTS.findIndex(s => s.id === slotId);
    const gridCols = `100px repeat(${TIME_SLOTS.length}, 1fr)`;

    return (
      <div className="animate-fade-in-up">
        {loading ? (
           <div className="skeleton h-[500px] rounded-2xl w-full" />
        ) : timetableEntries.length === 0 ? (
          <div className="glass p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Table className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">ยังไม่มีข้อมูลตารางเรียน</h3>
            <p className="text-slate-500 mb-6 max-w-md">อัพโหลดไฟล์ตารางเรียนในรูปแบบ รูปภาพ (JPG/PNG), CSV หรือ PDF เพื่อดึงข้อมูลอัตโนมัติ (รองรับ AI อ่านรูปภาพตารางสอน)</p>
            <button onClick={() => setShowUpload(true)} className="btn btn-primary">อัพโหลดไฟล์ตอนนี้</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
            <div className="glass p-1 overflow-x-auto rounded-2xl">
              <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                  <div className="border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600 flex items-center justify-center">วัน / คาบ</div>
                  {TIME_SLOTS.map(slot => (
                    <div key={slot.id} className="border border-slate-200 bg-slate-50 p-1 text-center">
                      <div className="text-[0.65rem] font-bold text-slate-700">{slot.label}</div>
                      <div className="text-[0.55rem] text-slate-500 font-normal mt-0.5">
                        {slot.start} - {slot.end}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Day rows — each row is a position:relative container */}
                {TIMETABLE_DAYS.map((dayName, dayIdx) => {
                  const dayEntries = (entriesByDay[dayIdx] || []).sort((a: TimetableEntry, b: TimetableEntry) => Number(a.start_period) - Number(b.start_period));
                  if (dayEntries.length === 0 && dayIdx > 4) return null;

                  return (
                    <div 
                      key={dayIdx} 
                      className="grid relative"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      {/* Day name label — explicit column 1 */}
                      <div 
                        className="border border-slate-200 bg-slate-50 p-2 text-sm font-bold text-slate-700 text-center flex items-center justify-center"
                        style={{ gridRow: 1, gridColumn: 1 }}
                      >
                        {dayName}
                      </div>

                      {/* Background cells — every cell has explicit gridRow AND gridColumn */}
                      {TIME_SLOTS.map((slot, sIdx) => {
                        const isDragOver = dragOverCell === `${dayIdx}-${slot.id}`;
                        const colPos = sIdx + 2; // +2 because col 1 = day label

                        if (slot.isBreak) {
                          return (
                            <div 
                              key={`bg-${slot.id}`} 
                              className="border border-slate-200 bg-slate-50/50 p-1 text-center flex items-center justify-center min-h-[60px]"
                              style={{ gridRow: 1, gridColumn: colPos }}
                            >
                              <span className="text-[0.65rem] text-slate-400 font-medium opacity-50 whitespace-nowrap -rotate-90 origin-center">พักกลางวัน</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`bg-${slot.id}`}
                            className={`border border-slate-200 min-h-[60px] transition-colors cursor-pointer hover:bg-indigo-50/30 ${isDragOver ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 ring-inset z-[5]' : ''}`}
                            style={{ gridRow: 1, gridColumn: colPos }}
                            onDragOver={(e) => handleDragOver(e, dayIdx, slot.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, dayIdx, slot.id)}
                            onClick={() => openCreateTimetable(dayIdx, slot.id)}
                          />
                        );
                      })}

                      {/* Entry blocks — overlaid on same gridRow:1 with explicit gridColumn spans */}
                      {dayEntries.map((entry: TimetableEntry) => {
                        const startIdx = slotIndex(entry.start_period);
                        const endIdx = slotIndex(entry.end_period);
                        if (startIdx === -1) return null;
                        const effectiveEndIdx = endIdx === -1 ? startIdx : endIdx;
                        const span = effectiveEndIdx - startIdx + 1;
                        const gridColStart = startIdx + 2;
                        const gridColEnd = effectiveEndIdx + 3;

                        const calcPeriodFromMouse = (e: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement>) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const colWidth = rect.width / span;
                          const colIdx = Math.min(span - 1, Math.max(0, Math.floor(x / colWidth)));
                          return TIME_SLOTS[startIdx + colIdx]?.id;
                        };

                        return (
                          <div
                            key={entry.id}
                            className={`border rounded-md m-[2px] relative group transition-transform hover:scale-[1.03] z-10 hover:z-50 cursor-pointer ${entry.color ? '' : getBgColor(entry.entry_type)}`}
                            style={{
                              gridColumn: `${gridColStart} / ${gridColEnd}`,
                              gridRow: 1,
                              backgroundColor: entry.color ? `${entry.color}1c` : undefined, // 11% opacity
                              borderColor: entry.color ? entry.color : undefined,
                            }}
                            onDragOver={(e) => {
                              if (!draggedEntry) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              const period = calcPeriodFromMouse(e);
                              if (period !== undefined) setDragOverCell(`${dayIdx}-${period}`);
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              if (!draggedEntry) return;
                              const period = calcPeriodFromMouse(e);
                              if (period !== undefined) handleDrop(e, dayIdx, period);
                            }}
                            onMouseEnter={(e) => {
                              if (!showTimetableModal) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverTooltip({ entry, rect });
                              }
                            }}
                            onMouseLeave={() => setHoverTooltip(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTimetable(entry);
                              setHoverTooltip(null);
                            }}
                          >
                            <div 
                              className="w-full h-full p-2 text-center cursor-grab active:cursor-grabbing flex flex-col justify-center min-h-[56px]"
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, entry, 'move')}
                              onDragEnd={handleDragEnd}
                            >
                              <div 
                                className="text-[0.7rem] font-bold truncate" 
                                title={entry.subject_code}
                                style={{ color: entry.color ? entry.color : undefined }}
                              >
                                {entry.subject_code}
                              </div>
                              {entry.room && (
                                <div 
                                  className="text-[0.6rem] opacity-80 truncate"
                                  style={{ color: entry.color ? entry.color : undefined }}
                                >
                                  ({entry.room}) {entry.group_name}
                                </div>
                              )}
                            </div>
                            
                            {/* Resize Handle */}
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-slate-900/20 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                              draggable={true}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleDragStart(e, entry, 'resize');
                              }}
                              onDragEnd={handleDragEnd}
                              title="ลากเพื่อขยาย/ลดคาบ"
                            >
                              <div className="w-0.5 h-5 bg-slate-500 rounded-full"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass p-5 flex flex-col h-full rounded-2xl">
              <h3 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">สรุปชั่วโมงสอน</h3>
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                {(Array.isArray(timetableSummary) ? timetableSummary : []).map((sum, i) => (
                  <div key={i} className="flex gap-3 items-start p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-2 h-2 rounded-full mt-1.5 bg-indigo-500 shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-slate-800 truncate">{sum.subject_code}</p>
                        <span className="text-xs font-bold text-emerald-600">{sum.total_hours} ชม.</span>
                      </div>
                      <p className="text-[0.65rem] text-slate-500 line-clamp-2 mt-0.5">{sum.subject_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ตารางสอนประจำสัปดาห์</h1>
          <p className="text-slate-500 text-sm">จัดการเวลาเรียนและการสอนของคุณ</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowUpload(true)} className="btn btn-primary flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> อัพโหลดไฟล์ตาราง (รูปภาพ/CSV/PDF)
          </button>
          {timetableEntries.length > 0 && (
            <button onClick={clearTimetable} className="btn btn-ghost text-red-500 hover:bg-red-50 hover:border-red-200">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {renderTimetable()}

      {hoverTooltip && !draggedEntry && !showTimetableModal && createPortal(
        <div 
          className="fixed z-[9999] w-48 bg-white shadow-xl rounded-lg p-3 border border-slate-100 text-left pointer-events-none"
          style={{
            top: hoverTooltip.rect.top - 8,
            left: hoverTooltip.rect.left + hoverTooltip.rect.width / 2,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <p className="text-xs font-bold text-slate-800">{hoverTooltip.entry.subject_name}</p>
          <p className="text-[0.65rem] text-slate-500 mt-1">{hoverTooltip.entry.subject_code}</p>
          <p className="text-[0.65rem] text-slate-500">ห้อง: {hoverTooltip.entry.room || '-'}</p>
          <p className="text-[0.65rem] text-slate-500">กลุ่ม: {hoverTooltip.entry.group_name || '-'}</p>
          <p className="text-[0.65rem] text-slate-500">คาบ: {hoverTooltip.entry.start_period} - {hoverTooltip.entry.end_period} ({hoverTooltip.entry.hours || (hoverTooltip.entry.end_period - hoverTooltip.entry.start_period + 1)} ชม.)</p>
          <p className="text-[0.6rem] text-indigo-500 mt-1">คลิกเพื่อแก้ไข/ลบคาบเรียน</p>
        </div>,
        document.body
      )}

      {showUpload && createPortal(
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="glass w-full max-w-md p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">อัพโหลดตารางสอน (รองรับ AI อ่านจากรูป)</h2>
              <button onClick={() => setShowUpload(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              <div 
                className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">คลิกเพื่อเลือกไฟล์ รูปภาพ, CSV หรือ PDF</p>
                <p className="text-xs text-slate-500 mt-1">
                  {uploadFile ? uploadFile.name : 'รองรับไฟล์ .jpg, .png, .csv, .pdf ขนาดไม่เกิน 10MB'}
                </p>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.csv,.pdf,application/pdf,text/csv,image/jpeg,image/png"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-[0.7rem] text-amber-800 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  การอัพโหลดใหม่จะแทนที่ข้อมูลตารางเรียนเดิมทั้งหมด
                </p>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={uploading || !uploadFile} className="btn btn-primary flex-1">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      กำลังให้ AI ประมวลผลตารางเรียน (อาจใช้เวลาสักครู่)...
                    </>
                  ) : 'อัพโหลดและสร้างตาราง'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Timetable Entry Modal */}
      {showTimetableModal && createPortal(
        <div className="modal-overlay" onClick={() => { setShowTimetableModal(false); setEditTimetableTarget(null); }}>
          <div className="glass w-full max-w-lg p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Table className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {editTimetableTarget ? 'แก้ไขคาบเรียนตารางสอน' : 'เพิ่มคาบเรียนในตาราง'}
                  </h2>
                  <p className="text-xs text-slate-400">กำหนดรายละเอียดคาบเรียนสำหรับตารางเรียนประจำสัปดาห์</p>
                </div>
              </div>
              <button onClick={() => { setShowTimetableModal(false); setEditTimetableTarget(null); }} className="p-2 hover:bg-indigo-50 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleTimetableSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">รหัสวิชา *</label>
                  <input
                    type="text"
                    value={timetableForm.subject_code}
                    onChange={e => setTimetableForm(f => ({ ...f, subject_code: e.target.value }))}
                    className="form-input"
                    placeholder="เช่น ค21101"
                    required
                  />
                </div>
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">ชื่อวิชา</label>
                  <input
                    type="text"
                    value={timetableForm.subject_name}
                    onChange={e => setTimetableForm(f => ({ ...f, subject_name: e.target.value }))}
                    className="form-input"
                    placeholder="เช่น คณิตศาสตร์"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">วันในสัปดาห์ *</label>
                  <select
                    value={timetableForm.day_of_week}
                    onChange={e => setTimetableForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
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
                    value={timetableForm.entry_type}
                    onChange={e => setTimetableForm(f => ({ ...f, entry_type: e.target.value }))}
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
                    value={timetableForm.start_period}
                    onChange={e => handlePeriodChange('start_period', Number(e.target.value))}
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
                    value={timetableForm.end_period}
                    onChange={e => handlePeriodChange('end_period', Number(e.target.value))}
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
                    value={timetableForm.start_time}
                    onChange={e => setTimetableForm(f => ({ ...f, start_time: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">เวลาสิ้นสุด *</label>
                  <input
                    type="time"
                    value={timetableForm.end_time}
                    onChange={e => setTimetableForm(f => ({ ...f, end_time: e.target.value }))}
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
                    value={timetableForm.room}
                    onChange={e => setTimetableForm(f => ({ ...f, room: e.target.value }))}
                    className="form-input"
                    placeholder="เช่น 311"
                  />
                </div>
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">กลุ่มเรียน / ชั้นเรียน</label>
                  <input
                    type="text"
                    value={timetableForm.group_name}
                    onChange={e => setTimetableForm(f => ({ ...f, group_name: e.target.value }))}
                    className="form-input"
                    placeholder="เช่น ม.1/1"
                  />
                </div>
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">ผู้สอน</label>
                  <input
                    type="text"
                    value={timetableForm.instructor}
                    onChange={e => setTimetableForm(f => ({ ...f, instructor: e.target.value }))}
                    className="form-input"
                    placeholder="เช่น ครูสมชาย"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-slate-700 font-bold mb-1.5 block">เชื่อมห้องเรียนในระบบ</label>
                  {(timetableForm.entry_type === 'homeroom' || Number(timetableForm.start_period) === 0 || timetableForm.subject_name?.includes('เสาธง') || timetableForm.subject_name?.includes('โฮมรูม') || timetableForm.subject_name?.includes('เข้าแถว')) ? (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>กิจกรรมหน้าเสาธง/โฮมรูม ไม่ต้องเชื่อมห้องเรียน (ไม่นับเป็นคาบสอน)</span>
                    </div>
                  ) : (
                    <select
                      value={timetableForm.classroom_id}
                      onChange={e => setTimetableForm(f => ({ ...f, classroom_id: e.target.value }))}
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
                      value={timetableForm.color || '#3b82f6'}
                      onChange={e => setTimetableForm(f => ({ ...f, color: e.target.value }))}
                      className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer p-0"
                    />
                    <span className="text-xs text-slate-500 font-mono">
                      {timetableForm.color || '#3b82f6'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="submit" disabled={savingTimetable} className="btn btn-primary flex-1">
                  {savingTimetable ? <Loader2 className="w-4 h-4 animate-spin" /> : editTimetableTarget ? 'บันทึกการแก้ไข' : 'เพิ่มคาบเรียน'}
                </button>
                {editTimetableTarget && (
                  <button
                    type="button"
                    onClick={handleDeleteTimetableEntry}
                    className="btn border border-red-200 text-red-500 hover:bg-red-50 px-4"
                    title="ลบคาบเรียนนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowTimetableModal(false);
                    setEditTimetableTarget(null);
                  }}
                  className="btn btn-ghost px-5"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
