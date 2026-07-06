# Implementation Plan: Adaptive Question Bank Selection

## Overview

This feature replaces free-form AI question generation in `POST /api/interview` with adaptive selection from role-specific, curated static question banks. The AI model (via `aiClient.complete()`, which routes to OpenRouter when `AI_PROVIDER=openrouter`) receives the conversation history plus the remaining unasked questions and selects the most contextually appropriate next question; the selected question's ID is persisted in `Turn.decisionState` to enforce a no-repeat guarantee across turns.

## Prerequisites

- No new Prisma migrations are required. The `decision_state` JSONB column on `turns` (DB: `decision_state`) was already created by migration `20260705230445_add_decision_state_to_turns`.
- No new environment variables. `AI_PROVIDER`, `ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY` already exist.
- The `DecisionPanel` component (`src/components/DecisionPanel.tsx`) was implemented by the `decision-panel` feature and is already rendered by `InterviewRoom.tsx`.
- `InterviewRoom.tsx` already sends `currentQuestion` in the request body and calls `await res.json()` — the bug fix described in the spec is already in place. The frontend task (T5) must verify this and apply only the type-compatibility check for the updated `DecisionState`.

## Task Graph

| Task | Wave | Type     | Description                                                                 | Depends on |
|------|------|----------|-----------------------------------------------------------------------------|------------|
| T1   | 1    | backend  | Create `src/lib/question-bank.ts` with `BankQuestion` type, `QUESTION_BANKS` for all 12 jobs, and `getStaticQuestionBank` | — |
| T2   | 2    | backend  | Update `src/types/index.ts`: add `selectedQuestionId` to `DecisionState`, add `BankSelectionResponse`, re-export `BankQuestion` | T1 |
| T3   | 2    | backend  | Create `src/lib/bank-selection.ts`: `buildBankSelectionPrompt` and `callModelForBankSelection` | T1 |
| T4   | 3    | backend  | Rewrite `src/app/api/interview/route.ts` to use bank-based selection; update `docs/openapi.yaml` | T1, T2, T3 |
| T5   | 3    | frontend | Verify `src/components/InterviewRoom.tsx` bug fix is in place; ensure `DecisionState` import is type-compatible | T2 |
| T6   | 4    | backend  | Create `src/__tests__/question-bank.test.ts`                                | T1 |
| T7   | 4    | backend  | Create `src/__tests__/bank-selection.test.ts`                               | T3 |
| T8   | 4    | backend  | Update `src/__tests__/interview-route.test.ts` with bank-selection mocks and no-repeat tests | T1, T3, T4 |

Wave 1 tasks run fully in parallel. Wave 2 tasks start once Wave 1 is complete. Wave 3 tasks start once Wave 2 is complete. Wave 4 tasks start once Wave 3 is complete.

## Task Details

### T1: Create `src/lib/question-bank.ts`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/lib/question-bank.ts` — new file: defines `BankQuestion` interface, `QUESTION_BANKS` constant (all 12 jobs), and `getStaticQuestionBank` utility function
- **Implementation notes**:

  Export the `BankQuestion` interface as the canonical definition (types/index.ts will re-export it):
  ```typescript
  export interface BankQuestion {
    id: string;       // e.g. "sqb-swe-001"
    text: string;
    type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
    skill: string;    // e.g. "TypeScript and Node.js"
  }
  ```

  Export `QUESTION_BANKS: Record<string, BankQuestion[]>` keyed by job ID. All 12 job IDs from `src/lib/jobs.ts` must have entries:

  | Job ID | Abbreviation | Example ID |
  |--------|-------------|------------|
  | `clswe0001000000000000000001` | `swe` | `sqb-swe-001` |
  | `clspm0002000000000000000002` | `spm` | `sqb-spm-001` |
  | `clsda0003000000000000000003` | `sda` | `sqb-sda-001` |
  | `clbfe0004000000000000000004` | `bfe` | `sqb-bfe-001` |
  | `clbbe0005000000000000000005` | `bbe` | `sqb-bbe-001` |
  | `cldvo0006000000000000000006` | `dvo` | `sqb-dvo-001` |
  | `cldate0007000000000000000007` | `de` | `sqb-de-001` |
  | `clmle0008000000000000000008` | `mle` | `sqb-mle-001` |
  | `clqae0009000000000000000009` | `qae` | `sqb-qae-001` |
  | `clpmt0010000000000000000010` | `pmt` | `sqb-pmt-001` |
  | `clsre0011000000000000000011` | `sre` | `sqb-sre-001` |
  | `clsec0012000000000000000012` | `sec` | `sqb-sec-001` |

  Each job must have at least 10 questions with: ≥3 TECHNICAL, ≥3 BEHAVIORAL, ≥2 SITUATIONAL, and the remaining ≥2 may be any type. All IDs across all 12 banks must be globally unique.

  Export the utility function:
  ```typescript
  export function getStaticQuestionBank(jobId: string): BankQuestion[] {
    return QUESTION_BANKS[jobId] ?? [];
  }
  ```
  This function is pure: no async, no side effects, no external dependencies.

  **Representative bank structure example (Software Engineer — `sqb-swe-*`):**
  - TECHNICAL: system design, TypeScript/Node.js, API design, debugging, code quality
  - BEHAVIORAL: collaboration, handling failure, code review, ownership, time management
  - SITUATIONAL: handling production incidents, technical disagreement with stakeholders, deadlines with tech debt

  Author similar coverage-appropriate banks for all 12 roles based on each job description in `src/lib/jobs.ts`.

- **Testing**:
  - Unit: covered by T6
  - Integration: N/A (pure constant + function, no I/O)
  - Manual: import `getStaticQuestionBank('clswe0001000000000000000001')` in a scratch script and verify 10+ entries are returned with correct shape

---

### T2: Update `src/types/index.ts`

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/types/index.ts` — add `selectedQuestionId` to `DecisionState`, add `BankSelectionResponse`, add `BankQuestion` re-export; preserve all existing types
- **Implementation notes**:

  1. Add a re-export of `BankQuestion` from `@/lib/question-bank` (do NOT duplicate the definition):
     ```typescript
     export type { BankQuestion } from '@/lib/question-bank';
     ```

  2. Update `DecisionState` to add `selectedQuestionId` as the first field:
     ```typescript
     export interface DecisionState {
       selectedQuestionId: string | null;
       detectedSkills: string[];
       coveredTopics: string[];
       remainingGaps: string[];
       questionRationale: string;
     }
     ```
     This is backward-compatible: the new field is nullable, so existing code that constructs a `DecisionState` without `selectedQuestionId` will get a TypeScript error and must be updated. The only construction site that changes is `src/app/api/interview/route.ts` (handled in T4). The `DecisionPanel.tsx` and `InterviewRoom.tsx` consume but do not construct `DecisionState`, so they are unaffected.

  3. Add the new `BankSelectionResponse` type:
     ```typescript
     export interface BankSelectionResponse {
       selectedQuestionId: string | null;
       question: string;
       isComplete: boolean;
       detectedSkills: string[];
       coveredTopics: string[];
       remainingGaps: string[];
       questionRationale: string;
     }
     ```

  4. Keep `ClaudeInterviewResponse` unchanged (backward-compatible with `anthropic.ts` tests).
  5. Keep `PostInterviewResponse.decisionState: DecisionState` typed as `DecisionState` — the updated type is compatible.

- **Testing**:
  - Unit: `npx tsc --noEmit` must pass with no errors after this task and T1 are both complete
  - Manual: confirm no TypeScript errors in `src/lib/anthropic.ts` — `callClaudeForNextQuestion` returns `ClaudeInterviewResponse` which embeds the old `DecisionState` shape; since `selectedQuestionId` is new and nullable, the `anthropic.ts` file will produce TypeScript errors because its `decisionState` construction omits `selectedQuestionId`. The implementer must add `selectedQuestionId: null` to the `decisionState` object in `callClaudeForNextQuestion` in `src/lib/anthropic.ts` to satisfy the updated type.

---

### T3: Create `src/lib/bank-selection.ts`

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/lib/bank-selection.ts` — new file: `buildBankSelectionPrompt` (pure function) and `callModelForBankSelection` (async, server-only)
- **Implementation notes**:

  This file must NOT include `'use client'`. It must not be imported from any client component.

  Import `BankQuestion` from `@/lib/question-bank` (not from `@/types`).
  Import `BankSelectionResponse` from `@/types`.
  Import `aiClient` from `@/lib/ai-client`.

  **`buildBankSelectionPrompt`:**
  ```typescript
  export function buildBankSelectionPrompt(
    jobTitle: string,
    jobDescription: string,
    remainingQuestions: BankQuestion[],
    aiTurnCount: number,
  ): string
  ```

  The returned prompt string must contain all of the following sections, in order:

  1. Role establishment: "You are an expert AI interviewer conducting a structured job interview for **{jobTitle}**."
  2. Job description block verbatim.
  3. Available questions block:
     - If `remainingQuestions.length > 0`: list each question as `[id: {id}] ({type} | {skill}) {text}`, one per line inside a labelled section.
     - If `remainingQuestions.length === 0`: include the text "All bank questions have been covered. Close the interview gracefully."
  4. Selection rules:
     - Select the most contextually appropriate question from the available list based on the conversation history.
     - Optionally rephrase the selected question slightly for natural conversational flow.
     - Set `selectedQuestionId` to the matching `id` from the list.
     - Across the full session, at least 2 questions must be selected explicitly because of something the candidate said in a prior answer; for each such selection, `questionRationale` must quote or paraphrase the specific candidate statement that motivated the choice.
     - Set `isComplete: true` only when: at least 6 total questions have been asked (count assistant turns in the conversation history; `aiTurnCount` is {aiTurnCount} as additional context) AND adequate coverage of key role competencies is achieved, OR when all bank questions have been covered.
     - When `isComplete: true`, set `selectedQuestionId` to `null` and set `question` to a polite closing statement thanking the candidate.
  5. Tracking fields instruction: always populate `detectedSkills`, `coveredTopics`, `remainingGaps`, and `questionRationale` in every response.
  6. JSON-only response instruction: respond ONLY with valid JSON, no prose, no markdown fences, matching this exact shape:
     ```json
     {
       "selectedQuestionId": "string or null",
       "question": "string",
       "isComplete": false,
       "detectedSkills": ["string"],
       "coveredTopics": ["string"],
       "remainingGaps": ["string"],
       "questionRationale": "string"
     }
     ```

  **`callModelForBankSelection`:**
  ```typescript
  export async function callModelForBankSelection(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<BankSelectionResponse>
  ```

  Implementation steps (in order):
  1. Call `const raw = await aiClient.complete({ systemPrompt, messages: conversationHistory })`.
  2. Strip markdown fences: `const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()`.
  3. Parse: `const parsed: unknown = JSON.parse(clean)` — throw on invalid JSON (do not catch here; route handler catches it).
  4. Cast: `const obj = parsed as Record<string, unknown>`.
  5. Apply safe defaults:
     - `selectedQuestionId`: if `typeof obj.selectedQuestionId === 'string' && obj.selectedQuestionId !== ''` → use the value; otherwise `null`.
     - `question`: `typeof obj.question === 'string' ? obj.question : ''`.
     - `isComplete`: `typeof obj.isComplete === 'boolean' ? obj.isComplete : false`.
     - `detectedSkills`, `coveredTopics`, `remainingGaps`: filter the array entries for strings or default to `[]`.
     - `questionRationale`: `typeof obj.questionRationale === 'string' ? obj.questionRationale : ''`.
  6. Return the fully-typed `BankSelectionResponse`.

- **Testing**:
  - Unit: covered by T7
  - Manual: in a Node.js REPL, call `buildBankSelectionPrompt('Software Engineer', 'desc', [], 6)` and confirm it contains the bank-exhausted text and the adaptive follow-up instruction.

---

### T4: Update `src/app/api/interview/route.ts` and `docs/openapi.yaml`

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — replace `callClaudeForNextQuestion`/`buildInterviewSystemPrompt` with bank-based selection logic
  - `docs/openapi.yaml` — update `POST /api/interview` description and `decisionState` schema to include `selectedQuestionId`
- **Implementation notes**:

  **Route changes (preserve all existing validation, 400/404/409, deduplication guard, first-turn AI save, and $transaction patterns):**

  1. Remove the import of `buildInterviewSystemPrompt` and `callClaudeForNextQuestion` from `@/lib/anthropic`. Add imports:
     ```typescript
     import { getStaticQuestionBank } from '@/lib/question-bank';
     import { buildBankSelectionPrompt, callModelForBankSelection } from '@/lib/bank-selection';
     import type { BankSelectionResponse } from '@/types';
     ```
     Remove `ClaudeInterviewResponse` from the type imports if it is no longer used.

  2. Change the session query from `include: { job: { include: { skills: true } } }` to `include: { job: true }`. This is sufficient since `buildBankSelectionPrompt` only needs `job.title` and `job.description`.

  3. After fetching `existingTurns` (and before the deduplication guard), add the following bank computation block:
     ```typescript
     // Load the static question bank for this job
     const fullBank = getStaticQuestionBank(session.jobId);

     // Collect IDs of bank questions already asked (from AI turn decisionState)
     const usedQuestionIds = new Set<string>();
     for (const turn of existingTurns) {
       if (turn.speaker === 'AI' && turn.decisionState !== null) {
         const ds = turn.decisionState as Record<string, unknown>;
         if (typeof ds.selectedQuestionId === 'string' && ds.selectedQuestionId !== '') {
           usedQuestionIds.add(ds.selectedQuestionId);
         }
       }
     }

     // Filter to questions not yet asked
     const remainingQuestions = fullBank.filter((q) => !usedQuestionIds.has(q.id));

     // Count AI turns already saved (includes the initial hardcoded question turn)
     const aiTurnCount = existingTurns.filter((t) => t.speaker === 'AI').length;
     ```

  4. Replace the `buildInterviewSystemPrompt` + `callClaudeForNextQuestion` block with:

     ```typescript
     let nextQuestion: string;
     let isComplete: boolean;
     let decisionStateData: BankSelectionResponse;

     if (remainingQuestions.length === 0 && aiTurnCount >= 6) {
       // Bank fully exhausted and minimum questions met — close without model call
       nextQuestion = "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.";
       isComplete = true;
       decisionStateData = {
         selectedQuestionId: null,
         question: nextQuestion,
         isComplete: true,
         detectedSkills: [],
         coveredTopics: [],
         remainingGaps: [],
         questionRationale: 'Bank fully covered. Interview closed.',
       };
     } else {
       // Call the model for bank-based selection
       const systemPrompt = buildBankSelectionPrompt(
         session.job.title,
         session.job.description,
         remainingQuestions,
         aiTurnCount,
       );
       let modelResponse: BankSelectionResponse;
       try {
         modelResponse = await callModelForBankSelection(systemPrompt, conversationHistory);
       } catch {
         return NextResponse.json<ApiErrorResponse>(
           { error: 'AI service unavailable. Please try again.' },
           { status: 500 }
         );
       }
       nextQuestion = modelResponse.question;
       isComplete = modelResponse.isComplete;
       decisionStateData = modelResponse;
     }
     ```

  5. When saving the AI turn and optionally completing the session, use `decisionStateData` (without the `question` and `isComplete` fields from the model response) as the stored `decisionState`:
     ```typescript
     const storedDecisionState = {
       selectedQuestionId: decisionStateData.selectedQuestionId,
       detectedSkills: decisionStateData.detectedSkills,
       coveredTopics: decisionStateData.coveredTopics,
       remainingGaps: decisionStateData.remainingGaps,
       questionRationale: decisionStateData.questionRationale,
     };
     ```
     Use `storedDecisionState as object` when passing to Prisma turn create `decisionState` field.

  6. Return the success response using `nextQuestion`, `isComplete`, and `storedDecisionState`:
     ```typescript
     return NextResponse.json<PostInterviewResponse>({
       nextQuestion,
       isComplete,
       decisionState: storedDecisionState,
     });
     ```

  **`docs/openapi.yaml` changes for `POST /api/interview`:**

  - Update the description to mention bank-based question selection via `callModelForBankSelection`, replacing the Claude-direct reference.
  - Add `selectedQuestionId` to the `decisionState` schema object under `required` and `properties`:
    ```yaml
    selectedQuestionId:
      oneOf:
        - type: string
          example: "sqb-swe-004"
        - type: 'null'
    ```
  - Update the `inProgress` and `complete` response examples to include `selectedQuestionId`.
  - Update the `aiUnavailable` 500 description to mention `callModelForBankSelection`.

- **Testing**:
  - Unit: covered by T8
  - Integration: start `npm run dev`, open an interview session for any job, submit an answer, and confirm the response contains `decisionState.selectedQuestionId` as a non-null string (e.g. `"sqb-swe-003"`).
  - Manual: in Prisma Studio, open a `Turn` row where `speaker = AI` and confirm `decision_state` JSON contains `selectedQuestionId`.

---

### T5: Verify `src/components/InterviewRoom.tsx` is compatible with updated `DecisionState`

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — verify the bug fix is in place; add `selectedQuestionId: null` only if TypeScript requires it anywhere in the file
  - `src/components/DecisionPanel.tsx` — no changes required; it renders only the 4 existing fields and will ignore `selectedQuestionId`
- **Implementation notes**:

  **Verification checklist (confirm all are already true; if any is missing, apply the fix):**

  1. The `submitTurn` fetch body uses `currentQuestion: state.currentQuestion` (not `turnNumber`). Looking at the current code in `src/components/InterviewRoom.tsx` line 189–193, this is already correct.
  2. After `res.ok`, the component calls `const data = (await res.json()) as PostInterviewResponse`. Looking at lines 213–214, this is already correct.
  3. `TURN_SAVED` is dispatched with `decisionState: data.decisionState ?? null`. Looking at lines 215–220, this is already correct.
  4. There is no `ReadableStream` / `getReader()` code anywhere in the file. This is already the case.

  **Type-compatibility check:**

  `DecisionState` now has `selectedQuestionId: string | null` as the first field. The `InterviewRoomState.decisionState` is typed as `DecisionState | null`. The `InterviewRoom` component never constructs a `DecisionState` object directly — it only passes `data.decisionState` (from the API response) and `action.decisionState` (in reducer cases) to the state. Since the updated `DecisionState` type is structurally backward-compatible for consumers, no changes to the component logic are needed.

  Run `npx tsc --noEmit` after T2 is complete to confirm zero errors in this file.

- **Testing**:
  - Unit: no new component tests required; existing `InterviewRoom.test.tsx` must still pass
  - Manual: start the app, navigate to an interview, submit a voice answer, and confirm the `DecisionPanel` renders without errors and displays `detectedSkills`, `coveredTopics`, `remainingGaps`, and `questionRationale` correctly

---

### T6: Create `src/__tests__/question-bank.test.ts`

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `src/__tests__/question-bank.test.ts` — new test file
- **Implementation notes**:

  Import `getStaticQuestionBank` and `QUESTION_BANKS` from `@/lib/question-bank`.

  The 12 job IDs to use in parameterized tests:
  ```
  clswe0001000000000000000001, clspm0002000000000000000002, clsda0003000000000000000003,
  clbfe0004000000000000000004, clbbe0005000000000000000005, cldvo0006000000000000000006,
  cldate0007000000000000000007, clmle0008000000000000000008, clqae0009000000000000000009,
  clpmt0010000000000000000010, clsre0011000000000000000011, clsec0012000000000000000012
  ```

  Required test cases:
  1. `getStaticQuestionBank` returns the correct bank array for a known job ID (spot-check `clswe0001000000000000000001` — verify it is an array with length ≥ 10 and first element has all 4 required fields).
  2. `getStaticQuestionBank('nonexistent')` returns `[]`.
  3. Parameterized over all 12 job IDs: each returns a bank with at least 10 entries.
  4. Parameterized over all 12 job IDs: each bank contains at least 1 TECHNICAL, 1 BEHAVIORAL, and 1 SITUATIONAL question.
  5. Parameterized over all 12 job IDs: each bank contains at least 3 TECHNICAL questions.
  6. Parameterized over all 12 job IDs: each bank contains at least 3 BEHAVIORAL questions.
  7. Parameterized over all 12 job IDs: each bank contains at least 2 SITUATIONAL questions.
  8. Global uniqueness: collect all question IDs from all 12 banks into a flat array; confirm no duplicates (compare `Set.size` to array length).
  9. Shape validation: for every question in every bank, assert `id` is a non-empty string, `text` is a non-empty string, `type` is one of `TECHNICAL | BEHAVIORAL | SITUATIONAL`, and `skill` is a non-empty string.
  10. ID pattern: for every question in every bank, assert `id` matches `/^sqb-[a-z]{2,6}-\d{3}$/`.

- **Testing**:
  - Run: `npx jest src/__tests__/question-bank.test.ts`
  - All tests must pass with zero failures.

---

### T7: Create `src/__tests__/bank-selection.test.ts`

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `src/__tests__/bank-selection.test.ts` — new test file
- **Implementation notes**:

  Use `jest.unstable_mockModule` to mock `@/lib/ai-client` (ESM-compatible, consistent with the existing pattern in `interview-route.test.ts` and `ai-client.test.ts`). Dynamically import `buildBankSelectionPrompt` and `callModelForBankSelection` from `@/lib/bank-selection` after the mock is registered.

  Fixture data:
  ```typescript
  const mockAiClientComplete = jest.fn<() => Promise<string>>();
  const sampleBank: BankQuestion[] = [
    { id: 'sqb-swe-001', text: 'Describe your TypeScript experience.', type: 'TECHNICAL', skill: 'TypeScript' },
    { id: 'sqb-swe-002', text: 'Tell me about a time you handled a production incident.', type: 'BEHAVIORAL', skill: 'Incident Response' },
  ];
  const validModelResponse = {
    selectedQuestionId: 'sqb-swe-001',
    question: 'Can you describe your TypeScript experience in detail?',
    isComplete: false,
    detectedSkills: ['TypeScript'],
    coveredTopics: [],
    remainingGaps: ['System Design'],
    questionRationale: 'Starting with the candidate\'s core skill area.',
  };
  ```

  Required test cases for `buildBankSelectionPrompt`:
  1. Output contains `jobTitle` string.
  2. Output contains each question's `id` and `text` when `remainingQuestions` is non-empty.
  3. Output contains the adaptive follow-up instruction: assert the output contains the phrase "at least 2" and "candidate" (case-insensitive) and "questionRationale" — confirming the prompt instructs the model to cite prior candidate statements.
  4. When `remainingQuestions` is empty, output contains the bank-exhausted instruction (assert for "All bank questions have been covered").
  5. Does not throw when called with empty `remainingQuestions`.

  Required test cases for `callModelForBankSelection`:
  6. Parses a valid JSON string returned by `aiClient.complete` into a fully-typed `BankSelectionResponse`.
  7. Strips markdown fences: mock `aiClient.complete` to return `` ```json\n{...}\n``` `` — confirm it still parses correctly.
  8. Applies safe defaults: mock `aiClient.complete` to return a JSON string missing `detectedSkills` — confirm the returned object has `detectedSkills: []`.
  9. Applies safe default for `selectedQuestionId`: mock returning JSON with `selectedQuestionId: ""` — confirm it defaults to `null`.
  10. Throws when the response is not parseable JSON (e.g. `"not json"`) — `expect(...).rejects.toThrow()`.

- **Testing**:
  - Run: `npx jest src/__tests__/bank-selection.test.ts`
  - All tests must pass with zero failures.

---

### T8: Update `src/__tests__/interview-route.test.ts`

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `src/__tests__/interview-route.test.ts` — replace `@/lib/anthropic` mock with `@/lib/bank-selection` and `@/lib/question-bank` mocks; add no-repeat and bank-exhausted tests
- **Implementation notes**:

  **Mock registration changes:**

  1. Remove (or keep for backward-compat) the `@/lib/anthropic` mock. The route no longer calls `callClaudeForNextQuestion` or `buildInterviewSystemPrompt`, so the mock can be replaced or simplified to an empty module. Keep `buildEvaluationPrompt` if `evaluate/route.ts` tests depend on it being in the same file — but since this test file only tests the interview route, the anthropic mock can be removed entirely or kept as a stub.

  2. Add a mock for `@/lib/bank-selection`:
     ```typescript
     const mockCallModelForBankSelection = jest.fn<() => Promise<BankSelectionResponse>>();
     const mockBuildBankSelectionPrompt = jest.fn<() => string>().mockReturnValue('mock-bank-system-prompt');

     jest.unstable_mockModule('@/lib/bank-selection', () => ({
       callModelForBankSelection: mockCallModelForBankSelection,
       buildBankSelectionPrompt: mockBuildBankSelectionPrompt,
     }));
     ```

  3. Add a mock for `@/lib/question-bank`:
     ```typescript
     const mockGetStaticQuestionBank = jest.fn<() => BankQuestion[]>();

     jest.unstable_mockModule('@/lib/question-bank', () => ({
       getStaticQuestionBank: mockGetStaticQuestionBank,
       QUESTION_BANKS: {},
     }));
     ```

  4. Update `beforeEach` to set default return values:
     ```typescript
     mockGetStaticQuestionBank.mockReturnValue([
       { id: 'sqb-swe-001', text: 'Q1', type: 'TECHNICAL', skill: 'TypeScript' },
       { id: 'sqb-swe-002', text: 'Q2', type: 'BEHAVIORAL', skill: 'Teamwork' },
     ]);
     mockCallModelForBankSelection.mockResolvedValue({
       selectedQuestionId: 'sqb-swe-001',
       question: 'Next AI question',
       isComplete: false,
       detectedSkills: ['TypeScript'],
       coveredTopics: ['Background'],
       remainingGaps: ['System Design'],
       questionRationale: 'Probing system design next.',
     });
     ```

  5. Update `validSession` to remove the `skills` field from `job` (since the session query no longer fetches `skills`):
     ```typescript
     const validJob = { id: 'job_id_123', title: 'Software Engineer', description: 'Test description' };
     ```
     Update `mockSessionFindUnique` to return the simplified `validJob` shape.

  **New test cases to add:**

  - "saves AI turn with `decisionState.selectedQuestionId` matching mock return value": after POST succeeds, inspect the `$transaction` call that saves the AI turn; verify the `decisionState` argument contains `selectedQuestionId: 'sqb-swe-001'`.

  - "no-repeat guarantee: when an existing AI turn has `decisionState.selectedQuestionId`, the bank passed to `callModelForBankSelection` excludes that ID":
    - Mock `mockTurnFindMany` to return an AI turn with `decisionState: { selectedQuestionId: 'sqb-swe-001', ... }`.
    - After POST, capture the `remainingQuestions` argument passed to `callModelForBankSelection` by inspecting `mockBuildBankSelectionPrompt` calls or by checking `mockCallModelForBankSelection`'s call arguments indirectly through the system prompt content.
    - Assert `sqb-swe-001` does not appear in the bank provided to the model.

  - "bank exhausted with aiTurnCount >= 6: returns isComplete true and does NOT call model":
    - Mock `mockGetStaticQuestionBank` to return `[]` (empty bank).
    - Mock `mockTurnFindMany` to return 6 AI turns (so `aiTurnCount === 6`).
    - POST the request; assert `res.status === 200`, `body.isComplete === true`, and `mockCallModelForBankSelection` was NOT called.

  - "bank exhausted with aiTurnCount >= 6: decisionState equals the static closing state":
    - Same setup as above; assert `body.decisionState` deep-equals `{ selectedQuestionId: null, detectedSkills: [], coveredTopics: [], remainingGaps: [], questionRationale: 'Bank fully covered. Interview closed.' }`.

  - "returns 500 when callModelForBankSelection throws":
    - `mockCallModelForBankSelection.mockRejectedValue(new Error('model error'))`.
    - Assert `res.status === 500` and `body.error === 'AI service unavailable. Please try again.'`.

  **Existing tests that must continue to pass:**
  - All 400/404/409 validation tests — unchanged logic.
  - Turn history fetch test — unchanged.
  - Transaction call count tests — update to account for bank-selection mock instead of Claude mock.
  - Unexpected error tests (DB errors) — unchanged catch-all behavior.

  **Update the `mockClaudeResponse` fixture to `BankSelectionResponse` shape** for the `success` describe block test that checks the full response body.

- **Testing**:
  - Run: `npx jest src/__tests__/interview-route.test.ts`
  - All tests must pass with zero failures.
  - Run: `npm test` to confirm no regressions in other test files.

---

## Data migrations

No Prisma schema changes are required. The `decision_state JSONB?` column on `turns` (already created by migration `20260705230445_add_decision_state_to_turns`) continues to be used. Its logical JSON structure gains the `selectedQuestionId` key, which is handled in application code only.

## API documentation updates

`POST /api/interview` in `docs/openapi.yaml` must be updated by the T4 implementer:

1. Update the endpoint `description` to say "uses adaptive bank-based question selection via `callModelForBankSelection` (routes to OpenRouter when `AI_PROVIDER=openrouter`)" replacing the Claude-direct description.
2. Add `selectedQuestionId` to the `decisionState` schema under `required` and `properties` with `oneOf: [string, null]`.
3. Update both `inProgress` and `complete` examples in the `200` response to include `selectedQuestionId` (non-null for in-progress, null for complete).
4. Update the `500` `aiUnavailable` example description to reference `callModelForBankSelection`.

## Cross-cutting concerns

- `BankQuestion` has a single canonical definition in `src/lib/question-bank.ts`. `src/types/index.ts` re-exports it. All other files import from either path — never define it independently.
- `callModelForBankSelection` and `buildBankSelectionPrompt` are server-only. They must not appear in any `'use client'` file or be re-exported through a client-facing barrel.
- The `DecisionState` type change (adding `selectedQuestionId: string | null`) affects every file that constructs a `DecisionState` literal. The only construction sites are:
  - `src/lib/anthropic.ts` → `callClaudeForNextQuestion`: add `selectedQuestionId: null` to the returned `decisionState` to satisfy the updated type. This keeps `anthropic.ts` tests passing.
  - `src/app/api/interview/route.ts` → handled in T4 (bank-selection response already includes `selectedQuestionId`).
  - Test fixtures in `src/__tests__/interview-route.test.ts` → handled in T8.
  - Test fixtures in `src/__tests__/anthropic-prompts.test.ts` → if `DecisionState` objects are constructed there, add `selectedQuestionId: null`; run the test suite to confirm.
- The T4 implementer must update `src/lib/anthropic.ts` inline (without a separate task) to add `selectedQuestionId: null` to the `decisionState` construction in `callClaudeForNextQuestion`, ensuring `npx tsc --noEmit` continues to pass.
