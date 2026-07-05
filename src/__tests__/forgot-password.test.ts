/**
 * Unit tests for POST /api/auth/forgot-password
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Mock function definitions ────────────────────────────────────────────────

const mockUserFindUnique = jest.fn<
  (args: unknown) => Promise<{ email: string } | null>
>();

const mockTokenDeleteMany = jest.fn<
  (args: unknown) => Promise<{ count: number }>
>();

const mockTokenCreate = jest.fn<
  (args: unknown) => Promise<{
    id: string;
    token: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
  }>
>();

// ── ESM-compatible module mocks ──────────────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
    passwordResetToken: {
      deleteMany: mockTokenDeleteMany,
      create: mockTokenCreate,
    },
  },
}));

// ── Dynamically import the route after mocks are registered ──────────────────

const { POST } = await import('@/app/api/auth/forgot-password/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password — validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when email field is missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Email is required' });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('returns 400 when email is an empty string', async () => {
    const req = makeRequest({ email: '' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Email is required' });
  });

  it('returns 400 when email is whitespace only', async () => {
    const req = makeRequest({ email: '   ' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Email is required' });
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Email is required' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown email (email enumeration protection)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password — unknown email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(null);
  });

  it('returns 200 with token: null when user does not exist', async () => {
    const req = makeRequest({ email: 'unknown@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ token: null });
  });

  it('does not touch the password_reset_tokens table for unknown emails', async () => {
    const req = makeRequest({ email: 'unknown@example.com' });
    await POST(req);

    expect(mockTokenDeleteMany).not.toHaveBeenCalled();
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Known email — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password — known email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockImplementation((args: unknown) => {
      const { data } = args as { data: { token: string; email: string; expiresAt: Date } };
      return Promise.resolve({
        id: 'token-id',
        token: data.token,
        email: data.email,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      });
    });
  });

  it('returns 200 with a 64-character hex token', async () => {
    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.token).toBe('string');
    expect((json.token as string)).toHaveLength(64);
    expect((json.token as string)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('calls deleteMany before create (stale token cleanup)', async () => {
    const callOrder: string[] = [];
    mockTokenDeleteMany.mockImplementation(() => {
      callOrder.push('deleteMany');
      return Promise.resolve({ count: 1 });
    });
    mockTokenCreate.mockImplementation(() => {
      callOrder.push('create');
      return Promise.resolve({
        id: 'token-id',
        token: 'a'.repeat(64),
        email: 'user@example.com',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
    });

    const req = makeRequest({ email: 'user@example.com' });
    await POST(req);

    expect(callOrder).toEqual(['deleteMany', 'create']);
  });

  it('calls deleteMany with the correct email', async () => {
    const req = makeRequest({ email: 'user@example.com' });
    await POST(req);

    expect(mockTokenDeleteMany).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
  });

  it('creates a token with correct email and ~1-hour expiry', async () => {
    const before = Date.now();

    const req = makeRequest({ email: 'user@example.com' });
    await POST(req);

    const after = Date.now();

    expect(mockTokenCreate).toHaveBeenCalledTimes(1);
    const createArg = (mockTokenCreate.mock.calls[0] as [{ data: { token: string; email: string; expiresAt: Date } }])[0];
    const { data } = createArg;

    expect(data.email).toBe('user@example.com');
    expect(typeof data.token).toBe('string');
    expect(data.token).toHaveLength(64);
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);

    const oneHourMs = 60 * 60 * 1000;
    const expiryMs = data.expiresAt.getTime();
    expect(expiryMs).toBeGreaterThanOrEqual(before + oneHourMs);
    expect(expiryMs).toBeLessThanOrEqual(after + oneHourMs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password — error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 500 when prisma.user.findUnique throws', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('DB connection failed'));

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Internal server error' });
  });

  it('returns 500 when prisma.passwordResetToken.create throws', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockRejectedValue(new Error('Constraint violation'));

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({ error: 'Internal server error' });
  });
});
