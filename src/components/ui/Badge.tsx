'use client';

import React from 'react';

export interface BadgeProps {
  variant: 'ai' | 'user' | 'in-progress' | 'completed' | 'abandoned';
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

  if (variant === 'in-progress') {
    return (
      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
        {children}
      </span>
    );
  }

  if (variant === 'completed') {
    return (
      <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
        {children}
      </span>
    );
  }

  if (variant === 'abandoned') {
    return (
      <span className="inline-block bg-zinc-100 text-zinc-600 text-xs font-medium px-2 py-0.5 rounded-full">
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
