'use client';
// @ts-nocheck
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { Upload, Trash2, Download, FileText, Image, File as FileIcon, Loader2, X, FolderOpen, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Files() {
  const [files, setFiles] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lessonId, setLessonId] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [fileRes, lessRes] = await Promise.all([api.get('/files'), api.get('/lessons')]);
      setFiles(fileRes.data.data || []);
      setLessons(lessRes.data.data || []);
    } catch { toast.error('โหลดไฟล์ไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return toast.error('กรุณาเลือกไฟล์');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (lessonId) formData.append('lesson_plan_id', lessonId);
      await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('อัปโหลดไฟล์สำเร็จ');
      setShowUpload(false); setSelectedFile(null); setLessonId('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'อัปโหลดไม่สำเร็จ'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (id, name) => {
    try {
      const response = await api.get(`/files/download/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      window.URL.revokeObjectURL(url);
      toast.success('ดาวน์โหลดสำเร็จ');
    } catch { toast.error('ดาวน์โหลดไม่สำเร็จ'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('ต้องการลบไฟล์นี้หรือไม่?')) return;
    try { await api.delete(`/files/${id}`); toast.success('ลบไฟล์แล้ว'); fetchData(); }
    catch { toast.error('ลบไม่สำเร็จ'); }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-pink-400" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    return <FileIcon className="w-5 h-5 text-indigo-400" />;
  };

  const getFileColor = (mimeType) => {
    if (mimeType?.startsWith('image/')) return 'from-pink-500/15 to-rose-500/15 border-pink-500/10';
    if (mimeType === 'application/pdf') return 'from-red-500/15 to-orange-500/15 border-red-500/10';
    return 'from-indigo-500/15 to-purple-500/15 border-indigo-500/10';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelectedFile(file); setShowUpload(true); }
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>;

  return (
    <div
      className="space-y-6 animate-fade-in-up"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-white backdrop-blur-md z-50 flex items-center justify-center border-4 border-dashed border-indigo-500 rounded-3xl m-6 animate-fade-in">
          <div className="text-center bg-indigo-500/10 p-12 rounded-[3rem] border border-indigo-500/20 shadow-[0_0_100px_rgba(99,102,241,0.2)]">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/40 animate-bounce">
              <Upload className="w-10 h-10 text-slate-800" />
            </div>
            <p className="text-3xl font-bold text-slate-800 tracking-tight mb-2">ปล่อยไฟล์ตรงนี้เลย!</p>
            <p className="text-indigo-700 font-medium">ระบบจะทำการอัปโหลดให้อัตโนมัติ</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ไฟล์เอกสาร</h1>
          <p className="text-slate-500 text-sm">อัปโหลด {files.length} ไฟล์</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn btn-primary" id="upload-file-btn">
          <Upload className="w-4 h-4" /> อัปโหลดไฟล์
        </button>
      </div>

      {/* Files Grid */}
      <div className="grid gap-3">
        {files.length === 0 ? (
          <div className="glass p-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <FolderOpen className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-slate-500 text-sm font-medium">ยังไม่มีไฟล์เอกสาร</p>
            <p className="text-slate-600 text-xs mt-1">ลากไฟล์มาวางหรือกดปุ่มอัปโหลด</p>
          </div>
        ) : files.map((file, i) => (
          <div
            key={file.id}
            className="glass p-5 flex items-center gap-5 opacity-0 animate-fade-in-up group hover:bg-indigo-50/50 transition-all duration-300 rounded-2xl border border-indigo-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 relative overflow-hidden"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'forwards' }}
          >
            {/* Hover left accent */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getFileColor(file.mime_type)} border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg`}>
              {getFileIcon(file.mime_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors leading-tight mb-1">{file.original_name}</p>
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                <span className="bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{formatSize(file.size)}</span>
                {file.lesson_title && (
                  <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    <Link2 className="w-3.5 h-3.5" /> {file.lesson_title}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleDownload(file.id, file.original_name)} className="p-2 rounded-lg hover:bg-emerald-500/20 text-slate-600 hover:text-emerald-400 transition-all" title="ดาวน์โหลด">
                <Download className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button onClick={() => handleDelete(file.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-all" title="ลบ">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {showUpload && createPortal(
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="glass w-full max-w-md p-7 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Upload className="w-5 h-5 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">อัปโหลดไฟล์</h2>
                  <p className="text-xs text-slate-500">PDF, รูปภาพ, เอกสาร Word (สูงสุด 10MB)</p>
                </div>
              </div>
              <button onClick={() => setShowUpload(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="form-label">เลือกไฟล์</label>
                <label className="block cursor-pointer">
                  <div className={`glass-light p-8 text-center rounded-xl border-2 border-dashed transition-colors ${
                    selectedFile ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-700/40 hover:border-indigo-200'
                  }`}>
                    <Upload className={`w-10 h-10 mx-auto mb-3 ${selectedFile ? 'text-indigo-400' : 'text-slate-600'}`} />
                    <p className="text-sm text-slate-600 font-medium">
                      {selectedFile ? selectedFile.name : 'คลิกเพื่อเลือกไฟล์ หรือลากมาวาง'}
                    </p>
                    {selectedFile && <p className="text-xs text-slate-600 mt-1">{formatSize(selectedFile.size)}</p>}
                  </div>
                  <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files[0])} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx" id="file-input" />
                </label>
              </div>

              <div>
                <label className="form-label">เชื่อมโยงกับแผนการสอน (ไม่บังคับ)</label>
                <select value={lessonId} onChange={e => setLessonId(e.target.value)} className="form-input" id="file-lesson-link">
                  <option value="">ไม่เชื่อมโยง</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>

              <button type="submit" disabled={uploading} className="btn btn-primary w-full py-3" id="file-upload-submit">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังอัปโหลด...</> : <><Upload className="w-4 h-4" /> อัปโหลด</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
