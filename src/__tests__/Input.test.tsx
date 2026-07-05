/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  const baseProps = {
    id: 'email',
    name: 'email',
    label: 'Email',
    value: '',
    onChange: jest.fn(),
  };

  it('renders a label associated with the input', () => {
    render(<Input {...baseProps} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the label text', () => {
    render(<Input {...baseProps} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('does not render an error paragraph when error is absent', () => {
    render(<Input {...baseProps} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders error paragraph with role="alert" when error is provided', () => {
    render(<Input {...baseProps} error="This field is required" />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toBe('This field is required');
  });

  it('adds border-red-500 to input when error is provided', () => {
    render(<Input {...baseProps} error="Invalid" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-red-500');
  });

  it('sets aria-invalid when error is provided', () => {
    render(<Input {...baseProps} error="Invalid" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-describedby pointing to error element', () => {
    render(<Input {...baseProps} error="Invalid" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(document.getElementById('email-error')).toBeInTheDocument();
  });

  it('is disabled when disabled=true', () => {
    render(<Input {...baseProps} disabled />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('renders with type="password"', () => {
    render(<Input {...baseProps} type="password" label="Password" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
