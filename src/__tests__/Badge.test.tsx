/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders children for ai variant', () => {
    render(<Badge variant="ai">AI Interviewer</Badge>);
    expect(screen.getByText('AI Interviewer')).toBeInTheDocument();
  });

  it('renders children for user variant', () => {
    render(<Badge variant="user">You</Badge>);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('ai variant has bg-zinc-800 class', () => {
    const { container } = render(<Badge variant="ai">AI Interviewer</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-zinc-800');
  });

  it('user variant has bg-blue-100 class', () => {
    const { container } = render(<Badge variant="user">You</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-blue-100');
  });

  it('user variant has text-blue-800 class', () => {
    const { container } = render(<Badge variant="user">You</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-blue-800');
  });
});
