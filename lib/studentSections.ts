/**
 * Utilities for grouping, normalizing, and sorting student sub-rooms / sections
 * within a combined classroom (e.g., Computer branch ปวช.1/1 and ปวช.1/2 studying together).
 */

export interface SectionableStudent {
  id: string | number;
  name: string;
  student_code?: string | null;
  studentCode?: string | null;
  grade_level?: string | null;
  gradeLevel?: string | null;
  branch?: string | null;
}

export interface StudentSectionGroup<T extends SectionableStudent = SectionableStudent> {
  /** Stable unique identifier for this section within a classroom */
  key: string;
  /** Concise label for tabs/badges, e.g. "ปวช.1/1" or "คอมพิวเตอร์ · ปวช.1/1" */
  label: string;
  /** Full descriptive label for section headers, e.g. "สาขาคอมพิวเตอร์ · ปวช.1/1" */
  fullLabel: string;
  /** Excel-safe sheet name (<= 31 chars, no / \ ? * [ ] :) */
  shortSheetName: string;
  branch: string | null;
  gradeLevel: string | null;
  isUnassigned: boolean;
  students: T[];
}

export const UNASSIGNED_SECTION_KEY = '__unassigned__';

/**
 * Normalize Thai grade/section strings so minor spacing or dot differences
 * (e.g. "ปวช 1/1", "ปวช. 1 / 1", "ปวช.1/1") resolve to the same canonical label ("ปวช.1/1").
 */
export function normalizeGradeLevel(raw?: string | null): string {
  if (!raw) return '';
  let s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';

  // Normalize slashes: "1 / 2" -> "1/2"
  s = s.replace(/\s*\/\s*/g, '/');

  // Normalize common Thai education level prefixes
  s = s.replace(/^ปวช\.?\s*(\d+)/i, 'ปวช.$1');
  s = s.replace(/^ปวส\.?\s*(\d+)/i, 'ปวส.$1');
  s = s.replace(/^ม\.?\s*(\d+)/i, 'ม.$1');
  s = s.replace(/^ป\.?\s*(\d+)/i, 'ป.$1');

  return s.trim();
}

/**
 * Combine separate Excel columns for grade level (e.g. "ปวช.1") and room/group (e.g. "1" or "1/2")
 * into a single normalized grade_level string (e.g. "ปวช.1/1" or "ปวช.1/2").
 */
export function combineGradeAndRoom(rawGrade?: string | null, rawRoom?: string | null): string {
  const grade = normalizeGradeLevel(rawGrade);
  let room = rawRoom ? String(rawRoom).trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/') : '';

  if (!room) return grade;

  // Strip leading words like "ห้อง 1" -> "1", "กลุ่ม 2" -> "2", "ทับ 1" -> "1"
  room = room.replace(/^(?:ห้องเรียน|ห้อง|กลุ่มเรียน|กลุ่มที่|กลุ่ม|ทับ)\s*/i, '').trim();
  if (!room) return grade;

  // If room itself already contains a full grade prefix like "ปวช.1/2", normalize and use it
  if (/^(?:ปวช|ปวส|ม\.|ป\.)/i.test(room)) {
    return normalizeGradeLevel(room);
  }

  if (!grade) {
    return normalizeGradeLevel(room);
  }

  // If grade already includes a slash (e.g. "ปวช.1/1"), keep grade as-is
  if (grade.includes('/')) {
    return grade;
  }

  // If grade ends with a year number (e.g. "ปวช.1") and room starts with that same year + slash (e.g. "1/2"),
  // merge into "ปวช.1/2" instead of "ปวช.1/1/2"
  const trailingYearMatch = grade.match(/(\d+)$/);
  if (trailingYearMatch && room.startsWith(`${trailingYearMatch[1]}/`)) {
    const prefix = grade.slice(0, grade.length - trailingYearMatch[1].length);
    return normalizeGradeLevel(`${prefix}${room}`);
  }

  // If grade is just a prefix without year (e.g. "ปวช" or "ปวช.") and room is "1/2"
  if (/^(?:ปวช|ปวส|ม|ป)\.?$/i.test(grade)) {
    const cleanPrefix = grade.replace(/\.$/, '');
    return normalizeGradeLevel(`${cleanPrefix}.${room}`);
  }

  return normalizeGradeLevel(`${grade}/${room}`);
}

/**
 * Normalize branch text for display while preserving user wording.
 */
export function normalizeBranchDisplay(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

/**
 * Canonical branch key for grouping (strips optional leading "สาขาวิชา" / "สาขา" / "แผนกวิชา")
 * so "สาขาคอมพิวเตอร์" and "คอมพิวเตอร์" group together cleanly.
 */
export function getCanonicalBranchKey(raw?: string | null): string {
  const display = normalizeBranchDisplay(raw);
  if (!display) return '';
  return display
    .replace(/^(?:สาขาวิชา|สาขา|แผนกวิชา|แผนก)\s*/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Short clean branch name without redundant prefix (e.g. "สาขาคอมพิวเตอร์" -> "คอมพิวเตอร์").
 */
export function getShortBranchName(raw?: string | null): string {
  const display = normalizeBranchDisplay(raw);
  if (!display) return '';
  const stripped = display.replace(/^(?:สาขาวิชา|สาขา|แผนกวิชา|แผนก)\s*/i, '').trim();
  return stripped || display;
}

/**
 * Format branch with "สาขา" prefix for full headers (e.g. "คอมพิวเตอร์" -> "สาขาคอมพิวเตอร์").
 */
export function formatFullBranchName(raw?: string | null): string {
  const short = getShortBranchName(raw);
  if (!short) return '';
  return `สาขา${short}`;
}

/**
 * Sanitize a label into a valid Excel worksheet name (max 31 chars, no : \ / ? * [ ]).
 */
export function toSafeExcelSheetName(label: string, fallback = 'Sheet'): string {
  const cleaned = label
    .replace(/\//g, '-')
    .replace(/[:\\?*[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback.slice(0, 31);
  return cleaned.slice(0, 31);
}

function getStudentGrade(s: SectionableStudent): string {
  return normalizeGradeLevel(s.grade_level ?? s.gradeLevel ?? null);
}

function getStudentCode(s: SectionableStudent): string {
  return String(s.student_code ?? s.studentCode ?? '').trim();
}

/**
 * Compute the section key for a single student.
 */
export function getStudentSectionKey(s: SectionableStudent): string {
  const branchKey = getCanonicalBranchKey(s.branch);
  const grade = getStudentGrade(s);
  if (!branchKey && !grade) return UNASSIGNED_SECTION_KEY;
  return `${branchKey}__${grade.toLowerCase()}`;
}

/**
 * Compare two students by:
 * 1) Assigned section before unassigned
 * 2) Canonical branch (Thai natural order)
 * 3) Normalized grade level / room (natural numeric order: 1/1, 1/2, ..., 1/10)
 * 4) Student code (natural numeric order)
 * 5) Student name (Thai alphabetical)
 */
export function compareStudentsBySectionAndCode<T extends SectionableStudent>(a: T, b: T): number {
  const keyA = getStudentSectionKey(a);
  const keyB = getStudentSectionKey(b);

  if (keyA !== keyB) {
    if (keyA === UNASSIGNED_SECTION_KEY) return 1;
    if (keyB === UNASSIGNED_SECTION_KEY) return -1;

    const branchA = getShortBranchName(a.branch);
    const branchB = getShortBranchName(b.branch);
    const branchCmp = branchA.localeCompare(branchB, 'th', { numeric: true, sensitivity: 'base' });
    if (branchCmp !== 0) return branchCmp;

    const gradeA = getStudentGrade(a);
    const gradeB = getStudentGrade(b);
    const gradeCmp = gradeA.localeCompare(gradeB, 'th', { numeric: true, sensitivity: 'base' });
    if (gradeCmp !== 0) return gradeCmp;
  }

  const codeA = getStudentCode(a);
  const codeB = getStudentCode(b);
  if (codeA && codeB && codeA !== codeB) {
    return codeA.localeCompare(codeB, 'th', { numeric: true, sensitivity: 'base' });
  }
  if (codeA && !codeB) return -1;
  if (!codeA && codeB) return 1;

  return (a.name || '').localeCompare(b.name || '', 'th', { numeric: true, sensitivity: 'base' });
}

/**
 * Group a classroom's students into distinct sub-rooms / sections.
 * Automatically adapts labels depending on whether students share a single branch or span multiple branches.
 */
export function buildStudentSectionGroups<T extends SectionableStudent>(
  students: T[]
): {
  groups: StudentSectionGroup<T>[];
  hasMultipleSections: boolean;
  sharedBranch: string | null;
} {
  if (!students || students.length === 0) {
    return { groups: [], hasMultipleSections: false, sharedBranch: null };
  }

  const sortedStudents = [...students].sort(compareStudentsBySectionAndCode);

  const distinctBranches = new Map<string, string>();
  const bucketMap = new Map<
    string,
    {
      key: string;
      branchShort: string | null;
      gradeLevel: string | null;
      isUnassigned: boolean;
      students: T[];
    }
  >();

  for (const student of sortedStudents) {
    const branchKey = getCanonicalBranchKey(student.branch);
    const branchShort = getShortBranchName(student.branch) || null;
    const grade = getStudentGrade(student) || null;

    if (branchKey && branchShort && !distinctBranches.has(branchKey)) {
      distinctBranches.set(branchKey, branchShort);
    }

    const key = !branchKey && !grade ? UNASSIGNED_SECTION_KEY : `${branchKey}__${(grade || '').toLowerCase()}`;
    const existing = bucketMap.get(key);
    if (existing) {
      if (!existing.branchShort && branchShort) existing.branchShort = branchShort;
      if (!existing.gradeLevel && grade) existing.gradeLevel = grade;
      existing.students.push(student);
    } else {
      bucketMap.set(key, {
        key,
        branchShort,
        gradeLevel: grade,
        isUnassigned: key === UNASSIGNED_SECTION_KEY,
        students: [student],
      });
    }
  }

  const multiBranch = distinctBranches.size > 1;
  const sharedBranch =
    distinctBranches.size === 1 ? Array.from(distinctBranches.values())[0] : null;

  const usedSheetNames = new Set<string>();
  const groups: StudentSectionGroup<T>[] = Array.from(bucketMap.values()).map((bucket, idx) => {
    if (bucket.isUnassigned) {
      const baseSheet = toSafeExcelSheetName('ไม่ระบุห้อง', `กลุ่ม_${idx + 1}`);
      let sheetName = baseSheet;
      let suffix = 2;
      while (usedSheetNames.has(sheetName)) {
        sheetName = `${baseSheet.slice(0, 28)}_${suffix++}`;
      }
      usedSheetNames.add(sheetName);

      return {
        key: bucket.key,
        label: 'ไม่ระบุห้องย่อย',
        fullLabel: 'ไม่ระบุระดับชั้น/ห้องย่อย',
        shortSheetName: sheetName,
        branch: null,
        gradeLevel: null,
        isUnassigned: true,
        students: bucket.students,
      };
    }

    const gradePart = bucket.gradeLevel || '';
    const branchShort = bucket.branchShort || '';
    const branchFull = branchShort ? formatFullBranchName(branchShort) : '';

    let label: string;
    if (multiBranch && branchShort && gradePart) {
      label = `${branchShort} · ${gradePart}`;
    } else if (gradePart) {
      label = gradePart;
    } else {
      label = branchFull || 'กลุ่มเรียน';
    }

    const fullLabel =
      branchFull && gradePart
        ? `${branchFull} · ${gradePart}`
        : gradePart || branchFull || 'กลุ่มเรียน';

    const baseSheet = toSafeExcelSheetName(label, `กลุ่ม_${idx + 1}`);
    let sheetName = baseSheet;
    let suffix = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = `${baseSheet.slice(0, 28)}_${suffix++}`;
    }
    usedSheetNames.add(sheetName);

    return {
      key: bucket.key,
      label,
      fullLabel,
      shortSheetName: sheetName,
      branch: branchShort || null,
      gradeLevel: gradePart || null,
      isUnassigned: false,
      students: bucket.students,
    };
  });

  // Sort groups naturally with unassigned last
  groups.sort((a, b) => {
    if (a.isUnassigned && !b.isUnassigned) return 1;
    if (!a.isUnassigned && b.isUnassigned) return -1;
    return a.label.localeCompare(b.label, 'th', { numeric: true, sensitivity: 'base' });
  });

  return {
    groups,
    hasMultipleSections: groups.length > 1,
    sharedBranch,
  };
}

