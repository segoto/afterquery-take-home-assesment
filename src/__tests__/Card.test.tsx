/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello world</Card>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('applies base card classes', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('border-zinc-200');
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('shadow-sm');
  });

  it('merges custom className prop', () => {
    const { container } = render(<Card className="my-custom-class">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-custom-class');
  });

  it('renders complex children', () => {
    render(
      <Card>
        <h1>Title</h1>
        <p>Paragraph</p>
      </Card>
    );
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
  });
});
