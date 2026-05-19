'use client';
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import api from '@/services/api';
import { Loader2, BookOpen, Save, Settings, AlertCircle, TrendingUp, Plus, Trash2, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';

export default function Grades() {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [report, setReport] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [weights, setWeights] = useState({
    assignment_weight: 10,
    post_test_weight: 70,
    affective_weight: 20,
    midterm_weight: 0,
    final_weight: 0,
    midterm_max_score: 100,
    final_max_score: 100
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const defaultCriteria = [
    { grade: '4', min_score: 80 },
    { grade: '3.5', min_score: 75 },
    { grade: '3', min_score: 70 },
    { grade: '2.5', min_score: 65 },
    { grade: '2', min_score: 60 },
    { grade: '1.5', min_score: 55 },
    { grade: '1', min_score: 50 },
    { grade: '0', min_score: 0 },
  ];

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      const c = classrooms.find(cl => cl.id === Number(selectedClass)) || classrooms.find(cl => cl.id === String(selectedClass));
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
      fetchGradesData();
    } else {
      setReport([]);
      setCriteria([]);
    }
  }, [selectedClass]);

  const fetchClassrooms = async () => {
    try {
      const res = await api.get('/classrooms');
      setClassrooms(res.data.data || []);
    } catch {
      toast.error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const fetchGradesData = async () => {
    try {
      const [critRes, repRes] = await Promise.all([
        api.get('/grades/criteria/' + selectedClass),
        api.get('/grades/report/' + selectedClass)
      ]);

      const loadedCriteria = critRes.data.data;
      if (loadedCriteria && loadedCriteria.length > 0) {
        setCriteria(loadedCriteria);
      } else {
        setCriteria(defaultCriteria.map(c => ({ ...c })));
      }

      setReport(repRes.data.data || []);
      setCurrentPage(1);
    } catch {
      toast.error('โหลดข้อมูลผลการเรียนไม่สำเร็จ');
    }
  };

  // Paginated report subset
  const paginatedReport = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return report.slice(start, start + itemsPerPage);
  }, [report, currentPage, itemsPerPage]);

  const handleExamScoreChange = (studentId, field, value) => {
    setReport(prev => prev.map(student => {
      if (student.student_id === studentId) {
        const updatedStudent = { ...student, [field]: value };
        
        // Recalculate total score and percentage
        const mScore = parseFloat(updatedStudent.midterm_score) || 0;
        const fScore = parseFloat(updatedStudent.final_score) || 0;
        const evalScore = parseFloat(updatedStudent.total_eval_score) || 0;
        const scaledAssign = parseFloat(updatedStudent.scaled_assign) || 0;
        const scaledPost = parseFloat(updatedStudent.scaled_post_test) || 0;
        
        // Calculate new scaled midterm and final
        const scaledMidterm = weights.midterm_max_score > 0 ? Math.round((mScore / weights.midterm_max_score) * weights.midterm_weight) : 0;
        const scaledFinal = weights.final_max_score > 0 ? Math.round((fScore / weights.final_max_score) * weights.final_weight) : 0;
        
        updatedStudent.scaled_midterm = scaledMidterm;
        updatedStudent.precise_scaled_midterm = weights.midterm_max_score > 0 ? (mScore / weights.midterm_max_score) * weights.midterm_weight : 0;
        updatedStudent.scaled_final = scaledFinal;
        updatedStudent.precise_scaled_final = weights.final_max_score > 0 ? (fScore / weights.final_max_score) * weights.final_weight : 0;

        const affective = parseFloat(updatedStudent.affective_score) || 0;
        
        const totalScore = scaledAssign + scaledPost + affective + scaledMidterm + scaledFinal;
        updatedStudent.total_score = totalScore.toFixed(2);
        updatedStudent.percentage = totalScore.toFixed(2);
        
        // Recalculate grade
        let finalGrade = null;
        if (updatedStudent.is_f) {
          finalGrade = 'F';
        } else {
          for (const c of criteria) {
            if (totalScore >= Number(c.min_score)) {
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

  const [savingExams, setSavingExams] = useState(false);
  const saveExamScores = async () => {
    setSavingExams(true);
    try {
      const scores = report.map(s => ({
        student_id: s.student_id,
        midterm_score: parseFloat(s.midterm_score) || 0,
        final_score: parseFloat(s.final_score) || 0
      }));
      await api.put('/students/exams', { scores });
      toast.success('บันทึกคะแนนสอบกลางภาค/ปลายภาคสำเร็จ');
    } catch {
      toast.error('บันทึกคะแนนสอบไม่สำเร็จ');
    } finally {
      setSavingExams(false);
    }
  };

  const exportCSV = () => {
    if (!report || report.length === 0) return;

    // Header row
    const headers = [
      'รหัสประจำตัว',
      'ชื่อ-นามสกุล',
      `งานเก็บ (${weights.assignment_weight})`,
      `สอบท้ายคาบ (${weights.post_test_weight})`,
      `กลางภาค (${weights.midterm_weight})`,
      `ปลายภาค (${weights.final_weight})`,
      `จิตพิสัย (${weights.affective_weight})`,
      'รวม',
      'เกรด'
    ];

    // Data rows
    const rows = report.map(student => [
      student.student_code || '-',
      student.name,
      Number(student.scaled_assign || 0).toFixed(0),
      Number(student.scaled_post_test || 0).toFixed(0),
      Number(student.scaled_midterm || 0).toFixed(0),
      Number(student.scaled_final || 0).toFixed(0),
      Number(student.affective_score || 0).toFixed(1),
      Number(student.total_score || 0).toFixed(1),
      student.grade
    ]);

    // CSV Content with BOM for Excel UTF-8 compatibility
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Determine classroom name for filename
    const c = classrooms.find(cl => cl.id === Number(selectedClass) || cl.id === String(selectedClass));
    const className = c ? c.name : 'Unknown';
    
    link.setAttribute('download', `คะแนน_${className}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveCriteria = async () => {
    setSaving(true);
    try {
      await api.post('/grades/criteria/' + selectedClass, { criteria });
      await api.put('/classrooms/' + selectedClass, {
        assignment_weight: Number(weights.assignment_weight),
        post_test_weight: Number(weights.post_test_weight),
        affective_weight: Number(weights.affective_weight),
        midterm_weight: Number(weights.midterm_weight),
        final_weight: Number(weights.final_weight),
        midterm_max_score: Number(weights.midterm_max_score),
        final_max_score: Number(weights.final_max_score)
      });
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
      setShowSettings(false);
      fetchClassrooms(); // Refresh to update classroom data with new weights
      fetchGradesData();
    } catch {
      toast.error('บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleCriteriaChange = (index, field, value) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const addCriteriaRow = () => {
    setCriteria([...criteria, { grade: '', min_score: 0 }]);
  };

  const removeCriteriaRow = (index) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const getGradeStyle = (grade) => {
    if (grade === '4' || grade === 'A') return '-white shadow-emerald-500/20';
    if (grade === '0' || grade === 'F') return '-white shadow-red-500/20';
    if (grade === 'ไม่มีเกรด') return 'bg-white text-slate-600';
    return '-white shadow-indigo-500/20';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">ตัดเกรด</h1>
        <p className="text-slate-500 text-sm">สรุปผลการเรียนและตัดเกรดนักเรียนแต่ละห้องเรียน</p>
      </div>

      {/* Header */}
      <div className="glass p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex-1 w-full max-w-md">
          <label className="form-label">ห้องเรียน</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="form-input">
            <option value="">-- เลือกห้องเรียน --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedClass && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`btn ${showSettings ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Settings className="w-4 h-4" /> ตั้งค่าเกณฑ์ตัดเกรด
          </button>
        )}
      </div>

      {!selectedClass ? (
        <div className="glass p-14 text-center rounded-2xl">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600">กรุณาเลือกห้องเรียนเพื่อดูผลการเรียน</p>
        </div>
      ) : showSettings ? (
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" /> ตั้งค่าน้ำหนักคะแนน และ เกณฑ์การตัดเกรด
          </h3>

          {/* Weights Section */}
          <div className="mb-8 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
            <h4 className="font-semibold text-slate-800 mb-3">น้ำหนักคะแนน (รวม 5 ส่วนต้องเท่ากับ 100%)</h4>
            <p className="text-sm text-slate-600 mb-4">ระบบจะนำคะแนนดิบที่นักเรียนได้ มาเทียบบัญญัติไตรยางศ์เพื่อแปลงให้เป็นน้ำหนักคะแนนที่ตั้งไว้โดยอัตโนมัติ</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-emerald-400 uppercase mb-2">งานเก็บ</label>
                <input 
                  type="number" 
                  value={weights.assignment_weight} 
                  onChange={e => setWeights({...weights, assignment_weight: e.target.value})}
                  className="form-input text-center" 
                  placeholder="เช่น 20" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-amber-400 uppercase mb-2">สอบย่อย</label>
                <input 
                  type="number" 
                  value={weights.post_test_weight} 
                  onChange={e => setWeights({...weights, post_test_weight: e.target.value})}
                  className="form-input text-center" 
                  placeholder="เช่น 30" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-cyan-400 uppercase mb-2">กลางภาค</label>
                <input 
                  type="number" 
                  value={weights.midterm_weight} 
                  onChange={e => setWeights({...weights, midterm_weight: e.target.value})}
                  className="form-input text-center" 
                  placeholder="เช่น 20" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-blue-400 uppercase mb-2">ปลายภาค</label>
                <input 
                  type="number" 
                  value={weights.final_weight} 
                  onChange={e => setWeights({...weights, final_weight: e.target.value})}
                  className="form-input text-center" 
                  placeholder="เช่น 20" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-pink-400 uppercase mb-2">จิตพิสัย</label>
                <input 
                  type="number" 
                  value={weights.affective_weight} 
                  onChange={e => setWeights({...weights, affective_weight: e.target.value})}
                  className="form-input text-center" 
                  placeholder="เช่น 10" 
                />
              </div>
            </div>
            
            {/* Max Scores for Exams */}
            <div className="mt-6 pt-5 border-t border-indigo-100">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">ระบุคะแนนเต็ม (เพื่อใช้เป็นตัวหาร)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <div className="flex items-center gap-3 bg-white p-3 rounded-lg">
                  <label className="text-sm text-cyan-400 w-32 shrink-0">เต็ม กลางภาค:</label>
                  <input 
                    type="number" 
                    value={weights.midterm_max_score} 
                    onChange={e => setWeights({...weights, midterm_max_score: e.target.value})}
                    className="form-input text-center flex-1" 
                    placeholder="เช่น 100" 
                  />
                </div>
                <div className="flex items-center gap-3 bg-white p-3 rounded-lg">
                  <label className="text-sm text-blue-400 w-32 shrink-0">เต็ม ปลายภาค:</label>
                  <input 
                    type="number" 
                    value={weights.final_max_score} 
                    onChange={e => setWeights({...weights, final_max_score: e.target.value})}
                    className="form-input text-center flex-1" 
                    placeholder="เช่น 100" 
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between bg-white p-3 rounded-lg">
              <div className="text-sm font-medium text-slate-700">
                ยอดรวมน้ำหนัก: 
                <span className={`ml-2 font-bold text-lg ${
                  (Number(weights.assignment_weight) + Number(weights.post_test_weight) + Number(weights.midterm_weight) + Number(weights.final_weight) + Number(weights.affective_weight)) === 100 
                  ? 'text-emerald-400' 
                  : 'text-rose-400'
                }`}>
                  {Number(weights.assignment_weight) + Number(weights.post_test_weight) + Number(weights.midterm_weight) + Number(weights.final_weight) + Number(weights.affective_weight)}
                </span> / 100%
              </div>
              {(Number(weights.assignment_weight) + Number(weights.post_test_weight) + Number(weights.midterm_weight) + Number(weights.final_weight) + Number(weights.affective_weight)) !== 100 && (
                <div className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  กรุณาปรับให้รวมได้ 100% พอดี
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">เกณฑ์คะแนนขั้นต่ำ (%) สำหรับแต่ละเกรด</h4>
              <p className="text-sm text-slate-500">ระบบจะเรียงจากสูงสุดไปต่ำสุดให้อัตโนมัติ</p>
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
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 transition-colors"
              >
                ใช้เกรดอักษร (A-F)
              </button>
              <button 
                onClick={() => setCriteria([...defaultCriteria])}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 transition-colors"
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
              <div key={i} className="grid grid-cols-12 gap-3 items-center bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={c.grade}
                    onChange={e => handleCriteriaChange(i, 'grade', e.target.value)}
                    className="form-input py-2 text-center font-bold"
                    placeholder="เช่น 4, A"
                  />
                </div>
                <div className="col-span-5 flex items-center gap-2">
                  <span className="text-slate-500 text-sm shrink-0">{'>='}</span>
                  <input
                    type="number"
                    value={c.min_score}
                    onChange={e => handleCriteriaChange(i, 'min_score', e.target.value)}
                    className="form-input py-2"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <button onClick={() => removeCriteriaRow(i)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addCriteriaRow}
              className="flex items-center gap-2 text-indigo-400 hover:text-indigo-700 text-sm font-medium p-2 rounded-lg hover:bg-indigo-500/10 transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่มเกณฑ์
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveCriteria} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกเกณฑ์
            </button>
            <button onClick={() => setShowSettings(false)} className="btn bg-indigo-100 hover:bg-indigo-300 text-slate-700">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : report.length === 0 ? (
        <div className="glass p-14 text-center rounded-2xl">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600">ไม่มีข้อมูลนักเรียนในห้องนี้</p>
          <p className="text-slate-500 text-sm mt-1">เพิ่มนักเรียนในเมนูนักเรียนก่อนครับ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {report.length > 0 && report[0].max_assign === 0 && report[0].max_post_test === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 animate-fade-in-up">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-bold text-sm">⚠️ ยังไม่มีโครงสร้างคะแนนเต็ม!</p>
                <p className="text-red-400/80 text-xs mt-1">ระบบไม่พบข้อมูลคะแนนเต็มรวมของงานเก็บและสอบท้ายคาบ กรุณาไปที่เมนู <strong>"คะแนนเก็บและสอบ"</strong> → แท็บ <strong>"โครงสร้างคะแนนเต็ม"</strong> แล้วกดบันทึกก่อน มิฉะนั้นคะแนนรวมและเกรดจะไม่ถูกต้อง</p>
              </div>
            </div>
          )}
        <div className="glass overflow-hidden rounded-2xl">
          <div className="p-5 border-b border-indigo-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-800">สรุปผลการเรียน ({report.length} คน)</h3>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={exportCSV} className="btn bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
              <button onClick={saveExamScores} disabled={savingExams} className="btn btn-primary flex items-center gap-2">
                {savingExams ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกคะแนนสอบ
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-50 border-b border-indigo-100">
                  <th className="p-4 font-semibold text-slate-700 w-24">รหัส</th>
                  <th className="p-4 font-semibold text-slate-700">ชื่อ-นามสกุล</th>
                  <th className="p-4 font-semibold text-emerald-400 text-center text-sm">งานเก็บ ({weights.assignment_weight})</th>
                  <th className="p-4 font-semibold text-amber-400 text-center text-sm">สอบท้ายคาบ ({weights.post_test_weight})</th>
                  <th className="p-4 font-semibold text-cyan-400 text-center text-sm w-28">กลางภาค ({weights.midterm_weight})</th>
                  <th className="p-4 font-semibold text-blue-400 text-center text-sm w-28">ปลายภาค ({weights.final_weight})</th>
                  <th className="p-4 font-semibold text-pink-400 text-center text-sm">จิตพิสัย ({weights.affective_weight})</th>
                  <th className="p-4 font-semibold text-indigo-400 text-center text-sm">รวม</th>
                  <th className="p-4 font-semibold text-slate-700 text-center w-32">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReport.map((student) => (
                  <tr key={student.student_id} className="border-b border-indigo-100 hover:bg-indigo-50/50 transition-colors">
                    <td className="p-4 text-slate-600 text-sm">{student.student_code || '-'}</td>
                    <td className="p-4 font-medium text-slate-800">{student.name}</td>
                    <td className="p-4 text-center">
                      <div className="font-bold text-emerald-700 text-lg">{Number(student.scaled_assign || 0).toFixed(0)}</div>
                      <div className="text-[10px] text-emerald-400/60 mb-1">ก่อนปัด: {Number(student.precise_scaled_assign || 0).toFixed(3)}</div>
                      <div className="text-xs text-slate-500">ดิบ: {Number(student.raw_assign || 0).toFixed(1)} / {student.max_assign || 0}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="font-bold text-amber-700 text-lg">{Number(student.scaled_post_test || 0).toFixed(0)}</div>
                      <div className="text-[10px] text-amber-400/60 mb-1">ก่อนปัด: {Number(student.precise_scaled_post_test || 0).toFixed(3)}</div>
                      <div className="text-xs text-slate-500">ดิบ: {Number(student.raw_post_test || 0).toFixed(1)} / {student.max_post_test || 0}</div>
                    </td>
                    <td className="p-4 text-center">
                      <input 
                        type="number" 
                        value={student.midterm_score ?? ''}
                        onChange={e => handleExamScoreChange(student.student_id, 'midterm_score', e.target.value)}
                        className="form-input text-center py-1 w-16 mx-auto text-cyan-700 font-bold mb-1" 
                        placeholder="0"
                      />
                      <div className="font-bold text-cyan-700 text-sm">ได้: {Number(student.scaled_midterm || 0).toFixed(0)}</div>
                      <div className="text-[10px] text-cyan-400/60">ก่อนปัด: {Number(student.precise_scaled_midterm || 0).toFixed(3)}</div>
                    </td>
                    <td className="p-4 text-center">
                      <input 
                        type="number" 
                        value={student.final_score ?? ''}
                        onChange={e => handleExamScoreChange(student.student_id, 'final_score', e.target.value)}
                        className="form-input text-center py-1 w-16 mx-auto text-blue-700 font-bold mb-1" 
                        placeholder="0"
                      />
                      <div className="font-bold text-blue-700 text-sm">ได้: {Number(student.scaled_final || 0).toFixed(0)}</div>
                      <div className="text-[10px] text-blue-400/60">ก่อนปัด: {Number(student.precise_scaled_final || 0).toFixed(3)}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="font-semibold text-pink-700">{Number(student.affective_score || 0).toFixed(1)}</div>
                      {student.is_f && <div className="text-xs text-red-400 mt-1">หมดสิทธิ์สอบ (F)</div>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-indigo-700 text-lg">{Number(student.total_score || 0).toFixed(1)}</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <div className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-xl font-bold text-lg shadow-lg ${getGradeStyle(student.grade)}`}>
                          {student.grade}
                        </div>
                        {student.is_f && (
                          <span className="text-[0.65rem] text-red-400 font-bold mt-1 bg-red-500/10 px-1.5 py-0.5 rounded">
                            (เวลาเรียนไม่พอ)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {report.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={report.length}
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
