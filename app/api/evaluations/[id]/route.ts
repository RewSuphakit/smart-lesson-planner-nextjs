import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.score !== undefined) updateData.score = body.score;
    if (body.max_score !== undefined) updateData.maxScore = body.max_score;
    if (body.participation !== undefined) updateData.participation = body.participation;
    if (body.notes !== undefined) updateData.notes = body.notes;

    await prisma.evaluation.update({ where: { id: Number(id) }, data: updateData });
    return NextResponse.json({ message: 'Evaluation updated' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to update evaluation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    await prisma.evaluation.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'Evaluation deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete evaluation' }, { status: 500 });
  }
}
