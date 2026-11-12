'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import {
  Loader2, Search, RotateCcw, Zap, Plus, Minus,
  ThumbsUp, ThumbsDown, AlertCircle, HeartHandshake, CheckCircle2, AlertTriangle, Award, X, Grid,
  Sliders, Pencil
} from 'lucide-react';
import toast from '@/lib/toast';
import UserAvatar from '@/components/UserAvatar';
import ClassroomCardPicker from '@/components/ClassroomCardPicker';
import SectionSwitcher from '@/components/SectionSwitcher';
import { parseClassroomName } from '@/lib/classroom';
import { buildStudentSectionGroups } from '@/lib/studentSections';

interface Classroom {
  id: string | number;
  name: string;
  affective_weight?: number;
  late_deduction_score?: number;
  absent_deduction_score?: number;
  student_count?: number;
  total_classes?: number;
  total_weeks?: number;
}

interface Student {
  id: string | number;
  name: string;
  student_code?: string;
  grade_level?: string | null;
  branch?: string | null;
  classroom_id?: string | number | null;
  affective_score: number;
  absent_count?: number;
  late_count?: number;
  avatar?: string | null;
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

  // Modal for calculating from attendance stats
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcMode, setCalcMode] = useState<'deductFromCurrent' | 'resetFromMax'>('deductFromCurrent');
  const [customAbsentDeduct, setCustomAbsentDeduct] = useState<number>(2);
  const [customLateDeduct, setCustomLateDeduct] = useState<number>(1);

  // Modal for customizing max affective score
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [customWeightInput, setCustomWeightInput] = useState<number>(20);
  const [resetStudentsToNew, setResetStudentsToNew] = useState(false);

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

  const absentDeduction = useMemo(() => {
    return currentClassroom?.absent_deduction_score ?? 2;
  }, [currentClassroom]);

  const lateDeduction = useMemo(() => {
    return currentClassroom?.late_deduction_score ?? 1;
  }, [currentClassroom]);

  const affectiveQueryKey = useMemo(
    () => ['affective-students', selectedClass, maxAffectiveWeight, absentDeduction, lateDeduction] as const,
    [selectedClass, maxAffectiveWeight, absentDeduction, lateDeduction]
  );

  // ─── Query: ดึงข้อมูลนักเรียนและสถิติพฤติกรรม ───
  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: affectiveQueryKey,
    queryFn: async () => {
      const [studRes, gradesRes] = await Promise.all([
        api.get(`/students?classroom_id=${selectedClass}&include_avatar=true`),
        api.get(`/grades?classroom_id=${selectedClass}`)
      ]);

      const rawStudents = studRes.data.data || [];
      const gradesData: GradeReportStudent[] = gradesRes.data.data || [];

      return rawStudents.map((s: { id: string | number; name: string; student_code?: string; classroom_id?: string | number | null; affective_score: number | null; avatar?: string | null; grade_level?: string | null; branch?: string | null }) => {
        const gradeInfo = gradesData.find(g => String(g.student_id) === String(s.id));
        return {
          id: s.id,
          name: s.name,
          student_code: s.student_code,
          grade_level: s.grade_level,
          branch: s.branch,
          classroom_id: s.classroom_id,
          avatar: s.avatar || (gradeInfo as any)?.avatar || null,
          affective_score: s.affective_score !== null && s.affective_score !== undefined
            ? Number(s.affective_score)
            : Math.max(0, maxAffectiveWeight - ((gradeInfo?.absent_count || 0) * absentDeduction + (gradeInfo?.late_count || 0) * lateDeduction)),
          absent_count: gradeInfo?.absent_count || 0,
          late_count: gradeInfo?.late_count || 0
        };
      });
    },
    enabled: !!selectedClass,
  });

  // ─── Sub-room / Section Grouping (แยกห้องย่อยเมื่อเรียนรวม เช่น ปวช.1/1 + ปวช.1/2) ───
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');

  // Reset section filter when switching classrooms
  useEffect(() => {
    setSelectedSectionKey('all');
  }, [selectedClass]);

  const { groups: sectionGroups, hasMultipleSections, sharedBranch } = useMemo(
    () => buildStudentSectionGroups(students),
    [students]
  );

  useEffect(() => {
    if (selectedSectionKey !== 'all' && !sectionGroups.some(g => g.key === selectedSectionKey)) {
      setSelectedSectionKey('all');
    }
  }, [selectedSectionKey, sectionGroups]);

  const activeSectionGroup = useMemo(
    () => (selectedSectionKey === 'all' ? null : sectionGroups.find(g => g.key === selectedSectionKey) || null),
    [selectedSectionKey, sectionGroups]
  );

  const sectionScopedStudents = useMemo(() => {
    if (activeSectionGroup) return activeSectionGroup.students;
    if (sectionGroups.length > 0) return sectionGroups.flatMap(g => g.students);
    return students;
  }, [activeSectionGroup, sectionGroups, students]);

  // ─── Class Analytics Summary (คำนวณตามขอบเขตห้องย่อยที่เลือก) ───
  const analytics = useMemo(() => {
    if (!sectionScopedStudents || sectionScopedStudents.length === 0) {
      return { mean: '0.0', highConductCount: 0, atRiskCount: 0 };
    }

    let sum = 0;
    let highCount = 0;
    let riskCount = 0;

    sectionScopedStudents.forEach(s => {
      sum += s.affective_score;
      const pct = maxAffectiveWeight > 0 ? (s.affective_score / maxAffectiveWeight) * 100 : 0;
      if (pct >= 80) highCount++;
      if (pct < 50) riskCount++;
    });

    const mean = (sum / sectionScopedStudents.length).toFixed(1);
    return { mean, highConductCount: highCount, atRiskCount: riskCount };
  }, [sectionScopedStudents, maxAffectiveWeight]);

  // ─── Mutation: อัปเดตคะแนนจิตพิสัยนักเรียนรายคน ───
  const updateScoreMutation = useMutation({
    mutationKey: ['affective-update-score', selectedClass],
    mutationFn: async ({ studentId, score }: { studentId: string | number; score: number }) => {
      return api.put('/students/exams?type=behavior', {
        scores: [{ student_id: studentId, affective_score: score }]
      });
    },
    onMutate: async ({ studentId, score }) => {
      const targetQueryKey = affectiveQueryKey;
      const classroomId = selectedClass;
      await queryClient.cancelQueries({ queryKey: targetQueryKey });

      const previousStudents = queryClient.getQueryData<Student[]>(targetQueryKey);
      const previousScore = previousStudents?.find(s => String(s.id) === String(studentId))?.affective_score;

      queryClient.setQueryData<Student[]>(
        targetQueryKey,
        old => old?.map(s => String(s.id) === String(studentId) ? { ...s, affective_score: score } : s)
      );

      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: true }));

      return { targetQueryKey, classroomId, previousScore };
    },
    onError: (_err, { studentId }, context) => {
      toast.error('บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่');
      if (context?.previousScore !== undefined) {
        const rollbackScore = context.previousScore;
        queryClient.setQueryData<Student[]>(
          context.targetQueryKey,
          old => old?.map(s => String(s.id) === String(studentId) ? { ...s, affective_score: rollbackScore } : s)
        );
      }
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
    },
    onSuccess: (_data, { studentId }, context) => {
      setUpdatingStudentIds(prev => ({ ...prev, [studentId]: false }));
      queryClient.invalidateQueries({ queryKey: ['grades', context?.classroomId ?? selectedClass] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onSettled: (_data, _err, _vars, context) => {
      const classroomId = context?.classroomId ?? selectedClass;
      if (queryClient.isMutating({ mutationKey: ['affective-update-score', classroomId] }) <= 1) {
        queryClient.invalidateQueries({ queryKey: ['affective-students', classroomId] });
      }
    },
  });

  // ─── Mutation: อัปเดตคะแนนทั้งห้อง ───
  const updateBatchScoresMutation = useMutation({
    mutationFn: async (batchScores: { student_id: string | number; affective_score: number }[]) => {
      return api.put('/students/exams?type=behavior', { scores: batchScores });
    },
    onSuccess: (_data, batchScores) => {
      const scoreMap = new Map(batchScores.map(item => [String(item.student_id), item.affective_score]));
      queryClient.setQueryData<Student[]>(
        affectiveQueryKey,
        old => old?.map(s => {
          const updated = scoreMap.get(String(s.id));
          return updated !== undefined ? { ...s, affective_score: updated } : s;
        })
      );
      queryClient.invalidateQueries({ queryKey: ['affective-students', selectedClass] });
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: () => {
      toast.error('บันทึกคะแนนกลุ่มไม่สำเร็จ');
    },
  });

  // ─── Mutation: อัปเดตคะแนนเต็มจิตพิสัยของห้องเรียน ───
  const updateClassroomWeightMutation = useMutation({
    mutationFn: async ({ weight, resetAll }: { weight: number; resetAll: boolean }) => {
      await api.put(`/classrooms/${selectedClass}`, {
        affective_weight: weight,
      });

      if (resetAll && students.length > 0) {
        const batchScores = students.map(s => ({
          student_id: s.id,
          affective_score: weight,
        }));
        await api.put('/students/exams?type=behavior', {
          scores: batchScores,
        });
      }
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
        queryClient.invalidateQueries({ queryKey: ['affective-students'] }),
        queryClient.invalidateQueries({ queryKey: ['grades'] }),
      ]);
      setShowWeightModal(false);
      toast.success(`กำหนดคะแนนเต็มจิตพิสัยเป็น ${variables.weight} คะแนนเรียบร้อยแล้ว`, { icon: '🎯' });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'ไม่สามารถอัปเดตคะแนนเต็มได้');
    },
  });

  const clampAffectiveScore = (value: number) =>
    Math.round(Math.min(maxAffectiveWeight, Math.max(0, value)) * 100) / 100;

  // Handle score updates for a student
  const updateStudentScore = (studentId: string | number, newScore: number) => {
    const clampedScore = clampAffectiveScore(newScore);
    updateScoreMutation.mutate({ studentId, score: clampedScore });
  };

  // Adjust score by value (+/-)
  const handleScoreAdjust = (studentId: string | number, currentScore: number, amount: number, presetLabel?: string) => {
    const clamped = clampAffectiveScore(currentScore + amount);

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

  // Global Action: Set all students to max score (เคารพขอบเขตห้องย่อยที่เลือก)
  const handleResetAllToMax = () => {
    if (sectionScopedStudents.length === 0) return;
    const targetScopeName = activeSectionGroup ? `ห้อง "${activeSectionGroup.label}" (${sectionScopedStudents.length} คน)` : `ทุกคน (${students.length} คน)`;
    if (!window.confirm(`ยืนยันการตั้งค่าเริ่มต้นคะแนนจิตพิสัยของนักเรียน${targetScopeName} เป็นคะแนนเต็ม (${maxAffectiveWeight} คะแนน) หรือไม่?`)) return;

    const batchScores = sectionScopedStudents.map(s => ({
      student_id: s.id,
      affective_score: maxAffectiveWeight
    }));

    updateBatchScoresMutation.mutate(batchScores, {
      onSuccess: () => {
        toast.success(`รีเซ็ตคะแนนจิตพิสัย${targetScopeName}เป็น ${maxAffectiveWeight} คะแนนเต็มเรียบร้อยแล้ว`, { icon: '🔄' });
      }
    });
  };

  // Global Action: Calculate from attendance statistics & persist to DB (เคารพขอบเขตห้องย่อยที่เลือก)
  const handleAutoCalculateFromAttendance = () => {
    if (sectionScopedStudents.length === 0) return;
    setCustomAbsentDeduct(absentDeduction);
    setCustomLateDeduct(lateDeduction);
    setShowCalcModal(true);
  };

  const executeAutoCalculate = () => {
    if (sectionScopedStudents.length === 0) return;

    // Persist customized deduction rates to classroom settings if changed
    if (
      currentClassroom &&
      (customAbsentDeduct !== absentDeduction || customLateDeduct !== lateDeduction)
    ) {
      api.put(`/classrooms/${selectedClass}`, {
        absent_deduction_score: customAbsentDeduct,
        late_deduction_score: customLateDeduct,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['classrooms'] });
        queryClient.invalidateQueries({ queryKey: ['grades'] });
      }).catch(err => {
        console.error('Failed to update classroom deduction rates:', err);
      });
    }

    const batchScores = sectionScopedStudents.map(s => {
      const absent = s.absent_count || 0;
      const late = s.late_count || 0;
      const penalty = (absent * customAbsentDeduct) + (late * customLateDeduct);

      let autoScore: number;
      if (calcMode === 'deductFromCurrent') {
        autoScore = Math.max(0, s.affective_score - penalty);
      } else {
        autoScore = Math.max(0, maxAffectiveWeight - penalty);
      }

      return {
        student_id: s.id,
        affective_score: autoScore
      };
    });

    updateBatchScoresMutation.mutate(batchScores, {
      onSuccess: () => {
        setShowCalcModal(false);
        const targetScopeName = activeSectionGroup ? `ห้อง "${activeSectionGroup.label}" (${sectionScopedStudents.length} คน)` : `ทุกคน (${students.length} คน)`;
        toast.success(
          calcMode === 'deductFromCurrent'
            ? `คำนวณหักคะแนนตามสถิติ ขาด (หัก ${customAbsentDeduct}) / สาย (หัก ${customLateDeduct}) เพิ่มเติมจากคะแนนปัจจุบันสำหรับ${targetScopeName} เรียบร้อยแล้ว!`
            : `คำนวณหักคะแนนตามสถิติ ขาด (หัก ${customAbsentDeduct}) / สาย (หัก ${customLateDeduct}) จากคะแนนเต็มสำหรับ${targetScopeName} เรียบร้อยแล้ว!`,
          { icon: '⚡' }
        );
      }
    });
  };

  // Filtering and sorting logic
  const processedStudents = useMemo(() => {
    let result = [...sectionScopedStudents];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.student_code && s.student_code.toLowerCase().includes(q)) ||
        (s.grade_level && s.grade_level.toLowerCase().includes(q)) ||
        (s.branch && s.branch.toLowerCase().includes(q))
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
  }, [sectionScopedStudents, search, sortBy]);

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

  const selectedClassData = useMemo(() => {
    return classrooms.find(c => String(c.id) === String(selectedClass)) || null;
  }, [classrooms, selectedClass]);

  const activeParsed = useMemo(() => {
    return selectedClassData ? parseClassroomName(selectedClassData.name) : null;
  }, [selectedClassData]);

  if (loadingClassrooms) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">


      {/* Active Classroom Bar (เมื่อเลือกห้องแล้ว) */}
      {selectedClass && selectedClassData && activeParsed && (
        <div className="glass p-5 sm:p-6 rounded-3xl border border-pink-100/90 bg-white/95 shadow-xl shadow-pink-100/20 space-y-4">
          {/* Top Row: Course Info & Quick Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/25 shrink-0">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeParsed.code && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs">
                      {activeParsed.code}
                    </span>
                  )}
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${activeParsed.curriculumType === 'pvs'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-pink-50 text-pink-700 border-pink-200'
                    }`}>
                    {activeParsed.curriculumType === 'pvs' ? 'ปวส.' : 'ปวช.'}
                  </span>
                  {activeParsed.groupName && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                      {activeParsed.groupName}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-500 ml-1">
                    (👥 {selectedClassData.student_count || students.length || 0} คน)
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-slate-800 leading-tight mt-1 truncate" title={activeParsed.subjectTitle}>
                  {activeParsed.subjectTitle}
                </h2>
              </div>
            </div>

            {/* Quick Switch / เปลี่ยนห้อง */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="form-input text-xs font-bold py-2 pl-3 pr-8 bg-white/90 hover:bg-white border-slate-200 rounded-xl focus:border-pink-400 focus:ring focus:ring-pink-200/50 transition-all text-slate-700 cursor-pointer shadow-xs max-w-[200px] sm:max-w-[260px] truncate"
                  title="สลับห้องเรียนเร็ว"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass('')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-pink-50/80 hover:bg-pink-100 text-pink-700 border border-pink-200/70 transition-all shadow-xs cursor-pointer shrink-0"
                title="ย้อนกลับไปดูการ์ดห้องเรียนทั้งหมด"
              >
                <Grid className="w-3.5 h-3.5 text-pink-600" />
                <span>การ์ดทั้งหมด</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100/90" />

          {/* Action buttons Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setCustomWeightInput(maxAffectiveWeight);
                  setResetStudentsToNew(false);
                  setShowWeightModal(true);
                }}
                disabled={loadingStudents || updateClassroomWeightMutation.isPending}
                className="btn bg-white hover:bg-pink-50/60 text-slate-700 hover:text-pink-700 border border-slate-200 hover:border-pink-200 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                title="ตั้งค่าคะแนนเต็มจิตพิสัยของห้องเรียนนี้"
              >
                <Sliders className="w-4 h-4 text-pink-600" />
                <span>กำหนดคะแนนเต็ม</span>
              </button>

              <button
                onClick={handleAutoCalculateFromAttendance}
                disabled={loadingStudents || updateBatchScoresMutation.isPending || sectionScopedStudents.length === 0}
                className="btn bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                title="คำนวณหักคะแนนจิตพิสัยตามสถิติ ขาด (หัก 2) / สาย (หัก 1) แล้วบันทึกลงฐานข้อมูล"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Zap className="w-4 h-4 text-amber-600" />}
                <span>คำนวณตามประวัติเข้าเรียน</span>
              </button>

              <button
                onClick={handleResetAllToMax}
                disabled={loadingStudents || updateBatchScoresMutation.isPending || sectionScopedStudents.length === 0}
                className="btn bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200/80 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                title="รีเซ็ตคะแนนจิตพิสัยเป็นคะแนนเต็มห้อง"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-pink-600" /> : <RotateCcw className="w-4 h-4 text-pink-600" />}
                <span>{activeSectionGroup ? `ให้คะแนนเต็มห้องนี้ (${maxAffectiveWeight})` : `ให้คะแนนเต็มทุกคน (${maxAffectiveWeight})`}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold text-slate-500">
              <span className="bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-slate-600 flex items-center gap-1.5 shadow-2xs">
                <span>คะแนนเต็ม:</span>
                <strong className="text-pink-600 font-extrabold">{maxAffectiveWeight}</strong>
                <span className="text-slate-400">คะแนน</span>
              </span>
            </div>
          </div>

          {/* Sub-room / Section Switcher Bar */}
          {hasMultipleSections && (
            <>
              <div className="border-t border-slate-100/90" />
              <div className="pt-0.5">
                <SectionSwitcher
                  sectionGroups={sectionGroups}
                  selectedSectionKey={selectedSectionKey}
                  onSelectSection={setSelectedSectionKey}
                  totalStudentsCount={students.length}
                  sharedBranch={sharedBranch}
                  themeColor="pink"
                  label="แยกห้องจิตพิสัย:"
                  rightContent={
                    activeSectionGroup ? (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        กำลังจัดการห้อง: <span className="text-pink-700 font-extrabold bg-pink-50 px-2.5 py-0.5 rounded-lg border border-pink-200/70">{activeSectionGroup.label}</span>
                        <span className="text-slate-400">({activeSectionGroup.students.length} คน)</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        (แสดงนักเรียนทุกห้องย่อยรวมกัน)
                      </span>
                    )
                  }
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Classroom Card Picker (เมื่อยังไม่ได้เลือกห้องเรียน) */}
      {!selectedClass ? (
        <ClassroomCardPicker
          classrooms={classrooms}
          onSelect={setSelectedClass}
          title="เลือกห้องเรียนเพื่อจัดการจิตพิสัย"
          subtitle=""
          icon={<HeartHandshake className="w-6 h-6" />}
          themeColor="pink"
          actionText="เริ่มให้คะแนนจิตพิสัย"
          customCardStat={(c) => (
            <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-pink-700 font-semibold">
              <span>คะแนนจิตพิสัยเต็ม</span>
              <span>{c.affective_weight || 20} คะแนน</span>
            </div>
          )}
        />
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
                className="form-input pl-10 text-xs bg-white border-pink-100 rounded-xl focus:border-pink-500 shadow-2xs w-full"
                placeholder="ค้นหาชื่อ, รหัส หรือห้องย่อย..."
                id="affective-search"
                aria-label="ค้นหารหัสนักเรียน หรือชื่อ"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                แสดง <strong className="text-pink-700 font-extrabold">{processedStudents.length}</strong> จาก {sectionScopedStudents.length} คน
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'name' | 'score-desc' | 'score-asc')}
                className="form-input text-xs w-48 py-2 bg-white border-slate-200 rounded-xl shadow-2xs font-medium cursor-pointer"
                aria-label="เรียงลำดับรายการ"
              >
                <option value="name">เรียงตาม: ชื่อนักเรียน</option>
                <option value="score-desc">เรียงตาม: คะแนนจิตพิสัย (สูง-ต่ำ)</option>
                <option value="score-asc">เรียงตาม: คะแนนจิตพิสัย (ต่ำ-สูง)</option>
              </select>
            </div>
          </div>

          {/* Student Grid */}
          {processedStudents.length === 0 ? (
            <div className="glass p-10 text-center text-slate-500 rounded-2xl border border-indigo-100 bg-white">
              ไม่พบนักเรียนตรงตามเงื่อนไขค้นหา
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {processedStudents.map((s) => {
                const absent = s.absent_count || 0;
                const late = s.late_count || 0;
                const attendancePenalty = (absent * absentDeduction) + (late * lateDeduction);
                const scorePercent = maxAffectiveWeight > 0 ? (s.affective_score / maxAffectiveWeight) * 100 : 0;
                const isUpdating = updatingStudentIds[s.id];

                return (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-slate-900 overflow-hidden rounded-2xl transition-colors duration-150 p-5 border flex flex-col md:flex-row gap-4 shadow-xs dark:border-slate-800 ${s.affective_score < (maxAffectiveWeight * 0.5)
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-indigo-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50'
                      }`}
                  >
                    {/* Left Side: Avatar, Name and Attendance Stats */}
                    <div className="flex flex-row md:flex-col items-center gap-3 shrink-0 md:w-36 text-center md:border-r border-indigo-100/70 dark:border-slate-800 md:pr-3">
                      {/* Avatar */}
                      <UserAvatar
                        avatar={s.avatar}
                        name={s.name}
                        userId={s.id}
                        size="lg"
                        className="rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm shrink-0"
                      />

                      <div className="flex-1 md:flex-none text-left md:text-center min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{s.name}</p>
                        <div className="flex items-center gap-1 justify-start md:justify-center flex-wrap mt-0.5">
                          {s.student_code && <span className="text-[10px] text-slate-500 dark:text-slate-400">รหัส: {s.student_code}</span>}
                          {s.grade_level && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                              {s.grade_level}
                            </span>
                          )}
                        </div>

                        {/* Attendance Badges */}
                        <div className="flex items-center gap-1.5 md:justify-center mt-1 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${absent > 0 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            ขาด {absent}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${late > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            สาย {late}
                          </span>
                        </div>
                        {attendancePenalty > 0 && (
                          <p className="text-[9px] text-rose-500 dark:text-rose-400 font-semibold mt-1">หักเวลาเรียน -{attendancePenalty} คะแนน</p>
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
                            className="w-8 h-8 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
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
                                className="form-input text-center font-black text-lg py-0.5 px-1 w-16 h-8 bg-indigo-50/50 dark:bg-slate-800 border-indigo-200 dark:border-slate-700 text-indigo-900 dark:text-indigo-200 rounded-lg"
                                min="0"
                                max={maxAffectiveWeight}
                                aria-label="คะแนนจิตพิสัยนักเรียนคนนี้"
                              />
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">/ {maxAffectiveWeight}</span>
                          </div>

                          <button
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, 1, 'บวก 1 คะแนน')}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
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
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${scorePercent >= 80 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                        />
                      </div>

                      {/* Behavior Presets Buttons */}
                      <div className="space-y-1.5 pt-1">
                        {/* Positive Presets */}
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5 mr-1">
                            <ThumbsUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> ชมเชย:
                          </span>
                          {positivePresets.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                              disabled={isUpdating}
                              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                            >
                              <span>{p.icon}</span>
                              <span>{p.label} (+{p.value})</span>
                            </button>
                          ))}
                        </div>

                        {/* Negative Presets */}
                        <div className="flex flex-wrap gap-1 items-center pt-0.5">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5 mr-1">
                            <ThumbsDown className="w-3 h-3 text-rose-600 dark:text-rose-400" /> ตักเตือน:
                          </span>
                          {negativePresets.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleScoreAdjust(s.id, s.affective_score, p.value, p.label)}
                              disabled={isUpdating}
                              className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
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
          )}
        </div>
      )}

      {/* ================= CALCULATION MODAL ================= */}
      {showCalcModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowCalcModal(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">คำนวณคะแนนจิตพิสัยตามประวัติเข้าเรียน</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    หักคะแนนตามสถิติ ขาด (หัก {customAbsentDeduct} คะแนน) / สาย (หัก {customLateDeduct} คะแนน)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCalcModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Configurable Penalty Formula */}
            <div className="mb-4 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-900">กำหนดสูตรหักคะแนนสำหรับห้องนี้</span>
                <span className="text-[10px] text-amber-700 font-semibold">(บันทึกลงห้องเรียนอัตโนมัติ)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    ขาด 1 ครั้ง หัก (คะแนน)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={customAbsentDeduct}
                    onChange={e => setCustomAbsentDeduct(parseFloat(e.target.value) || 0)}
                    className="form-input text-xs font-bold text-center py-1.5 rounded-xl border-amber-300 bg-white focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    สาย 1 ครั้ง หัก (คะแนน)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={customLateDeduct}
                    onChange={e => setCustomLateDeduct(parseFloat(e.target.value) || 0)}
                    className="form-input text-xs font-bold text-center py-1.5 rounded-xl border-amber-300 bg-white focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Mode Options */}
            <div className="space-y-3 mb-6">
              {/* Option 1: Deduct from current (Default) */}
              <label
                onClick={() => setCalcMode('deductFromCurrent')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${calcMode === 'deductFromCurrent'
                  ? 'bg-amber-50/80 border-amber-500/80 shadow-md shadow-amber-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                <input
                  type="radio"
                  name="calcMode"
                  checked={calcMode === 'deductFromCurrent'}
                  onChange={() => setCalcMode('deductFromCurrent')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800">หักลบเพิ่มจากคะแนนปัจจุบัน</span>
                    <span className="text-[10px] font-bold bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full">แนะนำ (ไม่ลบคะแนนที่หักเอง)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    นำโทษขาด/สาย หักลบเพิ่มเติมจากคะแนนจิตพิสัยเดิมที่ครูเคยบวกหรือหักไว้ (คะแนนพฤติกรรมที่ครูหักไว้แล้วจะไม่หายไป)
                  </p>
                  <div className="text-[11px] text-amber-800 font-semibold bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/60 mt-2">
                    💡 ตัวอย่าง: คะแนนพฤติกรรมเดิม 17 + ขาด 1 ครั้ง (หัก {customAbsentDeduct}) ➔ คะแนนใหม่จะเท่ากับ <span className="font-bold text-amber-900">{Math.max(0, 17 - customAbsentDeduct)} คะแนน</span>
                  </div>
                </div>
              </label>

              {/* Option 2: Reset from max */}
              <label
                onClick={() => setCalcMode('resetFromMax')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${calcMode === 'resetFromMax'
                  ? 'bg-indigo-50/80 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                <input
                  type="radio"
                  name="calcMode"
                  checked={calcMode === 'resetFromMax'}
                  onChange={() => setCalcMode('resetFromMax')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="space-y-1">
                  <span className="font-extrabold text-sm text-slate-800">คำนวณใหม่จากคะแนนเต็ม ({maxAffectiveWeight})</span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    คำนวณคะแนนใหม่จากคะแนนเต็มโดยตรง ({maxAffectiveWeight} - โทษขาดสาย) โดยล้างการหักคะแนนพฤติกรรมเดิมทั้งหมด
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCalcModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeAutoCalculate}
                disabled={updateBatchScoresMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>ยืนยันการคำนวณ</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MAX SCORE MODAL ================= */}
      {showWeightModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowWeightModal(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-scale-up" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">กำหนดคะแนนเต็มจิตพิสัย</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ห้อง: {activeParsed?.subjectTitle || selectedClassData?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowWeightModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Input & Presets */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  คะแนนเต็มจิตพิสัย (1 - 100 คะแนน)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={customWeightInput}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setCustomWeightInput(isNaN(val) ? 0 : val);
                    }}
                    className="form-input text-lg font-black text-pink-700 py-2 px-3.5 rounded-xl border-slate-200 focus:border-pink-500 focus:ring-pink-200 w-full"
                    autoFocus
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">คะแนน</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">คะแนนยอดนิยม:</div>
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 20, 25, 30].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomWeightInput(val)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${customWeightInput === val
                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                    >
                      {val} คะแนน
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset students option */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-pink-50/50 border border-pink-100 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetStudentsToNew}
                  onChange={e => setResetStudentsToNew(e.target.checked)}
                  className="mt-0.5 text-pink-600 rounded focus:ring-pink-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">ปรับคะแนนนักเรียนทุกคนเป็นคะแนนเต็มใหม่ ({customWeightInput || 0}) ทันที</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    (หากไม่เลือก ระบบจะคงคะแนนปัจจุบันของนักเรียนไว้)
                  </p>
                </div>
              </label>

              {/* Note */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                💡 <span className="font-bold text-slate-700">หมายเหตุ:</span> คะแนนเต็มจิตพิสัยนี้จะเชื่อมโยงกับน้ำหนักคะแนนจิตพิสัยในหน้า <span className="font-bold text-pink-700">ตัดเกรด</span> ของห้องนี้ด้วย
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowWeightModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  if (!customWeightInput || customWeightInput < 1 || customWeightInput > 100) {
                    toast.error('กรุณาระบุคะแนนระหว่าง 1 ถึง 100');
                    return;
                  }
                  updateClassroomWeightMutation.mutate({
                    weight: customWeightInput,
                    resetAll: resetStudentsToNew,
                  });
                }}
                disabled={updateClassroomWeightMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                {updateClassroomWeightMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>บันทึกคะแนนเต็ม</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

