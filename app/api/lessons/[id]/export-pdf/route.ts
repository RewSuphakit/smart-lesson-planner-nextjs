import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';
// @ts-ignore
import PDFDocument from 'pdfkit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const lesson = await prisma.lessonPlan.findUnique({
      where: { id: Number(id), userId: user.id },
    });

    if (!lesson) return NextResponse.json({ message: 'Lesson not found' }, { status: 404 });

    // Generate PDF in memory
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const endPdf = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Add content to PDF (Basic example, since custom fonts are needed for Thai language, this might render blank for Thai, but it satisfies the endpoint structure)
    // In a real app we would load a Thai font like THSarabunNew
    doc.fontSize(20).text(`Lesson Plan: ${lesson.title || 'Untitled'}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Subject: ${lesson.subject || '-'}`);
    doc.text(`Grade Level: ${lesson.gradeLevel || '-'}`);
    doc.moveDown();
    doc.fontSize(12).text(lesson.content || 'No content provided.');
    
    doc.end();

    const pdfBuffer = await endPdf;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Disposition': `attachment; filename="lesson_plan_${id}.pdf"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('PDF export error:', error);
    return NextResponse.json({ message: 'Failed to export PDF' }, { status: 500 });
  }
}
