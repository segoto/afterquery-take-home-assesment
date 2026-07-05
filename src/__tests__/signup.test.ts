/**
 * Unit tests for POST /api/auth/signup
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ── Set up mock functions ─────────────────────────────────────────────────────

const mockCreate = jest.fn<(args: unknown) => Promise<{ id: string; email: string }>>();
const mockSignToken = jest.fn<(payload: { sub: string; email: string }) => Promise<string>>();
const mockBuildAuthCookie = jest.fn<(token: string) => string>();
const mockBcryptHash = jest.fn<(password: string, rounds: number) => Promise<string>>();

/**
 * Custom error class that mimics PrismaClientKnownRequestError.
 * Used to test P2002 (unique constraint) handling.
 */
class MockPrismaKnownError extends Error {
  code: string;
  clientVersion: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = '7.8.0';
  }
}

// ── Register ESM-compatible module mocks ──────────────────────────────────────

jest.unstable_mockModule('@prisma/client/runtime/client', () => ({
  PrismaClientKnownRequestError: MockPrismaKnownError,
}));

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: mockCreate,
    },
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  signToken: mockSignToken,
  buildAuthCookie: mockBuildAuthCookie,
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    hash: mockBcryptHash,
  },
}));

// ── Dynamically import route after mocks are registered ───────────────────────

const { POST } = await import('@/app/api/auth/signup/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default happy-path mock return values
    mockBcryptHash.mockResolvedValue('hashed_password_value');
    mockSignToken.mockResolvedValue('signed.jwt.token');
    mockBuildAuthCookie.mockReturnValue(
      'auth_token=signed.jwt.token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
    );
    mockCreate.mockResolvedValue({ id: 'user_id_123', email: 'test@example.com' });
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 with "Email is required" when email is missing', async () => {
      const req = makeRequest({ password: 'password123', confirmPassword: 'password123' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Email is required' });
    });

    it('returns 400 with "Email is required" when email is an empty string', async () => {
      const req = makeRequest({ email: '', password: 'password123', confirmPassword: 'password123' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Email is required' });
    });

    it('returns 400 with "Email is required" when email is whitespace only', async () => {
      const req = makeRequest({ email: '   ', password: 'password123', confirmPassword: 'password123' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Email is required' });
    });

    it('returns 400 with "Password must be at least 8 characters" when password is missing', async () => {
      const req = makeRequest({ email: 'test@example.com', confirmPassword: 'password123' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Password must be at least 8 characters' });
    });

    it('returns 400 with "Passwords do not match" when passwords differ', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different456',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Passwords do not match' });
    });

    it('returns 400 with "Password must be at least 8 characters" when password is too short', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'short',
        confirmPassword: 'short',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Password must be at least 8 characters' });
    });

    it('does not call bcrypt.hash when validation fails', async () => {
      const req = makeRequest({ email: '', password: 'password123', confirmPassword: 'password123' });
      await POST(req);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('does not call prisma.user.create when validation fails', async () => {
      const req = makeRequest({ email: 'test@example.com', password: 'short', confirmPassword: 'short' });
      await POST(req);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ── Duplicate email (P2002) ─────────────────────────────────────────────────

  describe('duplicate email (P2002)', () => {
    it('returns 409 with "Email already registered" on P2002 Prisma error', async () => {
      mockCreate.mockRejectedValue(
        new MockPrismaKnownError('Unique constraint failed', { code: 'P2002' })
      );
      const req = makeRequest({
        email: 'duplicate@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Email already registered' });
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('unexpected errors', () => {
    it('returns 500 with "Internal server error" on unexpected Prisma error', async () => {
      mockCreate.mockRejectedValue(new Error('DB connection refused'));
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 when request.json() throws', async () => {
      const badReq = new NextRequest('http://localhost/api/auth/signup', {
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

  // ── Successful signup ───────────────────────────────────────────────────────

  describe('successful signup', () => {
    it('returns 201 with { id, email } on successful signup', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ id: 'user_id_123', email: 'test@example.com' });
    });

    it('calls bcrypt.hash with the password and cost factor 12', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'mySecurePass',
        confirmPassword: 'mySecurePass',
      });
      await POST(req);
      expect(mockBcryptHash).toHaveBeenCalledWith('mySecurePass', 12);
    });

    it('calls prisma.user.create with email and passwordHash', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      await POST(req);
      expect(mockCreate).toHaveBeenCalledWith({
        data: { email: 'test@example.com', passwordHash: 'hashed_password_value' },
        select: { id: true, email: true },
      });
    });

    it('calls signToken with the new user id and email', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      await POST(req);
      expect(mockSignToken).toHaveBeenCalledWith({
        sub: 'user_id_123',
        email: 'test@example.com',
      });
    });

    it('sets Set-Cookie header on success', async () => {
      const req = makeRequest({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      const res = await POST(req);
      expect(res.headers.get('Set-Cookie')).toBe(
        'auth_token=signed.jwt.token; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'
      );
    });
  });
});
