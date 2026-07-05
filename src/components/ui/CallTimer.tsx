'use client';

import { useState, useEffect } from 'react';

export interface CallTimerProps {
  startedAt: number | null; // epoch ms, null before session is active
}

export function CallTimer({ startedAt }: CallTimerProps) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (startedAt === null) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  const formatted = `${minutes}:${seconds}`;

  return (
    <time
      aria-label="Elapsed interview time"
      dateTime={formatted}
      className="text-zinc-400 text-sm font-mono"
    >
      {formatted}
    </time>
  );
}
