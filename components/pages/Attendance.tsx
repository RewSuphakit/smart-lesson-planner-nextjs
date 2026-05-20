'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import { 
  Loader2, Users, Save, Calendar as CalendarIcon, CheckCircle, Clock, XCircle, 
  FileText, AlertCircle, X, History, Trash2, Download, ChevronLeft, ChevronRight, 
  Search, Check, Grid, List, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface Classroom {
  id: string;
  name: string;
  total_classes?: number;
  min_attendance_percent?: number;
}

interface Student {
  id: string;
  student_code?: string;
  name: string;
  classroom_id: string;
  email?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
}

interface StudentStats {
  student_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  converted_absent_count: number;
  remaining_late_count: number;
  remaining_leave_count: number;
  is_f?: boolean;
}

export default function Attendance() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<'daily' | 'matrix'>('daily');
  
  // Matrix history grid state
  const [matrixStartDate, setMatrixStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default to last 14 days
    return d.toISOString().split('T')[0];
  });
  const [matrixEndDate, setMatrixEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matrixRecords, setMatrixRecords] = useState<AttendanceRecord[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixEditingCell, setMatrixEditingCell] = useState<{ studentId: string; date: string } | null>(null);
  
  // History Modal state
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [historyData, setHistoryData] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const cellPopoverRef = useRef<HTMLDivElement>(null);

  // Close cell editing popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cellPopoverRef.current && !cellPopoverRef.current.contains(event.target as Node)) {
        setMatrixEditingCell(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchClassrooms = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/classrooms', { signal });
      setClassrooms(res.data.data || []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudentsAndAttendance = useCallback(async (signal?: AbortSignal) => {
    if (!selectedClass) return;
    try {
      const stuRes = await api.get(`/students?classroom_id=${selectedClass}`, { signal });
      const classStudents = stuRes.data.data || [];
      setStudents(classStudents);

      const attRes = await api.get(`/attendance?classroom_id=${selectedClass}&date=${date}`, { signal });
      const existing = attRes.data.data || [];

      const newAtt: Record<string, string> = {};
      classStudents.forEach((s: Student) => {
        const found = existing.find((e: any) => String(e.student_id) === String(s.id));
        newAtt[s.id] = found ? found.status : 'present';
      });
      setAttendance(newAtt);

      const statsRes = await api.get(`/attendance?classroom_id=${selectedClass}`, { signal });
      setStats(statsRes.data.data || []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลการเช็คชื่อไม่สำเร็จ');
      }
    }
  }, [selectedClass, date]);

  const fetchMatrixData = useCallback(async (signal?: AbortSignal) => {
    if (!selectedClass || activeTab !== 'matrix') return;
    setMatrixLoading(true);
    try {
      const res = await api.get(`/attendance?classroom_id=${selectedClass}&start_date=${matrixStartDate}&end_date=${matrixEndDate}`, { signal });
      setMatrixRecords(res.data.data || []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลประวัติย้อนหลังไม่สำเร็จ');
      }
    } finally {
      setMatrixLoading(false);
    }
  }, [selectedClass, activeTab, matrixStartDate, matrixEndDate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchClassrooms(controller.signal);
    return () => controller.abort();
  }, [fetchClassrooms]);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedClass) {
      fetchStudentsAndAttendance(controller.signal);
    } else {
      setStudents([]);
      setAttendance({});
      setStats([]);
    }
    return () => controller.abort();
  }, [selectedClass, date, fetchStudentsAndAttendance]);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedClass && activeTab === 'matrix') {
      fetchMatrixData(controller.signal);
    }
    return () => controller.abort();
  }, [selectedClass, activeTab, matrixStartDate, matrixEndDate, fetchMatrixData]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedClass || students.length === 0) return;
    setSaving(true);

    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id: Number(student_id),
      classroom_id: Number(selectedClass),
      date: date,
      status: status
    }));

    try {
      await api.post('/attendance', {
        records
      });
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      fetchStudentsAndAttendance();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleMatrixCellUpdate = async (studentId: string, dateStr: string, status: string) => {
    setMatrixEditingCell(null);
    const toastId = toast.loading('กำลังบันทึกข้อมูลย้อนหลัง...');
    try {
      await api.post('/attendance', {
        records: [{
          student_id: Number(studentId),
          classroom_id: Number(selectedClass),
          date: dateStr,
          status: status
        }]
      });
      toast.success('อัปเดตข้อมูลการเข้าเรียนเรียบร้อย', { id: toastId });
      
      // Refresh statistics and matrix data
      fetchMatrixData();
      fetchStudentsAndAttendance();
    } catch {
      toast.error('อัปเดตไม่สำเร็จ', { id: toastId });
    }
  };

  const handleMatrixCellDelete = async (studentId: string, dateStr: string) => {
    setMatrixEditingCell(null);
    // Find record ID
    const record = matrixRecords.find(r => 
      (String(r.student_id) === String(studentId)) && 
      new Date(r.date).toISOString().split('T')[0] === dateStr
    );
    if (!record) return;
    
    const toastId = toast.loading('กำลังลบข้อมูลย้อนหลัง...');
    try {
      await api.delete(`/attendance?id=${record.id}`);
      toast.success('ลบข้อมูลการเข้าเรียนเรียบร้อย', { id: toastId });
      fetchMatrixData();
      fetchStudentsAndAttendance();
    } catch {
      toast.error('ลบข้อมูลไม่สำเร็จ', { id: toastId });
    }
  };

  const getStudentStats = (studentId: string) => {
    return stats.find(s => String(s.student_id) === String(studentId)) || {
      student_id: studentId,
      present_count: 0, late_count: 0, absent_count: 0,
      leave_count: 0, converted_absent_count: 0, remaining_late_count: 0, remaining_leave_count: 0
    };
  };

  const statusBtn = (id: string, status: string, icon: React.ReactNode, label: string, activeClass: string) => {
    const isActive = attendance[id] === status;
    return (
      <button
        onClick={() => handleStatusChange(id, status)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive 
            ? `${activeClass} shadow-md scale-[1.03]` 
            : 'bg-white/50 border border-indigo-50/50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
        }`}
      >
        {icon} {label}
      </button>
    );
  };

  const fetchHistory = async (student: Student) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const res = await api.get(`/attendance?student_id=${student.id}&classroom_id=${selectedClass}`);
      setHistoryData(res.data.data || []);
    } catch {
      toast.error('โหลดประวัติการเช็คชื่อไม่สำเร็จ');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistory = async (recordId: string) => {
    if (!confirm('ต้องการลบประวัติการเช็คชื่อนี้หรือไม่?')) return;
    try {
      await api.delete(`/attendance?id=${recordId}`);
      toast.success('ลบประวัติเรียบร้อยแล้ว');
      if (historyStudent) {
        const res = await api.get(`/attendance?student_id=${historyStudent.id}&classroom_id=${selectedClass}`);
        setHistoryData(res.data.data || []);
      }
      fetchStudentsAndAttendance();
    } catch {
      toast.error('ลบประวัติไม่สำเร็จ');
    }
  };

  const handleClearData = async () => {
    if (!selectedClass || students.length === 0) return;
    
    const dateObj = new Date(date);
    const formattedDateForConfirm = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    if (!confirm(`ยืนยันการล้างข้อมูล?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของทุกคนในห้องนี้\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(การกระทำนี้ไม่สามารถย้อนกลับได้)`)) {
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/attendance?classroom_id=${selectedClass}&date=${date}`);
      toast.success('ล้างข้อมูลการเช็คชื่อของวันนี้เรียบร้อยแล้ว');
      fetchStudentsAndAttendance();
    } catch {
      toast.error('ล้างข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedClass) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('classroom_id', selectedClass);
      if (exportStartDate) params.append('start_date', exportStartDate);
      if (exportEndDate) params.append('end_date', exportEndDate);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'attendance_export.csv';
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/i);
        if (match) filename = decodeURIComponent(match[1]);
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('ส่งออก CSV เรียบร้อยแล้ว');
      setShowExportModal(false);
    } catch {
      toast.error('ส่งออก CSV ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'present': return <span className="text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs font-semibold">มาเรียน</span>;
      case 'late': return <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-semibold">สาย</span>;
      case 'absent': return <span className="text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ขาด</span>;
      case 'leave': return <span className="text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ลา</span>;
      default: return <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-xs font-semibold">{status}</span>;
    }
  };

  // Quick Action: Mark all students
  const handleMarkAll = (status: string) => {
    const newAtt = { ...attendance };
    filteredStudents.forEach(student => {
      newAtt[student.id] = status;
    });
    setAttendance(newAtt);
    toast.success(`เลือก ${status === 'present' ? 'มาเรียน' : status === 'absent' ? 'ขาด' : status === 'late' ? 'สาย' : 'ลา'} ให้กับรายชื่อที่แสดงอยู่`);
  };

  // Reset/Clear attendance state for unsaved changes
  const handleResetDraft = () => {
    fetchStudentsAndAttendance();
    toast.success('คืนค่าการกรอกข้อมูลแล้ว');
  };

  // Adjust Date (Daily tab)
  const adjustDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const setToday = () => setDate(new Date().toISOString().split('T')[0]);
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  // Filters students by search query
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.student_code && student.student_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Daily statistics calculated in real-time
  const dailyStats = {
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    total: students.length,
    marked: 0
  };

  students.forEach(s => {
    const sStatus = attendance[s.id];
    if (sStatus) {
      dailyStats.marked++;
      if (sStatus === 'present') dailyStats.present++;
      else if (sStatus === 'late') dailyStats.late++;
      else if (sStatus === 'absent') dailyStats.absent++;
      else if (sStatus === 'leave') dailyStats.leave++;
    }
  });

  // Calculate unique dates in range for Matrix View
  const getUniqueDates = () => {
    const dates = new Set<string>();
    
    // Add dates that have records
    matrixRecords.forEach(r => {
      if (r.date) {
        const dStr = new Date(r.date).toISOString().split('T')[0];
        dates.add(dStr);
      }
    });

    // Sort dates ascending
    return Array.from(dates).sort();
  };

  const matrixDates = getUniqueDates();
  const selectedClassData = classrooms.find(c => String(c.id) === String(selectedClass));
  const maxAllowedAbsences = selectedClassData ? Math.floor((Number(selectedClassData.total_classes) || 40) * (100 - (Number(selectedClassData.min_attendance_percent) || 80)) / 100) : 0;

  const formattedSelectedDate = new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <p className="text-slate-500 font-medium animate-pulse">กำลังดาวน์โหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight bg-gradient-to-r from-slate-800 to-indigo-900 bg-clip-text text-transparent mb-1">
            เช็คชื่อเข้าเรียน
          </h1>
          <p className="text-slate-500 text-sm">บันทึก ติดตาม และประเมินผลสถิติการมาเรียนของนักเรียนย้อนหลัง</p>
        </div>

        {/* Global Action Tools */}
        {selectedClass && students.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => { setExportStartDate(''); setExportEndDate(''); setShowExportModal(true); }}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200/50 font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              title="ส่งออกข้อมูลการเช็คชื่อเป็น CSV"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก CSV</span>
            </button>
            
            <button
              onClick={handleClearData}
              disabled={saving}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border border-red-200/50 font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              title="ล้างข้อมูลการเช็คชื่อของวันนี้ทั้งห้อง"
            >
              <Trash2 className="w-4 h-4" />
              <span>ล้างวันปัจจุบัน</span>
            </button>
          </div>
        )}
      </div>

      {/* Classroom selector card */}
      <div className="glass p-5 rounded-2xl flex flex-col md:flex-row gap-5 items-center justify-between border border-white/40 shadow-xl shadow-indigo-100/20">
        <div className="w-full md:w-2/3">
          <label className="form-label text-slate-700 font-semibold mb-1.5 block">ห้องเรียน</label>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)} 
              className="form-input text-lg py-2.5 bg-white/70 border-indigo-100/80 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 transition-all font-medium text-slate-800 max-w-md w-full"
            >
              <option value="">-- เลือกห้องเรียน --</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            
            {selectedClassData && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 text-indigo-800 shadow-sm shrink-0">
                <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="text-xs font-semibold leading-relaxed">
                  <span className="block sm:inline">เวลาเรียนขั้นต่ำ: <strong className="text-indigo-900 font-black">{selectedClassData.min_attendance_percent || 80}%</strong></span>
                  <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                  <span className="block sm:inline">สิทธิ์เรียน/สอบ: ขาดได้ไม่เกิน <strong className="text-red-600 font-black">{maxAllowedAbsences} คาบ</strong> <span className="text-slate-500 font-medium">(จากทั้งหมด {selectedClassData.total_classes || 40} คาบ)</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedClass && (
          <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <List className="w-4 h-4" />
              เช็คชื่อประจำวัน
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'matrix'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <Grid className="w-4 h-4" />
              ตารางประวัติย้อนหลัง
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="glass p-20 text-center rounded-2xl border border-white/30">
          <Users className="w-16 h-16 text-indigo-300 mx-auto mb-4 stroke-1" />
          <h3 className="text-xl font-bold text-slate-700 mb-1">ยังไม่ได้เลือกห้องเรียน</h3>
          <p className="text-slate-600 text-sm max-w-sm mx-auto">กรุณาเลือกห้องเรียนด้านบนเพื่อเริ่มเช็คชื่อรายวัน หรือจัดการประวัติเช็คชื่อย้อนหลัง</p>
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-20 text-center rounded-2xl border border-white/30">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4 stroke-1" />
          <h3 className="text-xl font-bold text-slate-700 mb-1">ไม่พบนักเรียน</h3>
          <p className="text-slate-600 text-sm max-w-sm mx-auto mb-4">ไม่มีรายชื่อนักเรียนอยู่ในห้องเรียนนี้ในระบบขณะนี้</p>
          <a href="#students" className="btn btn-primary px-6 py-2.5 inline-flex items-center gap-2">
            <Users className="w-4 h-4" /> เพิ่มนักเรียนเข้าห้องเรียน
          </a>
        </div>
      ) : (
        <>
          {activeTab === 'daily' ? (
            /* ================= DAILY ROLL CALL TAB ================= */
            <div className="space-y-6">
              
              {/* Date Control Panel */}
              <div className="glass p-5 rounded-2xl border border-white/50 shadow-md">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-indigo-50/50 p-1.5 rounded-xl border border-indigo-100/50">
                    <button 
                      onClick={() => adjustDate(-1)} 
                      className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors"
                      title="วันก่อนหน้า"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="relative flex items-center gap-2 px-3 font-semibold text-slate-800 cursor-pointer group">
                      <CalendarIcon className="w-4 h-4 text-indigo-500" />
                      <span>{formattedSelectedDate}</span>
                      <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                    </div>

                    <button 
                      onClick={() => adjustDate(1)} 
                      className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors"
                      title="วันถัดไป"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={setToday} 
                      className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                        date === new Date().toISOString().split('T')[0]
                          ? 'bg-indigo-500 text-white border-indigo-500 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      วันนี้
                    </button>
                    <button 
                      onClick={setYesterday} 
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      เมื่อวาน
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Counters Card */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="glass p-4 rounded-2xl border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">มาเรียน</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.present}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-amber-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">สาย</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.late}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-red-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">ขาด</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.absent}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-blue-500 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">ลา</p>
                    <p className="text-2xl font-black text-slate-800">{dailyStats.leave}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border-l-4 border-l-indigo-600 flex items-center justify-between col-span-2 md:col-span-1 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">บันทึกผล</p>
                    <p className="text-2xl font-black text-slate-800">
                      {dailyStats.marked} <span className="text-sm font-semibold text-slate-500">/ {dailyStats.total}</span>
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-700">
                      {Math.round((dailyStats.marked / (dailyStats.total || 1)) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Student List View */}
              <div className="glass overflow-hidden rounded-2xl border border-white/50 shadow-xl">
                {/* Search and Bulk Operations Bar */}
                <div className="p-4 border-b border-indigo-50/50 bg-white/40 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-2 text-sm bg-white/70 border-indigo-100/50 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <span className="text-xs text-slate-600 font-semibold mr-1">กำหนดเร็ว:</span>
                    <button 
                      onClick={() => handleMarkAll('present')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-semibold border border-emerald-200/40 transition-colors"
                    >
                      มาเรียนทุกคน
                    </button>
                    <button 
                      onClick={() => handleMarkAll('absent')}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold border border-red-200/40 transition-colors"
                    >
                      ขาดทุกคน
                    </button>
                    <button 
                      onClick={handleResetDraft}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300/40 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> คืนค่า
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/70 border-b border-indigo-100/80">
                        <th className="p-4 font-bold text-slate-700 w-24">รหัส</th>
                        <th className="p-4 font-bold text-slate-700">ชื่อ-นามสกุล</th>
                        <th className="p-4 font-bold text-slate-700 min-w-[340px]">สถานะการมาเรียน</th>
                        <th className="p-4 font-bold text-slate-700 text-center w-40">สถิติสะสม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, idx) => {
                        const sStats = getStudentStats(student.id);
                        const isCloseToFRisk = sStats.converted_absent_count >= maxAllowedAbsences * 0.75;
                        return (
                          <tr 
                            key={student.id} 
                            className={`border-b border-indigo-50/50 transition-colors duration-150 hover:bg-indigo-50/30 ${
                              idx % 2 === 0 ? 'bg-white/20' : 'bg-transparent'
                            }`}
                          >
                            <td className="p-4 text-slate-600 text-sm font-semibold">{student.student_code || '-'}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center">
                                  {student.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-800">{student.name}</span>
                                <button 
                                  onClick={() => fetchHistory(student)} 
                                  className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-100/50 transition-all" 
                                  title="ดูประวัติการมาเรียนอย่างละเอียด"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                {statusBtn(student.id, 'present', <CheckCircle className="w-4 h-4" />, 'มาเรียน', 'bg-emerald-500 text-white border border-emerald-600')}
                                {statusBtn(student.id, 'late', <Clock className="w-4 h-4" />, 'สาย', 'bg-amber-500 text-white border border-amber-600')}
                                {statusBtn(student.id, 'absent', <XCircle className="w-4 h-4" />, 'ขาด', 'bg-red-500 text-white border border-red-600')}
                                {statusBtn(student.id, 'leave', <FileText className="w-4 h-4" />, 'ลา', 'bg-blue-500 text-white border border-blue-600')}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                {sStats.is_f ? (
                                  <span className="text-[10px] font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse border border-red-700">
                                    หมดสิทธิ์เรียน
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center w-full">
                                    <div className="flex justify-between w-full max-w-[90px] text-xs font-semibold mb-1">
                                      <span className={sStats.converted_absent_count > 0 ? 'text-red-500' : 'text-slate-600'}>
                                        ขาด {sStats.converted_absent_count}
                                      </span>
                                      <span className="text-slate-600">/ {maxAllowedAbsences}</span>
                                    </div>
                                    <div className="w-full max-w-[90px] bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${
                                          isCloseToFRisk ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'
                                        }`} 
                                        style={{ width: `${Math.min((sStats.converted_absent_count / (maxAllowedAbsences || 1)) * 100, 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                                
                                {(sStats.remaining_late_count > 0 || sStats.remaining_leave_count > 0) && (
                                  <div className="flex gap-1 text-[9px] mt-1 font-semibold opacity-70">
                                    {sStats.remaining_late_count > 0 && <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">สายสะสม {sStats.remaining_late_count}</span>}
                                    {sStats.remaining_leave_count > 0 && <span className="text-blue-500 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 font-semibold">ลาสะสม {sStats.remaining_leave_count}</span>}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sticky Save Bar */}
                <div className="p-4 border-t border-indigo-50/50 bg-indigo-50/30 flex justify-end gap-3">
                  <button
                    onClick={handleResetDraft}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-all duration-200"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary px-8 py-2.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>บันทึกประวัติการเช็คชื่อ</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= ATTENDANCE HISTORY MATRIX GRID ================= */
            <div className="space-y-6">
              
              {/* Date range filter card */}
              <div className="glass p-5 rounded-2xl border border-white/50 shadow-md">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-indigo-500" />
                      <span className="font-semibold text-slate-700">ช่วงวันที่แสดงผล:</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-1 md:flex-initial">
                      <input
                        type="date"
                        value={matrixStartDate}
                        onChange={e => setMatrixStartDate(e.target.value)}
                        className="form-input py-1.5 px-3 text-sm bg-white/70 border-indigo-100/50 rounded-xl w-full md:w-36"
                      />
                      <span className="text-slate-600 font-bold text-sm">ถึง</span>
                      <input
                        type="date"
                        value={matrixEndDate}
                        onChange={e => setMatrixEndDate(e.target.value)}
                        className="form-input py-1.5 px-3 text-sm bg-white/70 border-indigo-100/50 rounded-xl w-full md:w-36"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setMatrixStartDate(d.toISOString().split('T')[0]);
                        setMatrixEndDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      7 วันล่าสุด
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 14);
                        setMatrixStartDate(d.toISOString().split('T')[0]);
                        setMatrixEndDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      14 วันล่าสุด
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setMatrixStartDate(d.toISOString().split('T')[0]);
                        setMatrixEndDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      30 วันล่าสุด
                    </button>
                  </div>
                </div>
              </div>

              {/* Matrix Grid Table */}
              <div className="glass overflow-hidden rounded-2xl border border-white/50 shadow-xl">
                <div className="p-4 border-b border-indigo-50/50 bg-white/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Grid className="w-5 h-5 text-indigo-500" />
                    <span className="font-bold text-slate-800">ตารางการเช็คชื่อสะสม ({matrixDates.length} คาบที่เช็คแล้ว)</span>
                  </div>
                  
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-1.5 text-xs bg-white/70 border-indigo-100/50 rounded-xl"
                    />
                  </div>
                </div>

                {matrixLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="text-slate-500 font-semibold animate-pulse text-sm">กำลังคำนวณข้อมูลประวัติ...</p>
                  </div>
                ) : matrixDates.length === 0 ? (
                  <div className="p-20 text-center">
                    <CalendarIcon className="w-16 h-16 text-indigo-200 mx-auto mb-4 stroke-1" />
                    <h4 className="text-lg font-bold text-slate-700 mb-1">ไม่พบข้อมูลการเช็คชื่อ</h4>
                    <p className="text-slate-600 text-sm max-w-xs mx-auto">ไม่มีประวัติการบันทึกการเช็คชื่อในช่วงวันที่กำหนด</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <div style={{ minWidth: `${Math.max(1000, 176 + (matrixDates.length * 96))}px` }}>
                      <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-indigo-50/70 border-b border-indigo-100/80 sticky top-0 z-20 backdrop-blur-md">
                          <th className="p-4 font-bold text-slate-700 w-44 sticky left-0 bg-indigo-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-indigo-100">
                            นักเรียน ({filteredStudents.length} คน)
                          </th>
                          {matrixDates.map(dateStr => {
                            const dateObj = new Date(dateStr);
                            const day = dateObj.getDate();
                            const month = dateObj.toLocaleDateString('th-TH', { month: 'short' });
                            return (
                              <th key={dateStr} className="p-3 font-bold text-slate-700 text-center w-24 text-xs border-r border-indigo-100/50">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {dateObj.toLocaleDateString('th-TH', { weekday: 'short' })}
                                  </span>
                                  <span className="text-sm font-black text-indigo-800">{day} {month}</span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => {
                          return (
                            <tr 
                              key={student.id} 
                              className={`border-b border-indigo-50/50 hover:bg-indigo-50/20 transition-colors ${
                                idx % 2 === 0 ? 'bg-white/20' : 'bg-transparent'
                              }`}
                            >
                              <td className="p-4 font-semibold text-slate-800 text-sm sticky left-0 bg-white/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-indigo-100 flex items-center gap-2 h-14 overflow-hidden text-ellipsis whitespace-nowrap">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                  {student.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 text-xs truncate leading-snug">{student.name}</p>
                                  {student.student_code && (
                                    <p className="text-[10px] text-slate-500 leading-none mt-0.5">{student.student_code}</p>
                                  )}
                                </div>
                              </td>
                              
                              {matrixDates.map(dateStr => {
                                // Find matching record
                                const record = matrixRecords.find(r => 
                                  (String(r.student_id) === String(student.id)) && 
                                  new Date(r.date).toISOString().split('T')[0] === dateStr
                                );
                                
                                const status = record ? record.status : null;
                                const isEditing = matrixEditingCell?.studentId === student.id && matrixEditingCell?.date === dateStr;

                                return (
                                  <td 
                                    key={dateStr} 
                                    className="p-2 border-r border-indigo-100/40 text-center relative h-14"
                                  >
                                    {!status ? (
                                      <button 
                                        onClick={() => setMatrixEditingCell({ studentId: student.id, date: dateStr })}
                                        className="w-8 h-8 rounded-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center mx-auto transition-all text-xs font-semibold"
                                        title="คลิกเพื่อลงชื่อย้อนหลัง"
                                      >
                                        +
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setMatrixEditingCell({ studentId: student.id, date: dateStr })}
                                        className={`w-14 py-1.5 rounded-xl text-[10px] font-bold mx-auto flex items-center justify-center border transition-all hover:scale-105 ${
                                          status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' :
                                          status === 'late' ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' :
                                          status === 'absent' ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' :
                                          'bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100' // leave
                                        }`}
                                      >
                                        {status === 'present' ? 'มา' : status === 'late' ? 'สาย' : status === 'absent' ? 'ขาด' : 'ลา'}
                                      </button>
                                    )}

                                    {/* Inline cell edit popover */}
                                    {isEditing && (
                                      <div 
                                        ref={cellPopoverRef}
                                        className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white p-2 rounded-xl border border-indigo-100 shadow-xl flex items-center gap-1.5 animate-scale-up"
                                      >
                                        <button 
                                          onClick={() => handleMatrixCellUpdate(student.id, dateStr, 'present')}
                                          className="w-7 h-7 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center justify-center hover:bg-emerald-600 shadow-sm"
                                          title="มาเรียน"
                                        >
                                          มา
                                        </button>
                                        <button 
                                          onClick={() => handleMatrixCellUpdate(student.id, dateStr, 'late')}
                                          className="w-7 h-7 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center justify-center hover:bg-amber-600 shadow-sm"
                                          title="สาย"
                                        >
                                          สาย
                                        </button>
                                        <button 
                                          onClick={() => handleMatrixCellUpdate(student.id, dateStr, 'absent')}
                                          className="w-7 h-7 rounded-lg bg-red-500 text-white font-bold text-xs flex items-center justify-center hover:bg-red-600 shadow-sm"
                                          title="ขาด"
                                        >
                                          ขาด
                                        </button>
                                        <button 
                                          onClick={() => handleMatrixCellUpdate(student.id, dateStr, 'leave')}
                                          className="w-7 h-7 rounded-lg bg-blue-500 text-white font-bold text-xs flex items-center justify-center hover:bg-blue-600 shadow-sm"
                                          title="ลา"
                                        >
                                          ลา
                                        </button>
                                        {record && (
                                          <button 
                                            onClick={() => handleMatrixCellDelete(student.id, dateStr)}
                                            className="w-7 h-7 rounded-lg bg-slate-100 text-red-500 border border-red-100 font-bold text-xs flex items-center justify-center hover:bg-red-50 shadow-sm"
                                            title="ลบสถิตินี้ออก"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="p-4 border-t border-indigo-50/50 bg-indigo-50/30">
                  <p className="text-xs text-slate-600 font-medium">💡 คลิกที่ชื่อย่อสถานะเพื่อเปิดเมนูสำหรับแก้ไขสถิติการมาเรียนย้อนหลังของนักเรียนได้โดยตรง</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= HISTORY LIST MODAL FOR SINGLE STUDENT ================= */}
      {historyStudent && createPortal(
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="glass w-full max-w-md p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">ประวัติการเช็คชื่อ</h2>
                  <p className="text-sm text-slate-600">{historyStudent.name}</p>
                </div>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-slate-500 text-sm font-semibold">ไม่พบสถิติการเช็คชื่อใดๆ</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {historyData.map(record => {
                  const dateObj = new Date(record.date);
                  const formattedDate = dateObj.toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'short'
                  });
                  return (
                    <div key={record.id} className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 hover:bg-indigo-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm text-slate-700 font-semibold">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusDisplay(record.status)}
                        <button 
                          onClick={() => handleDeleteHistory(record.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-150"
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
            
            <div className="mt-5 pt-4 border-t border-indigo-50/50 flex justify-end">
              <button 
                onClick={() => setHistoryStudent(null)} 
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= EXPORT CSV MODAL ================= */}
      {showExportModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="glass w-full max-w-md p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">ส่งออกไฟล์ข้อมูล CSV</h2>
                  <p className="text-sm text-slate-600">{selectedClassData?.name || 'ห้องเรียน'}</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> กำหนดช่วงเวลาที่ต้องการ (ไม่บังคับ)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block font-semibold">เริ่มจาก</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={e => setExportStartDate(e.target.value)}
                      className="form-input text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block font-semibold">สิ้นสุดที่</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={e => setExportEndDate(e.target.value)}
                      className="form-input text-sm rounded-xl"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                  * หากไม่เลือกช่วงเวลา ระบบจะส่งออกสถิติเช็คชื่อทั้งหมดตั้งแต่สร้างห้องเรียน
                </p>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                <p className="text-[11px] text-amber-800 font-semibold leading-normal">
                  💡 ข้อมูลไฟล์ CSV มีการเข้ารหัสภาษาไทย สามารถนำไปเปิดใช้งานต่อได้ทั้งบน Excel, Google Sheets, หรือโปรแกรมชีตทั่วไป
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-indigo-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)} 
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                ยกเลิก
              </button>
              
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>ดาวน์โหลด CSV</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
