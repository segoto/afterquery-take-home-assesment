/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { DecisionPanel } from '@/components/DecisionPanel';

const sampleDecisionState = {
  detectedSkills: ['TypeScript', 'React'],
  coveredTopics: ['Background'],
  remainingGaps: ['System Design'],
  questionRationale: 'Probing system design.',
};

describe('DecisionPanel', () => {
  it('loading state renders role="status" element and heading "AI Decision Panel"', () => {
    render(<DecisionPanel decisionState={null} isLoading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('AI Decision Panel')).toBeInTheDocument();
  });

  it('empty state renders empty message and heading', () => {
    render(<DecisionPanel decisionState={null} isLoading={false} />);
    expect(
      screen.getByText("Complete your first answer to see the AI's reasoning.")
    ).toBeInTheDocument();
    expect(screen.getByText('AI Decision Panel')).toBeInTheDocument();
  });

  it('populated state renders all four sections with correct data', () => {
    render(<DecisionPanel decisionState={sampleDecisionState} isLoading={false} />);

    // Heading
    expect(screen.getByText('AI Decision Panel')).toBeInTheDocument();

    // Section 1 — Detected Skills
    expect(screen.getByText('Detected Skills')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    // Section 2 — Topics Covered
    expect(screen.getByText('Topics Covered')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();

    // Section 3 — Remaining Gaps
    expect(screen.getByText('Remaining Gaps')).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();

    // Section 4 — Why this question?
    expect(screen.getByText('Why this question?')).toBeInTheDocument();
    expect(screen.getByText('Probing system design.')).toBeInTheDocument();
  });

  it('empty detectedSkills array renders "None yet" and no Badge elements for skills', () => {
    render(
      <DecisionPanel
        decisionState={{ ...sampleDecisionState, detectedSkills: [] }}
        isLoading={false}
      />
    );

    expect(screen.getByText('None yet')).toBeInTheDocument();
    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('empty coveredTopics array renders "None yet" in that section', () => {
    render(
      <DecisionPanel
        decisionState={{ ...sampleDecisionState, coveredTopics: [] }}
        isLoading={false}
      />
    );

    expect(screen.getByText('Topics Covered')).toBeInTheDocument();
    expect(screen.getByText('None yet')).toBeInTheDocument();
    expect(screen.queryByText('Background')).not.toBeInTheDocument();
  });

  it('empty remainingGaps array renders "All gaps covered"', () => {
    render(
      <DecisionPanel
        decisionState={{ ...sampleDecisionState, remainingGaps: [] }}
        isLoading={false}
      />
    );

    expect(screen.getByText('All gaps covered')).toBeInTheDocument();
    expect(screen.queryByText('System Design')).not.toBeInTheDocument();
  });
});
