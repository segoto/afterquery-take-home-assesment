/**
 * @jest-environment jsdom
 *
 * Unit tests for /signup page component.
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 *
 * Tests verify:
 * 1. Client-side validation does NOT call fetch on short password.
 * 2. Client-side validation does NOT call fetch on password mismatch.
 * 3. Successful signup calls fetch with correct body and redirects.
 * 4. Server error is displayed inline.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Mock next/navigation ──────────────────────────────────────────────────────

const mockPush = jest.fn<(path: string) => void>();
let mockRedirectParam: string | null = null;

jest.unstable_mockModule('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'redirect' ? mockRedirectParam : null),
  }),
}));

// ── Dynamically import component after mocks are registered ───────────────────

const { default: SignupPage } = await import('@/app/signup/page');

// ── Fetch mock helper ─────────────────────────────────────────────────────────

function mockFetchOk(body: object, status = 201) {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchError(body: object, status: number) {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchPending() {
  global.fetch = jest.fn<typeof fetch>().mockReturnValue(
    new Promise<Response>(() => {})
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillForm({
  email = 'test@example.com',
  password = 'password123',
  confirmPassword = 'password123',
}: {
  email?: string;
  password?: string;
  confirmPassword?: string;
} = {}) {
  if (email !== undefined) {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  }
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), {
    target: { value: confirmPassword },
  });
}

function submitForm() {
  const button = screen.getByRole('button', { name: /create account/i });
  const form = button.closest('form');
  if (!form) throw new Error('Form not found');
  fireEvent.submit(form);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirectParam = null;
    // Reset fetch so tests that don't set it won't accidentally call a stale mock
    global.fetch = jest.fn<typeof fetch>();
  });

  // ── Renders ─────────────────────────────────────────────────────────────────

  it('renders all three input fields', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('renders the "Create account" submit button', () => {
    render(<SignupPage />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders a link to /login', () => {
    render(<SignupPage />);
    const link = screen.getByRole('link', { name: /already have an account/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('does not render an error alert initially', () => {
    render(<SignupPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Client-side validation — short password ──────────────────────────────

  it('shows "Password must be at least 8 characters" for a short password and does NOT call fetch', async () => {
    render(<SignupPage />);
    fillForm({ password: 'short', confirmPassword: 'short' });
    submitForm();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toBe('Password must be at least 8 characters');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows "Password must be at least 8 characters" for exactly 7 chars and does NOT call fetch', async () => {
    render(<SignupPage />);
    fillForm({ password: '1234567', confirmPassword: '1234567' });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Password must be at least 8 characters'
      );
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── Client-side validation — password mismatch ───────────────────────────

  it('shows "Passwords do not match" when passwords differ and does NOT call fetch', async () => {
    render(<SignupPage />);
    fillForm({ password: 'password123', confirmPassword: 'different456' });
    submitForm();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toBe('Passwords do not match');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('checks password length before mismatch (length error takes priority)', async () => {
    render(<SignupPage />);
    fillForm({ password: 'abc', confirmPassword: 'xyz' });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Password must be at least 8 characters'
      );
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts exactly 8 characters as a valid password length and calls fetch', async () => {
    mockFetchOk({ id: 'user-1', email: 'test@example.com' }, 201);

    render(<SignupPage />);
    fillForm({ password: '12345678', confirmPassword: '12345678' });
    submitForm();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Successful signup ────────────────────────────────────────────────────

  it('calls fetch with the correct endpoint and body on valid submission', async () => {
    mockFetchOk({ id: 'user-1', email: 'test@example.com' }, 201);

    render(<SignupPage />);
    fillForm({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    submitForm();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'password123',
        }),
      });
    });
  });

  it('redirects to "/" after successful signup when no redirect param is set', async () => {
    mockRedirectParam = null;
    mockFetchOk({ id: 'user-1', email: 'test@example.com' }, 201);

    render(<SignupPage />);
    fillForm();
    submitForm();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to the redirect param when it starts with "/"', async () => {
    mockRedirectParam = '/interview/job-123';
    mockFetchOk({ id: 'user-1', email: 'test@example.com' }, 201);

    render(<SignupPage />);
    fillForm();
    submitForm();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/interview/job-123');
    });
  });

  it('falls back to "/" when the redirect param does not start with "/"', async () => {
    mockRedirectParam = 'https://evil.example.com';
    mockFetchOk({ id: 'user-1', email: 'test@example.com' }, 201);

    render(<SignupPage />);
    fillForm();
    submitForm();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  // ── Server-side errors ───────────────────────────────────────────────────

  it('displays the server error message from a 400 response', async () => {
    mockFetchError({ error: 'Email is required' }, 400);

    render(<SignupPage />);
    fillForm({ email: 'bad@example.com' });
    submitForm();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toBe('Email is required');
    });
  });

  it('displays "Email already registered" from a 409 response', async () => {
    mockFetchError({ error: 'Email already registered' }, 409);

    render(<SignupPage />);
    fillForm({ email: 'existing@example.com' });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Email already registered');
    });
  });

  it('does not redirect when the server returns an error', async () => {
    mockFetchError({ error: 'Email already registered' }, 409);

    render(<SignupPage />);
    fillForm();
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('disables the submit button while the request is in flight', async () => {
    mockFetchPending();

    render(<SignupPage />);
    fillForm();

    await act(async () => {
      submitForm();
    });

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });
});
