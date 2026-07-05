/**
 * Unit tests for POST /api/auth/login
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

type UserResult = { id: string; email: string; passwordHash: string } | null;

const mockFindUnique = jest.fn<(args: unknown) => Promise<UserResult>>();
const mockSignToken = jest.fn<(payload: { sub: string; email: string }) => Promise<string>>();
const mockBuildAuthCookie = jest.fn<(token: string) => string>();
const mockBcryptCompare = jest.fn<(password: string, hash: string) => Promise<boolean>>();

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  signToken: mockSignToken,
  buildAuthCookie: mockBuildAuthCookie,
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
  },
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('../app/api/auth/login/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignToken.mockResolvedValue('signed-jwt-token');
    mockBuildAuthCookie.mockReturnValue(
      'auth_token=signed-jwt-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
    );
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns 400 when email is missing', async () => {
    const req = makeRequest({ password: 'password123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Email and password are required' });
  });

  it('returns 400 when password is missing', async () => {
    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Email and password are required' });
  });

  it('returns 400 when both fields are missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Email and password are required' });
  });

  it('returns 400 when email is an empty string', async () => {
    const req = makeRequest({ email: '', password: 'password123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Email and password are required' });
  });

  it('returns 400 when password is an empty string', async () => {
    const req = makeRequest({ email: 'user@example.com', password: '' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Email and password are required' });
  });

  // ── Unknown email ───────────────────────────────────────────────────────────

  it('returns 401 when email is not found and always calls bcrypt.compare (timing protection)', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockBcryptCompare.mockResolvedValue(false);

    const req = makeRequest({ email: 'unknown@example.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid credentials' });

    // bcrypt.compare MUST be called even when user is not found (timing protection)
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1);
    // The first arg should be the provided password; second arg should be the dummy hash
    expect(mockBcryptCompare).toHaveBeenCalledWith(
      'password123',
      '$2a$12$dummyhashfortimingprotectionXXXXXXXXXXX'
    );
  });

  // ── Wrong password ──────────────────────────────────────────────────────────

  it('returns 401 when password is wrong', async () => {
    const fakeUser = { id: 'user-id', email: 'user@example.com', passwordHash: '$2a$12$realhash' };
    mockFindUnique.mockResolvedValue(fakeUser);
    mockBcryptCompare.mockResolvedValue(false);

    const req = makeRequest({ email: 'user@example.com', password: 'wrongpassword' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid credentials' });

    // bcrypt.compare must be called with the real hash
    expect(mockBcryptCompare).toHaveBeenCalledWith('wrongpassword', '$2a$12$realhash');
  });

  it('uses identical error message for unknown email and wrong password (prevents enumeration)', async () => {
    // Unknown email case
    mockFindUnique.mockResolvedValue(null);
    mockBcryptCompare.mockResolvedValue(false);
    const res1 = await POST(makeRequest({ email: 'ghost@example.com', password: 'any' }));
    const body1 = (await res1.json()) as { error: string };

    jest.clearAllMocks();
    mockSignToken.mockResolvedValue('signed-jwt-token');
    mockBuildAuthCookie.mockReturnValue(
      'auth_token=signed-jwt-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
    );

    // Wrong password case
    const fakeUser = { id: 'uid', email: 'user@example.com', passwordHash: '$2a$12$hash' };
    mockFindUnique.mockResolvedValue(fakeUser);
    mockBcryptCompare.mockResolvedValue(false);
    const res2 = await POST(makeRequest({ email: 'user@example.com', password: 'bad' }));
    const body2 = (await res2.json()) as { error: string };

    expect(res1.status).toBe(res2.status);
    expect(body1.error).toBe(body2.error);
  });

  // ── Successful login ────────────────────────────────────────────────────────

  it('returns 200 with user data and sets Set-Cookie header on valid credentials', async () => {
    const fakeUser = { id: 'user-123', email: 'user@example.com', passwordHash: '$2a$12$realhash' };
    mockFindUnique.mockResolvedValue(fakeUser);
    mockBcryptCompare.mockResolvedValue(true);
    mockSignToken.mockResolvedValue('the-jwt-token');
    mockBuildAuthCookie.mockReturnValue(
      'auth_token=the-jwt-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
    );

    const req = makeRequest({ email: 'user@example.com', password: 'correct-password' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 'user-123', email: 'user@example.com' });

    // Check Set-Cookie header is present
    expect(res.headers.get('Set-Cookie')).toBe(
      'auth_token=the-jwt-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
    );

    // signToken should be called with correct payload
    expect(mockSignToken).toHaveBeenCalledWith({ sub: 'user-123', email: 'user@example.com' });

    // buildAuthCookie should be called with the token returned by signToken
    expect(mockBuildAuthCookie).toHaveBeenCalledWith('the-jwt-token');
  });

  it('calls bcrypt.compare with the real user hash on valid login attempt', async () => {
    const fakeUser = { id: 'uid', email: 'user@example.com', passwordHash: '$2a$12$actualhash' };
    mockFindUnique.mockResolvedValue(fakeUser);
    mockBcryptCompare.mockResolvedValue(true);

    await POST(makeRequest({ email: 'user@example.com', password: 'mypassword' }));

    expect(mockBcryptCompare).toHaveBeenCalledWith('mypassword', '$2a$12$actualhash');
  });

  // ── Unexpected error ────────────────────────────────────────────────────────

  it('returns 500 when prisma throws an unexpected error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection failed'));

    const req = makeRequest({ email: 'user@example.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('returns 500 when signToken throws an unexpected error', async () => {
    const fakeUser = { id: 'uid', email: 'user@example.com', passwordHash: '$2a$12$hash' };
    mockFindUnique.mockResolvedValue(fakeUser);
    mockBcryptCompare.mockResolvedValue(true);
    mockSignToken.mockRejectedValue(new Error('JWT error'));

    const req = makeRequest({ email: 'user@example.com', password: 'password' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
