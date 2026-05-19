import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const lesson = await prisma.lessonPlan.findUnique({ where: { id: Number(id) } });
    if (!lesson) return NextResponse.json({ message: 'Lesson not found' }, { status: 404 });
    return NextResponse.json(lesson);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get lesson' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['title', 'subject', 'grade_level', 'duration', 'objectives', 'content', 'teaching_methods', 'materials', 'status'];
    const fieldMap: Record<string, string> = {
      grade_level: 'gradeLevel',
      teaching_methods: 'teachingMethods',
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const prismaField = fieldMap[field] || field;
        updateData[prismaField] = body[field];
      }
    }

    await prisma.lessonPlan.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Lesson updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update lesson' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    await prisma.lessonPlan.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Lesson deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete lesson' }, { status: 500 });
  }
}
