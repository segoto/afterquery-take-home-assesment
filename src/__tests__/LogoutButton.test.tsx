/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';

const mockPush = jest.fn();

jest.unstable_mockModule('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
const { LogoutButton } = await import('@/components/LogoutButton');

describe('LogoutButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a button with text "Log out"', () => {
    render(React.createElement(LogoutButton));
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('calls fetch("/api/auth/logout", { method: "POST" }) when clicked', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(React.createElement(LogoutButton));
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    });
  });

  it('calls router.push("/login") after fetch resolves', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(React.createElement(LogoutButton));
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('disables the button while fetch is in flight', async () => {
    let resolveResponse!: (value: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(responsePromise);

    render(React.createElement(LogoutButton));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log out/i })).toBeDisabled();
    });

    // Resolve so the component can clean up
    act(() => {
      resolveResponse({
        ok: true,
        json: async () => ({}),
      } as Response);
    });
  });

  it('calls console.error and still navigates to /login when fetch rejects', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network error'),
    );

    render(React.createElement(LogoutButton));
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
