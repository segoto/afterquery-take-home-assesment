import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SignJWT } from 'jose';
import {
  getJwtSecret,
  signToken,
  verifyToken,
  buildAuthCookie,
  clearAuthCookie,
} from './auth';

const VALID_SECRET =
  'a-very-long-and-secure-secret-for-testing-purposes!!';

// Helper to set process.env.NODE_ENV since TypeScript marks it read-only
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>)['NODE_ENV'] = value;
}

beforeEach(() => {
  process.env.JWT_SECRET = VALID_SECRET;
  setNodeEnv('test');
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  setNodeEnv('test');
});

// ─── getJwtSecret ────────────────────────────────────────────────────────────

describe('getJwtSecret', () => {
  it('returns the secret when it is set and long enough', () => {
    expect(getJwtSecret()).toBe(VALID_SECRET);
  });

  it('throws in production when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    setNodeEnv('production');

    expect(() => getJwtSecret()).toThrow(
      'JWT_SECRET environment variable is not set'
    );
  });

  it('throws in production when JWT_SECRET is shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'short';
    setNodeEnv('production');

    expect(() => getJwtSecret()).toThrow(
      'JWT_SECRET environment variable is not set'
    );
  });

  it('logs a warning in development when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    setNodeEnv('development');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => getJwtSecret()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('JWT_SECRET is missing')
    );

    warnSpy.mockRestore();
  });
});

// ─── signToken + verifyToken round-trip ──────────────────────────────────────

describe('signToken and verifyToken', () => {
  it('round-trips: sign then verify returns the original payload', async () => {
    const payload = { sub: 'user-123', email: 'alice@example.com' };

    const token = await signToken(payload);
    const result = await verifyToken(token);

    expect(result).not.toBeNull();
    expect(result!.sub).toBe(payload.sub);
    expect(result!.email).toBe(payload.email);
  });

  it('returns exp and iat fields after verification', async () => {
    const token = await signToken({ sub: 'u1', email: 'u1@example.com' });
    const result = await verifyToken(token);

    expect(result).not.toBeNull();
    expect(typeof result!.exp).toBe('number');
    expect(typeof result!.iat).toBe('number');
  });
});

// ─── verifyToken error paths ──────────────────────────────────────────────────

describe('verifyToken', () => {
  it('returns null for a tampered token', async () => {
    const token = await signToken({ sub: 'u1', email: 'u1@example.com' });

    // Tamper: flip the last character of the signature segment
    const parts = token.split('.');
    const last = parts[parts.length - 1];
    parts[parts.length - 1] =
      last.slice(0, -1) + (last.endsWith('a') ? 'b' : 'a');
    const tampered = parts.join('.');

    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const otherSecret = new TextEncoder().encode(
      'completely-different-secret-value-here!!'
    );
    const otherToken = await new SignJWT({ email: 'attacker@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('evil-user')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(otherSecret);

    const result = await verifyToken(otherToken);
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    // Create a token that expired 1 second ago
    const secret = new TextEncoder().encode(VALID_SECRET);
    const expiredToken = await new SignJWT({ email: 'bob@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-999')
      .setIssuedAt()
      .setExpirationTime('-1s') // already expired
      .sign(secret);

    const result = await verifyToken(expiredToken);
    expect(result).toBeNull();
  });

  it('returns null for a completely malformed token string', async () => {
    const result = await verifyToken('not.a.valid.jwt.token');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });
});

// ─── buildAuthCookie ──────────────────────────────────────────────────────────

describe('buildAuthCookie', () => {
  it('includes the token, HttpOnly, SameSite=Lax, Path=/, Max-Age=604800', () => {
    const cookie = buildAuthCookie('my.jwt.token');

    expect(cookie).toContain('auth_token=my.jwt.token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=604800');
  });

  it('does NOT include Secure flag outside production', () => {
    setNodeEnv('development');
    const cookie = buildAuthCookie('token');
    expect(cookie).not.toContain('Secure');
  });

  it('includes Secure flag in production', () => {
    setNodeEnv('production');
    const cookie = buildAuthCookie('token');
    expect(cookie).toContain('Secure');
  });
});

// ─── clearAuthCookie ──────────────────────────────────────────────────────────

describe('clearAuthCookie', () => {
  it('returns a cookie value with Max-Age=0', () => {
    const cookie = clearAuthCookie();

    expect(cookie).toContain('auth_token=;');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=0');
  });

  it('does not contain a JWT token value', () => {
    const cookie = clearAuthCookie();
    // The cookie name/value pair should be "auth_token=" with no value
    expect(cookie).toMatch(/auth_token=;/);
  });
});
