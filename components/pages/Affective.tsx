'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/services/api';
import { 
  Loader2, Search, Award, RotateCcw, Zap, Sparkles, Plus, Minus, Check, CheckCircle2,
  TrendingDown, TrendingUp, ThumbsUp, ThumbsDown, UserCheck, AlertCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

interface Classroom {
  id: string | number;
  name: string;
  affective_weight?: number;
}

interface Student {
  id: string | number;
  name: string;
  student_code?: string;
  classroom_id?: string | number | null;
  affective_score: number;
  absent_count?: number;
  late_count?: number;
}

interface GradeReportStudent {
  student_id: string | number;
  name: string;
  student_code?: string;
  affective_score?: number | string;
  absent_count?: number;
  late_count?: number;
}

export default function Affective() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Tracking which student ID is currently updating to show individual loaders
  const [updatingStudentIds, setUpdatingStudentIds] = useState<Record<string | number, boolean>>({});
  
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score-desc' | 'score-asc'>('name');

  // Load classrooms on mount
  useEffect(() => {
    const controller = new AbortController();
    async function loadClassrooms() {
      try {
        const res = await api.get('/classrooms', { signal: controller.signal });
        setClassrooms(res.data.data || []);
      } catch (err) {
        if (!axios.isCancel(err)) {
          toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
        }
      } finally {
        setLoading(false);
      }
    }
    loadClassrooms();
    return () => controller.abort();
  }, []);

  // Find the selected classroom object to get the max affective weight (default: 20)
  const currentClassroom = useMemo(() => {
    return classrooms.find(c => String(c.id) === selectedClass);
  }, [selectedClass, classrooms]);

  const maxAffectiveWeight = useMemo(() => {
    return currentClassroom?.affective_weight ?? 20;
  }, [currentClassroom]);

  // Load students and their behavior stats
  const fetchStudents = useCallback(async (signal?: AbortSignal) => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      // We pull both students list (for accurate IDs/emails) and grades report (for absences/lates stats)
      const [studRes, gradesRes] = await Promise.all([
        api.get(`/students?classroom_id=${selectedClass}`, { signal }),
        api.get(`/grades?classroom_id=${selectedClass}`, { signal })
      ]);

      const rawStudents = studRes.data.data || [];
      const gradesData: GradeReportStudent[] = gradesRes.data.data || [];

      // Map student data with grades statistics (absence & late counts)
      const mapped = rawStudents.map((s: any) => {
        const gradeInfo = gradesData.find(g => String(g.student_id) === String(s.id));
        return {
          id: s.id,
          name: s.name,
          student_code: s.student_code,
          classroom_id: s.classroom_id,
          // Use backend affective score, default to max weight if null
          affective_score: s.affective_score !== null && s.affective_score !== undefined 
            ? Number(s.affective_score) 
            : maxAffectiveWeight,
          absent_count: gradeInfo?.absent_count || 0,
          late_count: gradeInfo?.late_count || 0
        };
      });

      setStudents(mapped);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลนักเรียนไม่สำเร็จ');
      }
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, maxAffectiveWeight]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStudents(controller.signal);
    return () => controller.abort();
  }, [fetchStudents]);

  // Handle score updates for a student (syncs with backend)
  const updateStudentScore = async (studentId: string | number, newScore: number) => {
    const clampedScore = Math.min(maxAffectiveWeight, Math.max(0, newScore));
    
    // Optimistic UI update
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, affective_score: clampedScore } : s));
    
    // Set updating status
    setUpdatingStudentIds(prev => ({ ...prev, [studentId]: true }));

    try {
      await api.put('/students/exams', {
        scores: [
          {
            student_id: studentId,
            affective_score: clampedScore
          }
        ]
      });
      // Clear updating status
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
    } catch (err) {
      toast.error('บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่');
      // Revert on failure by re-fetching
      fetchStudents();
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Adjust score by value (+/-)
  const handleScoreAdjust = (studentId: string | number, currentScore: number, amount: number, presetLabel?: string) => {
    const nextScore = currentScore + amount;
    const clamped = Math.min(maxAffectiveWeight, Math.max(0, nextScore));

    if (clamped === currentScore) {
      if (amount < 0) {
        toast.error('คะแนนไม่สามารถต่ำกว่า 0 ได้');
      } else {
        toast.error(`คะแนนเต็มสูงสุดที่ ${maxAffectiveWeight} คะแนนแล้ว`);
      }
      return;
    }

    updateStudentScore(studentId, clamped);

    // Show a beautiful contextual toast feedback
    if (presetLabel) {
      if (amount > 0) {
        toast.success(`บวกคะแนนจิตพิสัย: ${presetLabel} (+${amount})`, {
          icon: '✨',
          duration: 2000
        });
      } else {
        toast.error(`หักคะแนนจิตพิสัย: ${presetLabel} (${amount})`, {
          icon: '⚠️',
          duration: 2000
        });
      }
    }
  };

  // Global Action: Set all students to the max affective weight
  const handleResetAllToMax = async () => {
    if (students.length === 0) return;
    if (!window.confirm(`ยืนยันการตั้งค่าเริ่มต้นคะแนนจิตพิสัยของนักเรียนทุกคนในห้องนี้เป็นคะแนนเต็ม (${maxAffectiveWeight} คะแนน) หรือไม่?`)) return;

    setLoadingStudents(true);
    try {
      const scores = students.map(s => ({
        student_id: s.id,
        affective_score: maxAffectiveWeight
      }));

      await api.put('/students/exams', { scores });
      toast.success(`รีเซ็ตคะแนนจิตพิสัยทุกคนเป็น ${maxAffectiveWeight} คะแนนเรียบร้อยแล้ว`, { icon: '🔄' });
      fetchStudents();
    } catch {
      toast.error('รีเซ็ตคะแนนไม่สำเร็จ');
      setLoadingStudents(false);
    }
  };

  // Global Action: Calculate from attendance
  const handleAutoCalculateFromAttendance = async () => {
    if (students.length === 0) return;
    if (!window.confirm('ยืนยันคำนวณจิตพิสัยอัตโนมัติตามการเข้าเรียนหรือไม่? (หัก ขาดครั้งละ -2, สายครั้งละ -1 คะแนน จากคะแนนเต็ม)')) return;

    setLoadingStudents(true);
    try {
      const scores = students.map(s => {
        const absent = s.absent_count || 0;
        const late = s.late_count || 0;
        const autoScore = Math.max(0, maxAffectiveWeight - (absent * 2) - (late * 1));
        return {
          student_id: s.id,
          affective_score: autoScore
        };
      });

      await api.put('/students/exams', { scores });
      toast.success('คำนวณและปรับเปลี่ยนคะแนนเรียบร้อยแล้ว!', { icon: '⚡' });
      fetchStudents();
    } catch {
      toast.error('คำนวณคะแนนไม่สำเร็จ');
      setLoadingStudents(false);
    }
  };

  // Filtering and sorting logic
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.student_code && s.student_code.toLowerCase().includes(q))
      );
    }

    // Sort options
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'th');
      }
      if (sortBy === 'score-desc') {
        return b.affective_score - a.affective_score;
      }
      if (sortBy === 'score-asc') {
        return a.affective_score - b.affective_score;
      }
      return 0;
    });

    return result;
  }, [students, search, sortBy]);

  // Color classes for student scores relative to max weight
  const getScoreColorClass = (score: number) => {
    const percentage = maxAffectiveWeight > 0 ? (score / maxAffectiveWeight) * 100 : 0;
    if (percentage >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (percentage >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  // Behavior presets
  const positivePresets = [
    { label: 'ตั้งใจเรียน', value: 1 },
    { label: 'มีส่วนร่วมถาม-ตอบ', value: 1 },
    { label: 'ช่วยเหลืองานครู/เพื่อน', value: 2 },
  ];

  const negativePresets = [
    { label: 'คุยเสียงดัง/เล่นเกม', value: -1 },
    { label: 'เล่นโทรศัพท์', value: -2 },
    { label: 'ไม่ส่งงาน/ไม่ทำงาน', value: -2 },
    { label: 'พฤติกรรมก้าวร้าว', value: -3 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ห้องเรียนคุณธรรม & จิตพิสัย</h1>
          <p className="text-slate-500 text-sm">การบวกหรือหักคะแนนพฤติกรรมของนักเรียนในชั้นเรียนแบบเรียลไทม์</p>
        </div>
      </div>

      {/* Classroom Selection */}
      <div className="glass p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end justify-between border border-indigo-200/30">
        <div className="flex-1 w-full max-w-md">
          <label className="form-label font-semibold text-slate-700" htmlFor="affective-class-select">เลือกห้องเรียนที่กำลังสอน</label>
          <select 
            id="affective-class-select"
            value={selectedClass} 
            onChange={e => setSelectedClass(e.target.value)} 
            className="form-input text-base"
          >
            <option value="">-- เลือกห้องเรียนเพื่อเริ่มให้คะแนน --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        {selectedClass && (
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <button
              onClick={handleAutoCalculateFromAttendance}
              disabled={loadingStudents || students.length === 0}
              className="btn bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-slate-800 border border-amber-500/20 flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2.5"
              title="คำนวณคะแนนหักตามสถิติการ ขาด / สาย จากตารางเข้าเรียนอัตโนมัติ"
            >
              <Zap className="w-4 h-4" />
              <span>คำนวณตามประวัติเข้าเรียน</span>
            </button>
            <button
              onClick={handleResetAllToMax}
              disabled={loadingStudents || students.length === 0}
              className="btn bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-slate-800 border border-indigo-500/20 flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2.5"
              title="รีเซ็ตคะแนนทุกคนเป็นคะแนนเต็มห้อง"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ให้คะแนนเต็มทุกคน</span>
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="glass p-16 text-center rounded-2xl border border-indigo-100/50">
          <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-3xl shadow-sm border border-indigo-100/30">
            ✨
          </div>
          <p className="text-slate-700 font-semibold text-lg">เริ่มต้นจัดการชั้นเรียน</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">เลือกห้องเรียนด้านบน เพื่อบวกหรือลบคะแนนจิตพิสัยของนักเรียนขณะกำลังสอนได้ทันที</p>
        </div>
      ) : loadingStudents ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-14 text-center rounded-2xl">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">ไม่พบข้อมูลนักเรียนในห้องเรียนนี้</p>
          <p className="text-slate-500 text-xs mt-1">กรุณาเพิ่มนักเรียนในเมนูหลัก "นักเรียน" ก่อน</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Search, Stats & Sort Options */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="form-input pl-11" 
                placeholder="ค้นหารหัสนักเรียน หรือชื่อ..." 
                id="affective-search"
                aria-label="ค้นหารหัสนักเรียน หรือชื่อ"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <div className="text-xs text-slate-500 bg-white border border-indigo-100 px-3 py-2 rounded-xl">
                คะแนนเต็มวิชาจิตพิสัยห้องนี้: <span className="font-bold text-indigo-500">{maxAffectiveWeight} คะแนน</span>
              </div>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)} 
                className="form-input text-xs w-44 py-2"
                aria-label="เรียงลำดับรายการ"
              >
                <option value="name">เรียงตาม: ชื่อนักเรียน</option>
                <option value="score-desc">เรียงตาม: คะแนนจิตพิสัย (สูง-ต่ำ)</option>
                <option value="score-asc">เรียงตาม: คะแนนจิตพิสัย (ต่ำ-สูง)</option>
              </select>
            </div>
          </div>

          {/* Student Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {processedStudents.length === 0 ? (
              <div className="col-span-full glass p-10 text-center text-slate-500 rounded-2xl">
                ไม่พบนักเรียนตรงตามเงื่อนไขค้นหา
              </div>
            ) : processedStudents.map((s, index) => {
              const scorePercent = maxAffectiveWeight > 0 ? (s.affective_score / maxAffectiveWeight) * 100 : 0;
              const isUpdating = updatingStudentIds[s.id];

              return (
                <div 
                  key={s.id} 
                  className={`glass overflow-hidden rounded-2xl transition-all duration-300 p-5 border flex flex-col md:flex-row gap-5 ${
                    s.affective_score === 0 
                      ? 'border-rose-500/20 bg-rose-500/[0.02]' 
                      : 'border-indigo-100/70 hover:border-indigo-300/60'
                  }`}
                >
                  {/* Left Side: Avatar, Name and Score Indicator */}
                  <div className="flex flex-row md:flex-col items-center gap-4 shrink-0 md:w-36 text-center md:border-r border-indigo-100/50 md:pr-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-3xl shadow-sm shrink-0">
                      {animalAvatars[(Number(s.id) || 0) % animalAvatars.length]}
                    </div>
                    
                    <div className="flex-1 md:flex-none text-left md:text-center min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                      {s.student_code && <p className="text-[10px] text-slate-500 mt-0.5">รหัส: {s.student_code}</p>}
                      <div className="flex items-center gap-1.5 md:justify-center mt-1 text-[10px] text-slate-600">
                        {s.absent_count !== undefined && (
                          <span className={`${s.absent_count > 0 ? 'text-rose-500 font-semibold' : 'text-slate-500'}`}>
                            ขาด {s.absent_count}
                          </span>
                        )}
                        <span>•</span>
                        {s.late_count !== undefined && (
                          <span className={`${s.late_count > 0 ? 'text-amber-500 font-semibold' : 'text-slate-500'}`}>
                            สาย {s.late_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Score adjust Panel and Presets */}
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    {/* Score Control Area */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Plus Minus Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleScoreAdjust(s.id, s.affective_score, -1, 'ลบ 1 คะแนน')}
                          disabled={isUpdating}
                          className="w-9 h-9 rounded-xl border border-rose-200/50 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                          title="หัก 1 คะแนน"
                          aria-label="หัก 1 คะแนน"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        {/* Score display */}
                        <div className="flex items-center gap-1 text-center px-1">
                          {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500 shrink-0" />
                          ) : (
                            <input
                              type="number"
                              value={s.affective_score}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                if (!isNaN(val)) updateStudentScore(s.id, val);
                              }}
                              className="form-input text-center font-extrabold text-xl py-1 px-2 w-14 h-9 bg-slate-50 border-indigo-200"
                              min="0"
                              max={maxAffectiveWeight}
                              aria-label="คะแนนจิตพิสัยนักเรียนคนนี้"
                            />
                          )}
                          <span className="text-xs text-slate-500 font-medium">/ {maxAffectiveWeight}</span>
                        </div>

                        <button
                          onClick={() => handleScoreAdjust(s.id, s.affective_score, 1, 'บวก 1 คะแนน')}
                          disabled={isUpdating}
                          className="w-9 h-9 rounded-xl border border-emerald-200/50 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                          title="บวก 1 คะแนน"
                          aria-label="บวก 1 คะแนน"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Status indicator bar / color badge */}
                      <div className={`px-3 py-1 rounded-xl text-xs font-bold border ${getScoreColorClass(s.affective_score)}`}>
                        {s.affective_score.toFixed(1)} / {maxAffectiveWeight} ({scorePercent.toFixed(0)}%)
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          scorePercent >= 80 ? 'bg-emerald-400' : scorePercent >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                      />
                    </div>

                    {/* Behavior quick buttons */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">พฤติกรรมดี (+):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {positivePresets.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                            disabled={isUpdating}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.03] hover:bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 text-[10px] font-medium transition-all active:scale-95 disabled:opacity-40"
                          >
                            {p.label} (+{p.value})
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 pt-1">
                        <ThumbsDown className="w-3 h-3 text-rose-400" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">ควรปรับปรุง (-):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {negativePresets.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                            disabled={isUpdating}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/[0.03] hover:bg-rose-500/10 text-rose-500 border border-rose-500/10 text-[10px] font-medium transition-all active:scale-95 disabled:opacity-40"
                          >
                            {p.label} ({p.value})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
