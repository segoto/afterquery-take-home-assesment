/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

const mockRedirect = jest.fn<(url: string) => never>();
const mockCookiesGet = jest.fn<() => { value: string } | undefined>();
const mockVerifyToken = jest.fn<() => Promise<{ sub: string; email: string } | null>>();
const mockJobFindMany = jest.fn<() => Promise<Array<{ id: string; title: string; description: string }>>>();
const mockSessionFindMany = jest.fn<(args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>>();

const mockDashboardTabs = jest.fn<(props: Record<string, unknown>) => React.ReactElement>();

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
    session: {
      findMany: mockSessionFindMany,
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

jest.unstable_mockModule('@/components/DashboardTabs', () => ({
  DashboardTabs: mockDashboardTabs,
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
    mockSessionFindMany.mockResolvedValue([]);
    mockDashboardTabs.mockImplementation(() =>
      React.createElement('div', { 'data-testid': 'dashboard-tabs' }),
    );
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

  it('renders DashboardTabs with jobs and no jobsError when authenticated', async () => {
    await renderPage();

    expect(screen.getByTestId('dashboard-tabs')).toBeInTheDocument();
    const props = mockDashboardTabs.mock.calls[0][0] as Record<string, unknown>;
    expect(props.jobs).toEqual(SAMPLE_JOBS);
    expect(props.jobsError).toBe(false);
  });

  it('renders the user email in the header when authenticated', async () => {
    await renderPage();

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('passes empty jobs array and jobsError=false to DashboardTabs when findMany returns empty array', async () => {
    mockJobFindMany.mockResolvedValue([]);

    await renderPage();

    const props = mockDashboardTabs.mock.calls[0][0] as Record<string, unknown>;
    expect(props.jobs).toEqual([]);
    expect(props.jobsError).toBe(false);
  });

  it('passes jobsError=true to DashboardTabs and calls console.error when findMany throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockJobFindMany.mockRejectedValue(new Error('DB connection error'));

    await renderPage();

    expect(consoleErrorSpy).toHaveBeenCalled();
    const props = mockDashboardTabs.mock.calls[0][0] as Record<string, unknown>;
    expect(props.jobsError).toBe(true);
  });

  it('sessions query is called with userId from JWT payload', async () => {
    await renderPage();

    expect(mockSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        include: expect.objectContaining({
          job: { select: { id: true, title: true } },
          evaluation: { select: { score: true } },
          _count: { select: { turns: true } },
        }),
        orderBy: { startedAt: 'desc' },
      }),
    );
  });

  it('sessions error sets sessionsError=true', async () => {
    mockSessionFindMany.mockRejectedValue(new Error('DB error'));

    await renderPage();

    const props = mockDashboardTabs.mock.calls[0][0] as Record<string, unknown>;
    expect(props.sessionsError).toBe(true);
  });

  it('both queries fail independently', async () => {
    mockJobFindMany.mockRejectedValue(new Error('jobs DB error'));
    mockSessionFindMany.mockRejectedValue(new Error('sessions DB error'));

    await renderPage();

    expect(screen.getByTestId('dashboard-tabs')).toBeInTheDocument();
    const props = mockDashboardTabs.mock.calls[0][0] as Record<string, unknown>;
    expect(props.jobsError).toBe(true);
    expect(props.sessionsError).toBe(true);
  });
});
