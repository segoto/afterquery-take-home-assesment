/**
 * Unit tests for PATCH /api/sessions/[sessionId]
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockSessionFindUnique = jest.fn<
  (args: unknown) => Promise<{
    id: string;
    userId: string | null;
    status: string;
    jobId: string;
  } | null>
>();

const mockSessionUpdate = jest.fn<
  (args: unknown) => Promise<{ id: string; status: string }>
>();

const mockVerifyToken = jest.fn<
  (token: string) => Promise<{ sub: string; email: string; exp?: number; iat?: number } | null>
>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { PATCH } = await import('@/app/api/sessions/[sessionId]/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  sessionId: string,
  body: unknown,
  cookieValue?: string
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieValue) {
    headers['Cookie'] = `auth_token=${cookieValue}`;
  }
  return new NextRequest(`http://localhost/api/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers,
  });
}

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

const VALID_SESSION = {
  id: 'session_id_123',
  userId: 'user_id_456',
  status: 'IN_PROGRESS',
  jobId: 'job_id_789',
};

const VALID_PAYLOAD = { sub: 'user_id_456', email: 'user@example.com' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/sessions/[sessionId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default happy-path mock return values
    mockVerifyToken.mockResolvedValue(VALID_PAYLOAD);
    mockSessionFindUnique.mockResolvedValue(VALID_SESSION);
    mockSessionUpdate.mockResolvedValue({ id: 'session_id_123', status: 'ABANDONED' });
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('returns 401 when auth_token cookie is absent', async () => {
      mockVerifyToken.mockResolvedValue(null);
      const req = makeRequest('session_id_123', { status: 'ABANDONED' });
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when verifyToken returns null for invalid token', async () => {
      mockVerifyToken.mockResolvedValue(null);
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'bad.token.here');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });
  });

  // ── Body parsing ────────────────────────────────────────────────────────────

  describe('body parsing', () => {
    it('returns 400 with "Invalid request body" when body is not valid JSON', async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Cookie: 'auth_token=valid.jwt',
      };
      const req = new NextRequest('http://localhost/api/sessions/session_id_123', {
        method: 'PATCH',
        body: 'not-valid-json{',
        headers,
      });
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid request body' });
    });
  });

  // ── Status validation ───────────────────────────────────────────────────────

  describe('status validation', () => {
    it('returns 400 with "status must be ABANDONED" when status is wrong value', async () => {
      const req = makeRequest('session_id_123', { status: 'COMPLETED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'status must be ABANDONED' });
    });

    it('returns 400 when status field is missing', async () => {
      const req = makeRequest('session_id_123', {}, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'status must be ABANDONED' });
    });

    it('returns 400 when status is IN_PROGRESS (not ABANDONED)', async () => {
      const req = makeRequest('session_id_123', { status: 'IN_PROGRESS' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'status must be ABANDONED' });
    });
  });

  // ── Session lookup ──────────────────────────────────────────────────────────

  describe('session lookup', () => {
    it('returns 404 when session is not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      const req = makeRequest('nonexistent-id', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('nonexistent-id'));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session not found' });
    });
  });

  // ── Ownership check ─────────────────────────────────────────────────────────

  describe('ownership check', () => {
    it('returns 403 when session belongs to a different user', async () => {
      mockSessionFindUnique.mockResolvedValue({
        ...VALID_SESSION,
        userId: 'different_user_id',
      });
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Forbidden' });
    });

    it('returns 403 when session.userId is null', async () => {
      mockSessionFindUnique.mockResolvedValue({
        ...VALID_SESSION,
        userId: null,
      });
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Forbidden' });
    });
  });

  // ── Status conflict ─────────────────────────────────────────────────────────

  describe('status conflict', () => {
    it('returns 409 when session is already COMPLETED', async () => {
      mockSessionFindUnique.mockResolvedValue({
        ...VALID_SESSION,
        status: 'COMPLETED',
      });
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });

    it('returns 409 when session is already ABANDONED', async () => {
      mockSessionFindUnique.mockResolvedValue({
        ...VALID_SESSION,
        status: 'ABANDONED',
      });
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Session is not in progress' });
    });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 200 with { id, status: "ABANDONED" } on success', async () => {
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ id: 'session_id_123', status: 'ABANDONED' });
    });

    it('calls session.update with status ABANDONED and endedAt as a Date', async () => {
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      await PATCH(req, makeParams('session_id_123'));
      expect(mockSessionUpdate).toHaveBeenCalledWith({
        where: { id: 'session_id_123' },
        data: { status: 'ABANDONED', endedAt: expect.any(Date) },
      });
    });

    it('calls session.findUnique with the correct sessionId', async () => {
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      await PATCH(req, makeParams('session_id_123'));
      expect(mockSessionFindUnique).toHaveBeenCalledWith({
        where: { id: 'session_id_123' },
      });
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 when session.findUnique throws', async () => {
      mockSessionFindUnique.mockRejectedValue(new Error('DB connection failed'));
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 when session.update throws', async () => {
      mockSessionUpdate.mockRejectedValue(new Error('DB write failed'));
      const req = makeRequest('session_id_123', { status: 'ABANDONED' }, 'valid.jwt');
      const res = await PATCH(req, makeParams('session_id_123'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});
