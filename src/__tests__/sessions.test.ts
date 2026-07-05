/**
 * Unit tests for POST /api/sessions
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockJobFindUnique = jest.fn<
  (args: unknown) => Promise<{ id: string; slug: string; title: string; description: string; questionPack: null } | null>
>();
const mockSessionCreate = jest.fn<
  (args: unknown) => Promise<{ id: string }>
>();
const mockVerifyToken = jest.fn<
  (token: string) => Promise<{ sub: string; email: string; exp?: number; iat?: number } | null>
>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    job: {
      findUnique: mockJobFindUnique,
    },
    session: {
      create: mockSessionCreate,
    },
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('@/app/api/sessions/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, cookieValue?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieValue) {
    headers['Cookie'] = `auth_token=${cookieValue}`;
  }
  return new NextRequest('http://localhost/api/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

const VALID_JOB = {
  id: 'clswe0001000000000000000001',
  slug: 'software-engineer',
  title: 'Software Engineer',
  description: 'Build and maintain scalable backend services.',
  questionPack: null as null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default happy-path mock return values
    mockJobFindUnique.mockResolvedValue(VALID_JOB);
    mockSessionCreate.mockResolvedValue({ id: 'session_id_123' });
    mockVerifyToken.mockResolvedValue(null);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when jobId is missing', async () => {
      const req = makeRequest({});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'jobId is required' });
    });

    it('returns 400 when jobId is an empty string', async () => {
      const req = makeRequest({ jobId: '' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'jobId is required' });
    });

    it('returns 400 when jobId is not a string (number)', async () => {
      const req = makeRequest({ jobId: 42 });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'jobId is required' });
    });

    it('returns 400 when jobId is not a string (null)', async () => {
      const req = makeRequest({ jobId: null });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'jobId is required' });
    });

    it('does not call job.findUnique when validation fails', async () => {
      const req = makeRequest({});
      await POST(req);
      expect(mockJobFindUnique).not.toHaveBeenCalled();
    });
  });

  // ── Job existence ───────────────────────────────────────────────────────────

  describe('job existence', () => {
    it('returns 404 when job.findUnique returns null', async () => {
      mockJobFindUnique.mockResolvedValue(null);
      const req = makeRequest({ jobId: 'nonexistent-job-id' });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Job not found' });
    });
  });

  // ── Auth cookie / userId extraction ─────────────────────────────────────────

  describe('userId extraction', () => {
    it('sets userId from cookie when verifyToken succeeds', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'user_id_456',
        email: 'user@example.com',
      });
      const req = makeRequest({ jobId: VALID_JOB.id }, 'valid.jwt.token');
      await POST(req);
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: { jobId: VALID_JOB.id, userId: 'user_id_456', status: 'IN_PROGRESS' },
      });
    });

    it('sets userId = null when verifyToken returns null (missing/invalid token)', async () => {
      mockVerifyToken.mockResolvedValue(null);
      const req = makeRequest({ jobId: VALID_JOB.id });
      await POST(req);
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: { jobId: VALID_JOB.id, userId: null, status: 'IN_PROGRESS' },
      });
    });
  });

  // ── Successful session creation ─────────────────────────────────────────────

  describe('successful session creation', () => {
    it('returns 201 with { id } on success', async () => {
      const req = makeRequest({ jobId: VALID_JOB.id });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ id: 'session_id_123' });
    });

    it('calls job.findUnique with the provided jobId', async () => {
      const req = makeRequest({ jobId: VALID_JOB.id });
      await POST(req);
      expect(mockJobFindUnique).toHaveBeenCalledWith({ where: { id: VALID_JOB.id } });
    });

    it('calls session.create with status IN_PROGRESS', async () => {
      const req = makeRequest({ jobId: VALID_JOB.id });
      await POST(req);
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: { jobId: VALID_JOB.id, userId: null, status: 'IN_PROGRESS' },
      });
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 on unexpected error from session.create', async () => {
      mockSessionCreate.mockRejectedValue(new Error('DB write failed'));
      const req = makeRequest({ jobId: VALID_JOB.id });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 on unexpected error from job.findUnique', async () => {
      mockJobFindUnique.mockRejectedValue(new Error('DB connection failed'));
      const req = makeRequest({ jobId: VALID_JOB.id });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 when request.json() throws', async () => {
      const badReq = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: 'not-valid-json{',
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(badReq);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});
