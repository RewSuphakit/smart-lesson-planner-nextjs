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

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
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

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¸ªà¸–à¸´à¸•à¸´à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡ â”€â”€â”€
  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['affective-students', selectedClass, maxAffectiveWeight, absentDeduction, lateDeduction],
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

  // â”€â”€â”€ Sub-room / Section Grouping (à¹à¸¢à¸à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸£à¸µà¸¢à¸™à¸£à¸§à¸¡ à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1 + à¸›à¸§à¸Š.1/2) â”€â”€â”€
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

  // â”€â”€â”€ Class Analytics Summary (à¸„à¸³à¸™à¸§à¸“à¸•à¸²à¸¡à¸‚à¸­à¸šà¹€à¸‚à¸•à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸) â”€â”€â”€
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

  // â”€â”€â”€ Mutation: à¸­à¸±à¸›à¹€à¸”à¸•à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸£à¸²à¸¢à¸„à¸™ â”€â”€â”€
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
      toast.error('à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ');
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

  // â”€â”€â”€ Mutation: à¸­à¸±à¸›à¹€à¸”à¸•à¸„à¸°à¹à¸™à¸™à¸—à¸±à¹‰à¸‡à¸«à¹‰à¸­à¸‡ â”€â”€â”€
  const updateBatchScoresMutation = useMutation({
    mutationFn: async (batchScores: { student_id: string | number; affective_score: number }[]) => {
      return api.put('/students/exams?type=behavior', { scores: batchScores });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affective-students', selectedClass, maxAffectiveWeight] });
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
    onError: () => {
      toast.error('à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¸à¸¥à¸¸à¹ˆà¸¡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸­à¸±à¸›à¹€à¸”à¸•à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸‚à¸­à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
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
      toast.success(`à¸à¸³à¸«à¸™à¸”à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹€à¸›à¹‡à¸™ ${variables.weight} à¸„à¸°à¹à¸™à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§`, { icon: 'ðŸŽ¯' });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¸±à¸›à¹€à¸”à¸•à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¹„à¸”à¹‰');
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
        toast.error('à¸„à¸°à¹à¸™à¸™à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸•à¹ˆà¸³à¸à¸§à¹ˆà¸² 0 à¹„à¸”à¹‰');
      } else {
        toast.error(`à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ªà¸¹à¸‡à¸ªà¸¸à¸”à¸—à¸µà¹ˆ ${maxAffectiveWeight} à¸„à¸°à¹à¸™à¸™à¹à¸¥à¹‰à¸§`);
      }
      return;
    }

    updateStudentScore(studentId, clamped);

    if (presetLabel) {
      if (amount > 0) {
        toast.success(`à¸šà¸§à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢: ${presetLabel} (+${amount})`, { icon: 'âœ¨', duration: 1800 });
      } else {
        toast.error(`à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢: ${presetLabel} (${amount})`, { icon: 'âš ï¸', duration: 1800 });
      }
    }
  };

  // Global Action: Set all students to max score (à¹€à¸„à¸²à¸£à¸žà¸‚à¸­à¸šà¹€à¸‚à¸•à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸)
  const handleResetAllToMax = () => {
    if (sectionScopedStudents.length === 0) return;
    const targetScopeName = activeSectionGroup ? `à¸«à¹‰à¸­à¸‡ "${activeSectionGroup.label}" (${sectionScopedStudents.length} à¸„à¸™)` : `à¸—à¸¸à¸à¸„à¸™ (${students.length} à¸„à¸™)`;
    if (!window.confirm(`à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™${targetScopeName} à¹€à¸›à¹‡à¸™à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡ (${maxAffectiveWeight} à¸„à¸°à¹à¸™à¸™) à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?`)) return;

    const batchScores = sectionScopedStudents.map(s => ({
      student_id: s.id,
      affective_score: maxAffectiveWeight
    }));

    updateBatchScoresMutation.mutate(batchScores, {
      onSuccess: () => {
        toast.success(`à¸£à¸µà¹€à¸‹à¹‡à¸•à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢${targetScopeName}à¹€à¸›à¹‡à¸™ ${maxAffectiveWeight} à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§`, { icon: 'ðŸ”„' });
      }
    });
  };

  // Global Action: Calculate from attendance statistics & persist to DB (à¹€à¸„à¸²à¸£à¸žà¸‚à¸­à¸šà¹€à¸‚à¸•à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸)
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
        const targetScopeName = activeSectionGroup ? `à¸«à¹‰à¸­à¸‡ "${activeSectionGroup.label}" (${sectionScopedStudents.length} à¸„à¸™)` : `à¸—à¸¸à¸à¸„à¸™ (${students.length} à¸„à¸™)`;
        toast.success(
          calcMode === 'deductFromCurrent'
            ? `à¸„à¸³à¸™à¸§à¸“à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸•à¸²à¸¡à¸ªà¸–à¸´à¸•à¸´ à¸‚à¸²à¸” (à¸«à¸±à¸ ${customAbsentDeduct}) / à¸ªà¸²à¸¢ (à¸«à¸±à¸ ${customLateDeduct}) à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸ªà¸³à¸«à¸£à¸±à¸š${targetScopeName} à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§!`
            : `à¸„à¸³à¸™à¸§à¸“à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸•à¸²à¸¡à¸ªà¸–à¸´à¸•à¸´ à¸‚à¸²à¸” (à¸«à¸±à¸ ${customAbsentDeduct}) / à¸ªà¸²à¸¢ (à¸«à¸±à¸ ${customLateDeduct}) à¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ªà¸³à¸«à¸£à¸±à¸š${targetScopeName} à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§!`,
          { icon: 'âš¡' }
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
    { label: 'à¸•à¸±à¹‰à¸‡à¹ƒà¸ˆà¹€à¸£à¸µà¸¢à¸™', value: 1, icon: 'ðŸŒŸ' },
    { label: 'à¸•à¸­à¸šà¸„à¸³à¸–à¸²à¸¡', value: 1, icon: 'ðŸ™‹' },
    { label: 'à¸Šà¹ˆà¸§à¸¢à¹€à¸«à¸¥à¸·à¸­à¸„à¸£à¸¹/à¹€à¸žà¸·à¹ˆà¸­à¸™', value: 2, icon: 'ðŸ¤' },
  ];

  const negativePresets = [
    { label: 'à¸„à¸¸à¸¢à¹€à¸ªà¸µà¸¢à¸‡à¸”à¸±à¸‡', value: -1, icon: 'ðŸ¤«' },
    { label: 'à¹€à¸¥à¹ˆà¸™à¹‚à¸—à¸£à¸¨à¸±à¸žà¸—à¹Œ', value: -2, icon: 'ðŸ“±' },
    { label: 'à¹€à¸¥à¹ˆà¸™à¹€à¸à¸¡', value: -2, icon: 'ðŸŽ®' },
    { label: 'à¹„à¸¡à¹ˆà¸—à¸³à¸‡à¸²à¸™', value: -2, icon: 'ðŸ“„' },
    { label: 'à¸à¹ˆà¸­à¸à¸§à¸™', value: -3, icon: 'âš ï¸' },
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


      {/* Active Classroom Bar (à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸¥à¸·à¸­à¸à¸«à¹‰à¸­à¸‡à¹à¸¥à¹‰à¸§) */}
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
                    {activeParsed.curriculumType === 'pvs' ? 'à¸›à¸§à¸ª.' : 'à¸›à¸§à¸Š.'}
                  </span>
                  {activeParsed.groupName && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                      {activeParsed.groupName}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-500 ml-1">
                    (ðŸ‘¥ {selectedClassData.student_count || students.length || 0} à¸„à¸™)
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-slate-800 leading-tight mt-1 truncate" title={activeParsed.subjectTitle}>
                  {activeParsed.subjectTitle}
                </h2>
              </div>
            </div>

            {/* Quick Switch / à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸«à¹‰à¸­à¸‡ */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="form-input text-xs font-bold py-2 pl-3 pr-8 bg-white/90 hover:bg-white border-slate-200 rounded-xl focus:border-pink-400 focus:ring focus:ring-pink-200/50 transition-all text-slate-700 cursor-pointer shadow-xs max-w-[200px] sm:max-w-[260px] truncate"
                  title="à¸ªà¸¥à¸±à¸šà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¹‡à¸§"
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
                title="à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹„à¸›à¸”à¸¹à¸à¸²à¸£à¹Œà¸”à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”"
              >
                <Grid className="w-3.5 h-3.5 text-pink-600" />
                <span>à¸à¸²à¸£à¹Œà¸”à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</span>
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
                title="à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸‚à¸­à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰"
              >
                <Sliders className="w-4 h-4 text-pink-600" />
                <span>à¸à¸³à¸«à¸™à¸”à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡</span>
              </button>

              <button
                onClick={handleAutoCalculateFromAttendance}
                disabled={loadingStudents || updateBatchScoresMutation.isPending || sectionScopedStudents.length === 0}
                className="btn bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                title="à¸„à¸³à¸™à¸§à¸“à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸•à¸²à¸¡à¸ªà¸–à¸´à¸•à¸´ à¸‚à¸²à¸” (à¸«à¸±à¸ 2) / à¸ªà¸²à¸¢ (à¸«à¸±à¸ 1) à¹à¸¥à¹‰à¸§à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡à¸à¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Zap className="w-4 h-4 text-amber-600" />}
                <span>à¸„à¸³à¸™à¸§à¸“à¸•à¸²à¸¡à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹€à¸‚à¹‰à¸²à¹€à¸£à¸µà¸¢à¸™</span>
              </button>

              <button
                onClick={handleResetAllToMax}
                disabled={loadingStudents || updateBatchScoresMutation.isPending || sectionScopedStudents.length === 0}
                className="btn bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200/80 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                title="à¸£à¸µà¹€à¸‹à¹‡à¸•à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹€à¸›à¹‡à¸™à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸«à¹‰à¸­à¸‡"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-pink-600" /> : <RotateCcw className="w-4 h-4 text-pink-600" />}
                <span>{activeSectionGroup ? `à¹ƒà¸«à¹‰à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸«à¹‰à¸­à¸‡à¸™à¸µà¹‰ (${maxAffectiveWeight})` : `à¹ƒà¸«à¹‰à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸—à¸¸à¸à¸„à¸™ (${maxAffectiveWeight})`}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold text-slate-500">
              <span className="bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-slate-600 flex items-center gap-1.5 shadow-2xs">
                <span>à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡:</span>
                <strong className="text-pink-600 font-extrabold">{maxAffectiveWeight}</strong>
                <span className="text-slate-400">à¸„à¸°à¹à¸™à¸™</span>
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
                  label="à¹à¸¢à¸à¸«à¹‰à¸­à¸‡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢:"
                  rightContent={
                    activeSectionGroup ? (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        à¸à¸³à¸¥à¸±à¸‡à¸ˆà¸±à¸”à¸à¸²à¸£à¸«à¹‰à¸­à¸‡: <span className="text-pink-700 font-extrabold bg-pink-50 px-2.5 py-0.5 rounded-lg border border-pink-200/70">{activeSectionGroup.label}</span>
                        <span className="text-slate-400">({activeSectionGroup.students.length} à¸„à¸™)</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        (à¹à¸ªà¸”à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸¸à¸à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¸£à¸§à¸¡à¸à¸±à¸™)
                      </span>
                    )
                  }
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Classroom Card Picker (à¹€à¸¡à¸·à¹ˆà¸­à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸¥à¸·à¸­à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™) */}
      {!selectedClass ? (
        <ClassroomCardPicker
          classrooms={classrooms}
          onSelect={setSelectedClass}
          title="à¹€à¸¥à¸·à¸­à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸žà¸·à¹ˆà¸­à¸ˆà¸±à¸”à¸à¸²à¸£à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢"
          subtitle=""
          icon={<HeartHandshake className="w-6 h-6" />}
          themeColor="pink"
          actionText="à¹€à¸£à¸´à¹ˆà¸¡à¹ƒà¸«à¹‰à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢"
          customCardStat={(c) => (
            <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-pink-700 font-semibold">
              <span>à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹€à¸•à¹‡à¸¡</span>
              <span>{c.affective_weight || 20} à¸„à¸°à¹à¸™à¸™</span>
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
          <p className="text-slate-700 font-bold">à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸™à¸µà¹‰</p>
          <p className="text-slate-500 text-xs mt-1">à¸à¸£à¸¸à¸“à¸²à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™à¹€à¸¡à¸™à¸¹à¸«à¸¥à¸±à¸ &ldquo;à¸ˆà¸±à¸”à¸à¸²à¸£à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™&rdquo; à¸à¹ˆà¸­à¸™</p>
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
                <p className="text-xs font-semibold text-slate-500">à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹€à¸‰à¸¥à¸µà¹ˆà¸¢</p>
                <div className="text-2xl font-black text-pink-700">{analytics.mean} <span className="text-xs font-semibold text-slate-500">/ {maxAffectiveWeight}</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¸”à¸µà¹€à¸¢à¸µà¹ˆà¸¢à¸¡ (â‰¥ 80%)</p>
                <div className="text-2xl font-black text-emerald-700">{analytics.highConductCount} <span className="text-xs font-semibold text-slate-500">à¸„à¸™</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-rose-50/80 to-amber-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">à¸à¸¥à¸¸à¹ˆà¸¡à¸•à¹‰à¸­à¸‡à¸•à¸´à¸”à¸•à¸²à¸¡ (&lt; 50%)</p>
                <div className="text-2xl font-black text-rose-700">{analytics.atRiskCount} <span className="text-xs font-semibold text-slate-500">à¸„à¸™</span></div>
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
                placeholder="à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­, à¸£à¸«à¸±à¸ª à¸«à¸£à¸·à¸­à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢..."
                id="affective-search"
                aria-label="à¸„à¹‰à¸™à¸«à¸²à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ à¸«à¸£à¸·à¸­à¸Šà¸·à¹ˆà¸­"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                à¹à¸ªà¸”à¸‡ <strong className="text-pink-700 font-extrabold">{processedStudents.length}</strong> à¸ˆà¸²à¸ {sectionScopedStudents.length} à¸„à¸™
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'name' | 'score-desc' | 'score-asc')}
                className="form-input text-xs w-48 py-2 bg-white border-slate-200 rounded-xl shadow-2xs font-medium cursor-pointer"
                aria-label="à¹€à¸£à¸µà¸¢à¸‡à¸¥à¸³à¸”à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£"
              >
                <option value="name">à¹€à¸£à¸µà¸¢à¸‡à¸•à¸²à¸¡: à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</option>
                <option value="score-desc">à¹€à¸£à¸µà¸¢à¸‡à¸•à¸²à¸¡: à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (à¸ªà¸¹à¸‡-à¸•à¹ˆà¸³)</option>
                <option value="score-asc">à¹€à¸£à¸µà¸¢à¸‡à¸•à¸²à¸¡: à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (à¸•à¹ˆà¸³-à¸ªà¸¹à¸‡)</option>
              </select>
            </div>
          </div>

          {/* Student Grid */}
          {processedStudents.length === 0 ? (
            <div className="glass p-10 text-center text-slate-500 rounded-2xl border border-indigo-100 bg-white">
              à¹„à¸¡à¹ˆà¸žà¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸•à¸£à¸‡à¸•à¸²à¸¡à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸„à¹‰à¸™à¸«à¸²
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {processedStudents.map((s) => {
                const absent = s.absent_count || 0;
                const late = s.late_count || 0;
                const attendancePenalty = (absent * 2) + (late * 1);
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
                          {s.student_code && <span className="text-[10px] text-slate-500 dark:text-slate-400">à¸£à¸«à¸±à¸ª: {s.student_code}</span>}
                          {s.grade_level && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                              {s.grade_level}
                            </span>
                          )}
                        </div>

                        {/* Attendance Badges */}
                        <div className="flex items-center gap-1.5 md:justify-center mt-1 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${absent > 0 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            à¸‚à¸²à¸” {absent}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${late > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            à¸ªà¸²à¸¢ {late}
                          </span>
                        </div>
                        {attendancePenalty > 0 && (
                          <p className="text-[9px] text-rose-500 dark:text-rose-400 font-semibold mt-1">à¸«à¸±à¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸µà¸¢à¸™ -{attendancePenalty} à¸„à¸°à¹à¸™à¸™</p>
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
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, -1, 'à¸¥à¸š 1 à¸„à¸°à¹à¸™à¸™')}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                            title="à¸«à¸±à¸ 1 à¸„à¸°à¹à¸™à¸™"
                            aria-label="à¸«à¸±à¸ 1 à¸„à¸°à¹à¸™à¸™"
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
                                aria-label="à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸„à¸™à¸™à¸µà¹‰"
                              />
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">/ {maxAffectiveWeight}</span>
                          </div>

                          <button
                            onClick={() => handleScoreAdjust(s.id, s.affective_score, 1, 'à¸šà¸§à¸ 1 à¸„à¸°à¹à¸™à¸™')}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40"
                            title="à¸šà¸§à¸ 1 à¸„à¸°à¹à¸™à¸™"
                            aria-label="à¸šà¸§à¸ 1 à¸„à¸°à¹à¸™à¸™"
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
                            <ThumbsUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> à¸Šà¸¡à¹€à¸Šà¸¢:
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
                            <ThumbsDown className="w-3 h-3 text-rose-600 dark:text-rose-400" /> à¸•à¸±à¸à¹€à¸•à¸·à¸­à¸™:
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
                  <h3 className="font-extrabold text-slate-800 text-base">à¸„à¸³à¸™à¸§à¸“à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸•à¸²à¸¡à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹€à¸‚à¹‰à¸²à¹€à¸£à¸µà¸¢à¸™</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸•à¸²à¸¡à¸ªà¸–à¸´à¸•à¸´ à¸‚à¸²à¸” (à¸«à¸±à¸ {customAbsentDeduct} à¸„à¸°à¹à¸™à¸™) / à¸ªà¸²à¸¢ (à¸«à¸±à¸ {customLateDeduct} à¸„à¸°à¹à¸™à¸™)
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
                <span className="text-xs font-bold text-amber-900">à¸à¸³à¸«à¸™à¸”à¸ªà¸¹à¸•à¸£à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸«à¹‰à¸­à¸‡à¸™à¸µà¹‰</span>
                <span className="text-[10px] text-amber-700 font-semibold">(à¸šà¸±à¸™à¸—à¸¶à¸à¸¥à¸‡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                    à¸‚à¸²à¸” 1 à¸„à¸£à¸±à¹‰à¸‡ à¸«à¸±à¸ (à¸„à¸°à¹à¸™à¸™)
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
                    à¸ªà¸²à¸¢ 1 à¸„à¸£à¸±à¹‰à¸‡ à¸«à¸±à¸ (à¸„à¸°à¹à¸™à¸™)
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
                    <span className="font-extrabold text-sm text-slate-800">à¸«à¸±à¸à¸¥à¸šà¹€à¸žà¸´à¹ˆà¸¡à¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</span>
                    <span className="text-[10px] font-bold bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full">à¹à¸™à¸°à¸™à¸³ (à¹„à¸¡à¹ˆà¸¥à¸šà¸„à¸°à¹à¸™à¸™à¸—à¸µà¹ˆà¸«à¸±à¸à¹€à¸­à¸‡)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    à¸™à¸³à¹‚à¸—à¸©à¸‚à¸²à¸”/à¸ªà¸²à¸¢ à¸«à¸±à¸à¸¥à¸šà¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹€à¸”à¸´à¸¡à¸—à¸µà¹ˆà¸„à¸£à¸¹à¹€à¸„à¸¢à¸šà¸§à¸à¸«à¸£à¸·à¸­à¸«à¸±à¸à¹„à¸§à¹‰ (à¸„à¸°à¹à¸™à¸™à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¸—à¸µà¹ˆà¸„à¸£à¸¹à¸«à¸±à¸à¹„à¸§à¹‰à¹à¸¥à¹‰à¸§à¸ˆà¸°à¹„à¸¡à¹ˆà¸«à¸²à¸¢à¹„à¸›)
                  </p>
                  <div className="text-[11px] text-amber-800 font-semibold bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/60 mt-2">
                    ðŸ’¡ à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡: à¸„à¸°à¹à¸™à¸™à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¹€à¸”à¸´à¸¡ 17 + à¸‚à¸²à¸” 1 à¸„à¸£à¸±à¹‰à¸‡ (à¸«à¸±à¸ {customAbsentDeduct}) âž” à¸„à¸°à¹à¸™à¸™à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸°à¹€à¸—à¹ˆà¸²à¸à¸±à¸š <span className="font-bold text-amber-900">{Math.max(0, 17 - customAbsentDeduct)} à¸„à¸°à¹à¸™à¸™</span>
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
                  <span className="font-extrabold text-sm text-slate-800">à¸„à¸³à¸™à¸§à¸“à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡ ({maxAffectiveWeight})</span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    à¸„à¸³à¸™à¸§à¸“à¸„à¸°à¹à¸™à¸™à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¹‚à¸”à¸¢à¸•à¸£à¸‡ ({maxAffectiveWeight} - à¹‚à¸—à¸©à¸‚à¸²à¸”à¸ªà¸²à¸¢) à¹‚à¸”à¸¢à¸¥à¹‰à¸²à¸‡à¸à¸²à¸£à¸«à¸±à¸à¸„à¸°à¹à¸™à¸™à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¹€à¸”à¸´à¸¡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”
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
                à¸¢à¸à¹€à¸¥à¸´à¸
              </button>
              <button
                onClick={executeAutoCalculate}
                disabled={updateBatchScoresMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all"
              >
                {updateBatchScoresMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸„à¸³à¸™à¸§à¸“</span>
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
                  <h3 className="font-extrabold text-slate-800 text-base">à¸à¸³à¸«à¸™à¸”à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    à¸«à¹‰à¸­à¸‡: {activeParsed?.subjectTitle || selectedClassData?.name}
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
                  à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (1 - 100 à¸„à¸°à¹à¸™à¸™)
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
                  <span className="text-xs font-bold text-slate-500 shrink-0">à¸„à¸°à¹à¸™à¸™</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">à¸„à¸°à¹à¸™à¸™à¸¢à¸­à¸”à¸™à¸´à¸¢à¸¡:</div>
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
                      {val} à¸„à¸°à¹à¸™à¸™
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
                  <span className="font-bold text-slate-800">à¸›à¸£à¸±à¸šà¸„à¸°à¹à¸™à¸™à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸¸à¸à¸„à¸™à¹€à¸›à¹‡à¸™à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¹ƒà¸«à¸¡à¹ˆ ({customWeightInput || 0}) à¸—à¸±à¸™à¸—à¸µ</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    (à¸«à¸²à¸à¹„à¸¡à¹ˆà¹€à¸¥à¸·à¸­à¸ à¸£à¸°à¸šà¸šà¸ˆà¸°à¸„à¸‡à¸„à¸°à¹à¸™à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹„à¸§à¹‰)
                  </p>
                </div>
              </label>

              {/* Note */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                ðŸ’¡ <span className="font-bold text-slate-700">à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸:</span> à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¸™à¸µà¹‰à¸ˆà¸°à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¹‚à¸¢à¸‡à¸à¸±à¸šà¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸„à¸°à¹à¸™à¸™à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢à¹ƒà¸™à¸«à¸™à¹‰à¸² <span className="font-bold text-pink-700">à¸•à¸±à¸”à¹€à¸à¸£à¸”</span> à¸‚à¸­à¸‡à¸«à¹‰à¸­à¸‡à¸™à¸µà¹‰à¸”à¹‰à¸§à¸¢
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowWeightModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                à¸¢à¸à¹€à¸¥à¸´à¸
              </button>
              <button
                onClick={() => {
                  if (!customWeightInput || customWeightInput < 1 || customWeightInput > 100) {
                    toast.error('à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸à¸„à¸°à¹à¸™à¸™à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 1 à¸–à¸¶à¸‡ 100');
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
                <span>à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

