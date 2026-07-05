import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ForgotPasswordResponse, ApiErrorResponse } from '@/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ForgotPasswordResponse | ApiErrorResponse>> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { email } =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { email: true },
    });

    if (!user) {
      // Return 200 with null token to avoid email enumeration
      return NextResponse.json({ token: null }, { status: 200 });
    }

    // Delete any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail },
    });

    // Generate a cryptographically random 64-character hex token
    const token = randomBytes(32).toString('hex');

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store the new reset token
    await prisma.passwordResetToken.create({
      data: { token, email: normalizedEmail, expiresAt },
    });

    return NextResponse.json({ token }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
