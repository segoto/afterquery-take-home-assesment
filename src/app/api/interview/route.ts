import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { buildBankSelectionPrompt, callModelForBankSelection } from '@/lib/bank-selection';
import { generateAdaptiveFollowUp } from '@/lib/openrouter';
import type { PostInterviewSuccessResponse, ApiErrorResponse, BankSelectionResponse, BankQuestion } from '@/types';

const CLOSING_STATEMENT =
  "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.";

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
      include: { job: true },
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
    const openrouterCount = existingTurns.filter(
      (t) => t.speaker === 'AI' && t.source === 'OPENROUTER'
    ).length;

    // Deduplication guard (retry safety)
    const lastTurn = existingTurns[existingTurns.length - 1];
    const userAnswerAlreadySaved =
      lastTurn?.speaker === 'USER' && lastTurn?.content === userAnswer;

    // Save user answer before phase routing — runs for all phases
    if (!userAnswerAlreadySaved) {
      if (!hasAiTurns) {
        // First turn: also save the initial AI question before the user answer
        await prisma.$transaction([
          prisma.turn.create({
            data: {
              sessionId,
              speaker: 'AI',
              content: currentQuestion,
              source: 'ANTHROPIC',
              decisionState: Prisma.JsonNull,
            },
          }),
          prisma.turn.create({
            data: { sessionId, speaker: 'USER', content: userAnswer },
          }),
        ]);
      } else {
        await prisma.turn.create({
          data: { sessionId, speaker: 'USER', content: userAnswer },
        });
      }
    }

    // Re-fetch full transcript after saving the user answer (used by OpenRouter calls)
    async function fetchFullTranscript() {
      const allTurns = await prisma.turn.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
      return allTurns.map((t) => ({
        speaker: t.speaker as string,
        content: t.content,
      }));
    }

    // Phase: complete — both OpenRouter follow-ups already delivered
    if (openrouterCount >= 2) {
      await prisma.$transaction([
        prisma.turn.create({
          data: {
            sessionId,
            speaker: 'AI',
            content: CLOSING_STATEMENT,
            source: 'ANTHROPIC',
            decisionState: Prisma.JsonNull,
          },
        }),
        prisma.session.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        }),
      ]);
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion: CLOSING_STATEMENT,
        isComplete: true,
        decisionState: null,
      });
    }

    // Phase: openrouter-followup-2 — candidate answered follow-up 1, generate follow-up 2
    if (openrouterCount === 1) {
      let followUp2: string | null = null;
      try {
        const transcript = await fetchFullTranscript();
        followUp2 = await generateAdaptiveFollowUp(transcript, 2);
      } catch {
        followUp2 = null; // graceful degradation on network/API error
      }
      if (followUp2 && followUp2.trim()) {
        await prisma.turn.create({
          data: { sessionId, speaker: 'AI', content: followUp2.trim(), source: 'OPENROUTER' },
        });
        return NextResponse.json<PostInterviewSuccessResponse>({
          nextQuestion: followUp2.trim(),
          isComplete: false,
          decisionState: null,
        });
      }
      // Follow-up 2 unavailable — close interview gracefully
      await prisma.$transaction([
        prisma.turn.create({
          data: {
            sessionId,
            speaker: 'AI',
            content: CLOSING_STATEMENT,
            source: 'ANTHROPIC',
            decisionState: Prisma.JsonNull,
          },
        }),
        prisma.session.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        }),
      ]);
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion: CLOSING_STATEMENT,
        isComplete: true,
        decisionState: null,
      });
    }

    // Phase: main-interview (openrouterCount === 0) — bank-based question selection
    const fullBank = await prisma.question.findMany({
      where: { jobId: session.jobId },
      select: { id: true, text: true, type: true },
      orderBy: { createdAt: 'asc' },
    }) as BankQuestion[];

    const usedQuestionIds = new Set<string>();
    for (const turn of existingTurns) {
      if (turn.speaker === 'AI' && turn.decisionState !== null) {
        const ds = turn.decisionState as Record<string, unknown>;
        if (typeof ds.selectedQuestionId === 'string' && ds.selectedQuestionId !== '') {
          usedQuestionIds.add(ds.selectedQuestionId);
        }
      }
    }

    const remainingQuestions = fullBank.filter((q) => !usedQuestionIds.has(q.id));
    const aiTurnCount = existingTurns.filter((t) => t.speaker === 'AI').length;

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
      existingTurns.map((turn) => ({
        role: (turn.speaker === 'AI' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: turn.content,
      }));

    if (!hasAiTurns) {
      conversationHistory.unshift({ role: 'assistant', content: currentQuestion });
    }
    conversationHistory.push({ role: 'user', content: userAnswer });

    let nextQuestion: string;
    let isComplete: boolean;
    let decisionStateData: BankSelectionResponse;

    if (remainingQuestions.length === 0 && aiTurnCount >= 6) {
      // Bank exhausted and minimum turns met — signal complete without a model call
      nextQuestion = CLOSING_STATEMENT;
      isComplete = true;
      decisionStateData = {
        selectedQuestionId: null,
        question: nextQuestion,
        isComplete: true,
        detectedSkills: [],
        coveredTopics: [],
        remainingGaps: [],
        questionRationale: 'Bank fully covered. Interview closed.',
      };
    } else {
      const systemPrompt = buildBankSelectionPrompt(
        session.job.title,
        session.job.description,
        remainingQuestions,
        aiTurnCount,
      );
      let modelResponse: BankSelectionResponse;
      try {
        modelResponse = await callModelForBankSelection(systemPrompt, conversationHistory);
      } catch {
        return NextResponse.json<ApiErrorResponse>(
          { error: 'AI service unavailable. Please try again.' },
          { status: 500 }
        );
      }
      nextQuestion = modelResponse.question;
      isComplete = modelResponse.isComplete;
      decisionStateData = modelResponse;
    }

    const storedDecisionState = {
      selectedQuestionId: decisionStateData.selectedQuestionId,
      detectedSkills: decisionStateData.detectedSkills,
      coveredTopics: decisionStateData.coveredTopics,
      remainingGaps: decisionStateData.remainingGaps,
      questionRationale: decisionStateData.questionRationale,
    };

    if (!isComplete) {
      await prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: nextQuestion,
          source: 'ANTHROPIC',
          decisionState: storedDecisionState as object,
        },
      });
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion,
        isComplete: false,
        decisionState: storedDecisionState,
      });
    }

    // Bank signals complete — attempt OpenRouter follow-up 1 before closing
    let followUp1: string | null = null;
    try {
      const transcript = await fetchFullTranscript();
      followUp1 = await generateAdaptiveFollowUp(transcript, 1);
    } catch {
      followUp1 = null; // graceful degradation
    }
    if (followUp1 && followUp1.trim()) {
      await prisma.turn.create({
        data: { sessionId, speaker: 'AI', content: followUp1.trim(), source: 'OPENROUTER' },
      });
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion: followUp1.trim(),
        isComplete: false,
        decisionState: null,
      });
    }

    // OpenRouter follow-up 1 unavailable — close interview now
    await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: nextQuestion,
          source: 'ANTHROPIC',
          decisionState: storedDecisionState as object,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      }),
    ]);
    return NextResponse.json<PostInterviewSuccessResponse>({
      nextQuestion,
      isComplete: true,
      decisionState: storedDecisionState,
    });
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
