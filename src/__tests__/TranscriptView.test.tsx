/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { TranscriptView } from '@/components/TranscriptView';
import { TranscriptTurn } from '@/types';

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {};
});

const aiTurn: TranscriptTurn = {
  id: 'turn-1',
  speaker: 'AI',
  content: 'Tell me about yourself.',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

const userTurn: TranscriptTurn = {
  id: 'turn-2',
  speaker: 'USER',
  content: 'I have 5 years of experience in software engineering.',
  createdAt: new Date('2024-01-01T00:00:01Z'),
};

describe('TranscriptView', () => {
  it('renders empty state message when turns is empty array', () => {
    render(<TranscriptView turns={[]} />);
    expect(screen.getByText('The interview will appear here.')).toBeInTheDocument();
  });

  it('renders correct number of turn items for a populated turns array', () => {
    render(<TranscriptView turns={[aiTurn, userTurn]} />);
    expect(screen.getByText('Tell me about yourself.')).toBeInTheDocument();
    expect(screen.getByText('I have 5 years of experience in software engineering.')).toBeInTheDocument();
  });

  it('AI turn renders "AI Interviewer" label with dark badge class', () => {
    render(<TranscriptView turns={[aiTurn]} />);
    const badge = screen.getByText('AI Interviewer');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-zinc-800');
  });

  it('User turn renders "You" label with blue badge class', () => {
    render(<TranscriptView turns={[userTurn]} />);
    const badge = screen.getByText('You');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-blue-100');
  });

  it('renders turn content text', () => {
    render(<TranscriptView turns={[aiTurn, userTurn]} />);
    expect(screen.getByText('Tell me about yourself.')).toBeInTheDocument();
    expect(
      screen.getByText('I have 5 years of experience in software engineering.')
    ).toBeInTheDocument();
  });

  it('when variant="dark", turn content <p> has class text-zinc-200', () => {
    render(<TranscriptView turns={[aiTurn]} variant="dark" />);
    const contentParagraph = screen.getByText('Tell me about yourself.');
    expect(contentParagraph.className).toContain('text-zinc-200');
    expect(contentParagraph.className).not.toContain('text-zinc-900');
  });

  it('when variant="light" (or omitted), turn content <p> has class text-zinc-900', () => {
    render(<TranscriptView turns={[aiTurn]} variant="light" />);
    const contentParagraph = screen.getByText('Tell me about yourself.');
    expect(contentParagraph.className).toContain('text-zinc-900');
    expect(contentParagraph.className).not.toContain('text-zinc-200');
  });
});
