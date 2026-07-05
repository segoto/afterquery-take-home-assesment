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
});
