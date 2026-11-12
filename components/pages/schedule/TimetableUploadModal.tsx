'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, AlertCircle, UploadCloud, FileText, Download,
  FileSpreadsheet, Sparkles, CheckCircle2, Info,
} from 'lucide-react';
import toast from '@/lib/toast';

interface TimetableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function TimetableUploadModal({
  isOpen,
  onClose,
  uploadFile,
  setUploadFile,
  uploading,
  onSubmit,
}: TimetableUploadModalProps) {
  const [exampleTab, setExampleTab] = useState<'csv' | 'ai'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = '\uFEFF' + [
      'วัน,คาบเริ่ม,คาบสิ้นสุด,รหัสวิชา,ชื่อวิชา,ห้อง,กลุ่ม,ประเภท,อาจารย์',
      'จันทร์,1,1,20000-1101,กิจกรรมหน้าเสาธงและโฮมรูม,หน้าเสาธง,ปวช.1/1,โฮมรูม,ครูที่ปรึกษา',
      'จันทร์,2,4,20001-1005,การใช้คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ,734,ปวช.1/1,ปฏิบัติ,อ.xxxx',
      'จันทร์,5,8,21909-2011,การเขียนโปรแกรมเชิงวัตถุ,735,ปวช.2/1,ปฏิบัติ,อ.ณัฐนันท์',
      'อังคาร,2,4,30001-1003,การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ,745,ปวส.1/6,ทฤษฎี,อ.xxxx',
      'พุธ,2,4,30901-1001,การพัฒนาเว็บแอปพลิเคชัน,ห้องคอมฯ ต้นแบบ 2,ปวส.2/2,ปฏิบัติ,อ.xxxx',
      'พุธ,5,6,20000-2001,กิจกรรมลูกเสือวิสามัญ 1,โดม,ชค.1/1,กิจกรรม,อ.สมชาย',
      'พฤหัสบดี,1,4,20901-2002,ระบบเครือข่ายคอมพิวเตอร์เบื้องต้น,LAB-1,ชค.2/1,ปฏิบัติ,อ.xxxx',
      'ศุกร์,2,4,20000-1201,ภาษาอังกฤษเพื่อการสื่อสารในงานอาชีพ,421,ชฟ.2/1,ทฤษฎี,Teacher xxx',
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'เทมเพลต_ตารางสอน.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('ดาวน์โหลดไฟล์ตัวอย่าง CSV สำเร็จ');
  };

  const handleDownloadExcelTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['วัน', 'คาบเริ่ม', 'คาบสิ้นสุด', 'รหัสวิชา', 'ชื่อวิชา', 'ห้อง', 'กลุ่ม', 'ประเภท', 'อาจารย์'];
      const rows = [
        ['จันทร์', 1, 1, '20000-1101', 'กิจกรรมหน้าเสาธงและโฮมรูม', 'หน้าเสาธง', 'ปวช.1/1', 'โฮมรูม', 'ครูที่ปรึกษา'],
        ['จันทร์', 2, 4, '20001-1005', 'การใช้คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ', '734', 'ปวช.1/1', 'ปฏิบัติ', 'อ.xxxx'],
        ['จันทร์', 5, 8, '21909-2011', 'การเขียนโปรแกรมเชิงวัตถุ', '735', 'ปวช.2/1', 'ปฏิบัติ', 'อ.ณัฐนันท์'],
        ['อังคาร', 2, 4, '30001-1003', 'การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ', '745', 'ปวส.1/6', 'ทฤษฎี', 'อ.xxxx'],
        ['พุธ', 2, 4, '30901-1001', 'การพัฒนาเว็บแอปพลิเคชัน', 'ห้องคอมฯ ต้นแบบ 2', 'ปวส.2/2', 'ปฏิบัติ', 'อ.xxxx'],
        ['พุธ', 5, 6, '20000-2001', 'กิจกรรมลูกเสือวิสามัญ 1', 'โดม', 'ชค.1/1', 'กิจกรรม', 'อ.สมชาย'],
        ['พฤหัสบดี,1,4'.split(',')[0], 1, 4, '20901-2002', 'ระบบเครือข่ายคอมพิวเตอร์เบื้องต้น', 'LAB-1', 'ชค.2/1', 'ปฏิบัติ', 'อ.xxxx'],
        ['ศุกร์', 2, 4, '20000-1201', 'ภาษาอังกฤษเพื่อการสื่อสารในงานอาชีพ', '421', 'ชฟ.2/1', 'ทฤษฎี', 'Teacher xxx'],
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
        { wch: 38 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'ตารางสอน');
      XLSX.writeFile(wb, 'เทมเพลต_ตารางสอน.xlsx');
      toast.success('ดาวน์โหลดไฟล์ตัวอย่าง Excel สำเร็จ');
    } catch (err) {
      console.error(err);
      toast.error('ดาวน์โหลดไฟล์ตัวอย่าง Excel ไม่สำเร็จ');
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl p-6 sm:p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-indigo-50/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800">อัพโหลดตารางสอน & ตัวอย่างรูปแบบไฟล์</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ตรวจสอบตัวอย่างรูปแบบไฟล์ที่ระบบรองรับ ดาวน์โหลดเทมเพลต หรืออัพโหลดไฟล์เพื่อสร้างตารางสอน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guide Tabs & Download Buttons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex bg-slate-100/90 p-1 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setExampleTab('csv')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exampleTab === 'csv'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ตัวอย่างไฟล์ CSV / Excel (แนะนำ)</span>
              </button>
              <button
                type="button"
                onClick={() => setExampleTab('ai')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exampleTab === 'ai'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>ตัวอย่างรูปภาพ & PDF (AI)</span>
              </button>
            </div>

            {exampleTab === 'csv' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="btn bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  title="ดาวน์โหลดไฟล์ตัวอย่าง .csv สำหรับเปิดใน Excel หรือโปรแกรมสเปรดชีต"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ดาวน์โหลดตัวอย่าง CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="btn bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  title="ดาวน์โหลดไฟล์ตัวอย่าง .xlsx พร้อมตารางและสูตร"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ดาวน์โหลดตัวอย่าง Excel</span>
                </button>
              </div>
            )}
          </div>

          {exampleTab === 'csv' ? (
            <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 p-4 rounded-2xl border border-indigo-100/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-indigo-900">โครงสร้างคอลัมน์ที่ระบบรองรับ (Header)</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      แม่นยำ 100%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    แถวแรกต้องเป็นชื่อคอลัมน์ (รองรับทั้งภาษาไทยและอังกฤษ: วัน, คาบเริ่ม, คาบสิ้นสุด, รหัสวิชา, ชื่อวิชา, ห้อง, กลุ่ม, ประเภท, อาจารย์)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs max-h-48 custom-scrollbar">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-50/80 border-b border-indigo-100 text-slate-700 font-bold">
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">วัน</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap text-center">คาบเริ่ม</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap text-center">คาบสิ้นสุด</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">รหัสวิชา</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap min-w-[160px]">ชื่อวิชา</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">ห้อง</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">กลุ่ม</th>
                      <th className="p-2 border-r border-indigo-100/60 whitespace-nowrap">ประเภท</th>
                      <th className="p-2 whitespace-nowrap">อาจารย์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    <tr className="hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">จันทร์</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">1</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">1</td>
                      <td className="p-2 border-r border-slate-100 font-mono text-slate-500">20000-1101</td>
                      <td className="p-2 border-r border-slate-100">กิจกรรมหน้าเสาธงและโฮมรูม</td>
                      <td className="p-2 border-r border-slate-100">หน้าเสาธง</td>
                      <td className="p-2 border-r border-slate-100">ปวช.1/1</td>
                      <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold">โฮมรูม</span></td>
                      <td className="p-2 text-slate-500">ครูที่ปรึกษา</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">จันทร์</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">2</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">4</td>
                      <td className="p-2 border-r border-slate-100 font-mono font-bold text-slate-800">20001-1005</td>
                      <td className="p-2 border-r border-slate-100">การใช้คอมพิวเตอร์และสารสนเทศฯ</td>
                      <td className="p-2 border-r border-slate-100">734</td>
                      <td className="p-2 border-r border-slate-100">ปวช.1/1</td>
                      <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">ปฏิบัติ</span></td>
                      <td className="p-2 text-slate-500">อ.xxxx</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">อังคาร</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">2</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">4</td>
                      <td className="p-2 border-r border-slate-100 font-mono font-bold text-slate-800">30001-1003</td>
                      <td className="p-2 border-r border-slate-100">การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ</td>
                      <td className="p-2 border-r border-slate-100">745</td>
                      <td className="p-2 border-r border-slate-100">ปวส.1/6</td>
                      <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">ทฤษฎี</span></td>
                      <td className="p-2 text-slate-500">อ.xxxx</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-100 font-bold text-indigo-700">พุธ</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">5</td>
                      <td className="p-2 border-r border-slate-100 text-center font-mono">6</td>
                      <td className="p-2 border-r border-slate-100 font-mono text-slate-500">20000-2001</td>
                      <td className="p-2 border-r border-slate-100">กิจกรรมลูกเสือวิสามัญ 1</td>
                      <td className="p-2 border-r border-slate-100">โดม</td>
                      <td className="p-2 border-r border-slate-100">ชค.1/1</td>
                      <td className="p-2 border-r border-slate-100"><span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">กิจกรรม</span></td>
                      <td className="p-2 text-slate-500">อ.สมชาย</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-purple-50/70 via-indigo-50/50 to-pink-50/40 p-4 rounded-2xl border border-purple-100/80 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-purple-900">รูปแบบตารางสอนที่ AI (Gemini) ถอดความได้ดีที่สุด</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  OCR & AI วิเคราะห์
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white/90 rounded-xl border border-purple-100/90 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ตารางสอนรายสัปดาห์ / ตารางครูผู้สอน</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ตารางมาตรฐานจากระบบ ศธ.02, RMS หรือแบบฟอร์มวิทยาลัย ที่มีแถววัน (จันทร์-ศุกร์) และคาบเวลา (1-10) ชัดเจน
                  </p>
                </div>

                <div className="p-3 bg-white/90 rounded-xl border border-purple-100/90 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>มีรหัสวิชาและชื่อห้องเรียนระบุ</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ควรมีรหัสวิชา 5 หลักหรือ 5 หลักขีด 4 หลัก (เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">30001-1003</code>) และกลุ่มเรียน เพื่อให้ AI จัดกลุ่มวิชาได้อัตโนมัติ
                  </p>
                </div>
              </div>

              <div className="bg-amber-50/90 p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>เคล็ดลับ:</strong> ถ่ายรูปให้ตรง แสงสว่างเพียงพอ ไม่เบลอ ไม่เอียง และครอบตัดให้เห็นเฉพาะตารางสอนเพื่อความแม่นยำสูงสุด
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Upload Form */}
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition-all cursor-pointer ${
              uploadFile
                ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-200/50'
                : 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {uploadFile ? 'เปลี่ยนไฟล์ที่เลือก' : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              รองรับไฟล์ภาพ <strong className="text-slate-700">.JPG, .PNG</strong>, เอกสาร <strong className="text-slate-700">.PDF</strong>, และตาราง <strong className="text-slate-700">.CSV, .XLSX</strong> (สูงสุด 5MB)
            </p>

            {uploadFile && (
              <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-900 text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="truncate max-w-[260px] sm:max-w-md">{uploadFile.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-red-500 ml-1 p-0.5"
                  title="ล้างไฟล์ที่เลือก"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.csv,.pdf,.xlsx,.xls,application/pdf,text/csv,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200/80 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-900 font-medium leading-tight">
              การอัพโหลดตารางสอนใหม่จะแทนที่ข้อมูลตารางเรียนเดิมทั้งหมดในระบบ
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all text-xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadFile}
              className="btn btn-primary flex-1 py-2.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังให้ AI ประมวลผลตารางเรียน (อาจใช้เวลาสักครู่)...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>อัพโหลดและสร้างตารางสอน</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

