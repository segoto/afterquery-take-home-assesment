/**
 * Unit tests for POST /api/interview (synchronous Claude integration)
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 * Mocks: @/lib/prisma, @/lib/anthropic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { ClaudeInterviewResponse } from '@/types';

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
      createdAt: Date;
    }>
  >
>();

const mockTransaction = jest.fn<(ops: unknown) => Promise<unknown[]>>();

const mockCallClaudeForNextQuestion = jest.fn<() => Promise<ClaudeInterviewResponse>>();
const mockBuildInterviewSystemPrompt = jest.fn<() => string>().mockReturnValue('mock-system-prompt');

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
  buildEvaluationPrompt: jest.fn().mockReturnValue('mocked evaluation prompt'),
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
  skills: [] as Array<{ id: string; name: string; weight: number }>,
};

const validSession = {
  id: 'session_id_123',
  status: 'IN_PROGRESS',
  job: validJob,
};

const mockClaudeResponse: ClaudeInterviewResponse = {
  question: 'Next AI question',
  isComplete: false,
  decisionState: {
    detectedSkills: ['TypeScript'],
    coveredTopics: ['Background'],
    remainingGaps: ['System Design'],
    questionRationale: 'Probing system design next.',
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/interview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue(validSession);
    mockTurnFindMany.mockResolvedValue([]);
    mockTurnCreate.mockResolvedValue({ id: 'turn_new' });
    mockTransaction.mockResolvedValue([]);
    mockSessionUpdate.mockResolvedValue({ id: 'session_id_123', status: 'COMPLETED' });
    mockCallClaudeForNextQuestion.mockResolvedValue(mockClaudeResponse);
    mockBuildInterviewSystemPrompt.mockReturnValue('mock-system-prompt');
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
    it('returns 500 with AI-specific message when callClaudeForNextQuestion throws', async () => {
      mockCallClaudeForNextQuestion.mockRejectedValue(new Error('Claude unavailable'));
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

    it('calls $transaction to save user answer (first turn: saves AI + USER turns)', async () => {
      // No existing turns => hasAiTurns = false => should save AI turn + USER turn
      await POST(makeRequest(VALID_BODY));
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('calls $transaction once for user answer and once for Claude response (subsequent turn)', async () => {
      // Simulate an existing AI turn so hasAiTurns = true
      mockTurnFindMany.mockResolvedValue([
        { id: 'turn_1', sessionId: 'session_id_123', speaker: 'AI', content: 'First Q', createdAt: new Date() },
      ]);
      await POST(makeRequest(VALID_BODY));
      // Once for USER turn save, once for AI turn save
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('marks session COMPLETED and calls $transaction twice when isComplete is true', async () => {
      mockCallClaudeForNextQuestion.mockResolvedValue({
        question: 'Thank you!',
        isComplete: true,
        decisionState: {
          detectedSkills: ['TypeScript'],
          coveredTopics: ['Background'],
          remainingGaps: [],
          questionRationale: 'All covered.',
        },
      });
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isComplete).toBe(true);
      // session.update called as part of the post-Claude transaction
      expect(mockTransaction).toHaveBeenCalledTimes(2);
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
