import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { PostInterviewResponse, ApiErrorResponse } from '@/types';

const PLACEHOLDER_QUESTIONS: readonly string[] = [
  "Welcome! Please start by telling me about yourself and your background.",
  "Can you describe a challenging project you've worked on recently?",
  "How do you approach debugging a complex issue in production?",
  "Tell me about a time you disagreed with a team member. How did you handle it?",
  "How do you prioritize tasks when you have multiple deadlines?",
  "What are you most proud of in your career so far?",
  "Do you have any questions for us?",
] as const;

const NEXT_QUESTION =
  "Thank you. Can you walk me through a specific challenge you faced in a previous role and how you resolved it?";

export async function POST(
  request: NextRequest
): Promise<NextResponse<PostInterviewResponse | ApiErrorResponse>> {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).sessionId !== 'string' ||
      !(body as Record<string, unknown>).sessionId ||
      typeof (body as Record<string, unknown>).userAnswer !== 'string' ||
      !(body as Record<string, unknown>).userAnswer ||
      !Number.isInteger((body as Record<string, unknown>).turnNumber) ||
      ((body as Record<string, unknown>).turnNumber as number) < 0
    ) {
      return NextResponse.json(
        { error: 'sessionId, userAnswer, and turnNumber are required' },
        { status: 400 }
      );
    }

    const { sessionId, userAnswer, turnNumber } = body as {
      sessionId: string;
      userAnswer: string;
      turnNumber: number;
    };

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Session is not in progress' },
        { status: 409 }
      );
    }

    const questionContent = PLACEHOLDER_QUESTIONS[turnNumber] ?? PLACEHOLDER_QUESTIONS[0];

    await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: questionContent,
        },
      }),
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'USER',
          content: userAnswer,
        },
      }),
    ]);

    return NextResponse.json(
      { nextQuestion: NEXT_QUESTION, isComplete: false },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
