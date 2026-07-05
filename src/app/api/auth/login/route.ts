import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, buildAuthCookie } from '@/lib/auth';
import type { LoginResponse, ApiErrorResponse } from '@/types';

/**
 * Dummy hash used when the user is not found.
 * This ensures bcrypt.compare is always called, preventing
 * timing-based email enumeration attacks.
 */
const DUMMY_HASH = '$2a$12$dummyhashfortimingprotectionXXXXXXXXXXX';

export async function POST(
  request: NextRequest
): Promise<NextResponse<LoginResponse | ApiErrorResponse>> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !('email' in body) ||
      !('password' in body) ||
      typeof (body as Record<string, unknown>).email !== 'string' ||
      typeof (body as Record<string, unknown>).password !== 'string' ||
      !(body as Record<string, unknown>).email ||
      !(body as Record<string, unknown>).password
    ) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { email, password } = body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run bcrypt.compare to prevent timing-based email enumeration.
    // If the user was not found, compare against a dummy hash (will always fail).
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await signToken({ sub: user.id, email: user.email });
    const cookie = buildAuthCookie(token);

    return NextResponse.json(
      { id: user.id, email: user.email },
      {
        status: 200,
        headers: { 'Set-Cookie': cookie },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
