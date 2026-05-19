'use client';
// @ts-nocheck
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import { Loader2, Users, Save, Calendar as CalendarIcon, CheckCircle, Clock, XCircle, FileText, AlertCircle, X, History, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Attendance() {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsAndAttendance();
    } else {
      setStudents([]);
      setAttendance({});
      setStats([]);
    }
  }, [selectedClass, date]);

  const fetchClassrooms = async () => {
    try {
      const res = await api.get('/classrooms');
      setClassrooms(res.data.data || []);
    } catch {
      toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    try {
      const stuRes = await api.get('/students');
      const classStudents = (stuRes.data.data || []).filter(s => s.classroom_id == selectedClass);
      setStudents(classStudents);

      const attRes = await api.get('/attendance?classroom_id=' + selectedClass + '&date=' + date);
      const existing = attRes.data.data || [];

      const newAtt = {};
      classStudents.forEach(s => {
        const found = existing.find(e => e.student_id === s.id);
        newAtt[s.id] = found ? found.status : 'present';
      });
      setAttendance(newAtt);

      const statsRes = await api.get('/attendance/stats/' + selectedClass);
      setStats(statsRes.data.data || []);
    } catch {
      toast.error('โหลดข้อมูลการเช็คชื่อไม่สำเร็จ');
    }
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedClass || students.length === 0) return;
    setSaving(true);

    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id,
      status
    }));

    try {
      await api.post('/attendance/mark', {
        classroom_id: selectedClass,
        date,
        attendance_records: records
      });
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      fetchStudentsAndAttendance();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const getStudentStats = (studentId) => {
    return stats.find(s => s.student_id == studentId) || {
      present_count: 0, late_count: 0, absent_count: 0,
      leave_count: 0, converted_absent_count: 0, remaining_late_count: 0
    };
  };

  const statusBtn = (id, status, icon, label, activeClass) => {
    const isActive = attendance[id] === status;
    return (
      <button
        onClick={() => handleStatusChange(id, status)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive ? activeClass : 'bg-white text-slate-600 hover:bg-indigo-100'}`}
      >
        {icon} {label}
      </button>
    );
  };

  const fetchHistory = async (student) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const res = await api.get(`/attendance/history/${student.id}?classroom_id=${selectedClass}`);
      setHistoryData(res.data.data || []);
    } catch {
      toast.error('โหลดประวัติการเช็คชื่อไม่สำเร็จ');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistory = async (recordId) => {
    if (!confirm('ต้องการลบประวัติการเช็คชื่อนี้หรือไม่?')) return;
    try {
      await api.delete(`/attendance/${recordId}`);
      toast.success('ลบประวัติเรียบร้อยแล้ว');
      if (historyStudent) {
        const res = await api.get(`/attendance/history/${historyStudent.id}?classroom_id=${selectedClass}`);
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
      await api.delete(`/attendance/clear/${selectedClass}/${date}`);
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
      if (exportStartDate) params.append('start_date', exportStartDate);
      if (exportEndDate) params.append('end_date', exportEndDate);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/export/${selectedClass}?${params.toString()}`, {
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

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'present': return <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-xs font-medium border border-emerald-500/20">มาเรียน</span>;
      case 'late': return <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-medium border border-amber-500/20">สาย</span>;
      case 'absent': return <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-xs font-medium border border-red-500/20">ขาด</span>;
      case 'leave': return <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-xs font-medium border border-blue-500/20">ลา</span>;
      default: return <span className="text-slate-600 bg-indigo-100 px-2 py-0.5 rounded text-xs font-medium border border-indigo-200">{status}</span>;
    }
  };

  const selectedClassData = classrooms.find(c => c.id == selectedClass);
  const maxAllowedAbsences = selectedClassData ? Math.floor((selectedClassData.total_classes || 40) * (100 - (selectedClassData.min_attendance_percent || 80)) / 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const formattedSelectedDate = new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const setToday = () => setDate(new Date().toISOString().split('T')[0]);
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">เช็คชื่อ</h1>
        <p className="text-slate-500 text-sm">บันทึกการมาเรียนของนักเรียนแต่ละห้องเรียน</p>
      </div>

      {/* Header & Controls */}
      <div className="glass p-5 rounded-2xl flex flex-col gap-5">
        <div className="flex flex-col md:flex-row gap-5 items-start md:items-end justify-between">
          <div className="w-full md:w-1/3">
            <label className="form-label text-slate-700">เลือกห้องเรียน</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="form-input text-lg py-2.5">
              <option value="">-- เลือกห้องเรียน --</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="w-full md:w-auto flex-1 flex flex-col items-start md:items-center">
            <label className="form-label text-slate-700">วันที่บันทึก</label>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <div className="relative group flex-1 sm:flex-none">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative bg-indigo-50/80 border border-indigo-200 rounded-xl p-1 flex items-center">
                  <CalendarIcon className="w-5 h-5 text-indigo-400 ml-3 mr-2" />
                  <span className="text-slate-800 font-medium pr-4">{formattedSelectedDate}</span>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={setToday} className="px-3 py-2 text-sm rounded-lg bg-white/5 text-slate-700 hover:bg-indigo-500/20 hover:text-indigo-700 border border-indigo-100 hover:border-indigo-200 transition-all">
                  วันนี้
                </button>
                <button onClick={setYesterday} className="px-3 py-2 text-sm rounded-lg bg-white/5 text-slate-700 hover:bg-indigo-500/20 hover:text-indigo-700 border border-indigo-100 hover:border-indigo-200 transition-all">
                  เมื่อวาน
                </button>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setExportStartDate(''); setExportEndDate(''); setShowExportModal(true); }}
              disabled={!selectedClass || students.length === 0}
              className="px-6 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 font-medium transition-all flex items-center justify-center gap-2"
              title="ส่งออกข้อมูลการเช็คชื่อเป็น CSV"
            >
              <Download className="w-5 h-5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleClearData}
              disabled={saving || !selectedClass || students.length === 0}
              className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 font-medium transition-all flex items-center justify-center gap-2"
              title="ล้างข้อมูลการเช็คชื่อของวันนี้ทั้งห้อง"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              <span>ล้างของวันนี้</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedClass || students.length === 0}
              className="btn btn-primary w-full md:w-auto py-3 px-6 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              <span className="font-semibold text-base">บันทึกการเช็คชื่อ</span>
            </button>
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="glass p-14 text-center rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600">กรุณาเลือกห้องเรียนเพื่อเริ่มเช็คชื่อ</p>
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-14 text-center rounded-2xl">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600">ไม่มีนักเรียนในห้องเรียนนี้</p>
          <p className="text-slate-500 text-sm mt-1">ไปที่เมนูนักเรียนเพื่อเพิ่มนักเรียนในห้องนี้</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="p-4 border-b border-indigo-100 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-slate-800">นักเรียนทั้งหมด {students.length} คน</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-50 border-b border-indigo-100">
                  <th className="p-4 font-semibold text-slate-700 w-20">รหัส</th>
                  <th className="p-4 font-semibold text-slate-700">ชื่อ-นามสกุล</th>
                  <th className="p-4 font-semibold text-slate-700 min-w-[340px]">สถานะการมาเรียน</th>
                  <th className="p-4 font-semibold text-slate-700 text-center">สถิติสะสม</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const sStats = getStudentStats(student.id);
                  return (
                    <tr key={student.id} className="border-b border-indigo-100 hover:bg-indigo-50/50 transition-colors">
                      <td className="p-4 text-slate-600 text-sm">{student.student_code || '-'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{student.name}</span>
                          <button onClick={() => fetchHistory(student)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all" title="ดูประวัติการมาเรียน">
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {statusBtn(student.id, 'present', <CheckCircle className="w-4 h-4" />, 'มาเรียน', 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}
                          {statusBtn(student.id, 'late', <Clock className="w-4 h-4" />, 'สาย', 'bg-amber-500/20 text-amber-400 border border-amber-500/30')}
                          {statusBtn(student.id, 'absent', <XCircle className="w-4 h-4" />, 'ขาด', 'bg-red-500/20 text-red-400 border border-red-500/30')}
                          {statusBtn(student.id, 'leave', <FileText className="w-4 h-4" />, 'ลา', 'bg-blue-500/20 text-blue-400 border border-blue-500/30')}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          {sStats.is_f ? (
                            <span className="text-xs font-bold text-slate-800 bg-red-600 px-2 py-0.5 rounded animate-pulse">
                              ติด F / ขมส.
                            </span>
                          ) : (
                            <span className={`text-sm font-bold ${sStats.converted_absent_count > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                              ขาด {sStats.converted_absent_count} / {maxAllowedAbsences}
                            </span>
                          )}
                          
                          {(sStats.remaining_late_count > 0 || sStats.remaining_leave_count > 0) && (
                            <div className="flex gap-1 text-[0.65rem] mt-0.5 opacity-80">
                              {sStats.remaining_late_count > 0 && <span className="text-amber-400">(เศษสาย {sStats.remaining_late_count})</span>}
                              {sStats.remaining_leave_count > 0 && <span className="text-blue-400">(เศษลา {sStats.remaining_leave_count})</span>}
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
        </div>
      )}

      {historyStudent && createPortal(
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="glass w-full max-w-md p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <History className="w-5 h-5 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">ประวัติการเช็คชื่อ</h2>
                  <p className="text-sm text-slate-600">{historyStudent.name}</p>
                </div>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="p-2 hover:bg-indigo-50 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">ไม่พบประวัติการเช็คชื่อ</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {historyData.map(record => {
                  const dateObj = new Date(record.date);
                  const formattedDate = dateObj.toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                  return (
                    <div key={record.id} className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100 hover:bg-indigo-50/80 transition-colors group">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-sm text-slate-700 font-medium">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusDisplay(record.status)}
                        <button 
                          onClick={() => handleDeleteHistory(record.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="ลบประวัตินี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-5 pt-4 border-t border-indigo-200 flex justify-end">
              <button onClick={() => setHistoryStudent(null)} className="btn bg-indigo-100 hover:bg-indigo-300 text-slate-800">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showExportModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="glass w-full max-w-md p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">ส่งออก CSV</h2>
                  <p className="text-sm text-slate-600">{selectedClassData?.name || 'ห้องเรียน'}</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-indigo-50 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-slate-700">📅 เลือกช่วงวันที่ (ไม่บังคับ)</p>
                <p className="text-xs text-slate-500">หากไม่ระบุจะส่งออกข้อมูลทั้งหมด</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">ตั้งแต่</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={e => setExportStartDate(e.target.value)}
                      className="form-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">ถึง</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={e => setExportEndDate(e.target.value)}
                      className="form-input text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">💡 ไฟล์ CSV สามารถเปิดได้ใน Excel, Google Sheets หรือโปรแกรมตารางคำนวณอื่นๆ</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-indigo-200 flex justify-end gap-3">
              <button onClick={() => setShowExportModal(false)} className="btn bg-indigo-100 hover:bg-indigo-200 text-slate-700">
                ยกเลิก
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="btn bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                ดาวน์โหลด CSV
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
