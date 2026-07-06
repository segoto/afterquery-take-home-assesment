import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getStaticQuestionBank } from '@/lib/question-bank';
import { buildBankSelectionPrompt, callModelForBankSelection } from '@/lib/bank-selection';
import type { PostInterviewResponse, ApiErrorResponse, BankSelectionResponse } from '@/types';

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

    // Load the static question bank for this job
    const fullBank = getStaticQuestionBank(session.jobId);

    // Collect IDs of bank questions already asked (from AI turn decisionState)
    const usedQuestionIds = new Set<string>();
    for (const turn of existingTurns) {
      if (turn.speaker === 'AI' && turn.decisionState !== null) {
        const ds = turn.decisionState as Record<string, unknown>;
        if (typeof ds.selectedQuestionId === 'string' && ds.selectedQuestionId !== '') {
          usedQuestionIds.add(ds.selectedQuestionId);
        }
      }
    }

    // Filter to questions not yet asked
    const remainingQuestions = fullBank.filter((q) => !usedQuestionIds.has(q.id));

    // Count AI turns already saved (includes the initial hardcoded question turn)
    const aiTurnCount = existingTurns.filter((t) => t.speaker === 'AI').length;

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

    // Save user answer (pre-model) — skip if already saved on a prior retry
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
        await prisma.$transaction([
          prisma.turn.create({
            data: { sessionId, speaker: 'USER', content: userAnswer },
          }),
        ]);
      }
    }

    let nextQuestion: string;
    let isComplete: boolean;
    let decisionStateData: BankSelectionResponse;

    if (remainingQuestions.length === 0 && aiTurnCount >= 6) {
      // Bank fully exhausted and minimum questions met — close without model call
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
      // Call the model for bank-based selection
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

    if (isComplete) {
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
    } else {
      await prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: nextQuestion,
          source: 'ANTHROPIC',
          decisionState: storedDecisionState as object,
        },
      });
    }

    return NextResponse.json<PostInterviewResponse>({
      nextQuestion,
      isComplete,
      decisionState: storedDecisionState,
    });
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
