'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { Plus, Edit, Trash2, X, Users as UsersIcon, Loader2, Search, GraduationCap, Upload, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';
import axios from 'axios';

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

interface Classroom {
  id: string | number;
  name: string;
}

interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  grade_level?: string;
  email?: string;
  classroom_id?: string | number | null;
}

interface ImportRow {
  student_code?: string;
  name: string;
  grade_level?: string;
  email?: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  
  const [editing, setEditing] = useState<string | number | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterClassroomId, setFilterClassroomId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Array<string | number>>([]);
  const [bulkAssignClassroomId, setBulkAssignClassroomId] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const emptyForm = { name: '', student_code: '', grade_level: '', email: '', classroom_id: '' };
  const [form, setForm] = useState(emptyForm);

  // Import states
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importClassroomId, setImportClassroomId] = useState('');

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [studRes, classRes] = await Promise.all([
        api.get('/students', { signal }),
        api.get('/classrooms', { signal })
      ]);
      setStudents(studRes.data.data || []);
      setClassrooms(classRes.data.data || []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
      return;
    }
    
    // Format data for Excel
    const exportData = filtered.map(s => ({
      'รหัสนักเรียน': s.student_code || '',
      'ชื่อ-นามสกุล': s.name || '',
      'ระดับชั้น': s.grade_level || '',
      'ห้องเรียน': classrooms.find(c => String(c.id) === String(s.classroom_id))?.name || 'ไม่ระบุ',
      'อีเมล': s.email || ''
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    
    // Generate file
    const className = filterClassroomId ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name : 'ทั้งหมด';
    const fileName = `รายชื่อนักเรียน_${className}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success('ส่งออกไฟล์เรียบร้อย');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put('/students/' + editing, form);
        toast.success('อัปเดตข้อมูลนักเรียนเรียบร้อย');
      } else {
        await api.post('/students', form);
        toast.success('เพิ่มนักเรียนเรียบร้อย');
      }
      setShowForm(false); setEditing(null); setForm(emptyForm); fetchData();
    } catch (err: any) { toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleEdit = (s: Student) => {
    setForm({
      name: s.name,
      student_code: s.student_code || '',
      grade_level: s.grade_level || '',
      email: s.email || '',
      classroom_id: s.classroom_id ? String(s.classroom_id) : ''
    });
    setEditing(s.id); setShowForm(true);
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('ต้องการลบนักเรียนคนนี้หรือไม่?')) return;
    try { await api.delete('/students/' + id); toast.success('ลบนักเรียนแล้ว'); fetchData(); }
    catch { toast.error('ลบไม่สำเร็จ'); }
  };



  const handleToggleSelect = (id: string | number) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filtered.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filtered.map(s => s.id));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignClassroomId) {
      toast.error('กรุณาเลือกห้องเรียนปลายทาง');
      return;
    }
    setSaving(true);
    try {
      await api.put('/students/bulk-classroom', {
        studentIds: selectedStudents,
        classroomId: bulkAssignClassroomId === 'null' ? null : bulkAssignClassroomId
      });
      toast.success('ย้ายห้องเรียนเรียบร้อย');
      setSelectedStudents([]);
      fetchData();
    } catch {
      toast.error('ย้ายห้องเรียนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    if (!window.confirm(`ยืนยันการลบนักเรียนที่เลือกทั้งหมด ${selectedStudents.length} คนหรือไม่? (ข้อมูลคะแนนและการประเมินของนักเรียนจะถูกลบไปด้วย)`)) return;
    setSaving(true);
    try {
      await api.delete(`/students?ids=${selectedStudents.join(',')}`);
      toast.success('ลบนักเรียนที่เลือกเรียบร้อยแล้ว');
      setSelectedStudents([]);
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    const isFiltered = !!filterClassroomId;
    const targetClassName = isFiltered ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name || 'ห้องเรียนที่เลือก' : 'ทั้งหมด';
    const msg = isFiltered 
      ? `ยืนยันการลบนักเรียนทั้งหมดในห้องเรียน "${targetClassName}" ใช่หรือไม่? (ข้อมูลคะแนนและประวัติการประเมินของนักเรียนจะถูกลบไปด้วย)`
      : `ยืนยันการลบนักเรียนทั้งหมด (${students.length} คน) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้!`;
      
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      const url = isFiltered ? `/students?classroom_id=${filterClassroomId}` : '/students';
      await api.delete(url);
      toast.success('ลบนักเรียนเรียบร้อยแล้ว');
      setSelectedStudents([]);
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // --- Bulk Import ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (typeof bstr !== 'string') return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);
        
        // Map columns
        const mappedData = data.map(row => {
          // Get values or empty string
          const prefix = row['คำนำหน้า'] || '';
          const firstName = row['ชื่อ'] || row['name'] || '';
          const lastName = row['นามสกุล'] || '';
          
          // Combine prefix, first name, and last name
          let fullName = row['ชื่อ-นามสกุล'] || '';
          if (!fullName && firstName) {
            fullName = `${prefix} ${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
          }

          return {
            student_code: String(row['รหัสนักเรียน'] || row['student_code'] || ''),
            name: String(fullName),
            grade_level: String(row['ระดับชั้น'] || row['ชั้น'] || row['grade_level'] || ''),
            email: String(row['อีเมล'] || row['email'] || ''),
          };
        }).filter(item => item.name); // Require at least name

        setImportData(mappedData);
      } catch (err) {
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0) return;
    setSaving(true);
    try {
      const payload = importData.map(d => ({
        ...d,
        classroom_id: importClassroomId || null
      }));
      
      const res = await api.post('/students/bulk', { students: payload });
      toast.success(res.data.message || 'นำเข้านักเรียนสำเร็จ');
      setShowImportForm(false);
      setImportData([]);
      setImportClassroomId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_code?.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClassroomId ? String(s.classroom_id) === String(filterClassroomId) : true;
    return matchSearch && matchClass;
  });

  // Paginated subset
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterClassroomId]);



  const avatarColors = [
    'from-indigo-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
    'from-violet-500 to-purple-600',
  ];

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">นักเรียน</h1>
          <p className="text-slate-500 text-sm">ทั้งหมด {students.length} คน</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {students.length > 0 && (
            <button 
              onClick={handleDeleteAll}
              disabled={saving}
              className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบทั้งหมด</span>
            </button>
          )}
          <button onClick={handleExport} className="btn bg-emerald-600 hover:bg-emerald-500 text-slate-800 flex-1 sm:flex-none">
            ส่งออก (Excel)
          </button>
          <button onClick={() => { setShowImportForm(true); setImportData([]); setImportClassroomId(''); }} className="btn bg-white hover:bg-indigo-100 text-slate-800 flex-1 sm:flex-none">
            <Upload className="w-4 h-4" /> นำเข้าจาก Excel
          </button>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }} className="btn btn-primary flex-1 sm:flex-none" id="add-student-btn">
            <Plus className="w-4 h-4" /> เพิ่มนักเรียน
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-11" placeholder="ค้นหานักเรียน..." id="student-search" />
        </div>
        <select 
          value={filterClassroomId} 
          onChange={e => setFilterClassroomId(e.target.value)} 
          className="form-input w-full sm:w-64"
        >
          <option value="">-- ทุกห้องเรียน --</option>
          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedStudents.length > 0 && (
        <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-200 bg-indigo-500/5 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-500 text-slate-800 px-3 py-1 rounded-full text-sm font-medium">
              เลือกแล้ว {selectedStudents.length} คน
            </span>
            <button 
              onClick={() => setSelectedStudents([])}
              className="text-slate-600 hover:text-slate-800 text-sm underline"
            >
              ยกเลิก
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select 
              value={bulkAssignClassroomId} 
              onChange={e => setBulkAssignClassroomId(e.target.value)} 
              className="form-input flex-1 sm:flex-none"
            >
              <option value="">-- เลือกห้องเรียนเป้าหมาย --</option>
              <option value="null">ไม่มีห้องเรียน (ลอยแพ)</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button 
              onClick={handleBulkAssign}
              disabled={saving}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ย้ายห้อง'}
            </button>
            <button 
              onClick={handleBulkDelete}
              disabled={saving}
              className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>ลบที่เลือก</span>
            </button>
          </div>
        </div>
      )}

      {/* Select All Checkbox (Only if there are students) */}
      {filtered.length > 0 && (
        <div className="flex items-center px-2 py-1 gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedStudents.length === filtered.length ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
              {selectedStudents.length === filtered.length && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
            </div>
            <input 
              type="checkbox" 
              className="hidden"
              checked={selectedStudents.length === filtered.length}
              onChange={handleSelectAll}
            />
            <span className="text-sm text-slate-600 group-hover:text-slate-700">เลือกทั้งหมดบนหน้าจอนี้</span>
          </label>
        </div>
      )}

      {/* Students List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass p-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <UsersIcon className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-slate-500 text-sm font-medium">ยังไม่มีข้อมูลนักเรียน</p>
            <p className="text-slate-600 text-xs mt-1">เพิ่มนักเรียนเพื่อเริ่มบันทึกผลการเรียน</p>
          </div>
        ) : paginatedStudents.map((student, i) => (
          <div
            key={student.id}
            className={`glass overflow-hidden transition-all duration-300 animate-fade-in-up ${selectedStudents.includes(student.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}
            style={{ animationDelay: (i * 50) + 'ms', animationFillMode: 'forwards' }}
          >
            <div className="p-4 flex items-center gap-4">
              <label className="cursor-pointer group flex-shrink-0">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedStudents.includes(student.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
                  {selectedStudents.includes(student.id) && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => handleToggleSelect(student.id)}
                />
              </label>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shadow-sm shrink-0">
                {animalAvatars[(Number(student.id) || 0) % animalAvatars.length]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-[0.95rem]">{student.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                  {student.student_code && <span>รหัส: {student.student_code}</span>}
                  {student.grade_level && <span>ระดับ {student.grade_level}</span>}
                  {student.classroom_id && <span>ห้อง: {classrooms.find(c => String(c.id) === String(student.classroom_id))?.name || 'ไม่ทราบ'}</span>}
                  {student.email && <span>{student.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(student)} className="p-2.5 rounded-xl hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-700 transition-all" title="แก้ไข">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(student.id)} className="p-2.5 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all" title="ลบ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
        />
      )}

      {/* Student Form Modal */}
      {showForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="glass w-full max-w-md p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-5 h-5 text-slate-800" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="form-label">ชื่อ-นามสกุล</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" required id="student-name" placeholder="กรอกชื่อ-นามสกุล" /></div>
              <div><label className="form-label">รหัสนักเรียน</label><input value={form.student_code} onChange={e => setForm({...form, student_code: e.target.value})} className="form-input" id="student-code" placeholder="เช่น 65010001" /></div>
              <div><label className="form-label">ระดับชั้น</label><input value={form.grade_level} onChange={e => setForm({...form, grade_level: e.target.value})} className="form-input" id="student-grade" placeholder="เช่น ม.3 หรือ ปวช.1" /></div>
              <div><label className="form-label">อีเมล</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="form-input" id="student-email" placeholder="student@email.com (ไม่บังคับ)" /></div>
              <div>
                <label className="form-label">ห้องเรียน</label>
                <select value={form.classroom_id} onChange={e => setForm({...form, classroom_id: e.target.value})} className="form-input">
                  <option value="">-- ไม่ระบุห้องเรียน --</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saving} className="btn btn-primary w-full py-3" id="student-save-btn">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'อัปเดต' : <><Plus className="w-4 h-4" /> เพิ่มนักเรียน</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Import Form Modal */}
      {showImportForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowImportForm(false)}>
          <div className="glass w-full max-w-2xl p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
                  <Upload className="w-5 h-5 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">นำเข้ารายชื่อนักเรียนจาก Excel / CSV</h2>
                  <p className="text-xs text-slate-500">รองรับคอลัมน์: รหัสนักเรียน, ชื่อ-นามสกุล, ระดับชั้น, อีเมล</p>
                </div>
              </div>
              <button onClick={() => setShowImportForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                <p className="text-slate-500 text-xs mt-1">.xlsx, .xls, .csv</p>
              </div>

              {importData.length > 0 && (
                <div className="space-y-4 mt-6 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-emerald-400">พบข้อมูล {importData.length} รายการ</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">นำเข้าห้อง:</label>
                      <select value={importClassroomId} onChange={e => setImportClassroomId(e.target.value)} className="form-input py-1.5 text-sm w-48">
                        <option value="">-- ไม่ระบุห้องเรียน --</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl max-h-60 overflow-y-auto border border-indigo-100">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="sticky top-0 bg-white">
                        <tr>
                          <th className="p-3 font-medium text-slate-700 w-24">รหัส</th>
                          <th className="p-3 font-medium text-slate-700">ชื่อ-นามสกุล</th>
                          <th className="p-3 font-medium text-slate-700">ระดับชั้น</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 50).map((s, i) => (
                          <tr key={i} className="border-b border-indigo-100">
                            <td className="p-3 text-slate-600">{s.student_code || '-'}</td>
                            <td className="p-3 text-slate-800">{s.name}</td>
                            <td className="p-3 text-slate-600">{s.grade_level || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 50 && (
                      <div className="p-3 text-center text-xs text-slate-500 bg-indigo-50">
                        แสดงตัวอย่าง 50 รายการแรก จากทั้งหมด {importData.length} รายการ
                      </div>
                    )}
                  </div>
                  
                  <button onClick={handleImportSubmit} disabled={saving} className="btn btn-primary w-full py-3">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ยืนยันการนำเข้าข้อมูล'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
