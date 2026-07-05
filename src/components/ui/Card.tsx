'use client';

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
