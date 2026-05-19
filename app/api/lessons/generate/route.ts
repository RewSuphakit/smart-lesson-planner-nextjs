import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { generateLessonPlan } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ message: 'Prompt is required' }, { status: 400 });
    }

    const lessonPlan = await generateLessonPlan(prompt);
    return NextResponse.json(lessonPlan);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: 401 });
    console.error('Generate lesson error:', error);
    return NextResponse.json({ message: 'Failed to generate lesson plan' }, { status: 500 });
  }
}
