import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const files = await prisma.file.findMany({
      where: { userId: user.id },
      include: { lessonPlan: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: files });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to get files' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File | null;
    const lessonPlanId = formData.get('lesson_plan_id') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv', 'application/vnd.ms-excel',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: 'File type not allowed' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.name);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const savedFile = await prisma.file.create({
      data: {
        userId: user.id,
        lessonPlanId: lessonPlanId ? Number(lessonPlanId) : null,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: `/uploads/${filename}`,
      },
    });

    return NextResponse.json(savedFile, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
