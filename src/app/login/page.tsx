'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const redirect = searchParams.get('redirect');
        if (redirect && redirect.startsWith('/')) {
          router.push(redirect);
        } else {
          router.push('/');
        }
      } else {
        const data = (await response.json()) as { error: string };
        setError(data.error || 'An error occurred. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm">
        <Card>
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-900">AI Interviewer</h1>
              <p className="mt-1 text-sm text-zinc-500">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                id="email"
                name="email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />

              <Input
                id="password"
                name="password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />

              {error && (
                <p
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {error}
                </p>
              )}

              <Button
                variant="primary"
                type="submit"
                loading={loading}
                disabled={loading}
                className="w-full"
              >
                Sign in
              </Button>
            </form>

            <div className="space-y-2 text-center text-sm">
              <p>
                <Link
                  href="/forgot-password"
                  className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                >
                  Forgot your password?
                </Link>
              </p>
              <p className="text-zinc-600">
                {"Don't have an account?"}{' '}
                <Link
                  href="/signup"
                  className="font-medium text-zinc-900 hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
