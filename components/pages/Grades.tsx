'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { 
  Loader2, BookOpen, Save, Settings, AlertCircle, TrendingUp, Plus, Trash2, 
  FileSpreadsheet, Printer, Zap, AlertTriangle, Search, Filter, Award, CheckCircle2, XCircle, Download,
  SlidersHorizontal, LayoutGrid, Table as TableIcon, ChevronRight, ChevronDown, Sparkles, Check, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';
import * as XLSX from 'xlsx';
import { calculateAffectiveScore } from '@/lib/affective';
import GradePdfModal from '@/components/GradePdfModal';
import GradeCsvModal from '@/components/GradeCsvModal';
import { useAuth } from '@/context/AuthContext';

export interface Classroom {
  id: string;
  name: string;
  assignment_weight?: number;
  post_test_weight?: number;
  affective_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
}

export interface Criterion {
  grade: string;
  min_score: number;
}

export interface ReportStudent {
  student_id: string;
  student_code?: string;
  name: string;
  raw_assign?: number;
  max_assign?: number;
  scaled_assign?: number;
  precise_scaled_assign?: number;
  raw_post_test?: number;
  max_post_test?: number;
  scaled_post_test?: number;
  precise_scaled_post_test?: number;
  midterm_score?: number | string;
  scaled_midterm?: number;
  precise_scaled_midterm?: number;
  final_score?: number | string;
  is_absent_final?: boolean;
  is_incomplete?: boolean;
  scaled_final?: number;
  precise_scaled_final?: number;
  affective_score?: number | string;
  is_f?: boolean;
  total_score_precise?: number;
  total_score?: number | string;
  percentage?: string;
  attendance_percent?: number;
  grade?: string;
  absent_count?: number;
  late_count?: number;
  max_allowed_absences?: number;
  remaining_absences?: number;
}

export interface Weights {
  assignment_weight: number;
  post_test_weight: number;
  affective_weight: number;
  midterm_weight: number;
  final_weight: number;
  midterm_max_score: number;
  final_max_score: number;
  target_weeks?: number;
  is_pws?: boolean;
  max_assign_raw?: number;
  max_post_test_raw?: number;
}

const animalAvatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🐢', '🦖', '🦕', '🦦', '🦥'];

export default function Grades() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [report, setReport] = useState<ReportStudent[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [weights, setWeights] = useState<Weights>({
    assignment_weight: 10,
    post_test_weight: 70,
    affective_weight: 20,
    midterm_weight: 0,
    final_weight: 0,
    midterm_max_score: 100,
    final_max_score: 100
  });
  const [showSettings, setShowSettings] = useState(false);
  const { user } = useAuth();
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState(false);

  // View Mode: 'table' vs 'cards' (optimal for mobile)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Auto & Dynamic Column Width State for "ชื่อ-นามสกุล"
  const [nameColMode, setNameColMode] = useState<'auto' | 'compact' | 'normal' | 'wide'>('auto');
  const [customWidthOffset, setCustomWidthOffset] = useState<number>(0);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Track unsaved changes for floating save button
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto detect mobile on load and set viewMode to cards if screen is very small
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('cards');
    }
  }, []);

  // Dynamic calculation for optimal Name column width based on student data
  const calculatedAutoWidth = useMemo(() => {
    if (!report || report.length === 0) return 260;
    const maxNameLen = Math.max(14, ...report.map(s => (s.name || '').length));
    const hasBadges = report.some(s => 
      s.is_f || s.grade === 'ข.ร.' || s.grade === 'ขร' || s.is_absent_final || s.is_incomplete || 
      (s.remaining_absences !== undefined && s.remaining_absences <= 2 && s.remaining_absences >= 0)
    );
    const base = maxNameLen * 9.5 + (hasBadges ? 130 : 45);
    return Math.max(220, Math.min(480, Math.round(base)));
  }, [report]);

  const activeNameWidth = useMemo(() => {
    let w = calculatedAutoWidth;
    if (nameColMode === 'compact') w = 190;
    else if (nameColMode === 'normal') w = 260;
    else if (nameColMode === 'wide') w = 340;
    return Math.max(160, Math.min(550, w + customWidthOffset));
  }, [nameColMode, calculatedAutoWidth, customWidthOffset]);

  const defaultCriteria: Criterion[] = [
    { grade: '4', min_score: 80 },
    { grade: '3.5', min_score: 75 },
    { grade: '3', min_score: 70 },
    { grade: '2.5', min_score: 65 },
    { grade: '2', min_score: 60 },
    { grade: '1.5', min_score: 55 },
    { grade: '1', min_score: 50 },
    { grade: '0', min_score: 0 },
  ];

  // ─── Query: ดึงข้อมูลห้องเรียน ───
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  const classroomObj = useMemo(() => {
    return classrooms.find(c => String(c.id) === String(selectedClass)) || null;
  }, [classrooms, selectedClass]);

  // ─── Query: ดึงข้อมูลเกรดและเกณฑ์ ───
  const { data: gradesData, isLoading: loadingGrades } = useQuery<{ criteria: Criterion[]; report: ReportStudent[]; weights?: Weights }>({
    queryKey: ['grades', selectedClass],
    queryFn: async () => {
      const [critRes, repRes] = await Promise.all([
        api.get(`/grades?classroom_id=${selectedClass}&type=criteria`),
        api.get(`/grades?classroom_id=${selectedClass}`)
      ]);

      const loadedCriteria = critRes.data.data;
      const finalCriteria = (loadedCriteria && loadedCriteria.length > 0)
        ? loadedCriteria
        : defaultCriteria.map(c => ({ ...c }));

      return {
        criteria: finalCriteria,
        report: repRes.data.data || [],
        weights: repRes.data.weights
      };
    },
    enabled: !!selectedClass,
  });

  // Sync query data into local state
  useEffect(() => {
    if (gradesData) {
      setCriteria(gradesData.criteria);
      setReport(gradesData.report);
      if (gradesData.weights) {
        setWeights(gradesData.weights);
      }
      setCurrentPage(1);
      setHasUnsavedChanges(false);
    }
  }, [gradesData]);

  // Update weights when classroom changes
  useEffect(() => {
    if (selectedClass) {
      const c = classrooms.find(cl => String(cl.id) === String(selectedClass));
      if (c) {
        setWeights({
          assignment_weight: c.assignment_weight ?? 10,
          post_test_weight: c.post_test_weight ?? 70,
          affective_weight: c.affective_weight ?? 20,
          midterm_weight: c.midterm_weight ?? 0,
          final_weight: c.final_weight ?? 0,
          midterm_max_score: c.midterm_max_score ?? 100,
          final_max_score: c.final_max_score ?? 100
        });
      }
    } else {
      setReport([]);
      setCriteria([]);
      setHasUnsavedChanges(false);
    }
  }, [selectedClass, classrooms]);

  // Total weight sum helper
  const totalWeightSum = useMemo(() => {
    return Number(weights.assignment_weight || 0) + 
           Number(weights.post_test_weight || 0) + 
           Number(weights.affective_weight || 0) + 
           Number(weights.midterm_weight || 0) + 
           Number(weights.final_weight || 0);
  }, [weights]);

  // Grade Distribution & Analytics Calculation
  const analytics = useMemo(() => {
    if (!report || report.length === 0) {
      return { gpa: '0.00', passRate: 0, passCount: 0, failCount: 0, krCount: 0, ksCount: 0, msCount: 0, distribution: {} as Record<string, number> };
    }

    const dist: Record<string, number> = {};
    let totalScoreSum = 0;
    let numericGradeSum = 0;
    let numericGradeCount = 0;
    let passCount = 0;
    let failCount = 0;
    let krCount = 0;
    let ksCount = 0;
    let msCount = 0;

    report.forEach(student => {
      const g = student.grade || 'ไม่มีเกรด';
      dist[g] = (dist[g] || 0) + 1;
      const score = Number(student.total_score_precise ?? student.total_score ?? 0);
      totalScoreSum += score;

      if (g === 'ข.ร.' || g === 'ขร' || student.is_f) {
        krCount++;
        failCount++;
      } else if (g === 'ข.ส.' || student.is_absent_final) {
        ksCount++;
        failCount++;
      } else if (g === 'ม.ส.' || student.is_incomplete) {
        msCount++;
        failCount++;
      } else if (g === '0' || g === 'F' || g === 'ไม่มีเกรด') {
        failCount++;
      } else {
        passCount++;
      }

      const numG = parseFloat(g);
      if (!isNaN(numG)) {
        numericGradeSum += numG;
        numericGradeCount++;
      }
    });

    const gpa = numericGradeCount > 0 ? (numericGradeSum / numericGradeCount).toFixed(2) : '0.00';
    const passRate = report.length > 0 ? Math.round((passCount / report.length) * 100) : 0;

    return { gpa, passRate, passCount, failCount, krCount, ksCount, msCount, distribution: dist };
  }, [report]);

  // Filtered student list
  const filteredReport = useMemo(() => {
    return report.filter(student => {
      const matchesSearch = !searchQuery.trim() || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (student.student_code && student.student_code.includes(searchQuery));
      
      if (!matchesSearch) return false;

      if (gradeFilter === 'ALL') return true;
      if (gradeFilter === 'KR') return student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
      if (gradeFilter === 'KS') return student.grade === 'ข.ส.' || student.is_absent_final;
      if (gradeFilter === 'MS') return student.grade === 'ม.ส.' || student.is_incomplete;
      if (gradeFilter === 'FAIL') return student.grade === '0' || student.grade === 'F' || student.grade === 'ข.ร.' || student.grade === 'ข.ส.' || student.grade === 'ม.ส.' || student.is_f;
      return student.grade === gradeFilter;
    });
  }, [report, searchQuery, gradeFilter]);

  // Paginated report subset
  const paginatedReport = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReport.slice(start, start + itemsPerPage);
  }, [filteredReport, currentPage, itemsPerPage]);

  const handleExamScoreChange = (studentId: string, field: 'midterm_score' | 'final_score' | 'affective_score', value: string) => {
    setHasUnsavedChanges(true);
    setReport(prev => prev.map(student => {
      if (student.student_id === studentId) {
        let valNum: number | string = value === '' ? '' : parseFloat(value);
        let isAbsentFinal = student.is_absent_final;
        let isIncomplete = student.is_incomplete;

        if (field === 'final_score') {
          if (valNum === -1 || value === 'ข.ส.' || value === 'ขาดสอบ') {
            valNum = -1;
            isAbsentFinal = true;
            isIncomplete = false;
          } else if (valNum === -2 || value === 'ม.ส.' || value === 'ไม่สมบูรณ์') {
            valNum = -2;
            isAbsentFinal = false;
            isIncomplete = true;
          } else {
            isAbsentFinal = false;
            isIncomplete = false;
            if (typeof valNum === 'number' && valNum < 0) {
              valNum = 0;
            }
          }
        } else if (typeof valNum === 'number' && valNum < 0) {
          valNum = 0;
        }

        const updatedStudent = { 
          ...student, 
          [field]: valNum,
          ...(field === 'final_score' ? { is_absent_final: isAbsentFinal, is_incomplete: isIncomplete } : {})
        };
        
        const mScore = Math.max(0, parseFloat(String(updatedStudent.midterm_score)) || 0);
        const rawF = parseFloat(String(updatedStudent.final_score));
        const fScore = (isNaN(rawF) || rawF < 0) ? 0 : rawF;
        const preciseAssign = Number(updatedStudent.precise_scaled_assign ?? 0);
        const precisePost = Number(updatedStudent.precise_scaled_post_test ?? 0);
        
        const preciseMidterm = weights.midterm_max_score > 0 ? (mScore / weights.midterm_max_score) * weights.midterm_weight : 0;
        const preciseFinal = weights.final_max_score > 0 ? (fScore / weights.final_max_score) * weights.final_weight : 0;
        
        updatedStudent.precise_scaled_midterm = preciseMidterm;
        updatedStudent.scaled_midterm = Math.round(preciseMidterm);
        updatedStudent.precise_scaled_final = preciseFinal;
        updatedStudent.scaled_final = Math.round(preciseFinal);

        const affective = Math.max(0, parseFloat(String(updatedStudent.affective_score ?? 0)) || 0);
        
        const totalPrecise = preciseAssign + precisePost + affective + preciseMidterm + preciseFinal;
        updatedStudent.total_score_precise = totalPrecise;
        updatedStudent.total_score = Math.round(totalPrecise);
        
        const percentage = totalWeightSum > 0 ? (totalPrecise / totalWeightSum) * 100 : 0;
        updatedStudent.percentage = percentage.toFixed(2);
        
        let finalGrade = null;
        if (updatedStudent.is_f) {
          finalGrade = 'ข.ร.';
        } else if (updatedStudent.is_absent_final) {
          finalGrade = 'ข.ส.';
        } else if (updatedStudent.is_incomplete) {
          finalGrade = 'ม.ส.';
        } else {
          for (const c of criteria) {
            if (percentage >= Number(c.min_score)) {
              finalGrade = c.grade;
              break;
            }
          }
        }
        updatedStudent.grade = finalGrade || 'ไม่มีเกรด';

        return updatedStudent;
      }
      return student;
    }));
  };

  // ─── Mutation: บันทึกคะแนนสอบ ───
  const saveExamsMutation = useMutation({
    mutationFn: async () => {
      const scores = report.map(s => ({
        student_id: s.student_id,
        midterm_score: s.midterm_score === '' || s.midterm_score === undefined || s.midterm_score === null ? 0 : Number(s.midterm_score),
        final_score: s.final_score === '' || s.final_score === undefined || s.final_score === null 
          ? 0 
          : Number(s.final_score),
        affective_score: s.affective_score === undefined || s.affective_score === null ? null : Number(s.affective_score)
      }));
      return api.put('/students/exams', { scores });
    },
    onSuccess: () => {
      toast.success('บันทึกคะแนนสอบและจิตพิสัยเรียบร้อยแล้ว');
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
    onError: () => {
      toast.error('บันทึกคะแนนสอบไม่สำเร็จ');
    },
  });

  // Auto calculate affective scores from attendance data
  const autoCalculateAffective = () => {
    let count = 0;
    setHasUnsavedChanges(true);
    setReport(prev => prev.map(student => {
      const autoScore = calculateAffectiveScore({
        maxWeight: weights.affective_weight,
        absentCount: student.absent_count || 0,
        lateCount: student.late_count || 0,
      });
      const updatedStudent = { ...student, affective_score: autoScore };

      const preciseAssign = Number(updatedStudent.precise_scaled_assign ?? 0);
      const precisePost = Number(updatedStudent.precise_scaled_post_test ?? 0);
      const preciseMidterm = Number(updatedStudent.precise_scaled_midterm ?? 0);
      const preciseFinal = Number(updatedStudent.precise_scaled_final ?? 0);

      const totalPrecise = preciseAssign + precisePost + autoScore + preciseMidterm + preciseFinal;
      updatedStudent.total_score_precise = totalPrecise;
      updatedStudent.total_score = Math.round(totalPrecise);
      const percentage = totalWeightSum > 0 ? (totalPrecise / totalWeightSum) * 100 : 0;
      updatedStudent.percentage = percentage.toFixed(2);

      let finalGrade = null;
      if (updatedStudent.is_f) {
        finalGrade = 'ข.ร.';
      } else if (updatedStudent.is_absent_final) {
        finalGrade = 'ข.ส.';
      } else if (updatedStudent.is_incomplete) {
        finalGrade = 'ม.ส.';
      } else {
        for (const c of criteria) {
          if (percentage >= Number(c.min_score)) {
            finalGrade = c.grade;
            break;
          }
        }
      }
      updatedStudent.grade = finalGrade || 'ไม่มีเกรด';
      count++;
      return updatedStudent;
    }));
    toast.success(`คำนวณจิตพิสัยอัตโนมัติจากสถิติเวลาเรียนเสร็จ ${count} คน`);
  };

  // Export Std02 Online (ศธ.02 ออนไลน์ Template - สอศ.)
  const exportStd02 = (fileType: 'xlsx' | 'csv' = 'xlsx') => {
    if (!report || report.length === 0) {
      toast.error('ไม่พบข้อมูลสำหรับส่งออก');
      return;
    }

    const currentClass = classrooms.find(c => String(c.id) === String(selectedClass));
    const cleanClassName = (currentClass?.name || 'Classroom').replace(/[/\\?%*:|"<>]/g, '_');

    const headers = [
      'ลำดับ',
      'รหัสประจำตัว',
      'ชื่อ-นามสกุล',
      `งานเก็บ (${weights.assignment_weight}%)`,
      `สอบย่อย (${weights.post_test_weight}%)`,
      `กลางภาค (${weights.midterm_weight}%)`,
      `ปลายภาค (${weights.final_weight}%)`,
      `จิตพิสัย (${weights.affective_weight}%)`,
      'รวมคะแนน (100)',
      'ระดับผลการเรียน',
      'เวลาเรียน (%)',
      'หมายเหตุ'
    ];

    const rows = report.map((student, idx) => {
      const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
      const isKs = student.grade === 'ข.ส.' || student.is_absent_final;
      const isMs = student.grade === 'ม.ส.' || student.is_incomplete;
      
      let remark = '';
      if (isKr) remark = 'หมดสิทธิ์สอบ (ข.ร.)';
      else if (isKs) remark = 'ขาดสอบปลายภาค (ข.ส.)';
      else if (isMs) remark = 'ผลการเรียนไม่สมบูรณ์ (ม.ส.)';

      const finalDisplay = isKs ? 'ข.ส.' : isMs ? 'ม.ส.' : Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1);
      const totalDisplay = (isKs || isMs) ? '-' : Number(student.total_score_precise ?? student.total_score ?? 0).toFixed(1);

      return [
        idx + 1,
        student.student_code || '-',
        student.name,
        Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1),
        Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1),
        Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1),
        finalDisplay,
        Number(student.affective_score || 0).toFixed(1),
        totalDisplay,
        student.grade || '0',
        `${student.attendance_percent ?? 100}%`,
        remark
      ];
    });

    if (fileType === 'xlsx') {
      try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        ws['!cols'] = [
          { wch: 6 },
          { wch: 16 },
          { wch: 26 },
          { wch: 18 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 24 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'ศธ.02 ผลการเรียน');
        XLSX.writeFile(wb, `ศธ02_ผลการเรียน_${cleanClassName}.xlsx`);
        toast.success('ส่งออกไฟล์ Excel ศธ.02 ออนไลน์ สำเร็จ');
        return;
      } catch (err) {
        console.error('XLSX export error:', err);
      }
    }

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ศธ02_ผลการเรียน_${cleanClassName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ส่งออกไฟล์ CSV ศธ.02 ออนไลน์ สำเร็จ');
  };

  // ─── Mutation: บันทึกเกณฑ์ตัดเกรด ───
  const saveCriteriaMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/grades?classroom_id=${selectedClass}&type=criteria`, { criteria });
      await api.put('/classrooms/' + selectedClass, {
        assignment_weight: Number(weights.assignment_weight),
        post_test_weight: Number(weights.post_test_weight),
        affective_weight: Number(weights.affective_weight),
        midterm_weight: Number(weights.midterm_weight),
        final_weight: Number(weights.final_weight),
        midterm_max_score: Number(weights.midterm_max_score),
        final_max_score: Number(weights.final_max_score)
      });
    },
    onSuccess: () => {
      toast.success('บันทึกการตั้งค่าน้ำหนักและเกณฑ์เรียบร้อย');
      setShowSettings(false);
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
    onError: () => {
      toast.error('บันทึกการตั้งค่าไม่สำเร็จ');
    },
  });

  const handleCriteriaChange = (index: number, field: keyof Criterion, value: string | number) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const addCriteriaRow = () => {
    setCriteria([...criteria, { grade: '', min_score: 0 }]);
  };

  const removeCriteriaRow = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const getGradeStyle = (grade?: string) => {
    if (grade === 'ข.ร.' || grade === 'ขร' || grade === 'F') return 'bg-rose-600 text-white shadow-sm shadow-rose-500/20';
    if (grade === 'ข.ส.') return 'bg-amber-500 text-white shadow-sm shadow-amber-500/20';
    if (grade === 'ม.ส.') return 'bg-purple-600 text-white shadow-sm shadow-purple-500/20';
    if (grade === '4' || grade === '3.5' || grade === '3' || grade === 'A') return 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20';
    if (grade === '2.5' || grade === '2' || grade === '1.5' || grade === '1' || grade === 'B' || grade === 'C') return 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20';
    if (grade === '0' || grade === 'D') return 'bg-rose-500 text-white shadow-sm shadow-rose-500/20';
    return 'bg-slate-100 text-slate-700';
  };

  if (loadingClassrooms) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-xs text-slate-500">กำลังโหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up pb-24">
      {/* ==================== PAGE HEADER & RESPONSIVE SELECTOR ==================== */}
      <div className="glass p-5 sm:p-6 rounded-3xl border border-indigo-100/80 bg-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/15 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  ตัดเกรด & ประเมินผลการเรียน
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  คำนวณคะแนนตามสัดส่วน 100% ตัดเกรดอัตโนมัติ และตรวจสิทธิ์สอบ (ศธ.02 ออนไลน์)
                </p>
              </div>
            </div>
          </div>

          {/* Classroom Selector & Settings Button */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="form-input text-xs sm:text-sm py-2.5 pl-3 pr-8 font-semibold text-slate-800 bg-slate-50 border border-indigo-200/80 rounded-2xl focus:bg-white focus:border-indigo-500 shadow-xs w-full"
              >
                <option value="">-- เลือกห้องเรียน --</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedClass && (
              <>
                <span className={`hidden sm:inline-flex px-3 py-2 rounded-2xl text-xs font-bold border items-center gap-1.5 shrink-0 ${
                  weights.is_pws || classrooms.find(c => String(c.id) === String(selectedClass))?.name?.includes('ปวส')
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}>
                  🎓 {weights.is_pws || classrooms.find(c => String(c.id) === String(selectedClass))?.name?.includes('ปวส')
                    ? `ปวส. (${weights.target_weeks || 15} สัปดาห์)`
                    : `ปวช. (${weights.target_weeks || 18} สัปดาห์)`}
                </span>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`btn px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                    showSettings 
                      ? 'btn-primary shadow-md shadow-indigo-500/20' 
                      : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">ตั้งค่าเกณฑ์ & น้ำหนัก</span>
                  <span className="sm:hidden">ตั้งค่า</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="glass p-12 sm:p-16 text-center rounded-3xl border border-indigo-100 bg-white">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600 shadow-sm">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1.5">กรุณาเลือกห้องเรียนเพื่อดูผลการเรียน</h3>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
            เลือกห้องเรียนจากเมนูด้านบนเพื่อเริ่มต้นดูสถิติ บันทึกคะแนนสอบกลางภาค/ปลายภาค และประมวลผลการตัดเกรด
          </p>
        </div>
      ) : loadingGrades ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500">กำลังประมวลผลข้อมูลเกรดและคะแนน...</p>
        </div>
      ) : showSettings ? (
        /* ==================== SETTINGS DRAWER / PANEL ==================== */
        <div className="glass p-6 sm:p-7 rounded-3xl border border-indigo-100 bg-white space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                ตั้งค่าน้ำหนักคะแนน & เกณฑ์ตัดเกรด
              </h3>
              <p className="text-xs text-slate-500">กำหนดสัดส่วนคะแนนรวม 100% และเกณฑ์ช่วงคะแนนตามระเบียบ สอศ.</p>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl px-3.5 py-1.5"
            >
              ปิด
            </button>
          </div>

          {/* Real-Time Weight Balance Bar Section */}
          <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  สัดส่วนน้ำหนักคะแนน (รวม 5 ส่วนต้องเท่ากับ 100%)
                </h4>
                <p className="text-xs text-slate-500">ระบบจะแปลงคะแนนดิบสะสมเข้าสู่น้ำหนักเปอร์เซ็นต์อัตโนมัติ</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">ผลรวม:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                  totalWeightSum === 100 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {totalWeightSum === 100 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                  {totalWeightSum}% / 100%
                </span>
              </div>
            </div>

            {/* Visual Weight Distribution Progress Bar */}
            <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div style={{ width: `${Math.min(100, (weights.assignment_weight / 100) * 100)}%` }} className="bg-emerald-500 transition-all" title={`งานเก็บ ${weights.assignment_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.post_test_weight / 100) * 100)}%` }} className="bg-amber-500 transition-all" title={`สอบย่อย ${weights.post_test_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.midterm_weight / 100) * 100)}%` }} className="bg-cyan-500 transition-all" title={`กลางภาค ${weights.midterm_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.final_weight / 100) * 100)}%` }} className="bg-blue-500 transition-all" title={`ปลายภาค ${weights.final_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.affective_weight / 100) * 100)}%` }} className="bg-pink-500 transition-all" title={`จิตพิสัย ${weights.affective_weight}%`} />
            </div>

            {/* Weight inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs">
                <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">งานเก็บ (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.assignment_weight} 
                  onChange={e => setWeights({...weights, assignment_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-emerald-800 text-sm py-1.5" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-xs">
                <label className="block text-[11px] font-bold text-amber-700 uppercase mb-1">สอบย่อย (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.post_test_weight} 
                  onChange={e => setWeights({...weights, post_test_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-amber-800 text-sm py-1.5" 
                  placeholder="30" 
                />
              </div>
              <div className="bg-white p-3 rounded-2xl border border-cyan-100 shadow-xs">
                <label className="block text-[11px] font-bold text-cyan-700 uppercase mb-1">กลางภาค (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.midterm_weight} 
                  onChange={e => setWeights({...weights, midterm_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-cyan-800 text-sm py-1.5" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-xs">
                <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">ปลายภาค (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.final_weight} 
                  onChange={e => setWeights({...weights, final_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-blue-800 text-sm py-1.5" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-2xl border border-pink-100 shadow-xs">
                <label className="block text-[11px] font-bold text-pink-700 uppercase mb-1">จิตพิสัย (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.affective_weight} 
                  onChange={e => setWeights({...weights, affective_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-pink-800 text-sm py-1.5" 
                  placeholder="10" 
                />
              </div>
            </div>
            
            {/* Max Scores for Exams */}
            <div className="pt-3 border-t border-indigo-100/60">
              <h5 className="font-bold text-slate-700 mb-2 text-xs">กำหนดคะแนนเต็มสำหรับข้อสอบ (เพื่อใช้แปลงอัตราส่วน)</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-indigo-100">
                  <label className="text-xs font-semibold text-cyan-800 w-28 shrink-0">เต็ม กลางภาค:</label>
                  <input 
                    type="number" min="1"
                    value={weights.midterm_max_score} 
                    onChange={e => setWeights({...weights, midterm_max_score: parseFloat(e.target.value) || 0})}
                    className="form-input text-center font-bold text-slate-800 flex-1 py-1 text-xs" 
                    placeholder="100" 
                  />
                </div>
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-indigo-100">
                  <label className="text-xs font-semibold text-blue-800 w-28 shrink-0">เต็ม ปลายภาค:</label>
                  <input 
                    type="number" min="1"
                    value={weights.final_max_score} 
                    onChange={e => setWeights({...weights, final_max_score: parseFloat(e.target.value) || 0})}
                    className="form-input text-center font-bold text-slate-800 flex-1 py-1 text-xs" 
                    placeholder="100" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Criteria Settings Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">เกณฑ์คะแนนขั้นต่ำ (%) สำหรับแต่ละระดับเกรด</h4>
                <p className="text-xs text-slate-500">เรียงจากคะแนนสูงลงมาต่ำ</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCriteria([
                    { grade: 'A', min_score: 80 },
                    { grade: 'B+', min_score: 75 },
                    { grade: 'B', min_score: 70 },
                    { grade: 'C+', min_score: 65 },
                    { grade: 'C', min_score: 60 },
                    { grade: 'D+', min_score: 55 },
                    { grade: 'D', min_score: 50 },
                    { grade: 'F', min_score: 0 },
                  ])}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  ใช้เกรดอักษร (A-F)
                </button>
                <button 
                  onClick={() => setCriteria([...defaultCriteria])}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                >
                  ใช้เกรดตัวเลข (4-0)
                </button>
              </div>
            </div>

            <div className="space-y-2 max-w-lg mb-6">
              {criteria.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2.5 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={c.grade}
                      onChange={e => handleCriteriaChange(i, 'grade', e.target.value)}
                      className="form-input py-1.5 text-center font-bold text-slate-800 text-xs rounded-xl"
                      placeholder="เช่น 4, A"
                    />
                  </div>
                  <div className="col-span-5 flex items-center gap-2">
                    <span className="text-slate-500 text-xs shrink-0 font-bold">≥</span>
                    <input
                      type="number"
                      value={c.min_score}
                      onChange={e => handleCriteriaChange(i, 'min_score', e.target.value)}
                      className="form-input py-1.5 font-semibold text-slate-800 text-xs rounded-xl"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button onClick={() => removeCriteriaRow(i)} className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addCriteriaRow}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-bold p-2 rounded-xl hover:bg-indigo-50 transition-all"
              >
                <Plus className="w-4 h-4" /> เพิ่มระดับเกรด
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => saveCriteriaMutation.mutate()} disabled={saveCriteriaMutation.isPending} className="btn btn-primary rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-500/20">
                {saveCriteriaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการตั้งค่า
              </button>
              <button onClick={() => setShowSettings(false)} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : report.length === 0 ? (
        <div className="glass p-12 text-center rounded-3xl border border-indigo-100 bg-white">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">ไม่พบข้อมูลนักเรียนในห้องนี้</h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">กรุณาเพิ่มรายชื่อนักเรียนในเมนู <strong>&quot;จัดการนักเรียน&quot;</strong> ก่อน</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ==================== ANALYTICS SUMMARY CARDS ==================== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="glass p-4 sm:p-5 rounded-3xl border border-indigo-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 font-black text-sm border border-indigo-100">
                GPA
              </div>
              <div className="min-w-0">
                <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">เกรดเฉลี่ยห้อง</p>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">{analytics.gpa}</div>
              </div>
            </div>

            <div className="glass p-4 sm:p-5 rounded-3xl border border-emerald-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">อัตราผ่านเกณฑ์</p>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                  {analytics.passRate}%
                  <span className="text-[10px] font-normal text-slate-500 ml-1.5 hidden sm:inline">({analytics.passCount}/{report.length})</span>
                </div>
              </div>
            </div>

            <div className="glass p-4 sm:p-5 rounded-3xl border border-rose-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">ขาดเรียนเกิน (ข.ร.)</p>
                <div className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
                  {analytics.krCount} <span className="text-xs font-medium text-slate-500">คน</span>
                </div>
              </div>
            </div>

            <div className="glass p-4 sm:p-5 rounded-3xl border border-amber-100/80 bg-white shadow-xs hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs border border-amber-100">
                ขส/มส
              </div>
              <div className="min-w-0">
                <p className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">ขาดสอบ / ไม่สมบูรณ์</p>
                <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
                  {analytics.ksCount + analytics.msCount}
                  <span className="text-[10px] font-normal text-slate-500 ml-1.5 hidden sm:inline">(ข.ส. {analytics.ksCount} | ม.ส. {analytics.msCount})</span>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== GRADE DISTRIBUTION BAR (RESPONSIVE SCROLL) ==================== */}
          <div className="glass p-4 sm:p-5 rounded-3xl border border-indigo-100/80 bg-white">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              สถิติการกระจายเกรด (คลิกเพื่อกรองรายชื่อ)
            </h4>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
              {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ข.ร.', 'ข.ส.', 'ม.ส.'].map(gKey => {
                const count = analytics.distribution[gKey] || (gKey === 'ข.ร.' ? (analytics.distribution['ขร'] || 0) : 0);
                const isSelected = (gradeFilter === gKey) || (gradeFilter === 'KR' && (gKey === 'ข.ร.' || gKey === 'ขร')) || (gradeFilter === 'KS' && gKey === 'ข.ส.') || (gradeFilter === 'MS' && gKey === 'ม.ส.');
                return (
                  <button
                    key={gKey}
                    onClick={() => {
                      if (gKey === 'ข.ร.') setGradeFilter(isSelected ? 'ALL' : 'KR');
                      else if (gKey === 'ข.ส.') setGradeFilter(isSelected ? 'ALL' : 'KS');
                      else if (gKey === 'ม.ส.') setGradeFilter(isSelected ? 'ALL' : 'MS');
                      else setGradeFilter(isSelected ? 'ALL' : gKey);
                    }}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105' 
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    <span>{gKey}:</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white text-indigo-700' : 'bg-white text-slate-800 font-extrabold shadow-xs'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {gradeFilter !== 'ALL' && (
                <button
                  onClick={() => setGradeFilter('ALL')}
                  className="px-3 py-1.5 rounded-2xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all shrink-0"
                >
                  แสดงทั้งหมด
                </button>
              )}
            </div>
          </div>

          {/* ==================== MAIN GRADEBOOK TOOLBAR & ACTIONS ==================== */}
          <div className="glass overflow-hidden rounded-3xl border border-indigo-100/80 bg-white shadow-sm">
            <div className="p-4 sm:p-5 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/40 via-white to-purple-50/20 space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 max-w-xl">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                      className="form-input text-xs pl-9 py-2 bg-white border-indigo-100 focus:border-indigo-500 rounded-2xl shadow-xs w-full"
                    />
                  </div>

                  <select
                    value={gradeFilter}
                    onChange={e => setGradeFilter(e.target.value)}
                    className="form-input text-xs py-2 bg-white border-indigo-100 focus:border-indigo-500 rounded-2xl shadow-xs min-w-[130px]"
                  >
                    <option value="ALL">ทุกระดับเกรด</option>
                    <option value="4">เกรด 4</option>
                    <option value="3.5">เกรด 3.5</option>
                    <option value="3">เกรด 3</option>
                    <option value="2.5">เกรด 2.5</option>
                    <option value="2">เกรด 2</option>
                    <option value="1.5">เกรด 1.5</option>
                    <option value="1">เกรด 1</option>
                    <option value="0">เกรด 0</option>
                    <option value="KR">เฉพาะ ข.ร. (ขาดเรียน)</option>
                    <option value="KS">เฉพาะ ข.ส. (ขาดสอบ)</option>
                    <option value="MS">เฉพาะ ม.ส. (ไม่สมบูรณ์)</option>
                    <option value="FAIL">ไม่ผ่าน / เงื่อนไขพิเศษ</option>
                  </select>

                  {/* View Mode Switcher: Table vs Cards */}
                  <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200/80 shadow-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      title="มุมมองตาราง (Table View)"
                      aria-label="มุมมองตาราง"
                    >
                      <TableIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-xl transition-all ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      title="มุมมองการ์ด (Card View - แนะนำสำหรับมือถือ)"
                      aria-label="มุมมองการ์ด"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Column Width Selector (Desktop view) */}
                {viewMode === 'table' && (
                  <div className="hidden xl:flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      กว้างชื่อ:
                    </span>
                    <div className="inline-flex rounded-2xl bg-white p-0.5 border border-indigo-200/80 shadow-xs text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { setNameColMode('auto'); setCustomWidthOffset(0); }}
                        className={`px-2.5 py-1 rounded-xl transition-all ${nameColMode === 'auto' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-indigo-50'}`}
                        title={`ปรับพอดีกับความยาวชื่อ (${calculatedAutoWidth}px)`}
                      >
                        Auto ({calculatedAutoWidth}px)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNameColMode('compact'); setCustomWidthOffset(0); }}
                        className={`px-2 py-1 rounded-xl transition-all ${nameColMode === 'compact' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-indigo-50'}`}
                      >
                        กระชับ
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNameColMode('normal'); setCustomWidthOffset(0); }}
                        className={`px-2 py-1 rounded-xl transition-all ${nameColMode === 'normal' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-indigo-50'}`}
                      >
                        ปกติ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-indigo-100/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={() => exportStd02('xlsx')} 
                    className="btn bg-white hover:bg-indigo-50 text-slate-700 border border-indigo-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" /> 
                    <span>Export ศธ.02 (Excel)</span>
                  </button>

                  <button 
                    onClick={() => setShowCsvPreviewModal(true)} 
                    className="btn bg-white hover:bg-emerald-50 text-slate-700 border border-emerald-200 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> 
                    <span>พรีวิว CSV</span>
                  </button>

                  <button 
                    onClick={() => setShowPdfPreviewModal(true)} 
                    className="btn bg-white hover:bg-violet-50 text-slate-700 border border-violet-200 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-violet-600" /> 
                    <span>พิมพ์ PDF</span>
                  </button>

                  <button 
                    onClick={autoCalculateAffective} 
                    className="btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-600" /> 
                    <span>คำนวณจิตพิสัยออโต้</span>
                  </button>
                </div>

                <button 
                  onClick={() => saveExamsMutation.mutate()} 
                  disabled={saveExamsMutation.isPending} 
                  className={`btn text-xs px-4 py-2 rounded-2xl flex items-center gap-1.5 font-bold shadow-md transition-all ${
                    hasUnsavedChanges
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25 animate-pulse'
                      : 'btn-primary shadow-indigo-500/20'
                  }`}
                >
                  {saveExamsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{hasUnsavedChanges ? 'บันทึกการแก้ไข' : 'บันทึกคะแนน'}</span>
                </button>
              </div>
            </div>

            {/* ==================== VIEW MODE 1: MODERN RESPONSIVE TABLE ==================== */}
            {viewMode === 'table' ? (
              <div className="overflow-x-auto relative">
                <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-indigo-100 text-slate-700 font-bold sticky top-0 z-10 backdrop-blur-md">
                      <th className="p-3 w-16 text-center">รหัส</th>
                      <th 
                        className="p-3 border-r border-indigo-200/60 sticky left-0 bg-slate-100/95 z-20 shadow-xs"
                        style={{ minWidth: `${activeNameWidth}px`, width: `${activeNameWidth}px` }}
                      >
                        ชื่อ-นามสกุล
                      </th>
                      <th className="p-2.5 text-center text-emerald-800 min-w-[95px] bg-emerald-50/40 border-r border-emerald-100/50">
                        งานเก็บ
                        <div className="text-[10px] font-normal text-emerald-600 font-mono">({weights.assignment_weight}%)</div>
                      </th>
                      <th className="p-2.5 text-center text-amber-800 min-w-[95px] bg-amber-50/40 border-r border-amber-100/50">
                        สอบย่อย
                        <div className="text-[10px] font-normal text-amber-600 font-mono">({weights.post_test_weight}%)</div>
                      </th>
                      <th className="p-2.5 text-center text-cyan-800 min-w-[100px] bg-cyan-50/40 border-r border-cyan-100/50">
                        กลางภาค
                        <div className="text-[10px] font-normal text-cyan-600 font-mono">({weights.midterm_weight}%)</div>
                      </th>
                      <th className="p-2.5 text-center text-blue-800 min-w-[110px] bg-blue-50/40 border-r border-blue-100/50">
                        ปลายภาค
                        <div className="text-[10px] font-normal text-blue-600 font-mono">({weights.final_weight}%)</div>
                      </th>
                      <th className="p-2.5 text-center text-pink-800 min-w-[85px] bg-pink-50/40 border-r border-pink-100/50">
                        จิตพิสัย
                        <div className="text-[10px] font-normal text-pink-600 font-mono">({weights.affective_weight}%)</div>
                      </th>
                      <th className="p-2.5 text-center bg-indigo-100/70 text-indigo-900 font-black min-w-[85px] border-r border-indigo-200/50">
                        รวม
                        <div className="text-[10px] font-normal text-indigo-700">(100)</div>
                      </th>
                      <th className="p-3 text-center min-w-[85px]">เกรด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {paginatedReport.map((student, idx) => {
                      const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
                      const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
                      const isKs = student.grade === 'ข.ส.' || student.is_absent_final || student.final_score === -1;
                      const isMs = student.grade === 'ม.ส.' || student.is_incomplete || student.final_score === -2;
                      const isAtRisk = !isKr && !isKs && !isMs && (totalScore < 50 || (student.remaining_absences !== undefined && student.remaining_absences <= 2 && student.remaining_absences >= 0));

                      return (
                        <tr 
                          key={student.student_id} 
                          className={`hover:bg-indigo-50/60 transition-colors ${
                            isKr ? 'bg-rose-50/70' : isKs ? 'bg-amber-50/70' : isMs ? 'bg-purple-50/70' : isAtRisk ? 'bg-amber-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="p-2.5 text-slate-500 font-medium text-center font-mono">{student.student_code || '-'}</td>
                          <td 
                            className="p-2.5 font-semibold text-slate-800 border-r border-indigo-100/80 sticky left-0 z-10 bg-inherit shadow-xs"
                            style={{ minWidth: `${activeNameWidth}px`, width: `${activeNameWidth}px` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="whitespace-nowrap font-medium text-slate-800 text-xs truncate" title={student.name}>
                                {student.name}
                              </span>
                              {isKr && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold shrink-0 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" /> ข.ร.
                                </span>
                              )}
                              {isKs && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0 border border-amber-200">
                                  <AlertCircle className="w-3 h-3 text-amber-600" /> ข.ส.
                                </span>
                              )}
                              {isMs && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold shrink-0 border border-purple-200">
                                  <AlertCircle className="w-3 h-3 text-purple-600" /> ม.ส.
                                </span>
                              )}
                              {isAtRisk && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0 border border-amber-200">
                                  ขาดได้อีก {student.remaining_absences}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Raw & Scaled Scores Breakdown */}
                          <td className="p-2 text-center bg-emerald-50/20 border-r border-emerald-100/40">
                            <div className="font-extrabold text-emerald-700 text-sm font-mono">{Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}</div>
                            <div className="text-[10px] text-slate-400">ดิบ: {Number(student.raw_assign || 0).toFixed(1)}/{student.max_assign || 0}</div>
                          </td>

                          <td className="p-2 text-center bg-amber-50/20 border-r border-amber-100/40">
                            <div className="font-extrabold text-amber-700 text-sm font-mono">{Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}</div>
                            <div className="text-[10px] text-slate-400">ดิบ: {Number(student.raw_post_test || 0).toFixed(1)}/{student.max_post_test || 0}</div>
                          </td>

                          {/* Midterm Editable Score */}
                          <td className="p-2 text-center bg-cyan-50/20 border-r border-cyan-100/40">
                            <input 
                              type="number" step="0.5" min="0" max={weights.midterm_max_score}
                              value={student.midterm_score ?? ''}
                              onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                              className="form-input text-center py-1 px-1.5 w-16 mx-auto text-cyan-800 font-bold border-cyan-200 focus:border-cyan-500 text-xs rounded-xl bg-white shadow-2xs" 
                              placeholder="0"
                            />
                            <div className="text-[10px] text-cyan-700 font-semibold mt-0.5 font-mono">ได้: {Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1)}</div>
                          </td>

                          {/* Final Editable Score with Std02 Vocational Controls */}
                          <td className="p-2 text-center bg-blue-50/20 border-r border-blue-100/40">
                            {student.final_score === -1 || student.is_absent_final ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-600 text-white shadow-xs">
                                  ข.ส. (ขาดสอบ)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')}
                                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                                >
                                  กรอกคะแนน
                                </button>
                              </div>
                            ) : student.final_score === -2 || student.is_incomplete ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-600 text-white shadow-xs">
                                  ม.ส. (ไม่สมบูรณ์)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')}
                                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                                >
                                  กรอกคะแนน
                                </button>
                              </div>
                            ) : (
                              <>
                                <input 
                                  type="number" step="0.5" min="0" max={weights.final_max_score}
                                  value={student.final_score ?? ''}
                                  onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                                  className="form-input text-center py-1 px-1.5 w-16 mx-auto text-blue-800 font-bold border-blue-200 focus:border-blue-500 text-xs rounded-xl bg-white shadow-2xs" 
                                  placeholder="0"
                                />
                                <div className="text-[10px] text-blue-700 font-semibold mt-0.5 font-mono">ได้: {Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1)}</div>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <button
                                    type="button"
                                    title="ทำเครื่องหมายขาดสอบ (ข.ส.)"
                                    onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-1')}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-800 transition-colors border border-slate-200"
                                  >
                                    ข.ส.
                                  </button>
                                  <button
                                    type="button"
                                    title="ทำเครื่องหมายผลการเรียนไม่สมบูรณ์ (ม.ส.)"
                                    onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-2')}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-800 transition-colors border border-slate-200"
                                  >
                                    ม.ส.
                                  </button>
                                </div>
                              </>
                            )}
                          </td>

                          {/* Affective Editable Score */}
                          <td className="p-2 text-center bg-pink-50/20 border-r border-pink-100/40">
                            <input 
                              type="number" step="0.5" min="0" max={weights.affective_weight}
                              value={student.affective_score ?? ''}
                              onChange={e => handleExamScoreChange(student.student_id, 'affective_score', e.target.value)}
                              className="form-input text-center py-1 px-1.5 w-16 mx-auto text-pink-800 font-bold border-pink-200 focus:border-pink-500 text-xs rounded-xl bg-white shadow-2xs" 
                              placeholder="0"
                            />
                          </td>

                          {/* Precise Total Score */}
                          <td className="p-2 text-center bg-indigo-100/50 border-r border-indigo-200/40">
                            <span className="font-black text-indigo-900 text-sm font-mono">{totalScore.toFixed(1)}</span>
                          </td>

                          {/* Grade Pill Badge */}
                          <td className="p-2.5 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-xl font-black text-xs shadow-xs transition-transform hover:scale-105 ${getGradeStyle(student.grade)}`}>
                              {student.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ==================== VIEW MODE 2: MOBILE-FIRST CARD VIEW ==================== */
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {paginatedReport.map((student, idx) => {
                  const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
                  const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
                  const isKs = student.grade === 'ข.ส.' || student.is_absent_final || student.final_score === -1;
                  const isMs = student.grade === 'ม.ส.' || student.is_incomplete || student.final_score === -2;

                  return (
                    <div
                      key={student.student_id}
                      className={`p-4 rounded-3xl border transition-all space-y-3 ${
                        isKr ? 'bg-rose-50/70 border-rose-200' : isKs ? 'bg-amber-50/70 border-amber-200' : isMs ? 'bg-purple-50/70 border-purple-200' : 'bg-white border-indigo-100/80 hover:border-indigo-300 shadow-xs'
                      }`}
                    >
                      {/* Card Header: Avatar, Name, Student Code, Grade Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg shrink-0">
                            {animalAvatars[idx % animalAvatars.length]}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 truncate">{student.name}</h4>
                            <p className="text-xs text-slate-500 font-mono">รหัส: {student.student_code || '-'}</p>
                          </div>
                        </div>

                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-xs shadow-xs shrink-0 ${getGradeStyle(student.grade)}`}>
                          เกรด {student.grade}
                        </span>
                      </div>

                      {/* Warnings / Special Status Pills */}
                      {(isKr || isKs || isMs || (student.remaining_absences !== undefined && student.remaining_absences <= 2)) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {isKr && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              ⚠️ หมดสิทธิ์สอบ (ข.ร.)
                            </span>
                          )}
                          {isKs && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              ⚠️ ขาดสอบ (ข.ส.)
                            </span>
                          )}
                          {isMs && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              ⚠️ ผลการเรียนไม่สมบูรณ์ (ม.ส.)
                            </span>
                          )}
                          {!isKr && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              ขาดได้อีก {student.remaining_absences} ครั้ง
                            </span>
                          )}
                        </div>
                      )}

                      {/* Scores Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="p-2.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">งานเก็บ ({weights.assignment_weight}%)</span>
                          <div className="font-extrabold text-emerald-800 text-base font-mono">
                            {Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}
                          </div>
                          <span className="text-[9px] text-slate-400">ดิบ {Number(student.raw_assign || 0).toFixed(0)}/{student.max_assign || 0}</span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-amber-50/50 border border-amber-100">
                          <span className="text-[10px] font-bold text-amber-700 uppercase">สอบย่อย ({weights.post_test_weight}%)</span>
                          <div className="font-extrabold text-amber-800 text-base font-mono">
                            {Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}
                          </div>
                          <span className="text-[9px] text-slate-400">ดิบ {Number(student.raw_post_test || 0).toFixed(0)}/{student.max_post_test || 0}</span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-cyan-50/50 border border-cyan-100">
                          <span className="text-[10px] font-bold text-cyan-700 uppercase">กลางภาค ({weights.midterm_weight}%)</span>
                          <input 
                            type="number" step="0.5" min="0" max={weights.midterm_max_score}
                            value={student.midterm_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                            className="form-input text-center py-1 px-1 w-full text-cyan-900 font-bold border-cyan-200 focus:border-cyan-500 text-xs rounded-xl bg-white mt-1" 
                            placeholder="0"
                          />
                        </div>

                        <div className="p-2.5 rounded-2xl bg-blue-50/50 border border-blue-100">
                          <span className="text-[10px] font-bold text-blue-700 uppercase">ปลายภาค ({weights.final_weight}%)</span>
                          {student.final_score === -1 || student.is_absent_final ? (
                            <div className="mt-1">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-600 text-white inline-block">ข.ส.</span>
                              <button type="button" onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')} className="text-[10px] text-blue-600 block hover:underline mt-0.5 font-semibold">แก้คะแนน</button>
                            </div>
                          ) : (
                            <input 
                              type="number" step="0.5" min="0" max={weights.final_max_score}
                              value={student.final_score ?? ''}
                              onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                              className="form-input text-center py-1 px-1 w-full text-blue-900 font-bold border-blue-200 focus:border-blue-500 text-xs rounded-xl bg-white mt-1" 
                              placeholder="0"
                            />
                          )}
                        </div>

                        <div className="p-2.5 rounded-2xl bg-pink-50/50 border border-pink-100">
                          <span className="text-[10px] font-bold text-pink-700 uppercase">จิตพิสัย ({weights.affective_weight}%)</span>
                          <input 
                            type="number" step="0.5" min="0" max={weights.affective_weight}
                            value={student.affective_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'affective_score', e.target.value)}
                            className="form-input text-center py-1 px-1 w-full text-pink-900 font-bold border-pink-200 focus:border-pink-500 text-xs rounded-xl bg-white mt-1" 
                            placeholder="0"
                          />
                        </div>

                        <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col justify-center text-center">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">รวม (100)</span>
                          <span className="text-lg font-black text-indigo-900 font-mono">{totalScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            {filteredReport.length > 0 && (
              <div className="p-3.5 border-t border-indigo-100/70 bg-slate-50/50">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredReport.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== FLOATING QUICK SAVE BAR ==================== */}
      {selectedClass && hasUnsavedChanges && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg animate-fade-in-up">
          <div className="glass p-3 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 pl-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">มีคะแนนที่รอการบันทึก</p>
                <p className="text-[0.68rem] text-slate-300 truncate">อย่าลืมกดบันทึกเพื่อให้คะแนนอัปเดตลงระบบ</p>
              </div>
            </div>

            <button
              onClick={() => saveExamsMutation.mutate()}
              disabled={saveExamsMutation.isPending}
              className="btn btn-accent text-xs font-bold px-4 py-2 rounded-xl shrink-0 shadow-lg shadow-emerald-500/20"
            >
              {saveExamsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>บันทึกคะแนน</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      {selectedClass && (
        <>
          <GradePdfModal
            isOpen={showPdfPreviewModal}
            onClose={() => setShowPdfPreviewModal(false)}
            classroom={classroomObj}
            report={report}
            weights={weights}
            criteria={criteria}
            teacherNameDefault={user?.name || 'ครูผู้สอน'}
          />
          <GradeCsvModal
            isOpen={showCsvPreviewModal}
            onClose={() => setShowCsvPreviewModal(false)}
            classroom={classroomObj}
            report={report}
            weights={weights}
          />
        </>
      )}
    </div>
  );
}
