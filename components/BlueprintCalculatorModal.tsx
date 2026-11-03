'use client';

import { Calculator, CheckCircle2 } from 'lucide-react';

export interface BlueprintCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  curriculumWeeks: number;
  setCurriculumWeeks: (weeks: number) => void;
  hasMidterm: boolean;
  setHasMidterm: (has: boolean) => void;
  scoreScaleMode: 'standard_10' | 'direct_weight';
  setScoreScaleMode: (mode: 'standard_10' | 'direct_weight') => void;
  standardWeeklyBaseScore: number;
  setStandardWeeklyBaseScore: (score: number) => void;
  totalAcademicScore: number;
  setTotalAcademicScore: (score: number) => void;
  theoryHoursPerWeek: number;
  setTheoryHoursPerWeek: (hours: number) => void;
  practiceHoursPerWeek: number;
  setPracticeHoursPerWeek: (hours: number) => void;
  onCalculate: (teachingWeeks: number, hasMidtermExam: boolean) => void;
}

export default function BlueprintCalculatorModal({
  isOpen,
  onClose,
  curriculumWeeks,
  setCurriculumWeeks,
  hasMidterm,
  setHasMidterm,
  scoreScaleMode,
  setScoreScaleMode,
  standardWeeklyBaseScore,
  setStandardWeeklyBaseScore,
  totalAcademicScore,
  setTotalAcademicScore,
  theoryHoursPerWeek,
  setTheoryHoursPerWeek,
  practiceHoursPerWeek,
  setPracticeHoursPerWeek,
  onCalculate,
}: BlueprintCalculatorModalProps) {
  if (!isOpen) return null;

  const isPws = curriculumWeeks === 15;
  // ปวส: 14 สัปดาห์เรียน (W1–W14) + สอบปลายภาคสัปดาห์ที่ 15
  // ปวช: 17 สัปดาห์เรียน (W1–W17) + สอบปลายภาคสัปดาห์ที่ 18
  const teachingWeeks = isPws ? 14 : 17;
  const effectiveHasMidterm = isPws ? false : hasMidterm;

  const contactHours = (Number(theoryHoursPerWeek) || 0) + (Number(practiceHoursPerWeek) || 0);
  const tRatio = contactHours > 0 ? (Number(theoryHoursPerWeek) || 0) / contactHours : 0;
  const pRatio = contactHours > 0 ? (Number(practiceHoursPerWeek) || 0) / contactHours : 0;
  const tPct = Math.round(tRatio * 1000) / 10;
  const pPct = Math.round(pRatio * 1000) / 10;

  // Preview values based on scoreScaleMode
  let previewAssign = 10;
  let previewPostTest = 10;
  if (pRatio > tRatio) {
    previewAssign = standardWeeklyBaseScore;
    previewPostTest = Math.max(1, Math.round(standardWeeklyBaseScore * (tRatio / pRatio)));
  } else if (tRatio > pRatio) {
    previewPostTest = standardWeeklyBaseScore;
    previewAssign = Math.max(1, Math.round(standardWeeklyBaseScore * (pRatio / tRatio)));
  }
  const totalWeeklyStandard = previewAssign + previewPostTest;
  const totalTermRawStandard = totalWeeklyStandard * teachingWeeks;

  const directSkillTotal = Math.round((Number(totalAcademicScore) || 0) * pRatio);
  const directTestTotal = (Number(totalAcademicScore) || 0) - directSkillTotal;
  const directAvgAssign = Math.round((directSkillTotal / teachingWeeks) * 10) / 10;
  const directAvgTest = Math.round((directTestTotal / teachingWeeks) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-indigo-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
            คำนวณสัดส่วนคะแนนอัตโนมัติ (Test Blueprint)
          </h3>
        </div>
        <p className="text-slate-600 mb-4 text-xs">
          กำหนดสัดส่วนชั่วโมงและคำนวณคะแนนเต็มของงานเก็บและสอบย่อยให้สอดคล้องกับหลักสูตร ปวช. และ ปวส.
        </p>

        <div className="space-y-4 mb-5">
          {/* 1. เลือกระดับหลักสูตร (ปวช. 18 สัปดาห์ vs ปวส. 15 สัปดาห์) */}
          <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">เลือกระดับหลักสูตร:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurriculumWeeks(18)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    curriculumWeeks === 18
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ปวช. (18 สัปดาห์)
                </button>
                <button
                  type="button"
                  onClick={() => setCurriculumWeeks(15)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    curriculumWeeks === 15
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ปวส. (15 สัปดาห์)
                </button>
              </div>
            </div>
          </div>

          {/* 1.1 เงื่อนไขสอบกลางภาค (เฉพาะ ปวช.) หรือ แจ้งเตือน ปวส. */}
          {isPws ? (
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs flex items-center gap-2">
              <span className="font-bold text-indigo-700">📌 ปวส. (15 สัปดาห์):</span>
              <span>ไม่มีสอบกลางภาค — เรียนเก็บงาน 14 สัปดาห์ (W1–W14) และสัปดาห์ที่ 15 เป็นสอบปลายภาค</span>
            </div>
          ) : (
            <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-cyan-950">การสอบกลางภาค (สำหรับ ปวช.):</span>
                  <p className="text-[11px] text-cyan-800">เลือกรูปแบบตามแผนการสอนของวิชานี้</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHasMidterm(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      hasMidterm
                        ? 'bg-cyan-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-cyan-50'
                    }`}
                  >
                    มีสอบกลางภาค (W9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasMidterm(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !hasMidterm
                        ? 'bg-cyan-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-cyan-50'
                    }`}
                  >
                    ไม่มีสอบกลางภาค
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-cyan-700 border-t border-cyan-100 pt-1">
                {hasMidterm
                  ? '✓ มีช่องสอบกลางภาค (W9) และมีช่องเก็บงาน W1-W17 โดยสัปดาห์ที่ 18 เป็นสอบปลายภาค'
                  : '✓ ปิดช่องสอบกลางภาค และเก็บงานต่อเนื่อง W1-W17 โดยสัปดาห์ที่ 18 เป็นสอบปลายภาค'}
              </p>
            </div>
          )}

          {/* 2. เลือกรูปแบบคะแนนเต็ม */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              รูปแบบคะแนนเต็มรายสัปดาห์
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScoreScaleMode('standard_10')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  scoreScaleMode === 'standard_10'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>คะแนนเต็มมาตรฐาน</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                    แนะนำ
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  เต็ม 5-10 ตรวจง่าย ระบบจะทอนคะแนนตามน้ำหนัก {totalAcademicScore} คะแนนในหน้าตัดเกรดอัตโนมัติ
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScoreScaleMode('direct_weight')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  scoreScaleMode === 'direct_weight'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">เกลี่ยตามค่าน้ำหนักรวม</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  หารคะแนนรวม {totalAcademicScore} เฉลี่ย {teachingWeeks} สัปดาห์เรียน
                </p>
              </button>
            </div>
          </div>

          {/* ถ้าเลือกโหมดมาตรฐาน สามารถเลือกฐานคะแนนเต็มได้ */}
          {scoreScaleMode === 'standard_10' ? (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-700">ฐานคะแนนเต็มต่อช่องงานเก็บ:</span>
              <div className="flex gap-1.5">
                {[5, 10, 20].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setStandardWeeklyBaseScore(pts)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                      standardWeeklyBaseScore === pts
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    เต็ม {pts}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="form-label text-slate-800 text-xs font-semibold mb-0">
                  คะแนนวิชาการรวม (งานเก็บ + สอบย่อย)
                </label>
                <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                  ค่าน้ำหนักวิชา: {totalAcademicScore} คะแนน
                </span>
              </div>
              <input
                type="number"
                value={totalAcademicScore}
                onChange={(e) => setTotalAcademicScore(parseFloat(e.target.value) || 0)}
                className="form-input text-lg font-bold text-slate-800"
              />
            </div>
          )}

          {/* 3. สัดส่วนชั่วโมงเรียน (ท-ป-น) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-700">สัดส่วนชั่วโมงเรียนตามหลักสูตร (ท-ป-น)</span>
              <span className="text-[11px] text-slate-500">พรีเซ็ตด่วน:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                { label: '1-2-2 (3 ชม.)', t: 1, p: 2 },
                { label: '2-2-3 (4 ชม.)', t: 2, p: 2 },
                { label: '2-0-2 (2 ชม.)', t: 2, p: 0 },
                { label: '1-4-3 (5 ชม.)', t: 1, p: 4 },
                { label: '3-0-3 (3 ชม.)', t: 3, p: 0 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTheoryHoursPerWeek(preset.t);
                    setPracticeHoursPerWeek(preset.p);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    theoryHoursPerWeek === preset.t && practiceHoursPerWeek === preset.p
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                <label className="block text-xs font-semibold text-amber-800 mb-1">ทฤษฎี ชม./สัปดาห์</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={theoryHoursPerWeek}
                  onChange={(e) => setTheoryHoursPerWeek(parseFloat(e.target.value) || 0)}
                  className="form-input text-lg text-center font-bold text-amber-700 bg-white border-amber-300"
                />
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <label className="block text-xs font-semibold text-emerald-800 mb-1">ปฏิบัติ ชม./สัปดาห์</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={practiceHoursPerWeek}
                  onChange={(e) => setPracticeHoursPerWeek(parseFloat(e.target.value) || 0)}
                  className="form-input text-lg text-center font-bold text-emerald-700 bg-white border-emerald-300"
                />
              </div>
            </div>
          </div>

          {/* Real-time Preview Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
              <span>
                ผลลัพธ์ที่จะบันทึกลงตาราง ({isPws ? 'ปวส. 14 สัปดาห์เรียน' : `ปวช. ${teachingWeeks} สัปดาห์เรียน`})
              </span>
              <span className="text-slate-500 font-normal">รวม {contactHours} ชม./สัปดาห์</span>
            </div>

            {/* Dual color progress bar */}
            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex mb-2.5 shadow-inner">
              <div
                style={{ width: `${tPct}%` }}
                className="bg-amber-500 h-full transition-all duration-300"
                title={`ทฤษฎี ${tPct}%`}
              />
              <div
                style={{ width: `${pPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`ปฏิบัติ ${pPct}%`}
              />
            </div>

            {scoreScaleMode === 'standard_10' ? (
              <div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200">
                    <div className="text-amber-800 font-medium">สอบย่อย (ทฤษฎี)</div>
                    <div className="text-sm font-bold text-amber-900 mt-0.5">
                      เต็ม {previewPostTest} คะแนน/สัปดาห์
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-200">
                    <div className="text-emerald-800 font-medium">งานเก็บ (ปฏิบัติ)</div>
                    <div className="text-sm font-bold text-emerald-900 mt-0.5">
                      เต็ม {previewAssign} คะแนน/สัปดาห์
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                  <span>✨</span>
                  <span>
                    คะแนนดิบรวม {totalTermRawStandard} คะแนน ({teachingWeeks} สัปดาห์) — สัปดาห์สุดท้ายแยกเป็นช่องสอบปลายภาค
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200">
                    <div className="text-amber-800 font-medium">สอบย่อย (ทฤษฎี)</div>
                    <div className="text-sm font-bold text-amber-900 mt-0.5">
                      รวม {directTestTotal} คะแนน (~{directAvgTest}/สัปดาห์)
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-200">
                    <div className="text-emerald-800 font-medium">งานเก็บ (ปฏิบัติ)</div>
                    <div className="text-sm font-bold text-emerald-900 mt-0.5">
                      รวม {directSkillTotal} คะแนน (~{directAvgAssign}/สัปดาห์)
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  * คะแนนเฉลี่ยต่อสัปดาห์จะเกลี่ยให้ {teachingWeeks} สัปดาห์เรียน เท่ากับ {totalAcademicScore} คะแนนพอดี
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onCalculate(teachingWeeks, effectiveHasMidterm)}
            className="btn btn-primary text-xs px-5 flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            คำนวณและนำลงตาราง ({teachingWeeks} สัปดาห์เรียน + ปลายภาค)
          </button>
        </div>
      </div>
    </div>
  );
}
