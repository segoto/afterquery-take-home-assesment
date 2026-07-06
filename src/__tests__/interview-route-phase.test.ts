/**
 * Phase-routing unit tests for POST /api/interview
 *
 * Covers the three routing phases driven by `openrouterCount` (number of
 * OPENROUTER-sourced AI turns already in the session):
 *
 *   Phase: complete          — openrouterCount >= 2
 *   Phase: openrouter-followup-2 — openrouterCount === 1
 *   Phase: main-interview    — openrouterCount === 0
 *
 * Seven branches verified:
 *   1. openrouterCount >= 2  → closing statement, isComplete: true, session COMPLETED
 *   2. openrouterCount === 1 + OpenRouter success → follow-up 2, isComplete: false
 *   3. openrouterCount === 1 + OpenRouter returns null → fall through to complete
 *   4. openrouterCount === 1 + OpenRouter throws → fall through to complete
 *   5. openrouterCount === 0 + Anthropic isComplete: false → ANTHROPIC turn saved
 *   6. openrouterCount === 0 + Anthropic isComplete: true + OpenRouter success
 *      → follow-up 1 returned, isComplete: false, session NOT COMPLETED
 *   7. openrouterCount === 0 + Anthropic isComplete: true + OpenRouter throws
 *      → Anthropic closing returned, isComplete: true, session COMPLETED
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 * Mocks: @/lib/prisma, @/lib/anthropic, @/lib/openrouter
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { ClaudeInterviewResponse } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const CLOSING_STATEMENT =
  "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.";

const SESSION_ID = 'session-phase-test';

// ── Mock functions ─────────────────────────────────────────────────────────────

const mockSessionFindUnique = jest.fn<
  (args: unknown) => Promise<{
    id: string;
    status: string;
    job: {
      id: string;
      title: string;
      description: string;
      skills: Array<{ id: string; name: string; weight: number }>;
    };
  } | null>
>();

const mockSessionUpdate = jest.fn<
  (args: unknown) => Promise<{ id: string; status: string }>
>();

const mockTurnCreate = jest.fn<(args: unknown) => Promise<{ id: string }>>();

const mockTurnFindMany = jest.fn<
  (args: unknown) => Promise<
    Array<{
      id: string;
      sessionId: string;
      speaker: string;
      content: string;
      source: string | null;
      decisionState: unknown;
      createdAt: Date;
    }>
  >
>();

const mockTransaction = jest.fn<(ops: unknown) => Promise<unknown[]>>();

const mockCallClaudeForNextQuestion = jest.fn<() => Promise<ClaudeInterviewResponse>>();
const mockBuildInterviewSystemPrompt = jest.fn<() => string>().mockReturnValue('system-prompt');

const mockGenerateAdaptiveFollowUp = jest.fn<
  (transcript: Array<{ speaker: string; content: string }>, followUpIndex: 1 | 2) => Promise<string | null>
>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
    turn: {
      create: mockTurnCreate,
      findMany: mockTurnFindMany,
    },
    $transaction: mockTransaction,
  },
}));

jest.unstable_mockModule('@/lib/anthropic', () => ({
  callClaudeForNextQuestion: mockCallClaudeForNextQuestion,
  buildInterviewSystemPrompt: mockBuildInterviewSystemPrompt,
  buildEvaluationPrompt: jest.fn().mockReturnValue('eval-prompt'),
  INTERVIEW_COMPLETE_SENTINEL: '[INTERVIEW_COMPLETE]',
  anthropic: {},
}));

jest.unstable_mockModule('@/lib/openrouter', () => ({
  generateAdaptiveFollowUp: mockGenerateAdaptiveFollowUp,
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('@/app/api/interview/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/interview', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
  sessionId: SESSION_ID,
  userAnswer: 'My answer about the topic.',
  currentQuestion: 'Tell me about yourself.',
};

const validSession = {
  id: SESSION_ID,
  status: 'IN_PROGRESS',
  job: {
    id: 'job-1',
    title: 'Software Engineer',
    description: 'Build great software.',
    skills: [] as Array<{ id: string; name: string; weight: number }>,
  },
};

const anthropicDecisionState = {
  selectedQuestionId: null,
  detectedSkills: ['TypeScript'],
  coveredTopics: ['Background'],
  remainingGaps: [],
  questionRationale: 'All topics covered.',
};

const anthropicCompleteResponse: ClaudeInterviewResponse = {
  question: 'Thank you for your answers — this concludes the structured portion.',
  isComplete: true,
  decisionState: anthropicDecisionState,
};

const anthropicInProgressResponse: ClaudeInterviewResponse = {
  question: 'Can you describe your experience with TypeScript?',
  isComplete: false,
  decisionState: {
    selectedQuestionId: null,
    detectedSkills: [],
    coveredTopics: ['Background'],
    remainingGaps: ['TypeScript'],
    questionRationale: 'Probing TypeScript experience.',
  },
};

/** Simulates a session with two OPENROUTER AI turns already saved */
const turnsWithTwoOpenRouter = [
  { id: 't1', sessionId: SESSION_ID, speaker: 'AI', content: 'First Anthropic question', source: 'ANTHROPIC', decisionState: null, createdAt: new Date() },
  { id: 't2', sessionId: SESSION_ID, speaker: 'USER', content: 'First user answer', source: null, decisionState: null, createdAt: new Date() },
  { id: 't3', sessionId: SESSION_ID, speaker: 'AI', content: 'Follow-up 1 from OpenRouter', source: 'OPENROUTER', decisionState: null, createdAt: new Date() },
  { id: 't4', sessionId: SESSION_ID, speaker: 'USER', content: 'Second user answer', source: null, decisionState: null, createdAt: new Date() },
  { id: 't5', sessionId: SESSION_ID, speaker: 'AI', content: 'Follow-up 2 from OpenRouter', source: 'OPENROUTER', decisionState: null, createdAt: new Date() },
];

/** Simulates a session with one OPENROUTER AI turn already saved */
const turnsWithOneOpenRouter = [
  { id: 't1', sessionId: SESSION_ID, speaker: 'AI', content: 'First Anthropic question', source: 'ANTHROPIC', decisionState: null, createdAt: new Date() },
  { id: 't2', sessionId: SESSION_ID, speaker: 'USER', content: 'First user answer', source: null, decisionState: null, createdAt: new Date() },
  { id: 't3', sessionId: SESSION_ID, speaker: 'AI', content: 'Follow-up 1 from OpenRouter', source: 'OPENROUTER', decisionState: null, createdAt: new Date() },
];

/** Simulates a session with only ANTHROPIC AI turns (no OpenRouter turns) */
const turnsWithNoOpenRouter = [
  { id: 't1', sessionId: SESSION_ID, speaker: 'AI', content: 'First Anthropic question', source: 'ANTHROPIC', decisionState: null, createdAt: new Date() },
  { id: 't2', sessionId: SESSION_ID, speaker: 'USER', content: 'First user answer', source: null, decisionState: null, createdAt: new Date() },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/interview — phase routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue(validSession);
    mockTurnCreate.mockResolvedValue({ id: 'new-turn' });
    mockTransaction.mockResolvedValue([]);
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID, status: 'COMPLETED' });
    mockBuildInterviewSystemPrompt.mockReturnValue('system-prompt');
  });

  // ── Branch 1: Phase complete (openrouterCount >= 2) ────────────────────────

  describe('Branch 1 — Phase: complete (openrouterCount >= 2)', () => {
    beforeEach(() => {
      // Both fetchMany calls return the same data (existingTurns + fetchFullTranscript)
      mockTurnFindMany.mockResolvedValue(turnsWithTwoOpenRouter);
    });

    it('returns the static closing statement with isComplete: true', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe(CLOSING_STATEMENT);
      expect(body.isComplete).toBe(true);
      expect(body.decisionState).toBeNull();
    });

    it('saves closing statement and marks session COMPLETED in a single $transaction', async () => {
      await POST(makeRequest(VALID_BODY));
      // One $transaction for USER turn save + one $transaction for closing+COMPLETED
      // openrouterCount >= 2 branch: saves closing + marks COMPLETED in one $transaction
      expect(mockTransaction).toHaveBeenCalledTimes(2); // USER save + closing+COMPLETED
      // Verify session update was queued inside a $transaction (not called directly)
      expect(mockSessionUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } })
      );
    });

    it('does NOT call Anthropic or OpenRouter', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockCallClaudeForNextQuestion).not.toHaveBeenCalled();
      expect(mockGenerateAdaptiveFollowUp).not.toHaveBeenCalled();
    });
  });

  // ── Branch 2: openrouterCount === 1 + OpenRouter success ──────────────────

  describe('Branch 2 — Phase: openrouter-followup-2, OpenRouter succeeds', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithOneOpenRouter);
      mockGenerateAdaptiveFollowUp.mockResolvedValue('Follow-up question 2 from OpenRouter');
    });

    it('returns the follow-up question with isComplete: false and decisionState: null', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe('Follow-up question 2 from OpenRouter');
      expect(body.isComplete).toBe(false);
      expect(body.decisionState).toBeNull();
    });

    it('saves an OPENROUTER turn via turn.create (not $transaction)', async () => {
      await POST(makeRequest(VALID_BODY));
      // $transaction used only for the USER turn save
      // OPENROUTER turn saved via direct turn.create
      const createCalls = mockTurnCreate.mock.calls;
      const openrouterTurnCall = createCalls.find((call) => {
        const args = call[0] as { data?: { source?: string } };
        return args?.data?.source === 'OPENROUTER';
      });
      expect(openrouterTurnCall).toBeDefined();
    });

    it('does NOT mark session as COMPLETED', async () => {
      await POST(makeRequest(VALID_BODY));
      // No session update with COMPLETED status
      const transactionCalls = mockTransaction.mock.calls;
      for (const call of transactionCalls) {
        const ops = call[0] as unknown[];
        // Check that no session.update (mockSessionUpdate) was called with COMPLETED
        expect(mockSessionUpdate).not.toHaveBeenCalled();
        // ops array exists (USER turn save)
        expect(Array.isArray(ops)).toBe(true);
      }
    });

    it('calls generateAdaptiveFollowUp with followUpIndex 2', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockGenerateAdaptiveFollowUp).toHaveBeenCalledWith(
        expect.any(Array),
        2
      );
    });

    it('does NOT call Anthropic', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockCallClaudeForNextQuestion).not.toHaveBeenCalled();
    });
  });

  // ── Branch 3: openrouterCount === 1 + OpenRouter returns null ─────────────

  describe('Branch 3 — Phase: openrouter-followup-2, OpenRouter returns null', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithOneOpenRouter);
      mockGenerateAdaptiveFollowUp.mockResolvedValue(null);
    });

    it('falls through to complete: returns closing statement with isComplete: true', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe(CLOSING_STATEMENT);
      expect(body.isComplete).toBe(true);
      expect(body.decisionState).toBeNull();
    });

    it('marks session COMPLETED in a $transaction', async () => {
      await POST(makeRequest(VALID_BODY));
      // $transaction called: once for USER turn save, once for closing+COMPLETED
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── Branch 4: openrouterCount === 1 + OpenRouter throws ───────────────────

  describe('Branch 4 — Phase: openrouter-followup-2, OpenRouter throws', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithOneOpenRouter);
      mockGenerateAdaptiveFollowUp.mockRejectedValue(new Error('OpenRouter network error'));
    });

    it('falls through to complete: returns closing statement with isComplete: true', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe(CLOSING_STATEMENT);
      expect(body.isComplete).toBe(true);
      expect(body.decisionState).toBeNull();
    });

    it('does not propagate the OpenRouter error as a 500', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
    });

    it('marks session COMPLETED in a $transaction', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── Branch 5: openrouterCount === 0, Anthropic isComplete: false ──────────

  describe('Branch 5 — Phase: main-interview, Anthropic not done', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithNoOpenRouter);
      mockCallClaudeForNextQuestion.mockResolvedValue(anthropicInProgressResponse);
    });

    it('returns the Anthropic question with isComplete: false and the Anthropic decisionState', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe(anthropicInProgressResponse.question);
      expect(body.isComplete).toBe(false);
      expect(body.decisionState).toEqual(anthropicInProgressResponse.decisionState);
    });

    it('saves ANTHROPIC turn via turn.create with source ANTHROPIC', async () => {
      await POST(makeRequest(VALID_BODY));
      const createCalls = mockTurnCreate.mock.calls;
      const anthropicTurnCall = createCalls.find((call) => {
        const args = call[0] as { data?: { source?: string; speaker?: string } };
        return args?.data?.source === 'ANTHROPIC' && args?.data?.speaker === 'AI';
      });
      expect(anthropicTurnCall).toBeDefined();
    });

    it('does NOT call generateAdaptiveFollowUp', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockGenerateAdaptiveFollowUp).not.toHaveBeenCalled();
    });

    it('does NOT mark session as COMPLETED', async () => {
      await POST(makeRequest(VALID_BODY));
      // Only 1 $transaction: the USER turn save; no closing $transaction
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Branch 6: openrouterCount === 0, Anthropic done, OpenRouter success ───

  describe('Branch 6 — Phase: main-interview, Anthropic done, OpenRouter follow-up 1 succeeds', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithNoOpenRouter);
      mockCallClaudeForNextQuestion.mockResolvedValue(anthropicCompleteResponse);
      mockGenerateAdaptiveFollowUp.mockResolvedValue('Adaptive follow-up 1 question');
    });

    it('returns the OpenRouter follow-up with isComplete: false and decisionState: null', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe('Adaptive follow-up 1 question');
      expect(body.isComplete).toBe(false);
      expect(body.decisionState).toBeNull();
    });

    it('saves OPENROUTER turn with source OPENROUTER and speaker AI', async () => {
      await POST(makeRequest(VALID_BODY));
      const createCalls = mockTurnCreate.mock.calls;
      const openrouterTurnCall = createCalls.find((call) => {
        const args = call[0] as { data?: { source?: string; speaker?: string } };
        return args?.data?.source === 'OPENROUTER' && args?.data?.speaker === 'AI';
      });
      expect(openrouterTurnCall).toBeDefined();
    });

    it('does NOT save Anthropic closing turn', async () => {
      await POST(makeRequest(VALID_BODY));
      // Only the USER turn is saved via $transaction; the OPENROUTER turn is via direct create
      // No ANTHROPIC AI turn with closing content should be saved
      const createCalls = mockTurnCreate.mock.calls;
      const anthropicClosingCall = createCalls.find((call) => {
        const args = call[0] as { data?: { content?: string; source?: string; speaker?: string } };
        return (
          args?.data?.speaker === 'AI' &&
          args?.data?.source === 'ANTHROPIC' &&
          args?.data?.content === anthropicCompleteResponse.question
        );
      });
      expect(anthropicClosingCall).toBeUndefined();
    });

    it('does NOT mark session as COMPLETED', async () => {
      await POST(makeRequest(VALID_BODY));
      // Only the USER turn $transaction; no closing $transaction with session update
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockSessionUpdate).not.toHaveBeenCalled();
    });

    it('calls generateAdaptiveFollowUp with followUpIndex 1', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockGenerateAdaptiveFollowUp).toHaveBeenCalledWith(
        expect.any(Array),
        1
      );
    });
  });

  // ── Branch 7: openrouterCount === 0, Anthropic done, OpenRouter fails ─────

  describe('Branch 7 — Phase: main-interview, Anthropic done, OpenRouter follow-up 1 fails', () => {
    beforeEach(() => {
      mockTurnFindMany.mockResolvedValue(turnsWithNoOpenRouter);
      mockCallClaudeForNextQuestion.mockResolvedValue(anthropicCompleteResponse);
      // Simulate OpenRouter failure
      mockGenerateAdaptiveFollowUp.mockRejectedValue(new Error('OpenRouter API error'));
    });

    it('returns the Anthropic closing question with isComplete: true', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextQuestion).toBe(anthropicCompleteResponse.question);
      expect(body.isComplete).toBe(true);
      expect(body.decisionState).toEqual(anthropicCompleteResponse.decisionState);
    });

    it('saves Anthropic closing turn and marks session COMPLETED in a $transaction', async () => {
      await POST(makeRequest(VALID_BODY));
      // $transaction called: once for USER turn save, once for AI closing + session COMPLETED
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('does not propagate the OpenRouter error as a 500', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
    });

    it('saves the Anthropic closing turn with source ANTHROPIC', async () => {
      await POST(makeRequest(VALID_BODY));
      const createCalls = mockTurnCreate.mock.calls;
      const anthropicClosingCall = createCalls.find((call) => {
        const args = call[0] as { data?: { source?: string; speaker?: string; content?: string } };
        return (
          args?.data?.source === 'ANTHROPIC' &&
          args?.data?.speaker === 'AI' &&
          args?.data?.content === anthropicCompleteResponse.question
        );
      });
      expect(anthropicClosingCall).toBeDefined();
    });

    it('also works when OpenRouter returns null instead of throwing', async () => {
      mockGenerateAdaptiveFollowUp.mockResolvedValue(null);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isComplete).toBe(true);
      expect(body.nextQuestion).toBe(anthropicCompleteResponse.question);
    });
  });
});
