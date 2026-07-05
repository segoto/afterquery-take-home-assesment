import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload } from '@/types';

/**
 * Reads and validates JWT_SECRET from the environment.
 * In production, throws if the secret is absent or shorter than 32 characters.
 * In development, logs a warning instead of throwing.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    console.warn(
      '[auth] WARNING: JWT_SECRET is missing or shorter than 32 characters. ' +
        'Set a secure secret in .env for production use.'
    );
  }

  return secret ?? '';
}

/**
 * Signs a JWT with the given payload using HS256.
 * The token expires in 7 days.
 */
export async function signToken(payload: {
  sub: string;
  email: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(getJwtSecret());

  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Verifies a JWT and returns its payload, or null if the token is invalid or expired.
 * Never throws.
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.sub !== 'string' || typeof payload['email'] !== 'string') {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload['email'] as string,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

/**
 * Builds the value of a Set-Cookie header that sets the auth_token cookie.
 * Appends Secure flag only in production.
 */
export function buildAuthCookie(token: string): string {
  const secure =
    process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return `auth_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`;
}

/**
 * Returns a Set-Cookie header value that clears the auth_token cookie.
 */
export function clearAuthCookie(): string {
  return 'auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}
