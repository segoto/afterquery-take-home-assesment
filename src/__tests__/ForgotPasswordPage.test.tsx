/**
 * @jest-environment jsdom
 *
 * Unit tests for the /forgot-password page component.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

// ── Mock next/navigation before any component import ────────────────────────

const mockPush = jest.fn<(url: string) => void>();

jest.unstable_mockModule('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// ── Mock next/link as a plain anchor element ─────────────────────────────────
// Using the top-level React import (available in closure) to avoid require().

jest.unstable_mockModule('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('a', { href, className }, children),
}));

// ── Dynamic imports (after unstable_mockModule) ──────────────────────────────

const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(React.createElement(ForgotPasswordPage));
}

function fillEmail(value: string) {
  const input = screen.getByLabelText('Email');
  fireEvent.change(input, { target: { value } });
}

function submitForm() {
  const button = screen.getByRole('button', { name: /send reset link/i });
  fireEvent.click(button);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// Type-safe fetch stub that matches the global fetch signature
type FetchMock = jest.MockedFunction<typeof globalThis.fetch>;

describe('ForgotPasswordPage', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn() as FetchMock;
    // Install fetch on the global object for jsdom environment
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders email input and submit button', () => {
    renderPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('renders "Back to sign in" link pointing to /login', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /back to sign in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('calls router.push with reset-password URL when token is returned', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc123token' }),
    } as Response);

    renderPage();
    fillEmail('user@example.com');
    submitForm();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/reset-password?token=abc123token');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('shows static message and does NOT redirect when token is null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: null }),
    } as Response);

    renderPage();
    fillEmail('unknown@example.com');
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists for that email/i),
      ).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows error message when API returns a non-200 response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email is required' }),
    } as Response);

    renderPage();
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows error message on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    renderPage();
    fillEmail('user@example.com');
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveRequest!: (value: Response) => void;
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });

    fetchMock.mockReturnValueOnce(pendingRequest);

    renderPage();
    fillEmail('user@example.com');
    submitForm();

    // While pending, button must be disabled
    const button = screen.getByRole('button', { name: /send reset link/i });
    expect(button).toBeDisabled();

    // Resolve the request to let the test clean up
    resolveRequest({
      ok: true,
      json: async () => ({ token: 'tok' }),
    } as Response);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });
});
