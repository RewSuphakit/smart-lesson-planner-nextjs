import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { getThaiHolidays } from '@/lib/thaiHolidays';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { message: 'start_date and end_date query parameters are required' },
        { status: 400 }
      );
    }

    const holidays = getThaiHolidays(startDate, endDate);
    return NextResponse.json({ data: holidays });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('Fetch holidays error:', error);
    return NextResponse.json({ message: 'Failed to fetch holidays' }, { status: 500 });
  }
}
