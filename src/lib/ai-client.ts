/**
 * Provider-agnostic AI client singleton.
 *
 * Reads `AI_PROVIDER` at module load time and initialises either the
 * Anthropic or OpenRouter client. Throws synchronously on misconfiguration
 * so that Next.js fails to start rather than producing silent runtime errors.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiClientMessages = Array<{ role: 'user' | 'assistant'; content: string }>;

interface AiClientParams {
  systemPrompt: string;
  messages: AiClientMessages;
}

// ── Provider validation ───────────────────────────────────────────────────────

const rawProvider = process.env.AI_PROVIDER ?? 'anthropic';

if (rawProvider !== 'anthropic' && rawProvider !== 'openrouter') {
  throw new Error(
    `Unsupported AI_PROVIDER: ${rawProvider}. Must be "anthropic" or "openrouter"`
  );
}

const provider: 'anthropic' | 'openrouter' = rawProvider;

// ── Client initialisation ─────────────────────────────────────────────────────

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;
let openrouterModel = 'anthropic/claude-sonnet-4-6';

if (provider === 'anthropic') {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
  }
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter');
  }
  openrouterModel = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-6';
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI Interviewer Platform',
    },
  });
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const aiClient = {
  /**
   * Streams the AI response as a `ReadableStream<Uint8Array>`.
   * Chunks are UTF-8 encoded text tokens as they arrive from the provider.
   */
  async streamCompletion({ systemPrompt, messages }: AiClientParams): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();

    if (provider === 'anthropic') {
      const stream = anthropic!.messages.stream({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      });

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    } else {
      // OpenRouter provider
      const stream = await openai!.chat.completions.create({
        model: openrouterModel,
        stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? '';
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    }
  },

  /**
   * Returns the full AI response as a plain string (non-streaming).
   * Suited for evaluation and any other non-latency-critical calls.
   */
  async complete({ systemPrompt, messages }: AiClientParams): Promise<string> {
    if (provider === 'anthropic') {
      const response = await anthropic!.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        stream: false,
        system: systemPrompt,
        messages,
      });
      return (response.content[0] as { text: string }).text;
    } else {
      // OpenRouter provider
      const response = await openai!.chat.completions.create({
        model: openrouterModel,
        stream: false,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });
      return response.choices[0].message.content ?? '';
    }
  },
};
