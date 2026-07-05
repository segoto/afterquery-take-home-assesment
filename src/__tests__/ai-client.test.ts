/**
 * Unit tests for src/lib/ai-client.ts
 *
 * Because ai-client.ts reads process.env.AI_PROVIDER at module load time,
 * each test that requires a different provider must:
 *   1. Set environment variables
 *   2. Call jest.resetModules() to clear the module cache
 *   3. Dynamically import '@/lib/ai-client' to get a fresh module instance
 *
 * jest.unstable_mockModule is used for ESM-compatible mocking of the SDK packages.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── Module-level references updated by each factory invocation ────────────────

// These are updated every time the mock factory is called (i.e., every fresh
// dynamic import that goes through the module system after jest.resetModules()).
// Typed as functions returning Promise<unknown> so that mockResolvedValue accepts any value.
let mockAnthropicMessagesStream: jest.MockedFunction<(...args: unknown[]) => unknown>;
let mockAnthropicMessagesCreate: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
let mockAnthropicConstructor: jest.MockedFunction<(...args: unknown[]) => unknown>;

let mockOpenAICompletionsCreate: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
let mockOpenAIConstructor: jest.MockedFunction<(...args: unknown[]) => unknown>;

// ── ESM-compatible module mocks ───────────────────────────────────────────────

jest.unstable_mockModule('@anthropic-ai/sdk', () => {
  mockAnthropicMessagesStream = jest.fn<(...args: unknown[]) => unknown>();
  mockAnthropicMessagesCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  mockAnthropicConstructor = jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    messages: {
      stream: mockAnthropicMessagesStream,
      create: mockAnthropicMessagesCreate,
    },
  }));
  return { default: mockAnthropicConstructor };
});

jest.unstable_mockModule('openai', () => {
  mockOpenAICompletionsCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  mockOpenAIConstructor = jest.fn<(...args: unknown[]) => unknown>().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICompletionsCreate,
      },
    },
  }));
  return { default: mockOpenAIConstructor };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates an async generator that yields Anthropic-style content_block_delta
 * events, then a message_stop event.
 */
async function* makeAnthropicEventStream(text: string) {
  yield {
    type: 'content_block_delta' as const,
    index: 0,
    delta: { type: 'text_delta' as const, text },
  };
  yield { type: 'message_stop' as const };
}

/**
 * Creates an async generator that yields OpenAI-style chat completion chunks.
 */
async function* makeOpenAIChunkStream(text: string) {
  yield {
    choices: [{ delta: { content: text }, index: 0, finish_reason: null }],
    id: 'chatcmpl-test',
    model: 'anthropic/claude-sonnet-4-6',
    object: 'chat.completion.chunk' as const,
    created: 0,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ai-client', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Snapshot the current env so we can restore it after each test
    savedEnv = { ...process.env };
    // Clear cached modules so the next dynamic import re-executes ai-client.ts
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = savedEnv;
  });

  // ── 1. Anthropic provider — successful initialisation ─────────────────────

  it('initialises without error when AI_PROVIDER=anthropic and ANTHROPIC_API_KEY is set', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    await expect(import('@/lib/ai-client')).resolves.toBeDefined();
  });

  // ── 2. Anthropic provider — missing key ───────────────────────────────────

  it('throws ANTHROPIC_API_KEY error when AI_PROVIDER=anthropic and key is absent', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    delete process.env.ANTHROPIC_API_KEY;

    await expect(import('@/lib/ai-client')).rejects.toThrow(
      'ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic'
    );
  });

  // ── 3. OpenRouter provider — successful initialisation ────────────────────

  it('initialises without error when AI_PROVIDER=openrouter and OPENROUTER_API_KEY is set', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    await expect(import('@/lib/ai-client')).resolves.toBeDefined();
  });

  // ── 4. OpenRouter provider — missing key ──────────────────────────────────

  it('throws OPENROUTER_API_KEY error when AI_PROVIDER=openrouter and key is absent', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    delete process.env.OPENROUTER_API_KEY;

    await expect(import('@/lib/ai-client')).rejects.toThrow(
      'OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter'
    );
  });

  // ── 5. Unsupported provider ───────────────────────────────────────────────

  it('throws Unsupported AI_PROVIDER error when AI_PROVIDER=gemini', async () => {
    process.env.AI_PROVIDER = 'gemini';

    await expect(import('@/lib/ai-client')).rejects.toThrow(
      'Unsupported AI_PROVIDER: gemini. Must be "anthropic" or "openrouter"'
    );
  });

  // ── 6. streamCompletion returns a ReadableStream ──────────────────────────

  it('streamCompletion returns a ReadableStream instance', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    // Import fresh module (mocks will be reassigned by the factory)
    const { aiClient } = await import('@/lib/ai-client');

    // Configure the mock to return an async iterable
    mockAnthropicMessagesStream.mockReturnValue(makeAnthropicEventStream('Hello world'));

    const result = await aiClient.streamCompletion({
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });

    // Verify it is a ReadableStream (duck-type check for environments where
    // the constructor may not be globally available under that exact name)
    expect(result).toBeDefined();
    expect(typeof result.getReader).toBe('function');
  });

  // ── 7. complete returns a string ──────────────────────────────────────────

  it('complete returns a string', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    const { aiClient } = await import('@/lib/ai-client');

    // Configure the mock to return an Anthropic-style Message object
    mockAnthropicMessagesCreate.mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'I am doing well, thank you!' }],
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 8 },
    });

    const result = await aiClient.complete({
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'How are you?' }],
    });

    expect(typeof result).toBe('string');
    expect(result).toBe('I am doing well, thank you!');
  });

  // ── Extra: streamCompletion with OpenRouter returns a ReadableStream ───────

  it('streamCompletion returns a ReadableStream when using OpenRouter provider', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    const { aiClient } = await import('@/lib/ai-client');

    // OpenRouter: create() with stream:true should return an async iterable
    mockOpenAICompletionsCreate.mockResolvedValue(makeOpenAIChunkStream('Hi there'));

    const result = await aiClient.streamCompletion({
      systemPrompt: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hello.' }],
    });

    expect(result).toBeDefined();
    expect(typeof result.getReader).toBe('function');
  });

  // ── Extra: complete with OpenRouter returns a string ──────────────────────

  it('complete returns a string when using OpenRouter provider', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    const { aiClient } = await import('@/lib/ai-client');

    mockOpenAICompletionsCreate.mockResolvedValue({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'anthropic/claude-sonnet-4-6',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Great to meet you!' },
          finish_reason: 'stop',
        },
      ],
    });

    const result = await aiClient.complete({
      systemPrompt: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hello.' }],
    });

    expect(typeof result).toBe('string');
    expect(result).toBe('Great to meet you!');
  });
});
