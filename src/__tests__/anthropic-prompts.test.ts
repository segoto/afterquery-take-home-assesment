/**
 * Unit tests for src/lib/anthropic.ts prompt-builder functions.
 *
 * Both builder functions are pure — no mocks required beyond suppressing the
 * Anthropic SDK singleton initialization (which would otherwise trigger async
 * credential loading and pollute Jest teardown).
 */

import { jest, describe, it, expect } from '@jest/globals';

// ── Suppress AI client and Anthropic SDK initialization ──────────────────────
// @/lib/anthropic imports @/lib/ai-client which validates API keys at load time.
// Mock @/lib/ai-client to prevent that validation from running in tests.
// Also mock @anthropic-ai/sdk for belt-and-suspenders safety.

jest.unstable_mockModule('@/lib/ai-client', () => ({
  aiClient: {
    complete: jest.fn(),
  },
}));

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  })),
}));

// Dynamic import after mocks are registered
const {
  buildInterviewSystemPrompt,
  buildEvaluationPrompt,
  INTERVIEW_COMPLETE_SENTINEL,
} = await import('@/lib/anthropic');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleTitle = 'Senior Backend Engineer';
const sampleDescription =
  'We are looking for a Senior Backend Engineer with strong Node.js and PostgreSQL experience to build scalable APIs for our platform. You will collaborate closely with product and frontend teams.';
const sampleSkills = [
  { name: 'Node.js', weight: 3 },
  { name: 'PostgreSQL', weight: 2 },
];

// ── buildInterviewSystemPrompt ────────────────────────────────────────────────

describe('buildInterviewSystemPrompt', () => {
  it('returns a string', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(typeof result).toBe('string');
  });

  it('includes the job title', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain(sampleTitle);
  });

  it('includes the job description verbatim', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain(sampleDescription);
  });

  it('includes each skill name with its priority weight', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('Node.js (priority: 3)');
    expect(result).toContain('PostgreSQL (priority: 2)');
  });

  it('contains the "at least 6 questions" rule', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('at least 6 questions');
  });

  it('contains the "at least 2 adaptive follow-up" rule', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('at least 2 adaptive follow-up');
  });

  it('instructs to ask only one question at a time', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result.toLowerCase()).toContain('one question at a time');
  });

  it('instructs Claude to respond with JSON only (no prose, no markdown fences)', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('valid JSON');
    expect(result.toLowerCase()).toContain('no prose');
    expect(result.toLowerCase()).toContain('no markdown');
  });

  it('instructs Claude to set isComplete: true only after all skills covered and at least 6 questions', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('isComplete: true');
    expect(result).toContain('at least 6 questions');
  });

  it('includes decisionState field names in the response format', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    expect(result).toContain('detectedSkills');
    expect(result).toContain('coveredTopics');
    expect(result).toContain('remainingGaps');
    expect(result).toContain('questionRationale');
  });

  it('produces different prompts for different job titles and descriptions', () => {
    const prompt1 = buildInterviewSystemPrompt(sampleTitle, sampleDescription, sampleSkills);
    const prompt2 = buildInterviewSystemPrompt(
      'Product Designer',
      'Seeking an experienced Product Designer to lead our UX efforts.',
      [{ name: 'Figma', weight: 3 }]
    );
    expect(prompt1).not.toBe(prompt2);
    expect(prompt2).toContain('Product Designer');
    expect(prompt2).toContain('Figma (priority: 3)');
  });

  it('falls back to deriving skills from job description when skills array is empty', () => {
    const result = buildInterviewSystemPrompt(sampleTitle, sampleDescription, []);
    expect(result).toContain('derive');
  });
});

// ── buildEvaluationPrompt ─────────────────────────────────────────────────────

describe('buildEvaluationPrompt', () => {
  const turns = [
    { speaker: 'AI', content: 'Tell me about your background.' },
    { speaker: 'USER', content: 'I have 5 years of experience in backend development.' },
    { speaker: 'AI', content: 'Can you describe a challenging project you worked on?' },
    { speaker: 'USER', content: 'I led the migration of our monolith to microservices.' },
  ];

  it('returns a string', () => {
    const result = buildEvaluationPrompt(turns);
    expect(typeof result).toBe('string');
  });

  it('labels AI turns as INTERVIEWER', () => {
    const result = buildEvaluationPrompt(turns);
    expect(result).toContain('INTERVIEWER: Tell me about your background.');
    expect(result).toContain('INTERVIEWER: Can you describe a challenging project you worked on?');
  });

  it('labels USER turns as CANDIDATE', () => {
    const result = buildEvaluationPrompt(turns);
    expect(result).toContain('CANDIDATE: I have 5 years of experience in backend development.');
    expect(result).toContain('CANDIDATE: I led the migration of our monolith to microservices.');
  });

  it('does not use AI or USER labels in the transcript', () => {
    const result = buildEvaluationPrompt(turns);
    // The raw speaker values should not appear in the labelled transcript lines
    expect(result).not.toMatch(/^AI:/m);
    expect(result).not.toMatch(/^USER:/m);
  });

  it('includes the JSON instruction mentioning strengths, concerns, and overall_score', () => {
    const result = buildEvaluationPrompt(turns);
    expect(result).toContain('strengths');
    expect(result).toContain('concerns');
    expect(result).toContain('overall_score');
  });

  it('instructs the AI to respond with ONLY valid JSON', () => {
    const result = buildEvaluationPrompt(turns);
    expect(result).toContain('ONLY valid JSON');
  });

  it('instructs the AI not to use markdown code fences', () => {
    const result = buildEvaluationPrompt(turns);
    expect(result).toContain('no markdown code fences');
  });

  it('handles an empty turns array gracefully', () => {
    const result = buildEvaluationPrompt([]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes all turn content from the transcript', () => {
    const result = buildEvaluationPrompt(turns);
    for (const turn of turns) {
      expect(result).toContain(turn.content);
    }
  });
});

// ── INTERVIEW_COMPLETE_SENTINEL constant ──────────────────────────────────────

describe('INTERVIEW_COMPLETE_SENTINEL', () => {
  it('equals the literal string [INTERVIEW_COMPLETE]', () => {
    expect(INTERVIEW_COMPLETE_SENTINEL).toBe('[INTERVIEW_COMPLETE]');
  });
});
