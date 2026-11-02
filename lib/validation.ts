import { z } from 'zod';
import { NextResponse } from 'next/server';

// ==================== Auth Schemas ====================
export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  turnstileToken: z.string().optional(),
});

export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().trim().min(1, 'Name is required'),
  turnstileToken: z.string().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('กรุณาระบุรูปแบบอีเมลให้ถูกต้อง'),
});

export const ResetPasswordSchema = z.object({
  email: z.string().trim().email('กรุณาระบุรูปแบบอีเมลให้ถูกต้อง'),
  code: z.string().trim().length(6, 'รหัส OTP ต้องมีความยาว 6 หลัก'),
  newPassword: z.string().min(6, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร'),
});

// ==================== Student Schemas ====================
export const CreateStudentSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  student_code: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().nullable().optional()
  ),
  grade_level: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().nullable().optional()
  ),
  branch: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().nullable().optional()
  ),
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').nullable().optional()
  ),
  classroom_id: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || val === 0 || val === 'null' || val === 'undefined') return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    },
    z.number({ message: 'รหัสห้องเรียนต้องเป็นตัวเลข' }).int().positive('รหัสห้องเรียนต้องเป็นตัวเลขจำนวนเต็มบวก').nullable().optional()
  ),
  // Cap avatar payload (client compresses to ~3-8 KB WebP; 150k chars leaves generous headroom)
  avatar: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().max(150_000, 'ขนาดรูปภาพเกินกำหนด (สูงสุด 150KB)').nullable().optional()
  ),
});

export const BulkCreateStudentSchema = z.object({
  students: z.array(CreateStudentSchema).min(1, 'ต้องมีข้อมูลนักเรียนอย่างน้อย 1 คน'),
});

export const BulkUpdateStudentMetaSchema = z.object({
  student_ids: z.array(z.coerce.number().int().positive()).min(1, 'ต้องเลือกนักเรียนอย่างน้อย 1 คน'),
  classroom_id: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || val === 0 || val === 'null' || val === 'undefined') return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    },
    z.number({ message: 'รหัสห้องเรียนต้องเป็นตัวเลข' }).int().positive('รหัสห้องเรียนต้องเป็นตัวเลขจำนวนเต็มบวก').nullable().optional()
  ),
  grade_level: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().max(100, 'ระดับชั้นต้องไม่เกิน 100 ตัวอักษร').nullable().optional()
  ),
  branch: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().max(255, 'สาขาต้องไม่เกิน 255 ตัวอักษร').nullable().optional()
  ),
});

export const UpdateStudentExamScoresSchema = z.object({
  scores: z.array(
    z.object({
      student_id: z.union([z.number(), z.string()]),
      midterm_score: z.union([z.number(), z.string(), z.null()]).optional(),
      final_score: z.union([z.number(), z.string(), z.null()]).optional(),
      affective_score: z.union([z.number(), z.string(), z.null()]).optional(),
    })
  ).min(1, 'At least one score entry is required'),
});

// ==================== Classroom Schemas ====================
export const ClassroomSchema = z.object({
  name: z.string().trim().min(1, 'Classroom name is required'),
  description: z.string().trim().nullable().optional(),
  late_to_absent_ratio: z.number().int().min(1).optional().default(3),
  leave_to_absent_ratio: z.number().int().min(1).optional().default(2),
  absent_to_f_ratio: z.number().int().min(1).optional().default(4),
  total_classes: z.number().int().min(1).optional().default(40),
  min_attendance_percent: z.number().min(0).max(100).optional().default(80),
  assignment_weight: z.number().min(0).max(100).optional().default(10),
  post_test_weight: z.number().min(0).max(100).optional().default(70),
  affective_weight: z.number().min(0).max(100).optional().default(20),
  midterm_weight: z.number().min(0).max(100).optional().default(0),
  final_weight: z.number().min(0).max(100).optional().default(0),
  midterm_max_score: z.number().min(0).optional().default(100),
  final_max_score: z.number().min(0).optional().default(100),
  curriculum_type: z.enum(['pvch', 'pvs', 'custom']).optional().default('pvch'),
  total_weeks: z.number().int().min(1).max(52).optional().default(18),
  semester_start_date: z.string().nullable().optional(),
  semester_id: z.number().int().positive().nullable().optional(),
  is_portal_enabled: z.boolean().optional().default(true),
});

export const UpdateClassroomSchema = z.object({
  name: z.string().trim().min(1, 'Classroom name cannot be empty').optional(),
  description: z.string().trim().nullable().optional(),
  late_to_absent_ratio: z.number().int().min(1).optional(),
  leave_to_absent_ratio: z.number().int().min(1).optional(),
  absent_to_f_ratio: z.number().int().min(1).optional(),
  total_classes: z.number().int().min(1).optional(),
  min_attendance_percent: z.number().min(0).max(100).optional(),
  assignment_weight: z.number().min(0).max(100).optional(),
  post_test_weight: z.number().min(0).max(100).optional(),
  affective_weight: z.number().min(0).max(100).optional(),
  midterm_weight: z.number().min(0).max(100).optional(),
  final_weight: z.number().min(0).max(100).optional(),
  midterm_max_score: z.number().min(0).optional(),
  final_max_score: z.number().min(0).optional(),
  curriculum_type: z.enum(['pvch', 'pvs', 'custom']).optional(),
  total_weeks: z.number().int().min(1).max(52).optional(),
  semester_start_date: z.string().nullable().optional(),
  semester_id: z.number().int().positive().nullable().optional(),
  is_portal_enabled: z.boolean().optional(),
});

// ==================== Semester Schemas ====================
export const SemesterSchema = z.object({
  name: z.string().trim().min(1, 'Semester name is required'),
  term_number: z.number().int().min(1).max(3),
  academic_year: z.string().trim().min(1, 'Academic year is required'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(false),
  curriculum_type: z.enum(['pvch', 'pvs', 'custom']).optional().default('pvch'),
  total_weeks: z.number().int().min(1).max(52).optional().default(18),
});

export const UpdateSemesterSchema = z.object({
  name: z.string().trim().min(1, 'Semester name cannot be empty').optional(),
  term_number: z.number().int().min(1).max(3).optional(),
  academic_year: z.string().trim().min(1).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  curriculum_type: z.enum(['pvch', 'pvs', 'custom']).optional(),
  total_weeks: z.number().int().min(1).max(52).optional(),
});

export const CloneSemesterSchema = z.object({
  target_semester_id: z.coerce.number().int().positive('target_semester_id must be a positive integer'),
  include_students: z.boolean().optional().default(true),
  include_timetable: z.boolean().optional().default(false),
  force_overwrite: z.boolean().optional().default(false),
});


// ==================== Attendance Schemas ====================
export const AttendanceStatusEnum = z.enum(['present', 'late', 'absent', 'leave']);

export const RecordAttendanceSchema = z.object({
  student_id: z.coerce.number().int().positive('Student ID must be a positive integer'),
  classroom_id: z.coerce.number().int().positive('Classroom ID must be a positive integer'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date format'),
  status: AttendanceStatusEnum,
});

export const BulkRecordAttendanceSchema = z.object({
  records: z.array(RecordAttendanceSchema).min(1, 'At least one attendance record is required'),
});

// ==================== Score Schemas ====================
export const ScoreStructureItemSchema = z.object({
  lesson_number: z.coerce.number().int().min(1, 'Lesson number must be at least 1'),
  lesson_name: z.string().optional().default(''),
  max_assignment_score: z.union([z.number(), z.string(), z.null()]).optional(),
  max_post_test_score: z.union([z.number(), z.string(), z.null()]).optional(),
  hours: z.union([z.number(), z.string()]).optional().default(0),
});

export const SaveScoreStructureSchema = z.object({
  classroom_id: z.coerce.number().int().positive().optional(),
  type: z.literal('structure').optional(),
  structures: z.array(ScoreStructureItemSchema).min(1, 'At least one structure is required'),
});

export const LessonScoreItemSchema = z.object({
  student_id: z.coerce.number().int().positive('Student ID must be a positive integer'),
  assignment_score: z.union([z.number(), z.string(), z.null()]).optional(),
  post_test_score: z.union([z.number(), z.string(), z.null()]).optional(),
});

export const SaveLessonScoresSchema = z.object({
  classroom_id: z.coerce.number().int().positive().optional(),
  lesson_number: z.coerce.number().int().min(1, 'Lesson number must be at least 1'),
  scores: z.array(LessonScoreItemSchema).min(1, 'At least one score entry is required'),
});

export const BulkScoreItemSchema = z.object({
  student_id: z.coerce.number().int().positive('Student ID must be a positive integer'),
  lesson_number: z.coerce.number().int().min(1, 'Lesson number must be at least 1'),
  assignment_score: z.union([z.number(), z.string(), z.null()]).optional(),
  post_test_score: z.union([z.number(), z.string(), z.null()]).optional(),
});

export const SaveBulkScoresSchema = z.object({
  classroom_id: z.coerce.number().int().positive().optional(),
  scores: z.array(BulkScoreItemSchema).min(1, 'At least one score entry is required'),
});

// ==================== Validation Helper ====================
export function formatZodError(error: z.ZodError): NextResponse {
  const formattedErrors = error.issues.map((err: z.ZodIssue) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return NextResponse.json(
    {
      message: 'Validation failed',
      errors: formattedErrors,
    },
    { status: 400 }
  );
}

export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, response: formatZodError(result.error) };
  }
  return { success: true, data: result.data };
}

export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    return validateData(body, schema);
  } catch {
    return {
      success: false,
      response: NextResponse.json({ message: 'Invalid JSON request payload' }, { status: 400 }),
    };
  }
}

