'use client';
// @ts-nocheck
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { Plus, Edit, Trash2, X, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

function ClassroomCard({ c, i, colors, onEdit, onDelete }) {
  return (
    <div className="glass p-5 rounded-2xl flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={'w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shadow-sm shrink-0'}>
          {animalAvatars[(c.id || 0) % animalAvatars.length]}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(c)} className="p-2 rounded-xl hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 transition-all" title="แก้ไข">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(c.id)} className="p-2 rounded-xl hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition-all" title="ลบ">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-slate-800 mb-1">{c.name}</h3>
        {c.description && <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>}
      </div>
      <div className="mt-4 pt-4 border-t border-indigo-100 flex flex-col gap-1 text-[0.65rem] text-slate-500">
        <div className="flex items-center justify-between">
          <span>นักเรียน: {c.student_count || 0} คน</span>
          <span className="bg-indigo-100 px-2 py-0.5 rounded text-indigo-700 font-medium">สาย {c.late_to_absent_ratio || 3} = ขาด 1</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-700 font-medium">ลา {c.leave_to_absent_ratio || 2} = ขาด 1</span>
          <span className="bg-rose-100 text-rose-600 font-medium px-2 py-0.5 rounded">
            เรียน {c.min_attendance_percent || 80}% (ขาดได้ {Math.floor((c.total_classes || 40) * (100 - (c.min_attendance_percent || 80)) / 100)} คาบ)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const emptyForm = { 
    name: '', 
    description: '', 
    late_to_absent_ratio: 3, 
    leave_to_absent_ratio: 2, 
    total_classes: 36, 
    min_attendance_percent: 80 
  };
  const [form, setForm] = useState(emptyForm);

  // States for calculating total_classes helper
  const [periodsPerWeek, setPeriodsPerWeek] = useState(2);
  const [totalWeeks, setTotalWeeks] = useState(18);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/classrooms');
      setClassrooms(res.data.data || []);
    } catch {
      toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put('/classrooms/' + editing, form);
        toast.success('อัปเดตข้อมูลห้องเรียนเรียบร้อย');
      } else {
        await api.post('/classrooms', form);
        toast.success('เพิ่มห้องเรียนเรียบร้อย');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c) => {
    setForm({ 
      name: c.name, 
      description: c.description || '', 
      late_to_absent_ratio: c.late_to_absent_ratio || 3,
      leave_to_absent_ratio: c.leave_to_absent_ratio || 2,
      total_classes: c.total_classes || 40,
      min_attendance_percent: c.min_attendance_percent || 80
    });
    setEditing(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('ต้องการลบห้องเรียนนี้หรือไม่? ข้อมูลการเช็คชื่อจะถูกลบไปด้วย')) return;
    try {
      await api.delete('/classrooms/' + id);
      toast.success('ลบห้องเรียนแล้ว');
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const filtered = classrooms.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
  ];

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">จัดการห้องเรียน</h1>
          <p className="text-slate-500 text-sm">ทั้งหมด {classrooms.length} ห้อง</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" /> สร้างห้องเรียน
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-11"
          placeholder="ค้นหาห้องเรียน..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full glass p-14 text-center rounded-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 text-3xl">
              🏫
            </div>
            <p className="text-slate-500 text-sm font-medium">ยังไม่มีข้อมูลห้องเรียน</p>
            <p className="text-slate-600 text-xs mt-1">กดปุ่ม "สร้างห้องเรียน" เพื่อเริ่มต้น</p>
          </div>
        ) : filtered.map((c, i) => (
          <ClassroomCard
            key={c.id}
            c={c}
            i={i}
            colors={colors}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="glass w-full max-w-md p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-slate-800 text-lg">🏫</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียนใหม่'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">ชื่อห้องเรียน/วิชา</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                  required
                  placeholder="เช่น ม.3/1 หรือ วิทยาศาสตร์ ม.3"
                />
              </div>
              <div>
                <label className="form-label">รายละเอียด (ไม่บังคับ)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="form-input"
                  placeholder="คำอธิบายเพิ่มเติม"
                  rows={2}
                />
              </div>
              <div>
                <label className="form-label">กฎ: สายกี่ครั้งนับเป็นขาด 1 ครั้ง</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.late_to_absent_ratio}
                  onChange={e => setForm({ ...form, late_to_absent_ratio: parseInt(e.target.value) || 1 })}
                  className="form-input"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">ค่าเริ่มต้น: 3 (สาย 3 ครั้ง = ขาด 1 ครั้ง)</p>
              </div>
              <div>
                <label className="form-label">กฎ: ลากี่ครั้งนับเป็นขาด 1 ครั้ง</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.leave_to_absent_ratio}
                  onChange={e => setForm({ ...form, leave_to_absent_ratio: parseInt(e.target.value) || 1 })}
                  className="form-input"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">ค่าเริ่มต้น: 2 (ลา 2 ครั้ง = ขาด 1 ครั้ง)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">คาบเรียน/สัปดาห์</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={periodsPerWeek}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setPeriodsPerWeek(val);
                      setForm({ ...form, total_classes: val * totalWeeks });
                    }}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">จำนวนสัปดาห์/เทอม</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={totalWeeks}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setTotalWeeks(val);
                      setForm({ ...form, total_classes: periodsPerWeek * val });
                    }}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-sm text-center font-medium text-indigo-600">
                รวมคาบเรียนทั้งหมด: {form.total_classes} คาบ
              </div>
              
              <div>
                <label className="form-label">เวลาเรียนขั้นต่ำที่มีสิทธิ์สอบ (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.min_attendance_percent}
                  onChange={e => setForm({ ...form, min_attendance_percent: parseInt(e.target.value) || 80 })}
                  className="form-input"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  ค่าเริ่มต้น: 80% (ขาดได้ไม่เกิน {Math.floor(form.total_classes * ((100 - form.min_attendance_percent) / 100))} คาบ)
                </p>
              </div>
              <button type="submit" disabled={saving} className="btn btn-primary w-full py-3">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'อัปเดต' : 'สร้างห้องเรียน'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
