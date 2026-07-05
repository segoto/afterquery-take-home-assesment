'use client';

import React from 'react';

export interface VideoTileProps {
  name: string;
  isActive?: boolean;
  children: React.ReactNode;
}

export function VideoTile({ name, isActive = false, children }: VideoTileProps) {
  return (
    <div className="relative bg-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
      {children}

      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            aria-label="AI is speaking"
            role="status"
            className="animate-ping inline-flex h-24 w-24 rounded-full border-4 border-white opacity-30"
          />
        </div>
      )}

      <span className="absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 rounded px-2 py-0.5">
        {name}
      </span>
    </div>
  );
}
