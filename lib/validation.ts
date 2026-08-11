import { z } from 'zod';
import { NextResponse } from 'next/server';

// ==================== Auth Schemas ====================
export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().trim().min(1, 'Name is required'),
  role: z.enum(['teacher', 'admin']).optional().default('teacher'),
});

// ==================== Student Schemas ====================
export const CreateStudentSchema = z.object({
  name: z.string().trim().min(1, 'Student name is required'),
  student_code: z.string().trim().nullable().optional(),
  grade_level: z.string().trim().nullable().optional(),
  email: z.string().trim().email('Invalid email address').nullable().optional().or(z.literal('')),
  classroom_id: z.number().nullable().optional(),
});

export const BulkCreateStudentSchema = z.object({
  students: z.array(CreateStudentSchema).min(1, 'At least one student is required'),
});

export const UpdateStudentExamScoresSchema = z.object({
  scores: z.array(
    z.object({
      student_id: z.number(),
      midterm_score: z.union([z.number(), z.string(), z.null()]).optional(),
      final_score: z.union([z.number(), z.string(), z.null()]).optional(),
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

export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return { success: false, response: formatZodError(result.error) };
    }
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: NextResponse.json({ message: 'Invalid JSON request payload' }, { status: 400 }),
    };
  }
}
