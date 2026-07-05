import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import type { LogoutResponse, ApiErrorResponse } from '@/types';

export async function POST(): Promise<
  NextResponse<LogoutResponse | ApiErrorResponse>
> {
  try {
    return NextResponse.json(
      { success: true as const },
      {
        status: 200,
        headers: { 'Set-Cookie': clearAuthCookie() },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
