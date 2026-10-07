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
    const isProd = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: isProd ? 'Database connection error' : (err?.message || String(error)),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
