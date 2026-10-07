export interface ParsedClassroomName {
  code: string | null;
  subjectTitle: string;
  groupName: string | null;
  curriculumType: 'pvs' | 'pvch' | 'other';
}

/**
 * Parses raw classroom names like:
 * "21909-2001 การเขียนโปรแกรมประยุกต์บนอุปกรณ์พกพา ปวช.2/2"
 * "30001-1003 การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ ปวส.1/6"
 * into distinct course code, subject title, group, and curriculum type.
 */
export function parseClassroomName(fullName: string): ParsedClassroomName {
  if (!fullName) {
    return { code: null, subjectTitle: '', groupName: null, curriculumType: 'other' };
  }

  const trimmed = fullName.trim();
  const codeMatch = trimmed.match(/^([0-9]{4,5}-[0-9]{4}|[A-Za-z0-9-]{5,12})\s+/);
  const code = codeMatch ? codeMatch[1] : null;
  const afterCode = codeMatch ? trimmed.slice(codeMatch[0].length).trim() : trimmed;

  const groupMatch = afterCode.match(/\s+((?:\([^\)]+\)\s*)?(?:ชก|ชย|ชค|ชอ|ชส|บช|กต|คธ|ทธ|อส)?\s*(?:ปวช\.|ปวส\.|ม\.)\s*[0-9]+(?:\/[0-9]+)?|[0-9]+\/[0-9]+)$/);

  let groupName: string | null = null;
  let subjectTitle = afterCode;

  if (groupMatch && groupMatch.index !== undefined) {
    groupName = groupMatch[1].trim();
    subjectTitle = afterCode.slice(0, groupMatch.index).trim();
  }

  const isPvs = fullName.includes('ปวส') || (groupName?.includes('ปวส') ?? false);
  const isPvch = fullName.includes('ปวช') || (groupName?.includes('ปวช') ?? false);

  return {
    code,
    subjectTitle: subjectTitle || fullName,
    groupName,
    curriculumType: isPvs ? 'pvs' : isPvch ? 'pvch' : 'other',
  };
}
