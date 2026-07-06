/**
 * Unit tests for src/lib/bank-selection.ts
 *
 * Uses jest.unstable_mockModule (ESM-compatible) to mock @/lib/ai-client.
 * buildBankSelectionPrompt and callModelForBankSelection are dynamically
 * imported after the mock is registered.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { BankQuestion } from '@/types';

// ── Mock functions ─────────────────────────────────────────────────────────────

const mockAiClientComplete = jest.fn<() => Promise<string>>();

// ── Register ESM-compatible module mock ───────────────────────────────────────

jest.unstable_mockModule('@/lib/ai-client', () => ({
  aiClient: {
    complete: mockAiClientComplete,
    streamCompletion: jest.fn(),
  },
}));

// ── Dynamically import the module under test after mock registration ───────────

const { buildBankSelectionPrompt, callModelForBankSelection } = await import(
  '@/lib/bank-selection'
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleBank: BankQuestion[] = [
  {
    id: 'sqb-swe-001',
    text: 'Describe your TypeScript experience.',
    type: 'TECHNICAL',
  },
  {
    id: 'sqb-swe-002',
    text: 'Tell me about a time you handled a production incident.',
    type: 'BEHAVIORAL',
  },
];

const validModelResponse = {
  selectedQuestionId: 'sqb-swe-001',
  question: 'Can you describe your TypeScript experience in detail?',
  isComplete: false,
  detectedSkills: ['TypeScript'],
  coveredTopics: [],
  remainingGaps: ['System Design'],
  questionRationale: "Starting with the candidate's core skill area.",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildBankSelectionPrompt', () => {
  // Test 1: Output contains jobTitle string
  it('includes the jobTitle in the output', () => {
    const prompt = buildBankSelectionPrompt(
      'Software Engineer',
      'A description of the role.',
      sampleBank,
      2,
    );
    expect(prompt).toContain('Software Engineer');
  });

  // Test 2: Output contains each question's id and text when remainingQuestions is non-empty
  it('includes each question id and text when remainingQuestions is non-empty', () => {
    const prompt = buildBankSelectionPrompt(
      'Software Engineer',
      'A description of the role.',
      sampleBank,
      2,
    );
    for (const question of sampleBank) {
      expect(prompt).toContain(question.id);
      expect(prompt).toContain(question.text);
    }
  });

  // Test 3: Output contains adaptive follow-up instruction markers
  it('contains "at least 2", "candidate" (case-insensitive), and "questionRationale"', () => {
    const prompt = buildBankSelectionPrompt(
      'Software Engineer',
      'A description of the role.',
      sampleBank,
      2,
    );
    expect(prompt).toContain('at least 2');
    expect(prompt.toLowerCase()).toContain('candidate');
    expect(prompt).toContain('questionRationale');
  });

  // Test 4: When remainingQuestions is empty, output contains bank-exhausted text
  it('contains "All bank questions have been covered" when remainingQuestions is empty', () => {
    const prompt = buildBankSelectionPrompt(
      'Software Engineer',
      'A description of the role.',
      [],
      7,
    );
    expect(prompt).toContain('All bank questions have been covered');
  });

  // Test 5: Does not throw when called with empty remainingQuestions
  it('does not throw when called with empty remainingQuestions', () => {
    expect(() =>
      buildBankSelectionPrompt('Software Engineer', 'A description of the role.', [], 0),
    ).not.toThrow();
  });
});

describe('callModelForBankSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 6: Parses valid JSON string into fully-typed BankSelectionResponse
  it('parses a valid JSON string from aiClient.complete into a BankSelectionResponse', async () => {
    mockAiClientComplete.mockResolvedValue(JSON.stringify(validModelResponse));

    const result = await callModelForBankSelection('system-prompt', [
      { role: 'user', content: 'Hello' },
    ]);

    expect(result).toEqual({
      selectedQuestionId: 'sqb-swe-001',
      question: 'Can you describe your TypeScript experience in detail?',
      isComplete: false,
      detectedSkills: ['TypeScript'],
      coveredTopics: [],
      remainingGaps: ['System Design'],
      questionRationale: "Starting with the candidate's core skill area.",
    });
  });

  // Test 7: Strips markdown fences and still parses correctly
  it('strips markdown fences and still parses correctly', async () => {
    const fencedResponse = '```json\n' + JSON.stringify(validModelResponse) + '\n```';
    mockAiClientComplete.mockResolvedValue(fencedResponse);

    const result = await callModelForBankSelection('system-prompt', [
      { role: 'user', content: 'Hello' },
    ]);

    expect(result.selectedQuestionId).toBe('sqb-swe-001');
    expect(result.question).toBe('Can you describe your TypeScript experience in detail?');
    expect(result.isComplete).toBe(false);
  });

  // Test 8: Applies safe defaults — missing detectedSkills defaults to []
  it('defaults detectedSkills to [] when it is missing from the response', async () => {
    const responseWithoutDetectedSkills = {
      selectedQuestionId: 'sqb-swe-001',
      question: 'Can you describe your TypeScript experience?',
      isComplete: false,
      coveredTopics: [],
      remainingGaps: ['System Design'],
      questionRationale: 'Starting with core skills.',
    };
    mockAiClientComplete.mockResolvedValue(JSON.stringify(responseWithoutDetectedSkills));

    const result = await callModelForBankSelection('system-prompt', []);

    expect(result.detectedSkills).toEqual([]);
  });

  // Test 9: Safe default for selectedQuestionId — empty string defaults to null
  it('defaults selectedQuestionId to null when the response has selectedQuestionId: ""', async () => {
    const responseWithEmptyId = {
      ...validModelResponse,
      selectedQuestionId: '',
    };
    mockAiClientComplete.mockResolvedValue(JSON.stringify(responseWithEmptyId));

    const result = await callModelForBankSelection('system-prompt', []);

    expect(result.selectedQuestionId).toBeNull();
  });

  // Test 10: Throws when response is not parseable JSON
  it('throws when the response is not parseable JSON', async () => {
    mockAiClientComplete.mockResolvedValue('not json');

    await expect(
      callModelForBankSelection('system-prompt', [{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow();
  });
});
