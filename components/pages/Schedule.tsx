'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO
} from 'date-fns';
import { th } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2,
  Clock, Trash2, Calendar, BookOpen, Edit2, AlertCircle,
  UploadCloud, FileText, Table
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const DAY_NAMES = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const TIMETABLE_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const PERIODS = Array.from({ length: 13 }, (_, i) => i + 1);

interface ScheduleItem {
  id: string | number;
  lesson_plan_id: string | number;
  lesson_title?: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface Lesson {
  id: string | number;
  title: string;
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
  entry_type: 'lab' | 'activity' | 'homeroom' | 'theory' | string;
  hours?: number;
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

function getMonthGrid(date: Date) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(date),     { weekStartsOn: 1 });
  const days  = [];
  let cur     = start;
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
  return days;
}

const STATUS_STYLE = {
  scheduled:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10',
  completed:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10',
};
const STATUS_LABEL = { scheduled: 'กำหนดสอน', completed: 'สอนแล้ว', cancelled: 'ยกเลิก' };

function defaultForm(date: Date) {
  return {
    lesson_plan_id: '',
    scheduled_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time:   '10:00',
    notes:       '',
    status:      'scheduled' as 'scheduled' | 'completed' | 'cancelled',
  };
}

export default function Schedule() {
  const [activeTab, setActiveTab] = useState('calendar');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay,  setSelectedDay]  = useState(new Date());
  const [schedules,    setSchedules]    = useState<ScheduleItem[]>([]);
  const [lessons,      setLessons]      = useState<Lesson[]>([]);
  
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [timetableSummary, setTimetableSummary] = useState<TimetableSummaryItem[]>([]);
  
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<ScheduleItem | null>(null);
  const [form,         setForm]         = useState(() => defaultForm(new Date()));
  const [saving,       setSaving]       = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draggedEntry, setDraggedEntry] = useState<TimetableEntry | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [autoGenerateStartDate, setAutoGenerateStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [autoGenerating, setAutoGenerating] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (activeTab === 'calendar') {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end   = format(endOfMonth(currentMonth),   'yyyy-MM-dd');
        const [schRes, lesRes] = await Promise.all([
          api.get("/schedules?start=" + start + "&end=" + end, { signal }),
          api.get('/lessons', { signal }),
        ]);
        setSchedules(schRes.data.data || []);
        setLessons(lesRes.data.data   || []);
      } else {
        const res = await api.get('/timetable', { signal });
        const timetableData = res.data.data || {};
        // Safely extract entries, ensuring we don't accidentally get Array.prototype.entries if data is an array
        const entries = Array.isArray(timetableData.entries) ? timetableData.entries : [];
        const summary = Array.isArray(timetableData.summary) ? timetableData.summary : [];
        setTimetableEntries(entries);
        setTimetableSummary(summary);
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, [currentMonth, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const openCreate = (day?: Date) => {
    setEditTarget(null);
    setForm(defaultForm(day || selectedDay));
    setShowForm(true);
  };

  const openEdit = (sch: ScheduleItem) => {
    setEditTarget(sch);
    setForm({
      lesson_plan_id: sch.lesson_plan_id ? String(sch.lesson_plan_id) : '',
      scheduled_date: sch.scheduled_date?.slice(0, 10) ?? '',
      start_time:     sch.start_time?.slice(0, 5)      ?? '09:00',
      end_time:       sch.end_time?.slice(0, 5)        ?? '10:00',
      notes:          sch.notes  ?? '',
      status:         sch.status ?? 'scheduled',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditTarget(null); };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lesson_plan_id) return toast.error('กรุณาเลือกแผนการสอน');
    if (!form.scheduled_date) return toast.error('กรุณาเลือกวันที่');
    if (form.start_time >= form.end_time) return toast.error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
    setSaving(true);
    try {
      if (editTarget) {
        await api.put("/schedules/" + editTarget.id, form);
        toast.success('อัปเดตตารางสอนเรียบร้อย');
      } else {
        await api.post('/schedules', form);
        toast.success('เพิ่มตารางสอนเรียบร้อย');
      }
      closeForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string | number) => {
    if (!window.confirm('ต้องการลบตารางสอนนี้หรือไม่?')) return;
    try {
      await api.delete("/schedules/" + id);
      toast.success('ลบตารางสอนแล้ว');
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const handleAutoGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoGenerateStartDate) return toast.error('กรุณาระบุวันเริ่มต้นภาคเรียน');
    setAutoGenerating(true);
    try {
      const res = await api.post('/schedules', {
        action: 'generate',
        start_date: autoGenerateStartDate
      });
      toast.success(res.data.message || 'สร้างตารางสอนล่วงหน้าสำเร็จ');
      setShowAutoGenerate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สร้างตารางสอนล่วงหน้าไม่สำเร็จ');
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return toast.error('กรุณาเลือกไฟล์');
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('replace', 'true');
    
    setUploading(true);
    try {
      const res = await api.post('/timetable/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'อัพโหลดสำเร็จ');
      setShowUpload(false);
      setUploadFile(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'อัพโหลดไม่สำเร็จ กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      setUploading(false);
    }
  };

  const clearTimetable = async () => {
    if (!window.confirm('ต้องการลบตารางสอนทั้งหมดใช่หรือไม่?')) return;
    try {
      await api.delete('/timetable/clear');
      toast.success('ล้างตารางสอนแล้ว');
      fetchData();
    } catch {
      toast.error('ทำรายการไม่สำเร็จ');
    }
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

  const handleDrop = async (e: React.DragEvent, dayIdx: number, slotId: string | number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedEntry) return;

    try {
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
        await api.put(`/timetable/${draggedEntry.id}/resize`, {
          end_period: Number(slotId)
        });
        toast.success('ปรับขนาดคาบเรียนสำเร็จ');
      } else {
        await api.put(`/timetable/${draggedEntry.id}/move`, {
          day_of_week: dayIdx,
          start_period: Number(slotId)
        });
        toast.success('ย้ายตารางสอนสำเร็จ');
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    }
    setDraggedEntry(null);
    setDragType(null);
  };

  const days = getMonthGrid(currentMonth);
  const schedulesForDay = (day: Date) => schedules.filter(s => isSameDay(parseISO(s.scheduled_date?.slice(0, 10)), day));
  const selectedDaySchedules = schedulesForDay(selectedDay);
  const getLessonTitle = (id: string | number) => lessons.find(l => String(l.id) === String(id))?.title || ("แผนที่ " + id);

  const renderCalendar = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 animate-fade-in-up">
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-base font-bold text-slate-800">
            {format(currentMonth, 'MMMM yyyy', { locale: th })}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[0.68rem] font-semibold text-slate-500 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const daySchs  = schedulesForDay(day);
              const isToday  = isSameDay(day, new Date());
              const isCurMon = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDay);
              
              let btnClass = "relative rounded-2xl p-2 min-h-[64px] text-left transition-all duration-300 border ";
              if (!isCurMon) {
                btnClass += "opacity-30 border-transparent";
              } else {
                btnClass += "border-indigo-100 bg-indigo-50";
              }
              
              if (isSelected) {
                btnClass += " bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/20 scale-105 z-10";
              } else {
                btnClass += " hover:bg-white/[0.06] hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-lg";
              }
              
              let numClass = "text-[0.72rem] font-bold w-7 h-7 flex items-center justify-center rounded-xl mb-1.5 ";
              if (isToday) {
                numClass += "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30";
              } else if (isSelected) {
                numClass += "text-indigo-700";
              } else {
                numClass += "text-slate-600";
              }

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={btnClass}
                >
                  <span className={numClass}>
                    {format(day, 'd')}
                  </span>
                  {daySchs.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {daySchs.slice(0, 2).map((s, j) => (
                        <div key={j} className={"text-[0.55rem] font-medium leading-tight rounded-[4px] px-1.5 py-0.5 truncate border backdrop-blur-md " + (STATUS_STYLE[s.status] || STATUS_STYLE.scheduled)}>
                          {s.start_time?.slice(0, 5)} {s.lesson_title}
                        </div>
                      ))}
                      {daySchs.length > 2 && <div className="text-[0.55rem] text-slate-500 pl-1">+{daySchs.length - 2}</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{format(selectedDay, 'EEEE', { locale: th })}</p>
            <h3 className="text-xl font-bold text-slate-800">{format(selectedDay, 'd MMMM yyyy', { locale: th })}</h3>
          </div>
          <button onClick={() => openCreate(selectedDay)} className="p-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="divider" />
        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
        ) : selectedDaySchedules.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3"><Calendar className="w-6 h-6 text-slate-700" /></div>
            <p className="text-slate-500 text-sm font-medium">ไม่มีตารางสอนในวันนี้</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto flex-1">
            {selectedDaySchedules.sort((a, b) => a.start_time?.localeCompare(b.start_time)).map((sch) => (
              <div key={sch.id} className="glass p-5 rounded-2xl group relative overflow-hidden border border-indigo-100 transition-all hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold bg-indigo-50 px-2 py-1 rounded-md">{sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}</span>
                      <span className={"text-[0.65rem] font-bold px-2 py-1 rounded-md " + STATUS_STYLE[sch.status]}>{STATUS_LABEL[sch.status]}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{sch.lesson_title || getLessonTitle(sch.lesson_plan_id)}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(sch)} className="p-1.5 rounded-md hover:bg-indigo-100 text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteSchedule(sch.id)} className="p-1.5 rounded-md hover:bg-red-100 text-slate-600 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTimetable = () => {
    const entriesByDay: Record<number, TimetableEntry[]> = {};
    for (let i = 0; i < 7; i++) entriesByDay[i] = [];
    
    timetableEntries.forEach(entry => {
      entriesByDay[entry.day_of_week].push(entry);
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
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-slate-500">ตารางสอนรายสัปดาห์</p>
          <div className="flex gap-3">
            <button onClick={() => setShowUpload(true)} className="btn btn-primary">
              <UploadCloud className="w-4 h-4" /> อัพโหลดไฟล์ตาราง (รูปภาพ/CSV/PDF)
            </button>
            {timetableEntries.length > 0 && (
              <button onClick={clearTimetable} className="btn btn-ghost text-red-500 hover:bg-red-50 hover:border-red-200">
                ล้างข้อมูล
              </button>
            )}
          </div>
        </div>

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
                            className={`border border-slate-200 min-h-[60px] transition-colors ${isDragOver ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 ring-inset z-[5]' : ''}`}
                            style={{ gridRow: 1, gridColumn: colPos }}
                            onDragOver={(e) => handleDragOver(e, dayIdx, slot.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, dayIdx, slot.id)}
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
                            className={`border rounded-md m-[2px] relative group transition-transform hover:scale-[1.03] z-10 hover:z-50 ${getBgColor(entry.entry_type)}`}
                            style={{
                              gridColumn: `${gridColStart} / ${gridColEnd}`,
                              gridRow: 1,
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
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoverTooltip({ entry, rect });
                            }}
                            onMouseLeave={() => setHoverTooltip(null)}
                          >
                            <div 
                              className="w-full h-full p-2 text-center cursor-grab active:cursor-grabbing flex flex-col justify-center min-h-[56px]"
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, entry, 'move')}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="text-[0.7rem] font-bold truncate" title={entry.subject_code}>
                                {entry.subject_code}
                              </div>
                              {entry.room && <div className="text-[0.6rem] opacity-75 truncate">({entry.room}) {entry.group_name}</div>}
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
                {timetableSummary.map((sum, i) => (
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
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ตารางสอน</h1>
          <p className="text-slate-500 text-sm">จัดการเวลาเรียนและการสอนของคุณ</p>
        </div>
        <button 
          onClick={() => setShowAutoGenerate(true)} 
          className="btn btn-primary bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold flex items-center gap-2 border-0 shadow-lg shadow-indigo-200/50"
        >
          <Table className="w-4 h-4" /> สร้างแผนสอนล่วงหน้าอัตโนมัติ
        </button>
      </div>

      <div className="flex p-1 bg-indigo-500/5 backdrop-blur-sm rounded-xl w-fit border border-indigo-500/10">
        <button
          onClick={() => setActiveTab('calendar')}
          className={"px-5 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          ปฏิทินแผนการสอน
        </button>
        <button
          onClick={() => setActiveTab('timetable')}
          className={"px-5 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === 'timetable' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          ตารางเรียนประจำสัปดาห์
        </button>
      </div>

      {activeTab === 'calendar' ? renderCalendar() : renderTimetable()}

      {showForm && createPortal(
        <div className="modal-overlay" onClick={closeForm}>
          <div className="glass w-full max-w-md p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{editTarget ? 'แก้ไขตารางสอน' : 'เพิ่มตารางสอน'}</h2>
                </div>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="form-label">แผนการสอน *</label>
                {lessons.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <p className="text-xs text-amber-700">ไม่มีแผนการสอน</p>
                  </div>
                ) : (
                  <select value={form.lesson_plan_id} onChange={e => setForm(f => ({ ...f, lesson_plan_id: e.target.value }))} className="form-input" required>
                    <option value="">เลือกแผนการสอน...</option>
                    {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="form-label">วันที่ *</label>
                <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="form-input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">เริ่ม *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">สิ้นสุด *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="form-input" required />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving || lessons.length===0} className="btn btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? 'บันทึก' : 'เพิ่ม'}
                </button>
                <button type="button" onClick={closeForm} className="btn btn-ghost px-5">ยกเลิก</button>
              </div>
            </form>
          </div>
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

      {showAutoGenerate && createPortal(
        <div className="modal-overlay" onClick={() => setShowAutoGenerate(false)}>
          <div className="glass w-full max-w-lg p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Table className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">สร้างแผนการสอนล่วงหน้าอัตโนมัติ</h2>
                  <p className="text-xs text-slate-400">ตามตารางเรียนประจำสัปดาห์และห้องเรียน</p>
                </div>
              </div>
              <button onClick={() => setShowAutoGenerate(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <form onSubmit={handleAutoGenerateSubmit} className="space-y-5">
              <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-2xl p-4 border border-indigo-100/50">
                <p className="text-xs text-indigo-900 leading-relaxed font-semibold mb-2">
                  💡 ระบบจะทำการคำนวณและป้อนแผนการสอนลงบนปฏิทินตลอดภาคเรียนให้โดยอัตโนมัติ:
                </p>
                <ul className="list-disc list-inside text-[0.7rem] text-slate-600 space-y-1">
                  <li>จับคู่ห้องเรียนจาก <strong>ตารางเรียนประจำสัปดาห์ (Timetable)</strong></li>
                  <li>คำนวณวันและเวลาสอนแต่ละสัปดาห์เรียงตามคาบเรียนล่วงหน้า</li>
                  <li>จำนวนคาบเรียนที่สร้างจะอิงตาม <strong>จำนวนคาบทั้งหมด</strong> ที่ตั้งค่าในแต่ละห้องเรียน (วิชาแต่ละวิชาสอนจำนวนสัปดาห์ไม่เท่ากัน)</li>
                  <li>เรียงลำดับแผนการสอนที่มีตามเนื้อหาคาบเรียนอัตโนมัติ</li>
                </ul>
              </div>

              <div>
                <label className="form-label text-slate-700 font-bold mb-1.5 block">วันเริ่มต้นภาคเรียน *</label>
                <input 
                  type="date" 
                  value={autoGenerateStartDate} 
                  onChange={e => setAutoGenerateStartDate(e.target.value)} 
                  className="form-input text-lg py-2.5" 
                  required 
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button type="submit" disabled={autoGenerating} className="btn btn-primary flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 border-0 py-2.5 text-sm font-bold shadow-lg shadow-indigo-100">
                  {autoGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      กำลังสร้างตารางสอนล่วงหน้า...
                    </>
                  ) : 'เริ่มต้นสร้างแผนการสอนล่วงหน้า'}
                </button>
                <button type="button" onClick={() => setShowAutoGenerate(false)} className="btn btn-ghost px-5 text-slate-600">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {hoverTooltip && !draggedEntry && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
