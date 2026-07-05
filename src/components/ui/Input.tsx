'use client';

import React from 'react';

export interface InputProps {
  id: string;
  name: string;
  type?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
}

export function Input({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  error,
  disabled = false,
  autoComplete,
  placeholder,
}: InputProps) {
  const inputBase =
    'block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500';
  const borderClass = error
    ? 'border-red-500 focus:border-red-500'
    : 'border-zinc-300 focus:border-zinc-500';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${borderClass}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
