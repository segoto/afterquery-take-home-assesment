'use client';

import React from 'react';

export interface BadgeProps {
  variant: 'ai' | 'user';
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  if (variant === 'ai') {
    return (
      <span className="inline-block bg-zinc-800 text-white text-xs font-medium px-2 py-0.5 rounded-full">
        {children}
      </span>
    );
  }

  return (
    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}
