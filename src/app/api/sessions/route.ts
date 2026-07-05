import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import type { PostSessionResponse, ApiErrorResponse } from '@/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<PostSessionResponse | ApiErrorResponse>> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Validate jobId: must be present, a string, and non-empty
    if (
      typeof body !== 'object' ||
      body === null ||
      !('jobId' in body) ||
      typeof (body as Record<string, unknown>).jobId !== 'string' ||
      !(body as Record<string, unknown>).jobId
    ) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const { jobId } = body as { jobId: string };

    // Verify the job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Extract userId from auth cookie — never blocks on auth failure;
    // middleware already verified the session for protected routes.
    let userId: string | null = null;
    const token = request.cookies.get('auth_token')?.value;
    const payload = await verifyToken(token ?? '');
    if (payload) {
      userId = payload.sub;
    }

    // Create the session row
    const session = await prisma.session.create({
      data: { jobId, userId, status: 'IN_PROGRESS' },
    });

    return NextResponse.json({ id: session.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
