'use client';

import React, { useRef, useEffect } from 'react';
import { TranscriptTurn } from '@/types';
import { Badge } from '@/components/ui';

interface TranscriptViewProps {
  turns: TranscriptTurn[];
}

export function TranscriptView({ turns }: TranscriptViewProps) {
  const lastTurnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lastTurnRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  return (
    <div className="overflow-y-auto max-h-96 flex flex-col gap-4">
      {turns.length === 0 ? (
        <p className="text-zinc-400 text-sm">The interview will appear here.</p>
      ) : (
        turns.map((turn, i) => (
          <div
            key={turn.id}
            ref={i === turns.length - 1 ? lastTurnRef : undefined}
            className="flex flex-col gap-1"
          >
            <Badge variant={turn.speaker === 'AI' ? 'ai' : 'user'}>
              {turn.speaker === 'AI' ? 'AI Interviewer' : 'You'}
            </Badge>
            <p className="text-zinc-900 text-sm">{turn.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
