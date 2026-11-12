import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractClassroomWeights,
  normalizeGradeCriteria,
  resolveExamStatus,
  calculateStudentGradeSummary,
  DEFAULT_GRADE_CRITERIA,
} from '@/lib/gradeCalculator';
import { memoryCache, getOrSetCache } from '@/lib/cache';

describe('gradeCalculator', () => {
  describe('extractClassroomWeights', () => {
    it('extracts defaults when fields are missing', () => {
      const weights = extractClassroomWeights({});
      expect(weights).toEqual({
        assignmentWeight: 10,
        postTestWeight: 70,
        affectiveWeight: 20,
        midtermWeight: 0,
        finalWeight: 0,
        midtermMaxScore: 100,
        finalMaxScore: 100,
        lateDeductionScore: 1,
        absentDeductionScore: 2,
        totalWeightSum: 100,
      });
    });

    it('accepts both camelCase and snake_case classroom weight fields', () => {
      const weights = extractClassroomWeights({
        assignment_weight: 20,
        post_test_weight: 30,
        midterm_weight: 15,
        final_weight: 15,
        affective_weight: 20,
        midterm_max_score: 30,
        final_max_score: 30,
      });
      expect(weights.assignmentWeight).toBe(20);
      expect(weights.postTestWeight).toBe(30);
      expect(weights.midtermWeight).toBe(15);
      expect(weights.finalWeight).toBe(15);
      expect(weights.totalWeightSum).toBe(100);
    });
  });

  describe('normalizeGradeCriteria', () => {
    it('falls back to DEFAULT_GRADE_CRITERIA when empty', () => {
      expect(normalizeGradeCriteria([])).toEqual(DEFAULT_GRADE_CRITERIA);
    });

    it('sorts criteria descending by minScore', () => {
      const sorted = normalizeGradeCriteria([
        { grade: '0', min_score: 0 },
        { grade: '4', min_score: 80 },
        { grade: '2', min_score: 60 },
      ]);
      expect(sorted.map(c => c.grade)).toEqual(['4', '2', '0']);
    });
  });

  describe('resolveExamStatus', () => {
    it('prioritizes explicit examStatus over finalScore', () => {
      expect(resolveExamStatus(15, 'absent_final')).toEqual({
        examStatus: 'absent_final',
        isAbsentFinal: true,
        isIncomplete: false,
        numericFinalScore: 0,
        rawFinalScore: -1,
      });
      expect(resolveExamStatus(10, 'incomplete')).toEqual({
        examStatus: 'incomplete',
        isAbsentFinal: false,
        isIncomplete: true,
        numericFinalScore: 0,
        rawFinalScore: -2,
      });
    });

    it('falls back to legacy -1 and -2 sentinels when examStatus is normal or omitted', () => {
      expect(resolveExamStatus(-1).examStatus).toBe('absent_final');
      expect(resolveExamStatus(-2).examStatus).toBe('incomplete');
      expect(resolveExamStatus(18).examStatus).toBe('normal');
    });
  });

  describe('calculateStudentGradeSummary', () => {
    const weights = extractClassroomWeights({
      assignmentWeight: 20,
      postTestWeight: 20,
      midtermWeight: 20,
      finalWeight: 20,
      affectiveWeight: 20,
      midtermMaxScore: 40,
      finalMaxScore: 40,
    });
    const criteria = normalizeGradeCriteria([]);

    it('scales raw weekly and exam scores to classroom weights accurately', () => {
      const summary = calculateStudentGradeSummary({
        sumAssignRaw: 80,
        maxAssignRaw: 100,
        sumPostTestRaw: 60,
        maxPostTestRaw: 100,
        midtermScore: 30, // 30/40 * 20 = 15
        finalScore: 36,   // 36/40 * 20 = 18
        baseAffectiveScore: 19,
        absentCount: 0,
        lateCount: 0,
        isF: false,
        weights,
        criteria,
      });

      expect(summary.scaledAssign).toBe(16); // 80/100 * 20
      expect(summary.scaledPostTest).toBe(12); // 60/100 * 20
      expect(summary.scaledMidterm).toBe(15);
      expect(summary.scaledFinal).toBe(18);
      expect(summary.affectiveScore).toBe(19);
      expect(summary.totalScore).toBe(80);
      expect(summary.grade).toBe('4');
    });

    it('returns ข.ส. or ม.ส. when examStatus is absent_final or incomplete', () => {
      const absentSummary = calculateStudentGradeSummary({
        sumAssignRaw: 100,
        maxAssignRaw: 100,
        sumPostTestRaw: 100,
        maxPostTestRaw: 100,
        midtermScore: 40,
        finalScore: 0,
        examStatus: 'absent_final',
        baseAffectiveScore: 20,
        absentCount: 0,
        lateCount: 0,
        isF: false,
        weights,
        criteria,
      });
      expect(absentSummary.isAbsentFinal).toBe(true);
      expect(absentSummary.scaledFinal).toBe(0);
      expect(absentSummary.grade).toBe('ข.ส.');

      const incompleteSummary = calculateStudentGradeSummary({
        sumAssignRaw: 100,
        maxAssignRaw: 100,
        sumPostTestRaw: 100,
        maxPostTestRaw: 100,
        midtermScore: 40,
        finalScore: -2,
        baseAffectiveScore: 20,
        absentCount: 0,
        lateCount: 0,
        isF: false,
        weights,
        criteria,
      });
      expect(incompleteSummary.isIncomplete).toBe(true);
      expect(incompleteSummary.grade).toBe('ม.ส.');
    });
  });
});

describe('MemoryCache in-flight deduplication', () => {
  beforeEach(() => {
    memoryCache.clear();
  });

  it('deduplicates concurrent getOrSetCache calls for the same key (cache stampede protection)', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 25));
      return { value: 42 };
    };

    const [r1, r2, r3] = await Promise.all([
      getOrSetCache('stampede:key', 10_000, fetcher),
      getOrSetCache('stampede:key', 10_000, fetcher),
      getOrSetCache('stampede:key', 10_000, fetcher),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toEqual({ value: 42 });
    expect(r3).toEqual({ value: 42 });
  });
});
