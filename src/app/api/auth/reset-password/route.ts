import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { ResetPasswordResponse, ApiErrorResponse } from '@/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ResetPasswordResponse | ApiErrorResponse>> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const raw = body as Record<string, unknown>;

    // Validate token
    if (!raw.token || typeof raw.token !== 'string' || raw.token.trim() === '') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate password
    if (
      !raw.password ||
      typeof raw.password !== 'string' ||
      raw.password.length < 8
    ) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate confirmPassword match
    if (raw.password !== raw.confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    const { token, password } = { token: raw.token, password: raw.password };

    // Look up the reset token
    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!tokenRow) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check expiry
    if (tokenRow.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Atomically update the user's password and delete the used token
    await prisma.$transaction([
      prisma.user.update({
        where: { email: tokenRow.email },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { token } }),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
