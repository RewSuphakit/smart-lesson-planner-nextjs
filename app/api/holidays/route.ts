import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiHandler';
import { getThaiHolidays } from '@/lib/thaiHolidays';

export const GET = withAuth(async (request) => {
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
}, 'Failed to fetch holidays');
