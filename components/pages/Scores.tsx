'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { Loader2, Save, FileText, Settings, Users, BookOpen, AlertCircle, Upload, Calculator, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import axios from 'axios';

interface Classroom {
  id: string | number;
  name: string;
  total_classes?: number;
}

interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  classroom_id?: string | number;
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
}

interface ScoreValue {
  assignment_score: number | string;
  post_test_score: number | string;
}

interface ScoresMap {
  [studentId: string]: ScoreValue;
}

export default function Scores() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' or 'settings'

  // Settings State
  const [structures, setStructures] = useState<ScoreStructure[]>([]);
  const [structureSavedInDB, setStructureSavedInDB] = useState(false);
  
  // Entry State
  const [selectedLesson, setSelectedLesson] = useState('');
  const [scores, setScores] = useState<ScoresMap>({}); // { student_id: { assignment_score: 10, post_test_score: 5 } }

  // Bulk Import State
  const [importData, setImportData] = useState<StudentScoreEntry[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importType, setImportType] = useState('assignment');

  // Test Blueprint Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [totalAcademicScore, setTotalAcademicScore] = useState(70);
  const [theoryHoursPerWeek, setTheoryHoursPerWeek] = useState(1);
  const [practiceHoursPerWeek, setPracticeHoursPerWeek] = useState(2);

  const fetchClassrooms = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/classrooms', { signal });
      setClassrooms(res.data.data || []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchClassrooms(controller.signal);
    return () => controller.abort();
  }, [fetchClassrooms]);

  const fetchClassData = useCallback(async (signal?: AbortSignal) => {
    if (!selectedClass) return;
    try {
      const stuRes = await api.get(`/students?classroom_id=${selectedClass}`, { signal });
      setStudents(stuRes.data.data || []);

      const structRes = await api.get(`/scores?classroom_id=${selectedClass}&type=structure`, { signal });
      const fetchedStructs = structRes.data.data || [];
      
      // Calculate target weeks based on total_classes of the selected classroom
      const classroomObj = classrooms.find(c => String(c.id) === String(selectedClass));
      const total = classroomObj?.total_classes || 40;
      let targetWeeks = 18;
      if (total % 18 !== 0) {
        for (let w = 15; w <= 20; w++) {
          if (total % w === 0) {
            targetWeeks = w;
            break;
          }
        }
      }
      console.log('fetchClassData DEBUG:', { selectedClass, classroomObj, total, targetWeeks });

      // Initialize structures to have exactly targetWeeks items
      let finalStructs = [];
      if (fetchedStructs.length === 0) {
        finalStructs = Array.from({ length: targetWeeks }, (_, i) => ({
          lesson_number: i + 1,
          lesson_name: `บทที่/สัปดาห์ที่ ${i + 1}`,
          max_assignment_score: 10,
          max_post_test_score: 10,
          hours: 0
        }));
        setStructureSavedInDB(false);
      } else {
        // Adjust length of fetchedStructs to match targetWeeks
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
        setStructureSavedInDB(true);
      }
      setStructures(finalStructs);
      
      let initialLesson = selectedLesson;
      if (finalStructs.length > 0) {
        const hasLesson = finalStructs.some(s => s.lesson_number.toString() === initialLesson);
        if (!hasLesson || parseInt(initialLesson) > targetWeeks) {
          initialLesson = finalStructs[0].lesson_number.toString();
        }
      } else {
        if (!initialLesson || parseInt(initialLesson) > targetWeeks) {
          initialLesson = '1';
        }
      }
      setSelectedLesson(initialLesson);

    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลนักเรียนหรือโครงสร้างคะแนนไม่สำเร็จ');
      }
    }
  }, [selectedClass, selectedLesson, classrooms]);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedClass) {
      fetchClassData(controller.signal);
    } else {
      setStudents([]);
      setStructures([]);
      setSelectedLesson('');
      setScores({});
    }
    return () => controller.abort();
  }, [selectedClass, fetchClassData]);

  const fetchStudentScores = useCallback(async (signal?: AbortSignal) => {
    if (!selectedClass || !selectedLesson) return;
    try {
      const res = await api.get(`/scores?classroom_id=${selectedClass}&lesson_number=${selectedLesson}`, { signal });
      const scoresMap: ScoresMap = {};
      (res.data.data || []).forEach((s: any) => {
        scoresMap[String(s.student_id)] = {
          assignment_score: s.assignment_score !== null ? s.assignment_score : '',
          post_test_score: s.post_test_score !== null ? s.post_test_score : ''
        };
      });
      setScores(scoresMap);
    } catch (err) {
      if (!axios.isCancel(err)) {
        toast.error('โหลดข้อมูลคะแนนนักเรียนไม่สำเร็จ');
      }
    }
  }, [selectedClass, selectedLesson]);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedLesson && selectedClass) {
      fetchStudentScores(controller.signal);
    } else {
      setScores({});
    }
    return () => controller.abort();
  }, [selectedLesson, selectedClass, fetchStudentScores]);

  const handleStructureChange = (index: number, field: keyof ScoreStructure, value: any) => {
    const newStructs = [...structures];
    newStructs[index] = { ...newStructs[index], [field]: value };
    setStructures(newStructs);
  };

  const saveStructure = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      await api.post(`/scores?classroom_id=${selectedClass}&type=structure`, {
        classroom_id: selectedClass,
        structures: structures.map(s => ({
          ...s,
          max_assignment_score: parseFloat(String(s.max_assignment_score)) || 0,
          max_post_test_score: parseFloat(String(s.max_post_test_score)) || 0,
          hours: parseFloat(String(s.hours)) || 0
        }))
      });
      toast.success('บันทึกโครงสร้างคะแนนเรียบร้อย');
      setStructureSavedInDB(true);
    } catch {
      toast.error('บันทึกโครงสร้างคะแนนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // --- Test Blueprint Generator ---
  const calculateBlueprint = () => {
    let totalHours = 0;
    structures.forEach(s => {
      totalHours += parseFloat(String(s.hours)) || 0;
    });

    if (totalHours === 0) {
      toast.error('กรุณาระบุชั่วโมงเรียนให้ครบถ้วนก่อนคำนวณ');
      return;
    }

    const totalContactHours = theoryHoursPerWeek + practiceHoursPerWeek;
    if (totalContactHours === 0) {
      toast.error('กรุณาระบุชั่วโมงทฤษฎีและปฏิบัติ');
      return;
    }

    // Ratio: practice / total contact hours
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
        // Last lesson: absorb rounding remainder to hit exact targets
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
    toast.success(`คำนวณสัดส่วนสำเร็จ! งานเก็บ(ทักษะ) = ${targetSkillTotal} | สอบ(พุทธิ) = ${targetTestTotal} | รวม = ${totalAcademicScore}`);
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

        let lessonCol = -1;
        let hoursCol = -1;
        let skillCol = -1;
        let postTestCol = -1;

        // Scan for headers
        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i] || [];
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim().toLowerCase();
            if (cell.includes('บทเรียนที่') || cell.includes('หน่วยที่')) lessonCol = j;
            if (cell.includes('ชั่วโมง')) hoursCol = j;
            if (cell.includes('คะแนนทักษะ') && !cell.includes('ใหม่')) skillCol = j;
            if (cell.includes('คะแนนรายบทเรียนใหม่') || cell.includes('พุทธิพิสัย')) postTestCol = j;
          }
          if (lessonCol !== -1 && skillCol !== -1 && postTestCol !== -1) {
            break;
          }
        }

        if (lessonCol === -1 || skillCol === -1 || postTestCol === -1) {
          toast.error('ไม่พบโครงสร้างตารางที่รองรับ (ต้องมีคอลัมน์ "บทเรียนที่", "คะแนนทักษะ" และ "คะแนนรายบทเรียนใหม่")');
          return;
        }

        const newStructs = [...structures];
        let importedCount = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i] || [];
          const lessonNumRaw = String(row[lessonCol] || '').trim();
          const lessonNum = parseInt(lessonNumRaw);
          
          if (!isNaN(lessonNum) && lessonNum > 0 && lessonNum <= structures.length) {
            const index = newStructs.findIndex(s => s.lesson_number === lessonNum);
            if (index !== -1) {
              const skillScore = parseFloat(row[skillCol]) || 0;
              const postTestScore = parseFloat(row[postTestCol]) || 0;
              const hours = hoursCol !== -1 ? parseFloat(row[hoursCol]) : newStructs[index].hours;

              newStructs[index] = {
                ...newStructs[index],
                max_assignment_score: skillScore,
                max_post_test_score: postTestScore,
                hours: hours || newStructs[index].hours
              };
              importedCount++;
            }
          }
        }

        if (importedCount > 0) {
          setStructures(newStructs);
          toast.success(`นำเข้าโครงสร้างคะแนนสำเร็จ ${importedCount} บทเรียน`);
        } else {
          toast.error('ไม่พบข้อมูลบทเรียนที่สามารถอัปเดตได้');
        }

      } catch (err) {
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  const handleScoreChange = (studentId: string | number, field: 'assignment_score' | 'post_test_score', value: string) => {
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { assignment_score: '', post_test_score: '' }),
        [field]: value
      }
    }));
  };

  const saveScores = async () => {
    setSaving(true);
    try {
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
      toast.success('บันทึกคะแนนเรียบร้อย');
    } catch {
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Read as 2D array to find the week numbers row easily
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        let headerRowIndex = -1;
        let weekColumns: { [key: string]: number } = {}; // { '1': colIndex, '2': colIndex }
        let idColIndex = -1;
        let nameColIndex = -1;
        let lastNameColIndex = -1;

        // Try to find the row with '1', '2', '3' etc.
        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i] || [];
          let foundWeeks = 0;
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim();
            if (['1', '2', '3'].includes(cell)) foundWeeks++;
          }
          if (foundWeeks >= 3) {
            headerRowIndex = i;
            // Map week numbers to column index
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j]).trim();
              if (!isNaN(parseInt(cell))) {
                weekColumns[cell] = j;
              } else if (cell.includes('เลข') || cell.includes('รหัส')) {
                idColIndex = j;
              } else if (cell.includes('ชื่อ')) {
                nameColIndex = j;
              } else if (cell.includes('นามสกุล')) {
                lastNameColIndex = j;
              }
            }
            break;
          }
        }

        // Fallback for ID and Name columns if they are not in the exact same row as '1', '2', '3'
        if (idColIndex === -1 || nameColIndex === -1) {
           for (let i = 0; i <= headerRowIndex; i++) {
             const row = data[i] || [];
             for (let j = 0; j < row.length; j++) {
                const cell = String(row[j]).trim();
                if (idColIndex === -1 && (cell.includes('เลข') || cell.includes('รหัส'))) idColIndex = j;
                if (nameColIndex === -1 && (cell.includes('ชื่อ') && !cell.includes('นามสกุล'))) nameColIndex = j;
                if (lastNameColIndex === -1 && cell.includes('นามสกุล')) lastNameColIndex = j;
             }
           }
        }
        
        if (headerRowIndex === -1) {
          toast.error('ไม่พบหัวคอลัมน์ที่เป็นตัวเลขสัปดาห์ (1, 2, 3...) ในไฟล์นี้');
          return;
        }

        const parsedScores: StudentScoreEntry[] = [];

        // Parse student rows below header
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i] || [];
          if (row.length === 0) continue;
          
          let studentCode = idColIndex !== -1 ? String(row[idColIndex] || '').trim() : '';
          
          let fullName = '';
          if (nameColIndex !== -1) fullName += String(row[nameColIndex] || '').trim();
          if (lastNameColIndex !== -1 && row[lastNameColIndex]) fullName += ' ' + String(row[lastNameColIndex]).trim();
          
          // Try to match student
          let matchedStudent = null;
          if (studentCode) {
            matchedStudent = students.find(s => s.student_code === studentCode);
          }
          if (!matchedStudent && fullName) {
            // Very loose name matching to bypass prefix issues
            matchedStudent = students.find(s => fullName.includes(s.name) || s.name.includes(fullName.replace(/นาย|นางสาว|เด็กชาย|เด็กหญิง/g,'').trim()));
          }

          if (matchedStudent) {
            // Extract scores for each week
            Object.keys(weekColumns).forEach(weekNum => {
              const colIdx = weekColumns[weekNum];
              const scoreVal = row[colIdx];
              if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
                const scoreEntry: StudentScoreEntry = {
                  student_id: matchedStudent.id,
                  student_name: matchedStudent.name,
                  lesson_number: parseInt(weekNum),
                };
                if (type === 'assignment') {
                  scoreEntry.assignment_score = parseFloat(String(scoreVal));
                } else if (type === 'post_test') {
                  scoreEntry.post_test_score = parseFloat(String(scoreVal));
                }
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
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  const submitBulkImport = async () => {
    setSaving(true);
    try {
      await api.post(`/scores?classroom_id=${selectedClass}`, {
        classroom_id: selectedClass,
        scores: importData.map(d => {
          const entry: {
            student_id: string | number;
            lesson_number: number;
            assignment_score?: number;
            post_test_score?: number;
          } = {
            student_id: d.student_id,
            lesson_number: d.lesson_number,
          };
          if (importType === 'assignment') {
            entry.assignment_score = d.assignment_score;
          } else if (importType === 'post_test') {
            entry.post_test_score = d.post_test_score;
          }
          return entry;
        })
      });
      toast.success('นำเข้าคะแนนสำเร็จ');
      setShowImportPreview(false);
      setImportData([]);
      // Refresh current week scores
      if (selectedLesson) fetchStudentScores();
    } catch {
      toast.error('นำเข้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const currentStruct = structures.find(s => s.lesson_number.toString() === selectedLesson.toString()) || { max_assignment_score: 0, max_post_test_score: 0 };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">คะแนนเก็บและสอบ</h1>
        <p className="text-slate-500 text-sm">จัดการโครงสร้างคะแนนและกรอกคะแนนรายสัปดาห์</p>
      </div>

      <div className="glass p-5 rounded-2xl">
        <label className="form-label text-slate-700">เลือกห้องเรียน</label>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="form-input text-lg py-2.5 md:w-1/3">
          <option value="">-- เลือกห้องเรียน --</option>
          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedClass && (
        <>
          <div className="flex gap-4 border-b border-indigo-100 pb-2">
            <button
              onClick={() => setActiveTab('entry')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${activeTab === 'entry' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText className="w-4 h-4" /> กรอกคะแนน
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${activeTab === 'settings' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Settings className="w-4 h-4" /> โครงสร้างคะแนนเต็ม
            </button>
          </div>

          {activeTab === 'settings' && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-indigo-100 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">ตารางน้ำหนักคะแนน (Test Blueprint)</h2>
                  <p className="text-sm text-slate-600">กำหนดคะแนนเต็มของงานเก็บและสอบในแต่ละบทเรียน</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setShowCalculator(true)} className="btn bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 flex items-center gap-2 border border-indigo-200">
                    <Calculator className="w-4 h-4" />
                    คำนวณสัดส่วนอัตโนมัติ
                  </button>
                  <label className="btn bg-indigo-100 hover:bg-indigo-300 cursor-pointer flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    นำเข้า Blueprint
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBlueprintImport} />
                  </label>
                  <button onClick={saveStructure} disabled={saving} className="btn btn-primary flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    บันทึกโครงสร้าง
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto p-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-50 border-b border-indigo-100 text-slate-700">
                      <th className="p-3 w-16 text-center">สัปดาห์</th>
                      <th className="p-3">ชื่อบทเรียน/รายละเอียด</th>
                      <th className="p-3 w-28 text-center text-blue-400">ชั่วโมงเรียน</th>
                      <th className="p-3 w-40 text-center text-emerald-400">งานเก็บ (ทักษะพิสัย)</th>
                      <th className="p-3 w-40 text-center text-amber-400">สอบ (พุทธิพิสัย)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((struct, index) => (
                      <tr key={struct.lesson_number} className="border-b border-indigo-100 hover:bg-indigo-50/50">
                        <td className="p-3 text-center text-slate-600">{struct.lesson_number}</td>
                        <td className="p-3">
                          <input 
                            value={struct.lesson_name || ''} 
                            onChange={e => handleStructureChange(index, 'lesson_name', e.target.value)}
                            className="bg-transparent border border-indigo-200 rounded-lg px-3 py-1.5 w-full text-slate-800 outline-none focus:border-indigo-500"
                            placeholder="เช่น โปรแกรมประมวลผลคำ..."
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" min="0"
                            value={struct.hours || ''} 
                            onChange={e => handleStructureChange(index, 'hours', e.target.value)}
                            className="bg-indigo-50 border border-blue-500/30 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-blue-500"
                            placeholder="ชม."
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" step="0.1" min="0"
                            value={struct.max_assignment_score} 
                            onChange={e => handleStructureChange(index, 'max_assignment_score', e.target.value)}
                            className="bg-transparent border border-indigo-200 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" step="0.1" min="0"
                            value={struct.max_post_test_score} 
                            onChange={e => handleStructureChange(index, 'max_post_test_score', e.target.value)}
                            className="bg-transparent border border-indigo-200 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Calculator Modal */}
          {showCalculator && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white border border-indigo-200 rounded-2xl p-6 max-w-lg w-full">
                <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-400" />
                  คำนวณสัดส่วนคะแนนอัตโนมัติ
                </h3>
                <p className="text-slate-600 mb-5 text-sm">
                  ระบบจะนำชั่วโมงเรียนในตารางมาเทียบบัญญัติไตรยางศ์ แล้วแบ่งคะแนนตามสัดส่วนทฤษฎี:ปฏิบัติ โดยผลรวมจะออกมาตรงเป๊ะทุกครั้ง
                </p>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="form-label text-slate-800">คะแนนวิชาการรวม (งานเก็บ + สอบย่อย)</label>
                    <input 
                      type="number" 
                      value={totalAcademicScore}
                      onChange={e => setTotalAcademicScore(parseFloat(e.target.value) || 0)}
                      className="form-input text-lg"
                      placeholder="เช่น 70"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-amber-400">ทฤษฎี (พุทธิพิสัย) ชม./สัปดาห์</label>
                      <input 
                        type="number" min="0" step="1"
                        value={theoryHoursPerWeek}
                        onChange={e => setTheoryHoursPerWeek(parseFloat(e.target.value) || 0)}
                        className="form-input text-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="form-label text-emerald-400">ปฏิบัติ (ทักษะพิสัย) ชม./สัปดาห์</label>
                      <input 
                        type="number" min="0" step="1"
                        value={practiceHoursPerWeek}
                        onChange={e => setPracticeHoursPerWeek(parseFloat(e.target.value) || 0)}
                        className="form-input text-lg text-center"
                      />
                    </div>
                  </div>
                  {(theoryHoursPerWeek + practiceHoursPerWeek) > 0 && (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-sm">
                      <p className="text-slate-700 font-bold mb-2">📊 ตัวอย่างการแบ่งคะแนน (จากคะแนนรวม {totalAcademicScore}):</p>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                          <span className="text-emerald-700 font-bold">งานเก็บ (ทักษะ): {Math.round(totalAcademicScore * practiceHoursPerWeek / (theoryHoursPerWeek + practiceHoursPerWeek))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          <span className="text-amber-700 font-bold">สอบ (พุทธิ): {totalAcademicScore - Math.round(totalAcademicScore * practiceHoursPerWeek / (theoryHoursPerWeek + practiceHoursPerWeek))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowCalculator(false)} className="btn bg-white text-slate-700">
                    ยกเลิก
                  </button>
                  <button onClick={calculateBlueprint} className="btn btn-primary">
                    เริ่มคำนวณ
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entry' && (
            <div className="space-y-4">
              {!structureSavedInDB && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in-up">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-700 font-bold text-sm">⚠️ ยังไม่ได้บันทึกโครงสร้างคะแนน!</p>
                    <p className="text-amber-400/80 text-xs mt-1">กรุณาไปที่แท็บ <strong>"โครงสร้างคะแนนเต็ม"</strong> แล้วกดปุ่ม <strong>"บันทึกโครงสร้าง"</strong> ก่อน มิฉะนั้นหน้าตัดเกรดจะคำนวณคะแนนไม่ถูกต้อง (เพราะไม่มีคะแนนเต็มอ้างอิง)</p>
                  </div>
                </div>
              )}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-indigo-100 flex flex-col md:flex-row gap-4 items-end justify-between bg-indigo-50">
                <div className="w-full md:w-1/3">
                  <label className="form-label text-indigo-700">เลือกบทเรียน/สัปดาห์</label>
                  <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="form-input bg-white border-indigo-200">
                    {structures.map(s => (
                      <option key={s.lesson_number} value={s.lesson_number}>
                        สัปดาห์ที่ {s.lesson_number}: {s.lesson_name || 'ไม่มีชื่อ'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                  <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/20">
                    คะแนนงานเก็บเต็ม: {currentStruct.max_assignment_score}
                  </div>
                  <div className="bg-amber-500/10 text-amber-400 px-4 py-2 rounded-xl border border-amber-500/20">
                    คะแนนสอบเต็ม: {currentStruct.max_post_test_score}
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                  <label className="btn bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    นำเข้าคะแนนงานเก็บ
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleScoreImport(e, 'assignment')} />
                  </label>
                  <label className="btn bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/30 cursor-pointer flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    นำเข้าคะแนนสอบ
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleScoreImport(e, 'post_test')} />
                  </label>
                  <button onClick={saveScores} disabled={saving} className="btn btn-primary flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    บันทึกคะแนนหน้านี้
                  </button>
                </div>
              </div>

              {/* Import Preview Modal */}
              {showImportPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-white border border-indigo-200 rounded-2xl p-6 max-w-xl w-full">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">ตรวจสอบข้อมูลนำเข้า</h3>
                    <p className="text-slate-600 mb-4">
                      พบข้อมูล <strong className="text-slate-800">{importType === 'assignment' ? 'คะแนนงานเก็บ' : 'คะแนนสอบ'}</strong> รวมทั้งหมด <strong className="text-indigo-400">{importData.length}</strong> รายการ 
                      (กระจายตามสัปดาห์ของนักเรียนแต่ละคน)
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => { setShowImportPreview(false); setImportData([]); }} className="btn bg-white text-slate-700">
                        ยกเลิก
                      </button>
                      <button onClick={submitBulkImport} disabled={saving} className="btn btn-primary">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ยืนยันการนำเข้า'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {students.length === 0 ? (
                <div className="p-14 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-600">ไม่มีนักเรียนในห้องเรียนนี้</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        <th className="p-4 font-semibold text-slate-700 w-20">รหัส</th>
                        <th className="p-4 font-semibold text-slate-700">ชื่อ-นามสกุล</th>
                        <th className="p-4 font-semibold text-emerald-400 w-48 text-center">งานเก็บ (ทักษะพิสัย)</th>
                        <th className="p-4 font-semibold text-amber-400 w-48 text-center">สอบ (พุทธิพิสัย)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => {
                        const scoreData = scores[student.id] || { assignment_score: '', post_test_score: '' };
                        return (
                          <tr key={student.id} className="border-b border-indigo-100 hover:bg-indigo-50/50">
                            <td className="p-4 text-slate-600 text-sm">{student.student_code || '-'}</td>
                            <td className="p-4 font-medium text-slate-800">{student.name}</td>
                            <td className="p-4">
                              <input
                                type="number" step="0.1" min="0" max={currentStruct.max_assignment_score}
                                value={scoreData.assignment_score}
                                onChange={e => handleScoreChange(student.id, 'assignment_score', e.target.value)}
                                className="form-input text-center text-lg py-1.5"
                                placeholder={`/${currentStruct.max_assignment_score}`}
                              />
                            </td>
                            <td className="p-4">
                              <input
                                type="number" step="0.1" min="0" max={currentStruct.max_post_test_score}
                                value={scoreData.post_test_score}
                                onChange={e => handleScoreChange(student.id, 'post_test_score', e.target.value)}
                                className="form-input text-center text-lg py-1.5"
                                placeholder={`/${currentStruct.max_post_test_score}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
