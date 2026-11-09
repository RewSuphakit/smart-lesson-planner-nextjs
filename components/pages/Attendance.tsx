'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo, Fragment, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { createPortal } from 'react-dom';
import {
  Loader2, Users, Save, Calendar as CalendarIcon, CheckCircle, Clock, XCircle,
  FileText, AlertCircle, X, History, Trash2, ChevronLeft, ChevronRight,
  Search, Check, Grid, List, RefreshCw, Sparkles, RotateCcw,
  FileSpreadsheet, Upload, BookOpen, GraduationCap, ArrowRight,
  GitBranch, ChevronDown
} from 'lucide-react';
import toast from '@/lib/toast';
import dynamic from 'next/dynamic';

const AttendanceCsvModal = dynamic(() => import('@/components/AttendanceCsvModal'), { ssr: false });
const AttendanceImportModal = dynamic(() => import('@/components/AttendanceImportModal'), { ssr: false });

import { getThaiHolidays, checkThaiHoliday, HolidayInfo } from '@/lib/thaiHolidays';
import { buildStudentSectionGroups } from '@/lib/studentSections';
import UserAvatar from '@/components/UserAvatar';
import OfflineBanner from '@/components/OfflineBanner';
import {
  enqueueOfflineAttendance,
  enqueueBatchOfflineAttendance,
  cacheClassroomRoster,
  cacheAttendanceState,
} from '@/lib/offlineAttendance';

import {
  TimetableEntry,
  Classroom,
  ParsedClassroomName,
  parseClassroomName,
  SemesterWeek,
  SemesterInfo,
  Student,
  AttendanceRecord,
  StudentStats,
  ActiveTab,
  AutoSaveStatus,
  THAI_MONTHS_SHORT,
  getSchemaDayOfWeek,
  MemoizedAttendanceCell,
  ThaiDateRangePicker,
  MobileStudentAttendanceCard,
  MemoizedDesktopStudentRow,
  AttendanceRetroactiveModal,
  AttendanceHistoryModal,
  AttendanceStatsBar,
  AttendanceClassroomSelector,
  AttendanceHeader,
  AttendanceDailyToolbar,
  useAttendanceFilters,
} from './attendance/index';

export { parseClassroomName };
export type { ParsedClassroomName };

export default function Attendance({
  initialClassrooms,
}: {
  initialClassrooms?: Classroom[];
} = {}) {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('classroom_id') || '';
    }
    return '';
  });
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StudentStats[]>([]);

  // Filters hook
  const {
    searchQuery,
    setSearchQuery,
    classSearch,
    setClassSearch,
    classFilter,
    setClassFilter,
    selectedSectionKey,
    setSelectedSectionKey,
    collapsedSections,
    setCollapsedSections,
    toggleSectionCollapse,
    teachingDays,
    setTeachingDays,
    matrixStartDate,
    setMatrixStartDate,
    matrixEndDate,
    setMatrixEndDate,
  } = useAttendanceFilters();

  // Auto-Save state
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendance_autosave');
      return saved !== 'false';
    }
    return true;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync autoSave choice to localStorage
  useEffect(() => {
    localStorage.setItem('attendance_autosave', String(autoSave));
  }, [autoSave]);

  const renderAutoSaveStatus = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>กำลังบันทึกอัตโนมัติ...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-all">
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกสำเร็จ</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>บันทึกไม่สำเร็จ</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 font-medium">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>บันทึกอัตโนมัติพร้อมใช้งาน</span>
          </div>
        );
    }
  };

  // Tabs state
  const [activeTab, setActiveTab] = useState<'daily' | 'matrix'>('daily');

  // Matrix editing cell
  const [matrixEditingCell, setMatrixEditingCell] = useState<{ studentId: string; date: string } | null>(null);

  // History Modal state
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // ─── Retroactive Attendance Modal State ───
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);

  const cellPopoverRef = useRef<HTMLDivElement>(null);

  // ─── Query: ดึงข้อมูลห้องเรียน (shared cache) ───
  const { data: classrooms = initialClassrooms || [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
    initialData: initialClassrooms && initialClassrooms.length > 0 ? initialClassrooms : undefined,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Query: ข้อมูลภาคเรียนและสัปดาห์ (Semester Info) ───
  const { data: semesterInfo } = useQuery<SemesterInfo>({
    queryKey: ['semester-info', selectedClass],
    queryFn: async () => {
      const res = await api.get(`/semester?classroom_id=${selectedClass}`);
      return res.data.data;
    },
    enabled: !!selectedClass,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Query: ดึงข้อมูลตารางเรียนทั้งหมด (All Timetable Entries) ───
  const { data: allTimetableEntries = [] } = useQuery<TimetableEntry[]>({
    queryKey: ['timetable-all'],
    queryFn: async () => {
      const res = await api.get('/timetable');
      return res.data.data?.entries || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const todayEntries = useMemo(() => {
    const jsDay = new Date().getDay();
    const schemaDayOfWeek = (jsDay + 6) % 7;
    return allTimetableEntries.filter(e => {
      if (e.day_of_week !== schemaDayOfWeek) return false;
      // กรองคาบหน้าเสาธง/โฮมรูม/เข้าแถว ออก ไม่นำมาแสดงเป็นคาบเรียนวันนี้
      if (e.start_period === 0) return false;
      if (e.entry_type === 'homeroom') return false;
      const name = `${e.subject_name || ''} ${e.subject_code || ''}`.toLowerCase();
      if (name.includes('เสาธง') || name.includes('โฮมรูม') || name.includes('เข้าแถว')) return false;
      return true;
    });
  }, [allTimetableEntries]);

  useEffect(() => {
    if (!selectedClass) return;
    const classEntries = allTimetableEntries.filter(
      e => String(e.classroom_id) === String(selectedClass) &&
        e.start_period !== 0 &&
        e.entry_type !== 'homeroom' &&
        !e.subject_name?.includes('เสาธง') &&
        !e.subject_name?.includes('เข้าแถว')
    );
    const timetableDays = Array.from(new Set(classEntries.map(e => e.day_of_week)));

    if (timetableDays.length > 0) {
      setTeachingDays(timetableDays.sort((a, b) => a - b));
    } else {
      setTeachingDays([0, 1, 2, 3, 4]);
    }
  }, [selectedClass, allTimetableEntries]);

  // ─── Query: ดึงข้อมูลการเช็คชื่อวันนี้ + นักเรียน + สถิติ ───
  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-data', selectedClass, date],
    queryFn: async () => {
      const [stuRes, attRes, statsRes] = await Promise.all([
        api.get(`/students?classroom_id=${selectedClass}&include_avatar=true`),
        api.get(`/attendance?classroom_id=${selectedClass}&date=${date}`),
        api.get(`/attendance?classroom_id=${selectedClass}`)
      ]);

      const classStudents = stuRes.data.data || [];
      const existing = attRes.data.data || [];

      const newAtt: Record<string, string> = {};
      classStudents.forEach((s: Student) => {
        const found = existing.find((e: { student_id: string | number }) => String(e.student_id) === String(s.id));
        newAtt[s.id] = found ? found.status : '';
      });

      return {
        students: classStudents,
        attendance: newAtt,
        stats: statsRes.data.data || []
      };
    },
    enabled: !!selectedClass,
    staleTime: 60 * 1000,
  });

  // Ref to track which classroom+date combination has been initialized
  const initializedClassAndDate = useRef<string>('');

  // Sync daily query data to local editing states
  useEffect(() => {
    if (attendanceData) {
      setStudents(attendanceData.students);
      setStats(attendanceData.stats);

      const currentKey = `${selectedClass}_${date}`;
      if (initializedClassAndDate.current !== currentKey) {
        initializedClassAndDate.current = currentKey;
        setAttendance(attendanceData.attendance);
      } else {
        // Prevent background refetches from overwriting active user clicks
        setAttendance((prev) => ({
          ...attendanceData.attendance,
          ...prev,
        }));
      }
    }
  }, [attendanceData, selectedClass, date]);

  // Reset local state if no class is selected, and reset section filter when switching classrooms
  useEffect(() => {
    setSelectedSectionKey('all');
    setCollapsedSections({});
    if (!selectedClass) {
      setStudents([]);
      setAttendance({});
      setStats([]);
    }
  }, [selectedClass]);

  // ─── Sub-room / Section Grouping (แยกห้องย่อยเมื่อเรียนรวม เช่น ปวช.1/1 + ปวช.1/2) ───
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

  // Filters students by search query within active section scope (Memoized)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionScopedStudents;
    return sectionScopedStudents.filter(student =>
      student.name.toLowerCase().includes(q) ||
      (student.student_code && student.student_code.toLowerCase().includes(q)) ||
      (student.grade_level && student.grade_level.toLowerCase().includes(q)) ||
      (student.branch && student.branch.toLowerCase().includes(q))
    );
  }, [sectionScopedStudents, searchQuery]);

  // Grouped sections filtered by searchQuery (for combined 'all' mode when hasMultipleSections)
  const visibleSectionGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionGroups;
    return sectionGroups
      .map(grp => ({
        ...grp,
        students: grp.students.filter(student =>
          student.name.toLowerCase().includes(q) ||
          (student.student_code && student.student_code.toLowerCase().includes(q)) ||
          (student.grade_level && student.grade_level.toLowerCase().includes(q)) ||
          (student.branch && student.branch.toLowerCase().includes(q))
        ),
      }))
      .filter(grp => grp.students.length > 0);
  }, [sectionGroups, searchQuery]);

  // Live daily statistics per section (for section switcher badges & group headers)
  const sectionDailyStatsMap = useMemo(() => {
    const map: Record<string, { present: number; late: number; absent: number; leave: number; marked: number; total: number }> = {};
    sectionGroups.forEach(grp => {
      const st = { present: 0, late: 0, absent: 0, leave: 0, marked: 0, total: grp.students.length };
      grp.students.forEach(s => {
        const val = attendance[s.id];
        if (val) {
          st.marked++;
          if (val === 'present') st.present++;
          else if (val === 'late') st.late++;
          else if (val === 'absent') st.absent++;
          else if (val === 'leave') st.leave++;
        }
      });
      map[grp.key] = st;
    });
    return map;
  }, [sectionGroups, attendance]);

  const overallDailyMarked = useMemo(
    () => students.reduce((acc, s) => (attendance[s.id] ? acc + 1 : acc), 0),
    [students, attendance]
  );

  // Daily statistics calculated in real-time for active scope (Memoized)
  const dailyStats = useMemo(() => {
    const scStats = {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      total: sectionScopedStudents.length,
      marked: 0
    };

    sectionScopedStudents.forEach(s => {
      const sStatus = attendance[s.id];
      if (sStatus) {
        scStats.marked++;
        if (sStatus === 'present') scStats.present++;
        else if (sStatus === 'late') scStats.late++;
        else if (sStatus === 'absent') scStats.absent++;
        else if (sStatus === 'leave') scStats.leave++;
      }
    });
    return scStats;
  }, [sectionScopedStudents, attendance]);



  // ─── Query: ดึงข้อมูล Matrix ย้อนหลัง ───
  const { data: matrixRecords = [], isLoading: loadingMatrix } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate],
    queryFn: async () => {
      const res = await api.get(`/attendance?classroom_id=${selectedClass}&start_date=${matrixStartDate}&end_date=${matrixEndDate}`);
      return res.data.data || [];
    },
    enabled: !!selectedClass && activeTab === 'matrix'
  });

  // ─── Query: ดึงข้อมูลประวัติการเช็คชื่อรายบุคคล ───
  const { data: historyData = [], isLoading: loadingHistory } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history', selectedClass, historyStudent?.id],
    queryFn: async () => {
      const res = await api.get(`/attendance?student_id=${historyStudent?.id}&classroom_id=${selectedClass}`);
      return res.data.data || [];
    },
    enabled: !!selectedClass && !!historyStudent?.id
  });

  // Close cell editing popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cellPopoverRef.current && !cellPopoverRef.current.contains(event.target as Node)) {
        setMatrixEditingCell(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cache roster and attendance state for offline use
  useEffect(() => {
    if (selectedClass && students && students.length > 0) {
      cacheClassroomRoster(selectedClass, students);
    }
  }, [selectedClass, students]);

  useEffect(() => {
    if (selectedClass && date && Object.keys(attendance).length > 0) {
      cacheAttendanceState(selectedClass, date, attendance);
    }
  }, [selectedClass, date, attendance]);

  // ─── Debounced Batch Auto-Save (eliminates race conditions & flickering on consecutive clicks) ───
  const pendingAutoSaveRef = useRef<Map<string, string>>(new Map());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushPendingAutoSave = useCallback(async () => {
    if (pendingAutoSaveRef.current.size === 0 || !selectedClass || !date) return;

    const changes = new Map(pendingAutoSaveRef.current);
    pendingAutoSaveRef.current.clear();

    const recordsToSave: Array<{ student_id: number; classroom_id: number; date: string; status: string }> = [];
    const idsToDelete: string[] = [];

    for (const [studentId, status] of changes.entries()) {
      if (status === '') {
        idsToDelete.push(studentId);
      } else {
        recordsToSave.push({
          student_id: Number(studentId),
          classroom_id: Number(selectedClass),
          date,
          status,
        });
      }
    }

    setAutoSaveStatus('saving');

    try {
      const promises: Promise<unknown>[] = [];

      if (recordsToSave.length > 0) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          enqueueBatchOfflineAttendance(
            recordsToSave.map((r) => ({
              studentId: r.student_id,
              classroomId: r.classroom_id,
              date: r.date,
              status: r.status,
            }))
          );
        } else {
          promises.push(
            api.post('/attendance', { records: recordsToSave }).catch(() => {
              enqueueBatchOfflineAttendance(
                recordsToSave.map((r) => ({
                  studentId: r.student_id,
                  classroomId: r.classroom_id,
                  date: r.date,
                  status: r.status,
                }))
              );
            })
          );
        }
      }

      if (idsToDelete.length > 0) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Handled offline
        } else {
          for (const sId of idsToDelete) {
            promises.push(
              api.delete(`/attendance?student_id=${sId}&classroom_id=${selectedClass}&date=${date}`).catch((err) => {
                console.warn('Failed to delete attendance record:', err);
              })
            );
          }
        }
      }

      await Promise.all(promises);

      // Optimistically update TanStack Query cache in memory (ZERO network refetch & zero flickering)
      queryClient.setQueryData(['attendance-data', selectedClass, date], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const currentData = old as { attendance?: Record<string, string>; [key: string]: unknown };
        const updatedAttendance = { ...(currentData.attendance || {}) };
        for (const [studentId, status] of changes.entries()) {
          if (status === '') {
            delete updatedAttendance[studentId];
          } else {
            updatedAttendance[studentId] = status;
          }
        }
        return {
          ...currentData,
          attendance: updatedAttendance,
        };
      });

      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('AutoSave batch error:', err);
      setAutoSaveStatus('error');
    }
  }, [selectedClass, date, queryClient]);

  // Flush on unmount or class/date change
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      flushPendingAutoSave();
    };
  }, [flushPendingAutoSave]);

  const handleStatusChange = useCallback(
    (studentId: string, status: string) => {
      setAttendance((prev) => {
        const current = prev[studentId];
        // Toggle off if clicking the active status
        const newStatus = current === status ? '' : status;

        if (autoSave) {
          pendingAutoSaveRef.current.set(studentId, newStatus);
          setAutoSaveStatus('saving');

          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          // Debounce 400ms: collects consecutive rapid clicks into a single batch
          autoSaveTimerRef.current = setTimeout(() => {
            flushPendingAutoSave();
          }, 400);
        }

        return { ...prev, [studentId]: newStatus };
      });
    },
    [autoSave, flushPendingAutoSave]
  );

  // ─── Mutation: บันทึกข้อมูลการเข้าเรียนด้วยตนเอง (Manual Save with Offline Fallback) ───
  const saveMutation = useMutation({
    mutationFn: async (records: Array<{ student_id: number; classroom_id: number; date: string; status: string }>) => {
      return api.post('/attendance', { records });
    },
    onSuccess: () => {
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
    onError: (_err, variables) => {
      // If network failed, save to offline queue as fallback
      enqueueBatchOfflineAttendance(variables.map(r => ({
        studentId: r.student_id,
        classroomId: r.classroom_id,
        date: r.date,
        status: r.status,
      })));
      toast.success('บันทึกข้อมูลการเช็คชื่อลงเครื่องแล้ว (จะซิงค์ขึ้นระบบเมื่อมีอินเทอร์เน็ต)', { icon: '💾' });
    }
  });

  const handleSave = () => {
    if (!selectedClass || sectionScopedStudents.length === 0) return;

    const uncheckedInScope = sectionScopedStudents.filter(s => !attendance[s.id]);
    if (activeSectionGroup) {
      if (uncheckedInScope.length > 0) {
        toast.error(`กรุณาเช็คชื่อนักเรียนห้อง ${activeSectionGroup.label} ให้ครบทุกคนก่อนบันทึก (เหลืออีก ${uncheckedInScope.length} คน)`);
        return;
      }
    } else if (uncheckedInScope.length > 0) {
      const checkedCount = sectionScopedStudents.length - uncheckedInScope.length;
      if (!hasMultipleSections || checkedCount === 0) {
        toast.error(`กรุณาเช็คชื่อนักเรียนให้ครบทุกคนก่อนบันทึก (เหลืออีก ${uncheckedInScope.length} คน)`);
        return;
      }
      if (!confirm(`ยังมีนักเรียนที่ไม่ได้เช็คชื่ออีก ${uncheckedInScope.length} คน (เช็คแล้ว ${checkedCount}/${sectionScopedStudents.length} คน)\n\nต้องการบันทึกเฉพาะรายชื่อที่เช็คแล้วหรือไม่?`)) {
        return;
      }
    }

    const records = students
      .filter(s => Boolean(attendance[s.id]))
      .map(s => ({
        student_id: Number(s.id),
        classroom_id: Number(selectedClass),
        date: date,
        status: attendance[s.id]
      }));

    if (records.length === 0) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueBatchOfflineAttendance(records.map(r => ({
        studentId: r.student_id,
        classroomId: r.classroom_id,
        date: r.date,
        status: r.status,
      })));
      toast.success('บันทึกข้อมูลการเช็คชื่อลงเครื่องเรียบร้อย (โหมดออฟไลน์) จะซิงค์เมื่อมีเน็ต', { icon: '💾' });
      return;
    }

    saveMutation.mutate(records);
  };

  // ─── Mutation: อัปเดตข้อมูลเข้าเรียน Matrix (พร้อมโหมดออฟไลน์) ───
  const matrixCellUpdateMutation = useMutation({
    mutationFn: async ({ studentId, dateStr, status }: { studentId: string; dateStr: string; status: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: dateStr,
          status: status,
        });
        return { offline: true };
      }
      return api.post('/attendance', {
        records: [{
          student_id: Number(studentId),
          classroom_id: Number(selectedClass),
          date: dateStr,
          status: status
        }]
      }).catch(() => {
        enqueueOfflineAttendance({
          studentId: Number(studentId),
          classroomId: Number(selectedClass),
          date: dateStr,
          status: status,
        });
        return { offline: true };
      });
    },
    onSuccess: (res: { offline?: boolean } | unknown) => {
      if ((res as { offline?: boolean })?.offline) {
        toast.success('บันทึกข้อมูลในเครื่องแล้ว (โหมดออฟไลน์)', { icon: '💾' });
      } else {
        toast.success('อัปเดตข้อมูลการเข้าเรียนเรียบร้อย');
        queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate] });
        queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
        queryClient.invalidateQueries({ queryKey: ['grades'] });
      }
    },
    onError: () => {
      toast.error('อัปเดตไม่สำเร็จ');
    }
  });

  const handleMatrixCellUpdate = (studentId: string, dateStr: string, status: string) => {
    setMatrixEditingCell(null);
    matrixCellUpdateMutation.mutate({ studentId, dateStr, status });
  };

  // ─── Mutation: ลบข้อมูลเข้าเรียน Matrix ───
  const matrixCellDeleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      return api.delete(`/attendance?id=${recordId}`);
    },
    onSuccess: () => {
      toast.success('ลบข้อมูลการเข้าเรียนเรียบร้อย');
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass, matrixStartDate, matrixEndDate] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      toast.error('ลบข้อมูลไม่สำเร็จ');
    }
  });

  const handleMatrixCellDelete = (studentId: string, dateStr: string) => {
    setMatrixEditingCell(null);
    const record = matrixRecords.find(r =>
      (String(r.student_id) === String(studentId)) &&
      (r.date ? r.date.split('T')[0] === dateStr : false)
    );
    if (!record) return;
    matrixCellDeleteMutation.mutate(record.id);
  };

  const statsMap = useMemo(() => {
    const map = new Map<string, (typeof stats)[number]>();
    (stats || []).forEach(s => map.set(String(s.student_id), s));
    return map;
  }, [stats]);

  const getStudentStats = useCallback((studentId: string) => {
    return statsMap.get(String(studentId)) || {
      student_id: studentId,
      present_count: 0, late_count: 0, absent_count: 0,
      leave_count: 0, converted_absent_count: 0, remaining_late_count: 0, remaining_leave_count: 0
    };
  }, [statsMap]);

  const statusBtn = (id: string, status: string, icon: React.ReactNode, label: string, activeClass: string) => {
    const isActive = attendance[id] === status;
    return (
      <button
        type="button"
        onClick={() => handleStatusChange(id, status)}
        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer select-none ${isActive
          ? `${activeClass} [&>svg]:text-white shadow-xs scale-[1.02]`
          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        {icon} <span>{label}</span>
      </button>
    );
  };

  // ─── Mutation: ลบประวัติการเช็คชื่อรายคน ───
  const deleteHistoryMutation = useMutation({
    mutationFn: async (recordId: string) => {
      return api.delete(`/attendance?id=${recordId}`);
    },
    onSuccess: () => {
      toast.success('ลบประวัติเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['attendance-history', selectedClass, historyStudent?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
    },
    onError: () => {
      toast.error('ลบประวัติไม่สำเร็จ');
    }
  });

  const handleDeleteHistory = (recordId: string) => {
    if (!confirm('ต้องการลบประวัติการเช็คชื่อนี้หรือไม่?')) return;
    deleteHistoryMutation.mutate(recordId);
  };

  // ─── Mutation: ล้างข้อมูลการเข้าเรียน (ทั้งห้อง หรือ เฉพาะห้องย่อยที่เลือก) ───
  const clearDataMutation = useMutation({
    mutationFn: async (params?: { studentIds?: string[]; sectionLabel?: string }) => {
      const idsQuery = params?.studentIds && params.studentIds.length > 0
        ? `&student_ids=${params.studentIds.join(',')}`
        : '';
      return api.delete(`/attendance?classroom_id=${selectedClass}&date=${date}${idsQuery}`);
    },
    onSuccess: (_res, params) => {
      if (params?.studentIds && params.studentIds.length > 0) {
        const idSet = new Set(params.studentIds.map(String));
        setAttendance(prev => {
          const next = { ...prev };
          idSet.forEach(id => {
            delete next[id];
          });
          return next;
        });
        toast.success(`ลบข้อมูลการเช็คชื่อห้อง ${params.sectionLabel || ''} ของวันที่เลือกเรียบร้อยแล้ว`);
      } else {
        setAttendance({});
        toast.success('ลบข้อมูลการเช็คชื่อของวันที่เลือกเรียบร้อยแล้ว');
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass] });
    },
    onError: () => {
      toast.error('ลบข้อมูลไม่สำเร็จ');
    }
  });

  const handleClearData = () => {
    if (!selectedClass || sectionScopedStudents.length === 0) return;

    const dateObj = new Date(date);
    const formattedDateForConfirm = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    if (activeSectionGroup) {
      if (!confirm(`⚠️ ยืนยันการลบข้อมูลเช็คชื่อเฉพาะห้องย่อย?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของห้อง "${activeSectionGroup.label}" (${activeSectionGroup.students.length} คน)\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(ข้อมูลของห้องย่อยอื่นในรายวิชานี้จะไม่ถูกลบ)`)) {
        return;
      }
      clearDataMutation.mutate({
        studentIds: activeSectionGroup.students.map(s => String(s.id)),
        sectionLabel: activeSectionGroup.label,
      });
      return;
    }

    if (!confirm(`⚠️ ยืนยันการลบข้อมูลเช็คชื่อ?\n\nคุณต้องการลบข้อมูลการเช็คชื่อของทุกคนในห้องนี้\nสำหรับวันที่ "${formattedDateForConfirm}" ใช่หรือไม่?\n\n(เหมาะสำหรับกรณีลงชื่อผิดวัน หรือต้องการเริ่มลงใหม่ของวันนี้)`)) {
      return;
    }
    clearDataMutation.mutate(undefined);
  };



  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'present': return <span className="text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs font-semibold">มาเรียน</span>;
      case 'late': return <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-semibold">สาย</span>;
      case 'absent': return <span className="text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ขาด</span>;
      case 'leave': return <span className="text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-xs font-semibold">ลา</span>;
      default: return <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-xs font-semibold">{status}</span>;
    }
  };

  // ─── Mutation: เลือกสถานะทั้งหมด ───
  const markAllMutation = useMutation({
    mutationFn: async ({ records }: { status?: string; records: Array<{ student_id: number; classroom_id: number; date: string; status: string }> }) => {
      return api.post('/attendance', { records });
    },
    onMutate: () => {
      setAutoSaveStatus('saving');
    },
    onSuccess: () => {
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass, date] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
    onError: () => {
      setAutoSaveStatus('error');
      toast.error('บันทึกอัตโนมัติไม่สำเร็จ');
    }
  });

  const handleMarkStudents = useCallback((targetStudents: Student[], status: string, scopeLabel?: string) => {
    if (targetStudents.length === 0) return;
    setAttendance(prev => {
      const next = { ...prev };
      targetStudents.forEach(student => {
        next[student.id] = status;
      });
      return next;
    });
    const statusText = status === 'present' ? 'มาเรียน' : status === 'absent' ? 'ขาด' : status === 'late' ? 'สาย' : 'ลา';
    toast.success(`เลือก "${statusText}" ให้กับ${scopeLabel ? `ห้อง ${scopeLabel}` : 'รายชื่อที่แสดงอยู่'} (${targetStudents.length} คน)`);

    if (autoSave) {
      const records = targetStudents.map(student => ({
        student_id: Number(student.id),
        classroom_id: Number(selectedClass),
        date: date,
        status: status
      }));
      markAllMutation.mutate({ status, records });
    }
  }, [autoSave, selectedClass, date, markAllMutation]);

  const handleMarkAll = (status: string) => {
    handleMarkStudents(filteredStudents, status, activeSectionGroup?.label);
  };

  const handleResetDraft = () => {
    if (attendanceData) {
      setAttendance(attendanceData.attendance);
    }
    toast.success('คืนค่าการกรอกข้อมูลแล้ว');
  };

  // Adjust Date (Daily tab)
  const adjustDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const setToday = () => setDate(new Date().toISOString().split('T')[0]);
  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  // Calculate unique dates in range for Matrix View
  // ─── Holiday Calculation ───
  const holidayMap = useMemo(() => {
    if (!matrixStartDate || !matrixEndDate) return {};
    const list = getThaiHolidays(matrixStartDate, matrixEndDate);
    const map: Record<string, HolidayInfo> = {};
    list.forEach(h => {
      map[h.date] = h;
    });
    return map;
  }, [matrixStartDate, matrixEndDate]);

  const teachingDayGovHolidays = useMemo(() => {
    return Object.values(holidayMap).filter(h => {
      if (h.type !== 'government') return false;
      const dayOfWeek = getSchemaDayOfWeek(h.date);
      return teachingDays.includes(dayOfWeek);
    });
  }, [holidayMap, teachingDays]);

  const matrixDates = useMemo(() => {
    const dates = new Set<string>();

    // Add dates that have records
    matrixRecords.forEach(r => {
      if (r.date) {
        const dStr = r.date.split('T')[0];
        if (dStr) dates.add(dStr);
      }
    });

    // Include government holidays ONLY if they fall on teaching days of this classroom
    if (matrixStartDate && matrixEndDate) {
      const holidays = getThaiHolidays(matrixStartDate, matrixEndDate);
      holidays.forEach(h => {
        if (h.type === 'government') {
          const dayOfWeek = getSchemaDayOfWeek(h.date);
          if (teachingDays.includes(dayOfWeek)) {
            dates.add(h.date);
          }
        }
      });
    }

    // Sort dates ascending
    return Array.from(dates).sort();
  }, [matrixRecords, matrixStartDate, matrixEndDate, teachingDays]);

  // O(1) lookup map for matrix cells instead of O(N) .find() inside nested student x date loops
  const matrixRecordMap = useMemo(() => {
    const map = new Map<string, string>();
    matrixRecords.forEach(r => {
      if (r.date && r.student_id !== undefined) {
        const dStr = r.date.split('T')[0];
        if (dStr) {
          map.set(`${r.student_id}_${dStr}`, r.status);
        }
      }
    });
    return map;
  }, [matrixRecords]);
  const selectedClassData = classrooms.find(c => String(c.id) === String(selectedClass));
  const maxAllowedAbsences = selectedClassData ? Math.floor((Number(selectedClassData.total_classes) || 40) * (100 - (Number(selectedClassData.min_attendance_percent) || 80)) / 100) : 0;

  const activeParsed = useMemo(() => {
    return selectedClassData ? parseClassroomName(selectedClassData.name) : null;
  }, [selectedClassData]);

  const todayClassroomIds = useMemo(() => {
    return new Set(
      todayEntries
        .filter(e => e.classroom_id)
        .map(e => String(e.classroom_id))
    );
  }, [todayEntries]);

  const todayCount = useMemo(() => {
    return classrooms.filter(c => todayClassroomIds.has(String(c.id))).length;
  }, [classrooms, todayClassroomIds]);

  const pvchCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch').length;
  }, [classrooms]);

  const pvsCount = useMemo(() => {
    return classrooms.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs').length;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    let list = classrooms;
    if (classFilter === 'today') {
      list = list.filter(c => todayClassroomIds.has(String(c.id)));
    } else if (classFilter === 'pvch') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvch');
    } else if (classFilter === 'pvs') {
      list = list.filter(c => (c.curriculum_type || (c.name?.includes('ปวส') ? 'pvs' : 'pvch')) === 'pvs');
    }
    if (classSearch.trim()) {
      const q = classSearch.toLowerCase().trim();
      list = list.filter(c => c.name?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aToday = todayClassroomIds.has(String(a.id)) ? 1 : 0;
      const bToday = todayClassroomIds.has(String(b.id)) ? 1 : 0;
      return bToday - aToday;
    });
  }, [classrooms, classFilter, classSearch, todayClassroomIds]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isPastDate = date < todayStr;
  const isToday = date === todayStr;

  const selectedDateWeekNumber = useMemo(() => {
    if (!semesterInfo?.semesterStartDate) return null;
    const start = new Date(semesterInfo.semesterStartDate);
    const current = new Date(date);
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    const weekNum = Math.floor(diffDays / 7) + 1;
    return (weekNum >= 1 && weekNum <= (semesterInfo.totalWeeks || 18)) ? weekNum : null;
  }, [semesterInfo, date]);

  const formattedSelectedDate = new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const loading = loadingClassrooms || (!!selectedClass && loadingAttendance);
  const saving = saveMutation.isPending || clearDataMutation.isPending || markAllMutation.isPending;
  const matrixLoading = loadingMatrix;
  const historyLoading = loadingHistory;

  const renderMatrixStudentRow = (student: Student, idx: number, showRoomSubtitle = false) => (
    <tr
      key={student.id}
      className={`border-b border-indigo-50/50 dark:border-slate-800/80 hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 transition-colors ${
        idx % 2 === 0 ? 'bg-slate-50/40 dark:bg-slate-800/25' : 'bg-transparent'
      }`}
    >
      <td className="p-4 font-semibold text-slate-800 dark:text-slate-100 text-sm sticky left-0 bg-white dark:bg-slate-900 z-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] border-r border-indigo-100 dark:border-slate-800 flex items-center gap-2 h-14 overflow-hidden text-ellipsis whitespace-nowrap">
        <UserAvatar avatar={student.avatar} name={student.name} userId={student.id} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs truncate leading-snug">{student.name}</p>
          {(student.student_code || (showRoomSubtitle && student.grade_level)) && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5 truncate">
              {student.student_code || '-'}
              {showRoomSubtitle && student.grade_level ? ` · ${student.grade_level}` : ''}
            </p>
          )}
        </div>
      </td>

      {matrixDates.map(dateStr => {
        const status = matrixRecordMap.get(`${student.id}_${dateStr}`) ?? null;
        const isEditing = matrixEditingCell?.studentId === student.id && matrixEditingCell?.date === dateStr;
        const holiday = holidayMap[dateStr] || checkThaiHoliday(dateStr);

        return (
          <MemoizedAttendanceCell
            key={dateStr}
            status={status}
            isEditing={isEditing}
            onEditClick={() => setMatrixEditingCell({ studentId: student.id, date: dateStr })}
            onStatusSelect={(statusVal: string) => handleMatrixCellUpdate(student.id, dateStr, statusVal)}
            onDeleteClick={status ? () => handleMatrixCellDelete(student.id, dateStr) : undefined}
            popoverRef={isEditing ? cellPopoverRef : undefined}
            holiday={holiday}
          />
        );
      })}
    </tr>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <p className="text-slate-500 font-medium animate-pulse">กำลังดาวน์โหลดข้อมูลห้องเรียน...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Offline Status & Sync Banner */}
      <OfflineBanner
        onSyncComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['attendance-data', selectedClass] });
          queryClient.invalidateQueries({ queryKey: ['attendance-matrix', selectedClass] });
        }}
      />

      {/* Active Classroom Bar (เมื่อเลือกห้องแล้ว) */}
      {selectedClass && selectedClassData && activeParsed && (
        <AttendanceHeader
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          classrooms={classrooms}
          selectedClassData={selectedClassData}
          activeParsed={activeParsed}
          studentsCount={students.length}
          maxAllowedAbsences={maxAllowedAbsences}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenExportModal={() => {
            setExportStartDate('');
            setExportEndDate('');
            setShowExportModal(true);
          }}
          onOpenImportModal={() => setShowImportModal(true)}
          hasMultipleSections={hasMultipleSections}
          sharedBranch={sharedBranch}
          sectionGroups={sectionGroups}
          selectedSectionKey={selectedSectionKey}
          setSelectedSectionKey={setSelectedSectionKey}
          sectionDailyStatsMap={sectionDailyStatsMap}
          overallDailyMarked={overallDailyMarked}
        />
      )}

      {/* Classroom Card Grid Selector (เมื่อยังไม่ได้เลือกห้องเรียน) */}
      {!selectedClass ? (
        <AttendanceClassroomSelector
          classrooms={classrooms}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
          classSearch={classSearch}
          setClassSearch={setClassSearch}
          todayCount={todayCount}
          pvchCount={pvchCount}
          pvsCount={pvsCount}
          filteredClassrooms={filteredClassrooms}
          todayEntries={todayEntries}
          onSelectClassroom={(classId: string) => {
            setSelectedClass(classId);
            setActiveTab('daily');
          }}
        />
      ) : loadingAttendance && students.length === 0 ? (
        /* Skeleton Loading State — eliminates blank flash & optimizes LCP */
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="กำลังโหลดข้อมูลการเช็คชื่อ">
          {/* Date Control Panel Skeleton */}
          <div className="glass dark:bg-slate-900/85 p-4 sm:p-5 rounded-3xl border border-indigo-100/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 shadow-xl shadow-indigo-100/20 dark:shadow-black/40">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
              <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700 w-64 h-12">
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-4 flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg mx-2"></div>
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
              </div>
            </div>
          </div>

          {/* 5 Dynamic Counters Cards Skeleton (Matches LCP elements) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { label: 'มาเรียน', color: 'bg-emerald-100 dark:bg-emerald-950/40' },
              { label: 'สาย', color: 'bg-amber-100 dark:bg-amber-950/40' },
              { label: 'ขาด', color: 'bg-rose-100 dark:bg-rose-950/40' },
              { label: 'ลา', color: 'bg-blue-100 dark:bg-blue-950/40' },
              { label: 'บันทึกผลแล้ว', color: 'bg-purple-100 dark:bg-purple-950/40' },
            ].map((card, i) => (
              <div
                key={i}
                className="glass dark:bg-slate-900/90 p-4 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs"
              >
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{card.label}</p>
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                  <span className="text-[11px] text-slate-300 dark:text-slate-600 font-semibold">คน</span>
                </div>
                <div className={`w-11 h-11 rounded-2xl ${card.color} shrink-0`}></div>
              </div>
            ))}
          </div>

          {/* Student List Skeleton */}
          <div className="glass dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 bg-white dark:bg-slate-900 shadow-xl shadow-indigo-100/20 dark:shadow-black/40">
            <div className="h-11 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4"></div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center">
                  {[1, 2, 3, 4].map((b) => (
                    <div key={b} className="w-12 h-9 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="glass p-20 text-center rounded-2xl border border-white/30">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4 stroke-1" />
          <h3 className="text-xl font-bold text-slate-700 mb-1">ไม่พบนักเรียน</h3>
          <p className="text-slate-600 text-sm max-w-sm mx-auto mb-4">ไม่มีรายชื่อนักเรียนอยู่ในห้องเรียนนี้ในระบบขณะนี้</p>
          <a href="#students" className="btn btn-primary px-6 py-2.5 inline-flex items-center gap-2">
            <Users className="w-4 h-4" /> เพิ่มนักเรียนเข้าห้องเรียน
          </a>
        </div>
      ) : (
        <>
          {activeTab === 'daily' ? (
            /* ================= DAILY ROLL CALL TAB ================= */
            <div className="space-y-6">

              {/* Date Control Panel & Retroactive Banner */}
              <AttendanceDailyToolbar
                date={date}
                setDate={setDate}
                formattedSelectedDate={formattedSelectedDate}
                isToday={isToday}
                isPastDate={isPastDate}
                selectedDateWeekNumber={selectedDateWeekNumber}
                dailyStats={dailyStats}
                activeSectionGroup={activeSectionGroup}
                saving={saving}
                adjustDate={adjustDate}
                setToday={setToday}
                setYesterday={setYesterday}
                onOpenRetroactiveModal={() => setShowRetroactiveModal(true)}
                onClearData={handleClearData}
              />

              {/* Dynamic Counters Card */}
              <AttendanceStatsBar dailyStats={dailyStats} />

              {/* Student List View */}
              <div className="glass dark:bg-slate-900/85 overflow-hidden rounded-3xl border border-indigo-100/80 dark:border-slate-800 shadow-xl shadow-indigo-100/20 dark:shadow-black/40 pb-16 md:pb-0 bg-white/95 dark:bg-slate-900">
                {/* Search and Bulk Operations Bar */}
                <div className="p-4 sm:p-5 border-b border-indigo-50/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัสประจำตัว..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-10 pr-8 py-2 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 rounded-xl focus:border-indigo-500 shadow-2xs w-full"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mr-1">
                      กำหนดเร็ว{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkAll('present')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/70 dark:border-emerald-800 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>มาทุกคน{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkAll('absent')}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-200/70 dark:border-rose-900/60 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>ขาดทุกคน{activeSectionGroup ? ` (${activeSectionGroup.label})` : ''}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>คืนค่า</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Card List View (Thumb-Friendly & Super Fast) */}
                <div className="block md:hidden p-3 space-y-3">
                  {filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 font-semibold">
                      ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้นหา
                    </div>
                  ) : hasMultipleSections && selectedSectionKey === 'all' ? (
                    visibleSectionGroups.map(grp => {
                      const isCollapsed = Boolean(collapsedSections[grp.key]);
                      const secStats = sectionDailyStatsMap[grp.key];
                      return (
                        <div key={grp.key} className="space-y-2.5">
                          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-50/95 via-violet-50/70 to-white dark:from-slate-800/95 dark:via-slate-800/70 dark:to-slate-800 border border-indigo-100/90 dark:border-slate-700 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => toggleSectionCollapse(grp.key)}
                                className="flex items-center gap-2 min-w-0 text-left"
                                title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                              >
                                <ChevronDown className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                <span className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200 truncate">{grp.fullLabel}</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-600 shrink-0">
                                  {grp.students.length} คน
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedSectionKey(grp.key)}
                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-700/90 border border-indigo-200/70 dark:border-slate-600 shrink-0"
                              >
                                แยกห้องนี้ →
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                              {secStats && (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                                  <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/70 dark:border-emerald-800/70">มา {secStats.present}</span>
                                  <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/70 dark:border-amber-800/70">สาย {secStats.late}</span>
                                  <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200/70 dark:border-rose-800/70">ขาด {secStats.absent}</span>
                                  <span className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/70 dark:border-blue-800/70">ลา {secStats.leave}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'present', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-2xs"
                                >
                                  ✓ มาทั้งห้อง
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'absent', grp.label)}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold"
                                >
                                  ขาดทั้งห้อง
                                </button>
                              </div>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="space-y-2.5 pl-1">
                              {grp.students.map(student => (
                                <MobileStudentAttendanceCard
                                  key={student.id}
                                  student={student}
                                  status={attendance[student.id]}
                                  stats={getStudentStats(student.id)}
                                  maxAllowedAbsences={maxAllowedAbsences}
                                  sectionBadge={grp.label}
                                  onStatusSelect={handleStatusChange}
                                  onViewHistory={setHistoryStudent}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-2.5">
                      {filteredStudents.map((student) => (
                        <MobileStudentAttendanceCard
                          key={student.id}
                          student={student}
                          status={attendance[student.id]}
                          stats={getStudentStats(student.id)}
                          maxAllowedAbsences={maxAllowedAbsences}
                          sectionBadge={hasMultipleSections ? (student.grade_level || null) : null}
                          onStatusSelect={handleStatusChange}
                          onViewHistory={setHistoryStudent}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Modern Horizontal Card Rows */}
                <div className="hidden md:block p-4 sm:p-5">
                  <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-2.5">
                    {/* Column Guideline Header */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                      <div className="w-80 lg:w-96 flex items-center gap-3">
                        <span className="w-6 text-right">#</span>
                        <span>ข้อมูลนักเรียน & ความเสี่ยง</span>
                      </div>
                      <div className="text-center font-bold">
                        สถานะการมาเรียน
                      </div>
                      <div className="w-56 lg:w-64 text-right">
                        โควตาขาด & สถิติสะสม
                      </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้นหา
                      </div>
                    ) : hasMultipleSections && selectedSectionKey === 'all' ? (
                      visibleSectionGroups.map(grp => {
                        const isCollapsed = Boolean(collapsedSections[grp.key]);
                        const secStats = sectionDailyStatsMap[grp.key];
                        const isAllMarked = secStats && secStats.total > 0 && secStats.marked === secStats.total;
                        return (
                          <div key={grp.key} className="space-y-2.5">
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-violet-50/50 to-indigo-50/30 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/40 border border-indigo-100 dark:border-slate-750 flex items-center justify-between gap-3 shadow-2xs">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleSectionCollapse(grp.key)}
                                  className="flex items-center gap-2 text-left group cursor-pointer"
                                  title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                                >
                                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-750 border border-indigo-200/80 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                  </div>
                                  <span className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200">{grp.fullLabel}</span>
                                </button>

                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-slate-750 shadow-2xs">
                                  {grp.students.length} คน
                                </span>

                                {secStats && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold ml-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">มา {secStats.present}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800">สาย {secStats.late}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800">ขาด {secStats.absent}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">ลา {secStats.leave}</span>
                                    <span className={`px-2 py-0.5 rounded-md border ${isAllMarked
                                      ? 'bg-emerald-500 text-white border-emerald-600'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                      }`}>
                                      เช็คแล้ว {secStats.marked}/{secStats.total}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'present', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition-colors cursor-pointer"
                                  title={`เช็คชื่อมาเรียนทั้งห้อง ${grp.fullLabel}`}
                                >
                                  ✓ มาทั้งห้อง {grp.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkStudents(grp.students, 'absent', grp.label)}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                  title={`เช็คชื่อขาดทั้งห้อง ${grp.fullLabel}`}
                                >
                                  ขาดทั้งห้อง
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSectionKey(grp.key)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                  title={`สลับไปแสดงเฉพาะห้อง ${grp.label}`}
                                >
                                  แยกห้องนี้ →
                                </button>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div className="space-y-2.5">
                                {grp.students.map((student, idx) => (
                                  <MemoizedDesktopStudentRow
                                    key={student.id}
                                    student={student}
                                    idx={idx}
                                    showRoomPill={Boolean(searchQuery.trim())}
                                    status={attendance[student.id]}
                                    stats={getStudentStats(student.id)}
                                    maxAllowedAbsences={maxAllowedAbsences}
                                    onStatusSelect={handleStatusChange}
                                    onViewHistory={setHistoryStudent}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      filteredStudents.map((student, idx) => (
                        <MemoizedDesktopStudentRow
                          key={student.id}
                          student={student}
                          idx={idx}
                          showRoomPill={false}
                          status={attendance[student.id]}
                          stats={getStudentStats(student.id)}
                          maxAllowedAbsences={maxAllowedAbsences}
                          onStatusSelect={handleStatusChange}
                          onViewHistory={setHistoryStudent}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Sticky Save Bar */}
                <div className="p-4 sm:p-5 border-t border-indigo-100/70 dark:border-slate-800 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/40 dark:from-slate-900/95 dark:via-slate-900 dark:to-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Auto Save Toggle */}
                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={autoSave}
                        onChange={(e) => {
                          setAutoSave(e.target.checked);
                          if (e.target.checked) {
                            setAutoSaveStatus('idle');
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600 shrink-0"></div>
                      <span className="ml-2.5 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-200">บันทึกอัตโนมัติ</span>
                    </label>

                    {autoSave && renderAutoSaveStatus()}
                  </div>

                  {/* Right: Manual save/reset actions */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!autoSave ? (
                      <>
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-xs cursor-pointer shadow-2xs"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="btn btn-primary px-6 py-2.5 shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>บันทึกประวัติการเช็คชื่อ</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-2xs">
                        ⚡ บันทึกข้อมูลอัตโนมัติเมื่อกดเลือกสถานะ
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Sticky Quick Summary & Action Bar */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-indigo-100 dark:border-slate-800 px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div className="text-xs">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{dailyStats.marked}/{dailyStats.total}</span>
                      <span className="text-slate-500 dark:text-slate-400 ml-1">เช็คแล้ว</span>
                    </div>
                    {autoSave && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                        {autoSaveStatus === 'saving' ? 'บันทึก...' : 'บันทึกอัตโนมัติ'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!autoSave && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || dailyStats.marked === 0}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>บันทึก</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                      title="เลื่อนขึ้นบนสุด"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= ATTENDANCE HISTORY MATRIX GRID ================= */
            <div className="space-y-6">

              {/* Modern Thai Date range filter card */}
              <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-blue-500/10 dark:from-slate-850 dark:via-slate-850 dark:to-slate-850 p-4 sm:p-5 rounded-3xl border border-indigo-100/80 dark:border-slate-800 shadow-lg shadow-indigo-500/5 dark:shadow-black/40 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Header Title */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">ตัวเลือกช่วงวันที่แสดงผล</h3>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800">
                          <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-pulse" /> ปฏิทินไทย
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">คลิกเพื่อเลือกวันเริ่มต้น-สิ้นสุดบนปฏิทินไทย หรือใช้ปุ่มลัดเลือกช่วงเวลา</p>
                    </div>
                  </div>

                  {/* Right: Thai Custom Date Range Picker Component & Counter */}
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                    <ThaiDateRangePicker
                      startDate={matrixStartDate}
                      endDate={matrixEndDate}
                      onChange={(start: string, end: string) => {
                        setMatrixStartDate(start);
                        setMatrixEndDate(end);
                      }}
                    />

                    {/* Range Summary Status */}
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-bold bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-indigo-100/80 dark:border-slate-700 shadow-sm flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>{matrixDates.length > 0 ? `${matrixDates.length} คาบเรียน/วันในตาราง` : '0 คาบ'}</span>
                      </div>
                      {teachingDayGovHolidays.length > 0 && (
                        <div
                          className="text-xs text-amber-900 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-3 py-2 rounded-2xl border border-amber-200/80 dark:border-amber-800 shadow-sm flex items-center gap-1.5 shrink-0"
                          title={`วันหยุดตรงกับวันที่มีสอน: ${teachingDayGovHolidays.map(h => `${h.date} (${h.name})`).join(', ')}`}
                        >
                          <span>🏖️</span>
                          <span>ตรงวันสอน {teachingDayGovHolidays.length} วัน</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Teaching Days Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-indigo-100/90 dark:border-slate-700 shadow-sm mt-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">วันที่มีตารางสอนของห้องนี้:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 0, label: 'จันทร์' },
                      { id: 1, label: 'อังคาร' },
                      { id: 2, label: 'พุธ' },
                      { id: 3, label: 'พฤหัสบดี' },
                      { id: 4, label: 'ศุกร์' },
                      { id: 5, label: 'เสาร์' },
                      { id: 6, label: 'อาทิตย์' },
                    ].map(day => {
                      const isSelected = teachingDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (teachingDays.length > 1) {
                                setTeachingDays((prev: number[]) => prev.filter((d: number) => d !== day.id));
                              }
                            } else {
                              setTeachingDays((prev: number[]) => [...prev, day.id].sort((a: number, b: number) => a - b));
                            }
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-650'
                            }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Matrix Grid Table */}
              <div className="glass dark:bg-slate-900/85 overflow-hidden rounded-2xl border border-white/50 dark:border-slate-800 shadow-xl dark:shadow-black/40">
                <div className="p-4 border-b border-indigo-50/50 dark:border-slate-800 bg-white/40 dark:bg-slate-900/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Grid className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <span className="font-bold text-slate-800 dark:text-slate-100">ตารางการเช็คชื่อสะสม ({matrixDates.length} คาบเรียน/วัน)</span>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="form-input pl-9 py-1.5 text-xs bg-white/70 dark:bg-slate-800 dark:text-slate-100 border-indigo-100/50 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                {matrixLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                    <p className="text-slate-500 dark:text-slate-400 font-semibold animate-pulse text-sm">กำลังคำนวณข้อมูลประวัติ...</p>
                  </div>
                ) : matrixDates.length === 0 ? (
                  <div className="p-20 text-center">
                    <CalendarIcon className="w-16 h-16 text-indigo-200 dark:text-indigo-800 mx-auto mb-4 stroke-1" />
                    <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">ไม่พบข้อมูลการเช็คชื่อ</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs mx-auto">ไม่มีประวัติการบันทึกการเช็คชื่อในช่วงวันที่กำหนด</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <div style={{ minWidth: `${Math.max(1000, 176 + (matrixDates.length * 96))}px` }}>
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-indigo-50 dark:bg-slate-900 border-b border-indigo-100/80 dark:border-slate-800 sticky top-0 z-20">
                            <th className="p-4 font-bold text-slate-700 dark:text-slate-200 w-44 sticky left-0 bg-indigo-50 dark:bg-slate-850 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.4)] border-r border-indigo-100 dark:border-slate-800">
                              นักเรียน ({filteredStudents.length} คน)
                            </th>
                            {matrixDates.map(dateStr => {
                              const dateObj = new Date(dateStr);
                              const day = dateObj.getDate();
                              const month = dateObj.toLocaleDateString('th-TH', { month: 'short' });
                              const holiday = holidayMap[dateStr] || checkThaiHoliday(dateStr);

                              const isGovHoliday = holiday?.type === 'government';
                              const isWeekend = holiday?.type === 'weekend';

                              return (
                                <th
                                  key={dateStr}
                                  className={`p-3 font-bold text-center w-24 text-xs border-r transition-colors ${isGovHoliday
                                    ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-200/90 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                                    : isWeekend
                                      ? 'bg-slate-200/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                      : 'bg-indigo-50/70 dark:bg-slate-850 border-indigo-100/50 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  title={holiday ? holiday.name : undefined}
                                >
                                  <div className="flex flex-col items-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDate(dateStr);
                                        setActiveTab('daily');
                                        toast.success(`เปิดหน้าเช็คชื่อวันที่ ${day} ${month}`);
                                      }}
                                      className="group/btn flex flex-col items-center hover:opacity-85 transition-all cursor-pointer"
                                      title={`คลิกเพื่อเปิดหน้าเช็คชื่อทั้งห้องของวันที่ ${day} ${month}`}
                                    >
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                        {dateObj.toLocaleDateString('th-TH', { weekday: 'short' })}
                                        {isGovHoliday && <span>🏖️</span>}
                                      </span>
                                      <span className={`text-sm font-black ${isGovHoliday ? 'text-amber-950 dark:text-amber-200' : 'text-indigo-800 dark:text-indigo-300'} group-hover/btn:underline`}>
                                        {day} {month}
                                      </span>
                                      <span className="text-[9px] text-indigo-600 dark:text-indigo-300 font-bold bg-white/90 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 px-1.5 py-0.5 rounded-md border border-indigo-200/80 dark:border-slate-700 mt-0.5 opacity-80 group-hover/btn:opacity-100 shadow-xs">
                                        เช็คทั้งห้อง
                                      </span>
                                    </button>
                                    {isGovHoliday && (
                                      <span className="text-[9px] font-bold text-amber-800 truncate max-w-[84px] leading-tight mt-0.5" title={holiday.name}>
                                        {holiday.name}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {hasMultipleSections && selectedSectionKey === 'all' ? (
                            visibleSectionGroups.map(grp => {
                              const isCollapsed = Boolean(collapsedSections[grp.key]);
                              return (
                                <Fragment key={grp.key}>
                                  <tr className="border-y border-indigo-200/80 dark:border-slate-800 bg-indigo-50/90 dark:bg-slate-800/80">
                                    <td className="px-3 py-2 sticky left-0 bg-indigo-100/95 dark:bg-slate-850 z-20 border-r border-indigo-200 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                                      <button
                                        type="button"
                                        onClick={() => toggleSectionCollapse(grp.key)}
                                        className="flex items-center justify-between gap-1.5 w-full text-left cursor-pointer"
                                        title={isCollapsed ? 'คลิกเพื่อกางรายชื่อห้องนี้' : 'คลิกเพื่อพับเก็บรายชื่อห้องนี้'}
                                      >
                                        <span className="flex items-center gap-1.5 min-w-0">
                                          <ChevronDown className={`w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                          <span className="font-extrabold text-xs text-indigo-950 dark:text-indigo-200 truncate">{grp.label}</span>
                                        </span>
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 shrink-0">
                                          {grp.students.length} คน
                                        </span>
                                      </button>
                                    </td>
                                    <td colSpan={matrixDates.length} className="px-3 py-2 bg-gradient-to-r from-indigo-50/90 to-violet-50/40 dark:from-slate-800/80 dark:to-slate-800/40 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                                      <div className="flex items-center gap-2">
                                        <span>กลุ่มเรียน: {grp.fullLabel} ({grp.students.length} คน)</span>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSectionKey(grp.key)}
                                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline cursor-pointer"
                                        >
                                          ดูเฉพาะห้องนี้ →
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {!isCollapsed && grp.students.map((student, idx) => renderMatrixStudentRow(student, idx, true))}
                                </Fragment>
                              );
                            })
                          ) : (
                            filteredStudents.map((student, idx) => renderMatrixStudentRow(student, idx, false))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


              </div>
            </div>
          )}
        </>
      )}

      {/* ================= HISTORY LIST MODAL FOR SINGLE STUDENT ================= */}
      <AttendanceHistoryModal
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
        isLoading={historyLoading}
        records={historyData}
        onDeleteRecord={handleDeleteHistory}
        getStatusDisplay={getStatusDisplay}
      />

      {/* ================= ATTENDANCE CSV PREVIEW & EXPORT MODAL ================= */}
      <AttendanceCsvModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        classroom={selectedClassData ? {
          id: selectedClassData.id,
          name: selectedClassData.name,
          min_attendance_percent: selectedClassData.min_attendance_percent,
          total_classes: selectedClassData.total_classes,
          late_to_absent_ratio: selectedClassData.late_to_absent_ratio,
          leave_to_absent_ratio: selectedClassData.leave_to_absent_ratio,
        } : null}
        initialStartDate={exportStartDate}
        initialEndDate={exportEndDate}
        initialSectionKey={selectedSectionKey}
      />

      {/* ================= ATTENDANCE EXCEL IMPORT & TEMPLATE MODAL ================= */}
      {selectedClass && (
        <AttendanceImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          classroomId={selectedClass}
          classroomName={classrooms.find(c => String(c.id) === selectedClass)?.name || 'ห้องเรียน'}
          students={students}
          currentDate={date}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            toast.success('อัปเดตข้อมูลการเช็คชื่อในตารางเรียบร้อยแล้ว');
          }}
        />
      )}

      {/* ================= RETROACTIVE ATTENDANCE MODAL ================= */}
      <AttendanceRetroactiveModal
        isOpen={showRetroactiveModal}
        onClose={() => setShowRetroactiveModal(false)}
        selectedClassData={selectedClassData}
        semesterInfo={semesterInfo}
        date={date}
        setDate={setDate}
        setActiveTab={setActiveTab}
        teachingDays={teachingDays}
        todayStr={todayStr}
      />
    </div>
  );
}
