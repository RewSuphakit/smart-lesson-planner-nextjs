import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
import { generateLessonPlan } from '@/lib/ai-service';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 20));
    const status = searchParams.get('status');
    const subject = searchParams.get('subject');

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    if (subject) where.subject = { contains: subject };

    const [data, total] = await Promise.all([
      prisma.lessonPlan.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lessonPlan.count({ where }),
    ]);

    const mappedData = data.map(l => ({
      id: l.id,
      user_id: l.userId,
      title: l.title,
      subject: l.subject,
      grade_level: l.gradeLevel,
      duration: l.duration,
      objectives: l.objectives,
      content: l.content,
      teaching_methods: l.teachingMethods,
      materials: l.materials,
      ai_generated: l.aiGenerated,
      status: l.status,
      created_at: l.createdAt,
      updated_at: l.updatedAt
    }));

    return NextResponse.json({ data: mappedData, total, page, limit });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Get lessons error:', error);
    return NextResponse.json({ message: 'Failed to get lessons' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    const lessonPlan = await prisma.lessonPlan.create({
      data: {
        userId: user.id,
        title: body.title,
        subject: body.subject,
        gradeLevel: body.grade_level,
        duration: body.duration,
        objectives: body.objectives || null,
        content: body.content || null,
        teachingMethods: body.teaching_methods || null,
        materials: body.materials || null,
        aiGenerated: body.ai_generated || false,
        status: body.status || 'draft',
      },
    });

    return NextResponse.json(lessonPlan, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Create lesson error:', error);
    return NextResponse.json({ message: 'Failed to create lesson' }, { status: 500 });
  }
}
