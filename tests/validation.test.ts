import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  CreateStudentSchema,
  BulkCreateStudentSchema,
  BulkUpdateStudentMetaSchema,
  ClassroomSchema,
  UpdateClassroomSchema,
  SemesterSchema,
  CloneSemesterSchema,
  AttendanceStatusEnum,
  RecordAttendanceSchema,
  BulkRecordAttendanceSchema,
  SaveScoreStructureSchema,
  SaveLessonScoresSchema,
  SaveBulkScoresSchema,
  validateData,
  validateRequestBody,
  formatZodError,
} from '@/lib/validation';

describe('Auth schemas', () => {
  it('LoginSchema trims email and requires password', () => {
    const ok = LoginSchema.safeParse({ email: '  a@b.com ', password: 'x' });
    expect(ok.success && ok.data.email).toBe('a@b.com');
    expect(LoginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('RegisterSchema enforces password length >= 6 and non-empty name', () => {
    expect(RegisterSchema.safeParse({ email: 'a@b.com', password: '12345', name: 'x' }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: 'a@b.com', password: '123456', name: '  ' }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: 'a@b.com', password: '123456', name: 'x' }).success).toBe(true);
  });

  it('ResetPasswordSchema requires a 6-char OTP', () => {
    const base = { email: 'a@b.com', newPassword: '123456' };
    expect(ResetPasswordSchema.safeParse({ ...base, code: '123456' }).success).toBe(true);
    expect(ResetPasswordSchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(ResetPasswordSchema.safeParse({ ...base, code: '1234567' }).success).toBe(false);
  });
});

describe('RecordAttendanceSchema', () => {
  const valid = { student_id: 1, classroom_id: 2, date: '2026-03-05', status: 'present' };

  it('accepts a valid record', () => {
    expect(RecordAttendanceSchema.safeParse(valid).success).toBe(true);
  });

  it('coerces numeric strings for ids', () => {
    const r = RecordAttendanceSchema.safeParse({ ...valid, student_id: '7', classroom_id: '8' });
    expect(r.success && r.data).toMatchObject({ student_id: 7, classroom_id: 8 });
  });

  it.each([0, -1, 1.5, 'abc', null])('rejects invalid student_id %p', (id) => {
    expect(RecordAttendanceSchema.safeParse({ ...valid, student_id: id }).success).toBe(false);
  });

  it.each(['present', 'late', 'absent', 'leave'])('accepts status %s', (status) => {
    expect(AttendanceStatusEnum.safeParse(status).success).toBe(true);
  });

  it.each(['Present', 'sick', '', undefined])('rejects status %p', (status) => {
    expect(RecordAttendanceSchema.safeParse({ ...valid, status }).success).toBe(false);
  });

  it('rejects an invalid date with a helpful message', () => {
    const r = RecordAttendanceSchema.safeParse({ ...valid, date: 'not-a-date' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Invalid date format');
  });

  it('accepts ISO datetimes and rejects non-string dates', () => {
    expect(RecordAttendanceSchema.safeParse({ ...valid, date: '2026-03-05T10:00:00+07:00' }).success).toBe(true);
    expect(RecordAttendanceSchema.safeParse({ ...valid, date: 20260305 }).success).toBe(false);
  });
});

describe('BulkRecordAttendanceSchema', () => {
  const rec = { student_id: 1, classroom_id: 2, date: '2026-03-05', status: 'late' };

  it('requires at least one record', () => {
    const r = BulkRecordAttendanceSchema.safeParse({ records: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('At least one attendance record is required');
  });

  it('accepts multiple valid records', () => {
    const r = BulkRecordAttendanceSchema.safeParse({ records: [rec, { ...rec, student_id: 2, status: 'absent' }] });
    expect(r.success).toBe(true);
  });

  it('fails when any record is invalid and reports the indexed path', () => {
    const r = BulkRecordAttendanceSchema.safeParse({ records: [rec, { ...rec, status: 'bad' }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['records', 1, 'status']);
  });

  it('rejects missing records key', () => {
    expect(BulkRecordAttendanceSchema.safeParse({}).success).toBe(false);
  });
});

describe('CreateStudentSchema', () => {
  it('requires a non-empty trimmed name', () => {
    expect(CreateStudentSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(CreateStudentSchema.safeParse({}).success).toBe(false);
  });

  it('converts empty-string optional fields to null', () => {
    const r = CreateStudentSchema.safeParse({
      name: ' สมชาย ',
      student_code: '',
      grade_level: ' ',
      branch: '',
      email: '',
      avatar: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        name: 'สมชาย',
        student_code: null,
        grade_level: null,
        branch: null,
        email: null,
        avatar: null,
      });
    }
  });

  it.each([
    ['', null],
    [null, null],
    [0, null],
    ['null', null],
    ['undefined', null],
    ['5', 5],
    [7, 7],
  ])('normalizes classroom_id %p -> %p', (input, expected) => {
    const r = CreateStudentSchema.safeParse({ name: 'x', classroom_id: input });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.classroom_id).toBe(expected);
  });

  it('rejects negative or non-numeric classroom_id', () => {
    expect(CreateStudentSchema.safeParse({ name: 'x', classroom_id: -3 }).success).toBe(false);
    expect(CreateStudentSchema.safeParse({ name: 'x', classroom_id: 'abc' }).success).toBe(false);
  });

  it('validates email format when provided', () => {
    expect(CreateStudentSchema.safeParse({ name: 'x', email: 'nope' }).success).toBe(false);
    expect(CreateStudentSchema.safeParse({ name: 'x', email: 'a@b.co' }).success).toBe(true);
  });

  it('caps avatar size at 150,000 chars', () => {
    expect(CreateStudentSchema.safeParse({ name: 'x', avatar: 'a'.repeat(150_000) }).success).toBe(true);
    expect(CreateStudentSchema.safeParse({ name: 'x', avatar: 'a'.repeat(150_001) }).success).toBe(false);
  });
});

describe('BulkCreateStudentSchema / BulkUpdateStudentMetaSchema', () => {
  it('requires at least one student', () => {
    expect(BulkCreateStudentSchema.safeParse({ students: [] }).success).toBe(false);
    expect(BulkCreateStudentSchema.safeParse({ students: [{ name: 'a' }] }).success).toBe(true);
  });

  it('requires at least one student id and coerces ids', () => {
    expect(BulkUpdateStudentMetaSchema.safeParse({ student_ids: [] }).success).toBe(false);
    const r = BulkUpdateStudentMetaSchema.safeParse({ student_ids: ['1', 2] });
    expect(r.success && r.data.student_ids).toEqual([1, 2]);
  });

  it('enforces max lengths for grade_level (100) and branch (255)', () => {
    const ids = { student_ids: [1] };
    expect(BulkUpdateStudentMetaSchema.safeParse({ ...ids, grade_level: 'a'.repeat(101) }).success).toBe(false);
    expect(BulkUpdateStudentMetaSchema.safeParse({ ...ids, branch: 'a'.repeat(256) }).success).toBe(false);
    expect(BulkUpdateStudentMetaSchema.safeParse({ ...ids, branch: 'a'.repeat(255) }).success).toBe(true);
  });
});

describe('ClassroomSchema', () => {
  it('applies defaults', () => {
    const r = ClassroomSchema.safeParse({ name: ' ห้อง 1 ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        name: 'ห้อง 1',
        late_to_absent_ratio: 3,
        leave_to_absent_ratio: 2,
        absent_to_f_ratio: 4,
        total_classes: 40,
        min_attendance_percent: 80,
        assignment_weight: 10,
        post_test_weight: 70,
        affective_weight: 20,
        late_deduction_score: 1,
        absent_deduction_score: 2,
        midterm_weight: 0,
        final_weight: 0,
        midterm_max_score: 100,
        final_max_score: 100,
        curriculum_type: 'pvch',
        total_weeks: 18,
        is_portal_enabled: true,
      });
    }
  });

  it('preserves explicit 0 values (no default override)', () => {
    const r = ClassroomSchema.safeParse({ name: 'x', assignment_weight: 0, min_attendance_percent: 0 });
    expect(r.success && r.data).toMatchObject({ assignment_weight: 0, min_attendance_percent: 0 });
  });

  it('enforces boundaries', () => {
    expect(ClassroomSchema.safeParse({ name: 'x', min_attendance_percent: 101 }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: 'x', total_weeks: 53 }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: 'x', total_weeks: 0 }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: 'x', total_weeks: 52 }).success).toBe(true);
    expect(ClassroomSchema.safeParse({ name: 'x', late_deduction_score: 51 }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: 'x', total_classes: 1.5 }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: 'x', curriculum_type: 'other' }).success).toBe(false);
    expect(ClassroomSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('UpdateClassroomSchema does not inject defaults', () => {
    const r = UpdateClassroomSchema.safeParse({});
    expect(r.success && r.data).toEqual({});
    expect(UpdateClassroomSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('SemesterSchema / CloneSemesterSchema', () => {
  it('SemesterSchema validates term_number 1..3 and applies defaults', () => {
    const ok = SemesterSchema.safeParse({ name: 'n', term_number: 2, academic_year: '2569' });
    expect(ok.success && ok.data).toMatchObject({ is_active: false, curriculum_type: 'pvch', total_weeks: 18 });
    expect(SemesterSchema.safeParse({ name: 'n', term_number: 0, academic_year: '2569' }).success).toBe(false);
    expect(SemesterSchema.safeParse({ name: 'n', term_number: 4, academic_year: '2569' }).success).toBe(false);
  });

  it('CloneSemesterSchema coerces target id and defaults flags', () => {
    const r = CloneSemesterSchema.safeParse({ target_semester_id: '3' });
    expect(r.success && r.data).toEqual({
      target_semester_id: 3,
      include_students: true,
      include_timetable: false,
      force_overwrite: false,
    });
    expect(CloneSemesterSchema.safeParse({ target_semester_id: 0 }).success).toBe(false);
  });
});

describe('Score schemas', () => {
  it('SaveScoreStructureSchema requires a non-empty structures array and lesson_number >= 1', () => {
    expect(SaveScoreStructureSchema.safeParse({ structures: [] }).success).toBe(false);
    expect(SaveScoreStructureSchema.safeParse({ structures: [{ lesson_number: 0 }] }).success).toBe(false);
    const r = SaveScoreStructureSchema.safeParse({ structures: [{ lesson_number: '2' }] });
    expect(r.success && r.data.structures[0]).toMatchObject({ lesson_number: 2, lesson_name: '', hours: 0 });
  });

  it('SaveLessonScoresSchema accepts number/string/null scores', () => {
    const r = SaveLessonScoresSchema.safeParse({
      lesson_number: 1,
      scores: [
        { student_id: 1, assignment_score: 5, post_test_score: '7' },
        { student_id: 2, assignment_score: null },
      ],
    });
    expect(r.success).toBe(true);
    expect(SaveLessonScoresSchema.safeParse({ lesson_number: 1, scores: [] }).success).toBe(false);
    expect(
      SaveLessonScoresSchema.safeParse({ lesson_number: 1, scores: [{ student_id: 1, assignment_score: true }] }).success
    ).toBe(false);
  });

  it('SaveBulkScoresSchema requires student_id and lesson_number per item', () => {
    expect(SaveBulkScoresSchema.safeParse({ scores: [{ student_id: 1, lesson_number: 1 }] }).success).toBe(true);
    expect(SaveBulkScoresSchema.safeParse({ scores: [{ student_id: 1 }] }).success).toBe(false);
  });
});

describe('validation helpers', () => {
  it('validateData returns data on success', () => {
    const r = validateData({ student_id: '1', classroom_id: 2, date: '2026-01-01', status: 'leave' }, RecordAttendanceSchema);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.student_id).toBe(1);
  });

  it('validateData returns a 400 response with field-level errors on failure', async () => {
    const r = validateData({ records: [] }, BulkRecordAttendanceSchema);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.response.status).toBe(400);
      expect(await r.response.json()).toEqual({
        message: 'Validation failed',
        errors: [{ field: 'records', message: 'At least one attendance record is required' }],
      });
    }
  });

  it('formatZodError joins nested paths with dots', async () => {
    const parsed = BulkRecordAttendanceSchema.safeParse({ records: [{ student_id: 0 }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const body = await formatZodError(parsed.error).json();
      expect(body.errors.map((e: { field: string }) => e.field)).toContain('records.0.student_id');
    }
  });

  it('validateRequestBody parses JSON bodies', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
    });
    const r = await validateRequestBody(req, LoginSchema);
    expect(r.success).toBe(true);
  });

  it('validateRequestBody returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api', { method: 'POST', body: '{not json' });
    const r = await validateRequestBody(req, LoginSchema);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.response.status).toBe(400);
      expect(await r.response.json()).toEqual({ message: 'Invalid JSON request payload' });
    }
  });
});
