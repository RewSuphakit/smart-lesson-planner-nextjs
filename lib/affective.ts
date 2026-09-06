/**
 * Centralized Affective Score (คะแนนจิตพิสัย) Calculation Helper.
 * Ensures consistent business logic across grades calculation, export reports, and dashboard.
 */

export interface CalculateAffectiveScoreParams {
  baseScore?: number | null;
  maxWeight?: number;
  absentCount: number;
  lateCount: number;
}

export function calculateAffectiveScore({
  baseScore,
  maxWeight = 20,
  absentCount = 0,
  lateCount = 0,
}: CalculateAffectiveScoreParams): number {
  const weight = Number(maxWeight) || 20;

  // If teacher explicitly set a score, respect it directly (clamped within [0, maxWeight])
  if (baseScore !== null && baseScore !== undefined && !isNaN(Number(baseScore))) {
    return Math.min(weight, Math.max(0, Number(baseScore)));
  }

  // Otherwise calculate dynamically based on attendance penalty:
  // 2 points deducted per absence, 1 point deducted per late arrival
  const penalty = (absentCount * 2) + (lateCount * 1);
  return Math.max(0, weight - penalty);
}
