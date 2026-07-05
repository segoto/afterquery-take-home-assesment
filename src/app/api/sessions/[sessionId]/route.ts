import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import type { PatchSessionResponse, ApiErrorResponse } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<PatchSessionResponse | ApiErrorResponse>> {
  try {
    const { sessionId } = await params;

    // 1. Authenticate
    const token = request.cookies.get('auth_token')?.value;
    const payload = await verifyToken(token ?? '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 3. Validate body.status
    if (
      typeof body !== 'object' ||
      body === null ||
      (body as Record<string, unknown>).status !== 'ABANDONED'
    ) {
      return NextResponse.json({ error: 'status must be ABANDONED' }, { status: 400 });
    }

    // 4. Look up session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 5. Check ownership
    if (session.userId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 6. Check status
    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Session is not in progress' }, { status: 409 });
    }

    // 7. Update
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ABANDONED', endedAt: new Date() },
    });

    // 8. Return success
    return NextResponse.json({ id: session.id, status: 'ABANDONED' }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
