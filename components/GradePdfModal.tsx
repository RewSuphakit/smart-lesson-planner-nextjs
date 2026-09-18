'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer, X, Settings2, FileText, CheckSquare, Square,
  ZoomIn, ZoomOut, RotateCcw, Award, CheckCircle2, UserCheck,
  Building2, Calendar, BookOpen, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

import type { Classroom, Criterion, ReportStudent, Weights } from '@/components/pages/Grades';

interface GradePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: Classroom | null;
  report: ReportStudent[];
  weights: Weights;
  criteria: Criterion[];
  teacherNameDefault?: string;
}

export default function GradePdfModal({
  isOpen,
  onClose,
  classroom,
  report,
  weights,
  criteria,
  teacherNameDefault = 'ครูผู้สอน'
}: GradePdfModalProps) {
  // Tabs for settings
  const [activeTab, setActiveTab] = useState<'info' | 'display' | 'signatures'>('info');
  const [zoomLevel, setZoomLevel] = useState<number>(85);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPws: boolean = useMemo(() => {
    return Boolean(weights.is_pws || classroom?.name?.includes('ปวส') || classroom?.name?.includes('ปวส.'));
  }, [weights, classroom]);

  // Customizable PDF State
  const [institutionName, setInstitutionName] = useState('วิทยาลัยอาชีวศึกษา');
  const [academicYear, setAcademicYear] = useState('ภาคเรียนที่ 1 ปีการศึกษา 2567');
  const [subjectCodeAndName, setSubjectCodeAndName] = useState('');
  const [curriculumLevel, setCurriculumLevel] = useState('');
  const [departmentName, setDepartmentName] = useState('แผนกวิชาคอมพิวเตอร์ธุรกิจและเทคโนโลยีสารสนเทศ');
  const [teacherName, setTeacherName] = useState('');
  const [headOfDepartment, setHeadOfDepartment] = useState('หัวหน้าแผนกวิชา');
  const [headOfCurriculum, setHeadOfCurriculum] = useState('หัวหน้างานวัดผลและประเมินผล');
  const [deputyDirector, setDeputyDirector] = useState('รองผู้อำนวยการฝ่ายวิชาการ');

  // Display Options
  const [reportType, setReportType] = useState<'official_vocational' | 'compact_announcement'>('official_vocational');
  const [showRawScore, setShowRawScore] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showPrintDate, setShowPrintDate] = useState(true);
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Column Visibility Options (เลือกคอลัมน์ที่จะแสดง)
  const [showStudentCode, setShowStudentCode] = useState(true);
  const [showAffective, setShowAffective] = useState(true);
  const [showPostTest, setShowPostTest] = useState(true);
  const [showAssignment, setShowAssignment] = useState(true);
  const [showMidterm, setShowMidterm] = useState(true);
  const [showFinal, setShowFinal] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showGrade, setShowGrade] = useState(true);

  // Quick Preset Handlers
  const applyPresetAll = () => {
    setShowStudentCode(true);
    setShowAffective(true);
    setShowPostTest(true);
    setShowAssignment(true);
    setShowMidterm(true);
    setShowFinal(true);
    setShowTotal(true);
    setShowAttendance(true);
    setShowGrade(true);
    toast.success('เลือกแสดงทุกคอลัมน์แล้ว');
  };

  const applyPresetAnnouncement = () => {
    setShowStudentCode(true);
    setShowAffective(false);
    setShowPostTest(false);
    setShowAssignment(false);
    setShowMidterm(false);
    setShowFinal(false);
    setShowTotal(true);
    setShowAttendance(false);
    setShowGrade(true);
    toast.success('ใช้รูปแบบติดบอร์ด (รหัส, รวม, เกรด)');
  };

  const applyPresetContinuous = () => {
    setShowStudentCode(true);
    setShowAffective(true);
    setShowPostTest(true);
    setShowAssignment(true);
    setShowMidterm(true);
    setShowFinal(false);
    setShowTotal(true);
    setShowAttendance(false);
    setShowGrade(false);
    toast.success('ใช้รูปแบบคะแนนเก็บระหว่างภาค');
  };

  const applyPresetGradeOnly = () => {
    setShowStudentCode(true);
    setShowAffective(false);
    setShowPostTest(false);
    setShowAssignment(false);
    setShowMidterm(false);
    setShowFinal(false);
    setShowTotal(true);
    setShowAttendance(true);
    setShowGrade(true);
    toast.success('ใช้รูปแบบผลการเรียนและเวลาเรียน');
  };

  // Count active columns
  const activeColumnsCount = useMemo(() => {
    return [
      showStudentCode, showAffective, showPostTest, showAssignment,
      showMidterm, showFinal, showTotal, showAttendance, showGrade
    ].filter(Boolean).length;
  }, [
    showStudentCode, showAffective, showPostTest, showAssignment,
    showMidterm, showFinal, showTotal, showAttendance, showGrade
  ]);

  // Handle Orientation Change with auto-zoom adjustment
  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    setPaperOrientation(newOrientation);
    if (newOrientation === 'landscape' && zoomLevel >= 80) {
      setZoomLevel(68);
    } else if (newOrientation === 'portrait' && zoomLevel <= 70) {
      setZoomLevel(85);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('grades_pdf_orientation', newOrientation);
    }
    toast.success(newOrientation === 'portrait' ? 'เปลี่ยนเป็น A4 แนวตั้ง' : 'เปลี่ยนเป็น A4 แนวนอน');
  };

  // Initialize and load persisted preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInst = localStorage.getItem('grades_pdf_institution');
      if (savedInst) setInstitutionName(savedInst);

      const savedYear = localStorage.getItem('grades_pdf_academic_year');
      if (savedYear) setAcademicYear(savedYear);

      const savedDept = localStorage.getItem('grades_pdf_department');
      if (savedDept) setDepartmentName(savedDept);

      const savedTeacher = localStorage.getItem('grades_pdf_teacher');
      if (savedTeacher) {
        setTeacherName(savedTeacher);
      } else if (teacherNameDefault) {
        setTeacherName(teacherNameDefault);
      }

      const savedHeadDept = localStorage.getItem('grades_pdf_head_dept');
      if (savedHeadDept) setHeadOfDepartment(savedHeadDept);

      const savedHeadCurr = localStorage.getItem('grades_pdf_head_curr');
      if (savedHeadCurr) setHeadOfCurriculum(savedHeadCurr);

      const savedDeputy = localStorage.getItem('grades_pdf_deputy_dir');
      if (savedDeputy) setDeputyDirector(savedDeputy);

      const savedOrientation = localStorage.getItem('grades_pdf_orientation') as 'portrait' | 'landscape' | null;
      if (savedOrientation === 'portrait' || savedOrientation === 'landscape') {
        setPaperOrientation(savedOrientation);
        if (savedOrientation === 'landscape') setZoomLevel(68);
      }

      const savedCols = localStorage.getItem('grades_pdf_columns');
      if (savedCols) {
        try {
          const parsed = JSON.parse(savedCols);
          if (typeof parsed.studentCode === 'boolean') setShowStudentCode(parsed.studentCode);
          if (typeof parsed.affective === 'boolean') setShowAffective(parsed.affective);
          if (typeof parsed.postTest === 'boolean') setShowPostTest(parsed.postTest);
          if (typeof parsed.assignment === 'boolean') setShowAssignment(parsed.assignment);
          if (typeof parsed.midterm === 'boolean') setShowMidterm(parsed.midterm);
          if (typeof parsed.final === 'boolean') setShowFinal(parsed.final);
          if (typeof parsed.total === 'boolean') setShowTotal(parsed.total);
          if (typeof parsed.attendance === 'boolean') setShowAttendance(parsed.attendance);
          if (typeof parsed.grade === 'boolean') setShowGrade(parsed.grade);
        } catch (e) {
          console.error('Failed to parse grades_pdf_columns', e);
        }
      }
    }
  }, [teacherNameDefault]);

  useEffect(() => {
    if (classroom) {
      setSubjectCodeAndName(classroom.name || '');
      setCurriculumLevel(
        isPws
          ? 'หลักสูตรประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.) 15 สัปดาห์'
          : 'หลักสูตรประกาศนียบัตรวิชาชีพ (ปวช.) 18 สัปดาห์'
      );
    }
  }, [classroom, isPws]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Save changes to localStorage
  const handleSavePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grades_pdf_institution', institutionName);
      localStorage.setItem('grades_pdf_academic_year', academicYear);
      localStorage.setItem('grades_pdf_department', departmentName);
      localStorage.setItem('grades_pdf_teacher', teacherName);
      localStorage.setItem('grades_pdf_head_dept', headOfDepartment);
      localStorage.setItem('grades_pdf_head_curr', headOfCurriculum);
      localStorage.setItem('grades_pdf_deputy_dir', deputyDirector);
      localStorage.setItem('grades_pdf_orientation', paperOrientation);
      localStorage.setItem('grades_pdf_columns', JSON.stringify({
        studentCode: showStudentCode,
        affective: showAffective,
        postTest: showPostTest,
        assignment: showAssignment,
        midterm: showMidterm,
        final: showFinal,
        total: showTotal,
        attendance: showAttendance,
        grade: showGrade,
      }));
      toast.success('บันทึกรูปแบบตั้งต้นเรียบร้อย');
    }
  };

  // Grade Analytics
  const analytics = useMemo(() => {
    const dist: Record<string, number> = {};
    let passCount = 0;
    let failCount = 0;
    let krCount = 0;
    let ksCount = 0;
    let msCount = 0;
    let totalScoreSum = 0;

    report.forEach(s => {
      const g = s.grade || 'ไม่มีเกรด';
      dist[g] = (dist[g] || 0) + 1;
      const score = Number(s.total_score_precise ?? s.total_score ?? 0);
      totalScoreSum += score;

      if (g === 'ข.ร.' || g === 'ขร' || s.is_f) { krCount++; failCount++; }
      else if (g === 'ข.ส.' || s.is_absent_final) { ksCount++; failCount++; }
      else if (g === 'ม.ส.' || s.is_incomplete) { msCount++; failCount++; }
      else if (g === '0' || g === 'F') { failCount++; }
      else { passCount++; }
    });

    const avg = report.length > 0 ? (totalScoreSum / report.length).toFixed(2) : '0.00';
    return { dist, passCount, failCount, krCount, ksCount, msCount, avg };
  }, [report]);

  // Execute Native Print
  // Execute Native Print
  const handlePrint = () => {
    handleSavePreferences();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');
      return;
    }

    const printDateStr = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isLand = paperOrientation === 'landscape';

    printWindow.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>แบบบันทึกผลการเรียน_${subjectCodeAndName.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

    @page {
      size: A4 ${paperOrientation};
      margin: 0 !important;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
    }
    body {
      font-family: 'Sarabun', 'TH Sarabun New', 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.35;
    }
    .print-sheet {
      width: 100%;
      box-sizing: border-box;
      padding: ${isLand ? '8mm 12mm 8mm 12mm' : '10mm 14mm 10mm 14mm'};
    }
    .header-block {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
    }
    .emblem-title {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .emblem-sub {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 3px;
    }
    .emblem-dept {
      font-size: 10pt;
      color: #475569;
    }
    .meta-grid {
      display: table;
      width: 100%;
      margin-bottom: 8px;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .meta-row {
      display: table-row;
    }
    .meta-cell-left {
      display: table-cell;
      width: 58%;
      padding: 1px 0;
      vertical-align: top;
    }
    .meta-cell-right {
      display: table-cell;
      width: 42%;
      padding: 1px 0;
      vertical-align: top;
      text-align: right;
    }
    .strong {
      font-weight: 700;
      color: #0f172a;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 10px;
      font-size: 9pt;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #334155;
      padding: 3.5px 4px;
      text-align: center;
    }
    table.data-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      font-size: 9pt;
    }
    table.data-table th.col-total {
      background-color: #e2e8f0;
    }
    table.data-table td.name {
      text-align: left;
      padding-left: 8px;
    }
    table.data-table td.col-total {
      background-color: #f8fafc;
      font-weight: 700;
    }
    table.data-table td.col-grade {
      font-weight: 800;
    }
    table.data-table tr {
      page-break-inside: avoid;
    }
    table.data-table tr:nth-child(even) {
      background-color: #fafbfc;
    }
    table.data-table tr.kr { background-color: #fee2e2 !important; color: #991b1b; }
    table.data-table tr.ks { background-color: #fef3c7 !important; color: #92400e; }
    table.data-table tr.ms { background-color: #f3e8ff !important; color: #6b21a8; }
    table.data-table tr.fail { background-color: #fff1f2 !important; color: #be123c; }
    .raw-hint {
      font-size: 7.5pt;
      color: #64748b;
      display: block;
      margin-top: 1px;
    }
    .stats-container {
      margin-top: 8px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    table.stats-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 6px;
    }
    table.stats-table th, table.stats-table td {
      border: 1px solid #64748b;
      padding: 3px 5px;
      text-align: center;
    }
    table.stats-table th {
      background-color: #f8fafc;
      font-weight: 700;
      color: #0f172a;
    }
    .signatures-block {
      margin-top: 16px;
      display: table;
      width: 100%;
      page-break-inside: avoid;
    }
    .sig-row {
      display: table-row;
    }
    .sig-cell {
      display: table-cell;
      width: 25%;
      text-align: center;
      vertical-align: top;
      padding: 0 4px;
      font-size: 9pt;
    }
    .sig-line {
      margin-top: 28px;
      border-bottom: 1px dotted #475569;
      width: 82%;
      margin-left: auto;
      margin-right: auto;
      margin-bottom: 4px;
    }
    .sig-name {
      font-weight: 500;
      color: #0f172a;
      margin-top: 2px;
    }
    .sig-title {
      font-size: 8.5pt;
      color: #475569;
      margin-top: 1px;
    }
    .sig-date {
      font-size: 8pt;
      color: #64748b;
      margin-top: 4px;
    }
    .footer-note {
      margin-top: 10px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="print-sheet">
    <div class="header-block">
      <div class="emblem-title">${institutionName}</div>
      <div class="emblem-sub">แบบรายงานและบันทึกผลการเรียนรายวิชา</div>
      <div class="emblem-dept">สังกัดสำนักงานคณะกรรมการการอาชีวศึกษา (สอศ.) กระทรวงศึกษาธิการ</div>
    </div>

    <div class="meta-grid">
      <div class="meta-row">
        <div class="meta-cell-left">
          <div><span class="strong">รายวิชา / ห้องเรียน:</span> ${subjectCodeAndName}</div>
          <div><span class="strong">หลักสูตร:</span> ${curriculumLevel}</div>
          <div><span class="strong">แผนกวิชา:</span> ${departmentName}</div>
        </div>
        <div class="meta-cell-right">
          <div><span class="strong">ภาคเรียน / ปีการศึกษา:</span> ${academicYear}</div>
          <div><span class="strong">ครูผู้สอน:</span> ${teacherName}</div>
          <div><span class="strong">จำนวนผู้เรียนทั้งหมด:</span> ${report.length} คน</div>
        </div>
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 32px;">ลำดับ</th>
          ${showStudentCode ? `<th style="width: 90px;">รหัสนักศึกษา</th>` : ''}
          <th>ชื่อ - สกุล</th>
          ${showAffective ? `<th style="width: 55px;">จิตพิสัย<br>(${weights.affective_weight}%)</th>` : ''}
          ${showPostTest ? `<th style="width: 65px;">สอบย่อย<br>(${weights.post_test_weight}%)</th>` : ''}
          ${showAssignment ? `<th style="width: 65px;">งานเก็บ<br>(${weights.assignment_weight}%)</th>` : ''}
          ${showMidterm ? `<th style="width: 55px;">กลางภาค<br>(${weights.midterm_weight}%)</th>` : ''}
          ${showFinal ? `<th style="width: 55px;">ปลายภาค<br>(${weights.final_weight}%)</th>` : ''}
          ${showTotal ? `<th class="col-total" style="width: 65px;">รวม<br>(100)</th>` : ''}
          ${showAttendance ? `<th style="width: 55px;">เวลาเรียน<br>(%)</th>` : ''}
          ${showGrade ? `<th style="width: 55px;">ผลการเรียน</th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${report.map((s, idx) => {
        const isKr = s.grade === 'ข.ร.' || s.grade === 'ขร' || s.is_f;
        const isKs = s.grade === 'ข.ส.' || s.is_absent_final;
        const isMs = s.grade === 'ม.ส.' || s.is_incomplete;
        const isFail = s.grade === '0' || s.grade === 'F';
        const rowClass = isKr ? 'kr' : isKs ? 'ks' : isMs ? 'ms' : isFail ? 'fail' : '';

        const finalVal = isKs ? 'ข.ส.' : isMs ? 'ม.ส.' : Number(s.precise_scaled_final || s.scaled_final || 0).toFixed(1);
        const totalVal = (isKs || isMs) ? '-' : Number(s.total_score_precise ?? s.total_score ?? 0).toFixed(1);

        const rawAssignHint = showRawScore ? `<span class="raw-hint">(${Number(s.raw_assign || 0).toFixed(0)}/${s.max_assign || (isPws ? 150 : 180)})</span>` : '';
        const rawPostHint = showRawScore ? `<span class="raw-hint">(${Number(s.raw_post_test || 0).toFixed(0)}/${s.max_post_test || (isPws ? 150 : 180)})</span>` : '';

        return `<tr class="${rowClass}">
            <td>${idx + 1}</td>
            ${showStudentCode ? `<td style="font-family: monospace, monospace;">${s.student_code || '-'}</td>` : ''}
            <td class="name">${s.name}</td>
            ${showAffective ? `<td>${Number(s.affective_score || 0).toFixed(1)}</td>` : ''}
            ${showPostTest ? `<td>${Number(s.precise_scaled_post_test || s.scaled_post_test || 0).toFixed(1)}${rawPostHint}</td>` : ''}
            ${showAssignment ? `<td>${Number(s.precise_scaled_assign || s.scaled_assign || 0).toFixed(1)}${rawAssignHint}</td>` : ''}
            ${showMidterm ? `<td>${Number(s.precise_scaled_midterm || s.scaled_midterm || 0).toFixed(1)}</td>` : ''}
            ${showFinal ? `<td>${finalVal}</td>` : ''}
            ${showTotal ? `<td class="col-total">${totalVal}</td>` : ''}
            ${showAttendance ? `<td>${s.attendance_percent ?? 100}%</td>` : ''}
            ${showGrade ? `<td class="col-grade">${s.grade || '-'}</td>` : ''}
          </tr>`;
      }).join('')}
      </tbody>
    </table>

    ${showStats ? `
    <div class="stats-container">
      <div style="font-weight: 700; margin-bottom: 4px; font-size: 9pt; color: #0f172a;">สรุปสถิติผลการประเมินการเรียนรู้:</div>
      <table class="stats-table">
        <thead>
          <tr>
            <th>เกรด</th>
            <th>4</th><th>3.5</th><th>3</th><th>2.5</th><th>2</th><th>1.5</th><th>1</th><th>0</th>
            <th>ข.ร.</th><th>ข.ส.</th><th>ม.ส.</th>
            <th>รวม (คน)</th>
            <th>คะแนนเฉลี่ย</th>
            <th>ร้อยละที่ผ่าน</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 700;">จำนวน</td>
            <td>${analytics.dist['4'] || 0}</td>
            <td>${analytics.dist['3.5'] || 0}</td>
            <td>${analytics.dist['3'] || 0}</td>
            <td>${analytics.dist['2.5'] || 0}</td>
            <td>${analytics.dist['2'] || 0}</td>
            <td>${analytics.dist['1.5'] || 0}</td>
            <td>${analytics.dist['1'] || 0}</td>
            <td>${analytics.dist['0'] || 0}</td>
            <td style="color: #b91c1c; font-weight: 700;">${analytics.krCount}</td>
            <td style="color: #b45309; font-weight: 700;">${analytics.ksCount}</td>
            <td style="color: #7e22ce; font-weight: 700;">${analytics.msCount}</td>
            <td style="font-weight: 700;">${report.length}</td>
            <td style="font-weight: 700; color: #1d4ed8;">${analytics.avg}</td>
            <td style="font-weight: 700; color: #15803d;">${report.length > 0 ? ((analytics.passCount / report.length) * 100).toFixed(1) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    ${(showSignatures && reportType === 'official_vocational') ? `
    <div class="signatures-block">
      <div class="sig-row">
        <div class="sig-cell">
          <div class="sig-line"></div>
          <div class="sig-name">(${teacherName})</div>
          <div class="sig-title">ครูผู้สอน</div>
          <div class="sig-date">วันที่ ...... / ...... / ......</div>
        </div>
        <div class="sig-cell">
          <div class="sig-line"></div>
          <div class="sig-name">(${headOfDepartment})</div>
          <div class="sig-title">หัวหน้าแผนกวิชา</div>
          <div class="sig-date">วันที่ ...... / ...... / ......</div>
        </div>
        <div class="sig-cell">
          <div class="sig-line"></div>
          <div class="sig-name">(${headOfCurriculum})</div>
          <div class="sig-title">หัวหน้างานวัดผลและประเมินผล</div>
          <div class="sig-date">วันที่ ...... / ...... / ......</div>
        </div>
        <div class="sig-cell">
          <div class="sig-line"></div>
          <div class="sig-name">(${deputyDirector})</div>
          <div class="sig-title">รองผู้อำนวยการฝ่ายวิชาการ</div>
          <div class="sig-date">วันที่ ...... / ...... / ......</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${showPrintDate ? `
    <div class="footer-note">
      <span></span>
      <span>วันที่ออกรายงาน: ${printDateStr}</span>
    </div>
    ` : ''}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-50 rounded-2xl shadow-2xl border border-indigo-200 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 shadow-sm">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                พรีวิวและจัดรูปแบบรายงานผลการเรียน PDF
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                  สไตล์ ศธ.02 ออนไลน์
                </span>
              </h2>
              <p className="text-xs text-slate-500">ปรับแต่งข้อมูลหัวรายงาน ลายเซ็น และดูตัวอย่างเอกสาร A4 แบบสด ก่อนสั่งพิมพ์หรือบันทึก PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="btn bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> พิมพ์เอกสาร / บันทึก PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all duration-150 shadow-sm"
              title="ปิดหน้าต่าง (กดกากบาทเพื่อปิด)"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">

          {/* Left Column: Controls & Settings (4 cols on lg) */}
          <div className="lg:col-span-4 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto p-5 space-y-4">

            {/* Setting Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'info' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Building2 className="w-3.5 h-3.5" /> ข้อมูลหัวรายงาน
              </button>
              <button
                onClick={() => setActiveTab('display')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'display' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" /> ตัวเลือกตาราง
              </button>
              <button
                onClick={() => setActiveTab('signatures')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'signatures' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> ช่องลงนาม
              </button>
            </div>

            {/* Tab 1: Info Form */}
            {activeTab === 'info' && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ชื่อสถานศึกษา / วิทยาลัย:</label>
                  <input
                    type="text"
                    value={institutionName}
                    onChange={e => setInstitutionName(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="เช่น วิทยาลัยเทคนิค..., วิทยาลัยอาชีวศึกษา..."
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ภาคเรียน / ปีการศึกษา:</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="เช่น ภาคเรียนที่ 1 ปีการศึกษา 2567"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">รหัสวิชา - ชื่อวิชา:</label>
                  <input
                    type="text"
                    value={subjectCodeAndName}
                    onChange={e => setSubjectCodeAndName(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="รหัสวิชา และชื่อวิชา"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ระดับชั้น / หลักสูตร:</label>
                  <input
                    type="text"
                    value={curriculumLevel}
                    onChange={e => setCurriculumLevel(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="เช่น หลักสูตร ปวช. หรือ ปวส."
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">แผนกวิชา / สาขางาน:</label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={e => setDepartmentName(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="เช่น แผนกวิชาเทคโนโลยีสารสนเทศ"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ชื่อครูผู้สอน:</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="ชื่อ-นามสกุล ครูผู้สอน"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">รูปแบบเอกสาร:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportType('official_vocational')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${reportType === 'official_vocational'
                          ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      <div className="font-bold">ศธ.02 ทางการ</div>
                      <div className="text-[10px] text-slate-500 font-normal">มีหัวหนังสือราชการและช่องลงนาม</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportType('compact_announcement')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${reportType === 'compact_announcement'
                          ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      <div className="font-bold">แบบติดบอร์ด</div>
                      <div className="text-[10px] text-slate-500 font-normal">กระชับ แจ้งคะแนนนักเรียน</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Display Options */}
            {activeTab === 'display' && (
              <div className="space-y-3.5 text-xs">
                {/* Column Selection Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      เลือกคอลัมน์ข้อมูลที่ต้องการแสดง
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      {activeColumnsCount} / 9 คอลัมน์
                    </span>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">ชุดตัวเลือกด่วน (Presets):</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={applyPresetAll}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-medium text-[11px] transition-all text-left flex items-center justify-between shadow-2xs"
                      >
                        <span>🌟 แสดงทั้งหมด</span>
                        <span className="text-[9px] text-slate-400">9/9</span>
                      </button>
                      <button
                        type="button"
                        onClick={applyPresetAnnouncement}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-medium text-[11px] transition-all text-left flex items-center justify-between shadow-2xs"
                      >
                        <span>📋 แบบติดบอร์ด</span>
                        <span className="text-[9px] text-slate-400">3/9</span>
                      </button>
                      <button
                        type="button"
                        onClick={applyPresetContinuous}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-medium text-[11px] transition-all text-left flex items-center justify-between shadow-2xs"
                      >
                        <span>📝 เฉพาะคะแนนเก็บ</span>
                        <span className="text-[9px] text-slate-400">6/9</span>
                      </button>
                      <button
                        type="button"
                        onClick={applyPresetGradeOnly}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-medium text-[11px] transition-all text-left flex items-center justify-between shadow-2xs"
                      >
                        <span>🎓 ผลการเรียน & เวลา</span>
                        <span className="text-[9px] text-slate-400">4/9</span>
                      </button>
                    </div>
                  </div>

                  {/* Individual Checkboxes */}
                  <div className="pt-1.5 border-t border-slate-200/80 space-y-1">
                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showStudentCode}
                          onChange={e => setShowStudentCode(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">รหัสนักศึกษา</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">student_code</span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showAffective}
                          onChange={e => setShowAffective(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">จิตพิสัย</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {weights.affective_weight}%
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showPostTest}
                          onChange={e => setShowPostTest(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">แบบทดสอบ / สอบย่อย</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {weights.post_test_weight}%
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showAssignment}
                          onChange={e => setShowAssignment(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">ภาระงาน / งานเก็บ</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {weights.assignment_weight}%
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showMidterm}
                          onChange={e => setShowMidterm(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">สอบกลางภาค</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {weights.midterm_weight}%
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showFinal}
                          onChange={e => setShowFinal(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">สอบปลายภาค</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {weights.final_weight}%
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showTotal}
                          onChange={e => setShowTotal(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-bold">รวมคะแนน (100)</span>
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        100 คะแนน
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showAttendance}
                          onChange={e => setShowAttendance(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-medium">เวลาเรียน / เข้าเรียน (%)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">% เข้าเรียน</span>
                    </label>

                    <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showGrade}
                          onChange={e => setShowGrade(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 font-bold text-indigo-950">ระดับผลการเรียน (เกรด)</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        เกรด
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 italic">
                    * คอลัมน์ &quot;ลำดับ&quot; และ &quot;ชื่อ - สกุล&quot; จะแสดงเสมอเพื่อระบุตัวตนนักเรียน
                  </div>
                </div>

                {/* Additional Elements */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-700 mb-1">องค์ประกอบเพิ่มเติมในเอกสาร:</div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showRawScore}
                      onChange={e => setShowRawScore(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium">แสดงคะแนนดิบคู่คะแนนสัดส่วน (เช่น ดิบ: 122/150)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showStats}
                      onChange={e => setShowStats(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium">แสดงตารางสรุปสถิติผลการเรียนและร้อยละผ่าน</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSignatures}
                      onChange={e => setShowSignatures(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium">แสดงช่องลงนามรับรองผลการเรียน (4 ตำแหน่ง)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPrintDate}
                      onChange={e => setShowPrintDate(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium">แสดงวันที่ออกรายงานที่ส่วนท้ายเอกสาร</span>
                  </label>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-700">ทิศทางกระดาษ A4:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOrientationChange('portrait')}
                      className={`p-2 rounded-lg border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${paperOrientation === 'portrait' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <span>📄</span> แนวตั้ง (Portrait)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrientationChange('landscape')}
                      className={`p-2 rounded-lg border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${paperOrientation === 'landscape' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <span>📑</span> แนวนอน (Landscape)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Signatures */}
            {activeTab === 'signatures' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-500 text-[11px]">
                  กำหนดรายชื่อผู้ลงนามรับรองผลการประเมินการเรียนรู้ (จะปรากฏในแบบรายงาน ศธ.02 ทางการ):
                </p>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">1. ครูผู้สอน:</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="ชื่อ-นามสกุล ครูผู้สอน"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">2. หัวหน้าแผนกวิชา:</label>
                  <input
                    type="text"
                    value={headOfDepartment}
                    onChange={e => setHeadOfDepartment(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="ชื่อ-นามสกุล หัวหน้าแผนกวิชา"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">3. หัวหน้างานวัดผลและประเมินผล:</label>
                  <input
                    type="text"
                    value={headOfCurriculum}
                    onChange={e => setHeadOfCurriculum(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="ชื่อ-นามสกุล หัวหน้างานวัดผลฯ"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">4. รองผู้อำนวยการฝ่ายวิชาการ:</label>
                  <input
                    type="text"
                    value={deputyDirector}
                    onChange={e => setDeputyDirector(e.target.value)}
                    className="form-input text-xs w-full"
                    placeholder="ชื่อ-นามสกุล รอง ผอ. ฝ่ายวิชาการ"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs w-full flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> บันทึกชื่อผู้ลงนามเป็นค่าเริ่มต้น
                  </button>
                </div>
              </div>
            )}

            {/* Quick Summary Badge */}
            <div className="mt-auto pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>ฐานคะแนนเต็ม: <strong className="text-slate-800">{isPws ? '150' : '180'} คะแนน</strong></span>
              <span>ผู้เรียน: <strong className="text-slate-800">{report.length} คน</strong></span>
            </div>
          </div>

          {/* Right Column: Live A4 Sheet Preview (8 cols on lg) */}
          <div className="lg:col-span-8 bg-slate-200/80 flex flex-col h-full overflow-hidden">

            {/* Preview Toolbar */}
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-slate-700 hidden sm:inline">ทิศทางกระดาษ:</span>
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('portrait')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${paperOrientation === 'portrait'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <span>📄</span>
                    <span>แนวตั้ง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('landscape')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${paperOrientation === 'landscape'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <span>📑</span>
                    <span>แนวนอน</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(40, prev - 10))}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                  title="ลดขนาด"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold w-12 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                  title="เพิ่มขนาด"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(paperOrientation === 'landscape' ? 68 : 85)}
                  className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                  title="รีเซ็ตขนาดพอดี"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated Paper Scrollable Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-slate-200/90">
              <div
                style={{
                  width: paperOrientation === 'portrait' ? `${210 * (zoomLevel / 100)}mm` : `${297 * (zoomLevel / 100)}mm`,
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                className="shrink-0 flex justify-center"
              >
                <div
                  style={{
                    width: paperOrientation === 'portrait' ? '210mm' : '297mm',
                    minHeight: paperOrientation === 'portrait' ? '297mm' : '210mm',
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top center',
                    padding: paperOrientation === 'portrait' ? '12mm 15mm' : '9mm 12mm'
                  }}
                  className="shrink-0 bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 font-sans transition-all duration-300 select-text"
                >
                {/* Printable Content Replica */}
                <div className="text-center border-b-2 border-slate-900 pb-2 mb-3">
                  <div className="text-lg sm:text-xl font-bold text-slate-950 tracking-wide">{institutionName}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    แบบรายงานและบันทึกผลการเรียนรายวิชา
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    สังกัดสำนักงานคณะกรรมการการอาชีวศึกษา (สอศ.) กระทรวงศึกษาธิการ
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="flex justify-between text-[11px] mb-3 text-slate-800 leading-relaxed">
                  <div className="space-y-0.5">
                    <div><span className="font-bold text-slate-950">รายวิชา / ห้องเรียน:</span> {subjectCodeAndName}</div>
                    <div><span className="font-bold text-slate-950">หลักสูตร:</span> {curriculumLevel}</div>
                    <div><span className="font-bold text-slate-950">แผนกวิชา:</span> {departmentName}</div>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <div><span className="font-bold text-slate-950">ภาคเรียน / ปีการศึกษา:</span> {academicYear}</div>
                    <div><span className="font-bold text-slate-950">ครูผู้สอน:</span> {teacherName}</div>
                    <div><span className="font-bold text-slate-950">จำนวนผู้เรียนทั้งหมด:</span> {report.length} คน</div>
                  </div>
                </div>

                {/* Scores Table */}
                <table className="w-full border-collapse border border-slate-600 text-[11px] mb-3">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold">
                      <th className="border border-slate-600 p-1 w-8 text-center">ลำดับ</th>
                      {showStudentCode && <th className="border border-slate-600 p-1 w-24 text-center">รหัสนักศึกษา</th>}
                      <th className="border border-slate-600 p-1 text-left pl-2">ชื่อ - สกุล</th>
                      {showAffective && (
                        <th className="border border-slate-600 p-1 text-center w-14">
                          จิตพิสัย<br /><span className="text-[10px] font-normal">({weights.affective_weight}%)</span>
                        </th>
                      )}
                      {showPostTest && (
                        <th className="border border-slate-600 p-1 text-center w-16">
                          สอบย่อย<br /><span className="text-[10px] font-normal">({weights.post_test_weight}%)</span>
                        </th>
                      )}
                      {showAssignment && (
                        <th className="border border-slate-600 p-1 text-center w-16">
                          งานเก็บ<br /><span className="text-[10px] font-normal">({weights.assignment_weight}%)</span>
                        </th>
                      )}
                      {showMidterm && (
                        <th className="border border-slate-600 p-1 text-center w-14">
                          กลางภาค<br /><span className="text-[10px] font-normal">({weights.midterm_weight}%)</span>
                        </th>
                      )}
                      {showFinal && (
                        <th className="border border-slate-600 p-1 text-center w-14">
                          ปลายภาค<br /><span className="text-[10px] font-normal">({weights.final_weight}%)</span>
                        </th>
                      )}
                      {showTotal && (
                        <th className="border border-slate-600 p-1 text-center w-16 font-extrabold bg-slate-200">
                          รวม<br /><span className="text-[10px] font-normal">(100)</span>
                        </th>
                      )}
                      {showAttendance && (
                        <th className="border border-slate-600 p-1 text-center w-14">
                          เวลาเรียน<br /><span className="text-[10px] font-normal">(%)</span>
                        </th>
                      )}
                      {showGrade && <th className="border border-slate-600 p-1 text-center w-14 font-extrabold">ผลการเรียน</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {report.map((s, idx) => {
                      const isKr = s.grade === 'ข.ร.' || s.grade === 'ขร' || s.is_f;
                      const isKs = s.grade === 'ข.ส.' || s.is_absent_final;
                      const isMs = s.grade === 'ม.ส.' || s.is_incomplete;
                      const isFail = s.grade === '0' || s.grade === 'F';
                      const bgClass = isKr ? 'bg-rose-100/70 text-rose-900 font-bold'
                        : isKs ? 'bg-amber-100/70 text-amber-900 font-bold'
                          : isMs ? 'bg-purple-100/70 text-purple-900 font-bold'
                            : isFail ? 'bg-rose-50 text-rose-800' : '';

                      const finalVal = isKs ? 'ข.ส.' : isMs ? 'ม.ส.' : Number(s.precise_scaled_final || s.scaled_final || 0).toFixed(1);
                      const totalVal = (isKs || isMs) ? '-' : Number(s.total_score_precise ?? s.total_score ?? 0).toFixed(1);

                      return (
                        <tr key={s.student_id} className={`border-b border-slate-400 ${bgClass}`}>
                          <td className="border border-slate-400 p-1 text-center">{idx + 1}</td>
                          {showStudentCode && <td className="border border-slate-400 p-1 text-center font-mono">{s.student_code || '-'}</td>}
                          <td className="border border-slate-400 p-1 pl-2 text-left">{s.name}</td>
                          {showAffective && (
                            <td className="border border-slate-400 p-1 text-center">
                              {Number(s.affective_score || 0).toFixed(1)}
                            </td>
                          )}
                          {showPostTest && (
                            <td className="border border-slate-400 p-1 text-center">
                              {Number(s.precise_scaled_post_test || s.scaled_post_test || 0).toFixed(1)}
                              {showRawScore && (
                                <span className="block text-[9px] text-slate-500">
                                  ({Number(s.raw_post_test || 0).toFixed(0)}/{s.max_post_test || (isPws ? 150 : 180)})
                                </span>
                              )}
                            </td>
                          )}
                          {showAssignment && (
                            <td className="border border-slate-400 p-1 text-center">
                              {Number(s.precise_scaled_assign || s.scaled_assign || 0).toFixed(1)}
                              {showRawScore && (
                                <span className="block text-[9px] text-slate-500">
                                  ({Number(s.raw_assign || 0).toFixed(0)}/{s.max_assign || (isPws ? 150 : 180)})
                                </span>
                              )}
                            </td>
                          )}
                          {showMidterm && (
                            <td className="border border-slate-400 p-1 text-center">
                              {Number(s.precise_scaled_midterm || s.scaled_midterm || 0).toFixed(1)}
                            </td>
                          )}
                          {showFinal && <td className="border border-slate-400 p-1 text-center">{finalVal}</td>}
                          {showTotal && (
                            <td className="border border-slate-400 p-1 text-center font-bold bg-slate-50">
                              {totalVal}
                            </td>
                          )}
                          {showAttendance && <td className="border border-slate-400 p-1 text-center">{s.attendance_percent ?? 100}%</td>}
                          {showGrade && <td className="border border-slate-400 p-1 text-center font-extrabold text-slate-950">{s.grade || '-'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Stats Table */}
                {showStats && (
                  <div className="mb-4">
                    <div className="font-bold text-xs text-slate-800 mb-1">สรุปสถิติผลการประเมินการเรียนรู้:</div>
                    <table className="w-full border-collapse border border-slate-400 text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold">
                          <th className="border border-slate-400 p-1">เกรด</th>
                          <th className="border border-slate-400 p-1">4</th>
                          <th className="border border-slate-400 p-1">3.5</th>
                          <th className="border border-slate-400 p-1">3</th>
                          <th className="border border-slate-400 p-1">2.5</th>
                          <th className="border border-slate-400 p-1">2</th>
                          <th className="border border-slate-400 p-1">1.5</th>
                          <th className="border border-slate-400 p-1">1</th>
                          <th className="border border-slate-400 p-1">0</th>
                          <th className="border border-slate-400 p-1 text-rose-800">ข.ร.</th>
                          <th className="border border-slate-400 p-1 text-amber-800">ข.ส.</th>
                          <th className="border border-slate-400 p-1 text-purple-800">ม.ส.</th>
                          <th className="border border-slate-400 p-1">รวม (คน)</th>
                          <th className="border border-slate-400 p-1 text-blue-900">คะแนนเฉลี่ย</th>
                          <th className="border border-slate-400 p-1 text-emerald-800">ร้อยละที่ผ่าน</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center font-medium">
                          <td className="border border-slate-400 p-1 font-bold">จำนวน</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['4'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['3.5'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['3'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['2.5'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['2'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['1.5'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['1'] || 0}</td>
                          <td className="border border-slate-400 p-1">{analytics.dist['0'] || 0}</td>
                          <td className="border border-slate-400 p-1 font-bold text-rose-700">{analytics.krCount}</td>
                          <td className="border border-slate-400 p-1 font-bold text-amber-700">{analytics.ksCount}</td>
                          <td className="border border-slate-400 p-1 font-bold text-purple-700">{analytics.msCount}</td>
                          <td className="border border-slate-400 p-1 font-bold">{report.length}</td>
                          <td className="border border-slate-400 p-1 font-bold text-blue-800">{analytics.avg}</td>
                          <td className="border border-slate-400 p-1 font-bold text-emerald-700">
                            {report.length > 0 ? ((analytics.passCount / report.length) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures */}
                {showSignatures && reportType === 'official_vocational' && (
                  <div className="grid grid-cols-4 gap-2 text-center text-xs mt-6 pt-2">
                    <div className="space-y-1">
                      <div>ลงชื่อ ..........................................</div>
                      <div className="font-medium text-slate-900">({teacherName})</div>
                      <div className="text-[10px] text-slate-600">ครูผู้สอน</div>
                      <div className="text-[9px] text-slate-400 mt-1">วันที่ ...... / ...... / ......</div>
                    </div>
                    <div className="space-y-1">
                      <div>ลงชื่อ ..........................................</div>
                      <div className="font-medium text-slate-900">({headOfDepartment})</div>
                      <div className="text-[10px] text-slate-600">หัวหน้าแผนกวิชา</div>
                      <div className="text-[9px] text-slate-400 mt-1">วันที่ ...... / ...... / ......</div>
                    </div>
                    <div className="space-y-1">
                      <div>ลงชื่อ ..........................................</div>
                      <div className="font-medium text-slate-900">({headOfCurriculum})</div>
                      <div className="text-[10px] text-slate-600">หัวหน้างานวัดผลและประเมินผล</div>
                      <div className="text-[9px] text-slate-400 mt-1">วันที่ ...... / ...... / ......</div>
                    </div>
                    <div className="space-y-1">
                      <div>ลงชื่อ ..........................................</div>
                      <div className="font-medium text-slate-900">({deputyDirector})</div>
                      <div className="text-[10px] text-slate-600">รองผู้อำนวยการฝ่ายวิชาการ</div>
                      <div className="text-[9px] text-slate-400 mt-1">วันที่ ...... / ...... / ......</div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {showPrintDate && (
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-6 pt-2 border-t border-slate-200">
                    <span></span>
                    <span>วันที่ออกรายงาน: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
