import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { buildInterviewSystemPrompt, callClaudeForNextQuestion } from '@/lib/anthropic';
import type { PostInterviewResponse, ApiErrorResponse, ClaudeInterviewResponse } from '@/types';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).sessionId !== 'string' ||
      !(body as Record<string, unknown>).sessionId ||
      typeof (body as Record<string, unknown>).userAnswer !== 'string' ||
      !(body as Record<string, unknown>).userAnswer ||
      typeof (body as Record<string, unknown>).currentQuestion !== 'string' ||
      !(body as Record<string, unknown>).currentQuestion
    ) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'sessionId, userAnswer, and currentQuestion are required' },
        { status: 400 }
      );
    }

    const { sessionId, userAnswer, currentQuestion } = body as {
      sessionId: string;
      userAnswer: string;
      currentQuestion: string;
    };

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { job: { include: { skills: true } } },
    });

    if (!session) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Session is not in progress' },
        { status: 409 }
      );
    }

    const existingTurns = await prisma.turn.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const hasAiTurns = existingTurns.some((t) => t.speaker === 'AI');

    // Build conversation history from existing turns
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
      existingTurns.map((turn) => ({
        role: (turn.speaker === 'AI' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: turn.content,
      }));

    // On first call, prepend the initial AI question that was shown to the candidate
    if (!hasAiTurns) {
      conversationHistory.unshift({ role: 'assistant', content: currentQuestion });
    }

    // Always append the candidate's current answer as the last message
    conversationHistory.push({ role: 'user', content: userAnswer });

    // Deduplication guard (retry safety)
    const lastTurn = existingTurns[existingTurns.length - 1];
    const userAnswerAlreadySaved =
      lastTurn?.speaker === 'USER' && lastTurn?.content === userAnswer;

    // Save user answer (pre-Claude) — skip if already saved on a prior retry
    if (!userAnswerAlreadySaved) {
      if (!hasAiTurns) {
        // First turn: also save the initial AI question before the user answer
        await prisma.$transaction([
          prisma.turn.create({
            data: {
              sessionId,
              speaker: 'AI',
              content: currentQuestion,
              decisionState: Prisma.JsonNull,
            },
          }),
          prisma.turn.create({
            data: { sessionId, speaker: 'USER', content: userAnswer },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.turn.create({
            data: { sessionId, speaker: 'USER', content: userAnswer },
          }),
        ]);
      }
    }

    // Build the system prompt and call Claude
    const systemPrompt = buildInterviewSystemPrompt(
      session.job.title,
      session.job.description,
      session.job.skills
    );

    let claudeResponse: ClaudeInterviewResponse;
    try {
      claudeResponse = await callClaudeForNextQuestion(systemPrompt, conversationHistory);
    } catch {
      // Do NOT roll back user turn saves — they reflect real candidate answers
      return NextResponse.json<ApiErrorResponse>(
        { error: 'AI service unavailable. Please try again.' },
        { status: 500 }
      );
    }

    // Save Claude's AI turn and optionally mark session as completed
    if (claudeResponse.isComplete) {
      await prisma.$transaction([
        prisma.turn.create({
          data: {
            sessionId,
            speaker: 'AI',
            content: claudeResponse.question,
            decisionState: claudeResponse.decisionState as object,
          },
        }),
        prisma.session.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.turn.create({
          data: {
            sessionId,
            speaker: 'AI',
            content: claudeResponse.question,
            decisionState: claudeResponse.decisionState as object,
          },
        }),
      ]);
    }

    return NextResponse.json<PostInterviewResponse>({
      nextQuestion: claudeResponse.question,
      isComplete: claudeResponse.isComplete,
      decisionState: claudeResponse.decisionState,
    });
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
