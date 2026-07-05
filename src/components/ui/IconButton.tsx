'use client';

import React from 'react';

export interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  variant?: 'mic' | 'stop' | 'default';
  disabled?: boolean;
  onClick?: () => void;
}

export function IconButton({
  icon,
  label,
  variant = 'default',
  disabled = false,
  onClick,
}: IconButtonProps) {
  const base =
    'flex items-center justify-center rounded-full w-14 h-14 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950';

  const variantClass =
    variant === 'stop'
      ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500 text-white'
      : 'bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-500 text-white';

  const disabledClass = 'opacity-50 cursor-not-allowed pointer-events-none';

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[base, variantClass, disabled ? disabledClass : ''].filter(Boolean).join(' ')}
    >
      {icon}
    </button>
  );
}
