import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const file = await prisma.file.findFirst({ where: { id: Number(id), userId: user.id } });
    if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });

    const filePath = path.join(process.cwd(), 'public', file.path);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        'Content-Type': file.mimeType,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('File download error:', error);
    return NextResponse.json({ message: 'Failed to download file' }, { status: 500 });
  }
}
