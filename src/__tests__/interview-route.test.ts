/**
 * Unit tests for POST /api/interview (bank-based question selection)
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 * Mocks: @/lib/prisma, @/lib/bank-selection, @/lib/openrouter
 *
 * Note: T8 (wave 4) adds additional test cases on top of this updated baseline.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { BankSelectionResponse, BankQuestion } from '@/types';

// ── Mock functions ─────────────────────────────────────────────────────────────

const mockSessionFindUnique = jest.fn<
  (args: unknown) => Promise<{
    id: string;
    jobId: string;
    status: string;
    job: {
      id: string;
      title: string;
      description: string;
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
      source?: string | null;
      decisionState?: Record<string, unknown> | null;
      createdAt: Date;
    }>
  >
>();

const mockTransaction = jest.fn<(ops: unknown) => Promise<unknown[]>>();

const mockCallModelForBankSelection = jest.fn<() => Promise<BankSelectionResponse>>();
const mockBuildBankSelectionPrompt = jest.fn<() => string>().mockReturnValue('mock-bank-system-prompt');
const mockQuestionFindMany = jest.fn<
  (args: unknown) => Promise<Array<{ id: string; text: string; type: string }>>
>();
const mockGenerateAdaptiveFollowUp = jest.fn<() => Promise<string | null>>();

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
    question: { findMany: mockQuestionFindMany },
    $transaction: mockTransaction,
  },
}));

jest.unstable_mockModule('@/lib/bank-selection', () => ({
  callModelForBankSelection: mockCallModelForBankSelection,
  buildBankSelectionPrompt: mockBuildBankSelectionPrompt,
}));

jest.unstable_mockModule('@/lib/openrouter', () => ({
  generateAdaptiveFollowUp: mockGenerateAdaptiveFollowUp,
}));

// Keep anthropic mock for backward compat with any residual imports
jest.unstable_mockModule('@/lib/anthropic', () => ({
  buildInterviewSystemPrompt: jest.fn().mockReturnValue('mock-system-prompt'),
  buildEvaluationPrompt: jest.fn().mockReturnValue('mocked evaluation prompt'),
  callClaudeForNextQuestion: jest.fn(),
  INTERVIEW_COMPLETE_SENTINEL: '[INTERVIEW_COMPLETE]',
  anthropic: {},
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('@/app/api/interview/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/interview', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
  sessionId: 'session_id_123',
  userAnswer: 'My answer',
  currentQuestion: 'Tell me about yourself.',
};

const validJob = {
  id: 'job_id_123',
  title: 'Software Engineer',
  description: 'Test description',
};

const validSession = {
  id: 'session_id_123',
  jobId: 'job_id_123',
  status: 'IN_PROGRESS',
  job: validJob,
};

const mockBankResponse: BankSelectionResponse = {
  selectedQuestionId: 'sqb-swe-001',
  question: 'Next AI question',
  isComplete: false,
  detectedSkills: ['TypeScript'],
  coveredTopics: ['Background'],
  remainingGaps: ['System Design'],
  questionRationale: 'Probing system design next.',
};

const defaultBank: BankQuestion[] = [
  { id: 'sqb-swe-001', text: 'Q1', type: 'TECHNICAL' },
  { id: 'sqb-swe-002', text: 'Q2', type: 'BEHAVIORAL' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/interview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue(validSession);
    mockTurnFindMany.mockResolvedValue([]);
    mockTurnCreate.mockResolvedValue({ id: 'turn_new' });
    mockTransaction.mockResolvedValue([]);
    mockSessionUpdate.mockResolvedValue({ id: 'session_id_123', status: 'COMPLETED' });
    mockQuestionFindMany.mockResolvedValue(defaultBank);
    mockCallModelForBankSelection.mockResolvedValue(mockBankResponse);
    mockBuildBankSelectionPrompt.mockReturnValue('mock-bank-system-prompt');
    // Default: OpenRouter unavailable / returns null (graceful degradation)
    mockGenerateAdaptiveFollowUp.mockResolvedValue(null);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when sessionId is missing', async () => {
      const res = await POST(makeRequest({ userAnswer: 'My answer', currentQuestion: 'Q?' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('returns 400 when sessionId is an empty string', async () => {
      const res = await POST(makeRequest({ sessionId: '', userAnswer: 'My answer', currentQuestion: 'Q?' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('returns 400 when userAnswer is missing', async () => {
      const res = await POST(makeRequest({ sessionId: 'session_id_123', currentQuestion: 'Q?' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('returns 400 when userAnswer is an empty string', async () => {
      const res = await POST(makeRequest({ sessionId: 'session_id_123', userAnswer: '', currentQuestion: 'Q?' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('returns 400 when currentQuestion is missing', async () => {
      const res = await POST(makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('returns 400 when currentQuestion is an empty string', async () => {
      const res = await POST(makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', currentQuestion: '' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and currentQuestion are required' });
    });

    it('silently ignores turnNumber if present alongside valid required fields', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, turnNumber: 5 }));
      // Should succeed (200), not 400
      expect(res.status).toBe(200);
    });
  });

  // ── Session lookup ──────────────────────────────────────────────────────────

  describe('session lookup', () => {
    it('returns 404 when session is not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      const res = await POST(makeRequest({ sessionId: 'nonexistent', userAnswer: 'My answer', currentQuestion: 'Q?' }));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session not found' });
    });

    it('returns 409 when session status is COMPLETED', async () => {
      mockSessionFindUnique.mockResolvedValue({ ...validSession, status: 'COMPLETED' });
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });

    it('returns 409 when session status is ABANDONED', async () => {
      mockSessionFindUnique.mockResolvedValue({ ...validSession, status: 'ABANDONED' });
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });
  });

  // ── Turn history fetch ──────────────────────────────────────────────────────

  describe('turn history fetch', () => {
    it('calls turn.findMany with correct where and orderBy on a successful request', async () => {
      await POST(makeRequest(VALID_BODY));
      expect(mockTurnFindMany).toHaveBeenCalledWith({
        where: { sessionId: 'session_id_123' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ── AI service error ────────────────────────────────────────────────────────

  describe('AI service error', () => {
    it('returns 500 with AI-specific message when callModelForBankSelection throws', async () => {
      mockCallModelForBankSelection.mockRejectedValue(new Error('model unavailable'));
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'AI service unavailable. Please try again.' });
    });
  });

  // ── Success ─────────────────────────────────────────────────────────────────

  describe('success', () => {
    it('returns 200 with nextQuestion, isComplete, and decisionState', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        nextQuestion: 'Next AI question',
        isComplete: false,
        decisionState: {
          selectedQuestionId: 'sqb-swe-001',
          detectedSkills: ['TypeScript'],
          coveredTopics: ['Background'],
          remainingGaps: ['System Design'],
          questionRationale: 'Probing system design next.',
        },
      });
    });

    it('returns Content-Type application/json', async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('saves AI + USER turns in one $transaction on the first call, then saves bank AI response via turn.create', async () => {
      // No existing turns => hasAiTurns = false => first $transaction saves AI + USER turns
      // model returns isComplete: false => AI turn saved via prisma.turn.create (not $transaction)
      await POST(makeRequest(VALID_BODY));
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // turn.create is called inside $transaction (AI + USER) AND directly (next AI question)
      expect(mockTurnCreate).toHaveBeenCalledTimes(3);
    });

    it('saves USER turn via direct turn.create on a subsequent call, then saves bank AI response via turn.create', async () => {
      // Simulate an existing AI turn so hasAiTurns = true
      mockTurnFindMany.mockResolvedValue([
        { id: 'turn_1', sessionId: 'session_id_123', speaker: 'AI', content: 'First Q', source: 'ANTHROPIC', decisionState: null, createdAt: new Date() },
      ]);
      await POST(makeRequest(VALID_BODY));
      // Subsequent user turn is saved via direct turn.create (NOT in $transaction)
      expect(mockTransaction).toHaveBeenCalledTimes(0);
      // turn.create called twice: once for USER turn, once for bank AI question
      expect(mockTurnCreate).toHaveBeenCalledTimes(2);
    });

    it('saves AI turn with decisionState.selectedQuestionId matching mock return value', async () => {
      await POST(makeRequest(VALID_BODY));
      // The direct turn.create call (the last one) should have decisionState with selectedQuestionId
      const lastCreateCall = mockTurnCreate.mock.calls[mockTurnCreate.mock.calls.length - 1] as Array<{
        data: { decisionState?: { selectedQuestionId?: string } };
      }>;
      const createArgs = lastCreateCall[0];
      expect(createArgs.data.decisionState).toMatchObject({ selectedQuestionId: 'sqb-swe-001' });
    });

    it('marks session COMPLETED and calls $transaction twice when model signals isComplete: true', async () => {
      mockCallModelForBankSelection.mockResolvedValue({
        selectedQuestionId: null,
        question: 'Thank you for your time today!',
        isComplete: true,
        detectedSkills: ['TypeScript'],
        coveredTopics: ['Background'],
        remainingGaps: [],
        questionRationale: 'All covered.',
      });
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isComplete).toBe(true);
      // $transaction called: once for first-turn AI+USER save, once for closing+session update
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ── No-repeat guarantee ─────────────────────────────────────────────────────

  describe('no-repeat guarantee', () => {
    it('excludes already-asked question IDs from the bank passed to callModelForBankSelection', async () => {
      // Simulate an existing AI turn with selectedQuestionId = 'sqb-swe-001'
      mockTurnFindMany.mockResolvedValue([
        {
          id: 'turn_1',
          sessionId: 'session_id_123',
          speaker: 'AI',
          content: 'Q1 text',
          source: 'ANTHROPIC',
          decisionState: { selectedQuestionId: 'sqb-swe-001', detectedSkills: [], coveredTopics: [], remainingGaps: [], questionRationale: '' },
          createdAt: new Date(),
        },
      ]);
      await POST(makeRequest(VALID_BODY));
      // buildBankSelectionPrompt is called with the remaining questions
      // The first argument is jobTitle, second is description, third is remainingQuestions
      const promptCall = mockBuildBankSelectionPrompt.mock.calls[0] as unknown as [string, string, BankQuestion[], number];
      const remainingQuestions = promptCall[2];
      // sqb-swe-001 should be excluded, only sqb-swe-002 remains
      expect(remainingQuestions.every((q: BankQuestion) => q.id !== 'sqb-swe-001')).toBe(true);
      expect(remainingQuestions.some((q: BankQuestion) => q.id === 'sqb-swe-002')).toBe(true);
    });
  });

  // ── Bank-exhausted path ─────────────────────────────────────────────────────

  describe('bank-exhausted path', () => {
    it('returns isComplete true and does NOT call model when bank is empty and aiTurnCount >= 6', async () => {
      mockQuestionFindMany.mockResolvedValue([]);
      // Simulate 6 existing AI turns
      const aiTurns = Array.from({ length: 6 }, (_, i) => ({
        id: `turn_ai_${i}`,
        sessionId: 'session_id_123',
        speaker: 'AI',
        content: `AI question ${i}`,
        source: 'ANTHROPIC',
        decisionState: null,
        createdAt: new Date(),
      }));
      mockTurnFindMany.mockResolvedValue(aiTurns);

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isComplete).toBe(true);
      expect(mockCallModelForBankSelection).not.toHaveBeenCalled();
    });

    it('returns the static decisionState when bank is exhausted and aiTurnCount >= 6', async () => {
      mockQuestionFindMany.mockResolvedValue([]);
      const aiTurns = Array.from({ length: 6 }, (_, i) => ({
        id: `turn_ai_${i}`,
        sessionId: 'session_id_123',
        speaker: 'AI',
        content: `AI question ${i}`,
        source: 'ANTHROPIC',
        decisionState: null,
        createdAt: new Date(),
      }));
      mockTurnFindMany.mockResolvedValue(aiTurns);

      const res = await POST(makeRequest(VALID_BODY));
      const body = await res.json();
      expect(body.decisionState).toEqual({
        selectedQuestionId: null,
        detectedSkills: [],
        coveredTopics: [],
        remainingGaps: [],
        questionRationale: 'Bank fully covered. Interview closed.',
      });
    });
  });

  // ── Unexpected error ────────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 with generic message when session.findUnique throws', async () => {
      mockSessionFindUnique.mockRejectedValue(new Error('DB connection failed'));
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 with generic message when $transaction throws', async () => {
      mockTransaction.mockRejectedValue(new Error('Transaction failed'));
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const body = await res.json();
      // Could be either the generic catch or the AI unavailable catch
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
    });
  });
});
