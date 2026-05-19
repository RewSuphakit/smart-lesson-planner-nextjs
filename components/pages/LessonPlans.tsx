'use client';
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { Plus, Search, Edit, Trash2, Download, Sparkles, Loader2, BookOpen, X, Wand2, Clock, GraduationCap, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';

export default function LessonPlans() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const emptyForm = { title: '', subject: '', grade_level: '', duration: 60, objectives: '', content: '', teaching_methods: '', materials: '', status: 'draft' };
  const [form, setForm] = useState(emptyForm);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { fetchLessons(); }, []);

  const fetchLessons = async () => {
    try {
      const { data } = await api.get('/lessons');
      setLessons(data.data || []);
    } catch { toast.error('โหลดแผนการสอนไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: parseInt(form.duration),
        objectives: form.objectives ? form.objectives.split('\n').filter(Boolean) : [],
        teaching_methods: form.teaching_methods ? form.teaching_methods.split('\n').filter(Boolean) : [],
        materials: form.materials ? form.materials.split('\n').filter(Boolean) : [],
      };
      if (editing) {
        await api.put(`/lessons/${editing}`, payload);
        toast.success('อัปเดตแผนการสอนเรียบร้อย');
      } else {
        await api.post('/lessons', payload);
        toast.success('สร้างแผนการสอนเรียบร้อย');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      fetchLessons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const handleEdit = (lesson) => {
    setForm({
      title: lesson.title,
      subject: lesson.subject,
      grade_level: lesson.grade_level,
      duration: lesson.duration,
      objectives: Array.isArray(lesson.objectives) ? lesson.objectives.join('\n') : lesson.objectives || '',
      content: typeof lesson.content === 'object' ? JSON.stringify(lesson.content, null, 2) : lesson.content || '',
      teaching_methods: Array.isArray(lesson.teaching_methods) ? lesson.teaching_methods.join('\n') : lesson.teaching_methods || '',
      materials: Array.isArray(lesson.materials) ? lesson.materials.join('\n') : lesson.materials || '',
      status: lesson.status,
    });
    setEditing(lesson.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('ต้องการลบแผนการสอนนี้หรือไม่?')) return;
    try { await api.delete(`/lessons/${id}`); toast.success('ลบแผนการสอนแล้ว'); fetchLessons(); }
    catch { toast.error('ลบไม่สำเร็จ'); }
  };

  const handleExportPDF = async (id) => {
    try {
      const response = await api.get(`/lessons/${id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `lesson-plan-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('ส่งออก PDF สำเร็จ');
    } catch { toast.error('ส่งออก PDF ไม่สำเร็จ'); }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return toast.error('กรุณากรอกคำอธิบายสิ่งที่ต้องการสอน');
    setAiLoading(true);
    try {
      const { data } = await api.post('/lessons/generate', { prompt: aiPrompt });
      const gen = data.data;
      setForm({
        title: gen.title || '',
        subject: gen.subject || '',
        grade_level: gen.grade_level || '',
        duration: gen.duration || 60,
        objectives: Array.isArray(gen.objectives) ? gen.objectives.join('\n') : '',
        content: gen.content ? (typeof gen.content === 'object' ? JSON.stringify(gen.content, null, 2) : gen.content) : '',
        teaching_methods: Array.isArray(gen.teaching_methods) ? gen.teaching_methods.join('\n') : '',
        materials: Array.isArray(gen.materials) ? gen.materials.join('\n') : '',
        status: 'draft',
      });
      setShowAI(false);
      setShowForm(true);
      setEditing(null);
      toast.success(data.demo
        ? '📋 สร้างแผนตัวอย่าง (Demo Mode) — ตรวจสอบและบันทึกได้เลย'
        : '✨ AI สร้างแผนการสอนเรียบร้อย! ตรวจสอบและบันทึกได้เลย'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'สร้างด้วย AI ไม่สำเร็จ');
    } finally { setAiLoading(false); }
  };

  const statusMap = { 
    draft: { label: 'แบบร่าง', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10' }, 
    published: { label: 'เผยแพร่', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10' }, 
    archived: { label: 'จัดเก็บ', badge: 'bg-indigo-100 text-slate-600 border border-indigo-200 shadow-lg shadow-indigo-200' } 
  };
  const filtered = lessons.filter(l => l.title?.toLowerCase().includes(search.toLowerCase()) || l.subject?.toLowerCase().includes(search.toLowerCase()));

  // Paginated subset
  const paginatedLessons = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>;

  return (
    <>
      <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">แผนการสอน</h1>
          <p className="text-slate-500 text-sm">ทั้งหมด {lessons.length} แผน</p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setShowAI(true)} className="btn btn-accent" id="ai-generate-btn">
            <Wand2 className="w-4 h-4" /> สร้างด้วย AI
          </button>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }} className="btn btn-primary" id="new-lesson-btn">
            <Plus className="w-4 h-4" /> สร้างแผนใหม่
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-11" placeholder="ค้นหาแผนการสอน..." id="lesson-search" />
      </div>

      {/* Lessons Grid */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="glass p-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <BookOpen className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-slate-500 text-sm font-medium">ยังไม่มีแผนการสอน</p>
            <p className="text-slate-600 text-xs mt-1">เริ่มสร้างแผนการสอนใหม่หรือใช้ AI ช่วยสร้าง</p>
          </div>
        ) : paginatedLessons.map((lesson, i) => (
          <div
            key={lesson.id}
            className="glass p-5 opacity-0 animate-fade-in-up group hover:bg-indigo-50/50 transition-all duration-300 rounded-2xl relative overflow-hidden border border-indigo-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
          >
            {/* Glowing left accent border on hover */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10">
                  <BookOpen className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-base font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{lesson.title}</h3>
                    <span className={`text-[0.65rem] font-semibold px-2.5 py-0.5 rounded-full ${statusMap[lesson.status]?.badge || 'bg-indigo-100 text-slate-700'}`}>
                      {statusMap[lesson.status]?.label || lesson.status}
                    </span>
                    {lesson.ai_generated && (
                      <span className="text-[0.65rem] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 border border-purple-500/30 shadow-lg shadow-purple-500/10 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                    <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-indigo-400/70" /> {lesson.subject}</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span> ระดับ {lesson.grade_level}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400/70" /> {lesson.duration} นาที</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setShowDetail(lesson)} className="p-2 rounded-lg hover:bg-white/10 text-slate-600 hover:text-slate-800 transition-all" title="ดูรายละเอียด">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleEdit(lesson)} className="p-2 rounded-lg hover:bg-indigo-500/20 text-slate-600 hover:text-indigo-700 transition-all" title="แก้ไข">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleExportPDF(lesson.id)} className="p-2 rounded-lg hover:bg-emerald-500/20 text-slate-600 hover:text-emerald-700 transition-all" title="ส่งออก PDF">
                  <Download className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <button onClick={() => handleDelete(lesson.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-all" title="ลบ">
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
    </div>

      {/* AI Modal */}
      {showAI && createPortal(
        <div className="modal-overlay" onClick={() => setShowAI(false)}>
          <div className="glass w-full max-w-lg p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Wand2 className="w-5 h-5 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">สร้างแผนการสอนด้วย AI</h2>
                  <p className="text-xs text-slate-500">อธิบายสิ่งที่ต้องการสอน AI จะสร้างแผนให้อัตโนมัติ</p>
                </div>
              </div>
              <button onClick={() => setShowAI(false)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <textarea
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="form-input min-h-[130px] mb-5"
              placeholder='เช่น "สอนเรื่องเซ็นเซอร์ สำหรับนักเรียน ปวช. ระยะเวลา 1 ชั่วโมง"&#10;หรือ "สอนวิชาคณิตศาสตร์ เรื่องสมการเชิงเส้น ม.3 เวลา 50 นาที"'
              id="ai-prompt-input"
            />
            <button onClick={handleAIGenerate} disabled={aiLoading} className="btn btn-accent w-full py-3" id="ai-submit-btn">
              {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้าง...</> : <><Sparkles className="w-4 h-4" /> สร้างแผนการสอน</>}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Detail Modal */}
      {showDetail && createPortal(
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="glass w-full max-w-2xl p-6 sm:p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-indigo-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <BookOpen className="w-6 h-6 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 leading-tight">{showDetail.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ${statusMap[showDetail.status]?.badge || 'bg-indigo-100 text-slate-700'}`}>
                      {statusMap[showDetail.status]?.label || showDetail.status}
                    </span>
                    {showDetail.ai_generated && <span className="text-[0.65rem] text-purple-700 flex items-center gap-1"><Sparkles className="w-3 h-3" /> สร้างด้วย AI</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-inner">
                  <p className="text-[0.7rem] text-slate-600 mb-1 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> วิชา</p>
                  <p className="text-slate-800 font-bold">{showDetail.subject}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-inner">
                  <p className="text-[0.7rem] text-slate-600 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 mr-0.5"></span> ระดับชั้น</p>
                  <p className="text-slate-800 font-bold">{showDetail.grade_level}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-inner">
                  <p className="text-[0.7rem] text-slate-600 mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> ระยะเวลา</p>
                  <p className="text-slate-800 font-bold">{showDetail.duration} นาที</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {showDetail.objectives && (
                  <div className="bg-gradient-to-b from-indigo-500/5 to-transparent p-5 rounded-2xl border border-indigo-500/10">
                    <p className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-2">🎯 จุดประสงค์การเรียนรู้</p>
                    <ul className="space-y-2">
                      {(Array.isArray(showDetail.objectives) ? showDetail.objectives : [showDetail.objectives]).map((o, i) => (
                        <li key={i} className="text-slate-700 text-[0.9rem] flex items-start gap-2">
                          <span className="text-indigo-400 mt-1">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {showDetail.materials && (
                  <div className="bg-gradient-to-b from-emerald-500/5 to-transparent p-5 rounded-2xl border border-emerald-500/10">
                    <p className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">🛠️ สื่อและอุปกรณ์</p>
                    <ul className="space-y-2">
                      {(Array.isArray(showDetail.materials) ? showDetail.materials : [showDetail.materials]).map((m, i) => (
                        <li key={i} className="text-slate-700 text-[0.9rem] flex items-start gap-2">
                          <span className="text-emerald-400 mt-1">•</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {showDetail.teaching_methods && (
                <div>
                  <p className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">💡 วิธีการสอน / กิจกรรม</p>
                  <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 text-slate-700 text-[0.9rem] leading-relaxed">
                    <ul className="space-y-2">
                      {(Array.isArray(showDetail.teaching_methods) ? showDetail.teaching_methods : [showDetail.teaching_methods]).map((m, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 mt-1">{i+1}.</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {showDetail.content && (
                <div>
                  <p className="text-sm font-bold text-pink-700 mb-3 flex items-center gap-2">📝 เนื้อหาบทเรียน</p>
                  <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 text-slate-700 whitespace-pre-wrap text-[0.9rem] leading-relaxed shadow-inner">
                    {typeof showDetail.content === 'object' ? JSON.stringify(showDetail.content, null, 2) : showDetail.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Form Modal */}
      {showForm && createPortal(
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="glass w-full max-w-2xl p-6 sm:p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">
                {editing ? 'แก้ไขแผนการสอน' : 'สร้างแผนการสอนใหม่'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">ชื่อแผนการสอน</label><input name="title" value={form.title} onChange={handleChange} className="form-input" required id="lesson-title" placeholder="เช่น เรื่องเซ็นเซอร์และทรานสดิวเซอร์" /></div>
                <div><label className="form-label">วิชา</label><input name="subject" value={form.subject} onChange={handleChange} className="form-input" required id="lesson-subject" placeholder="เช่น วิทยาศาสตร์" /></div>
                <div><label className="form-label">ระดับชั้น</label><input name="grade_level" value={form.grade_level} onChange={handleChange} className="form-input" required id="lesson-grade" placeholder="เช่น ม.3 หรือ ปวช.1" /></div>
                <div><label className="form-label">ระยะเวลา (นาที)</label><input type="number" name="duration" value={form.duration} onChange={handleChange} className="form-input" required id="lesson-duration" /></div>
              </div>
              <div><label className="form-label">จุดประสงค์การเรียนรู้ (บรรทัดละ 1 ข้อ)</label><textarea name="objectives" value={form.objectives} onChange={handleChange} className="form-input min-h-[80px]" id="lesson-objectives" placeholder="นักเรียนสามารถอธิบายหลักการทำงานของเซ็นเซอร์ได้" /></div>
              <div><label className="form-label">เนื้อหาการสอน</label><textarea name="content" value={form.content} onChange={handleChange} className="form-input min-h-[100px]" id="lesson-content" placeholder="รายละเอียดเนื้อหาที่จะสอน" /></div>
              <div><label className="form-label">วิธีการสอน (บรรทัดละ 1 ข้อ)</label><textarea name="teaching_methods" value={form.teaching_methods} onChange={handleChange} className="form-input min-h-[60px]" id="lesson-methods" placeholder="การบรรยาย&#10;การสาธิต&#10;กิจกรรมกลุ่ม" /></div>
              <div><label className="form-label">สื่อ/อุปกรณ์ (บรรทัดละ 1 ข้อ)</label><textarea name="materials" value={form.materials} onChange={handleChange} className="form-input min-h-[60px]" id="lesson-materials" placeholder="สไลด์นำเสนอ&#10;ใบงาน&#10;เซ็นเซอร์ตัวอย่าง" /></div>
              <div><label className="form-label">สถานะ</label>
                <select name="status" value={form.status} onChange={handleChange} className="form-input" id="lesson-status">
                  <option value="draft">แบบร่าง</option>
                  <option value="published">เผยแพร่</option>
                  <option value="archived">จัดเก็บ</option>
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 py-3" id="lesson-save-btn">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'อัปเดต' : 'สร้างแผนการสอน'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn btn-ghost px-6">ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
