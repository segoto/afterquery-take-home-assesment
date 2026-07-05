import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/ai-client';
import { buildEvaluationPrompt } from '@/lib/anthropic';
import { prisma } from '@/lib/prisma';
import type { ApiErrorResponse } from '@/types';

interface EvaluateSuccessResponse {
  id: string;
  strengths: string[];
  concerns: string[];
  score: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<EvaluateSuccessResponse | ApiErrorResponse>> {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).sessionId !== 'string' ||
      !(body as Record<string, unknown>).sessionId
    ) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const { sessionId } = body as { sessionId: string };

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'ABANDONED') {
      return NextResponse.json(
        { error: 'Session is not in progress or completed' },
        { status: 409 }
      );
    }

    const existingEvaluation = await prisma.evaluation.findUnique({
      where: { sessionId },
    });

    if (existingEvaluation) {
      return NextResponse.json(
        { error: 'Evaluation already exists' },
        { status: 409 }
      );
    }

    const turns = await prisma.turn.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const rawResponse = await aiClient.complete({
      systemPrompt: '',
      messages: [{ role: 'user', content: buildEvaluationPrompt(turns) }],
    });

    const cleaned = rawResponse
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'AI returned an unparseable evaluation' },
        { status: 502 }
      );
    }

    const strengths: string[] = Array.isArray(parsed.strengths)
      ? (parsed.strengths as string[])
      : [];
    const concerns: string[] = Array.isArray(parsed.concerns)
      ? (parsed.concerns as string[])
      : [];
    const rawScore = Number(parsed.overall_score);
    const rounded = Math.round(rawScore);
    const score = Math.max(1, Math.min(10, rounded));

    const evaluation = await prisma.evaluation.create({
      data: { sessionId, strengths, concerns, score },
    });

    if (!session.endedAt) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
    }

    return NextResponse.json(
      { id: evaluation.id, strengths, concerns, score },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
