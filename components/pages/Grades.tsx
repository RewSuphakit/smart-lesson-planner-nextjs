'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { 
  Loader2, BookOpen, Save, Settings, AlertCircle, TrendingUp, Plus, Trash2, 
  FileSpreadsheet, Printer, Zap, AlertTriangle, Search, Filter, Award, CheckCircle2, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';

interface Classroom {
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

interface Criterion {
  grade: string;
  min_score: number;
}

interface ReportStudent {
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
  scaled_final?: number;
  precise_scaled_final?: number;
  affective_score?: number | string;
  is_f?: boolean;
  total_score_precise?: number;
  total_score?: number | string;
  percentage?: string;
  grade?: string;
  absent_count?: number;
  late_count?: number;
  max_allowed_absences?: number;
  remaining_absences?: number;
}

interface Weights {
  assignment_weight: number;
  post_test_weight: number;
  affective_weight: number;
  midterm_weight: number;
  final_weight: number;
  midterm_max_score: number;
  final_max_score: number;
}

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

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

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
      return { gpa: '0.00', passRate: 0, passCount: 0, failCount: 0, msCount: 0, distribution: {} as Record<string, number> };
    }

    const dist: Record<string, number> = {};
    let totalScoreSum = 0;
    let numericGradeSum = 0;
    let numericGradeCount = 0;
    let passCount = 0;
    let failCount = 0;
    let msCount = 0;

    report.forEach(student => {
      const g = student.grade || 'ไม่มีเกรด';
      dist[g] = (dist[g] || 0) + 1;
      const score = Number(student.total_score_precise ?? student.total_score ?? 0);
      totalScoreSum += score;

      if (g === 'มส' || student.is_f) {
        msCount++;
        failCount++;
      } else if (g === '0' || g === 'F' || g === 'ไม่มีเกรด') {
        failCount++;
      } else {
        passCount++;
      }

      // Calculate GPA if numeric grade
      const numG = parseFloat(g);
      if (!isNaN(numG)) {
        numericGradeSum += numG;
        numericGradeCount++;
      }
    });

    const gpa = numericGradeCount > 0 ? (numericGradeSum / numericGradeCount).toFixed(2) : '0.00';
    const passRate = report.length > 0 ? Math.round((passCount / report.length) * 100) : 0;

    return { gpa, passRate, passCount, failCount, msCount, distribution: dist };
  }, [report]);

  // Filtered student list
  const filteredReport = useMemo(() => {
    return report.filter(student => {
      const matchesSearch = !searchQuery.trim() || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (student.student_code && student.student_code.includes(searchQuery));
      
      if (!matchesSearch) return false;

      if (gradeFilter === 'ALL') return true;
      if (gradeFilter === 'MS') return student.is_f || student.grade === 'มส';
      if (gradeFilter === 'FAIL') return student.grade === '0' || student.grade === 'F' || student.grade === 'มส';
      return student.grade === gradeFilter;
    });
  }, [report, searchQuery, gradeFilter]);

  // Paginated report subset
  const paginatedReport = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReport.slice(start, start + itemsPerPage);
  }, [filteredReport, currentPage, itemsPerPage]);

  const handleExamScoreChange = (studentId: string, field: 'midterm_score' | 'final_score' | 'affective_score', value: string) => {
    setReport(prev => prev.map(student => {
      if (student.student_id === studentId) {
        let valNum: number | string = value === '' ? '' : parseFloat(value);
        if (typeof valNum === 'number' && valNum < 0) {
          valNum = 0;
        }
        const updatedStudent = { ...student, [field]: valNum };
        
        const mScore = Math.max(0, parseFloat(String(updatedStudent.midterm_score)) || 0);
        const fScore = Math.max(0, parseFloat(String(updatedStudent.final_score)) || 0);
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
          finalGrade = 'มส';
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
        final_score: s.final_score === '' || s.final_score === undefined || s.final_score === null ? 0 : Number(s.final_score),
        affective_score: s.affective_score === undefined || s.affective_score === null ? null : Number(s.affective_score)
      }));
      return api.put('/students/exams', { scores });
    },
    onSuccess: () => {
      toast.success('บันทึกคะแนนสอบและจิตพิสัยสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['grades', selectedClass] });
    },
    onError: () => {
      toast.error('บันทึกคะแนนสอบไม่สำเร็จ');
    },
  });

  // Auto calculate affective scores from attendance data
  const autoCalculateAffective = () => {
    let count = 0;
    setReport(prev => prev.map(student => {
      const absent = student.absent_count || 0;
      const late = student.late_count || 0;
      const autoScore = Math.max(0, weights.affective_weight - (absent * 2) - (late * 1));
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
        finalGrade = 'มส';
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
    toast.success(`คำนวณจิตพิสัยอัตโนมัติเสร็จ ${count} คน`);
  };

  // Print PDF report
  const printReport = () => {
    const classroomName = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '';
    const gradeCounts: Record<string, number> = {};
    let passCount = 0, failCount = 0;
    let totalScoreSum = 0;
    report.forEach(s => {
      const g = s.grade || 'ไม่มีเกรด';
      gradeCounts[g] = (gradeCounts[g] || 0) + 1;
      const sc = Number(s.total_score_precise ?? s.total_score ?? 0);
      totalScoreSum += sc;
      if (g === '0' || g === 'F' || g === 'มส' || g === 'ไม่มีเกรด') failCount++;
      else passCount++;
    });
    const avg = report.length > 0 ? (totalScoreSum / report.length).toFixed(2) : '0';

    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>รายงานผลการเรียน ${classroomName}</title>
    <style>
      body { font-family: 'Sarabun', 'Segoe UI', sans-serif; padding: 20px; color: #333; }
      h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
      h2 { text-align: center; font-size: 14px; font-weight: normal; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
      th { background: #f0f0f0; font-weight: bold; }
      td.name { text-align: left; }
      .fail { background: #fee2e2; }
      .ms { background: #fef2f2; color: #dc2626; font-weight: bold; }
      .stats { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 12px; }
      .stat-card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; min-width: 100px; }
      .stat-label { font-size: 10px; color: #666; }
      .stat-value { font-size: 16px; font-weight: bold; }
      .grade-dist { margin-top: 12px; }
      .grade-dist td { padding: 3px 8px; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>รายงานผลการเรียนและตัดเกรด</h1>
    <h2>ห้องเรียน: ${classroomName} | จำนวน ${report.length} คน</h2>
    <table>
      <thead><tr>
        <th>ลำดับ</th><th>รหัส</th><th>ชื่อ-นามสกุล</th>
        <th>งานเก็บ (${weights.assignment_weight})</th>
        <th>สอบย่อย (${weights.post_test_weight})</th>
        <th>กลางภาค (${weights.midterm_weight})</th>
        <th>ปลายภาค (${weights.final_weight})</th>
        <th>จิตพิสัย (${weights.affective_weight})</th>
        <th>รวม (100)</th><th>เกรด</th>
      </tr></thead>
      <tbody>${report.map((s, i) => {
        const isMs = s.grade === 'มส' || s.is_f;
        const isFail = s.grade === '0' || s.grade === 'F' || isMs;
        return `<tr class="${isMs ? 'ms' : isFail ? 'fail' : ''}">
          <td>${i + 1}</td>
          <td>${s.student_code || '-'}</td>
          <td class="name">${s.name}</td>
          <td>${Number(s.precise_scaled_assign || s.scaled_assign || 0).toFixed(1)}</td>
          <td>${Number(s.precise_scaled_post_test || s.scaled_post_test || 0).toFixed(1)}</td>
          <td>${Number(s.precise_scaled_midterm || s.scaled_midterm || 0).toFixed(1)}</td>
          <td>${Number(s.precise_scaled_final || s.scaled_final || 0).toFixed(1)}</td>
          <td>${Number(s.affective_score || 0).toFixed(1)}</td>
          <td><strong>${Number(s.total_score_precise ?? s.total_score ?? 0).toFixed(1)}</strong></td>
          <td><strong>${s.grade}</strong></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div class="stats">
      <div class="stat-card"><div class="stat-label">คะแนนเฉลี่ย</div><div class="stat-value">${avg}</div></div>
      <div class="stat-card"><div class="stat-label">ผ่าน</div><div class="stat-value" style="color:green">${passCount} คน</div></div>
      <div class="stat-card"><div class="stat-label">ไม่ผ่าน/มส</div><div class="stat-value" style="color:red">${failCount} คน</div></div>
    </div>
    <h3 style="margin-top:16px;font-size:13px">การกระจายเกรด</h3>
    <table class="grade-dist" style="width:auto">
      <thead><tr><th>เกรด</th><th>จำนวน (คน)</th><th>ร้อยละ</th></tr></thead>
      <tbody>${Object.entries(gradeCounts).map(([g, c]) =>
        `<tr><td><strong>${g}</strong></td><td>${c}</td><td>${(c / report.length * 100).toFixed(1)}%</td></tr>`
      ).join('')}</tbody>
    </table>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const exportCSV = () => {
    if (!report || report.length === 0) return;

    const headers = [
      'รหัสประจำตัว',
      'ชื่อ-นามสกุล',
      `งานเก็บ (${weights.assignment_weight})`,
      `สอบท้ายคาบ (${weights.post_test_weight})`,
      `กลางภาค (${weights.midterm_weight})`,
      `ปลายภาค (${weights.final_weight})`,
      `จิตพิสัย (${weights.affective_weight})`,
      'รวมคะแนน',
      'เกรด'
    ];

    const rows = report.map(student => [
      student.student_code || '-',
      student.name,
      Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1),
      Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1),
      Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1),
      Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1),
      Number(student.affective_score || 0).toFixed(1),
      Number(student.total_score_precise ?? student.total_score ?? 0).toFixed(1),
      student.grade
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const c = classrooms.find(cl => String(cl.id) === String(selectedClass));
    const className = c ? c.name : 'Unknown';
    
    link.setAttribute('download', `รายงานเกรด_${className}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
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
    if (grade === 'มส' || grade === 'F') return 'bg-rose-500 text-white shadow-rose-500/20';
    if (grade === '4' || grade === '3.5' || grade === '3' || grade === 'A') return 'bg-emerald-600 text-white shadow-emerald-500/20';
    if (grade === '2.5' || grade === '2' || grade === '1.5' || grade === '1' || grade === 'B' || grade === 'C') return 'bg-indigo-600 text-white shadow-indigo-500/20';
    if (grade === '0' || grade === 'D') return 'bg-amber-500 text-white shadow-amber-500/20';
    return 'bg-slate-100 text-slate-700';
  };

  if (loadingClassrooms) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Title & Classroom Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            ตัดเกรดและประมวลผลการเรียน (Grading)
          </h1>
          <p className="text-slate-500 text-sm">คำนวณคะแนนรวมตามสัดส่วนน้ำหนัก ตัดเกรดอัตโนมัติ พร้อมตรวจสิทธิ์เวลาเรียน (มส.)</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 shrink-0">ห้องเรียน:</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="form-input text-base py-2 font-medium bg-white border-indigo-200 focus:border-indigo-500 shadow-sm min-w-[220px]"
          >
            <option value="">-- เลือกห้องเรียน --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {selectedClass && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`btn flex items-center gap-1.5 ${showSettings ? 'btn-primary' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
            >
              <Settings className="w-4 h-4" /> ตั้งค่าเกณฑ์และน้ำหนัก
            </button>
          )}
        </div>
      </div>

      {!selectedClass ? (
        <div className="glass p-14 text-center rounded-2xl border border-indigo-100 bg-white">
          <BookOpen className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">กรุณาเลือกห้องเรียน</h3>
          <p className="text-slate-500 text-sm">เลือกห้องเรียนด้านบนเพื่อเริ่มดูสถิติและประมวลผลการตัดเกรด</p>
        </div>
      ) : loadingGrades ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : showSettings ? (
        <div className="glass p-6 rounded-2xl border border-indigo-100 bg-white space-y-6">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                ตั้งค่าน้ำหนักคะแนน และ เกณฑ์การตัดเกรด
              </h3>
              <p className="text-xs text-slate-500">ปรับแต่งสัดส่วนคะแนนรวม 100% และช่วงคะแนนสำหรับแต่ละเกรด</p>
            </div>
            <button onClick={() => setShowSettings(false)} className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs">
              ปิดการตั้งค่า
            </button>
          </div>

          {/* Real-Time Weight Balance Bar Section */}
          <div className="p-5 bg-gradient-to-br from-indigo-50/80 to-purple-50/40 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  สัดส่วนน้ำหนักคะแนน (รวม 5 ส่วนต้องเท่ากับ 100%)
                </h4>
                <p className="text-xs text-slate-500">ระบบจะนำคะแนนที่นักเรียนได้ มาแปลงตามสัดส่วนน้ำหนักคะแนนที่ตั้งไว้อัตโนมัติ</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">ผลรวมน้ำหนัก:</span>
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
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div style={{ width: `${Math.min(100, (weights.assignment_weight / 100) * 100)}%` }} className="bg-emerald-500 transition-all" title={`งานเก็บ ${weights.assignment_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.post_test_weight / 100) * 100)}%` }} className="bg-amber-500 transition-all" title={`สอบย่อย ${weights.post_test_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.midterm_weight / 100) * 100)}%` }} className="bg-cyan-500 transition-all" title={`กลางภาค ${weights.midterm_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.final_weight / 100) * 100)}%` }} className="bg-blue-500 transition-all" title={`ปลายภาค ${weights.final_weight}%`} />
              <div style={{ width: `${Math.min(100, (weights.affective_weight / 100) * 100)}%` }} className="bg-pink-500 transition-all" title={`จิตพิสัย ${weights.affective_weight}%`} />
            </div>

            {totalWeightSum !== 100 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {totalWeightSum < 100 
                    ? `ผลรวมน้ำหนักคะแนนขาดอีก ${100 - totalWeightSum}% กรุณาปรับเพิ่มให้ครบ 100% พอดี` 
                    : `ผลรวมน้ำหนักคะแนนเกินมา ${totalWeightSum - 100}% กรุณาปรับลดให้เหลือ 100% พอดี`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="bg-white p-3 rounded-xl border border-emerald-100">
                <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">งานเก็บ (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.assignment_weight} 
                  onChange={e => setWeights({...weights, assignment_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-emerald-800" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100">
                <label className="block text-[11px] font-bold text-amber-700 uppercase mb-1">สอบย่อย (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.post_test_weight} 
                  onChange={e => setWeights({...weights, post_test_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-amber-800" 
                  placeholder="30" 
                />
              </div>
              <div className="bg-white p-3 rounded-xl border border-cyan-100">
                <label className="block text-[11px] font-bold text-cyan-700 uppercase mb-1">กลางภาค (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.midterm_weight} 
                  onChange={e => setWeights({...weights, midterm_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-cyan-800" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100">
                <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">ปลายภาค (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.final_weight} 
                  onChange={e => setWeights({...weights, final_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-blue-800" 
                  placeholder="20" 
                />
              </div>
              <div className="bg-white p-3 rounded-xl border border-pink-100">
                <label className="block text-[11px] font-bold text-pink-700 uppercase mb-1">จิตพิสัย (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={weights.affective_weight} 
                  onChange={e => setWeights({...weights, affective_weight: parseFloat(e.target.value) || 0})}
                  className="form-input text-center font-bold text-pink-800" 
                  placeholder="10" 
                />
              </div>
            </div>
            
            {/* Max Scores for Exams */}
            <div className="pt-3 border-t border-indigo-100/60">
              <h5 className="font-semibold text-slate-700 mb-2 text-xs">กำหนดคะแนนเต็มสำหรับข้อสอบ (เพื่อใช้คิดสัดส่วนคำนวณ)</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-indigo-100">
                  <label className="text-xs font-semibold text-cyan-700 w-28 shrink-0">เต็ม กลางภาค:</label>
                  <input 
                    type="number" min="1"
                    value={weights.midterm_max_score} 
                    onChange={e => setWeights({...weights, midterm_max_score: parseFloat(e.target.value) || 0})}
                    className="form-input text-center font-bold text-slate-800 flex-1 py-1" 
                    placeholder="100" 
                  />
                </div>
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-indigo-100">
                  <label className="text-xs font-semibold text-blue-700 w-28 shrink-0">เต็ม ปลายภาค:</label>
                  <input 
                    type="number" min="1"
                    value={weights.final_max_score} 
                    onChange={e => setWeights({...weights, final_max_score: parseFloat(e.target.value) || 0})}
                    className="form-input text-center font-bold text-slate-800 flex-1 py-1" 
                    placeholder="100" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Criteria Settings Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
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
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  ใช้เกรดอักษร (A-F)
                </button>
                <button 
                  onClick={() => setCriteria([...defaultCriteria])}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                >
                  ใช้เกรดตัวเลข (4-0)
                </button>
              </div>
            </div>

            <div className="space-y-2 max-w-lg mb-6">
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">
                <div className="col-span-5">เกรด</div>
                <div className="col-span-5">คะแนนขั้นต่ำ (%)</div>
                <div className="col-span-2"></div>
              </div>
              {criteria.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={c.grade}
                      onChange={e => handleCriteriaChange(i, 'grade', e.target.value)}
                      className="form-input py-1.5 text-center font-bold text-slate-800"
                      placeholder="เช่น 4, A"
                    />
                  </div>
                  <div className="col-span-5 flex items-center gap-2">
                    <span className="text-slate-500 text-xs shrink-0 font-bold">≥</span>
                    <input
                      type="number"
                      value={c.min_score}
                      onChange={e => handleCriteriaChange(i, 'min_score', e.target.value)}
                      className="form-input py-1.5 font-semibold text-slate-800"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button onClick={() => removeCriteriaRow(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addCriteriaRow}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-bold p-2 rounded-lg hover:bg-indigo-50 transition-all"
              >
                <Plus className="w-4 h-4" /> เพิ่มระดับเกรด
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => saveCriteriaMutation.mutate()} disabled={saveCriteriaMutation.isPending} className="btn btn-primary flex items-center gap-2">
                {saveCriteriaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการตั้งค่า
              </button>
              <button onClick={() => setShowSettings(false)} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : report.length === 0 ? (
        <div className="glass p-14 text-center rounded-2xl border border-indigo-100 bg-white">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">ไม่พบข้อมูลนักเรียนในห้องนี้</h3>
          <p className="text-slate-500 text-sm mt-1">กรุณาเพิ่มรายชื่อนักเรียนในเมนู <strong>&quot;จัดการนักเรียน&quot;</strong> ก่อน</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                GPA
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">เกรดเฉลี่ยห้อง (GPA)</p>
                <div className="text-2xl font-black text-indigo-700">{analytics.gpa}</div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">อัตราผ่านเกณฑ์ (Pass Rate)</p>
                <div className="text-2xl font-black text-emerald-700">{analytics.passRate}% <span className="text-xs font-medium text-slate-500">({analytics.passCount}/{report.length} คน)</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-rose-50/80 to-pink-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">ขาดเรียนเกินสิทธิ์ (มส.)</p>
                <div className="text-2xl font-black text-rose-700">{analytics.msCount} <span className="text-xs font-medium text-slate-500">คน</span></div>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">จำนวนนักเรียนทั้งหมด</p>
                <div className="text-2xl font-black text-purple-700">{report.length} <span className="text-xs font-medium text-slate-500">คน</span></div>
              </div>
            </div>
          </div>

          {/* Grade Distribution Bar */}
          <div className="glass p-4 rounded-2xl border border-indigo-100 bg-white">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-500" />
              สถิติการกระจายเกรด (Grade Distribution Summary)
            </h4>
            <div className="flex flex-wrap gap-2">
              {['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'มส'].map(gKey => {
                const count = analytics.distribution[gKey] || 0;
                const isSelected = gradeFilter === gKey;
                return (
                  <button
                    key={gKey}
                    onClick={() => setGradeFilter(isSelected ? 'ALL' : gKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105' 
                        : 'bg-indigo-50/60 text-slate-700 border-indigo-100 hover:bg-indigo-100'
                    }`}
                  >
                    <span>เกรด {gKey}:</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white text-indigo-700' : 'bg-white text-slate-800 font-extrabold'}`}>
                      {count} คน
                    </span>
                  </button>
                );
              })}

              {gradeFilter !== 'ALL' && (
                <button
                  onClick={() => setGradeFilter('ALL')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                >
                  แสดงทั้งหมด
                </button>
              )}
            </div>
          </div>

          {/* Warning banner for missing max scores structure */}
          {report.length > 0 && report[0].max_assign === 0 && report[0].max_post_test === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-bold text-sm">⚠️ ยังไม่ได้บันทึกโครงสร้างคะแนนเต็ม!</p>
                <p className="text-amber-700 text-xs mt-1">ระบบยังไม่พบข้อมูลคะแนนเต็มงานเก็บและสอบย่อย กรุณาไปที่เมนู <strong>&quot;คะแนนเก็บและสอบ&quot;</strong> แล้วกดบันทึกโครงสร้างคะแนนเต็ม เพื่อให้คะแนนรวมคำนวณตรงสัดส่วน</p>
              </div>
            </div>
          )}

          {/* Main Gradebook Section */}
          <div className="glass overflow-hidden rounded-2xl border border-indigo-100 bg-white">
            <div className="p-4 border-b border-indigo-100 bg-indigo-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
                    className="form-input text-xs pl-9 py-1.5 bg-white border-indigo-100 focus:border-indigo-500 rounded-xl"
                  />
                </div>
                <select
                  value={gradeFilter}
                  onChange={e => setGradeFilter(e.target.value)}
                  className="form-input text-xs py-1.5 bg-white border-indigo-100 focus:border-indigo-500 rounded-xl min-w-[120px]"
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
                  <option value="MS">เฉพาะ มส.</option>
                  <option value="FAIL">ไม่ผ่าน / มส.</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button onClick={exportCSV} className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
                </button>
                <button onClick={printReport} className="btn bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-violet-600" /> พิมพ์ PDF
                </button>
                <button onClick={autoCalculateAffective} className="btn bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" /> คำนวณจิตพิสัย
                </button>
                <button onClick={() => saveExamsMutation.mutate()} disabled={saveExamsMutation.isPending} className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20">
                  {saveExamsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  บันทึกคะแนนสอบ
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-indigo-100/70 border-b border-indigo-200 text-slate-700 font-bold">
                    <th className="p-3 w-20 text-center">รหัส</th>
                    <th className="p-3 min-w-[160px]">ชื่อ-นามสกุล</th>
                    <th className="p-2 text-center border-l border-indigo-200 text-emerald-800 min-w-[100px]">
                      งานเก็บ
                      <div className="text-[10px] font-normal text-emerald-600">({weights.assignment_weight}%)</div>
                    </th>
                    <th className="p-2 text-center text-amber-800 min-w-[100px]">
                      สอบย่อย
                      <div className="text-[10px] font-normal text-amber-600">({weights.post_test_weight}%)</div>
                    </th>
                    <th className="p-2 text-center text-cyan-800 min-w-[90px]">
                      กลางภาค
                      <div className="text-[10px] font-normal text-cyan-600">({weights.midterm_weight}%)</div>
                    </th>
                    <th className="p-2 text-center text-blue-800 min-w-[90px]">
                      ปลายภาค
                      <div className="text-[10px] font-normal text-blue-600">({weights.final_weight}%)</div>
                    </th>
                    <th className="p-2 text-center text-pink-800 min-w-[90px]">
                      จิตพิสัย
                      <div className="text-[10px] font-normal text-pink-600">({weights.affective_weight}%)</div>
                    </th>
                    <th className="p-2 text-center bg-indigo-200/80 text-indigo-900 font-extrabold min-w-[80px]">
                      รวมคะแนน
                      <div className="text-[10px] font-normal text-indigo-700">(100)</div>
                    </th>
                    <th className="p-3 text-center min-w-[90px]">ระดับเกรด</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReport.map((student, idx) => {
                    const totalScore = Number(student.total_score_precise ?? student.total_score ?? 0);
                    const isMs = student.is_f || student.grade === 'มส';
                    const isAtRisk = !isMs && (totalScore < 50 || (student.remaining_absences !== undefined && student.remaining_absences <= 2 && student.remaining_absences >= 0));

                    return (
                      <tr 
                        key={student.student_id} 
                        className={`border-b border-indigo-50 hover:bg-indigo-50/60 transition-colors ${
                          isMs ? 'bg-rose-50/70' : isAtRisk ? 'bg-amber-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="p-2 text-slate-500 font-medium text-center">{student.student_code || '-'}</td>
                        <td className="p-2 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{student.name}</span>
                            {isMs && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold shrink-0 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" /> ขาดเรียนเกิน
                              </span>
                            )}
                            {isAtRisk && student.remaining_absences !== undefined && student.remaining_absences <= 2 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
                                <AlertCircle className="w-3 h-3 text-amber-600" /> ขาดได้อีก {student.remaining_absences} ครั้ง
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Raw & Scaled Scores Breakdown */}
                        <td className="p-2 text-center border-l border-indigo-100 bg-emerald-50/20">
                          <div className="font-bold text-emerald-700 text-sm">{Number(student.precise_scaled_assign || student.scaled_assign || 0).toFixed(1)}</div>
                          <div className="text-[10px] text-slate-400">ดิบ: {Number(student.raw_assign || 0).toFixed(1)}/{student.max_assign || 0}</div>
                        </td>

                        <td className="p-2 text-center bg-amber-50/20">
                          <div className="font-bold text-amber-700 text-sm">{Number(student.precise_scaled_post_test || student.scaled_post_test || 0).toFixed(1)}</div>
                          <div className="text-[10px] text-slate-400">ดิบ: {Number(student.raw_post_test || 0).toFixed(1)}/{student.max_post_test || 0}</div>
                        </td>

                        {/* Midterm Editable Score */}
                        <td className="p-2 text-center bg-cyan-50/20">
                          <input 
                            type="number" step="0.5" min="0" max={weights.midterm_max_score}
                            value={student.midterm_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                            className="form-input text-center py-0.5 px-1 w-16 mx-auto text-cyan-800 font-bold border-cyan-200 focus:border-cyan-500 text-xs" 
                            placeholder="0"
                          />
                          <div className="text-[10px] text-cyan-700 font-semibold mt-0.5">ได้: {Number(student.precise_scaled_midterm || student.scaled_midterm || 0).toFixed(1)}</div>
                        </td>

                        {/* Final Editable Score */}
                        <td className="p-2 text-center bg-blue-50/20">
                          <input 
                            type="number" step="0.5" min="0" max={weights.final_max_score}
                            value={student.final_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                            className="form-input text-center py-0.5 px-1 w-16 mx-auto text-blue-800 font-bold border-blue-200 focus:border-blue-500 text-xs" 
                            placeholder="0"
                          />
                          <div className="text-[10px] text-blue-700 font-semibold mt-0.5">ได้: {Number(student.precise_scaled_final || student.scaled_final || 0).toFixed(1)}</div>
                        </td>

                        {/* Affective Editable Score */}
                        <td className="p-2 text-center bg-pink-50/20">
                          <input 
                            type="number" step="0.5" min="0" max={weights.affective_weight}
                            value={student.affective_score ?? ''}
                            onChange={e => handleExamScoreChange(student.student_id, 'affective_score', e.target.value)}
                            className="form-input text-center py-0.5 px-1 w-16 mx-auto text-pink-800 font-bold border-pink-200 focus:border-pink-500 text-xs" 
                            placeholder="0"
                          />
                        </td>

                        {/* Precise Total Score */}
                        <td className="p-2 text-center bg-indigo-100/50">
                          <span className="font-extrabold text-indigo-900 text-sm">{totalScore.toFixed(1)}</span>
                        </td>

                        {/* Grade Pill Badge */}
                        <td className="p-2 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2.75rem] px-2.5 py-1 rounded-xl font-black text-xs shadow-md transition-transform hover:scale-105 ${getGradeStyle(student.grade)}`}>
                            {student.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredReport.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredReport.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

