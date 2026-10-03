import { NextResponse } from 'next/server';
import prisma, { withDbRetry } from '@/lib/prisma';

export async function GET() {
  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`);
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const err = error as { message?: string; code?: string };
    console.error('Health check database failure:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: err?.message || String(error),
        code: err?.code,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
