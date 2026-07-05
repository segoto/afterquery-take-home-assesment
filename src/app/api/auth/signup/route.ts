import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { prisma } from '@/lib/prisma';
import { signToken, buildAuthCookie } from '@/lib/auth';
import type { SignupResponse, ApiErrorResponse } from '@/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<SignupResponse | ApiErrorResponse>> {
  try {
    const body: unknown = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { email, password, confirmPassword } = body as Record<string, unknown>;

    // Validate email presence
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate password presence (missing treated as length < 8)
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the password with cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the user in the database
    let user: { id: string; email: string };
    try {
      user = await prisma.user.create({
        data: { email: email.trim(), passwordHash },
        select: { id: true, email: true },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }
      throw err;
    }

    // Sign JWT and build Set-Cookie header
    const token = await signToken({ sub: user.id, email: user.email });
    const cookie = buildAuthCookie(token);

    return NextResponse.json(
      { id: user.id, email: user.email },
      {
        status: 201,
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
