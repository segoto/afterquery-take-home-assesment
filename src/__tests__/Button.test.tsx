/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders a spinner when loading=true', () => {
    render(<Button loading>Submitting</Button>);
    const button = screen.getByRole('button');
    // Spinner SVG should be present (aria-hidden)
    const spinner = button.querySelector('svg[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies opacity-50 and cursor-not-allowed when disabled (not loading)', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toContain('opacity-50');
    expect(button.className).toContain('cursor-not-allowed');
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-zinc-900');
    expect(button.className).toContain('text-white');
  });

  it('applies secondary variant classes when variant="secondary"', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border');
    expect(button.className).toContain('text-zinc-900');
  });

  it('sets type="submit" when specified', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('merges custom className prop', () => {
    render(<Button className="extra-class">Custom</Button>);
    expect(screen.getByRole('button').className).toContain('extra-class');
  });

  describe('when href is provided', () => {
    it('renders an <a> element instead of a <button>', () => {
      render(<Button href="/foo">Go</Button>);
      expect(screen.getByRole('link', { name: 'Go' })).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('the rendered <a> has the correct href', () => {
      render(<Button href="/foo">Go</Button>);
      expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/foo');
    });

    it('the rendered <a> has primary variant classes by default', () => {
      render(<Button href="/foo">Go</Button>);
      const link = screen.getByRole('link', { name: 'Go' });
      expect(link.className).toContain('bg-zinc-900');
      expect(link.className).toContain('text-white');
    });

    it('the rendered <a> has secondary variant classes when variant="secondary"', () => {
      render(<Button href="/foo" variant="secondary">Go</Button>);
      const link = screen.getByRole('link', { name: 'Go' });
      expect(link.className).toContain('border');
      expect(link.className).toContain('text-zinc-900');
    });

    it('the rendered <a> includes a custom className when provided', () => {
      render(<Button href="/foo" className="my-custom-class">Go</Button>);
      expect(screen.getByRole('link', { name: 'Go' }).className).toContain('my-custom-class');
    });
  });
});
