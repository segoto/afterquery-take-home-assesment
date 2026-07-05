import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  if (!token) {
    return redirectToLogin(request, pathname);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/interview/:path*', '/results/:path*'],
};
