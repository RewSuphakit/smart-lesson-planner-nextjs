'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { 
  Loader2, Search, RotateCcw, Zap, Plus, Minus,
  ThumbsUp, ThumbsDown, AlertCircle, HeartHandshake, CheckCircle2, AlertTriangle, Users, Award
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>('');
  
  // Tracking which student ID is currently updating to show individual loaders
  const [updatingStudentIds, setUpdatingStudentIds] = useState<Record<string | number, boolean>>({});
  
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score-desc' | 'score-asc'>('name');

  // ─── Query: ดึงข้อมูลห้องเรียน ───
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  // Find the selected classroom object to get the max affective weight (default: 20)
  const currentClassroom = useMemo(() => {
    return classrooms.find(c => String(c.id) === selectedClass);
  }, [selectedClass, classrooms]);

  const maxAffectiveWeight = useMemo(() => {
    return currentClassroom?.affective_weight ?? 20;
  }, [currentClassroom]);

  // ─── Query: ดึงข้อมูลนักเรียนและสถิติพฤติกรรม ───
  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['affective-students', selectedClass, maxAffectiveWeight],
    queryFn: async () => {
      const [studRes, gradesRes] = await Promise.all([
        api.get(`/students?classroom_id=${selectedClass}`),
        api.get(`/grades?classroom_id=${selectedClass}`)
      ]);

      const rawStudents = studRes.data.data || [];
      const gradesData: GradeReportStudent[] = gradesRes.data.data || [];

      return rawStudents.map((s: { id: string | number; name: string; student_code?: string; classroom_id?: string | number | null; affective_score: number | null }) => {
        const gradeInfo = gradesData.find(g => String(g.student_id) === String(s.id));
        return {
          id: s.id,
          name: s.name,
          student_code: s.student_code,
          classroom_id: s.classroom_id,
          affective_score: s.affective_score !== null && s.affective_score !== undefined 
            ? Number(s.affective_score) 
            : Math.max(0, maxAffectiveWeight - ((gradeInfo?.absent_count || 0) * 2 + (gradeInfo?.late_count || 0) * 1)),
          absent_count: gradeInfo?.absent_count || 0,
          late_count: gradeInfo?.late_count || 0
        };
      });
    },
    enabled: !!selectedClass,
  });

  // ─── Class Analytics Summary ───
  const analytics = useMemo(() => {
    if (!students || students.length === 0) {
      return { mean: '0.0', highConductCount: 0, atRiskCount: 0 };
    }

    let sum = 0;
    let highCount = 0;
    let riskCount = 0;

    students.forEach(s => {
      sum += s.affective_score;
      const pct = maxAffectiveWeight > 0 ? (s.affective_score / maxAffectiveWeight) * 100 : 0;
      if (pct >= 80) highCount++;
      if (pct < 50) riskCount++;
    });

    const mean = (sum / students.length).toFixed(1);
    return { mean, highConductCount: highCount, atRiskCount: riskCount };
  }, [students, maxAffectiveWeight]);

  // ─── Mutation: อัปเดตคะแนนจิตพิสัยนักเรียนรายคน ───
  const updateScoreMutation = useMutation({
    mutationFn: async ({ studentId, score }: { studentId: string | number; score: number }) => {
      return api.put('/students/exams?type=behavior', {
        scores: [{ student_id: studentId, affective_score: score }]
      });
    },
    onMutate: async ({ studentId, score }) => {
      await queryClient.cancelQueries({ queryKey: ['affective-students', selectedClass, maxAffectiveWeight] });
      
      const previousStudents = queryClient.getQueryData<Student[]>(['affective-students', selectedClass, maxAffectiveWeight]);
      
      queryClient.setQueryData<Student[]>(
        ['affective-students', selectedClass, maxAffectiveWeight],
        old => old?.map(s => s.id === studentId ? { ...s, affective_score: score } : s) ?? []
      );

      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: true }));

      return { previousStudents };
    },
    onError: (_err, { studentId }, context) => {
      toast.error('บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่');
      if (context?.previousStudents) {
        queryClient.setQueryData(['affective-students', selectedClass, maxAffectiveWeight], context.previousStudents);
      }
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
    },
    onSuccess: (_data, { studentId }) => {
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
  });

  // ─── Mutation: อัปเดตคะแนนทั้งห้อง ───
  const updateBatchScoresMutation = useMutation({
    mutationFn: async (batchScores: { student_id: string | number; affective_score: number }[]) => {
      return api.put('/students/exams?type=behavior', { scores: batchScores });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affective-students', selectedClass, maxAffectiveWeight] });
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
    onError: () => {
      toast.error('บันทึกคะแนนกลุ่มไม่สำเร็จ');
    },
  });

  // Handle score updates for a student
  const updateStudentScore = (studentId: string | number, newScore: number) => {
    const clampedScore = Math.min(maxAffectiveWeight, Math.max(0, newScore));
    updateScoreMutation.mutate({ studentId, score: clampedScore });
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

    if (presetLabel) {
      if (amount > 0) {
        toast.success(`บวกคะแนนจิตพิสัย: ${presetLabel} (+${amount})`, { icon: '✨', duration: 1800 });
      } else {
        toast.error(`หักคะแนนจิตพิสัย: ${presetLabel} (${amount})`, { icon: '⚠️', duration: 1800 });
      }
    }
  };

  // Global Action: Set all students to max score
  const handleResetAllToMax = () => {
    if (students.length === 0) return;
    if (!window.confirm(`ยืนยันการตั้งค่าเริ่มต้นคะแนนจิตพิสัยของนักเรียนทุกคนในห้องนี้เป็นคะแนนเต็ม (${maxAffectiveWeight} คะแนน) หรือไม่?`)) return;
    
    const batchScores = students.map(s => ({
      student_id: s.id,
      affective_score: maxAffectiveWeight
    }));

    updateBatchScoresMutation.mutate(batchScores, {
      onSuccess: () => {
        toast.success(`รีเซ็ตคะแนนจิตพิสัยทุกคนเป็น ${maxAffectiveWeight} คะแนนเต็มเรียบร้อยแล้ว`, { icon: '🔄' });
      }
    });
  };

  // Global Action: Calculate from attendance statistics & persist to DB
  const handleAutoCalculateFromAttendance = () => {
    if (students.length === 0) return;
    if (!window.confirm(`ยืนยันการคำนวณหักคะแนนจิตพิสัยตามสถิติ ขาด (หัก 2) / สาย (หัก 1) ของนักเรียนทุกคนและบันทึกลงฐานข้อมูลหรือไม่?`)) return;

    const batchScores = students.map(s => {
      const absent = s.absent_count || 0;
      const late = s.late_count || 0;
      const penalty = (absent * 2) + (late * 1);
      const autoScore = Math.max(0, maxAffectiveWeight - penalty);
      return {
        student_id: s.id,
        affective_score: autoScore
      };
    });

    updateBatchScoresMutation.mutate(batchScores, {
      onSuccess: () => {
        toast.success('คำนวณหักคะแนนตามสถิติ ขาด/สาย และบันทึกลงฐานข้อมูลเรียบร้อยแล้ว!', { icon: '⚡' });
      }
    });
  };

  // Filtering and sorting logic
  const processedStudents = useMemo(() => {
    let result = [...students];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.student_code && s.student_code.toLowerCase().includes(q))
      );
    }

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

  const getScoreBadgeStyle = (score: number) => {
    const percentage = maxAffectiveWeight > 0 ? (score / maxAffectiveWeight) * 100 : 0;
    if (percentage >= 80) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
    if (percentage >= 50) return 'text-amber-700 bg-amber-100 border-amber-300';
    return 'text-rose-700 bg-rose-100 border-rose-300 font-extrabold';
  };

  // Fast Touch Presets
  const positivePresets = [
    { label: 'ตั้งใจเรียน', value: 1, icon: '🌟' },
    { label: 'ตอบคำถาม', value: 1, icon: '🙋' },
    { label: 'ช่วยเหลือครู/เพื่อน', value: 2, icon: '🤝' },
  ];

  const negativePresets = [
    { label: 'คุยเสียงดัง', value: -1, icon: '🤫' },
    { label: 'เล่นโทรศัพท์', value: -2, icon: '📱' },
    { label: 'เล่นเกม', value: -2, icon: '🎮' },
    { label: 'ไม่ทำงาน', value: -2, icon: '📄' },
    { label: 'ก่อกวน', value: -3, icon: '⚠️' },
  ];

  if (loadingClassrooms) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-pink-600" />
            ห้องเรียนคุณธรรม & จิตพิสัย (Affective)
          </h1>
          <p className="text-slate-500 text-sm">การบวกหรือหักคะแนนพฤติกรรมในชั้นเรียนแบบเรียลไทม์ เชื่อมต่อกับระบบตัดเกรดโดยตรง</p>
        </div>
      </div>

      {/* Classroom Selection Bar */}
      <div className="glass p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end justify-between border border-indigo-100 bg-white">
        <div className="flex-1 w-full max-w-md">
          <label className="form-label font-bold text-slate-700" htmlFor="affective-class-select">เลือกห้องเรียนที่กำลังสอน</label>
          <select 
            id="affective-class-select"
            value={selectedClass} 
            onChange={e => setSelectedClass(e.target.value)} 
            className="form-input text-base font-medium border-indigo-200 focus:border-indigo-500 bg-white"
          >
            <option value="">-- เลือกห้องเรียนเพื่อเริ่มให้คะแนน --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        {selectedClass && (
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <button
              onClick={handleAutoCalculateFromAttendance}
              disabled={loadingStudents || updateBatchScoresMutation.isPending || students.length === 0}
              className="btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
              title="คำนวณหักคะแนนจิตพิสัยตามสถิติ ขาด (หัก 2) / สาย (หัก 1) แล้วบันทึกลงฐานข้อมูล"
            >
              {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-600" />}
              <span>คำนวณตามประวัติเข้าเรียน</span>
            </button>

            <button
              onClick={handleResetAllToMax}
              disabled={loadingStudents || updateBatchScoresMutation.isPending || students.length === 0}
              className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
              title="รีเซ็ตคะแนนจิตพิสัยทุกคนเป็นคะแนนเต็มห้อง"
            >
              {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 text-indigo-600" />}
              <span>ให้คะแนนเต็มทุกคน ({maxAffectiveWeight})</span>
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="glass p-16 text-center rounded-2xl border border-indigo-100 bg-white">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 text-3xl shadow-sm border border-indigo-100">
            ✨
          </div>
          <h3 className="text-lg font-bold text-slate-800">เริ่มต้นจัดการชั้นเรียนคุณธรรม</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">เลือกห้องเรียนด้านบน เพื่อบวกหรือหักคะแนนจิตพิสัยของนักเรียนในชั้นเรียนได้ทันที</p>
        </div>
      ) : loadingStudents ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-14 text-center rounded-2xl border border-indigo-100 bg-white">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">ไม่พบข้อมูลนักเรียนในห้องเรียนนี้</p>
          <p className="text-slate-500 text-xs mt-1">กรุณาเพิ่มนักเรียนในเมนูหลัก &ldquo;จัดการนักเรียน&rdquo; ก่อน</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Analytics Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-pink-50/80 to-purple-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">คะแนนจิตพิสัยเฉลี่ย</p>
                <div className="text-2xl font-black text-pink-700">{analytics.mean} <span className="text-xs font-semibold text-slate-500">/ {maxAffectiveWeight}</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">พฤติกรรมดีเยี่ยม (≥ 80%)</p>
                <div className="text-2xl font-black text-emerald-700">{analytics.highConductCount} <span className="text-xs font-semibold text-slate-500">คน</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-rose-50/80 to-amber-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">กลุ่มต้องติดตาม (&lt; 50%)</p>
                <div className="text-2xl font-black text-rose-700">{analytics.atRiskCount} <span className="text-xs font-semibold text-slate-500">คน</span></div>
              </div>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="form-input pl-10 text-xs bg-white border-indigo-100 rounded-xl focus:border-indigo-500" 
                placeholder="ค้นหารหัสนักเรียน หรือ ชื่อ..." 
                id="affective-search"
                aria-label="ค้นหารหัสนักเรียน หรือชื่อ"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <div className="text-xs text-slate-600 bg-indigo-50/80 border border-indigo-100 px-3 py-1.5 rounded-xl font-medium">
                คะแนนเต็มจิตพิสัยห้องนี้: <span className="font-bold text-indigo-700">{maxAffectiveWeight} คะแนน</span>
              </div>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as 'name' | 'score-desc' | 'score-asc')} 
                className="form-input text-xs w-44 py-1.5 bg-white border-indigo-100 rounded-xl"
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
              <div className="col-span-full glass p-10 text-center text-slate-500 rounded-2xl border border-indigo-100 bg-white">
                ไม่พบนักเรียนตรงตามเงื่อนไขค้นหา
              </div>
            ) : processedStudents.map((s) => {
              const absent = s.absent_count || 0;
              const late = s.late_count || 0;
              const attendancePenalty = (absent * 2) + (late * 1);
              const scorePercent = maxAffectiveWeight > 0 ? (s.affective_score / maxAffectiveWeight) * 100 : 0;
              const isUpdating = updatingStudentIds[s.id];

              return (
                <div 
                  key={s.id} 
                  className={`glass overflow-hidden rounded-2xl transition-all duration-300 p-5 border flex flex-col md:flex-row gap-4 bg-white ${
                    s.affective_score < (maxAffectiveWeight * 0.5)
                      ? 'border-rose-200 bg-rose-50/30' 
                      : 'border-indigo-100 hover:border-indigo-300'
                  }`}
                >
                  {/* Left Side: Avatar, Name and Attendance Stats */}
                  <div className="flex flex-row md:flex-col items-center gap-3 shrink-0 md:w-36 text-center md:border-r border-indigo-100/70 md:pr-3">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl shadow-sm shrink-0">
                      {animalAvatars[(Number(s.id) || 0) % animalAvatars.length]}
                    </div>
                    
                    <div className="flex-1 md:flex-none text-left md:text-center min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                      {s.student_code && <p className="text-[10px] text-slate-500 mt-0.5">รหัส: {s.student_code}</p>}
                      
                      {/* Attendance Badges */}
                      <div className="flex items-center gap-1.5 md:justify-center mt-1 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded ${absent > 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                          ขาด {absent}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${late > 0 ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                          สาย {late}
                        </span>
                      </div>
                      {attendancePenalty > 0 && (
                        <p className="text-[9px] text-rose-500 font-semibold mt-1">หักเวลาเรียน -{attendancePenalty} คะแนน</p>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Score Adjust Panel and Presets */}
                  <div className="flex-1 flex flex-col justify-between gap-3">
                    {/* Score Control Area */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Plus / Minus Stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleScoreAdjust(s.id, s.affective_score, -1, 'ลบ 1 คะแนน')}
                          disabled={isUpdating}
                          className="w-8 h-8 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                          title="หัก 1 คะแนน"
                          aria-label="หัก 1 คะแนน"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Score Input Display */}
                        <div className="flex items-center gap-1 text-center">
                          {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500 shrink-0 mx-2" />
                          ) : (
                            <input
                              type="number"
                              step="0.5"
                              value={s.affective_score}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                if (!isNaN(val)) updateStudentScore(s.id, val);
                              }}
                              className="form-input text-center font-black text-lg py-0.5 px-1 w-16 h-8 bg-indigo-50/50 border-indigo-200 text-indigo-900 rounded-lg"
                              min="0"
                              max={maxAffectiveWeight}
                              aria-label="คะแนนจิตพิสัยนักเรียนคนนี้"
                            />
                          )}
                          <span className="text-xs text-slate-500 font-semibold">/ {maxAffectiveWeight}</span>
                        </div>

                        <button
                          onClick={() => handleScoreAdjust(s.id, s.affective_score, 1, 'บวก 1 คะแนน')}
                          disabled={isUpdating}
                          className="w-8 h-8 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                          title="บวก 1 คะแนน"
                          aria-label="บวก 1 คะแนน"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Status Color Badge */}
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border shadow-sm ${getScoreBadgeStyle(s.affective_score)}`}>
                        {s.affective_score.toFixed(1)} / {maxAffectiveWeight} ({scorePercent.toFixed(0)}%)
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          scorePercent >= 80 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                      />
                    </div>

                    {/* Behavior Presets Buttons */}
                    <div className="space-y-1.5 pt-1">
                      {/* Positive Presets */}
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider shrink-0 flex items-center gap-0.5 mr-1">
                          <ThumbsUp className="w-3 h-3 text-emerald-600" /> ชมเชย:
                        </span>
                        {positivePresets.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                            disabled={isUpdating}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1"
                          >
                            <span>{p.icon}</span>
                            <span>{p.label} (+{p.value})</span>
                          </button>
                        ))}
                      </div>

                      {/* Negative Presets */}
                      <div className="flex flex-wrap gap-1 items-center pt-0.5">
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider shrink-0 flex items-center gap-0.5 mr-1">
                          <ThumbsDown className="w-3 h-3 text-rose-600" /> ตักเตือน:
                        </span>
                        {negativePresets.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                            disabled={isUpdating}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1"
                          >
                            <span>{p.icon}</span>
                            <span>{p.label} ({p.value})</span>
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

