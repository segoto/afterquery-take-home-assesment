'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    // Client-side validation — do NOT call fetch if invalid
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      if (response.ok) {
        const redirect = searchParams.get('redirect');
        if (redirect && redirect.startsWith('/')) {
          router.push(redirect);
        } else {
          router.push('/');
        }
        return;
      }

      const data = (await response.json()) as { error?: string };
      setError(data.error ?? 'Something went wrong. Please try again.');
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              AI Interviewer Platform
            </p>
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
              placeholder="you@example.com"
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />

            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />

            {error && (
              <p
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 outline-none"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Create account
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link
              href="/login"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
