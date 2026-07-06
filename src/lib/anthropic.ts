import type { ClaudeInterviewResponse, DecisionState } from '@/types';
import { aiClient } from '@/lib/ai-client';

/**
 * Sentinel token used by the legacy streaming interview prompt.
 * Retained for backward compatibility with buildEvaluationPrompt consumers.
 */
export const INTERVIEW_COMPLETE_SENTINEL = '[INTERVIEW_COMPLETE]';

/**
 * Builds the system prompt that grounds the AI interviewer in the
 * specific job role, rubric, and interview rules.
 *
 * The returned prompt instructs Claude to respond ONLY with valid JSON in
 * the ClaudeInterviewResponse shape — no prose, no markdown fences.
 *
 * Pure function — no side effects, no I/O.
 *
 * @param jobTitle       The title of the job being interviewed for.
 * @param jobDescription The full job description (included verbatim).
 * @param skills         Array of skills with their priority weights.
 *                       If empty, Claude is instructed to derive skills
 *                       from the job description.
 */
export function buildInterviewSystemPrompt(
  jobTitle: string,
  jobDescription: string,
  skills: Array<{ name: string; weight: number }>
): string {
  const skillsList =
    skills.length > 0
      ? skills.map((s) => `- ${s.name} (priority: ${s.weight})`).join('\n')
      : '(No skills specified — derive the key skills to assess from the job description above)';

  return `You are an expert AI interviewer conducting a structured job interview for the following position.

## Job Title

${jobTitle}

## Job Description

${jobDescription}

## Skills Rubric

The following skills must be assessed during this interview. Priority values indicate relative importance (higher = more critical):

${skillsList}

## Interview Rules

1. Ask at minimum 6 questions in total.
2. Generate at least 2 adaptive follow-up questions that probe areas the candidate's prior answers reveal as important or unclear.
3. Ask only one question at a time — never bundle multiple questions in a single response.
4. Keep each question concise and clearly focused on one competency or topic.
5. Adapt your questions based on the candidate's previous answers to dig deeper into gaps or impressive areas.
6. Set isComplete: true ONLY after ALL required skills have been adequately covered AND at least 6 questions have been asked.
7. When isComplete is true, the "question" field should be a polite closing statement thanking the candidate.
8. Be professional, encouraging, and neutral. Do not give feedback or reveal your evaluation during the interview.

## Response Format

You MUST respond ONLY with valid JSON — no prose, no markdown fences, no surrounding text. Your entire response must be a single JSON object matching this exact shape:

{
  "question": "string — the next interview question, or closing statement if isComplete is true",
  "isComplete": false,
  "decisionState": {
    "detectedSkills": ["list of skills the candidate has demonstrated so far"],
    "coveredTopics": ["list of topics you have already asked about"],
    "remainingGaps": ["list of skills or topics from the rubric still to be assessed"],
    "questionRationale": "explanation of why you chose this specific question at this point"
  }
}

Rules for the decisionState fields:
- detectedSkills: list every skill the candidate has demonstrated based on their answers so far.
- coveredTopics: list every interview topic you have already addressed.
- remainingGaps: list every skill or topic from the rubric that still needs to be assessed.
- questionRationale: explain clearly why you chose this question at this point in the interview.

CRITICAL: Your entire response must be valid JSON only. Do not include any text before or after the JSON object. Do not wrap the JSON in markdown code fences.`;
}

/**
 * Builds the evaluation prompt that instructs the AI to return a
 * structured JSON assessment of the candidate based on the transcript.
 *
 * Pure function — no side effects, no I/O.
 */
export function buildEvaluationPrompt(
  turns: Array<{ speaker: string; content: string }>
): string {
  const transcript = turns
    .map((turn) => {
      const label = turn.speaker === 'USER' ? 'CANDIDATE' : 'INTERVIEWER';
      return `${label}: ${turn.content}`;
    })
    .join('\n\n');

  return `Below is the complete transcript of a job interview.

## Interview Transcript

${transcript}

## Task

Based on the interview transcript above, evaluate the candidate. Respond with ONLY valid JSON — no surrounding text, no markdown code fences — containing exactly these keys: \`strengths\` (array of strings), \`concerns\` (array of strings), \`overall_score\` (integer from 1 to 10).

Example format:
{"strengths":["Clear communication","Strong problem-solving skills"],"concerns":["Limited experience with distributed systems"],"overall_score":7}`;
}

/**
 * Calls the Claude API to generate the next interview question.
 *
 * Strips any markdown code fences from the response before parsing, applies
 * safe defaults for any missing decisionState fields, and returns a
 * fully-typed ClaudeInterviewResponse.
 *
 * Throws if:
 * - The API response contains no text block (unexpected content type)
 * - The response text cannot be parsed as JSON
 *
 * Missing fields within a parseable JSON response are filled with safe
 * defaults rather than causing a throw.
 *
 * @param systemPrompt        Built by buildInterviewSystemPrompt.
 * @param conversationHistory Full conversation so far as role/content pairs.
 */
export async function callClaudeForNextQuestion(
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ClaudeInterviewResponse> {
  const raw = await aiClient.complete({ systemPrompt, messages: conversationHistory });

  // Defensive fence-stripping: Claude occasionally wraps JSON in markdown fences
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  // JSON.parse throws on invalid JSON — the route handler catches this and
  // returns 500 { "error": "AI service unavailable. Please try again." }
  const parsed: unknown = JSON.parse(clean);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Claude response is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  // Narrow decisionState: if absent or not an object, fall back to empty record
  const rawDs =
    typeof obj.decisionState === 'object' && obj.decisionState !== null
      ? (obj.decisionState as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const decisionState: DecisionState = {
    detectedSkills: Array.isArray(rawDs.detectedSkills)
      ? (rawDs.detectedSkills as unknown[]).filter(
          (s): s is string => typeof s === 'string'
        )
      : [],
    coveredTopics: Array.isArray(rawDs.coveredTopics)
      ? (rawDs.coveredTopics as unknown[]).filter(
          (s): s is string => typeof s === 'string'
        )
      : [],
    remainingGaps: Array.isArray(rawDs.remainingGaps)
      ? (rawDs.remainingGaps as unknown[]).filter(
          (s): s is string => typeof s === 'string'
        )
      : [],
    questionRationale:
      typeof rawDs.questionRationale === 'string' ? rawDs.questionRationale : '',
  };

  return {
    question: typeof obj.question === 'string' ? obj.question : '',
    isComplete: typeof obj.isComplete === 'boolean' ? (obj.isComplete ?? false) : false,
    decisionState,
  };
}
