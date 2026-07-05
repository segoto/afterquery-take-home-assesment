/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

const mockPush = jest.fn();
const mockGet = jest.fn();

jest.unstable_mockModule('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

jest.unstable_mockModule('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...props }, children),
}));

const { render, screen, fireEvent, waitFor, act } = await import('@testing-library/react');
const { default: LoginPage } = await import('@/app/login/page');

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the platform heading', () => {
    render(React.createElement(LoginPage));
    expect(screen.getByRole('heading', { name: /ai interviewer/i })).toBeInTheDocument();
  });

  it('renders email and password inputs with labels', () => {
    render(React.createElement(LoginPage));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders Sign in submit button', () => {
    render(React.createElement(LoginPage));
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders links to /signup and /forgot-password', () => {
    render(React.createElement(LoginPage));
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    expect(
      screen.getByRole('link', { name: /forgot your password/i }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('calls fetch with correct body on submit', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'user@example.com' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      });
    });
  });

  it('redirects to "/" when response is ok and no redirect param', async () => {
    mockGet.mockReturnValue(null);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'user@example.com' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to safe redirect param when it starts with "/"', async () => {
    mockGet.mockReturnValue('/interview/some-job');
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'user@example.com' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/interview/some-job');
    });
  });

  it('ignores redirect param that does not start with "/"', async () => {
    mockGet.mockReturnValue('https://evil.com');
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'user@example.com' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message with role="alert" when response is not ok', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toBe('Invalid credentials');
    });
  });

  it('error element has tabIndex=-1', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

    render(React.createElement(LoginPage));

    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('tabindex', '-1');
    });
  });

  it('disables button while loading', async () => {
    let resolveResponse!: (value: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(responsePromise);

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    act(() => {
      fireEvent.submit(
        screen.getByRole('button', { name: /sign in/i }).closest('form')!,
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });

    // Resolve so the component can clean up
    act(() => {
      resolveResponse({
        ok: true,
        json: async () => ({ id: '1', email: 'user@example.com' }),
      } as Response);
    });
  });
});
