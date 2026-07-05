/**
 * Unit tests for:
 *  - POST /api/auth/logout
 *  - GET  /api/auth/me
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { JwtPayload } from '@/types';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockVerifyToken = jest.fn<(token: string) => Promise<JwtPayload | null>>();
const mockClearAuthCookie = jest.fn<() => string>();
const mockFindUnique = jest.fn<(args: unknown) => Promise<{ id: string; email: string } | null>>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
  clearAuthCookie: mockClearAuthCookie,
}));

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

// ── Dynamically import routes after mocks are registered ──────────────────────

const { POST } = await import('../app/api/auth/logout/route');
const { GET } = await import('../app/api/auth/me/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMeRequest(cookieHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookieHeader !== undefined) {
    headers['Cookie'] = cookieHeader;
  }
  return new NextRequest('http://localhost/api/auth/me', { headers });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearAuthCookie.mockReturnValue(
      'auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
    );
  });

  it('returns 200 { success: true }', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('sets Set-Cookie header with Max-Age=0 to clear the cookie', async () => {
    const res = await POST();
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('auth_token=;');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
  });

  it('calls clearAuthCookie to build the Set-Cookie value', async () => {
    await POST();
    expect(mockClearAuthCookie).toHaveBeenCalledTimes(1);
  });

  it('does not query the database', async () => {
    await POST();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── No cookie ───────────────────────────────────────────────────────────────

  it('returns 401 { error: "Unauthenticated" } when no auth_token cookie is present', async () => {
    const req = makeMeRequest(); // no Cookie header
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthenticated' });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  // ── Invalid token ───────────────────────────────────────────────────────────

  it('returns 401 when verifyToken returns null (invalid/expired token)', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const req = makeMeRequest('auth_token=bad.token.here');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthenticated' });
    expect(mockVerifyToken).toHaveBeenCalledWith('bad.token.here');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // ── Valid token but deleted user ────────────────────────────────────────────

  it('returns 401 when JWT is valid but the user no longer exists in the database', async () => {
    const payload: JwtPayload = { sub: 'deleted-user-id', email: 'ghost@example.com' };
    mockVerifyToken.mockResolvedValue(payload);
    mockFindUnique.mockResolvedValue(null);

    const req = makeMeRequest('auth_token=valid.jwt.token');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthenticated' });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'deleted-user-id' },
      select: { id: true, email: true },
    });
  });

  // ── Successful lookup ───────────────────────────────────────────────────────

  it('returns 200 { id, email } when JWT is valid and the user exists', async () => {
    const payload: JwtPayload = { sub: 'user-123', email: 'alice@example.com' };
    mockVerifyToken.mockResolvedValue(payload);
    mockFindUnique.mockResolvedValue({ id: 'user-123', email: 'alice@example.com' });

    const req = makeMeRequest('auth_token=valid.jwt.token');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 'user-123', email: 'alice@example.com' });
  });

  it('only exposes id and email fields in the response', async () => {
    const payload: JwtPayload = { sub: 'user-456', email: 'bob@example.com' };
    mockVerifyToken.mockResolvedValue(payload);
    mockFindUnique.mockResolvedValue({ id: 'user-456', email: 'bob@example.com' });

    const req = makeMeRequest('auth_token=some.token');
    const res = await GET(req);

    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['email', 'id']);
  });

  // ── Unexpected error ────────────────────────────────────────────────────────

  it('returns 500 when prisma.findUnique throws an unexpected error', async () => {
    const payload: JwtPayload = { sub: 'user-789', email: 'err@example.com' };
    mockVerifyToken.mockResolvedValue(payload);
    mockFindUnique.mockRejectedValue(new Error('DB connection lost'));

    const req = makeMeRequest('auth_token=valid.jwt.token');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
