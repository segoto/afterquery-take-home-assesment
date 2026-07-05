/**
 * @jest-environment jsdom
 *
 * Unit tests for the /reset-password page component.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

// ── Mock next/navigation before any component import ────────────────────────

const mockPush = jest.fn<(url: string) => void>();
const mockGet = jest.fn<(key: string) => string | null>();

jest.unstable_mockModule('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
  usePathname: () => '/reset-password',
}));

// ── Mock next/link as a plain anchor element ─────────────────────────────────

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

const { render, screen, fireEvent, waitFor, act } = await import('@testing-library/react');
const { default: ResetPasswordPage } = await import('@/app/reset-password/page');

// ─────────────────────────────────────────────────────────────────────────────
// Type-safe fetch stub
// ─────────────────────────────────────────────────────────────────────────────

type FetchMock = jest.MockedFunction<typeof globalThis.fetch>;

// ─────────────────────────────────────────────────────────────────────────────
// No token present
// ─────────────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage — no token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it('shows error message when token is null', async () => {
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      expect(
        screen.getByText('No reset token found. Please start the process again.')
      ).toBeInTheDocument();
    });
  });

  it('does not render the form when token is null', async () => {
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /set new password/i })).not.toBeInTheDocument();
    });
  });

  it('renders a link to /forgot-password when token is null', async () => {
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back to forgot password/i });
      expect(link).toHaveAttribute('href', '/forgot-password');
    });
  });

  it('shows error message when token is an empty string', async () => {
    mockGet.mockReturnValue('');
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      expect(
        screen.getByText('No reset token found. Please start the process again.')
      ).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Token present — form rendered
// ─────────────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage — token present', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue('valid-reset-token-abc123');
  });

  it('renders the password form when token is present', async () => {
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument();
    });
  });

  it('renders the Back to sign in link pointing to /login', async () => {
    render(React.createElement(ResetPasswordPage));
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back to sign in/i });
      expect(link).toHaveAttribute('href', '/login');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Client-side validation
// ─────────────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage — client-side validation', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue('valid-token');
    fetchMock = jest.fn() as FetchMock;
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows error and does not call fetch when password is shorter than 8 characters', async () => {
    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toContain(
        'Password must be at least 8 characters'
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows error and does not call fetch when passwords do not match', async () => {
    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'different456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toContain('Passwords do not match');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Successful submission
// ─────────────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage — successful submission', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue('valid-token-xyz');
    fetchMock = jest.fn() as FetchMock;
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows success message and hides the form on successful submission', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Password updated. Redirecting to login...')
      ).toBeInTheDocument();
    });

    // Form inputs should be hidden
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
  });

  it('calls router.push("/login") after 2 seconds on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Password updated. Redirecting to login...')
      ).toBeInTheDocument();
    });

    // push should not have been called yet (waiting 2 seconds)
    expect(mockPush).not.toHaveBeenCalled();

    // Advance timers by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('sends token, password, and confirmPassword in the request body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'valid-token-xyz',
            password: 'newpassword123',
            confirmPassword: 'newpassword123',
          }),
        })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server error response
// ─────────────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage — server error', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue('expired-token-abc');
    fetchMock = jest.fn() as FetchMock;
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows server error message with role="alert"', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid or expired reset token' }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toContain('Invalid or expired reset token');
    });
  });

  it('renders a link to /forgot-password in the error message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid or expired reset token' }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      const tryAgainLink = screen.getByRole('link', { name: /try again/i });
      expect(tryAgainLink).toHaveAttribute('href', '/forgot-password');
    });
  });

  it('does not redirect on server error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid or expired reset token' }),
    } as Response);

    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
