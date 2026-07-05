/**
 * Unit tests for POST /api/evaluate
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockSessionFindUnique = jest.fn<
  (args: unknown) => Promise<{ id: string; status: string; endedAt: Date | null } | null>
>();

const mockEvaluationFindUnique = jest.fn<
  (args: unknown) => Promise<{ id: string } | null>
>();

const mockTurnFindMany = jest.fn<
  (args: unknown) => Promise<Array<{ id: string; sessionId: string; speaker: string; content: string; createdAt: Date }>>
>();

const mockEvaluationCreate = jest.fn<
  (args: unknown) => Promise<{ id: string; sessionId: string; strengths: unknown; concerns: unknown; score: number; createdAt: Date }>
>();

const mockSessionUpdate = jest.fn<
  (args: unknown) => Promise<{ id: string; status: string }>
>();

const mockAiClientComplete = jest.fn<(args: unknown) => Promise<string>>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

// Suppress Anthropic SDK instantiation in @/lib/anthropic (imported by the route
// via buildEvaluationPrompt). The real Anthropic constructor throws when
// ANTHROPIC_API_KEY is absent, so we mock the SDK here.
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn(), stream: jest.fn() },
  })),
}));

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
    evaluation: {
      findUnique: mockEvaluationFindUnique,
      create: mockEvaluationCreate,
    },
    turn: {
      findMany: mockTurnFindMany,
    },
  },
}));

jest.unstable_mockModule('@/lib/ai-client', () => ({
  aiClient: {
    complete: mockAiClientComplete,
    streamCompletion: jest.fn(),
  },
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('@/app/api/evaluate/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/evaluate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validSession = { id: 'session_123', status: 'IN_PROGRESS', endedAt: null };

const validEvaluationResult = {
  id: 'eval_123',
  sessionId: 'session_123',
  strengths: ['Good communication'],
  concerns: ['Limited experience'],
  score: 7,
  createdAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/evaluate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue(validSession);
    mockEvaluationFindUnique.mockResolvedValue(null);
    mockTurnFindMany.mockResolvedValue([]);
    mockEvaluationCreate.mockResolvedValue(validEvaluationResult);
    mockSessionUpdate.mockResolvedValue({ id: 'session_123', status: 'COMPLETED' });
    mockAiClientComplete.mockResolvedValue(
      JSON.stringify({
        strengths: ['Good communication'],
        concerns: ['Limited experience'],
        overall_score: 7,
      })
    );
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when sessionId is missing', async () => {
      const req = makeRequest({});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId is required' });
    });

    it('returns 400 when sessionId is an empty string', async () => {
      const req = makeRequest({ sessionId: '' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId is required' });
    });

    it('returns 400 when sessionId is not a string (e.g. a number)', async () => {
      const req = makeRequest({ sessionId: 123 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId is required' });
    });
  });

  // ── Session lookup ──────────────────────────────────────────────────────────

  describe('session lookup', () => {
    it('returns 404 when session is not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      const req = makeRequest({ sessionId: 'nonexistent_id' });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session not found' });
    });

    it('returns 409 "Session is not in progress or completed" when session status is ABANDONED', async () => {
      mockSessionFindUnique.mockResolvedValue({
        id: 'session_123',
        status: 'ABANDONED',
        endedAt: null,
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress or completed' });
    });

    it('proceeds normally when session status is COMPLETED (not ABANDONED)', async () => {
      mockSessionFindUnique.mockResolvedValue({
        id: 'session_123',
        status: 'COMPLETED',
        endedAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      // Should not return 409 for COMPLETED sessions — proceeds to evaluation
      expect(res.status).toBe(201);
    });
  });

  // ── Duplicate evaluation ────────────────────────────────────────────────────

  describe('duplicate evaluation check', () => {
    it('returns 409 "Evaluation already exists" when an evaluation row already exists', async () => {
      mockEvaluationFindUnique.mockResolvedValue({ id: 'existing_eval_123' });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Evaluation already exists' });
    });
  });

  // ── AI client errors ────────────────────────────────────────────────────────

  describe('AI client errors', () => {
    it('returns 502 when aiClient.complete returns unparseable JSON', async () => {
      mockAiClientComplete.mockResolvedValue('this is not valid json at all');
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body).toEqual({ error: 'AI returned an unparseable evaluation' });
    });
  });

  // ── Success ─────────────────────────────────────────────────────────────────

  describe('success', () => {
    it('returns 201 with { id, strengths, concerns, score } on a valid response', async () => {
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({
        id: 'eval_123',
        strengths: ['Good communication'],
        concerns: ['Limited experience'],
        score: 7,
      });
    });

    it('calls evaluation.create with correct data', async () => {
      const req = makeRequest({ sessionId: 'session_123' });
      await POST(req);
      expect(mockEvaluationCreate).toHaveBeenCalledTimes(1);
      const createArgs = mockEvaluationCreate.mock.calls[0][0] as {
        data: { sessionId: string; strengths: string[]; concerns: string[]; score: number };
      };
      expect(createArgs.data.sessionId).toBe('session_123');
      expect(createArgs.data.score).toBe(7);
    });

    it('calls session.update when endedAt is null', async () => {
      const req = makeRequest({ sessionId: 'session_123' });
      await POST(req);
      expect(mockSessionUpdate).toHaveBeenCalledTimes(1);
      const updateArgs = mockSessionUpdate.mock.calls[0][0] as {
        data: { status: string; endedAt: Date };
      };
      expect(updateArgs.data.status).toBe('COMPLETED');
    });

    it('does not call session.update when endedAt is already set', async () => {
      mockSessionFindUnique.mockResolvedValue({
        id: 'session_123',
        status: 'COMPLETED',
        endedAt: new Date('2024-01-01'),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      await POST(req);
      expect(mockSessionUpdate).not.toHaveBeenCalled();
    });
  });

  // ── Markdown fence stripping ─────────────────────────────────────────────────

  describe('markdown fence stripping', () => {
    it('strips ```json fences before parsing and returns 201', async () => {
      mockAiClientComplete.mockResolvedValue(
        '```json\n{"strengths":[],"concerns":[],"overall_score":7}\n```'
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_md_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 7,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.score).toBe(7);
      expect(body.strengths).toEqual([]);
      expect(body.concerns).toEqual([]);
    });

    it('strips plain ``` fences before parsing and returns 201', async () => {
      mockAiClientComplete.mockResolvedValue(
        '```\n{"strengths":["clear"],"concerns":[],"overall_score":8}\n```'
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_plain_123',
        sessionId: 'session_123',
        strengths: ['clear'],
        concerns: [],
        score: 8,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.score).toBe(8);
    });
  });

  // ── Score normalisation ──────────────────────────────────────────────────────

  describe('overall_score normalisation', () => {
    it('rounds 7.8 to 8', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ strengths: [], concerns: [], overall_score: 7.8 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_round_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 8,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.score).toBe(8);
    });

    it('clamps 15 down to 10', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ strengths: [], concerns: [], overall_score: 15 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_clamp_high_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 10,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.score).toBe(10);
    });

    it('clamps 0 up to 1', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ strengths: [], concerns: [], overall_score: 0 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_clamp_low_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 1,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.score).toBe(1);
    });
  });

  // ── Missing fields ───────────────────────────────────────────────────────────

  describe('missing fields in AI response', () => {
    it('uses empty array when strengths is missing', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ concerns: ['Needs improvement'], overall_score: 5 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_no_strengths_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: ['Needs improvement'],
        score: 5,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.strengths).toEqual([]);
    });

    it('uses empty array when concerns is missing', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ strengths: ['Excellent'], overall_score: 9 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_no_concerns_123',
        sessionId: 'session_123',
        strengths: ['Excellent'],
        concerns: [],
        score: 9,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.concerns).toEqual([]);
    });

    it('uses empty arrays when both strengths and concerns are missing', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ overall_score: 5 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_no_arrays_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 5,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.strengths).toEqual([]);
      expect(body.concerns).toEqual([]);
    });

    it('uses empty arrays when strengths is not an array', async () => {
      mockAiClientComplete.mockResolvedValue(
        JSON.stringify({ strengths: 'very good', concerns: [], overall_score: 6 })
      );
      mockEvaluationCreate.mockResolvedValue({
        id: 'eval_non_array_123',
        sessionId: 'session_123',
        strengths: [],
        concerns: [],
        score: 6,
        createdAt: new Date(),
      });
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.strengths).toEqual([]);
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 on unexpected Prisma error from session.findUnique', async () => {
      mockSessionFindUnique.mockRejectedValue(new Error('DB connection refused'));
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 on unexpected Prisma error from evaluation.create', async () => {
      mockEvaluationCreate.mockRejectedValue(new Error('Unique constraint failed'));
      const req = makeRequest({ sessionId: 'session_123' });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});
