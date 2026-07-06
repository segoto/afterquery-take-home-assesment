'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { DecisionState } from '@/types';

interface DecisionPanelProps {
  decisionState: DecisionState | null;
  isLoading: boolean;
}

export function DecisionPanel({ decisionState, isLoading }: DecisionPanelProps) {
  if (isLoading) {
    return (
      <section aria-label="AI decision panel">
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">AI Decision Panel</h2>
          <div className="flex justify-center mt-4">
            <Spinner aria-label="AI is thinking" />
          </div>
        </Card>
      </section>
    );
  }

  if (decisionState === null) {
    return (
      <section aria-label="AI decision panel">
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">AI Decision Panel</h2>
          <p className="text-zinc-400 text-sm">Complete your first answer to see the AI&apos;s reasoning.</p>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="AI decision panel">
      <Card>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">AI Decision Panel</h2>

        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Detected Skills
          </h3>
          {decisionState.detectedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {decisionState.detectedSkills.map((skill) => (
                <Badge key={skill} variant="ai">
                  {skill}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-zinc-400 text-sm">None yet</span>
          )}
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Topics Covered
          </h3>
          {decisionState.coveredTopics.length > 0 ? (
            <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
              {decisionState.coveredTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          ) : (
            <span className="text-zinc-400 text-sm">None yet</span>
          )}
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Remaining Gaps
          </h3>
          {decisionState.remainingGaps.length > 0 ? (
            <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
              {decisionState.remainingGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-green-600">All gaps covered</span>
          )}
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Why this question?
          </h3>
          {decisionState.questionRationale !== '' ? (
            <p className="text-sm text-zinc-700">{decisionState.questionRationale}</p>
          ) : (
            <span className="text-zinc-400 text-sm">No rationale provided</span>
          )}
        </div>
      </Card>
    </section>
  );
}
