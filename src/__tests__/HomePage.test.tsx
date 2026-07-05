/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

const mockRedirect = jest.fn<(url: string) => never>();
const mockCookiesGet = jest.fn<() => { value: string } | undefined>();
const mockVerifyToken = jest.fn<() => Promise<{ sub: string; email: string } | null>>();
const mockJobFindMany = jest.fn<() => Promise<Array<{ id: string; title: string; description: string }>>>();

jest.unstable_mockModule('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: mockCookiesGet })),
}));

jest.unstable_mockModule('next/navigation', () => ({
  redirect: mockRedirect,
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
}));

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: mockJobFindMany,
    },
  },
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

jest.unstable_mockModule('@/components/LogoutButton', () => ({
  LogoutButton: () => React.createElement('button', null, 'Log out'),
}));

jest.unstable_mockModule('@/components/ui/Button', () => ({
  Button: ({
    href,
    children,
    className,
  }: {
    href?: string;
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  }) =>
    href
      ? React.createElement('a', { href, className }, children)
      : React.createElement('button', { className }, children),
}));

jest.unstable_mockModule('@/components/ui/Card', () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('div', { className }, children),
}));

const { render, screen } = await import('@testing-library/react');
const { default: HomePage } = await import('@/app/page');

const VALID_PAYLOAD = { sub: 'user-1', email: 'test@example.com' };

const SAMPLE_JOBS = [
  { id: 'job-1', title: 'Software Engineer', description: 'Build great software.' },
  { id: 'job-2', title: 'Product Manager', description: 'Drive product strategy.' },
];

async function renderPage() {
  const jsx = await HomePage();
  return render(jsx as React.ReactElement);
}

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT');
    });
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyToken.mockResolvedValue(VALID_PAYLOAD);
    mockJobFindMany.mockResolvedValue(SAMPLE_JOBS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls redirect("/login") when cookie is absent', async () => {
    mockCookiesGet.mockReturnValue(undefined);

    await expect(renderPage()).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('calls redirect("/login") when verifyToken returns null', async () => {
    mockVerifyToken.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('renders h1 "Available Positions" and job titles when authenticated', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /available positions/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /software engineer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /product manager/i })).toBeInTheDocument();
  });

  it('renders the user email in the header when authenticated', async () => {
    await renderPage();

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders "No positions available at this time." when findMany returns empty array', async () => {
    mockJobFindMany.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText(/no positions available at this time/i)).toBeInTheDocument();
  });

  it('renders error state and calls console.error when findMany throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockJobFindMany.mockRejectedValue(new Error('DB connection error'));

    await renderPage();

    expect(screen.getByText(/unable to load positions/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
