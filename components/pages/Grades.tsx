'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Loader2, Save, Settings, AlertCircle, Plus, Trash2,
  FileSpreadsheet, Printer, Zap, AlertTriangle, Search, Award, CheckCircle2, XCircle, Download,
  LayoutGrid, Table as TableIcon, Grid, Users
} from 'lucide-react';
import toast from '@/lib/toast';
import Pagination from '@/components/Pagination';
import dynamic from 'next/dynamic';
import { calculateAffectiveScore } from '@/lib/affective';
import ClassroomCardPicker from '@/components/ClassroomCardPicker';
import SectionSwitcher from '@/components/SectionSwitcher';
import { parseClassroomName } from '@/lib/classroom';
import { buildStudentSectionGroups } from '@/lib/studentSections';
import GradesSettingsDrawer from '@/components/GradesSettingsDrawer';
import GradesAnalyticsHeader from '@/components/GradesAnalyticsHeader';
const GradePdfModal = dynamic(() => import('@/components/GradePdfModal'), { ssr: false });
const GradeCsvModal = dynamic(() => import('@/components/GradeCsvModal'), { ssr: false });
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

export interface Classroom {
  id: string;
  name: string;
  student_count?: number;
  total_classes?: number;
  total_weeks?: number;
  curriculum_type?: string;
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
  id?: string | number;
  student_id: string;
  student_code?: string;
  grade_level?: string | null;
  branch?: string | null;
  name: string;
  avatar?: string | null;
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

const EMPTY_CLASSROOMS: Classroom[] = [];

const DEFAULT_CRITERIA: Criterion[] = [
  { grade: '4', min_score: 80 },
  { grade: '3.5', min_score: 75 },
  { grade: '3', min_score: 70 },
  { grade: '2.5', min_score: 65 },
  { grade: '2', min_score: 60 },
  { grade: '1.5', min_score: 55 },
  { grade: '1', min_score: 50 },
  { grade: '0', min_score: 0 },
];

const DEFAULT_WEIGHTS: Weights = {
  assignment_weight: 10,
  post_test_weight: 70,
  affective_weight: 20,
  midterm_weight: 0,
  final_weight: 0,
  midterm_max_score: 100,
  final_max_score: 100
};

export default function Grades() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [report, setReport] = useState<ReportStudent[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [showSettings, setShowSettings] = useState(false);
  const { user } = useAuth();
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState(false);

  // View Mode: 'table' vs 'cards' (optimal for mobile)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Track unsaved changes for floating save button
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto detect mobile on load and set viewMode to cards if screen is very small
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('cards');
    }
  }, []);

  // ความกว้างคอลัมน์ "ชื่อ-นามสกุล" แบบพอดีจอ (Auto) ขยายตามขนาดตาราง
  const activeNameStyle = useMemo<React.CSSProperties>(() => ({ minWidth: '180px' }), []);

  // ─── Query: ดึงข้อมูลห้องเรียน ───
  const { data: classrooms = EMPTY_CLASSROOMS, isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  const classroomObj = useMemo(() => {
    return classrooms.find(c => String(c.id) === String(selectedClass)) || null;
  }, [classrooms, selectedClass]);

  const activeParsed = useMemo(() => {
    return classroomObj ? parseClassroomName(classroomObj.name) : null;
  }, [classroomObj]);

  // ─── Query: ดึงข้อมูลเกรดและเกณฑ์ ───
  const { data: gradesData, isLoading: loadingGrades } = useQuery<{ criteria: Criterion[]; report: ReportStudent[]; weights?: Weights }>({
    queryKey: ['grades', selectedClass],
    queryFn: async () => {
      const repRes = await api.get(`/grades?classroom_id=${selectedClass}`);
      const repData = repRes.data;
      const loadedCriteria = repData.criteria;
      const finalCriteria = (loadedCriteria && loadedCriteria.length > 0)
        ? loadedCriteria
        : DEFAULT_CRITERIA.map(c => ({ ...c }));

      return {
        criteria: finalCriteria,
        report: repData.data || [],
        weights: repData.weights
      };
    },
    enabled: !!selectedClass,
  });

  // Sync query data into local state
  useEffect(() => {
    if (gradesData) {
      setCriteria(gradesData.criteria || []);
      setReport(gradesData.report || []);
      if (gradesData.weights) {
        setWeights(gradesData.weights);
      }
      setCurrentPage(1);
      setHasUnsavedChanges(false);
    }
  }, [gradesData]);

  // Reset local state when no class is selected
  useEffect(() => {
    if (!selectedClass) {
      setReport(prev => (prev.length === 0 ? prev : []));
      setCriteria(prev => (prev.length === 0 ? prev : []));
      setHasUnsavedChanges(prev => (prev ? false : prev));
    }
  }, [selectedClass]);

  // Update weights when classroom changes
  useEffect(() => {
    if (!selectedClass || classrooms.length === 0) return;
    const c = classrooms.find(cl => String(cl.id) === String(selectedClass));
    if (c) {
      setWeights(prev => {
        const nextWeights = {
          assignment_weight: c.assignment_weight ?? 10,
          post_test_weight: c.post_test_weight ?? 70,
          affective_weight: c.affective_weight ?? 20,
          midterm_weight: c.midterm_weight ?? 0,
          final_weight: c.final_weight ?? 0,
          midterm_max_score: c.midterm_max_score ?? 100,
          final_max_score: c.final_max_score ?? 100
        };
        if (
          prev.assignment_weight === nextWeights.assignment_weight &&
          prev.post_test_weight === nextWeights.post_test_weight &&
          prev.affective_weight === nextWeights.affective_weight &&
          prev.midterm_weight === nextWeights.midterm_weight &&
          prev.final_weight === nextWeights.final_weight &&
          prev.midterm_max_score === nextWeights.midterm_max_score &&
          prev.final_max_score === nextWeights.final_max_score
        ) {
          return prev;
        }
        return { ...prev, ...nextWeights };
      });
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

  // ─── Sub-room / Section Grouping (แยกห้องย่อยเมื่อเรียนรวม เช่น ปวช.1/1 + ปวช.1/2) ───
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');

  // Reset section filter and pagination when switching classrooms
  useEffect(() => {
    setSelectedSectionKey('all');
    setCurrentPage(1);
  }, [selectedClass]);

  const { groups: sectionGroups, hasMultipleSections, sharedBranch } = useMemo(() => {
    const list = report.map(s => ({
      ...s,
      id: s.id || s.student_id,
    }));
    return buildStudentSectionGroups(list);
  }, [report]);

  useEffect(() => {
    if (selectedSectionKey !== 'all' && !sectionGroups.some(g => g.key === selectedSectionKey)) {
      setSelectedSectionKey('all');
    }
  }, [selectedSectionKey, sectionGroups]);

  const activeSectionGroup = useMemo(
    () => (selectedSectionKey === 'all' ? null : sectionGroups.find(g => g.key === selectedSectionKey) || null),
    [selectedSectionKey, sectionGroups]
  );

  const sectionScopedReport = useMemo(() => {
    if (activeSectionGroup) return activeSectionGroup.students;
    if (sectionGroups.length > 0) return sectionGroups.flatMap(g => g.students);
    return report;
  }, [activeSectionGroup, sectionGroups, report]);

  const handleSectionSelect = (key: string) => {
    setSelectedSectionKey(key);
    setCurrentPage(1);
  };

  // Grade Distribution & Analytics Calculation (คำนวณตามขอบเขตห้องย่อยที่เลือก)
  const analytics = useMemo(() => {
    if (!sectionScopedReport || sectionScopedReport.length === 0) {
      return { gpa: '0.00', passRate: 0, passCount: 0, failCount: 0, krCount: 0, ksCount: 0, msCount: 0, distribution: {} as Record<string, number> };
    }

    const dist: Record<string, number> = {};
    let numericGradeSum = 0;
    let numericGradeCount = 0;
    let passCount = 0;
    let failCount = 0;
    let krCount = 0;
    let ksCount = 0;
    let msCount = 0;

    sectionScopedReport.forEach(student => {
      const g = student.grade || 'ไม่มีเกรด';
      dist[g] = (dist[g] || 0) + 1;

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
    const passRate = sectionScopedReport.length > 0 ? Math.round((passCount / sectionScopedReport.length) * 100) : 0;

    return { gpa, passRate, passCount, failCount, krCount, ksCount, msCount, distribution: dist };
  }, [sectionScopedReport]);

  // Filtered student list (ตามขอบเขตห้องย่อยที่เลือก)
  const filteredReport = useMemo(() => {
    return sectionScopedReport.filter(student => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        student.name.toLowerCase().includes(q) ||
        (student.student_code && student.student_code.toLowerCase().includes(q)) ||
        (student.grade_level && student.grade_level.toLowerCase().includes(q)) ||
        (student.branch && student.branch.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (gradeFilter === 'ALL') return true;
      if (gradeFilter === 'KR') return student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
      if (gradeFilter === 'KS') return student.grade === 'ข.ส.' || student.is_absent_final;
      if (gradeFilter === 'MS') return student.grade === 'ม.ส.' || student.is_incomplete;
      if (gradeFilter === 'FAIL') return student.grade === '0' || student.grade === 'F' || student.grade === 'ข.ร.' || student.grade === 'ข.ส.' || student.grade === 'ม.ส.' || student.is_f;
      return student.grade === gradeFilter;
    });
  }, [sectionScopedReport, searchQuery, gradeFilter]);

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
  const exportStd02 = async (fileType: 'xlsx' | 'csv' = 'xlsx') => {
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
      `จิตพิสัย (${weights.affective_weight}%)`,
      `สอบย่อย (${weights.post_test_weight}%)`,
      `งานเก็บ (${weights.assignment_weight}%)`,
      `กลางภาค (${weights.midterm_weight}%)`,
      `ปลายภาค (${weights.final_weight}%)`,
      'รวมคะแนน (100)',
      'ระดับผลการเรียน',
      'เวลาเรียน (%)',
      'หมายเหตุ'
    ];

    const buildRowsForList = (studentsList: ReportStudent[]) => {
      return studentsList.map((student, idx) => {
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
          Number(student.affective_score || 0).toFixed(1),
          Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1),
          Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1),
          Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1),
          finalDisplay,
          totalDisplay,
          student.grade || '0',
          `${student.attendance_percent ?? 100}%`,
          remark
        ];
      });
    };

    const targetStudents = sectionScopedReport;
    const rows = buildRowsForList(targetStudents);

    if (fileType === 'xlsx') {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const colWidths = [
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

        if (selectedSectionKey !== 'all' && activeSectionGroup) {
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          ws['!cols'] = colWidths;
          XLSX.utils.book_append_sheet(wb, ws, activeSectionGroup.shortSheetName);
          XLSX.writeFile(wb, `ศธ02_ผลการเรียน_${cleanClassName}_${activeSectionGroup.shortSheetName}.xlsx`);
        } else if (hasMultipleSections) {
          // รวมทุกห้องเป็นแผ่นแรก
          const wsAll = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          wsAll['!cols'] = colWidths;
          XLSX.utils.book_append_sheet(wb, wsAll, 'รวมทุกห้อง');

          // แยกแผ่นงานตามแต่ละห้องย่อย
          sectionGroups.forEach(grp => {
            const grpRows = buildRowsForList(grp.students);
            const wsGrp = XLSX.utils.aoa_to_sheet([headers, ...grpRows]);
            wsGrp['!cols'] = colWidths;
            XLSX.utils.book_append_sheet(wb, wsGrp, grp.shortSheetName);
          });
          XLSX.writeFile(wb, `ศธ02_ผลการเรียน_${cleanClassName}_แยกห้องย่อย.xlsx`);
        } else {
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          ws['!cols'] = colWidths;
          XLSX.utils.book_append_sheet(wb, ws, 'ศธ.02 ผลการเรียน');
          XLSX.writeFile(wb, `ศธ02_ผลการเรียน_${cleanClassName}.xlsx`);
        }

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
    const csvSuffix = activeSectionGroup ? `_${activeSectionGroup.shortSheetName}` : '';
    link.href = url;
    link.setAttribute('download', `ศธ02_ผลการเรียน_${cleanClassName}${csvSuffix}.csv`);
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
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      <p className="text-xs text-slate-500">กำลังโหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up pb-24">
      {/* ==================== PAGE HEADER ==================== */}


      {/* Active Classroom Bar (เมื่อเลือกห้องเรียนแล้ว) */}
      {selectedClass && activeParsed && (
        <div className="glass dark:bg-slate-900/85 p-5 sm:p-6 rounded-3xl border border-purple-100/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 shadow-xl shadow-purple-100/20 dark:shadow-black/40 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeParsed.code && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                      {activeParsed.code}
                    </span>
                  )}
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${activeParsed.curriculumType === 'pvs' || weights.is_pws || classroomObj?.name?.includes('ปวส')
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    }`}>
                    {activeParsed.curriculumType === 'pvs' || weights.is_pws || classroomObj?.name?.includes('ปวส')
                      ? `ปวส. (${weights.target_weeks || 15} สัปดาห์)`
                      : `ปวช. (${weights.target_weeks || 18} สัปดาห์)`}
                  </span>
                  {activeParsed.groupName && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shadow-2xs">
                      {activeParsed.groupName}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                    (👥 {classroomObj?.student_count || report.length || 0} คน)
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-tight mt-1 truncate" title={activeParsed.subjectTitle}>
                  {activeParsed.subjectTitle}
                </h2>
              </div>
            </div>

            {/* Quick Switch / เปลี่ยนห้อง & Settings button */}
            <div className="flex items-center gap-2 shrink-0 self-start lg:self-center flex-wrap">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`btn px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${showSettings
                  ? 'btn-primary shadow-md shadow-purple-500/20'
                  : 'bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700'
                  }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>ตั้งค่าเกณฑ์ & น้ำหนัก</span>
              </button>

              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="form-input text-xs font-bold py-2 pl-3 pr-8 bg-white/90 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 rounded-xl focus:border-purple-400 focus:ring focus:ring-purple-200/50 transition-all text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs max-w-[200px] sm:max-w-[260px] truncate"
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
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-purple-50/80 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-slate-700 transition-all shadow-xs cursor-pointer shrink-0"
                title="ย้อนกลับไปดูการ์ดห้องเรียนทั้งหมด"
              >
                <Grid className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>การ์ดทั้งหมด</span>
              </button>
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
                  onSelectSection={handleSectionSelect}
                  totalStudentsCount={report.length}
                  sharedBranch={sharedBranch}
                  themeColor="purple"
                  label="แยกห้องตัดเกรด:"
                  rightContent={
                    activeSectionGroup ? (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        กำลังดูผลการเรียนห้อง: <span className="text-purple-700 font-extrabold bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200/70">{activeSectionGroup.label}</span>
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
          title="เลือกห้องเรียนเพื่อดูผลการเรียนและตัดเกรด"
          subtitle=""
          icon={<Award className="w-6 h-6" />}
          themeColor="purple"
          actionText="ดูผลการเรียน & ตัดเกรด"
          customCardStat={(_c) => (
            <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-purple-700 font-semibold">
              <span>เกณฑ์ประเมิน</span>
              <span>สัดส่วน 100% · 8 ระดับ</span>
            </div>
          )}
        />
      ) : loadingGrades ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500">กำลังประมวลผลข้อมูลเกรดและคะแนน...</p>
        </div>
      ) : showSettings ? (
        <GradesSettingsDrawer
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          weights={weights}
          setWeights={setWeights}
          criteria={criteria}
          setCriteria={setCriteria}
          defaultCriteria={DEFAULT_CRITERIA}
          onSave={() => saveCriteriaMutation.mutate()}
          isSaving={saveCriteriaMutation.isPending}
        />
      ) : report.length === 0 ? (
        <div className="glass p-12 text-center rounded-3xl border border-indigo-100 bg-white">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">ไม่พบข้อมูลนักเรียนในห้องนี้</h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">กรุณาเพิ่มรายชื่อนักเรียนในเมนู <strong>&quot;จัดการนักเรียน&quot;</strong> ก่อน</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ==================== ANALYTICS SUMMARY CARDS & DISTRIBUTION ==================== */}
          <GradesAnalyticsHeader
            analytics={analytics}
            totalStudents={report.length}
            gradeFilter={gradeFilter}
            setGradeFilter={setGradeFilter}
          />

          {/* ==================== MAIN GRADEBOOK TOOLBAR & ACTIONS ==================== */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 max-w-xl">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ, รหัส หรือห้องย่อย..."
                      className="w-full text-xs pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 rounded-xl shadow-2xs"
                    />
                  </div>

                  <select
                    value={gradeFilter}
                    onChange={e => setGradeFilter(e.target.value)}
                    className="text-xs py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 rounded-xl shadow-2xs min-w-[130px]"
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
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      title="มุมมองตาราง (Table View)"
                      aria-label="มุมมองตาราง"
                    >
                      <TableIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      title="มุมมองการ์ด (Card View)"
                      aria-label="มุมมองการ์ด"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>


              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => exportStd02('xlsx')}
                    className="btn bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Export ศธ.02 (Excel)</span>
                  </button>

                  <button
                    onClick={() => setShowCsvPreviewModal(true)}
                    className="btn bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>พรีวิว CSV</span>
                  </button>

                  <button
                    onClick={() => setShowPdfPreviewModal(true)}
                    className="btn bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    <span>พิมพ์ PDF</span>
                  </button>

                  <button
                    onClick={autoCalculateAffective}
                    className="btn bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>คำนวณจิตพิสัยออโต้</span>
                  </button>
                </div>

                <button
                  onClick={() => saveExamsMutation.mutate()}
                  disabled={saveExamsMutation.isPending}
                  className={`btn text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-md transition-all ${hasUnsavedChanges
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
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-900/95 border-b-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold sticky top-0 z-20 backdrop-blur-md">
                      <th className="py-2.5 px-1.5 w-20 text-center text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">รหัส</th>
                      <th
                        className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 sticky left-0 bg-slate-100/95 dark:bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] text-slate-700 dark:text-slate-200 whitespace-nowrap"
                        style={activeNameStyle}
                      >
                        ชื่อ-นามสกุล
                      </th>
                      <th className="py-2.5 px-1 text-center w-[90px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/90 dark:border-pink-900/60 font-bold text-xs shadow-2xs">
                          <span>จิตพิสัย</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-pink-100 dark:bg-pink-900/70 font-semibold">{weights.affective_weight}%</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1 text-center w-[90px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/90 dark:border-amber-900/60 font-bold text-xs shadow-2xs">
                          <span>สอบย่อย</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-900/70 font-semibold">{weights.post_test_weight}%</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1 text-center w-[90px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-900/60 font-bold text-xs shadow-2xs">
                          <span>งานเก็บ</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/70 font-semibold">{weights.assignment_weight}%</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1 text-center w-[92px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/90 dark:border-cyan-900/60 font-bold text-xs shadow-2xs">
                          <span>กลางภาค</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-cyan-100 dark:bg-cyan-900/70 font-semibold">{weights.midterm_weight}%</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1 text-center w-[96px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/90 dark:border-blue-900/60 font-bold text-xs shadow-2xs">
                          <span>ปลายภาค</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/70 font-semibold">{weights.final_weight}%</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1 text-center w-[76px] border-r border-slate-200 dark:border-slate-800">
                        <div className="whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-900/60 font-bold text-xs shadow-2xs">
                          <span>รวม</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/70 font-semibold">100</span>
                        </div>
                      </th>
                      <th className="py-2.5 px-1.5 text-center w-[66px]">
                        <div className="whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs shadow-2xs">
                          <span>เกรด</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {paginatedReport.map((student, idx) => {
                      const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
                      const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
                      const isKs = student.grade === 'ข.ส.' || student.is_absent_final || student.final_score === -1;
                      const isMs = student.grade === 'ม.ส.' || student.is_incomplete || student.final_score === -2;
                      const isAtRisk = !isKr && !isKs && !isMs && (totalScore < 50 || (student.remaining_absences !== undefined && student.remaining_absences <= 2 && student.remaining_absences >= 0));

                      let rowClass = 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50';
                      let stickyClass = 'bg-white dark:bg-slate-900';
                      let borderAccent = 'border-l-4 border-l-transparent';

                      if (isKr) {
                        rowClass = 'bg-rose-50/25 dark:bg-rose-950/20 hover:bg-rose-50/45 dark:hover:bg-rose-950/30';
                        stickyClass = 'bg-rose-50/50 dark:bg-slate-900';
                        borderAccent = 'border-l-4 border-l-rose-500';
                      } else if (isKs) {
                        rowClass = 'bg-amber-50/25 dark:bg-amber-950/20 hover:bg-amber-50/45 dark:hover:bg-amber-950/30';
                        stickyClass = 'bg-amber-50/50 dark:bg-slate-900';
                        borderAccent = 'border-l-4 border-l-amber-500';
                      } else if (isMs) {
                        rowClass = 'bg-purple-50/25 dark:bg-purple-950/20 hover:bg-purple-50/45 dark:hover:bg-purple-950/30';
                        stickyClass = 'bg-purple-50/50 dark:bg-slate-900';
                        borderAccent = 'border-l-4 border-l-purple-500';
                      } else if (isAtRisk) {
                        rowClass = 'bg-amber-50/15 dark:bg-amber-950/10 hover:bg-amber-50/30 dark:hover:bg-amber-950/20';
                        stickyClass = 'bg-amber-50/30 dark:bg-slate-900';
                        borderAccent = 'border-l-4 border-l-amber-400';
                      } else if (idx % 2 === 1) {
                        rowClass = 'bg-slate-50/40 dark:bg-slate-800/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/50';
                        stickyClass = 'bg-slate-50/60 dark:bg-slate-900';
                      }

                      return (
                        <tr
                          key={student.student_id}
                          className={`transition-colors ${rowClass} ${borderAccent}`}
                        >
                          <td className="py-2 px-1 text-slate-500 dark:text-slate-400 font-semibold text-center font-mono text-xs whitespace-nowrap">
                            {student.student_code || '-'}
                          </td>
                          <td
                            className={`py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-10 ${stickyClass} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]`}
                            style={activeNameStyle}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <UserAvatar
                                  avatar={student.avatar}
                                  name={student.name}
                                  userId={student.student_id}
                                  size="sm"
                                  className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate" title={student.name}>
                                      {student.name}
                                    </span>
                                    {student.grade_level && (
                                      <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                                        {student.grade_level}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    #{student.student_code || '-'}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {isKr && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[9px] font-extrabold border border-rose-200 dark:border-rose-800">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" /> ข.ร.
                                  </span>
                                )}
                                {isKs && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold border border-amber-200 dark:border-amber-800">
                                    <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> ข.ส.
                                  </span>
                                )}
                                {isMs && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 text-[9px] font-extrabold border border-purple-200 dark:border-purple-800">
                                    <AlertCircle className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" /> ม.ส.
                                  </span>
                                )}
                                {isAtRisk && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold border border-amber-200 dark:border-amber-800">
                                    ขาดได้อีก {student.remaining_absences}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Affective Editable Score */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            <input
                              type="number" step="0.5" min="0" max={weights.affective_weight}
                              value={student.affective_score ?? ''}
                              onChange={e => handleExamScoreChange(student.student_id, 'affective_score', e.target.value)}
                              className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-pink-200 dark:border-pink-900/60 bg-white dark:bg-slate-800 text-pink-700 dark:text-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 shadow-2xs transition-all mx-auto"
                              placeholder="0"
                            />
                          </td>

                          {/* Raw & Scaled Post-test Breakdown */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            <div className="font-black text-amber-600 dark:text-amber-400 text-xs font-mono">{Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">ดิบ: {Number(student.raw_post_test || 0).toFixed(1)}/{student.max_post_test || 0}</div>
                          </td>

                          {/* Raw & Scaled Assignment Breakdown */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs font-mono">{Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">ดิบ: {Number(student.raw_assign || 0).toFixed(1)}/{student.max_assign || 0}</div>
                          </td>

                          {/* Midterm Editable Score */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            <div className="flex flex-col items-center">
                              <input
                                type="number" step="0.5" min="0" max={weights.midterm_max_score}
                                value={student.midterm_score ?? ''}
                                onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                                className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 shadow-2xs transition-all mx-auto"
                                placeholder="0"
                              />
                              <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold mt-0.5 font-mono">ได้: {Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1)}</div>
                            </div>
                          </td>

                          {/* Final Editable Score with Std02 Vocational Controls */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            {student.final_score === -1 || student.is_absent_final ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-amber-500 text-white shadow-xs">
                                  ข.ส.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                                >
                                  กรอกคะแนน
                                </button>
                              </div>
                            ) : student.final_score === -2 || student.is_incomplete ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-purple-600 text-white shadow-xs">
                                  ม.ส.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                                >
                                  กรอกคะแนน
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number" step="0.5" min="0" max={weights.final_max_score}
                                  value={student.final_score ?? ''}
                                  onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                                  className="text-center font-bold font-mono text-xs w-14 py-1 px-1 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs transition-all mx-auto"
                                  placeholder="0"
                                />
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 font-mono">ได้: {Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1)}</div>
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  <button
                                    type="button"
                                    title="ทำเครื่องหมายขาดสอบ (ข.ส.)"
                                    onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-1')}
                                    className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/80 border border-amber-200 dark:border-amber-800 transition-colors"
                                  >
                                    ข.ส.
                                  </button>
                                  <button
                                    type="button"
                                    title="ทำเครื่องหมายผลการเรียนไม่สมบูรณ์ (ม.ส.)"
                                    onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-2')}
                                    className="px-1 py-0.2 rounded text-[8px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 transition-colors"
                                  >
                                    ม.ส.
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Precise Total Score */}
                          <td className="py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800/80">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-slate-100 text-xs font-mono shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
                              {totalScore.toFixed(1)}
                            </span>
                          </td>

                          {/* Grade Pill Badge */}
                          <td className="py-2 px-1 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg font-black text-xs shadow-xs transition-transform hover:scale-105 ${getGradeStyle(student.grade)}`}>
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
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {paginatedReport.map((student) => {
                    const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
                    const isKr = student.is_f || student.grade === 'ข.ร.' || student.grade === 'ขร';
                    const isKs = student.grade === 'ข.ส.' || student.is_absent_final || student.final_score === -1;
                    const isMs = student.grade === 'ม.ส.' || student.is_incomplete || student.final_score === -2;

                    return (
                    <div
                      key={student.student_id}
                      className={`p-4 rounded-3xl border transition-all space-y-3 ${isKr
                        ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60'
                        : isKs
                          ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60'
                          : isMs
                            ? 'bg-purple-50/70 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900/60'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-slate-600 shadow-xs'
                        }`}
                    >
                      {/* Card Header: Avatar, Name, Student Code, Grade Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            avatar={student.avatar}
                            name={student.name}
                            userId={student.student_id}
                            size="md"
                            className="rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{student.name}</h4>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">รหัส: {student.student_code || '-'}</p>
                              {student.grade_level && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-800">
                                  {student.grade_level}
                                </span>
                              )}
                            </div>
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              ⚠️ หมดสิทธิ์สอบ (ข.ร.)
                            </span>
                          )}
                          {isKs && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              ⚠️ ขาดสอบ (ข.ส.)
                            </span>
                          )}
                          {isMs && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              ⚠️ ผลการเรียนไม่สมบูรณ์ (ม.ส.)
                            </span>
                          )}
                          {!isKr && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              ขาดได้อีก {student.remaining_absences} ครั้ง
                            </span>
                          )}
                        </div>
                      )}

                      {/* Scores Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="p-2.5 rounded-2xl bg-pink-50/50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/50">
                          <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300 uppercase">จิตพิสัย ({weights.affective_weight}%)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5" min="0" max={weights.affective_weight}
                            value={student.affective_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'affective_score', e.target.value)}
                            className="form-input text-center py-1.5 px-1 w-full text-pink-900 dark:text-pink-200 font-bold border-pink-200 dark:border-pink-800 focus:border-pink-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
                            placeholder="0"
                          />
                        </div>

                        <div className="p-2.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">สอบย่อย ({weights.post_test_weight}%)</span>
                          <div className="font-extrabold text-amber-800 dark:text-amber-200 text-base font-mono">
                            {Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">ดิบ {Number(student.raw_post_test || 0).toFixed(0)}/{student.max_post_test || 0}</span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">งานเก็บ ({weights.assignment_weight}%)</span>
                          <div className="font-extrabold text-emerald-800 dark:text-emerald-200 text-base font-mono">
                            {Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">ดิบ {Number(student.raw_assign || 0).toFixed(0)}/{student.max_assign || 0}</span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
                          <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase">กลางภาค ({weights.midterm_weight}%)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5" min="0" max={weights.midterm_max_score}
                            value={student.midterm_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                            className="form-input text-center py-1.5 px-1 w-full text-cyan-900 dark:text-cyan-200 font-bold border-cyan-200 dark:border-cyan-800 focus:border-cyan-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
                            placeholder="0"
                          />
                        </div>

                        <div className="p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">ปลายภาค ({weights.final_weight}%)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="ขาดสอบ (ข.ส.)"
                                onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-1')}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-800 dark:hover:text-amber-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
                              >
                                ข.ส.
                              </button>
                              <button
                                type="button"
                                title="ไม่สมบูรณ์ (ม.ส.)"
                                onClick={() => handleExamScoreChange(student.student_id, 'final_score', '-2')}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-950/60 hover:text-purple-800 dark:hover:text-purple-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
                              >
                                ม.ส.
                              </button>
                            </div>
                          </div>
                          {student.final_score === -1 || student.is_absent_final ? (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-600 text-white inline-block shadow-2xs">ข.ส.</span>
                              <button type="button" onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold">แก้คะแนน</button>
                            </div>
                          ) : student.final_score === -2 || student.is_incomplete ? (
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-purple-600 text-white inline-block shadow-2xs">ม.ส.</span>
                              <button type="button" onClick={() => handleExamScoreChange(student.student_id, 'final_score', '0')} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold">แก้คะแนน</button>
                            </div>
                          ) : (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5" min="0" max={weights.final_max_score}
                              value={student.final_score ?? ''}
                              onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                              className="form-input text-center py-1.5 px-1 w-full text-blue-900 dark:text-blue-200 font-bold border-blue-200 dark:border-blue-800 focus:border-blue-500 text-base md:text-xs rounded-xl bg-white dark:bg-slate-800 mt-1"
                              placeholder="0"
                            />
                          )}
                        </div>

                        <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex flex-col justify-center text-center">
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">รวม (100)</span>
                          <span className="text-lg font-black text-indigo-900 dark:text-indigo-200 font-mono">{totalScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Pagination Footer */}
            {filteredReport.length > 0 && (
              <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
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
            report={sectionScopedReport}
            weights={weights}
            criteria={criteria}
            teacherNameDefault={user?.name || 'ครูผู้สอน'}
          />
          <GradeCsvModal
            isOpen={showCsvPreviewModal}
            onClose={() => setShowCsvPreviewModal(false)}
            classroom={classroomObj}
            report={sectionScopedReport}
            weights={weights}
          />
        </>
      )}
    </div>
  );
}
