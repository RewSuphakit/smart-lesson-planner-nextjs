/**
 * Centralized Affective Score (คะแนนจิตพิสัย) Calculation Helper.
 * Ensures consistent business logic across grades calculation, export reports, and dashboard.
 */

export interface CalculateAffectiveScoreParams {
  baseScore?: number | null;
  maxWeight?: number;
  absentCount: number;
  lateCount: number;
  absentDeduction?: number;
  lateDeduction?: number;
}

export function calculateAffectiveScore({
  baseScore,
  maxWeight = 20,
  absentCount = 0,
  lateCount = 0,
  absentDeduction = 2,
  lateDeduction = 1,
}: CalculateAffectiveScoreParams): number {
  const weight = Number(maxWeight) || 20;
  const absDeduct = absentDeduction !== undefined && absentDeduction !== null ? Number(absentDeduction) : 2;
  const lateDeduct = lateDeduction !== undefined && lateDeduction !== null ? Number(lateDeduction) : 1;

  // If teacher explicitly set a score, respect it directly (clamped within [0, maxWeight])
  if (baseScore !== null && baseScore !== undefined && !isNaN(Number(baseScore))) {
    return Math.min(weight, Math.max(0, Number(baseScore)));
  }

  // Otherwise calculate dynamically based on attendance penalty:
  const penalty = (absentCount * absDeduct) + (lateCount * lateDeduct);
  return Math.max(0, weight - penalty);
}
