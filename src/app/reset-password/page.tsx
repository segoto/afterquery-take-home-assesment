'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  // No token present — show error state immediately, no form
  if (!token) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <Card>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Reset your password
              </h1>
            </div>
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              No reset token found. Please start the process again.
            </p>
            <div className="mt-4 text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                Back to forgot password
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side validation
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      } else {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <Card>
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Reset your password
              </h1>
              <p className="mt-4 text-sm text-zinc-700">
                Password updated. Redirecting to login...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Enter and confirm your new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="password"
              name="password"
              type="password"
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm New Password"
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
                {error}{' '}
                <Link
                  href="/forgot-password"
                  className="font-medium underline underline-offset-4 hover:text-red-900"
                >
                  Try again
                </Link>
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Set new password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
