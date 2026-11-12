'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Loader2, Save, FileText, Settings, Users, BookOpen, AlertCircle, Upload,
  FileSpreadsheet, Grid, Table, CheckCircle2, TrendingUp, Award,
} from 'lucide-react';
import toast from '@/lib/toast';
import dynamic from 'next/dynamic';
import { checkThaiHoliday } from '@/lib/thaiHolidays';

const ScoreExcelModal = dynamic(() => import('@/components/ScoreExcelModal'), { ssr: false });
const ScoreImportModal = dynamic(() => import('@/components/ScoreImportModal'), { ssr: false });
import ClassroomCardPicker from '@/components/ClassroomCardPicker';
import SectionSwitcher from '@/components/SectionSwitcher';
import BlueprintCalculatorModal from '@/components/BlueprintCalculatorModal';
import { parseClassroomName } from '@/lib/classroom';
import { buildStudentSectionGroups } from '@/lib/studentSections';
import {
  MatrixStudentRow,
  ScoreBlueprintSettingsTab,
  WeeklyFocusView,
  parseSafeDateStr,
  formatThaiFullDateHeader,
  type Classroom,
  type Student,
  type ScoreStructure,
  type ScoresMap,
  type FullMatrixScoresMap,
} from './scores/index';

export default function Scores() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' or 'settings'
  const [viewMode, setViewMode] = useState<'matrix' | 'weekly'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'weekly';
    }
    return 'matrix';
  });

  // Settings State
  const [structures, setStructures] = useState<ScoreStructure[]>([]);
  const [structureSavedInDB, setStructureSavedInDB] = useState(false);

  // Weekly Entry State
  const [selectedLesson, setSelectedLesson] = useState('');
  const [scores, setScores] = useState<ScoresMap>({});

  // Full Matrix State
  const [matrixScores, setMatrixScores] = useState<FullMatrixScoresMap>({});
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Modals State
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Test Blueprint Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [totalAcademicScore, setTotalAcademicScore] = useState(40);
  const [theoryHoursPerWeek, setTheoryHoursPerWeek] = useState(2);
  const [practiceHoursPerWeek, setPracticeHoursPerWeek] = useState(2);
  const [curriculumWeeks, setCurriculumWeeks] = useState<number>(18);
  const [hasMidtermCalculator, setHasMidtermCalculator] = useState(true);
  const [scoreScaleMode, setScoreScaleMode] = useState<'standard_10' | 'direct_weight'>('standard_10');
  const [standardWeeklyBaseScore, setStandardWeeklyBaseScore] = useState<number>(10);

  // Attendance Integration State
  const [showAttendance, setShowAttendance] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [hideAbsentInWeekly, setHideAbsentInWeekly] = useState(true);

  // ─── Query: ดึงข้อมูลการเข้าเรียนตามวันที่ ───
  const { data: attendanceRecords = {} as Record<string, string> } = useQuery<Record<string, string>>({
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
    enabled: !!selectedClass && !!attendanceDate,
  });

  // ─── Query: ดึงข้อมูลการเข้าเรียนทั้งหมดของห้องเรียน เพื่อแมปกับสัปดาห์ W1, W2... ───
  const { data: allClassAttendance = [] } = useQuery<{ id: number; student_id: number; date: string; status: string }[]>({
    queryKey: ['attendance-all-class-for-scores', selectedClass],
    queryFn: async () => {
      const res = await api.get(`/attendance?classroom_id=${selectedClass}&type=records`);
      return res.data.data || [];
    },
    enabled: !!selectedClass,
  });

  const { weekDateMap, weekAttendanceMap } = useMemo(() => {
    if (!allClassAttendance || allClassAttendance.length === 0) {
      return { weekDateMap: {} as Record<number, string>, weekAttendanceMap: {} as Record<string, string> };
    }

    const validDates = allClassAttendance
      .map(r => parseSafeDateStr(r.date))
      .filter(d => d !== '');

    const uniqueDates = Array.from(new Set(validDates)).sort();

    const wDateMap: Record<number, string> = {};
    uniqueDates.forEach((dateStr, idx) => {
      wDateMap[idx + 1] = dateStr;
    });

    const wAttMap: Record<string, string> = {};
    allClassAttendance.forEach(r => {
      const dateStr = parseSafeDateStr(r.date);
      if (dateStr) {
        const weekIndex = uniqueDates.indexOf(dateStr) + 1;
        if (weekIndex > 0) {
          wAttMap[`${r.student_id}_${weekIndex}`] = r.status;
        }
      }
    });

    return { weekDateMap: wDateMap, weekAttendanceMap: wAttMap };
  }, [allClassAttendance]);

  // State for Semester Start Date (วันเริ่มเรียน/วันเริ่มต้นภาคเรียน)
  const [semesterStartDate, setSemesterStartDate] = useState<string>('');

  // ─── Query: ดึงข้อมูลตารางเรียนทั้งหมด (All Timetable Entries) ───
  const { data: allTimetableEntries = [] } = useQuery<{ classroom_id: number | string; day_of_week: number; hours?: number; entry_type?: string; entryType?: string }[]>({
    queryKey: ['timetable-all'],
    queryFn: async () => {
      const res = await api.get('/timetable');
      return res.data.data?.entries || [];
    },
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

  // Auto-set semesterStartDate per classroom (DB First -> Attendance Fallback -> Default)
  useEffect(() => {
    if (!selectedClass) return;

    if (classroomObj?.semester_start_date) {
      setSemesterStartDate(classroomObj.semester_start_date);
      try {
        localStorage.removeItem(`scores_start_date_${selectedClass}`);
      } catch {}
      return;
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem(`scores_start_date_${selectedClass}`) : null;
    if (stored) {
      setSemesterStartDate(stored);
      api.put(`/classrooms/${selectedClass}`, { semester_start_date: stored })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['classrooms'] });
          try {
            localStorage.removeItem(`scores_start_date_${selectedClass}`);
          } catch {}
        })
        .catch((err) => console.warn('Failed to migrate semesterStartDate to DB:', err));
      return;
    }

    if (allClassAttendance && allClassAttendance.length > 0) {
      const validDates = allClassAttendance
        .map(r => parseSafeDateStr(r.date))
        .filter(d => d !== '')
        .sort();
      if (validDates.length > 0) {
        setSemesterStartDate(validDates[0]);
        return;
      }
    }

    const d = new Date();
    setSemesterStartDate(`${d.getFullYear()}-05-18`);
  }, [selectedClass, classroomObj?.semester_start_date, allClassAttendance, queryClient]);

  const handleStartDateChange = async (newDate: string) => {
    setSemesterStartDate(newDate);
    if (!selectedClass) return;

    try {
      await api.put(`/classrooms/${selectedClass}`, { semester_start_date: newDate });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      try {
        localStorage.removeItem(`scores_start_date_${selectedClass}`);
      } catch {}
      toast.success('บันทึกวันเริ่มต้นภาคเรียนเรียบร้อย');
    } catch (err) {
      console.error('Failed to update semester_start_date in DB:', err);
      toast.error('ไม่สามารถบันทึกวันเริ่มต้นภาคเรียนลงฐานข้อมูลได้');
    }
  };

  // Calculate Teaching Days of this Classroom (0=Mon .. 6=Sun)
  const classTeachingDays = useMemo(() => {
    if (!selectedClass) return [2];
    const classEntries = allTimetableEntries.filter(
      e => String(e.classroom_id) === String(selectedClass)
    );
    const days = Array.from(new Set(classEntries.map(e => Number(e.day_of_week))));
    return days.length > 0 ? days.sort((a, b) => a - b) : [2];
  }, [selectedClass, allTimetableEntries]);

  // Generate Calculated Dates for All Weeks (W1 .. W18 or W15)
  const calculatedWeekDates = useMemo(() => {
    if (!semesterStartDate) return {};

    const start = new Date(semesterStartDate);
    if (isNaN(start.getTime())) return {};

    const targetWeeks = classroomObj?.total_weeks || (classroomObj?.curriculum_type === 'pvs' ? 15 : 18);
    const getSchemaDay = (d: Date) => (d.getDay() + 6) % 7;

    const current = new Date(start);
    while (!classTeachingDays.includes(getSchemaDay(current))) {
      current.setDate(current.getDate() + 1);
    }

    const weekMap: Record<number, string> = {};
    const firstTeachingDay = new Date(current);

    const validActualDates = Array.from(
      new Set(allClassAttendance.map(r => parseSafeDateStr(r.date)).filter(d => d !== ''))
    ).sort();

    for (let w = 1; w <= targetWeeks; w++) {
      if (validActualDates[w - 1]) {
        weekMap[w] = validActualDates[w - 1];
      } else {
        const wDate = new Date(firstTeachingDay);
        wDate.setDate(firstTeachingDay.getDate() + (w - 1) * 7);
        weekMap[w] = wDate.toISOString().split('T')[0];
      }
    }

    return weekMap;
  }, [semesterStartDate, classTeachingDays, classroomObj, allClassAttendance]);

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

  // ─── Sub-room / Section Grouping (แยกห้องย่อยเมื่อเรียนรวม เช่น ปวช.1/1 + ปวช.1/2) ───
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');

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

  const isPws = useMemo(() => {
    const nameOrDesc = `${classroomObj?.name || ''} ${classroomObj?.description || ''}`;
    return classroomObj?.curriculum_type === 'pvs' || Boolean(nameOrDesc.includes('ปวส') || nameOrDesc.includes('ปวส.'));
  }, [classroomObj]);

  const hasMidterm = useMemo(() => {
    if (isPws) return false;
    return Number(classroomObj?.midterm_weight ?? 0) > 0;
  }, [isPws, classroomObj]);

  const targetTeachingWeeks = useMemo(() => {
    return isPws ? 14 : 17;
  }, [isPws]);

  // Sync Class Data and Structure
  useEffect(() => {
    if (matrixData) {
      const fetchedStructs = matrixData.structures || [];
      const targetWeeks = targetTeachingWeeks;

      let finalStructs: ScoreStructure[];
      let savedInDB = false;
      if (fetchedStructs.length === 0) {
        finalStructs = Array.from({ length: targetWeeks }, (_, i) => ({
          lesson_number: i + 1,
          lesson_name: `บทที่/สัปดาห์ที่ ${i + 1}`,
          max_assignment_score: 10,
          max_post_test_score: 10,
          hours: 0,
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
            hours: 0,
          }));
          adjustedStructs = [...adjustedStructs, ...padding];
        }
        finalStructs = adjustedStructs;
        savedInDB = true;
      }

      setStructures(finalStructs);
      setStructureSavedInDB(savedInDB);

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
          post_test_score: s.post_test_score !== null ? s.post_test_score : '',
        };
      });
      setMatrixScores(mScores);

      if (finalStructs.length > 0 && (!selectedLesson || !finalStructs.some(s => String(s.lesson_number) === String(selectedLesson)))) {
        setSelectedLesson(finalStructs[0].lesson_number.toString());
      }
    }
  }, [matrixData, classroomObj, selectedLesson, targetTeachingWeeks]);

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

    const scoresMap: ScoresMap = {};
    students.forEach(s => {
      const key = `${s.id}_${selectedLesson}`;
      const val = matrixScores[key] || { assignment_score: '', post_test_score: '' };
      scoresMap[String(s.id)] = val;
    });
    setScores(scoresMap);
  }, [selectedLesson, matrixScores, students, selectedClass]);

  // ─── Auto-sync attendanceDate with the currently selected weekly lesson ───
  useEffect(() => {
    const weekNum = parseInt(selectedLesson);
    if (!isNaN(weekNum) && weekNum > 0) {
      const targetDate = calculatedWeekDates[weekNum] || weekDateMap[weekNum];
      if (targetDate && targetDate !== attendanceDate) {
        setAttendanceDate(targetDate);
      }
    }
  }, [selectedLesson, calculatedWeekDates, weekDateMap, attendanceDate]);

  // ─── Analytics Summary Computations ───
  const analyticsSummary = useMemo(() => {
    if (!sectionScopedStudents.length || !structures.length) {
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
    const totalPossibleCells = sectionScopedStudents.length * structures.length * 2;

    sectionScopedStudents.forEach(student => {
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
      currentStudentTotal += Number(student.midterm_score || 0) + Number(Math.max(0, Number(student.final_score || 0))) + Number(student.affective_score || 0);

      totalStudentScoresSum += currentStudentTotal;
      if (currentStudentTotal > maxStudentScore) maxStudentScore = currentStudentTotal;
      if (currentStudentTotal < minStudentScore) minStudentScore = currentStudentTotal;
    });

    const avgScore = sectionScopedStudents.length ? (totalStudentScoresSum / sectionScopedStudents.length) : 0;
    const completionRate = totalPossibleCells > 0 ? Math.round((gradedCount / totalPossibleCells) * 100) : 0;

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      completionRate: Math.min(100, completionRate),
      highestScore: Math.round(maxStudentScore * 10) / 10,
      lowestScore: minStudentScore === Infinity ? 0 : Math.round(minStudentScore * 10) / 10,
      totalMaxScore: totalPossibleAcademicScore,
    };
  }, [sectionScopedStudents, structures, matrixScores, classroomObj]);

  // Index of `${studentId}_${YYYY-MM-DD}` -> status
  const attendanceStatusIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const r of allClassAttendance) {
      if (!r.status) continue;
      const key = `${r.student_id}_${parseSafeDateStr(r.date)}`;
      if (!index.has(key)) index.set(key, r.status);
    }
    return index;
  }, [allClassAttendance]);

  const getStudentAttendanceStatus = useCallback((studentId: string | number, weekLesson: string | number, targetDate?: string): string => {
    const idStr = String(studentId);
    const weekNum = parseInt(String(weekLesson));
    const dateStr = targetDate || (calculatedWeekDates[weekNum] || weekDateMap[weekNum] || (String(weekLesson) === String(selectedLesson) ? attendanceDate : ''));

    if (dateStr && dateStr === attendanceDate && attendanceRecords[idStr]) {
      return attendanceRecords[idStr];
    }

    if (dateStr) {
      const matchStatus = attendanceStatusIndex.get(`${idStr}_${dateStr}`);
      if (matchStatus) return matchStatus;
    }

    if (!isNaN(weekNum) && weekAttendanceMap[`${idStr}_${weekNum}`]) {
      return weekAttendanceMap[`${idStr}_${weekNum}`];
    }

    if (String(weekLesson) === String(selectedLesson) && attendanceRecords[idStr]) {
      return attendanceRecords[idStr];
    }

    return '';
  }, [attendanceRecords, attendanceStatusIndex, weekAttendanceMap, calculatedWeekDates, weekDateMap, attendanceDate, selectedLesson]);

  const weeklyDisplayedStudents = useMemo(() => {
    const weekNum = parseInt(selectedLesson);
    if (isNaN(weekNum) || weekNum <= 0) return sectionScopedStudents;

    return sectionScopedStudents.filter(student => {
      const status = getStudentAttendanceStatus(student.id, weekNum);
      if (hideAbsentInWeekly && (status === 'absent' || status === 'leave')) {
        return false;
      }
      return true;
    });
  }, [sectionScopedStudents, selectedLesson, hideAbsentInWeekly, getStudentAttendanceStatus]);

  const weeklyAttendanceCounts = useMemo(() => {
    if (!selectedLesson) {
      return { absent: 0, leave: 0, present: 0, late: 0, noData: 0, total: sectionScopedStudents.length };
    }
    const weekNum = parseInt(selectedLesson);
    if (isNaN(weekNum)) return { absent: 0, leave: 0, present: 0, late: 0, noData: 0, total: sectionScopedStudents.length };

    let absent = 0, leave = 0, present = 0, late = 0, noData = 0;
    sectionScopedStudents.forEach(student => {
      const status = getStudentAttendanceStatus(student.id, weekNum);
      if (status === 'absent') absent++;
      else if (status === 'leave') leave++;
      else if (status === 'present') present++;
      else if (status === 'late') late++;
      else noData++;
    });

    return { absent, leave, present, late, noData, total: sectionScopedStudents.length };
  }, [sectionScopedStudents, selectedLesson, getStudentAttendanceStatus]);

  // Auto-fill 0 in score fields for absent and leave students for the active week
  useEffect(() => {
    if (!selectedClass || !selectedLesson) return;
    const weekNum = parseInt(selectedLesson);
    if (isNaN(weekNum) || weekNum <= 0 || !students.length) return;

    let changedWeekly = false;
    let changedMatrix = false;

    setScores(prevScores => {
      const nextScores = { ...prevScores };
      students.forEach(student => {
        const status = getStudentAttendanceStatus(student.id, weekNum);
        if (status === 'absent' || status === 'leave') {
          const idStr = String(student.id);
          const currWeekly = nextScores[idStr];
          if (!currWeekly || currWeekly.assignment_score === '' || currWeekly.post_test_score === '') {
            nextScores[idStr] = {
              assignment_score: currWeekly?.assignment_score !== '' && currWeekly?.assignment_score !== undefined ? currWeekly.assignment_score : 0,
              post_test_score: currWeekly?.post_test_score !== '' && currWeekly?.post_test_score !== undefined ? currWeekly.post_test_score : 0,
            };
            changedWeekly = true;
          }
        }
      });
      return changedWeekly ? nextScores : prevScores;
    });

    setMatrixScores(prevMatrix => {
      const nextMatrixScores = { ...prevMatrix };
      students.forEach(student => {
        const status = getStudentAttendanceStatus(student.id, weekNum);
        if (status === 'absent' || status === 'leave') {
          const matrixKey = `${student.id}_${weekNum}`;
          const currMatrix = nextMatrixScores[matrixKey];
          if (!currMatrix || currMatrix.assignment_score === '' || currMatrix.post_test_score === '') {
            nextMatrixScores[matrixKey] = {
              assignment_score: currMatrix?.assignment_score !== '' && currMatrix?.assignment_score !== undefined ? currMatrix.assignment_score : 0,
              post_test_score: currMatrix?.post_test_score !== '' && currMatrix?.post_test_score !== undefined ? currMatrix.post_test_score : 0,
            };
            changedMatrix = true;
          }
        }
      });
      return changedMatrix ? nextMatrixScores : prevMatrix;
    });
  }, [selectedLesson, selectedClass, students, getStudentAttendanceStatus]);

  // ─── Quick Fill 0 for Absent & Leave Students ───
  const handleFillZeroForAbsentees = (targetWeekNum?: number) => {
    const targetWeek = targetWeekNum || (Number(selectedLesson) ? Number(selectedLesson) : null);
    let fillCount = 0;

    setMatrixScores(prev => {
      const next = { ...prev };
      sectionScopedStudents.forEach(student => {
        const weekNums = targetWeek ? [targetWeek] : structures.map(s => s.lesson_number);
        weekNums.forEach(wNum => {
          const status = getStudentAttendanceStatus(student.id, wNum);
          if (status === 'absent' || status === 'leave') {
            const key = `${student.id}_${wNum}`;
            const current = next[key];
            if (!current || current.assignment_score !== 0 || current.post_test_score !== 0) {
              next[key] = { assignment_score: 0, post_test_score: 0 };
              fillCount++;
            }
          }
        });
      });
      return next;
    });

    if (selectedLesson) {
      const weekNum = parseInt(selectedLesson);
      if (!isNaN(weekNum) && weekNum > 0) {
        setScores(prev => {
          const next = { ...prev };
          sectionScopedStudents.forEach(student => {
            const status = getStudentAttendanceStatus(student.id, weekNum);
            if (status === 'absent' || status === 'leave') {
              next[String(student.id)] = { assignment_score: 0, post_test_score: 0 };
            }
          });
          return next;
        });
      }
    }

    setHasPendingChanges(true);
    const scopeLabel = activeSectionGroup ? `ห้อง "${activeSectionGroup.label}"` : '';
    toast.success(`เติมคะแนน 0 ให้ผู้เรียนที่ขาด/ลา ${scopeLabel} (${fillCount} ช่อง) เรียบร้อยแล้ว`);
  };

  const handleFillSingleStudentZero = (studentId: string | number, lessonNum?: number) => {
    const targetLesson = lessonNum || parseInt(selectedLesson);
    if (!isNaN(targetLesson) && targetLesson > 0) {
      setMatrixScores(prev => ({
        ...prev,
        [`${studentId}_${targetLesson}`]: { assignment_score: 0, post_test_score: 0 },
      }));
    }
    setScores(prev => ({
      ...prev,
      [String(studentId)]: { assignment_score: 0, post_test_score: 0 },
    }));
    setHasPendingChanges(true);
    toast.success('กำหนดคะแนน 0 สำหรับนักเรียนที่ขาด/ลาแล้ว');
  };

  const handleStructureChange = (index: number, field: keyof ScoreStructure, value: string | number) => {
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
          hours: parseFloat(String(s.hours)) || 0,
        })),
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
        [field]: value,
      },
    }));
    setHasPendingChanges(true);
  }, []);

  const handleWeeklyScoreChange = (studentId: string | number, field: 'assignment_score' | 'post_test_score', value: string) => {
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { assignment_score: '', post_test_score: '' }),
        [field]: value,
      },
    }));

    const key = `${studentId}_${selectedLesson}`;
    setMatrixScores(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { assignment_score: '', post_test_score: '' }),
        [field]: value,
      },
    }));
    setHasPendingChanges(true);
  };

  // ─── Mutation: บันทึกคะแนนแบบ Bulk Matrix Transaction ───
  const saveMatrixScoresMutation = useMutation({
    mutationFn: async () => {
      const currentMatrix = matrixScores;
      const bulkScores: {
        student_id: string | number;
        lesson_number: number;
        assignment_score?: number | string | null;
        post_test_score?: number | string | null;
      }[] = [];

      Object.keys(currentMatrix).forEach(key => {
        const [studentIdStr, lessonNumStr] = key.split('_');
        const studentId = studentIdStr;
        const lessonNumber = parseInt(lessonNumStr);
        const val = currentMatrix[key];
        if (val && !isNaN(lessonNumber)) {
          bulkScores.push({
            student_id: studentId,
            lesson_number: lessonNumber,
            assignment_score: val.assignment_score,
            post_test_score: val.post_test_score,
          });
        }
      });

      await api.post(`/scores?classroom_id=${selectedClass}`, {
        classroom_id: selectedClass,
        scores: bulkScores,
      });
    },
    onSuccess: () => {
      setHasPendingChanges(false);
      const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(now);
      toast.success('บันทึกคะแนนรวมเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      refetchMatrix();
    },
    onError: () => {
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    },
  });

  // ─── Mutation: บันทึกคะแนนสัปดาห์เดียว ───
  const saveWeeklyScoresMutation = useMutation({
    mutationFn: async () => {
      const currentScores = scores;
      const scoresArray = Object.keys(currentScores).map(studentId => ({
        student_id: studentId,
        assignment_score: currentScores[studentId]?.assignment_score,
        post_test_score: currentScores[studentId]?.post_test_score,
      }));

      await api.post(`/scores?classroom_id=${selectedClass}`, {
        classroom_id: selectedClass,
        lesson_number: selectedLesson,
        scores: scoresArray,
      });
    },
    onSuccess: () => {
      setHasPendingChanges(false);
      const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(now);
      toast.success('บันทึกคะแนนเรียบร้อย');
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      refetchMatrix();
    },
    onError: () => {
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    },
  });

  const saveScores = () => {
    if (!selectedClass) return;
    if (viewMode === 'matrix') {
      saveMatrixScoresMutation.mutate();
    } else {
      saveWeeklyScoresMutation.mutate();
    }
  };

  const handleClassroomSelectChange = (newClassId: string) => {
    if (newClassId === selectedClass) return;
    setHasPendingChanges(false);
    setSelectedClass(newClassId);
  };

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    setHasPendingChanges(false);
    setActiveTab(tab);
  };

  const handleViewModeChange = (mode: 'matrix' | 'weekly') => {
    if (mode === viewMode) return;
    setHasPendingChanges(false);
    setViewMode(mode);
  };

  const handleLessonChange = (newLesson: string) => {
    if (newLesson === selectedLesson) return;
    setHasPendingChanges(false);
    setSelectedLesson(newLesson);
    const weekNum = parseInt(newLesson);
    if (!isNaN(weekNum) && weekNum > 0) {
      const targetDate = calculatedWeekDates[weekNum] || weekDateMap[weekNum];
      if (targetDate) {
        setAttendanceDate(targetDate);
      }
    }
  };

  // --- Open Test Blueprint Calculator with Smart Auto-Prefill ---
  const handleOpenCalculator = () => {
    const nameOrDesc = `${classroomObj?.name || ''} ${classroomObj?.description || ''}`;
    const isPwsClass = Boolean(nameOrDesc.includes('ปวส') || nameOrDesc.includes('ปวส.') || classroomObj?.curriculum_type === 'pvs');
    const detectedWeeks = isPwsClass ? 15 : 18;
    setCurriculumWeeks(detectedWeeks);
    setHasMidtermCalculator(!isPwsClass && Number(classroomObj?.midterm_weight ?? 0) > 0);

    const assignWeight = Number(classroomObj?.assignment_weight) || 0;
    const postTestWeight = Number(classroomObj?.post_test_weight) || 0;
    const academicSum = assignWeight + postTestWeight;
    if (academicSum > 0) {
      setTotalAcademicScore(academicSum);
    } else {
      setTotalAcademicScore(40);
    }

    const match = nameOrDesc.match(/\(?\b(\d+)\s*[-–/]\s*(\d+)\s*[-–/]\s*(\d+)\b\)?/);
    if (match) {
      const t = parseInt(match[1]);
      const p = parseInt(match[2]);
      if (!isNaN(t) && !isNaN(p) && (t > 0 || p > 0)) {
        setTheoryHoursPerWeek(t);
        setPracticeHoursPerWeek(p);
      }
    } else {
      const classEntries = allTimetableEntries.filter(
        e => String(e.classroom_id) === String(selectedClass)
      );
      if (classEntries.length > 0) {
        let tHours = 0;
        let pHours = 0;
        classEntries.forEach((entry: { hours?: number; entry_type?: string; entryType?: string }) => {
          const h = Number(entry.hours) || 1;
          if (entry.entry_type === 'lab' || entry.entryType === 'lab') {
            pHours += h;
          } else {
            tHours += h;
          }
        });
        if (tHours > 0 || pHours > 0) {
          setTheoryHoursPerWeek(tHours || 2);
          setPracticeHoursPerWeek(pHours || 2);
        }
      }
    }

    setShowCalculator(true);
  };

  // --- Test Blueprint Calculator with Smart Fallback & Curriculum (ปวช./ปวส.) ---
  const calculateBlueprint = (customTeachingWeeks?: number) => {
    const totalContactHours = (Number(theoryHoursPerWeek) || 0) + (Number(practiceHoursPerWeek) || 0);
    if (totalContactHours === 0) {
      toast.error('กรุณาระบุชั่วโมงทฤษฎีและปฏิบัติ (ต้องรวมกันมากกว่า 0)');
      return;
    }

    const weeksCount = customTeachingWeeks || targetTeachingWeeks;

    let effectiveStructures = structures;
    if (effectiveStructures.length !== weeksCount) {
      if (effectiveStructures.length > weeksCount) {
        effectiveStructures = effectiveStructures.slice(0, weeksCount);
      } else {
        const diff = weeksCount - effectiveStructures.length;
        const startNum = effectiveStructures.length + 1;
        const padding = Array.from({ length: diff }, (_, i) => ({
          lesson_number: startNum + i,
          lesson_name: `บทที่/สัปดาห์ที่ ${startNum + i}`,
          max_assignment_score: 10,
          max_post_test_score: 10,
          hours: totalContactHours,
        }));
        effectiveStructures = [...effectiveStructures, ...padding];
      }
    }

    let totalHours = 0;
    effectiveStructures.forEach(s => { totalHours += parseFloat(String(s.hours)) || 0; });

    if (totalHours === 0) {
      effectiveStructures = effectiveStructures.map(s => ({
        ...s,
        hours: totalContactHours,
      }));
      totalHours = effectiveStructures.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
    }

    const practiceRatio = practiceHoursPerWeek / totalContactHours;
    const theoryRatio = theoryHoursPerWeek / totalContactHours;

    let newStructs: ScoreStructure[] = [];

    if (scoreScaleMode === 'standard_10') {
      let assignPerWeek = standardWeeklyBaseScore;
      let postTestPerWeek = standardWeeklyBaseScore;

      if (practiceRatio > theoryRatio) {
        assignPerWeek = standardWeeklyBaseScore;
        postTestPerWeek = Math.max(1, Math.round(standardWeeklyBaseScore * (theoryRatio / practiceRatio)));
      } else if (theoryRatio > practiceRatio) {
        postTestPerWeek = standardWeeklyBaseScore;
        assignPerWeek = Math.max(1, Math.round(standardWeeklyBaseScore * (practiceRatio / theoryRatio)));
      }

      newStructs = effectiveStructures.map(s => ({
        ...s,
        hours: s.hours || totalContactHours,
        max_assignment_score: assignPerWeek,
        max_post_test_score: postTestPerWeek,
      }));

      const totalRaw = newStructs.reduce((sum, s) => sum + Number(s.max_assignment_score || 0) + Number(s.max_post_test_score || 0), 0);
      toast.success(`ตั้งค่าสัดส่วนสำเร็จ (${curriculumWeeks === 15 ? 'ปวส. 15 สัปดาห์' : 'ปวช. 18 สัปดาห์'})! สอบย่อยเต็ม ${postTestPerWeek} | งานเก็บเต็ม ${assignPerWeek} (รวมดิบ ${totalRaw} คะแนน — ทอนน้ำหนัก ${totalAcademicScore} ในหน้าตัดเกรดอัตโนมัติ)`);
    } else {
      let runningSkillTotal = 0;
      let runningTestTotal = 0;
      const targetSkillTotal = Math.round(totalAcademicScore * practiceRatio);
      const targetTestTotal = totalAcademicScore - targetSkillTotal;

      newStructs = effectiveStructures.map((s, index) => {
        const h = parseFloat(String(s.hours)) || 0;
        const baseScore = totalHours > 0 ? (h / totalHours) * totalAcademicScore : (totalAcademicScore / effectiveStructures.length);
        let finalSkill, finalPostTest;

        if (index === effectiveStructures.length - 1) {
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
          hours: s.hours || totalContactHours,
          max_assignment_score: Math.max(0, finalSkill),
          max_post_test_score: Math.max(0, finalPostTest),
        };
      });

      toast.success(`คำนวณสัดส่วนสำเร็จ (${curriculumWeeks === 15 ? 'ปวส. 15 สัปดาห์' : 'ปวช. 18 สัปดาห์'})! สอบย่อย = ${targetTestTotal} | งานเก็บ = ${targetSkillTotal} | รวม = ${totalAcademicScore}`);
    }

    setStructures(newStructs);
    setShowCalculator(false);
  };

  const saving = saveStructureMutation.isPending || saveMatrixScoresMutation.isPending || saveWeeklyScoresMutation.isPending;
  const currentStruct = structures.find(s => s.lesson_number.toString() === selectedLesson.toString()) || { max_assignment_score: 0, max_post_test_score: 0 };

  const selectedClassData = classrooms.find(c => String(c.id) === String(selectedClass));
  const activeParsed = useMemo(() => {
    return selectedClassData ? parseClassroomName(selectedClassData.name) : null;
  }, [selectedClassData]);

  if (loadingClassrooms) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Active Classroom Bar */}
      {selectedClass && selectedClassData && activeParsed && (
        <div className="glass p-5 sm:p-6 rounded-3xl border border-indigo-100/80 bg-white/95 shadow-xl shadow-indigo-100/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                <BookOpen className="w-6 h-6" />
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
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
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

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={e => handleClassroomSelectChange(e.target.value)}
                  className="form-input text-xs font-bold py-2 pl-3 pr-8 bg-white/90 hover:bg-white border-slate-200 rounded-xl focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 transition-all text-slate-700 cursor-pointer shadow-xs max-w-[200px] sm:max-w-[260px] truncate"
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
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 transition-all shadow-xs cursor-pointer shrink-0"
                title="ย้อนกลับไปดูการ์ดห้องเรียนทั้งหมด"
              >
                <Grid className="w-3.5 h-3.5 text-indigo-600" />
                <span>การ์ดทั้งหมด</span>
              </button>
            </div>
          </div>

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
                  themeColor="indigo"
                  label="แยกห้องบันทึกคะแนน:"
                  rightContent={
                    activeSectionGroup ? (
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        กำลังบันทึกคะแนนห้อง: <span className="text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200/70">{activeSectionGroup.label}</span>
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

      {/* Classroom Card Picker */}
      {!selectedClass && (
        <ClassroomCardPicker
          classrooms={classrooms}
          onSelect={(id) => handleClassroomSelectChange(id)}
          title="เลือกห้องเรียนเพื่อจัดการคะแนน"
          subtitle=""
          icon={<BookOpen className="w-6 h-6" />}
          themeColor="indigo"
          actionText="เปิดสมุดคะแนนห้องนี้"
        />
      )}

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
                <p className="text-xs font-semibold text-slate-500">จำนวนนักเรียน{activeSectionGroup ? ` (${activeSectionGroup.label})` : 'ทั้งหมด'}</p>
                <p className="text-xl font-extrabold text-slate-800">{sectionScopedStudents.length} คน</p>
              </div>
            </div>
          </div>

          {/* Navigation Bar & Mode Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-indigo-100 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => handleTabChange('entry')}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-xl transition-all ${activeTab === 'entry'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 hover:bg-indigo-50'
                  }`}
              >
                <FileText className="w-4 h-4" /> ตารางกรอกคะแนน
              </button>
              <button
                onClick={() => handleTabChange('settings')}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-xl transition-all ${activeTab === 'settings'
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
                  onClick={() => handleViewModeChange('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'matrix' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Grid className="w-3.5 h-3.5" /> ตารางรวมทั้งเทอม (Excel View)
                </button>
                <button
                  onClick={() => handleViewModeChange('weekly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'weekly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Table className="w-3.5 h-3.5" /> โฟกัสรายสัปดาห์ (Weekly Focus)
                </button>
              </div>
            )}
          </div>

          {/* ─── TAB: โครงสร้างคะแนนเต็ม (Settings) ─── */}
          {activeTab === 'settings' && (
            <ScoreBlueprintSettingsTab
              structures={structures}
              setStructures={setStructures}
              setCurriculumWeeks={setCurriculumWeeks}
              isPws={isPws}
              saving={saving}
              onOpenCalculator={handleOpenCalculator}
              onOpenExcelImportModal={() => setShowExcelImportModal(true)}
              onSaveStructure={saveStructure}
              onStructureChange={handleStructureChange}
            />
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  {saving && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 animate-pulse shadow-2xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> กำลังบันทึกข้อมูล...
                    </span>
                  )}

                  {!saving && !hasPendingChanges && lastSavedTime && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50/90 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> บันทึกล่าสุดเมื่อ {lastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-900 shadow-2xs">
                    <span>📅 วันเริ่มสอน:</span>
                    <input
                      type="date"
                      value={semesterStartDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="form-input py-0.5 px-2 bg-white border-indigo-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                      title="เลือกวันเริ่มต้นสอนของภาคเรียน เพื่อให้ระบบคำนวณวันที่ของทั้ง 18 สัปดาห์อัตโนมัติ"
                    />
                  </div>
                  <button
                    onClick={() => handleFillZeroForAbsentees()}
                    className="btn bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="กรอกคะแนน 0 ให้อัตโนมัติสำหรับนักเรียนที่มีประวัติขาดเรียนหรือลา"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> ⚡ กรอก 0 คนขาดเรียน
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExcelImportModal(true)}
                    className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
                    title="เปิดหน้าต่างนำเข้าคะแนนจาก Excel พร้อมดูตัวอย่างรูปแบบและดาวน์โหลดเทมเพลต"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>นำเข้าคะแนน (Excel) & ตัวอย่างไฟล์</span>
                  </button>
                  <button onClick={() => setShowExportModal(true)} className="btn bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs flex items-center gap-1.5 font-semibold shadow-2xs">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> พรีวิว & ส่งออก Excel
                  </button>
                  <button
                    onClick={saveScores}
                    disabled={saving}
                    className={`btn text-xs flex items-center gap-1.5 shadow-md ${hasPendingChanges
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400/50 font-bold animate-pulse shadow-indigo-500/30'
                      : 'btn-primary shadow-indigo-500/20'
                      }`}
                  >
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFillZeroForAbsentees()}
                        className="btn bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                        title="ตรวจจับและเติม 0 ให้อัตโนมัติทุกสัปดาห์ที่มีการเช็คชื่อว่า ขาด หรือ ลา"
                      >
                        ⚡ ใส่ 0 คนขาด/ลา ทุกสัปดาห์
                      </button>
                    </div>
                  </div>

                  {/* Mobile Recommendation Banner for Matrix Mode */}
                  <div className="md:hidden p-3 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-xs text-amber-900">
                    <span className="font-medium">
                      💡 บนโทรศัพท์ แนะนำใช้ <strong>&quot;โฟกัสรายสัปดาห์&quot;</strong> เพื่อกรอกคะแนนได้สะดวกที่สุด
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('weekly')}
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-bold text-amber-900 shadow-2xs shrink-0 active:scale-95"
                    >
                      สลับโหมด
                    </button>
                  </div>

                  {matrixLoading ? (
                    <div className="p-16 text-center text-indigo-500 flex flex-col items-center gap-3">
                      <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
                      <span className="text-sm font-semibold text-slate-700">กำลังโหลดข้อมูลคะแนนและโครงสร้างทั้งเทอม...</span>
                    </div>
                  ) : (
                    <div
                      className="overflow-x-auto max-h-[620px] overflow-y-auto relative scrollbar-thin"
                      style={{
                        overscrollBehavior: 'contain',
                        contain: 'paint',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x pan-y',
                      }}
                    >
                      <table
                        className="text-left border-separate border-spacing-0 text-xs table-fixed"
                        style={{
                          width: 120 + 200 + (structures.length * 104) + 260,
                          minWidth: 120 + 200 + (structures.length * 104) + 260,
                        }}
                      >
                        <colgroup>
                          <col style={{ width: 120, minWidth: 120, maxWidth: 120 }} />
                          <col style={{ width: 200, minWidth: 200, maxWidth: 200 }} />
                          {structures.map(s => (
                            <Fragment key={s.lesson_number}>
                              <col style={{ width: 52, minWidth: 52, maxWidth: 52 }} />
                              <col style={{ width: 52, minWidth: 52, maxWidth: 52 }} />
                            </Fragment>
                          ))}
                          <col style={{ width: 65, minWidth: 65, maxWidth: 65 }} />
                          <col style={{ width: 65, minWidth: 65, maxWidth: 65 }} />
                          <col style={{ width: 65, minWidth: 65, maxWidth: 65 }} />
                          <col style={{ width: 65, minWidth: 65, maxWidth: 65 }} />
                        </colgroup>
                        <thead className="sticky top-0 z-30 bg-indigo-100">
                          <tr className="h-[44px] bg-indigo-100">
                            <th
                              rowSpan={2}
                              className="p-3 sticky top-0 left-0 z-40 bg-indigo-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] text-center font-bold border-r border-indigo-200 text-slate-700"
                              style={{ left: 0, top: 0, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: '#e0e7ff', backfaceVisibility: 'hidden' }}
                            >
                              รหัส
                            </th>
                            <th
                              rowSpan={2}
                              className="p-3 sticky top-0 z-40 bg-indigo-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] font-bold border-r border-indigo-200 text-slate-700 text-left pl-3"
                              style={{ left: 120, top: 0, width: 200, minWidth: 200, maxWidth: 200, backgroundColor: '#e0e7ff', backfaceVisibility: 'hidden' }}
                            >
                              ชื่อ-นามสกุล
                            </th>
                            {structures.map(struct => {
                              const dateStr = calculatedWeekDates[struct.lesson_number] || weekDateMap[struct.lesson_number];
                              const dateInfo = formatThaiFullDateHeader(dateStr);
                              const holiday = dateStr ? checkThaiHoliday(dateStr) : null;
                              return (
                                <th
                                  key={struct.lesson_number}
                                  colSpan={2}
                                  className="p-2 text-center border-l border-indigo-200 font-bold sticky top-0 z-20 bg-indigo-100 text-slate-800"
                                  style={{ top: 0, height: 44, width: 104, minWidth: 104, maxWidth: 104, backgroundColor: '#e0e7ff', backfaceVisibility: 'hidden' }}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-xs font-black text-slate-800">W{struct.lesson_number}</span>
                                    {dateInfo ? (
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shadow-2xs ${holiday
                                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                                          : 'bg-white text-indigo-800 border-indigo-200'
                                          }`}
                                        title={holiday ? `วันหยุด: ${holiday.name}` : `วันที่สอน: ${dateStr}`}
                                      >
                                        {holiday ? '🏖️' : ''} {dateInfo.label}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-normal text-slate-400">
                                        ({struct.max_assignment_score}/{struct.max_post_test_score})
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                            {hasMidterm && (
                              <th
                                rowSpan={2}
                                className="p-3 text-center border-l border-indigo-200 bg-cyan-100 font-bold sticky top-0 z-20 text-cyan-950"
                                style={{ top: 0, width: 75, minWidth: 75, maxWidth: 75, backgroundColor: '#cffafe', backfaceVisibility: 'hidden' }}
                                title="คะแนนสอบกลางภาค (สัปดาห์ที่ 9 สำหรับ ปวช.)"
                              >
                                <div className="flex flex-col items-center">
                                  <span>กลางภาค</span>
                                  <span className="text-[10px] font-normal text-cyan-800">(W9)</span>
                                </div>
                              </th>
                            )}
                            <th
                              rowSpan={2}
                              className="p-3 text-center bg-blue-100 font-bold sticky top-0 z-20 text-blue-950"
                              style={{ top: 0, width: 75, minWidth: 75, maxWidth: 75, backgroundColor: '#dbeafe', backfaceVisibility: 'hidden' }}
                              title={`คะแนนสอบปลายภาค (${isPws ? 'สัปดาห์ที่ 15' : 'สัปดาห์ที่ 18'})`}
                            >
                              <div className="flex flex-col items-center">
                                <span>ปลายภาค</span>
                                <span className="text-[10px] font-normal text-blue-800">({isPws ? 'W15' : 'W18'})</span>
                              </div>
                            </th>
                            <th
                              rowSpan={2}
                              className="p-3 text-center bg-pink-100 font-bold sticky top-0 z-20 text-pink-950"
                              style={{ top: 0, width: 65, minWidth: 65, maxWidth: 65, backgroundColor: '#fce7f3', backfaceVisibility: 'hidden' }}
                              title="กรอกหรือคำนวณคะแนนจิตพิสัยอัตโนมัติได้ที่เมนู ตัดเกรด"
                            >
                              จิตพิสัย
                            </th>
                            <th
                              rowSpan={2}
                              className="p-3 text-center bg-indigo-200 font-extrabold text-indigo-950 sticky top-0 z-20"
                              style={{ top: 0, width: 65, minWidth: 65, maxWidth: 65, backgroundColor: '#c7d2fe', backfaceVisibility: 'hidden' }}
                            >
                              รวมคะแนน
                            </th>
                          </tr>
                          <tr className="h-[26px] bg-indigo-50">
                            {structures.map(struct => (
                              <Fragment key={struct.lesson_number}>
                                <th
                                  className="p-1 text-center border-l border-indigo-200 text-emerald-700 font-semibold sticky z-20 bg-indigo-50 border-b"
                                  style={{ top: 44, width: 52, minWidth: 52, maxWidth: 52, backgroundColor: '#eef2ff', backfaceVisibility: 'hidden' }}
                                >
                                  งาน
                                </th>
                                <th
                                  className="p-1 text-center text-amber-700 font-semibold sticky z-20 bg-indigo-50 border-b border-l border-indigo-200/50"
                                  style={{ top: 44, width: 52, minWidth: 52, maxWidth: 52, backgroundColor: '#eef2ff', backfaceVisibility: 'hidden' }}
                                >
                                  สอบ
                                </th>
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sectionScopedStudents.map((student, idx) => (
                            <MatrixStudentRow
                              key={student.id}
                              student={student}
                              idx={idx}
                              structures={structures}
                              matrixScores={matrixScores}
                              onScoreChange={handleMatrixScoreChange}
                              hasMidterm={hasMidterm}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: Weekly Focus View */}
              {viewMode === 'weekly' && (
                <WeeklyFocusView
                  structures={structures}
                  selectedLesson={selectedLesson}
                  onLessonChange={handleLessonChange}
                  calculatedWeekDates={calculatedWeekDates}
                  weekDateMap={weekDateMap}
                  currentStruct={currentStruct}
                  showAttendance={showAttendance}
                  setShowAttendance={setShowAttendance}
                  attendanceDate={attendanceDate}
                  setAttendanceDate={setAttendanceDate}
                  weeklyAttendanceCounts={weeklyAttendanceCounts}
                  hideAbsentInWeekly={hideAbsentInWeekly}
                  setHideAbsentInWeekly={setHideAbsentInWeekly}
                  studentsCount={students.length}
                  weeklyDisplayedStudents={weeklyDisplayedStudents}
                  scores={scores}
                  getStudentAttendanceStatus={getStudentAttendanceStatus}
                  onFillZeroForAbsentees={handleFillZeroForAbsentees}
                  onFillSingleStudentZero={handleFillSingleStudentZero}
                  onWeeklyScoreChange={handleWeeklyScoreChange}
                />
              )}
            </div>
          )}

          {/* Calculator Modal */}
          <BlueprintCalculatorModal
            isOpen={showCalculator}
            onClose={() => setShowCalculator(false)}
            curriculumWeeks={curriculumWeeks}
            setCurriculumWeeks={setCurriculumWeeks}
            hasMidterm={hasMidtermCalculator}
            setHasMidterm={setHasMidtermCalculator}
            scoreScaleMode={scoreScaleMode}
            setScoreScaleMode={setScoreScaleMode}
            standardWeeklyBaseScore={standardWeeklyBaseScore}
            setStandardWeeklyBaseScore={setStandardWeeklyBaseScore}
            totalAcademicScore={totalAcademicScore}
            setTotalAcademicScore={setTotalAcademicScore}
            theoryHoursPerWeek={theoryHoursPerWeek}
            setTheoryHoursPerWeek={setTheoryHoursPerWeek}
            practiceHoursPerWeek={practiceHoursPerWeek}
            setPracticeHoursPerWeek={setPracticeHoursPerWeek}
            onCalculate={(tWeeks, midExam) => {
              calculateBlueprint(tWeeks);
              if (!isPws && selectedClass) {
                const currentWeight = Number(classroomObj?.midterm_weight ?? 0);
                if (midExam && currentWeight === 0) {
                  api.put(`/classrooms/${selectedClass}`, { midterm_weight: 15 })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['classrooms'] }));
                } else if (!midExam && currentWeight > 0) {
                  api.put(`/classrooms/${selectedClass}`, { midterm_weight: 0 })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['classrooms'] }));
                }
              }
            }}
          />

          {/* Excel Live Preview & Export Modal */}
          <ScoreExcelModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            classroom={classroomObj || null}
            students={sectionScopedStudents}
            structures={structures}
            matrixScores={matrixScores}
            calculatedWeekDates={calculatedWeekDates}
            weekAttendanceMap={weekAttendanceMap}
            analyticsSummary={analyticsSummary}
          />

          {/* Excel Import & Template Modal */}
          {selectedClass && (
            <ScoreImportModal
              isOpen={showExcelImportModal}
              onClose={() => setShowExcelImportModal(false)}
              classroomName={classroomObj?.name || 'ห้องเรียน'}
              students={students}
              structures={structures}
              onImportScores={async (importedScores, type) => {
                await api.post(`/scores?classroom_id=${selectedClass}`, {
                  classroom_id: selectedClass,
                  scores: importedScores.map(d => ({
                    student_id: d.student_id,
                    lesson_number: d.lesson_number,
                    ...(type === 'assignment' ? { assignment_score: d.assignment_score } : { post_test_score: d.post_test_score }),
                  })),
                });
                toast.success(`นำเข้าคะแนนสำเร็จ ${importedScores.length} รายการ`);
                refetchMatrix();
              }}
              onImportBlueprint={(newStructs) => {
                setStructures(newStructs);
                saveStructureMutation.mutate();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
