'use client';

import { Calculator, Upload, Save, Loader2 } from 'lucide-react';
import type { ScoreStructure } from './types';

interface ScoreBlueprintSettingsTabProps {
  structures: ScoreStructure[];
  setStructures: (structs: ScoreStructure[]) => void;
  setCurriculumWeeks: (weeks: number) => void;
  isPws: boolean;
  saving: boolean;
  onOpenCalculator: () => void;
  onOpenExcelImportModal: () => void;
  onSaveStructure: () => void;
  onStructureChange: (index: number, field: keyof ScoreStructure, value: string | number) => void;
}

export default function ScoreBlueprintSettingsTab({
  structures,
  setStructures,
  setCurriculumWeeks,
  isPws,
  saving,
  onOpenCalculator,
  onOpenExcelImportModal,
  onSaveStructure,
  onStructureChange,
}: ScoreBlueprintSettingsTabProps) {
  return (
    <div className="glass rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
      <div className="p-5 border-b border-indigo-100 flex flex-col lg:flex-row items-center justify-between gap-4 bg-indigo-50/60">
        <div>
          <h2 className="text-lg font-bold text-slate-800">ตารางน้ำหนักคะแนนเต็ม (Test Blueprint)</h2>
          <p className="text-sm text-slate-600">
            กำหนดคะแนนเต็มของงานเก็บและสอบย่อยในแต่ละบทเรียน ({structures.length} สัปดาห์เรียน — {isPws ? 'หลักสูตร ปวส. (W1-W14 + ปลายภาค)' : 'หลักสูตร ปวช. (W1-W17 + ปลายภาค)'})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border border-indigo-200 rounded-lg p-0.5 text-xs shadow-sm">
            <button
              type="button"
              onClick={() => {
                if (structures.length !== 17) {
                  const diff = 17 - structures.length;
                  if (diff > 0) {
                    const padding = Array.from({ length: diff }, (_, i) => ({
                      lesson_number: structures.length + 1 + i,
                      lesson_name: `บทที่/สัปดาห์ที่ ${structures.length + 1 + i}`,
                      max_assignment_score: 10,
                      max_post_test_score: 10,
                      hours: 4,
                    }));
                    setStructures([...structures, ...padding]);
                  } else {
                    setStructures(structures.slice(0, 17));
                  }
                  setCurriculumWeeks(18);
                }
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                structures.length === 17 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              ปวช. (17 สัปดาห์เรียน)
            </button>
            <button
              type="button"
              onClick={() => {
                if (structures.length !== 14) {
                  setStructures(structures.slice(0, 14));
                  setCurriculumWeeks(15);
                }
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                structures.length === 14 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              ปวส. (14 สัปดาห์เรียน)
            </button>
          </div>
          <button
            onClick={onOpenCalculator}
            className="btn bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-200 flex items-center gap-2 text-xs"
          >
            <Calculator className="w-4 h-4" />
            คำนวณสัดส่วนอัตโนมัติ
          </button>
          <button
            type="button"
            onClick={onOpenExcelImportModal}
            className="btn bg-indigo-100 hover:bg-indigo-200 text-indigo-700 cursor-pointer flex items-center gap-2 text-xs font-semibold shadow-xs"
            title="เปิดหน้าต่างนำเข้า Blueprint พร้อมดูตัวอย่างรูปแบบและดาวน์โหลดเทมเพลต"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>นำเข้า Blueprint & ตัวอย่างไฟล์</span>
          </button>
          <button onClick={onSaveStructure} disabled={saving} className="btn btn-primary flex items-center gap-2 text-xs">
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
                    onChange={e => onStructureChange(index, 'lesson_name', e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 w-full text-slate-800 outline-none focus:border-indigo-500 text-sm"
                    placeholder="เช่น บทที่ 1 การประมวลผลคำ..."
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={struct.hours || ''}
                    onChange={e => onStructureChange(index, 'hours', e.target.value)}
                    className="bg-indigo-50/50 border border-blue-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-blue-500 font-semibold text-sm"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={struct.max_assignment_score}
                    onChange={e => onStructureChange(index, 'max_assignment_score', e.target.value)}
                    className="bg-white border border-emerald-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-emerald-500 font-bold text-sm"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={struct.max_post_test_score}
                    onChange={e => onStructureChange(index, 'max_post_test_score', e.target.value)}
                    className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 w-full text-center text-slate-800 outline-none focus:border-amber-500 font-bold text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

