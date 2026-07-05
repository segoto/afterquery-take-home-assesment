import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { MeResponse, ApiErrorResponse } from '@/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<MeResponse | ApiErrorResponse>> {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
