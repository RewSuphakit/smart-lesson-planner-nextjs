'use client';

import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { 
  Plus, Edit, Trash2, X, Users as UsersIcon, Loader2, Search, 
  GraduationCap, Upload, CheckCircle, FileSpreadsheet, Eye, 
  Camera, Sparkles, Image as ImageIcon 
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';
import StudentExcelModal from '@/components/StudentExcelModal';
import UserAvatar, { ANIMAL_AVATARS, TEACHER_EMOJIS } from '@/components/UserAvatar';
import { compressImageFile, findMatchingStudentIndex } from '@/lib/avatarCompression';

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
  avatar?: string | null;
}

interface ImportRow {
  student_code?: string;
  name: string;
  grade_level?: string;
  email?: string;
  avatar?: string | null;
}

export default function Students() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [editing, setEditing] = useState<string | number | null>(null);
  const [search, setSearch] = useState('');
  const [filterClassroomId, setFilterClassroomId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Array<string | number>>([]);
  const [bulkAssignClassroomId, setBulkAssignClassroomId] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const emptyForm = { name: '', student_code: '', grade_level: '', email: '', classroom_id: '', avatar: '' };
  const [form, setForm] = useState(emptyForm);

  // Single student photo & emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCompressingSingle, setIsCompressingSingle] = useState(false);
  const singlePhotoInputRef = useRef<HTMLInputElement>(null);

  // Bulk Import states
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importClassroomId, setImportClassroomId] = useState('');
  const [isMatchingPhotos, setIsMatchingPhotos] = useState(false);
  const bulkPhotoInputRef = useRef<HTMLInputElement>(null);

  // ─── Query: ดึงข้อมูลนักเรียน ───
  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data.data || [];
    },
  });

  // ─── Query: ดึงข้อมูลห้องเรียน (shared cache) ───
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  const isLoading = loadingStudents || loadingClassrooms;

  // ─── Mutation: สร้าง/แก้ไขนักเรียน ───
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      if (editing) {
        return api.put('/students/' + editing, payload);
      } else {
        return api.post('/students', payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'อัปเดตข้อมูลนักเรียนเรียบร้อย' : 'เพิ่มนักเรียนเรียบร้อย');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    },
  });

  // ─── Mutation: ลบนักเรียนรายคน ───
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete('/students/' + id),
    onSuccess: () => {
      toast.success('ลบนักเรียนแล้ว');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: () => {
      toast.error('ลบไม่สำเร็จ');
    },
  });

  // ─── Mutation: ย้ายห้องเรียนแบบ bulk ───
  const bulkAssignMutation = useMutation({
    mutationFn: () => api.put('/students/bulk-classroom', {
      studentIds: selectedStudents,
      classroomId: bulkAssignClassroomId === 'null' ? null : bulkAssignClassroomId
    }),
    onSuccess: () => {
      toast.success('ย้ายห้องเรียนเรียบร้อย');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: () => {
      toast.error('ย้ายห้องเรียนไม่สำเร็จ');
    },
  });

  // ─── Mutation: ลบนักเรียนที่เลือก (bulk) ───
  const bulkDeleteMutation = useMutation({
    mutationFn: () => api.delete(`/students?ids=${selectedStudents.join(',')}`),
    onSuccess: () => {
      toast.success('ลบนักเรียนที่เลือกเรียบร้อยแล้ว');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: () => {
      toast.error('ลบไม่สำเร็จ');
    },
  });

  // ─── Mutation: ลบทั้งหมด ───
  const deleteAllMutation = useMutation({
    mutationFn: (classroomId?: string) => {
      const url = classroomId ? `/students?classroom_id=${classroomId}` : '/students';
      return api.delete(url);
    },
    onSuccess: () => {
      toast.success('ลบนักเรียนเรียบร้อยแล้ว');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: () => {
      toast.error('ลบไม่สำเร็จ');
    },
  });

  // ─── Mutation: นำเข้า bulk ───
  const importMutation = useMutation({
    mutationFn: async (payload: Array<ImportRow & { classroom_id: string | null }>) => {
      return api.post('/students/bulk', { students: payload });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'นำเข้านักเรียนสำเร็จ');
      setShowImportForm(false);
      setImportData([]);
      setImportClassroomId('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'นำเข้าไม่สำเร็จ');
    },
  });

  const isMutating = saveMutation.isPending || deleteMutation.isPending || bulkAssignMutation.isPending || bulkDeleteMutation.isPending || deleteAllMutation.isPending || importMutation.isPending;

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('ไม่มีข้อมูลนักเรียนสำหรับส่งออก');
      return;
    }
    
    const exportData = filtered.map(s => ({
      'รหัสนักเรียน': s.student_code || '',
      'ชื่อ-นามสกุล': s.name || '',
      'ระดับชั้น': s.grade_level || '',
      'ห้องเรียน': classrooms.find(c => String(c.id) === String(s.classroom_id))?.name || 'ไม่ระบุ',
      'อีเมล': s.email || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    
    const className = filterClassroomId ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name : 'ทั้งหมด';
    const fileName = `รายชื่อนักเรียน_${className}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success('ส่งออกไฟล์เรียบร้อย');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleSinglePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)');
      return;
    }

    setIsCompressingSingle(true);
    try {
      const compressed = await compressImageFile(file, 160, 0.78);
      setForm(prev => ({ ...prev, avatar: compressed }));
      toast.success('บีบอัดรูปภาพเรียบร้อย (~4KB)');
    } catch {
      toast.error('ไม่สามารถประมวลผลรูปภาพได้');
    } finally {
      setIsCompressingSingle(false);
      e.target.value = '';
    }
  };

  const handleBulkPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || importData.length === 0) return;

    setIsMatchingPhotos(true);
    try {
      const fileList = Array.from(files);
      const updated = [...importData];
      let matchedCount = 0;

      for (const file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        const matchIdx = findMatchingStudentIndex(file.name, updated);
        if (matchIdx !== -1) {
          try {
            const compressed = await compressImageFile(file, 160, 0.78);
            updated[matchIdx] = {
              ...updated[matchIdx],
              avatar: compressed,
            };
            matchedCount++;
          } catch (compressErr) {
            console.error('Failed to compress photo:', file.name, compressErr);
          }
        }
      }

      setImportData(updated);
      if (matchedCount > 0) {
        toast.success(`จับคู่และบีบอัดรูปภาพนักเรียนสำเร็จ ${matchedCount} คน (~4KB/รูป) 🎉`);
      } else {
        toast.error('ไม่พบชื่อไฟล์รูปที่ตรงกับรหัสนักเรียนหรือชื่อในรายการ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      setIsMatchingPhotos(false);
      e.target.value = '';
    }
  };

  const handleEdit = (s: Student) => {
    setForm({
      name: s.name,
      student_code: s.student_code || '',
      grade_level: s.grade_level || '',
      email: s.email || '',
      classroom_id: s.classroom_id ? String(s.classroom_id) : '',
      avatar: s.avatar || ''
    });
    setEditing(s.id);
    setShowEmojiPicker(false);
    setShowForm(true);
  };

  const handleDelete = (id: string | number) => {
    if (!confirm('ต้องการลบนักเรียนคนนี้หรือไม่?')) return;
    deleteMutation.mutate(id);
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

  const handleBulkAssign = () => {
    if (!bulkAssignClassroomId) {
      toast.error('กรุณาเลือกห้องเรียนปลายทาง');
      return;
    }
    bulkAssignMutation.mutate();
  };

  const handleBulkDelete = () => {
    if (selectedStudents.length === 0) return;
    if (!window.confirm(`ยืนยันการลบนักเรียนที่เลือกทั้งหมด ${selectedStudents.length} คนหรือไม่? (ข้อมูลคะแนนและการประเมินของนักเรียนจะถูกลบไปด้วย)`)) return;
    bulkDeleteMutation.mutate();
  };

  const handleDeleteAll = () => {
    const isFiltered = !!filterClassroomId;
    const targetClassName = isFiltered ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name || 'ห้องเรียนที่เลือก' : 'ทั้งหมด';
    const msg = isFiltered 
      ? `ยืนยันการลบนักเรียนทั้งหมดในห้องเรียน "${targetClassName}" ใช่หรือไม่? (ข้อมูลคะแนนและประวัติการประเมินของนักเรียนจะถูกลบไปด้วย)`
      : `ยืนยันการลบนักเรียนทั้งหมด (${students.length} คน) ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้!`;
      
    if (!window.confirm(msg)) return;
    deleteAllMutation.mutate(isFiltered ? filterClassroomId : undefined);
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
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        
        const mappedData = data.map(row => {
          const prefix = row['คำนำหน้า'] || '';
          const firstName = row['ชื่อ'] || row['name'] || '';
          const lastName = row['นามสกุล'] || '';
          
          let fullName = row['ชื่อ-นามสกุล'] || '';
          if (!fullName && firstName) {
            fullName = `${prefix} ${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
          }

          const rawAvatar = row['รูปภาพ'] || row['รูปถ่าย'] || row['รูป'] || row['photo'] || row['image'] || row['avatar'] || row['picture'] || row['url'] || row['image_url'] || '';

          return {
            student_code: String(row['รหัสนักเรียน'] || row['student_code'] || ''),
            name: String(fullName),
            grade_level: String(row['ระดับชั้น'] || row['ชั้น'] || row['grade_level'] || ''),
            email: String(row['อีเมล'] || row['email'] || ''),
            avatar: rawAvatar ? String(rawAvatar).trim() : null,
          };
        }).filter(item => item.name);

        setImportData(mappedData);
      } catch {
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportSubmit = () => {
    if (importData.length === 0) return;
    const payload = importData.map(d => ({
      ...d,
      classroom_id: importClassroomId || null
    }));
    importMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_code?.toLowerCase().includes(search.toLowerCase());
      const matchClass = filterClassroomId ? String(s.classroom_id) === String(filterClassroomId) : true;
      return matchSearch && matchClass;
    });
  }, [students, search, filterClassroomId]);

  // Paginated subset
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change — derived from useMemo instead of useEffect
  const prevFilterKey = `${search}|${filterClassroomId}`;
  const [lastFilterKey, setLastFilterKey] = useState(prevFilterKey);
  if (prevFilterKey !== lastFilterKey) {
    setLastFilterKey(prevFilterKey);
    setCurrentPage(1);
  }

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

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
              disabled={isMutating}
              className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบทั้งหมด</span>
            </button>
          )}
          <button 
            onClick={() => setShowExportModal(true)} 
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 font-bold text-xs"
            title="พรีวิวตัวอย่างตาราง Excel ก่อนส่งออก"
          >
            <FileSpreadsheet className="w-4 h-4" /> พรีวิว & ส่งออก Excel
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
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="form-input pl-11" 
            placeholder="ค้นหานักเรียน..." 
            id="student-search" 
            aria-label="ค้นหานักเรียน"
          />
        </div>
        <select 
          value={filterClassroomId} 
          onChange={e => setFilterClassroomId(e.target.value)} 
          className="form-input w-full sm:w-64"
          id="filter-classroom"
          aria-label="กรองตามห้องเรียน"
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
              id="bulk-assign-classroom"
              aria-label="เลือกห้องเรียนเป้าหมายสำหรับนักเรียนที่เลือก"
            >
              <option value="">-- เลือกห้องเรียนเป้าหมาย --</option>
              <option value="null">ไม่มีห้องเรียน (ลอยแพ)</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button 
              onClick={handleBulkAssign}
              disabled={isMutating}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {bulkAssignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ย้ายห้อง'}
            </button>
            <button 
              onClick={handleBulkDelete}
              disabled={isMutating}
              className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>ลบที่เลือก</span>
            </button>
          </div>
        </div>
      )}

      {/* Select All Checkbox (Only if there are students) */}
      {filtered.length > 0 && (
        <div className="flex items-center px-2 py-1 gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={selectedStudents.length === filtered.length}
              onChange={handleSelectAll}
              aria-label="เลือกทั้งหมดบนหน้าจอนี้"
            />
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all peer-focus:ring-2 peer-focus:ring-indigo-500 ${selectedStudents.length === filtered.length ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
              {selectedStudents.length === filtered.length && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
            </div>
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
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => handleToggleSelect(student.id)}
                  aria-label={`เลือกนักเรียน ${student.name}`}
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all peer-focus:ring-2 peer-focus:ring-indigo-500 ${selectedStudents.includes(student.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
                  {selectedStudents.includes(student.id) && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
                </div>
              </label>
              <UserAvatar
                avatar={student.avatar}
                name={student.name}
                userId={student.id}
                size="lg"
                className="rounded-2xl border border-indigo-100 shadow-sm shrink-0"
              />
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
                <button 
                  onClick={() => handleEdit(student)} 
                  className="p-2.5 rounded-xl hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-700 transition-all" 
                  title="แก้ไข"
                  aria-label={`แก้ไขข้อมูลของ ${student.name}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(student.id)} 
                  className="p-2.5 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all" 
                  title="ลบ"
                  aria-label={`ลบข้อมูลของ ${student.name}`}
                >
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
          <div className="glass w-full max-w-md p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            {/* Avatar Section for Single Student */}
            <div className="flex flex-col items-center justify-center gap-2.5 pb-4 mb-4 border-b border-indigo-100/70">
              <div className="relative group">
                <UserAvatar
                  avatar={form.avatar}
                  name={form.name || 'นักเรียน'}
                  userId={editing || 1}
                  size="xl"
                  className="rounded-3xl border-2 border-indigo-200 shadow-md transition-transform duration-200 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => singlePhotoInputRef.current?.click()}
                  disabled={isCompressingSingle}
                  className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-md border-2 border-white transition-transform hover:scale-110"
                  title="เลือกรูปภาพนักเรียน"
                >
                  {isCompressingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={singlePhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleSinglePhotoChange}
                className="hidden"
              />

              {/* Photo & Emoji Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => singlePhotoInputRef.current?.click()}
                  disabled={isCompressingSingle}
                  className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 inline-flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" /> อัปโหลดรูปภาพ
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold border border-purple-200 inline-flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> เลือกอิโมจิ
                </button>
                {form.avatar && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, avatar: '' }))}
                    className="px-2 py-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs font-semibold transition-colors"
                    title="ลบรูปและใช้อิโมจิตามลำดับ"
                  >
                    <Trash2 className="w-3 h-3" /> ลบรูป (ใช้อิโมจิเดิม)
                  </button>
                )}
              </div>

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="w-full p-3 bg-slate-50 border border-indigo-100 rounded-2xl animate-fade-in-up space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>เลือกอิโมจิประจำตัว:</span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                    {[...ANIMAL_AVATARS, ...TEACHER_EMOJIS].map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, avatar: emoji }));
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-lg rounded-lg hover:bg-indigo-50 hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="student-name">ชื่อ-นามสกุล</label>
                <input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="form-input" 
                  required 
                  id="student-name" 
                  placeholder="กรอกชื่อ-นามสกุล" 
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-code">รหัสนักเรียน</label>
                <input 
                  value={form.student_code} 
                  onChange={e => setForm({...form, student_code: e.target.value})} 
                  className="form-input" 
                  id="student-code" 
                  placeholder="เช่น 65010001" 
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-grade">ระดับชั้น</label>
                <input 
                  value={form.grade_level} 
                  onChange={e => setForm({...form, grade_level: e.target.value})} 
                  className="form-input" 
                  id="student-grade" 
                  placeholder="เช่น ม.3 หรือ ปวช.1" 
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-email">อีเมล</label>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  className="form-input" 
                  id="student-email" 
                  placeholder="student@email.com (ไม่บังคับ)" 
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-classroom">ห้องเรียน</label>
                <select 
                  value={form.classroom_id} 
                  onChange={e => setForm({...form, classroom_id: e.target.value})} 
                  className="form-input"
                  id="student-classroom"
                >
                  <option value="">-- ไม่ระบุห้องเรียน --</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saveMutation.isPending || isCompressingSingle} className="btn btn-primary w-full py-3" id="student-save-btn">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'อัปเดต' : <><Plus className="w-4 h-4" /> เพิ่มนักเรียน</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Import Form Modal */}
      {showImportForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowImportForm(false)}>
          <div className="glass w-full max-w-3xl p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg border border-indigo-100">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">นำเข้ารายชื่อและรูปภาพนักเรียน</h2>
                  <p className="text-xs text-slate-500">รองรับไฟล์ Excel/CSV และคอลัมน์รูปภาพ หรือแนบไฟล์ภาพจับคู่อัตโนมัติ</p>
                </div>
              </div>
              <button onClick={() => setShowImportForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <div className="space-y-4">
              {/* Step 1: Select Excel/CSV File */}
              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl p-6 text-center transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="import-file-input"
                  aria-label="อัปโหลดไฟล์ Excel หรือ CSV"
                />
                <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-slate-800 font-bold text-sm">คลิกเพื่อเลือกไฟล์ Excel / CSV หรือลากไฟล์มาวาง</p>
                <p className="text-slate-500 text-xs mt-1">
                  รองรับคอลัมน์: รหัสนักเรียน, ชื่อ-นามสกุล, ระดับชั้น, อีเมล, รูปภาพ (URL หรืออิโมจิ)
                </p>
              </div>

              {importData.length > 0 && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Step 2: Optional Bulk Photos Upload */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-indigo-100/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        แนบไฟล์รูปภาพนักเรียน (หลายไฟล์พร้อมกัน)
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        ระบบจะจับคู่อัตโนมัติจากชื่อไฟล์ (เช่น <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200">65010001.jpg</span> หรือชื่อนักเรียน) พร้อมบีบอัดเป็น WebP (~4KB/รูป) ทันที
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={bulkPhotoInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleBulkPhotosUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => bulkPhotoInputRef.current?.click()}
                        disabled={isMatchingPhotos}
                        className="btn bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-indigo-200 shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        {isMatchingPhotos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังบีบอัดภาพ...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" /> เลือกไฟล์รูปภาพนักเรียน
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary & Classroom Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> พบข้อมูล {importData.length} รายการ
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="font-medium text-indigo-700">
                        มีรูปถ่ายแล้ว {importData.filter(d => d.avatar).length} คน
                      </span>
                      <span className="text-slate-500">
                        (ไม่มีรูป {importData.filter(d => !d.avatar).length} คน จะใช้อิโมจิ)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600 shrink-0" htmlFor="import-classroom">
                        ห้องเรียน:
                      </label>
                      <select 
                        value={importClassroomId} 
                        onChange={e => setImportClassroomId(e.target.value)} 
                        className="form-input py-1.5 text-xs w-44"
                        id="import-classroom"
                      >
                        <option value="">-- ไม่ระบุห้องเรียน --</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  {/* Preview Table */}
                  <div className="bg-white rounded-2xl max-h-64 overflow-y-auto border border-indigo-100 shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-indigo-100 z-10">
                        <tr>
                          <th className="p-2.5 font-bold text-slate-700 w-14 text-center">รูป</th>
                          <th className="p-2.5 font-bold text-slate-700 w-28">รหัสนักเรียน</th>
                          <th className="p-2.5 font-bold text-slate-700">ชื่อ-นามสกุล</th>
                          <th className="p-2.5 font-bold text-slate-700 w-24">ระดับชั้น</th>
                          <th className="p-2.5 font-bold text-slate-700 w-24 text-center">สถานะรูป</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importData.slice(0, 50).map((s, i) => (
                          <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="p-2 text-center">
                              <UserAvatar
                                avatar={s.avatar}
                                name={s.name}
                                userId={i + 1}
                                size="xs"
                                className="mx-auto border border-indigo-100 rounded-lg"
                              />
                            </td>
                            <td className="p-2.5 text-slate-600 font-mono">{s.student_code || '-'}</td>
                            <td className="p-2.5 text-slate-800 font-semibold">{s.name}</td>
                            <td className="p-2.5 text-slate-600">{s.grade_level || '-'}</td>
                            <td className="p-2 text-center">
                              {s.avatar ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  ✓ มีรูป
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                  อิโมจิ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 50 && (
                      <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                        แสดงตัวอย่าง 50 รายการแรก จากทั้งหมด {importData.length} รายการ
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleImportSubmit} 
                    disabled={importMutation.isPending || isMatchingPhotos} 
                    className="btn btn-primary w-full py-3 text-sm font-bold shadow-md shadow-indigo-500/20"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> กำลังนำเข้าข้อมูล...
                      </>
                    ) : (
                      `ยืนยันการนำเข้านักเรียน ${importData.length} คน`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Student Excel Preview & Export Modal */}
      <StudentExcelModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        students={filtered}
        classrooms={classrooms}
        filterClassroomId={filterClassroomId}
        selectedStudentIds={selectedStudents}
      />

    </div>
  );
}
