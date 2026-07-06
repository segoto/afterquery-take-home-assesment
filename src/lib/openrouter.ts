/**
 * OpenRouter client for generating adaptive follow-up questions.
 *
 * This file is server-only. It must NOT be imported from client components
 * and must NOT be barrel-exported through any client-facing index.
 *
 * Key design decisions:
 * - Lazy key check: OPENROUTER_API_KEY is read inside the function body,
 *   not at module load time. If absent, the function returns null without
 *   throwing, enabling graceful degradation.
 * - Lazy client construction: OpenAI is instantiated inside the function body
 *   after the key check. The server starts normally without the key.
 * - Error propagation: Network errors, rate-limit errors, and SDK 4xx/5xx
 *   errors are NOT caught here. They propagate to the route handler, which
 *   is responsible for catching them and degrading gracefully.
 */

import OpenAI from 'openai';

export async function generateAdaptiveFollowUp(
  transcript: Array<{ speaker: string; content: string }>,
  followUpIndex: 1 | 2
): Promise<string | null> {
  // Lazy key check — return null without throwing if the key is absent or empty
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  // Lazy client construction — instantiate inside the function body
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI Interviewer Platform',
    },
  });

  const model =
    process.env.OPENROUTER_FOLLOWUP_MODEL ?? 'meta-llama/llama-3.1-8b-instruct';

  // Format transcript: AI-speaker entries are labelled INTERVIEWER, all others CANDIDATE
  const formattedTranscript = transcript
    .map((turn) => {
      const label = turn.speaker === 'AI' ? 'INTERVIEWER' : 'CANDIDATE';
      return `${label}: ${turn.content}`;
    })
    .join('\n\n');

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content:
        `You are an expert technical interviewer reviewing a candidate interview transcript. ` +
        `Based on the transcript below, generate follow-up question number ${followUpIndex} ` +
        `that is concrete, adaptive, and grounded in the candidate's specific answers. ` +
        `Probe an area that deserves more depth based on what the candidate actually said. ` +
        `Return only the question as plain text — no JSON, no explanation, no preamble.\n\n` +
        `TRANSCRIPT:\n${formattedTranscript}`,
    },
  ];

  // Non-streaming call — do NOT wrap in try/catch; let errors propagate
  const response = await client.chat.completions.create({
    model,
    stream: false,
    messages,
  });

  const content = response.choices[0]?.message?.content ?? '';
  return content.trim();
}
