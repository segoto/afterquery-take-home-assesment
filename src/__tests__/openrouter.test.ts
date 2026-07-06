/**
 * Unit tests for src/lib/openrouter.ts
 *
 * Pattern (same as ai-client.test.ts):
 * - `jest.unstable_mockModule('openai', ...)` registers the factory at file load.
 * - `jest.resetModules()` + `await import('@/lib/openrouter')` in `beforeEach`
 *   re-runs the factory on each test, producing fresh `jest.fn()` instances for
 *   `mockCompletionsCreate` and `mockOpenAIConstructor`.
 * - Because `generateAdaptiveFollowUp` reads `process.env.OPENROUTER_API_KEY`
 *   inside the function body (not at module load), env-var manipulation controls
 *   the key-check branch without requiring additional module resets.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── Module-level mock references — updated by factory on each fresh import ────

let mockCompletionsCreate: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
let mockOpenAIConstructor: jest.MockedFunction<(...args: unknown[]) => unknown>;

// ── ESM-compatible module mock ────────────────────────────────────────────────

jest.unstable_mockModule('openai', () => {
  mockCompletionsCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  mockOpenAIConstructor = jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCompletionsCreate,
      },
    },
  }));
  return { default: mockOpenAIConstructor };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSuccessResponse(content: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'meta-llama/llama-3.1-8b-instruct',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  };
}

const sampleTranscript = [
  { speaker: 'AI', content: 'Tell me about yourself.' },
  { speaker: 'USER', content: 'I am a backend engineer with 5 years of experience.' },
  { speaker: 'AI', content: 'What is your biggest technical challenge?' },
  {
    speaker: 'USER',
    content: 'Debugging async race conditions in distributed systems.',
  },
];

// ── Test suite ────────────────────────────────────────────────────────────────

describe('generateAdaptiveFollowUp', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let generateAdaptiveFollowUp: (
    transcript: Array<{ speaker: string; content: string }>,
    followUpIndex: 1 | 2
  ) => Promise<string | null>;

  beforeEach(async () => {
    savedEnv = { ...process.env };
    // Reset module registry so the next import re-runs the factory,
    // producing fresh mock instances for mockCompletionsCreate and mockOpenAIConstructor.
    jest.resetModules();
    ({ generateAdaptiveFollowUp } = await import('@/lib/openrouter'));
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  // ── (a) Returns null when OPENROUTER_API_KEY is absent ────────────────────

  it('returns null without throwing when OPENROUTER_API_KEY is absent', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(result).toBeNull();
    // The OpenAI client should never be instantiated
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
  });

  // ── (a) Returns null when OPENROUTER_API_KEY is an empty string ───────────

  it('returns null without throwing when OPENROUTER_API_KEY is an empty string', async () => {
    process.env.OPENROUTER_API_KEY = '';

    const result = await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(result).toBeNull();
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
  });

  // ── (b) Calls chat.completions.create with stream: false and correct model ─

  it('calls chat.completions.create with stream: false and the default model', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    delete process.env.OPENROUTER_FOLLOWUP_MODEL;

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse('Can you elaborate?'));

    await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(mockCompletionsCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCompletionsCreate.mock.calls[0][0] as {
      model: string;
      stream: boolean;
      messages: unknown[];
    };
    expect(callArgs.model).toBe('meta-llama/llama-3.1-8b-instruct');
    expect(callArgs.stream).toBe(false);
    expect(Array.isArray(callArgs.messages)).toBe(true);
  });

  it('uses OPENROUTER_FOLLOWUP_MODEL when set', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    process.env.OPENROUTER_FOLLOWUP_MODEL = 'mistralai/mistral-7b-instruct';

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse('Tell me more.'));

    await generateAdaptiveFollowUp(sampleTranscript, 2);

    const callArgs = mockCompletionsCreate.mock.calls[0][0] as { model: string };
    expect(callArgs.model).toBe('mistralai/mistral-7b-instruct');
  });

  // ── (c) Returns trimmed content string on success ─────────────────────────

  it('returns the trimmed content string on a successful API call', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    const rawContent = '  Can you walk me through your debugging approach?  ';
    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse(rawContent));

    const result = await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(result).toBe('Can you walk me through your debugging approach?');
  });

  it('returns an empty string (trimmed) when the API returns empty content', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse(''));

    const result = await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(result).toBe('');
  });

  it('formats AI speaker as INTERVIEWER and USER speaker as CANDIDATE in the message', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse('Follow-up question here.'));

    await generateAdaptiveFollowUp(sampleTranscript, 1);

    const callArgs = mockCompletionsCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArgs.messages.find((m) => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage!.content).toContain('INTERVIEWER: Tell me about yourself.');
    expect(userMessage!.content).toContain(
      'CANDIDATE: I am a backend engineer with 5 years of experience.'
    );
    expect(userMessage!.content).not.toContain('AI:');
    expect(userMessage!.content).not.toContain('USER:');
  });

  // ── (d) Propagates SDK errors ─────────────────────────────────────────────

  it('propagates SDK errors — does not swallow thrown exceptions', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    const sdkError = new Error('OpenRouter rate limit exceeded');
    mockCompletionsCreate.mockRejectedValue(sdkError);

    await expect(generateAdaptiveFollowUp(sampleTranscript, 1)).rejects.toThrow(
      'OpenRouter rate limit exceeded'
    );
  });

  it('propagates network errors without swallowing them', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    const networkError = new Error('ECONNREFUSED');
    mockCompletionsCreate.mockRejectedValue(networkError);

    await expect(generateAdaptiveFollowUp(sampleTranscript, 2)).rejects.toThrow('ECONNREFUSED');
  });

  // ── Instantiates OpenAI with correct config when key is present ───────────

  it('instantiates OpenAI client with the correct baseURL and headers', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse('Good question.'));

    await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-test-key',
        defaultHeaders: expect.objectContaining({
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'AI Interviewer Platform',
        }),
      })
    );
  });

  it('falls back to localhost:3000 for HTTP-Referer when NEXT_PUBLIC_APP_URL is not set', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    delete process.env.NEXT_PUBLIC_APP_URL;

    mockCompletionsCreate.mockResolvedValue(makeSuccessResponse('Good question.'));

    await generateAdaptiveFollowUp(sampleTranscript, 1);

    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultHeaders: expect.objectContaining({
          'HTTP-Referer': 'http://localhost:3000',
        }),
      })
    );
  });
});
