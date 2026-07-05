'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenNull, setTokenNull] = useState(false);

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
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      const { token } = data as { token: string | null };

      if (token !== null) {
        router.push('/reset-password?token=' + token);
      } else {
        setTokenNull(true);
      }
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
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Enter your email and we&apos;ll generate a reset link.
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

            {tokenNull && (
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                If an account exists for that email, you will be redirected to
                set a new password.
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Send reset link
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link
              href="/login"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
