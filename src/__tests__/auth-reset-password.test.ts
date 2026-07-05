/**
 * Unit tests for POST /api/auth/reset-password
 *
 * Uses jest.unstable_mockModule() for ESM-compatible mocking of:
 * - @/lib/prisma  → prisma.passwordResetToken.findUnique, prisma.passwordResetToken.delete,
 *                    prisma.user.update, prisma.$transaction
 * - bcryptjs      → bcrypt.hash
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Mock function references (set up before module registration) ──────────────
// Typed explicitly so mockResolvedValue / mockRejectedValue are well-typed
// and toHaveBeenCalledWith is not restricted to 0 args.
const mockBcryptHash = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockFindUniqueToken = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDeleteToken = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdateUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTransaction = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();

// ── Register ESM-native mocks ─────────────────────────────────────────────────
await jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockBcryptHash },
}));

await jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    passwordResetToken: {
      findUnique: mockFindUniqueToken,
      delete: mockDeleteToken,
    },
    user: {
      update: mockUpdateUser,
    },
    $transaction: mockTransaction,
  },
}));

// ── Import route AFTER mocks are registered ───────────────────────────────────
const { POST } = await import('../app/api/auth/reset-password/route');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_TOKEN = 'a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';
const VALID_PASSWORD = 'newpassword123';
const FUTURE_EXPIRY = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
const PAST_EXPIRY = new Date(Date.now() - 60 * 60 * 1000);   // 1 hour ago

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBcryptHash.mockResolvedValue('$2a$12$hashedpassword');
    mockTransaction.mockResolvedValue([null, null]);
  });

  // ── Token validation ─────────────────────────────────────────────────────────

  it('returns 400 when token is missing', async () => {
    const req = makeRequest({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Token is required' });
  });

  it('returns 400 when token is an empty string', async () => {
    const req = makeRequest({ token: '', password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Token is required' });
  });

  it('returns 400 when token is not a string', async () => {
    const req = makeRequest({ token: 12345, password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Token is required' });
  });

  // ── Password validation ───────────────────────────────────────────────────────

  it('returns 400 when password is shorter than 8 characters', async () => {
    const req = makeRequest({ token: VALID_TOKEN, password: 'short', confirmPassword: 'short' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Password must be at least 8 characters' });
  });

  it('returns 400 when password is missing', async () => {
    const req = makeRequest({ token: VALID_TOKEN, confirmPassword: VALID_PASSWORD });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Password must be at least 8 characters' });
  });

  it('returns 400 when password is exactly 7 characters', async () => {
    const req = makeRequest({ token: VALID_TOKEN, password: '1234567', confirmPassword: '1234567' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Password must be at least 8 characters' });
  });

  // ── Confirm password validation ───────────────────────────────────────────────

  it('returns 400 when passwords do not match', async () => {
    const req = makeRequest({
      token: VALID_TOKEN,
      password: 'newpassword1',
      confirmPassword: 'newpassword2',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Passwords do not match' });
  });

  // ── Token lookup ─────────────────────────────────────────────────────────────

  it('returns 400 when token is not found in the database', async () => {
    mockFindUniqueToken.mockResolvedValue(null);

    const req = makeRequest({
      token: VALID_TOKEN,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Invalid or expired reset token' });

    expect(mockFindUniqueToken).toHaveBeenCalledWith({ where: { token: VALID_TOKEN } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // ── Token expiry ──────────────────────────────────────────────────────────────

  it('returns 400 for an expired token and deletes it', async () => {
    const expiredTokenRow = {
      id: 'token-id',
      token: VALID_TOKEN,
      email: 'user@example.com',
      expiresAt: PAST_EXPIRY,
      createdAt: new Date(),
    };
    mockFindUniqueToken.mockResolvedValue(expiredTokenRow);
    mockDeleteToken.mockResolvedValue(expiredTokenRow);

    const req = makeRequest({
      token: VALID_TOKEN,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Invalid or expired reset token' });

    expect(mockDeleteToken).toHaveBeenCalledWith({ where: { token: VALID_TOKEN } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // ── Successful password reset ─────────────────────────────────────────────────

  it('returns 200 and atomically updates password and deletes token on success', async () => {
    const validTokenRow = {
      id: 'token-id',
      token: VALID_TOKEN,
      email: 'user@example.com',
      expiresAt: FUTURE_EXPIRY,
      createdAt: new Date(),
    };
    mockFindUniqueToken.mockResolvedValue(validTokenRow);
    mockBcryptHash.mockResolvedValue('$2a$12$hashed-new-password');
    mockTransaction.mockResolvedValue([
      { id: 'user-id', email: 'user@example.com' },
      validTokenRow,
    ]);

    const req = makeRequest({
      token: VALID_TOKEN,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body).toEqual({ success: true });

    // bcrypt.hash should have been called with the password and cost factor 12
    expect(mockBcryptHash).toHaveBeenCalledWith(VALID_PASSWORD, 12);

    // $transaction should be called once (atomically updates user + deletes token)
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // user.update should be called with the new passwordHash and correct email
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { passwordHash: '$2a$12$hashed-new-password' },
    });

    // token.delete should be called with the correct token (as part of the $transaction args)
    expect(mockDeleteToken).toHaveBeenCalledWith({ where: { token: VALID_TOKEN } });
  });

  it('accepts a password of exactly 8 characters', async () => {
    const validTokenRow = {
      id: 'token-id',
      token: VALID_TOKEN,
      email: 'user@example.com',
      expiresAt: FUTURE_EXPIRY,
      createdAt: new Date(),
    };
    mockFindUniqueToken.mockResolvedValue(validTokenRow);
    mockTransaction.mockResolvedValue([null, null]);

    const req = makeRequest({
      token: VALID_TOKEN,
      password: '12345678',
      confirmPassword: '12345678',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  // ── Unexpected error ──────────────────────────────────────────────────────────

  it('returns 500 when prisma.passwordResetToken.findUnique throws', async () => {
    mockFindUniqueToken.mockRejectedValue(new Error('DB connection failed'));

    const req = makeRequest({
      token: VALID_TOKEN,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('returns 500 when prisma.$transaction throws', async () => {
    const validTokenRow = {
      id: 'token-id',
      token: VALID_TOKEN,
      email: 'user@example.com',
      expiresAt: FUTURE_EXPIRY,
      createdAt: new Date(),
    };
    mockFindUniqueToken.mockResolvedValue(validTokenRow);
    mockBcryptHash.mockResolvedValue('$2a$12$hashed');
    mockTransaction.mockRejectedValue(new Error('Transaction failed'));

    const req = makeRequest({
      token: VALID_TOKEN,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
