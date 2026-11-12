/**
 * Centralized Grade & Score Calculation Engine (เกณฑ์ สอศ.)
 *
 * Single source of truth for:
 * - Resolving exam status (`normal`, `absent_final` / ข.ส., `incomplete` / ม.ส.)
 *   with backward compatibility for legacy `-1` and `-2` values
 * - Extracting classroom score weights & deductions
 * - Calculating scaled scores, affective score, total score, percentage, and final grade
 *
 * Shared across `/api/grades`, `/api/line/webhook`, `/api/portal/student`, and Frontend UI.
 */

import { calculateAffectiveScore } from '@/lib/affective';

export type ExamStatusType = 'normal' | 'absent_final' | 'incomplete';

export interface GradeCriterionItem {
  grade: string;
  minScore: number;
}

export const DEFAULT_GRADE_CRITERIA: GradeCriterionItem[] = [
  { grade: '4', minScore: 80 },
  { grade: '3.5', minScore: 75 },
  { grade: '3', minScore: 70 },
  { grade: '2.5', minScore: 65 },
  { grade: '2', minScore: 60 },
  { grade: '1.5', minScore: 55 },
  { grade: '1', minScore: 50 },
  { grade: '0', minScore: 0 },
];

export interface ClassroomWeights {
  assignmentWeight: number;
  postTestWeight: number;
  affectiveWeight: number;
  midtermWeight: number;
  finalWeight: number;
  midtermMaxScore: number;
  finalMaxScore: number;
  lateDeductionScore: number;
  absentDeductionScore: number;
  totalWeightSum: number;
}

export interface ClassroomWeightInput {
  assignmentWeight?: unknown;
  assignment_weight?: unknown;
  postTestWeight?: unknown;
  post_test_weight?: unknown;
  affectiveWeight?: unknown;
  affective_weight?: unknown;
  midtermWeight?: unknown;
  midterm_weight?: unknown;
  finalWeight?: unknown;
  final_weight?: unknown;
  midtermMaxScore?: unknown;
  midterm_max_score?: unknown;
  finalMaxScore?: unknown;
  final_max_score?: unknown;
  lateDeductionScore?: unknown;
  late_deduction_score?: unknown;
  absentDeductionScore?: unknown;
  absent_deduction_score?: unknown;
}

function toNumOrDefault(val: unknown, fallback: number): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Extracts and normalizes classroom score weights & attendance deduction settings.
 * Supports both camelCase (Prisma models) and snake_case (API/UI objects).
 */
export function extractClassroomWeights(classroom: ClassroomWeightInput): ClassroomWeights {
  const assignmentWeight = toNumOrDefault(
    classroom.assignmentWeight ?? classroom.assignment_weight,
    10
  );
  const postTestWeight = toNumOrDefault(
    classroom.postTestWeight ?? classroom.post_test_weight,
    70
  );
  const affectiveWeight = toNumOrDefault(
    classroom.affectiveWeight ?? classroom.affective_weight,
    20
  );
  const midtermWeight = toNumOrDefault(
    classroom.midtermWeight ?? classroom.midterm_weight,
    0
  );
  const finalWeight = toNumOrDefault(
    classroom.finalWeight ?? classroom.final_weight,
    0
  );
  const midtermMaxScore = toNumOrDefault(
    classroom.midtermMaxScore ?? classroom.midterm_max_score,
    100
  );
  const finalMaxScore = toNumOrDefault(
    classroom.finalMaxScore ?? classroom.final_max_score,
    100
  );
  const lateDeductionScore = toNumOrDefault(
    classroom.lateDeductionScore ?? classroom.late_deduction_score,
    1
  );
  const absentDeductionScore = toNumOrDefault(
    classroom.absentDeductionScore ?? classroom.absent_deduction_score,
    2
  );

  const totalWeightSum =
    assignmentWeight + postTestWeight + affectiveWeight + midtermWeight + finalWeight;

  return {
    assignmentWeight,
    postTestWeight,
    affectiveWeight,
    midtermWeight,
    finalWeight,
    midtermMaxScore,
    finalMaxScore,
    lateDeductionScore,
    absentDeductionScore,
    totalWeightSum,
  };
}

/**
 * Normalizes DB or UI grade criteria into a sorted array (descending by minScore).
 */
export function normalizeGradeCriteria(
  rawCriteria?: Array<{ grade: string; minScore?: unknown; min_score?: unknown }> | null
): GradeCriterionItem[] {
  if (!rawCriteria || rawCriteria.length === 0) {
    return DEFAULT_GRADE_CRITERIA.map((c) => ({ ...c }));
  }

  return rawCriteria
    .map((c) => ({
      grade: String(c.grade),
      minScore: toNumOrDefault(c.minScore ?? c.min_score, 0),
    }))
    .sort((a, b) => b.minScore - a.minScore);
}

export interface ResolvedExamStatus {
  examStatus: ExamStatusType;
  isAbsentFinal: boolean;
  isIncomplete: boolean;
  numericFinalScore: number;
  rawFinalScore: number | null;
}

/**
 * Resolves a student's exam status and safe numeric final score.
 * Supports both the dedicated `examStatus` enum column and legacy `-1` / `-2` magic values.
 */
export function resolveExamStatus(
  finalScoreInput: unknown,
  examStatusInput?: unknown
): ResolvedExamStatus {
  const rawNum =
    finalScoreInput !== null && finalScoreInput !== undefined && finalScoreInput !== ''
      ? Number(finalScoreInput)
      : null;
  const validRawNum = rawNum !== null && Number.isFinite(rawNum) ? rawNum : null;

  let examStatus: ExamStatusType = 'normal';

  if (examStatusInput === 'absent_final' || validRawNum === -1) {
    examStatus = 'absent_final';
  } else if (examStatusInput === 'incomplete' || validRawNum === -2) {
    examStatus = 'incomplete';
  }

  const isAbsentFinal = examStatus === 'absent_final';
  const isIncomplete = examStatus === 'incomplete';

  // Ensure negative sentinel values are never summed into numeric calculations
  const numericFinalScore =
    isAbsentFinal || isIncomplete || validRawNum === null || validRawNum < 0
      ? 0
      : validRawNum;

  // Preserve legacy sentinel representation in rawFinalScore for backward-compatible clients
  const rawFinalScore = isAbsentFinal
    ? -1
    : isIncomplete
      ? -2
      : validRawNum;

  return {
    examStatus,
    isAbsentFinal,
    isIncomplete,
    numericFinalScore,
    rawFinalScore,
  };
}

export interface CalculateStudentGradeParams {
  sumAssignRaw: number;
  maxAssignRaw: number;
  sumPostTestRaw: number;
  maxPostTestRaw: number;
  midtermScore?: unknown;
  finalScore?: unknown;
  examStatus?: unknown;
  baseAffectiveScore?: unknown;
  absentCount: number;
  lateCount: number;
  isF: boolean;
  weights: ClassroomWeights;
  criteria?: GradeCriterionItem[];
}

export interface StudentGradeCalculationResult {
  midtermScore: number;
  rawFinalScore: number | null;
  numericFinalScore: number;
  examStatus: ExamStatusType;
  isAbsentFinal: boolean;
  isIncomplete: boolean;
  preciseScaledAssign: number;
  scaledAssign: number;
  preciseScaledPostTest: number;
  scaledPostTest: number;
  preciseScaledMidterm: number;
  scaledMidterm: number;
  preciseScaledFinal: number;
  scaledFinal: number;
  affectiveScore: number;
  totalScorePrecise: number;
  totalScore: number;
  percentageNumber: number;
  percentage: string;
  grade: string;
}

/**
 * Computes all scaled scores, affective score, total percentage, and final grade
 * according to Thai vocational education (สอศ.) rules.
 */
export function calculateStudentGradeSummary(
  params: CalculateStudentGradeParams
): StudentGradeCalculationResult {
  const {
    sumAssignRaw,
    maxAssignRaw,
    sumPostTestRaw,
    maxPostTestRaw,
    midtermScore: rawMidterm,
    finalScore: rawFinal,
    examStatus: rawExamStatus,
    baseAffectiveScore,
    absentCount,
    lateCount,
    isF,
    weights,
    criteria = DEFAULT_GRADE_CRITERIA,
  } = params;

  const midtermScore = Math.max(0, toNumOrDefault(rawMidterm, 0));
  const {
    examStatus,
    isAbsentFinal,
    isIncomplete,
    numericFinalScore,
    rawFinalScore,
  } = resolveExamStatus(rawFinal, rawExamStatus);

  const preciseScaledAssign =
    maxAssignRaw > 0 ? (sumAssignRaw / maxAssignRaw) * weights.assignmentWeight : 0;
  const preciseScaledPostTest =
    maxPostTestRaw > 0 ? (sumPostTestRaw / maxPostTestRaw) * weights.postTestWeight : 0;
  const preciseScaledMidterm =
    weights.midtermMaxScore > 0
      ? (midtermScore / weights.midtermMaxScore) * weights.midtermWeight
      : 0;
  const preciseScaledFinal =
    weights.finalMaxScore > 0
      ? (numericFinalScore / weights.finalMaxScore) * weights.finalWeight
      : 0;

  const parsedBaseAffective =
    baseAffectiveScore !== null &&
    baseAffectiveScore !== undefined &&
    baseAffectiveScore !== '' &&
    Number.isFinite(Number(baseAffectiveScore))
      ? Number(baseAffectiveScore)
      : null;

  const affectiveScore = calculateAffectiveScore({
    baseScore: parsedBaseAffective,
    maxWeight: weights.affectiveWeight,
    absentCount,
    lateCount,
    absentDeduction: weights.absentDeductionScore,
    lateDeduction: weights.lateDeductionScore,
  });

  const totalScorePrecise =
    preciseScaledAssign +
    preciseScaledPostTest +
    affectiveScore +
    preciseScaledMidterm +
    preciseScaledFinal;

  const percentageNumber =
    weights.totalWeightSum > 0
      ? (totalScorePrecise / weights.totalWeightSum) * 100
      : 0;

  let finalGrade: string | null = null;
  if (isF) {
    finalGrade = 'ข.ร.';
  } else if (isAbsentFinal) {
    finalGrade = 'ข.ส.';
  } else if (isIncomplete) {
    finalGrade = 'ม.ส.';
  } else {
    for (const c of criteria) {
      if (percentageNumber >= Number(c.minScore)) {
        finalGrade = c.grade;
        break;
      }
    }
  }

  return {
    midtermScore,
    rawFinalScore,
    numericFinalScore,
    examStatus,
    isAbsentFinal,
    isIncomplete,
    preciseScaledAssign,
    scaledAssign: Math.round(preciseScaledAssign),
    preciseScaledPostTest,
    scaledPostTest: Math.round(preciseScaledPostTest),
    preciseScaledMidterm,
    scaledMidterm: Math.round(preciseScaledMidterm),
    preciseScaledFinal,
    scaledFinal: Math.round(preciseScaledFinal),
    affectiveScore,
    totalScorePrecise,
    totalScore: Math.round(totalScorePrecise),
    percentageNumber,
    percentage: percentageNumber.toFixed(2),
    grade: finalGrade || '0',
  };
}

