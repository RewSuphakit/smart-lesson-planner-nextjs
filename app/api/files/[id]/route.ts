import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const file = await prisma.file.findFirst({ where: { id: Number(id), userId: user.id } });
    if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });

    // Delete physical file
    try {
      const filePath = path.join(process.cwd(), 'public', file.path);
      await unlink(filePath);
    } catch {
      // File may not exist on disk
    }

    await prisma.file.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: 'File deleted' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    return NextResponse.json({ message: 'Failed to delete file' }, { status: 500 });
  }
}
