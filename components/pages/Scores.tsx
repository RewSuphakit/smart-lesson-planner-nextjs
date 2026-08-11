'use client';

import { useState, useEffect, useMemo, useCallback, memo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Loader2, Save, FileText, Settings, Users, BookOpen, AlertCircle, Upload,
  Calculator, FileSpreadsheet, Grid, Table, CheckCircle2, TrendingUp,
  Award, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface MemoizedScoreInputProps {
  value: number | string;
  maxScore: number;
  focusColor: 'indigo' | 'amber';
  onChange: (value: string) => void;
}

const MemoizedScoreInput = memo(({ value, maxScore, focusColor, onChange }: MemoizedScoreInputProps) => {
  const [localVal, setLocalVal] = useState<string | number>(value ?? '');

  useEffect(() => {
    setLocalVal(value ?? '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    onChange(val);
  };

  const focusClass = focusColor === 'indigo'
    ? 'focus:border-indigo-500 focus:bg-indigo-50/50'
    : 'focus:border-amber-500 focus:bg-amber-50/50';

  return (
    <input
      type="number"
      step="0.5"
      min="0"
      max={maxScore}
      value={localVal}
      onChange={handleChange}
      className={`w-full text-center py-1.5 px-1 rounded border border-indigo-100 font-medium text-slate-800 text-xs sm:text-xs touch-manipulation focus:outline-none transition-colors ${focusClass}`}
    />
  );
});

MemoizedScoreInput.displayName = 'MemoizedScoreInput';

interface Classroom {
  id: string | number;
  name: string;
  total_classes?: number;
  assignment_weight?: number;
  post_test_weight?: number;
  affective_weight?: number;
  midterm_weight?: number;
  final_weight?: number;
  midterm_max_score?: number;
  final_max_score?: number;
}

interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  classroom_id?: string | number;
  midterm_score?: number | null;
  final_score?: number | null;
  affective_score?: number | null;
}

interface ScoreStructure {
  lesson_number: number;
  lesson_name: string;
  max_assignment_score: number;
  max_post_test_score: number;
  hours: number;
}

interface StudentScoreEntry {
  student_id: string | number;
  student_name?: string;
  lesson_number: number;
  assignment_score?: number;
  post_test_score?: number;
  midterm_score?: number;
  final_score?: number;
  affective_score?: number;
}

interface ScoreValue {
  assignment_score: number | string;
  post_test_score: number | string;
}

interface ScoresMap {
  [studentId: string]: ScoreValue;
}

interface FullMatrixScoresMap {
  [key: string]: {
    assignment_score: number | string;
    post_test_score: number | string;
  };
}

export default function Scores() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' or 'settings'
  const [viewMode, setViewMode] = useState<'matrix' | 'weekly'>('matrix'); // 'matrix' (ตารางรวมทั้งเทอม) vs 'weekly' (รายสัปดาห์)

  // Settings State
  const [structures, setStructures] = useState<ScoreStructure[]>([]);
  const [structureSavedInDB, setStructureSavedInDB] = useState(false);

  // Weekly Entry State
  const [selectedLesson, setSelectedLesson] = useState('');
  const [scores, setScores] = useState<ScoresMap>({});

  // Full Matrix State
  const [matrixScores, setMatrixScores] = useState<FullMatrixScoresMap>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);

  // Bulk Import State
  const [importData, setImportData] = useState<StudentScoreEntry[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importType, setImportType] = useState('assignment');

  // Test Blueprint Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [totalAcademicScore, setTotalAcademicScore] = useState(70);
  const [theoryHoursPerWeek, setTheoryHoursPerWeek] = useState(1);
  const [practiceHoursPerWeek, setPracticeHoursPerWeek] = useState(2);

  // Attendance Integration State
  const [showAttendance, setShowAttendance] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('full_matrix');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exporting, setExporting] = useState(false);
  const [filterCameOnly, setFilterCameOnly] = useState(false);

  // ─── Query: ดึงข้อมูลการเข้าเรียนตามวันที่ ───
  const { data: attendanceRecords = {} as Record<string, string>, isLoading: attendanceLoading } = useQuery<Record<string, string>>({
    queryKey: ['attendance-for-scores', selectedClass, attendanceDate],
    queryFn: async () => {
      const res = await api.get(`/attendance?classroom_id=${selectedClass}&date=${attendanceDate}`);
      const records = res.data.data || [];
      const mapping: Record<string, string> = {};
      records.forEach((r: { student_id: string | number; status: string }) => {
        mapping[String(r.student_id)] = r.status;
      });
      return mapping;
    },
    enabled: !!selectedClass && !!attendanceDate && showAttendance,
  });

  // ─── Query: ดึงข้อมูลห้องเรียน (shared cache) ───
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  const classroomObj = useMemo(() => {
    return classrooms.find(c => String(c.id) === String(selectedClass));
  }, [classrooms, selectedClass]);

  // ─── Composite Matrix Query: ดึงข้อมูลนักเรียน + โครงสร้างคะแนน + คะแนนทั้งหมด ───
  const { data: matrixData, isLoading: matrixLoading, refetch: refetchMatrix } = useQuery({
    queryKey: ['scores-matrix-data', selectedClass],
    queryFn: async () => {
      const res = await api.get(`/scores?classroom_id=${selectedClass}&mode=matrix`);
      return res.data.data || { classroom: null, students: [], structures: [], scores: [] };
    },
    enabled: !!selectedClass,
  });

  const students: Student[] = useMemo(() => matrixData?.students || [], [matrixData?.students]);

  // Sync Class Data and Structure
  useEffect(() => {
    if (matrixData) {
      const fetchedStructs = matrixData.structures || [];
      const total = classroomObj?.total_classes || 40;
      let targetWeeks = 18;
      if (classroomObj?.name?.includes('ปวส') || classroomObj?.name?.includes('ปวส.')) {
        targetWeeks = 15;
      } else if (classroomObj?.name?.includes('ปวช') || classroomObj?.name?.includes('ปวช.')) {
        targetWeeks = 18;
      } else {
        if (total % 18 !== 0) {
          for (let w = 15; w <= 20; w++) {
            if (total % w === 0) { targetWeeks = w; break; }
          }
        }
      }

      let finalStructs: ScoreStructure[];
      let savedInDB = false;
      if (fetchedStructs.length === 0) {
        finalStructs = Array.from({ length: targetWeeks }, (_, i) => ({
          lesson_number: i + 1,
          lesson_name: `บทที่/สัปดาห์ที่ ${i + 1}`,
          max_assignment_score: 10,
          max_post_test_score: 10,
          hours: 0
        }));
      } else {
        let adjustedStructs = [...fetchedStructs];
        if (adjustedStructs.length > targetWeeks) {
          adjustedStructs = adjustedStructs.slice(0, targetWeeks);
        } else if (adjustedStructs.length < targetWeeks) {
          const diff = targetWeeks - adjustedStructs.length;
          const startNum = adjustedStructs.length + 1;
          const padding = Array.from({ length: diff }, (_, i) => ({
            lesson_number: startNum + i,
            lesson_name: `บทที่/สัปดาห์ที่ ${startNum + i}`,
            max_assignment_score: 10,
            max_post_test_score: 10,
            hours: 0
          }));
          adjustedStructs = [...adjustedStructs, ...padding];
        }
        finalStructs = adjustedStructs;
        savedInDB = true;
      }

      setStructures(finalStructs);
      setStructureSavedInDB(savedInDB);

      // Build Matrix Scores Map
      const mScores: FullMatrixScoresMap = {};
      (matrixData.scores || []).forEach((s: {
        student_id: string | number;
        lesson_number: number;
        assignment_score: number | null;
        post_test_score: number | null;
      }) => {
        const key = `${s.student_id}_${s.lesson_number}`;
        mScores[key] = {
          assignment_score: s.assignment_score !== null ? s.assignment_score : '',
          post_test_score: s.post_test_score !== null ? s.post_test_score : ''
        };
      });
      setMatrixScores(mScores);

      // Set default selected lesson
      if (finalStructs.length > 0 && !selectedLesson) {
        setSelectedLesson(finalStructs[0].lesson_number.toString());
      }
    }
  }, [matrixData, classroomObj, selectedLesson]);

  // Reset state when class deselected
  useEffect(() => {
    if (!selectedClass) {
      setStructures([]);
      setSelectedLesson('');
      setScores({});
      setMatrixScores({});
    }
  }, [selectedClass]);

  // Sync single week scores
  useEffect(() => {
    if (!selectedClass || !selectedLesson) return;

    if (['midterm', 'final', 'affective'].includes(selectedLesson)) {
      const scoresMap: ScoresMap = {};
      students.forEach(s => {
        if (selectedLesson === 'midterm') {
          scoresMap[String(s.id)] = {
            assignment_score: s.midterm_score !== undefined && s.midterm_score !== null ? s.midterm_score : '',
            post_test_score: ''
          };
        } else if (selectedLesson === 'final') {
          scoresMap[String(s.id)] = {
            assignment_score: s.final_score !== undefined && s.final_score !== null ? s.final_score : '',
            post_test_score: ''
          };
        } else if (selectedLesson === 'affective') {
          scoresMap[String(s.id)] = {
            assignment_score: s.affective_score !== undefined && s.affective_score !== null ? s.affective_score : '',
            post_test_score: ''
          };
        }
      });
      setScores(scoresMap);
    } else {
      const scoresMap: ScoresMap = {};
      students.forEach(s => {
        const key = `${s.id}_${selectedLesson}`;
        const val = matrixScores[key] || { assignment_score: '', post_test_score: '' };
        scoresMap[String(s.id)] = val;
      });
      setScores(scoresMap);
    }
  }, [selectedLesson, matrixScores, students, selectedClass]);

  // ─── Analytics Summary Computations ───
  const analyticsSummary = useMemo(() => {
    if (!students.length || !structures.length) {
      return { avgScore: 0, completionRate: 0, highestScore: 0, lowestScore: 0, totalMaxScore: 100 };
    }

    let totalPossibleAcademicScore = 0;
    structures.forEach(s => {
      totalPossibleAcademicScore += Number(s.max_assignment_score || 0) + Number(s.max_post_test_score || 0);
    });
    totalPossibleAcademicScore += Number(classroomObj?.midterm_max_score || 0) + Number(classroomObj?.final_max_score || 0) + Number(classroomObj?.affective_weight || 0);
    if (totalPossibleAcademicScore === 0) totalPossibleAcademicScore = 100;

    let totalStudentScoresSum = 0;
    let maxStudentScore = 0;
    let minStudentScore = Infinity;
    let gradedCount = 0;
    let totalPossibleCells = students.length * structures.length * 2;

    students.forEach(student => {
      let currentStudentTotal = 0;
      structures.forEach(struct => {
        const key = `${student.id}_${struct.lesson_number}`;
        const val = matrixScores[key];
        if (val) {
          if (val.assignment_score !== '' && val.assignment_score !== null) {
            currentStudentTotal += Number(val.assignment_score);
            gradedCount++;
          }
          if (val.post_test_score !== '' && val.post_test_score !== null) {
            currentStudentTotal += Number(val.post_test_score);
            gradedCount++;
          }
        }
      });
      currentStudentTotal += Number(student.midterm_score || 0) + Number(student.final_score || 0) + Number(student.affective_score || 0);

      totalStudentScoresSum += currentStudentTotal;
      if (currentStudentTotal > maxStudentScore) maxStudentScore = currentStudentTotal;
      if (currentStudentTotal < minStudentScore) minStudentScore = currentStudentTotal;
    });

    const avgScore = students.length ? (totalStudentScoresSum / students.length) : 0;
    const completionRate = totalPossibleCells > 0 ? Math.round((gradedCount / totalPossibleCells) * 100) : 0;

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      completionRate: Math.min(100, completionRate),
      highestScore: Math.round(maxStudentScore * 10) / 10,
      lowestScore: minStudentScore === Infinity ? 0 : Math.round(minStudentScore * 10) / 10,
      totalMaxScore: totalPossibleAcademicScore
    };
  }, [students, structures, matrixScores, classroomObj]);

  const displayedStudents = useMemo(() => {
    if (!showAttendance || !filterCameOnly) return students;
    return students.filter(student => {
      const status = attendanceRecords[String(student.id)];
      return status === 'present' || status === 'late';
    });
  }, [students, showAttendance, filterCameOnly, attendanceRecords]);

  const attendanceStats = useMemo(() => {
    let present = 0, late = 0, absent = 0, leave = 0, noData = 0;

    students.forEach(student => {
      const status = attendanceRecords[String(student.id)];
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'absent') absent++;
      else if (status === 'leave') leave++;
      else noData++;
    });

    return {
      present, late, absent, leave, noData,
      total: students.length,
      came: present + late
    };
  }, [students, attendanceRecords]);

  const getAttendanceBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">มาเรียน</span>;
      case 'late':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">สาย</span>;
      case 'absent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold border border-rose-500/20">ขาด</span>;
      case 'leave':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20">ลา</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold border border-slate-200">ไม่มีข้อมูล</span>;
    }
  };

  const handleStructureChange = (index: number, field: keyof ScoreStructure, value: any) => {
    const newStructs = [...structures];
    newStructs[index] = { ...newStructs[index], [field]: value };
    setStructures(newStructs);
  };

  // ─── Mutation: บันทึกโครงสร้างคะแนน ───
  const saveStructureMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/scores?classroom_id=${selectedClass}&type=structure`, {
        classroom_id: selectedClass,
        structures: structures.map(s => ({
          ...s,
          max_assignment_score: parseFloat(String(s.max_assignment_score)) || 0,
          max_post_test_score: parseFloat(String(s.max_post_test_score)) || 0,
          hours: parseFloat(String(s.hours)) || 0
        }))
      });
    },
    onSuccess: () => {
      toast.success('บันทึกโครงสร้างคะแนนเรียบร้อย');
      setStructureSavedInDB(true);
      refetchMatrix();
    },
    onError: () => {
      toast.error('บันทึกโครงสร้างคะแนนไม่สำเร็จ');
    },
  });

  const saveStructure = () => {
    if (!selectedClass) return;
    saveStructureMutation.mutate();
  };

  // --- Handle Matrix Score Inline Change ---
  const handleMatrixScoreChange = useCallback((studentId: string | number, lessonNum: number, field: 'assignment_score' | 'post_test_score', value: string) => {
    const key = `${studentId}_${lessonNum}`;
    setMatrixScores(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { assignment_score: '', post_test_score: '' }),
        [field]: value
      }
    }));
  }, []);

  const handleWeeklyScoreChange = (studentId: string | number, field: 'assignment_score' | 'post_test_score', value: string) => {
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { assignment_score: '', post_test_score: '' }),
        [field]: value
      }
    }));

    if (!['midterm', 'final', 'affective'].includes(selectedLesson)) {
      const key = `${studentId}_${selectedLesson}`;
      setMatrixScores(prev => ({
        ...prev,
        [key]: {
          ...(prev[key] || { assignment_score: '', post_test_score: '' }),
          [field]: value
        }
      }));
    }
  };

  // ─── Mutation: บันทึกคะแนนแบบ Bulk Matrix Transaction ───
  const saveMatrixScoresMutation = useMutation({
    mutationFn: async () => {
      setIsAutoSaving(true);
      const bulkScores: {
        student_id: string | number;
        lesson_number: number;
        assignment_score?: number | string | null;
        post_test_score?: number | string | null;
      }[] = [];

      Object.keys(matrixScores).forEach(key => {
        const [studentIdStr, lessonNumStr] = key.split('_');
        const studentId = studentIdStr;
        const lessonNumber = parseInt(lessonNumStr);
        const val = matrixScores[key];
        if (val && !isNaN(lessonNumber)) {
          bulkScores.push({
            student_id: studentId,
            lesson_number: lessonNumber,
            assignment_score: val.assignment_score,
            post_test_score: val.post_test_score
          });
        }
      });

      await api.post(`/scores?classroom_id=${selectedClass}`, {
        classroom_id: selectedClass,
        scores: bulkScores
      });
    },
    onSuccess: () => {
      setIsAutoSaving(false);
      const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastAutoSavedTime(now);
      toast.success('บันทึกคะแนนรวมเรียบร้อยแล้ว');
      refetchMatrix();
    },
    onError: () => {
      setIsAutoSaving(false);
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    },
  });

  // ─── Mutation: บันทึกคะแนนสัปดาห์เดียว ───
  const saveWeeklyScoresMutation = useMutation({
    mutationFn: async () => {
      if (['midterm', 'final', 'affective'].includes(selectedLesson)) {
        const examScores = Object.keys(scores).map(studentId => {
          const val = scores[studentId].assignment_score;
          const scoreVal = val === '' ? null : parseFloat(String(val));

          const payload: {
            student_id: number;
            midterm_score?: number | null;
            final_score?: number | null;
            affective_score?: number | null;
          } = { student_id: Number(studentId) };
          if (selectedLesson === 'midterm') payload.midterm_score = scoreVal;
          else if (selectedLesson === 'final') payload.final_score = scoreVal;
          else if (selectedLesson === 'affective') payload.affective_score = scoreVal;
          return payload;
        });

        const typeParam = selectedLesson === 'affective' ? 'behavior' : selectedLesson;
        await api.put(`/students/exams?type=${typeParam}`, { scores: examScores });
      } else {
        const scoresArray = Object.keys(scores).map(studentId => ({
          student_id: studentId,
          assignment_score: scores[studentId].assignment_score,
          post_test_score: scores[studentId].post_test_score
        }));

        await api.post(`/scores?classroom_id=${selectedClass}`, {
          classroom_id: selectedClass,
          lesson_number: selectedLesson,
          scores: scoresArray
        });
      }
    },
    onSuccess: () => {
      toast.success('บันทึกคะแนนเรียบร้อย');
      refetchMatrix();
    },
    onError: () => {
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    },
  });

  const saveScores = () => {
    if (viewMode === 'matrix') {
      saveMatrixScoresMutation.mutate();
    } else {
      saveWeeklyScoresMutation.mutate();
    }
  };

  // --- Test Blueprint Calculator ---
  const calculateBlueprint = () => {
    let totalHours = 0;
    structures.forEach(s => { totalHours += parseFloat(String(s.hours)) || 0; });
    if (totalHours === 0) {
      toast.error('กรุณาระบุชั่วโมงเรียนให้ครบถ้วนก่อนคำนวณ');
      return;
    }
    const totalContactHours = theoryHoursPerWeek + practiceHoursPerWeek;
    if (totalContactHours === 0) {
      toast.error('กรุณาระบุชั่วโมงทฤษฎีและปฏิบัติ');
      return;
    }

    const practiceRatio = practiceHoursPerWeek / totalContactHours;
    const theoryRatio = theoryHoursPerWeek / totalContactHours;

    let runningSkillTotal = 0;
    let runningTestTotal = 0;
    const targetSkillTotal = Math.round(totalAcademicScore * practiceRatio);
    const targetTestTotal = totalAcademicScore - targetSkillTotal;

    const newStructs = structures.map((s, index) => {
      const h = parseFloat(String(s.hours)) || 0;
      const baseScore = (h / totalHours) * totalAcademicScore;
      let finalSkill, finalPostTest;

      if (index === structures.length - 1) {
        finalSkill = targetSkillTotal - runningSkillTotal;
        finalPostTest = targetTestTotal - runningTestTotal;
      } else {
        finalSkill = Math.round(baseScore * practiceRatio);
        finalPostTest = Math.round(baseScore * theoryRatio);
        runningSkillTotal += finalSkill;
        runningTestTotal += finalPostTest;
      }

      return {
        ...s,
        max_assignment_score: Math.max(0, finalSkill),
        max_post_test_score: Math.max(0, finalPostTest)
      };
    });

    setStructures(newStructs);
    setShowCalculator(false);
    toast.success(`คำนวณสัดส่วนสำเร็จ! งานเก็บ = ${targetSkillTotal} | สอบ = ${targetTestTotal} | รวม = ${totalAcademicScore}`);
  };

  const handleBlueprintImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let lessonCol = -1, hoursCol = -1, skillCol = -1, postTestCol = -1;
        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i] || [];
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim().toLowerCase();
            if (cell.includes('บทเรียนที่') || cell.includes('หน่วยที่')) lessonCol = j;
            if (cell.includes('ชั่วโมง')) hoursCol = j;
            if (cell.includes('คะแนนทักษะ') && !cell.includes('ใหม่')) skillCol = j;
            if (cell.includes('คะแนนรายบทเรียนใหม่') || cell.includes('พุทธิพิสัย')) postTestCol = j;
          }
          if (lessonCol !== -1 && skillCol !== -1 && postTestCol !== -1) break;
        }

        if (lessonCol === -1 || skillCol === -1 || postTestCol === -1) {
          toast.error('ไม่พบโครงสร้างตารางที่รองรับ');
          return;
        }

        const newStructs = [...structures];
        let importedCount = 0;
        for (let i = 0; i < data.length; i++) {
          const row = data[i] || [];
          const lessonNum = parseInt(String(row[lessonCol] || '').trim());
          if (!isNaN(lessonNum) && lessonNum > 0 && lessonNum <= structures.length) {
            const index = newStructs.findIndex(s => s.lesson_number === lessonNum);
            if (index !== -1) {
              newStructs[index] = {
                ...newStructs[index],
                max_assignment_score: parseFloat(row[skillCol]) || 0,
                max_post_test_score: parseFloat(row[postTestCol]) || 0,
                hours: hoursCol !== -1 ? (parseFloat(row[hoursCol]) || newStructs[index].hours) : newStructs[index].hours
              };
              importedCount++;
            }
          }
        }
        if (importedCount > 0) {
          setStructures(newStructs);
          toast.success(`นำเข้าโครงสร้างคะแนนสำเร็จ ${importedCount} บทเรียน`);
        }
      } catch (err) {
        toast.error('ไม่สามารถอ่านไฟล์ได้');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleScoreImport = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportType(type);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let headerRowIndex = -1;
        let weekColumns: { [key: string]: number } = {};
        let idColIndex = -1, nameColIndex = -1, lastNameColIndex = -1;

        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i] || [];
          let foundWeeks = 0;
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim();
            if (['1', '2', '3'].includes(cell)) foundWeeks++;
          }
          if (foundWeeks >= 3) {
            headerRowIndex = i;
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j]).trim();
              if (!isNaN(parseInt(cell))) weekColumns[cell] = j;
              else if (cell.includes('เลข') || cell.includes('รหัส')) idColIndex = j;
              else if (cell.includes('ชื่อ')) nameColIndex = j;
              else if (cell.includes('นามสกุล')) lastNameColIndex = j;
            }
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error('ไม่พบหัวคอลัมน์ที่เป็นตัวเลขสัปดาห์ในไฟล์นี้');
          return;
        }

        const parsedScores: StudentScoreEntry[] = [];
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i] || [];
          if (row.length === 0) continue;
          let studentCode = idColIndex !== -1 ? String(row[idColIndex] || '').trim() : '';
          let fullName = (nameColIndex !== -1 ? String(row[nameColIndex] || '').trim() : '') +
            (lastNameColIndex !== -1 && row[lastNameColIndex] ? ' ' + String(row[lastNameColIndex]).trim() : '');

          let matchedStudent = null;
          if (studentCode) matchedStudent = students.find(s => s.student_code === studentCode);
          if (!matchedStudent && fullName) matchedStudent = students.find(s => fullName.includes(s.name) || s.name.includes(fullName.replace(/นาย|นางสาว|เด็กชาย|เด็กหญิง/g, '').trim()));

          if (matchedStudent) {
            Object.keys(weekColumns).forEach(weekNum => {
              const colIdx = weekColumns[weekNum];
              const scoreVal = row[colIdx];
              if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
                const scoreEntry: StudentScoreEntry = {
                  student_id: matchedStudent.id,
                  student_name: matchedStudent.name,
                  lesson_number: parseInt(weekNum),
                };
                if (type === 'assignment') scoreEntry.assignment_score = parseFloat(String(scoreVal));
                else if (type === 'post_test') scoreEntry.post_test_score = parseFloat(String(scoreVal));
                parsedScores.push(scoreEntry);
              }
            });
          }
        }

        if (parsedScores.length === 0) {
          toast.error('ไม่พบข้อมูลคะแนนที่สามารถจับคู่กับนักเรียนในห้องนี้ได้');
        } else {
          setImportData(parsedScores);
          setShowImportPreview(true);
        }
      } catch (err) {
        toast.error('ไม่สามารถอ่านไฟล์ได้');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const bulkImportMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/scores?classroom_id=${selectedClass}`, {
        classroom_id: selectedClass,
        scores: importData.map(d => ({
          student_id: d.student_id,
          lesson_number: d.lesson_number,
          ...(importType === 'assignment' ? { assignment_score: d.assignment_score } : { post_test_score: d.post_test_score })
        }))
      });
    },
    onSuccess: () => {
      toast.success('นำเข้าคะแนนสำเร็จ');
      setShowImportPreview(false);
      setImportData([]);
      refetchMatrix();
    },
    onError: () => { toast.error('นำเข้าไม่สำเร็จ'); },
  });

  const submitBulkImport = () => bulkImportMutation.mutate();

  const handleExportScores = async () => {
    if (!selectedClass) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        classroom_id: selectedClass,
        export_type: exportType,
        lesson_number: selectedLesson,
        file_format: exportFormat
      });

      const response = await fetch(`/api/scores/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();

      const contentDisposition = response.headers.get('content-disposition');
      let defaultExt = exportFormat === 'xlsx' ? 'xlsx' : 'csv';
      let filename = `scores_export.${defaultExt}`;
      if (contentDisposition) {
        const matchesStar = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(contentDisposition);
        if (matchesStar && matchesStar[1]) {
          filename = decodeURIComponent(matchesStar[1]).replace(/['"]/g, '');
        } else {
          const matchesReg = /filename="?([^";]+)"?/i.exec(contentDisposition);
          if (matchesReg && matchesReg[1]) filename = decodeURIComponent(matchesReg[1]).replace(/['"]/g, '');
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
      toast.success('ส่งออกข้อมูลคะแนนสำเร็จ');
    } catch (err) {
      toast.error('ส่งออกข้อมูลคะแนนไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const saving = saveStructureMutation.isPending || saveMatrixScoresMutation.isPending || saveWeeklyScoresMutation.isPending || bulkImportMutation.isPending;
  const currentStruct = structures.find(s => s.lesson_number.toString() === selectedLesson.toString()) || { max_assignment_score: 0, max_post_test_score: 0 };

  if (loadingClassrooms) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Header Title & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            คะแนนเก็บและสอบ (Gradebook)
          </h1>
          <p className="text-slate-500 text-sm">จัดการโครงสร้างคะแนนเต็ม และตารางกรอกคะแนนรวมทั้งเทอม</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 shrink-0">ห้องเรียน:</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="form-input text-base py-2 font-medium bg-white border-indigo-200 focus:border-indigo-500 shadow-sm min-w-[200px]"
          >
            <option value="">-- เลือกห้องเรียน --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {selectedClass && (
        <>
          {/* Analytics Summary Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass p-4 rounded-2xl border border-indigo-100 flex items-center gap-3 bg-gradient-to-br from-indigo-50/80 to-purple-50/50">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">คะแนนเฉลี่ยห้อง (Mean)</p>
                <p className="text-xl font-extrabold text-indigo-700">
                  {analyticsSummary.avgScore} <span className="text-xs font-normal text-slate-500">/ {analyticsSummary.totalMaxScore}</span>
                </p>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 flex items-center gap-3 bg-gradient-to-br from-emerald-50/80 to-teal-50/50">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">อัตราการกรอกคะแนน</p>
                <p className="text-xl font-extrabold text-emerald-700">{analyticsSummary.completionRate}%</p>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 flex items-center gap-3 bg-gradient-to-br from-amber-50/80 to-orange-50/50">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">คะแนนสูงสุด / ต่ำสุด</p>
                <p className="text-lg font-bold text-slate-800">
                  <span className="text-emerald-600">{analyticsSummary.highestScore}</span> / <span className="text-rose-500">{analyticsSummary.lowestScore}</span>
                </p>
              </div>
            </div>

            <div className="glass p-4 rounded-2xl border border-indigo-100 flex items-center gap-3 bg-gradient-to-br from-blue-50/80 to-indigo-50/50">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">จำนวนนักเรียนทั้งหมด</p>
                <p className="text-xl font-extrabold text-slate-800">{students.length} คน</p>
              </div>
            </div>
          </div>

          {/* Navigation Bar & Mode Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-indigo-100 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('entry')}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-xl transition-all ${
                  activeTab === 'entry'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                <FileText className="w-4 h-4" /> ตารางกรอกคะแนน
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-xl transition-all ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                <Settings className="w-4 h-4" /> ตั้งค่าคะแนนเต็ม (Blueprint)
              </button>
            </div>

            {activeTab === 'entry' && (
              <div className="flex items-center gap-2 bg-indigo-50/80 p-1 rounded-xl border border-indigo-100">
                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    viewMode === 'matrix' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" /> ตารางรวมทั้งเทอม (Excel View)
                </button>
                <button
                  onClick={() => setViewMode('weekly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    viewMode === 'weekly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" /> โฟกัสรายสัปดาห์ (Weekly Focus)
                </button>
              </div>
            )}
          </div>

          {/* ─── TAB: โครงสร้างคะแนนเต็ม (Settings) ─── */}
          {activeTab === 'settings' && (
            <div className="glass rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
              <div className="p-5 border-b border-indigo-100 flex flex-col lg:flex-row items-center justify-between gap-4 bg-indigo-50/60">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">ตารางน้ำหนักคะแนนเต็ม (Test Blueprint)</h2>
                  <p className="text-sm text-slate-600">กำหนดคะแนนเต็มของงานเก็บและสอบย่อยในแต่ละบทเรียน (18 สัปดาห์)</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setShowCalculator(true)} className="btn bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-200 flex items-center gap-2 text-xs">
                    <Calculator className="w-4 h-4" />
                    คำนวณสัดส่วนอัตโนมัติ
                  </button>
                  <label className="btn bg-indigo-100 hover:bg-indigo-200 text-indigo-700 cursor-pointer flex items-center gap-2 text-xs">
                    <FileSpreadsheet className="w-4 h-4" />
                    นำเข้า Blueprint
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBlueprintImport} />
                  </label>
                  <button onClick={saveStructure} disabled={saving} className="btn btn-primary flex items-center gap-2 text-xs">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    บันทึกโครงสร้าง
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto p-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-100/50 border-b border-indigo-200 text-slate-700 text-xs uppercase tracking-wider">
                      <th className="p-3 w-16 text-center">สัปดาห์</th>
                      <th className="p-3">ชื่อบทเรียน/รายละเอียด</th>
                      <th className="p-3 w-28 text-center text-blue-600">ชั่วโมงเรียน</th>
                      <th className="p-3 w-40 text-center text-emerald-600">งานเก็บเต็ม (ทักษะ)</th>
                      <th className="p-3 w-40 text-center text-amber-600">สอบย่อยเต็ม (พุทธิ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((struct, index) => (
                      <tr key={struct.lesson_number} className="border-b border-indigo-100 hover:bg-indigo-50/50">
                        <td className="p-3 text-center text-slate-600 font-bold">{struct.lesson_number}</td>
                        <td className="p-3">
                          <input
                            value={struct.lesson_name || ''}
                            onChange={e => handleStructureChange(index, 'lesson_name', e.target.value)}
                            className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 w-full text-slate-800 outline-none focus:border-indigo-500 text-sm"
                            placeholder="เช่น บทที่ 1 การประมวลผลคำ..."
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number" min="0"
                            value={struct.hours || ''}
                            onChange={e => handleStructureChange(index, 'hours', e.target.value)}
                            className="bg-indigo-50/50 border border-blue-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-blue-500 font-semibold text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number" step="0.1" min="0"
                            value={struct.max_assignment_score}
                            onChange={e => handleStructureChange(index, 'max_assignment_score', e.target.value)}
                            className="bg-white border border-emerald-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-emerald-500 font-bold text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number" step="0.1" min="0"
                            value={struct.max_post_test_score}
                            onChange={e => handleStructureChange(index, 'max_post_test_score', e.target.value)}
                            className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-amber-500 font-bold text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: ตารางกรอกคะแนน (Entry) ─── */}
          {activeTab === 'entry' && (
            <div className="space-y-4">
              {!structureSavedInDB && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in-up">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-800 font-bold text-sm">⚠️ ยังไม่ได้บันทึกโครงสร้างคะแนน!</p>
                    <p className="text-amber-700/80 text-xs mt-1">กรุณาไปที่แท็บ <strong>&quot;ตั้งค่าคะแนนเต็ม (Blueprint)&quot;</strong> แล้วกดปุ่ม <strong>&quot;บันทึกโครงสร้าง&quot;</strong> เพื่อให้ระบบมีเกณฑ์คะแนนเต็มในการคำนวณเกรด</p>
                  </div>
                </div>
              )}

              {/* Control Action Toolbar */}
              <div className="glass p-4 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {lastAutoSavedTime && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้วเมื่อ {lastAutoSavedTime}
                    </span>
                  )}
                  {isAutoSaving && (
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังบันทึกข้อมูล...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 text-xs cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> นำเข้าคะแนนงานเก็บ (Excel)
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleScoreImport(e, 'assignment')} />
                  </label>
                  <label className="btn bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 text-xs cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> นำเข้าคะแนนสอบ (Excel)
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleScoreImport(e, 'post_test')} />
                  </label>
                  <button onClick={() => setShowExportModal(true)} className="btn bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> ส่งออก Excel
                  </button>
                  <button onClick={saveScores} disabled={saving} className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    บันทึกคะแนน
                  </button>
                </div>
              </div>

              {/* MODE 1: Full Term Spreadsheet Matrix View */}
              {viewMode === 'matrix' && (
                <div className="glass rounded-2xl border border-indigo-100 overflow-hidden shadow-sm bg-white">
                  <div className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <Grid className="w-4 h-4 text-indigo-600" />
                        ตารางคะแนนรวมทั้งเทอม (Full Term Spreadsheet Matrix)
                      </h3>
                      <p className="text-xs text-slate-500">สามารถพิมพ์กรอกคะแนนได้ทุกช่อง ระบบจะคำนวณคะแนนรวมให้อัตโนมัติ</p>
                    </div>
                  </div>

                  {matrixLoading ? (
                    <div className="p-12 text-center text-indigo-500 flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm font-medium">กำลังโหลดข้อมูลคะแนนทั้งเทอม...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-20 bg-indigo-100/90 backdrop-blur-md text-slate-700">
                          <tr>
                            <th className="p-3 sticky left-0 z-30 bg-indigo-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] w-16 text-center font-bold border-r border-indigo-200">รหัส</th>
                            <th className="p-3 sticky left-16 z-30 bg-indigo-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] min-w-[160px] font-bold border-r border-indigo-200">ชื่อ-นามสกุล</th>
                            {structures.map(struct => (
                              <th key={struct.lesson_number} colSpan={2} className="p-2 text-center border-l border-indigo-200 font-bold min-w-[110px]">
                                W{struct.lesson_number}
                                <div className="text-[10px] font-normal text-slate-500">({struct.max_assignment_score}/{struct.max_post_test_score})</div>
                              </th>
                            ))}
                            <th className="p-3 text-center border-l border-indigo-200 bg-cyan-100/80 min-w-[70px] font-bold">กลางภาค</th>
                            <th className="p-3 text-center bg-blue-100/80 min-w-[70px] font-bold">ปลายภาค</th>
                            <th className="p-3 text-center bg-pink-100/80 min-w-[70px] font-bold">จิตพิสัย</th>
                            <th className="p-3 text-center bg-indigo-200/80 min-w-[80px] font-extrabold text-indigo-900">รวมคะแนน</th>
                          </tr>
                          <tr className="bg-indigo-50 text-[10px] text-slate-500 border-b border-indigo-200">
                            <th className="p-1 sticky left-0 z-30 bg-indigo-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] border-r border-indigo-200"></th>
                            <th className="p-1 sticky left-16 z-30 bg-indigo-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] border-r border-indigo-200"></th>
                            {structures.map(struct => (
                              <Fragment key={struct.lesson_number}>
                                <th className="p-1 text-center border-l border-indigo-200 text-emerald-700 font-semibold">งาน</th>
                                <th className="p-1 text-center text-amber-700 font-semibold">สอบ</th>
                              </Fragment>
                            ))}
                            <th className="p-1 border-l border-indigo-200"></th>
                            <th className="p-1"></th>
                            <th className="p-1"></th>
                            <th className="p-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedStudents.map((student, idx) => {
                            let totalStudentScore = 0;
                            structures.forEach(struct => {
                              const key = `${student.id}_${struct.lesson_number}`;
                              const val = matrixScores[key];
                              if (val) {
                                if (val.assignment_score !== '' && val.assignment_score !== null) totalStudentScore += Number(val.assignment_score);
                                if (val.post_test_score !== '' && val.post_test_score !== null) totalStudentScore += Number(val.post_test_score);
                              }
                            });
                            totalStudentScore += Number(student.midterm_score || 0) + Number(student.final_score || 0) + Number(student.affective_score || 0);

                            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

                            return (
                              <tr key={student.id} className={`border-b border-indigo-50 hover:bg-indigo-50/60 ${rowBg}`}>
                                <td className={`p-2 sticky left-0 z-10 ${rowBg} font-medium text-slate-500 text-center shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-indigo-100`}>
                                  {student.student_code || '-'}
                                </td>
                                <td className={`p-2 sticky left-16 z-10 ${rowBg} font-semibold text-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] border-r border-indigo-100 whitespace-nowrap`}>
                                  {student.name}
                                </td>
                                {structures.map(struct => {
                                  const key = `${student.id}_${struct.lesson_number}`;
                                  const val = matrixScores[key] || { assignment_score: '', post_test_score: '' };
                                  return (
                                    <Fragment key={struct.lesson_number}>
                                      <td className="p-1 border-l border-indigo-100 min-w-[50px]">
                                        <MemoizedScoreInput
                                          value={val.assignment_score}
                                          maxScore={struct.max_assignment_score}
                                          focusColor="indigo"
                                          onChange={valStr => handleMatrixScoreChange(student.id, struct.lesson_number, 'assignment_score', valStr)}
                                        />
                                      </td>
                                      <td className="p-1 min-w-[50px]">
                                        <MemoizedScoreInput
                                          value={val.post_test_score}
                                          maxScore={struct.max_post_test_score}
                                          focusColor="amber"
                                          onChange={valStr => handleMatrixScoreChange(student.id, struct.lesson_number, 'post_test_score', valStr)}
                                        />
                                      </td>
                                    </Fragment>
                                  );
                                })}
                                <td className="p-1 border-l border-indigo-100 bg-cyan-50/30 text-center font-bold text-cyan-800">{student.midterm_score ?? '-'}</td>
                                <td className="p-1 bg-blue-50/30 text-center font-bold text-blue-800">{student.final_score ?? '-'}</td>
                                <td className="p-1 bg-pink-50/30 text-center font-bold text-pink-800">{student.affective_score ?? '-'}</td>
                                <td className="p-2 bg-indigo-50 text-center font-black text-indigo-700 text-sm">{Math.round(totalStudentScore * 10) / 10}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: Weekly Focus View */}
              {viewMode === 'weekly' && (
                <div className="glass rounded-2xl overflow-hidden border border-indigo-100 shadow-sm bg-white">
                  <div className="p-4 border-b border-indigo-100 flex flex-col md:flex-row gap-4 items-end justify-between bg-indigo-50/60">
                    <div className="w-full md:w-1/3">
                      <label className="form-label text-indigo-800 font-bold">เลือกบทเรียน/สัปดาห์ หรือการสอบ</label>
                      <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="form-input bg-white border-indigo-200">
                        <optgroup label="คะแนนภาคผลงาน (รายสัปดาห์)">
                          {structures.map(s => (
                            <option key={s.lesson_number} value={s.lesson_number}>
                              สัปดาห์ที่ {s.lesson_number}: {s.lesson_name || 'ไม่มีชื่อ'}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="คะแนนภาควิชา / จิตพิสัย">
                          <option value="midterm">สอบกลางภาค (คะแนนภาควิชา)</option>
                          <option value="final">สอบปลายภาค (คะแนนภาควิชา)</option>
                          <option value="affective">คะแนนจิตพิสัย (คะแนนจิตพิสัย)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="flex gap-4 text-sm font-medium">
                      {!['midterm', 'final', 'affective'].includes(selectedLesson) && (
                        <>
                          <div className="bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-bold">
                            คะแนนงานเก็บเต็ม: {currentStruct.max_assignment_score}
                          </div>
                          <div className="bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs font-bold">
                            คะแนนสอบเต็ม: {currentStruct.max_post_test_score}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Attendance Integration Toolbar */}
                  <div className="p-4 border-b border-indigo-100 bg-slate-50/50 flex flex-col gap-3">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="show-attendance"
                          checked={showAttendance}
                          onChange={e => setShowAttendance(e.target.checked)}
                          className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
                        />
                        <label htmlFor="show-attendance" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                          🔗 แสดงสถานะการเข้าเรียนประกอบการกรอกคะแนน
                        </label>
                      </div>

                      {showAttendance && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">ระบุวันที่เช็คชื่อ:</span>
                          <input
                            type="date"
                            value={attendanceDate}
                            onChange={e => setAttendanceDate(e.target.value)}
                            className="form-input py-1 px-3 text-xs bg-white border-indigo-200 rounded-xl w-36"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-indigo-100/50 border-b border-indigo-200 font-bold text-slate-700">
                          <th className="p-3 w-20">รหัส</th>
                          <th className="p-3">ชื่อ-นามสกุล</th>
                          {!['midterm', 'final', 'affective'].includes(selectedLesson) && (
                            <>
                              <th className="p-3 text-center text-emerald-600 w-44">งานเก็บ (ภาคผลงาน)</th>
                              <th className="p-3 text-center text-amber-600 w-44">สอบย่อย (ภาคผลงาน)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedStudents.map(student => {
                          const scoreData = scores[student.id] || { assignment_score: '', post_test_score: '' };
                          const attStatus = attendanceRecords[String(student.id)] || '';
                          return (
                            <tr key={student.id} className="border-b border-indigo-100 hover:bg-indigo-50/50">
                              <td className="p-3 text-slate-500 font-medium">{student.student_code || '-'}</td>
                              <td className="p-3 font-semibold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span>{student.name}</span>
                                  {showAttendance && getAttendanceBadge(attStatus)}
                                </div>
                              </td>
                              {!['midterm', 'final', 'affective'].includes(selectedLesson) && (
                                <>
                                  <td className="p-2 text-center">
                                    <input
                                      type="number" step="0.5" min="0" max={currentStruct.max_assignment_score}
                                      value={scoreData.assignment_score}
                                      onChange={e => handleWeeklyScoreChange(student.id, 'assignment_score', e.target.value)}
                                      className="form-input text-center text-sm py-1 font-bold border-indigo-200"
                                      placeholder={`/${currentStruct.max_assignment_score}`}
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <input
                                      type="number" step="0.5" min="0" max={currentStruct.max_post_test_score}
                                      value={scoreData.post_test_score}
                                      onChange={e => handleWeeklyScoreChange(student.id, 'post_test_score', e.target.value)}
                                      className="form-input text-center text-sm py-1 font-bold border-indigo-200"
                                      placeholder={`/${currentStruct.max_post_test_score}`}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

      {/* Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-indigo-200 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              คำนวณสัดส่วนคะแนนอัตโนมัติ
            </h3>
            <p className="text-slate-600 mb-5 text-sm">
              ระบบจะนำชั่วโมงเรียนในตารางมาเทียบบัญญัติไตรยางศ์ แล้วแบ่งคะแนนตามสัดส่วนทฤษฎี:ปฏิบัติ
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label text-slate-800">คะแนนวิชาการรวม (งานเก็บ + สอบย่อย)</label>
                <input
                  type="number"
                  value={totalAcademicScore}
                  onChange={e => setTotalAcademicScore(parseFloat(e.target.value) || 0)}
                  className="form-input text-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-amber-600">ทฤษฎี ชม./สัปดาห์</label>
                  <input
                    type="number" min="0" step="1"
                    value={theoryHoursPerWeek}
                    onChange={e => setTheoryHoursPerWeek(parseFloat(e.target.value) || 0)}
                    className="form-input text-lg text-center"
                  />
                </div>
                <div>
                  <label className="form-label text-emerald-600">ปฏิบัติ ชม./สัปดาห์</label>
                  <input
                    type="number" min="0" step="1"
                    value={practiceHoursPerWeek}
                    onChange={e => setPracticeHoursPerWeek(parseFloat(e.target.value) || 0)}
                    className="form-input text-lg text-center"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCalculator(false)} className="btn bg-slate-100 text-slate-700">ยกเลิก</button>
              <button onClick={calculateBlueprint} className="btn btn-primary">เริ่มคำนวณ</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-indigo-200 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              ส่งออก Excel / Google Sheets
            </h3>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-50">
                <input type="radio" name="exportType" value="full_matrix" checked={exportType === 'full_matrix'} onChange={() => setExportType('full_matrix')} />
                <div>
                  <div className="text-sm font-semibold text-slate-800">ตารางคะแนนรวมทั้งหมด (ทุกสัปดาห์)</div>
                  <div className="text-xs text-slate-500">ส่งออกคะแนนดิบทั้งหมดในรูปแบบตาราง Excel</div>
                </div>
              </label>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowExportModal(false)} className="btn bg-slate-100 text-slate-700">ยกเลิก</button>
              <button onClick={handleExportScores} disabled={exporting} className="btn btn-primary flex items-center gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {exporting ? 'กำลังส่งออก...' : 'ส่งออกไฟล์'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}





