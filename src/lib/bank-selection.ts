import type { BankQuestion } from '@/lib/question-bank';
import type { BankSelectionResponse } from '@/types';
import { aiClient } from '@/lib/ai-client';

/**
 * Builds the system prompt used for bank-based question selection.
 *
 * @param jobTitle - The title of the job being interviewed for
 * @param jobDescription - Full job description (included verbatim in the prompt)
 * @param remainingQuestions - Bank questions not yet asked in this session
 * @param aiTurnCount - Number of AI turns already saved (used so the model knows how many questions have been asked)
 * @returns A system prompt string that instructs the model to select and return a bank question as JSON
 */
export function buildBankSelectionPrompt(
  jobTitle: string,
  jobDescription: string,
  remainingQuestions: BankQuestion[],
  aiTurnCount: number,
): string {
  // Section 1 — Role establishment
  const roleSection = `You are an expert AI interviewer conducting a structured job interview for **${jobTitle}**.`;

  // Section 2 — Job description
  const jobDescSection = `## Job Description\n\n${jobDescription}`;

  // Section 3 — Available questions
  let questionsSection: string;
  if (remainingQuestions.length > 0) {
    const questionLines = remainingQuestions
      .map((q) => `[id: ${q.id}] (${q.type} | ${q.skill}) ${q.text}`)
      .join('\n');
    questionsSection = `## Available Questions\n\nThe following questions are available for you to select from:\n\n${questionLines}`;
  } else {
    questionsSection =
      `## Available Questions\n\nAll bank questions have been covered. Close the interview gracefully.`;
  }

  // Section 4 — Selection rules
  const selectionRules = `## Selection Rules

1. Select the most contextually appropriate question from the available list above based on the conversation history. Optionally rephrase the selected question slightly for natural conversational flow.
2. Set \`selectedQuestionId\` to the matching \`id\` from the available questions list.
3. Across the full session, at least 2 questions must be selected explicitly because of something the candidate said in a prior answer. For each such selection, \`questionRationale\` must quote or paraphrase the specific candidate statement that motivated the choice.
4. Set \`isComplete: true\` only when ALL of the following conditions are met:
   - At least 6 total questions have been asked. You can verify this by counting assistant turns in the conversation history. \`aiTurnCount\` is ${aiTurnCount} as additional context.
   - Adequate coverage of key role competencies is achieved.
   OR when all bank questions have been covered (the available questions list is empty).
5. When \`isComplete: true\`, set \`selectedQuestionId\` to \`null\` and set \`question\` to a polite closing statement thanking the candidate.`;

  // Section 5 — Tracking fields instruction
  const trackingSection = `## Tracking Fields

Always populate the following fields in every response:
- \`detectedSkills\`: Skills you have detected in the candidate's answers so far (array of strings).
- \`coveredTopics\`: Topics that have already been addressed in the interview (array of strings).
- \`remainingGaps\`: Competencies or topics that have not yet been assessed (array of strings).
- \`questionRationale\`: A clear explanation of why you chose this question. If this question was selected because of something specific the candidate said, quote or paraphrase that statement here.`;

  // Section 6 — JSON-only response instruction
  const jsonInstruction = `## Response Format

Respond ONLY with valid JSON — no prose, no markdown fences. Your response must match this exact shape:

{
  "selectedQuestionId": "string or null",
  "question": "string",
  "isComplete": false,
  "detectedSkills": ["string"],
  "coveredTopics": ["string"],
  "remainingGaps": ["string"],
  "questionRationale": "string"
}`;

  return [roleSection, jobDescSection, questionsSection, selectionRules, trackingSection, jsonInstruction].join('\n\n');
}

/**
 * Calls the AI model to select the next bank question based on conversation history.
 *
 * Server-only — must not be imported from client components.
 *
 * @param systemPrompt - The bank selection system prompt (built by `buildBankSelectionPrompt`)
 * @param conversationHistory - Full conversation history as role/content pairs
 * @returns A fully-typed `BankSelectionResponse` with safe defaults applied
 * @throws If the model response cannot be parsed as JSON
 */
export async function callModelForBankSelection(
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<BankSelectionResponse> {
  // Step 1 — Call the AI model
  const raw = await aiClient.complete({ systemPrompt, messages: conversationHistory });

  // Step 2 — Strip markdown fences (defensive parsing)
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  // Step 3 — Parse JSON; throw on invalid JSON (route handler is responsible for catching)
  const parsed: unknown = JSON.parse(clean);

  // Step 4 — Cast to a record for field-level access
  const obj = parsed as Record<string, unknown>;

  // Step 5 — Apply safe defaults
  const selectedQuestionId: string | null =
    typeof obj.selectedQuestionId === 'string' && obj.selectedQuestionId !== ''
      ? obj.selectedQuestionId
      : null;

  const question: string = typeof obj.question === 'string' ? obj.question : '';

  const isComplete: boolean = typeof obj.isComplete === 'boolean' ? obj.isComplete : false;

  const detectedSkills: string[] = Array.isArray(obj.detectedSkills)
    ? (obj.detectedSkills as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];

  const coveredTopics: string[] = Array.isArray(obj.coveredTopics)
    ? (obj.coveredTopics as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];

  const remainingGaps: string[] = Array.isArray(obj.remainingGaps)
    ? (obj.remainingGaps as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];

  const questionRationale: string =
    typeof obj.questionRationale === 'string' ? obj.questionRationale : '';

  // Step 6 — Return fully-typed BankSelectionResponse
  return {
    selectedQuestionId,
    question,
    isComplete,
    detectedSkills,
    coveredTopics,
    remainingGaps,
    questionRationale,
  };
}
