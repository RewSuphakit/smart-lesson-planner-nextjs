'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  X, Loader2, Trash2, AlertCircle,
  UploadCloud, FileText, Table, Download,
  FileSpreadsheet, Sparkles, CheckCircle2, Info
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
  const [exampleTab, setExampleTab] = useState<'csv' | 'ai'>('csv');
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
    0: { start: '07:30', end: '08:00' },
    1: { start: '08:00', end: '09:00' },
    2: { start: '09:00', end: '10:00' },
    3: { start: '10:00', end: '11:00' },
    4: { start: '11:00', end: '12:00' },
    5: { start: '13:00', end: '14:00' },
    6: { start: '14:00', end: '15:00' },
    7: { start: '15:00', end: '16:00' },
    8: { start: '16:00', end: '17:00' },
    9: { start: '17:00', end: '18:00' },
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

  const handleDownloadCsvTemplate = () => {
    const csvContent = '\uFEFF' + [
      'วัน,คาบเริ่ม,คาบสิ้นสุด,รหัสวิชา,ชื่อวิชา,ห้อง,กลุ่ม,ประเภท,อาจารย์',
      'จันทร์,1,1,20000-1101,กิจกรรมหน้าเสาธงและโฮมรูม,หน้าเสาธง,ปวช.1/1,โฮมรูม,ครูที่ปรึกษา',
      'จันทร์,2,4,20001-1005,การใช้คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ,734,ปวช.1/1,ปฏิบัติ,อ.xxxx',
      'จันทร์,5,8,21909-2011,การเขียนโปรแกรมเชิงวัตถุ,735,ปวช.2/1,ปฏิบัติ,อ.ณัฐนันท์',
      'อังคาร,2,4,30001-1003,การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ,745,ปวส.1/6,ทฤษฎี,อ.xxxx',
      'พุธ,2,4,30901-1001,การพัฒนาเว็บแอปพลิเคชัน,ห้องคอมฯ ต้นแบบ 2,ปวส.2/2,ปฏิบัติ,อ.xxxx',
      'พุธ,5,6,20000-2001,กิจกรรมลูกเสือวิสามัญ 1,โดม,ชค.1/1,กิจกรรม,อ.สมชาย',
      'พฤหัสบดี,1,4,20901-2002,ระบบเครือข่ายคอมพิวเตอร์เบื้องต้น,LAB-1,ชค.2/1,ปฏิบัติ,อ.xxxx',
      'ศุกร์,2,4,20000-1201,ภาษาอังกฤษเพื่อการสื่อสารในงานอาชีพ,421,ชฟ.2/1,ทฤษฎี,Teacher xxx',
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'เทมเพลต_ตารางสอน.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('ดาวน์โหลดไฟล์ตัวอย่าง CSV สำเร็จ');
  };

  const handleDownloadExcelTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['วัน', 'คาบเริ่ม', 'คาบสิ้นสุด', 'รหัสวิชา', 'ชื่อวิชา', 'ห้อง', 'กลุ่ม', 'ประเภท', 'อาจารย์'];
      const rows = [
        ['จันทร์', 1, 1, '20000-1101', 'กิจกรรมหน้าเสาธงและโฮมรูม', 'หน้าเสาธง', 'ปวช.1/1', 'โฮมรูม', 'ครูที่ปรึกษา'],
        ['จันทร์', 2, 4, '20001-1005', 'การใช้คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ', '734', 'ปวช.1/1', 'ปฏิบัติ', 'อ.xxxx'],
        ['จันทร์', 5, 8, '21909-2011', 'การเขียนโปรแกรมเชิงวัตถุ', '735', 'ปวช.2/1', 'ปฏิบัติ', 'อ.ณัฐนันท์'],
        ['อังคาร', 2, 4, '30001-1003', 'การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ', '745', 'ปวส.1/6', 'ทฤษฎี', 'อ.xxxx'],
        ['พุธ', 2, 4, '30901-1001', 'การพัฒนาเว็บแอปพลิเคชัน', 'ห้องคอมฯ ต้นแบบ 2', 'ปวส.2/2', 'ปฏิบัติ', 'อ.xxxx'],
        ['พุธ', 5, 6, '20000-2001', 'กิจกรรมลูกเสือวิสามัญ 1', 'โดม', 'ชค.1/1', 'กิจกรรม', 'อ.สมชาย'],
        ['พฤหัสบดี', 1, 4, '20901-2002', 'ระบบเครือข่ายคอมพิวเตอร์เบื้องต้น', 'LAB-1', 'ชค.2/1', 'ปฏิบัติ', 'อ.xxxx'],
        ['ศุกร์', 2, 4, '20000-1201', 'ภาษาอังกฤษเพื่อการสื่อสารในงานอาชีพ', '421', 'ชฟ.2/1', 'ทฤษฎี', 'Teacher xxx'],
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
        { wch: 38 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'ตารางสอน');
      XLSX.writeFile(wb, 'เทมเพลต_ตารางสอน.xlsx');
      toast.success('ดาวน์โหลดไฟล์ตัวอย่าง Excel สำเร็จ');
    } catch (err) {
      console.error(err);
      toast.error('ดาวน์โหลดไฟล์ตัวอย่าง Excel ไม่สำเร็จ');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return toast.error('กรุณาเลือกไฟล์');

    const formData = new FormData();

    // Auto-convert .xlsx/.xls to CSV if selected
    if (uploadFile.name.endsWith('.xlsx') || uploadFile.name.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await uploadFile.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvString = XLSX.utils.sheet_to_csv(ws);
        const csvBlob = new Blob(['\uFEFF' + csvString], { type: 'text/csv' });
        const convertedFile = new File([csvBlob], uploadFile.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' });
        formData.append('file', convertedFile);
      } catch (err) {
        console.warn('Could not convert xlsx, falling back to original file:', err);
        formData.append('file', uploadFile);
      }
    } else {
      formData.append('file', uploadFile);
    }

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
          <div className="glass w-full max-w-3xl p-6 sm:p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto space-y-5 rounded-3xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-indigo-50/80">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">อัพโหลดตารางสอน & ตัวอย่างรูปแบบไฟล์</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตรวจสอบตัวอย่างรูปแบบไฟล์ที่ระบบรองรับ ดาวน์โหลดเทมเพลต หรืออัพโหลดไฟล์เพื่อสร้างตารางสอน
                  </p>
                </div>
              </div>
              <button onClick={() => setShowUpload(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Tabs & Download Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex bg-slate-100/90 p-1 rounded-2xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setExampleTab('csv')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${exampleTab === 'csv'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-indigo-600'
                      }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>ตัวอย่างไฟล์ CSV / Excel (แนะนำ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExampleTab('ai')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${exampleTab === 'ai'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-indigo-600'
                      }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>ตัวอย่างรูปภาพ & PDF (AI)</span>
                  </button>
                </div>

                {exampleTab === 'csv' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadCsvTemplate}
                      className="btn bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                      title="ดาวน์โหลดไฟล์ตัวอย่าง .csv สำหรับเปิดใน Excel หรือโปรแกรมสเปรดชีต"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ดาวน์โหลดตัวอย่าง CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="btn bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                      title="ดาวน์โหลดไฟล์ตัวอย่าง .xlsx พร้อมตารางและสูตร"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>ดาวน์โหลดตัวอย่าง Excel</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: CSV / Excel Guide & Preview */}
              {exampleTab === 'csv' ? (
                <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 p-4 rounded-2xl border border-indigo-100/80 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-indigo-900">โครงสร้างคอลัมน์ที่ระบบรองรับ (Header)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          แม่นยำ 100%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        แถวแรกต้องเป็นชื่อคอลัมน์ (รองรับทั้งภาษาไทยและอังกฤษ: วัน, คาบเริ่ม, คาบสิ้นสุด, รหัสวิชา, ชื่อวิชา, ห้อง, กลุ่ม, ประเภท, อาจารย์)
                      </p>
                    </div>
                  </div>

                  {/* Table Sample Preview */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs max-h-48 custom-scrollbar">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-indigo-50/80 border-b border-indigo-100 text-slate-700 font-bold">
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">วัน</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap text-center">คาบเริ่ม</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap text-center">คาบสิ้นสุด</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">รหัสวิชา</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap min-w-[160px]">ชื่อวิชา</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">ห้อง</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">กลุ่ม</th>
                          <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">ประเภท</th>
                          <th className="p-2 whitespace-nowrap">อาจารย์</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">จันทร์</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">1</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">1</td>
                          <td className="p-2 border-r border-slate-100 font-mono text-slate-500">20000-1101</td>
                          <td className="p-2 border-r border-slate-100">กิจกรรมหน้าเสาธงและโฮมรูม</td>
                          <td className="p-2 border-r border-slate-100">หน้าเสาธง</td>
                          <td className="p-2 border-r border-slate-100">ปวช.1/1</td>
                          <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold">โฮมรูม</span></td>
                          <td className="p-2 text-slate-500">ครูที่ปรึกษา</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">จันทร์</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">2</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">4</td>
                          <td className="p-2 border-r border-slate-100 font-mono font-bold text-slate-800">20001-1005</td>
                          <td className="p-2 border-r border-slate-100">การใช้คอมพิวเตอร์และสารสนเทศฯ</td>
                          <td className="p-2 border-r border-slate-100">734</td>
                          <td className="p-2 border-r border-slate-100">ปวช.1/1</td>
                          <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">ปฏิบัติ</span></td>
                          <td className="p-2 text-slate-500">อ.xxxx</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">อังคาร</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">2</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">4</td>
                          <td className="p-2 border-r border-slate-100 font-mono font-bold text-slate-800">30001-1003</td>
                          <td className="p-2 border-r border-slate-100">การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ</td>
                          <td className="p-2 border-r border-slate-100">745</td>
                          <td className="p-2 border-r border-slate-100">ปวส.1/6</td>
                          <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">ทฤษฎี</span></td>
                          <td className="p-2 text-slate-500">อ.xxxx</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">พุธ</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">5</td>
                          <td className="p-2 border-r border-slate-100 text-center font-mono">6</td>
                          <td className="p-2 border-r border-slate-100 font-mono text-slate-500">20000-2001</td>
                          <td className="p-2 border-r border-slate-100">กิจกรรมลูกเสือวิสามัญ 1</td>
                          <td className="p-2 border-r border-slate-100">โดม</td>
                          <td className="p-2 border-r border-slate-100">ชค.1/1</td>
                          <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">กิจกรรม</span></td>
                          <td className="p-2 text-slate-500">อ.สมชาย</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Tab 2: AI Image & PDF Guide */
                <div className="bg-gradient-to-br from-purple-50/70 via-indigo-50/50 to-pink-50/40 p-4 rounded-2xl border border-purple-100/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-purple-900">รูปแบบตารางสอนที่ AI (Gemini) ถอดความได้ดีที่สุด</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      OCR & AI วิเคราะห์
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white/90 rounded-xl border border-purple-100/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ตารางสอนรายสัปดาห์ / ตารางครูผู้สอน</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        ตารางมาตรฐานจากระบบ ศธ.02, RMS หรือแบบฟอร์มวิทยาลัย ที่มีแถววัน (จันทร์-ศุกร์) และคาบเวลา (1-10) ชัดเจน
                      </p>
                    </div>

                    <div className="p-3 bg-white/90 rounded-xl border border-purple-100/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>มีรหัสวิชาและชื่อห้องเรียนระบุ</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        ควรมีรหัสวิชา 5 หลักหรือ 5 หลักขีด 4 หลัก (เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">30001-1003</code>) และกลุ่มเรียน เพื่อให้ AI จัดกลุ่มวิชาได้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50/90 p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>เคล็ดลับ:</strong> ถ่ายรูปให้ตรง แสงสว่างเพียงพอ ไม่เบลอ ไม่เอียง และครอบตัดให้เห็นเฉพาะตารางสอนเพื่อความแม่นยำสูงสุด
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-1">
              <div
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition-all cursor-pointer ${uploadFile
                    ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-200/50'
                    : 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40'
                  }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {uploadFile ? 'เปลี่ยนไฟล์ที่เลือก' : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  รองรับไฟล์ภาพ <strong className="text-slate-700">.JPG, .PNG</strong>, เอกสาร <strong className="text-slate-700">.PDF</strong>, และตาราง <strong className="text-slate-700">.CSV, .XLSX</strong> (สูงสุด 5MB)
                </p>

                {uploadFile && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-900 text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="truncate max-w-[260px] sm:max-w-md">{uploadFile.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-red-500 ml-1 p-0.5"
                      title="ล้างไฟล์ที่เลือก"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.csv,.pdf,.xlsx,.xls,application/pdf,text/csv,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              {/* Warning Notice */}
              <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200/80 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-900 font-medium leading-tight">
                  การอัพโหลดตารางสอนใหม่จะแทนที่ข้อมูลตารางเรียนเดิมทั้งหมดในระบบ
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="btn px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="btn btn-primary flex-1 py-2.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังให้ AI ประมวลผลตารางเรียน (อาจใช้เวลาสักครู่)...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>อัพโหลดและสร้างตารางสอน</span>
                    </>
                  )}
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
