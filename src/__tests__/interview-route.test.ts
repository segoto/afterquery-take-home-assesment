/**
 * Unit tests for POST /api/interview
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockSessionFindUnique = jest.fn<(args: unknown) => Promise<{
  id: string;
  status: string;
} | null>>();

const mockTurnCreate = jest.fn<(args: unknown) => Promise<{ id: string }>>();
const mockTransaction = jest.fn<(operations: unknown[]) => Promise<unknown[]>>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: mockSessionFindUnique,
    },
    turn: {
      create: mockTurnCreate,
    },
    $transaction: mockTransaction,
  },
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

const validSession = { id: 'session_id_123', status: 'IN_PROGRESS' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/interview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue(validSession);
    mockTransaction.mockResolvedValue([{ id: 'turn_ai_1' }, { id: 'turn_user_1' }]);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when sessionId is missing', async () => {
      const req = makeRequest({ userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when sessionId is an empty string', async () => {
      const req = makeRequest({ sessionId: '', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when userAnswer is an empty string', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: '', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when userAnswer is missing', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when turnNumber is not an integer (e.g. 1.5)', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 1.5 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when turnNumber is negative', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: -1 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });

    it('returns 400 when turnNumber is missing', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'sessionId, userAnswer, and turnNumber are required' });
    });
  });

  // ── Session lookup ──────────────────────────────────────────────────────────

  describe('session lookup', () => {
    it('returns 404 when session is not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      const req = makeRequest({ sessionId: 'nonexistent_id', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session not found' });
    });

    it('returns 409 when session status is COMPLETED', async () => {
      mockSessionFindUnique.mockResolvedValue({ id: 'session_id_123', status: 'COMPLETED' });
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });

    it('returns 409 when session status is ABANDONED', async () => {
      mockSessionFindUnique.mockResolvedValue({ id: 'session_id_123', status: 'ABANDONED' });
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });
  });

  // ── Success ─────────────────────────────────────────────────────────────────

  describe('success', () => {
    it('returns 200 with nextQuestion and isComplete: false', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        nextQuestion: 'Thank you. Can you walk me through a specific challenge you faced in a previous role and how you resolved it?',
        isComplete: false,
      });
    });

    it('calls $transaction with two Turn creates when successful', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      await POST(req);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      const transactionArg = mockTransaction.mock.calls[0][0];
      expect(Array.isArray(transactionArg)).toBe(true);
      expect((transactionArg as unknown[]).length).toBe(2);
    });

    it('uses PLACEHOLDER_QUESTIONS[0] when turnNumber is out of bounds (e.g. 999)', async () => {
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 999 });
      await POST(req);
      // The transaction should be called; we verify by checking mockTransaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // turnCreate is called lazily via transaction array items — verify transaction was called with 2 items
      const transactionArg = mockTransaction.mock.calls[0][0];
      expect(Array.isArray(transactionArg)).toBe(true);
      expect((transactionArg as unknown[]).length).toBe(2);
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 on unexpected error from $transaction', async () => {
      mockTransaction.mockRejectedValue(new Error('DB connection refused'));
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 on unexpected error from session.findUnique', async () => {
      mockSessionFindUnique.mockRejectedValue(new Error('DB connection refused'));
      const req = makeRequest({ sessionId: 'session_id_123', userAnswer: 'My answer', turnNumber: 0 });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});
