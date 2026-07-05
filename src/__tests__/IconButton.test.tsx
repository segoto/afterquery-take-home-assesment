/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from '@/components/ui/IconButton';

describe('IconButton', () => {
  it('sets aria-label to the label prop', () => {
    render(<IconButton icon={<span>icon</span>} label="Start recording" />);
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('applies bg-zinc-700 class for variant="mic"', () => {
    render(<IconButton icon={<span>icon</span>} label="Mic" variant="mic" />);
    const button = screen.getByRole('button', { name: 'Mic' });
    expect(button.className).toContain('bg-zinc-700');
  });

  it('applies bg-red-600 class for variant="stop"', () => {
    render(<IconButton icon={<span>icon</span>} label="Stop" variant="stop" />);
    const button = screen.getByRole('button', { name: 'Stop' });
    expect(button.className).toContain('bg-red-600');
  });

  it('has disabled attribute and opacity-50 class when disabled={true}', () => {
    render(<IconButton icon={<span>icon</span>} label="Disabled button" disabled />);
    const button = screen.getByRole('button', { name: 'Disabled button' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('opacity-50');
  });

  it('calls onClick when clicked and not disabled', () => {
    const handleClick = jest.fn();
    render(<IconButton icon={<span>icon</span>} label="Clickable" onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clickable' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled={true}', () => {
    const handleClick = jest.fn();
    render(
      <IconButton icon={<span>icon</span>} label="Disabled clickable" disabled onClick={handleClick} />
    );
    const button = screen.getByRole('button', { name: 'Disabled clickable' });
    // The native disabled attribute blocks synthetic clicks
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies bg-zinc-700 class for variant="default" (default value)', () => {
    render(<IconButton icon={<span>icon</span>} label="Default" />);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button.className).toContain('bg-zinc-700');
  });

  it('does not apply opacity-50 when not disabled', () => {
    render(<IconButton icon={<span>icon</span>} label="Enabled" />);
    const button = screen.getByRole('button', { name: 'Enabled' });
    expect(button).not.toBeDisabled();
    expect(button.className).not.toContain('opacity-50');
  });
});
