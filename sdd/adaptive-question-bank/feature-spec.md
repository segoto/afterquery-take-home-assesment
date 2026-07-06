# Feature Spec: Adaptive Question Bank Selection via OpenRouter

## Overview

This feature replaces the AI interviewer's free-form question generation with adaptive selection from a role-specific, curated question bank. Each of the 12 job roles gains a predefined bank of at minimum 10 questions covering TECHNICAL, BEHAVIORAL, and SITUATIONAL themes. On each interview turn, the AI model — accessed via the provider-agnostic `aiClient.complete()` (which routes to OpenRouter when `AI_PROVIDER=openrouter`) — receives the full conversation history plus the remaining (unasked) bank questions, and selects the most contextually appropriate next question, optionally rephrasing it slightly for natural flow. The selected question's ID is persisted in the `Turn.decisionState` JSON field to enforce the no-repeat guarantee on subsequent turns. The minimum interview length rule (at minimum 6 total questions) and session-completion behaviour are preserved. This feature also includes a prerequisite fix to `InterviewRoom.tsx` to send `currentQuestion` (instead of `turnNumber`) in the request body and to parse the API response as JSON rather than a raw stream.

## Scope

**Included:**
- `src/lib/question-bank.ts` — New file: static question banks for all 12 jobs (at minimum 10 questions each), with `BankQuestion` type and `getStaticQuestionBank()` utility
- `src/lib/bank-selection.ts` — New file: `buildBankSelectionPrompt()` and `callModelForBankSelection()` using `aiClient.complete()` for OpenRouter compatibility
- `src/app/api/interview/route.ts` — Modified: replace `callClaudeForNextQuestion` (free generation) with bank-based selection logic; load static bank, filter used question IDs, call selection model, store `selectedQuestionId` in `decisionState`; simplify session query to not include skills (no longer needed)
- `src/types/index.ts` — Modified: add `BankQuestion` type; add `BankSelectionResponse` type; extend `DecisionState` with `selectedQuestionId: string | null`
- `src/components/InterviewRoom.tsx` — Modified (prerequisite bug fix): replace `turnNumber: state.turnNumber` with `currentQuestion: state.currentQuestion` in request body; replace stream reader with `await res.json()`; pass `data.decisionState` to `TURN_SAVED` dispatch
- `docs/openapi.yaml` — Modified: update `POST /api/interview` description to reflect bank-based selection behaviour
- `src/__tests__/question-bank.test.ts` — New: unit tests for `getStaticQuestionBank` covering all 12 jobs
- `src/__tests__/bank-selection.test.ts` — New: unit tests for `buildBankSelectionPrompt` and `callModelForBankSelection`
- `src/__tests__/interview-route.test.ts` — Modified: update mocks to use `callModelForBankSelection` and `getStaticQuestionBank`; add bank-selection and no-repeat tests

**Explicitly out of scope:**
- OpenRouter follow-up injection after interview completion (covered by the `openrouter-integration` spec)
- Adding `Turn.source` field to the schema (covered by the `openrouter-integration` spec)
- Changes to `POST /api/evaluate` or the results page
- Admin UI for question bank management
- Seniority-based question filtering (all current job definitions use MID; treated as future work)
- Updating `prisma/seed.ts` or the existing DB `Skill`/`Question` models (the bank is static TypeScript, not DB-driven)
- AI-generated fallback questions when the bank is exhausted and fewer than 6 turns have been asked (the model closes gracefully in that case)

## User Stories

- As a candidate, I want to be asked role-specific interview questions drawn from a structured bank so that the interview is relevant and comprehensive.
- As a candidate, I want at least 2 of the interview questions to be explicitly chosen because of something I said in a prior answer, so that the interview adapts to my actual responses rather than following a fixed sequence.
- As a candidate, I want no question to be repeated during my session so that my interview time is used efficiently.
- As a candidate, I want the AI decision panel to show the rationale for why each bank question was selected so that the selection process is transparent.
- As a candidate, I want the session to end naturally after adequate coverage is achieved (at minimum 6 questions asked) with a polite closing statement.
- As a platform operator, I want question banks defined in a static TypeScript file alongside `lib/jobs.ts` so that updating questions requires only a code change with no DB migrations.
- As a platform operator, I want the question selection call to route to OpenRouter when `AI_PROVIDER=openrouter` so that I can use a cost-effective model for bank selection.
- As a developer, I want the selected question ID stored in `Turn.decisionState` so that I can trace which bank question was asked at each turn and enforce the no-repeat guarantee.
- As a developer, I want `InterviewRoom.tsx` to send `currentQuestion` in the request body and parse the API response as JSON so that the frontend communicates correctly with the route.

## Functional Requirements

### 1. Static Question Bank (`src/lib/question-bank.ts`)

1. The file must define and export the canonical `BankQuestion` interface. This is the single source of truth for the type; `src/types/index.ts` re-exports it from this file (see requirement 27):
   ```typescript
   export interface BankQuestion {
     id: string;       // globally unique, stable identifier (e.g. "sqb-swe-001")
     text: string;     // full question text
     type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
     skill: string;    // skill area label (e.g. "TypeScript and Node.js")
   }
   ```

2. The file must export a constant `QUESTION_BANKS: Record<string, BankQuestion[]>` where each key is a Job `id` from `src/lib/jobs.ts` and each value is the array of `BankQuestion` entries for that job.

3. `QUESTION_BANKS` must contain an entry for all 12 job IDs defined in `src/lib/jobs.ts`:
   - `clswe0001000000000000000001` (Software Engineer)
   - `clspm0002000000000000000002` (Product Manager)
   - `clsda0003000000000000000003` (Data Analyst)
   - `clbfe0004000000000000000004` (Frontend Engineer)
   - `clbbe0005000000000000000005` (Backend Engineer)
   - `cldvo0006000000000000000006` (DevOps Engineer)
   - `cldate0007000000000000000007` (Data Engineer)
   - `clmle0008000000000000000008` (ML Engineer)
   - `clqae0009000000000000000009` (QA Engineer)
   - `clpmt0010000000000000000010` (Product Manager – Technical)
   - `clsre0011000000000000000011` (Site Reliability Engineer)
   - `clsec0012000000000000000012` (Security Engineer)

4. Each job's bank must contain at minimum 10 questions.

5. Each job's bank must include: at minimum 3 questions of type TECHNICAL, at minimum 3 of type BEHAVIORAL, and at minimum 2 of type SITUATIONAL. The remaining questions (at minimum 2) may be any type.

6. Question IDs must follow the pattern `sqb-<abbrev>-<NNN>` where `<abbrev>` is a 2–6 character unique abbreviation of the job slug and `<NNN>` is a 3-digit zero-padded integer starting at 001. Example: `sqb-swe-001` for the first Software Engineer question, `sqb-sre-005` for the fifth SRE question.

7. All question IDs across all 12 banks must be globally unique — no two questions in any bank may share an ID.

8. The file must export a function:
   ```typescript
   export function getStaticQuestionBank(jobId: string): BankQuestion[]
   ```
   that returns `QUESTION_BANKS[jobId] ?? []`. The function must be pure (no side effects, no async operations, no external dependencies).

### 2. Bank Selection AI (`src/lib/bank-selection.ts`)

9. The file must export a function:
   ```typescript
   export function buildBankSelectionPrompt(
     jobTitle: string,
     jobDescription: string,
     remainingQuestions: BankQuestion[],
     aiTurnCount: number,
   ): string
   ```
   where `aiTurnCount` is the number of AI turns already saved for the session (used so the model knows how many questions have been asked). `BankQuestion` is imported from `@/lib/question-bank`.

10. The prompt returned by `buildBankSelectionPrompt` must:
    - Establish the model as an AI interviewer for `jobTitle`
    - Include `jobDescription` verbatim
    - If `remainingQuestions` is non-empty, list each available question in the format:
      `[id: <id>] (<type> | <skill>) <text>`, one per line
    - If `remainingQuestions` is empty, include the text: "All bank questions have been covered. Close the interview gracefully."
    - Instruct the model to select the most contextually appropriate question from the list based on the conversation history; optionally rephrase it slightly for natural flow; set `selectedQuestionId` to the matching ID
    - Instruct the model that across the full session at least 2 questions must be selected explicitly because of something the candidate said in a prior answer; for each such selection, the `questionRationale` field must quote or paraphrase the specific candidate statement that motivated the choice
    - Instruct the model to set `isComplete: true` only when all of the following are true: at minimum 6 total questions have been asked (the model can verify this by counting assistant turns in the conversation history; `aiTurnCount` is provided as additional context), AND the model judges adequate coverage of key role competencies, OR when `remainingQuestions` is empty
    - Instruct the model that when `isComplete: true`, `selectedQuestionId` must be `null` and `question` must be a polite closing statement thanking the candidate
    - Instruct the model to track and report `detectedSkills`, `coveredTopics`, `remainingGaps`, and `questionRationale` in every response
    - Instruct the model to respond ONLY with valid JSON — no prose, no markdown fences — matching the shape below

11. The prompt must instruct the model to respond with the following JSON shape:
    ```json
    {
      "selectedQuestionId": "string or null",
      "question": "string",
      "isComplete": false,
      "detectedSkills": ["string"],
      "coveredTopics": ["string"],
      "remainingGaps": ["string"],
      "questionRationale": "string — explains why this question was chosen and cites any specific candidate statements that influenced the selection"
    }
    ```

12. The file must export a function:
    ```typescript
    export async function callModelForBankSelection(
      systemPrompt: string,
      conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    ): Promise<BankSelectionResponse>
    ```
    This function must:
    - Call `aiClient.complete({ systemPrompt, messages: conversationHistory })` — `aiClient` is imported from `@/lib/ai-client`
    - Strip markdown code fences from the raw response string before parsing: `.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()`
    - Parse the cleaned string with `JSON.parse`
    - Apply safe defaults for missing or incorrectly typed fields: `selectedQuestionId` defaults to `null` (if absent or not a string or empty); `question` defaults to `''`; `isComplete` defaults to `false`; `detectedSkills`, `coveredTopics`, `remainingGaps` default to `[]`; `questionRationale` defaults to `''`
    - Throw if the response cannot be parsed as JSON at all (the route handler is responsible for catching this)
    - Return a fully-typed `BankSelectionResponse`

13. `callModelForBankSelection` and `buildBankSelectionPrompt` must be server-only. The file must not include `'use client'` and must not be imported from client components.

### 3. Route: POST /api/interview (`src/app/api/interview/route.ts`)

14. The session query must be simplified: `include: { job: true }` (removing `include: { job: { include: { skills: true } } }` since the static bank, not `job.skills`, is used).

15. After fetching the session and existing turns (existing validation and deduplication logic unchanged), the route must call `getStaticQuestionBank(session.jobId)` to load the question bank for the session's job.

16. The route must compute `usedQuestionIds: Set<string>` by iterating over `existingTurns` where `speaker === 'AI'`. For each such turn, if `decisionState` is a non-null object and `typeof (decisionState as any).selectedQuestionId === 'string'` and the value is non-empty, add it to the set.

17. The route must compute `remainingQuestions: BankQuestion[]` as `getStaticQuestionBank(session.jobId).filter(q => !usedQuestionIds.has(q.id))`.

18. The route must compute `aiTurnCount: number` as the count of turns in `existingTurns` where `speaker === 'AI'`.

19. **Bank-exhausted and aiTurnCount >= 6 path**: If `remainingQuestions.length === 0` AND `aiTurnCount >= 6`, the route must NOT call the AI model. It must use the following static closing statement as `nextQuestion`: `"Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps."` and set `isComplete: true`. The `decisionState` saved on the AI Turn and returned in the response for this path must be exactly:
    ```json
    {
      "selectedQuestionId": null,
      "detectedSkills": [],
      "coveredTopics": [],
      "remainingGaps": [],
      "questionRationale": "Bank fully covered. Interview closed."
    }
    ```

20. **All other paths** (remaining questions non-empty, OR bank exhausted and aiTurnCount < 6): The route must call `callModelForBankSelection` using a system prompt built by `buildBankSelectionPrompt(job.title, job.description, remainingQuestions, aiTurnCount)` and the conversation history constructed the same way as the current route constructs it for `callClaudeForNextQuestion` (map existing turns to role/content pairs; prepend the initial question on first turn; append the current user answer).

21. The route must NOT call `buildInterviewSystemPrompt` or `callClaudeForNextQuestion`. Those functions remain in `src/lib/anthropic.ts` for backward compatibility with existing tests, but the route no longer invokes them.

22. When saving an AI turn (after `callModelForBankSelection` or the bank-exhausted static path), the route must store `decisionState` as:
    ```json
    {
      "selectedQuestionId": "sqb-swe-004",
      "detectedSkills": ["TypeScript"],
      "coveredTopics": ["Background"],
      "remainingGaps": ["System Design"],
      "questionRationale": "explanation"
    }
    ```
    When the static bank-exhausted closing is used, `selectedQuestionId` is `null`.

23. When `callModelForBankSelection` throws (JSON parse error, network error, AI API error), the route must return `500 { "error": "AI service unavailable. Please try again." }`. The user turn already saved is not rolled back.

24. All existing route logic is preserved unchanged: 400/404/409 validation, deduplication guard, first-turn initial AI question save with `decisionState: Prisma.JsonNull`, session completion update (`status: 'COMPLETED'`, `endedAt: new Date()`) in a `$transaction` when `isComplete: true`.

25. The success response shape is unchanged from the current implementation. `decisionState` in the response is the `BankSelectionResponse`'s relevant fields (without `question` and `isComplete`, which go into their own top-level response fields):
    ```json
    {
      "nextQuestion": "string",
      "isComplete": false,
      "decisionState": {
        "selectedQuestionId": "sqb-swe-004",
        "detectedSkills": ["string"],
        "coveredTopics": ["string"],
        "remainingGaps": ["string"],
        "questionRationale": "string"
      }
    }
    ```

### 4. Types (`src/types/index.ts`)

26. `DecisionState` must be updated to include `selectedQuestionId`:
    ```typescript
    export interface DecisionState {
      selectedQuestionId: string | null;
      detectedSkills: string[];
      coveredTopics: string[];
      remainingGaps: string[];
      questionRationale: string;
    }
    ```

27. `src/types/index.ts` must re-export `BankQuestion` from `@/lib/question-bank` rather than defining it independently. The canonical definition lives in `src/lib/question-bank.ts` (see requirement 1); `types/index.ts` acts as a convenience re-export so that consumers can import from either path:
    ```typescript
    export type { BankQuestion } from '@/lib/question-bank';
    ```
    This avoids a DRY violation and prevents the two definitions from drifting out of sync.

28. A new `BankSelectionResponse` type must be exported:
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

29. `ClaudeInterviewResponse` remains in `src/types/index.ts` unchanged for backward compatibility with existing `anthropic.ts` tests. It is no longer used by the interview route.

30. `PostInterviewResponse.decisionState` remains typed as `DecisionState`. The updated `DecisionState` type (with `selectedQuestionId`) is backward-compatible because the new field is nullable.

### 5. InterviewRoom.tsx Bug Fix (`src/components/InterviewRoom.tsx`)

31. In the `submitTurn` async function, replace the `fetch` body key `turnNumber: state.turnNumber` with `currentQuestion: state.currentQuestion`. The complete request body must be:
    ```typescript
    body: JSON.stringify({
      sessionId: state.sessionId,
      userAnswer,
      currentQuestion: state.currentQuestion,
    })
    ```

32. Remove the stream-reading code block entirely: the `if (!res.body)` guard, the `const reader = res.body.getReader()` declaration, the `const decoder = new TextDecoder()`, the `while(true)` loop, the sentinel extraction lines (`const SENTINEL = ...`, `const isComplete = accumulated.includes(SENTINEL)`, `const nextQuestion = accumulated.replace(SENTINEL, '').trim()`), and the accumulated string. None of these are needed after this fix.

33. After the `res.ok` check, call `const data = await res.json() as PostInterviewResponse` to parse the response body.

34. Wrap the JSON parse in try/catch. If `res.json()` throws, dispatch `API_ERROR { message: "Failed to read AI response." }` and return.

35. Dispatch `TURN_SAVED` with:
    ```typescript
    dispatch({
      type: 'TURN_SAVED',
      nextQuestion: data.nextQuestion,
      isComplete: data.isComplete,
      decisionState: (data.decisionState as DecisionState) ?? null,
    });
    ```

36. Call `speakQuestion(data.nextQuestion)` after the dispatch, unchanged from current behaviour.

37. All other `InterviewRoom` logic is unchanged: state machine phases, camera handling, TTS, retry handling, rendering layout, `DecisionPanel` (if rendered by the decision-panel feature), `VoiceRecorder`.

### 6. Tests

38. `src/__tests__/question-bank.test.ts` (new) must include:
    - `getStaticQuestionBank` returns the correct bank array for a known job ID (spot-check one job)
    - `getStaticQuestionBank` returns `[]` for an unknown job ID (e.g. `"nonexistent"`)
    - Each of the 12 job IDs returns a bank with at minimum 10 entries
    - Each bank contains at minimum one TECHNICAL, one BEHAVIORAL, and one SITUATIONAL question
    - All question IDs across all 12 banks are globally unique (no duplicates when the union of all banks is checked)
    - Each `BankQuestion` entry has all required fields: `id` (non-empty string), `text` (non-empty string), `type` (one of the three valid values), `skill` (non-empty string)

39. `src/__tests__/bank-selection.test.ts` (new) must use `jest.unstable_mockModule` to mock `@/lib/ai-client` and must include:
    - `buildBankSelectionPrompt` includes the `jobTitle` in its output
    - `buildBankSelectionPrompt` includes each question ID and text in its output when `remainingQuestions` is non-empty
    - `buildBankSelectionPrompt` includes the adaptive follow-up instruction: the output must contain language instructing the model to select at least 2 questions explicitly because of prior candidate statements and to cite those statements in `questionRationale`
    - `buildBankSelectionPrompt` does not throw when `remainingQuestions` is empty and includes the bank-exhausted instruction
    - `callModelForBankSelection` parses a valid JSON string returned by `aiClient.complete` into `BankSelectionResponse`
    - `callModelForBankSelection` strips markdown fences before parsing (e.g., response wrapped in `` ```json `` fences is still parsed correctly)
    - `callModelForBankSelection` applies safe defaults for a partially missing response (e.g., missing `detectedSkills` defaults to `[]`)
    - `callModelForBankSelection` throws when the response is not parseable JSON

40. `src/__tests__/interview-route.test.ts` (updated) must:
    - Replace the `@/lib/anthropic` mock's `callClaudeForNextQuestion` with a mock of `callModelForBankSelection` from `@/lib/bank-selection`
    - Add a mock of `getStaticQuestionBank` from `@/lib/question-bank`, returning a small fixed bank (e.g., 2 questions) by default
    - Add a test: when the route succeeds, the AI turn is saved with `decisionState` containing `selectedQuestionId` matching the mock's return value
    - Add a test: when an existing AI turn has `decisionState.selectedQuestionId` set, the bank passed to `callModelForBankSelection` excludes that ID (no-repeat guarantee)
    - Add a test: when `remainingQuestions` is empty and `aiTurnCount >= 6`, the route returns `{ isComplete: true }` and `callModelForBankSelection` is NOT called
    - Add a test: the static bank-exhausted closing path returns `decisionState` equal to `{ selectedQuestionId: null, detectedSkills: [], coveredTopics: [], remainingGaps: [], questionRationale: "Bank fully covered. Interview closed." }`
    - All existing tests for 400/404/409/500 responses must continue to pass with the updated mocks

## Non-Functional Requirements

- **Performance**: `getStaticQuestionBank` is a synchronous constant lookup — zero added latency. `callModelForBankSelection` uses `aiClient.complete()` which has the same latency profile as the current Anthropic call (2–8 seconds end-to-end). The route's total response latency is unchanged.
- **Security**: `callModelForBankSelection` is server-only. `getStaticQuestionBank` contains no secrets. The AI API key is never exposed to the client. `src/lib/bank-selection.ts` must not appear in client-side bundles.
- **Reliability**: If `callModelForBankSelection` throws, the route returns `500 { "error": "AI service unavailable. Please try again." }` and the user turn already saved is preserved. The no-repeat guarantee is enforced at the route level (not delegated to the model), so AI errors never cause repeated questions.
- **Type safety**: All new and modified files must compile with no errors under `npx tsc --noEmit`. No `any` casts in new production code (test files may use typed casts for mock return values).
- **Browser support**: `InterviewRoom.tsx` fix replaces `res.body.getReader()` (ReadableStream API) with `res.json()` (standard Fetch API) — `res.json()` has broader compatibility, improving Firefox and Safari reliability.
- **Accessibility**: No new interactive elements introduced. The `DecisionPanel` (if already rendered by the decision-panel feature) will automatically display the updated `decisionState` shape including `selectedQuestionId`, but the panel does not need to render `selectedQuestionId` visually.

## Data Model Changes

No new Prisma migrations are required. The `Turn.decisionState` field (DB column `decision_state JSONB?`, already present) continues to be used. Its logical JSON structure is extended by the addition of the `selectedQuestionId` key:

| Key in decisionState JSON | Type | Description |
|---------------------------|------|-------------|
| `selectedQuestionId` | `string \| null` | ID of the selected bank question (new with this feature) |
| `detectedSkills` | `string[]` | Skills detected in candidate answers (existing) |
| `coveredTopics` | `string[]` | Topics already addressed (existing) |
| `remainingGaps` | `string[]` | Competencies still to assess (existing) |
| `questionRationale` | `string` | Why this question was selected (existing) |

Existing `Turn` rows from before this feature will have `decisionState` objects without `selectedQuestionId`. The route's `usedQuestionIds` computation handles this by checking `typeof value === 'string' && value !== ''` before adding to the set, so old rows are silently skipped.

## API Contracts

### POST /api/interview (updated)

**Method + path**: `POST /api/interview`

**Request body (unchanged):**
```json
{
  "sessionId": "string",
  "userAnswer": "string",
  "currentQuestion": "string"
}
```

**Success response (200) — mid-interview:**
```json
{
  "nextQuestion": "Tell me about a time your code design decision turned out to be wrong. How did you handle it?",
  "isComplete": false,
  "decisionState": {
    "selectedQuestionId": "sqb-swe-004",
    "detectedSkills": ["TypeScript", "API Design"],
    "coveredTopics": ["Background", "TypeScript Experience"],
    "remainingGaps": ["System Design", "Error Handling"],
    "questionRationale": "Candidate described strong TypeScript skills but mentioned a past mistake briefly. Selecting a behavioral reflection question to probe self-awareness and learning from failure."
  }
}
```

**Success response (200) — interview complete:**
```json
{
  "nextQuestion": "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.",
  "isComplete": true,
  "decisionState": {
    "selectedQuestionId": null,
    "detectedSkills": ["TypeScript", "API Design", "System Design", "Debugging"],
    "coveredTopics": ["Background", "Technical Experience", "Behavioral", "Problem Solving"],
    "remainingGaps": [],
    "questionRationale": "All required competencies covered after 7 questions. Closing the interview."
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "sessionId, userAnswer, and currentQuestion are required" }` | Any required field missing, not a string, or empty |
| 404 | `{ "error": "Session not found" }` | No session row with the given sessionId |
| 409 | `{ "error": "Session is not in progress" }` | session.status is not IN_PROGRESS |
| 500 | `{ "error": "AI service unavailable. Please try again." }` | `callModelForBankSelection` throws (JSON parse error, network error, AI API error) |
| 500 | `{ "error": "Internal server error" }` | Any other unexpected failure |

## UI Behaviour

### InterviewRoom component (modified)

**Processing phase (submitting an answer):**
- The request body now sends `currentQuestion: state.currentQuestion` instead of `turnNumber: state.turnNumber`
- After `res.ok`, the component calls `await res.json()` to obtain the parsed response body; this replaces all stream-reading code
- `TURN_SAVED` is dispatched with `nextQuestion: data.nextQuestion`, `isComplete: data.isComplete`, and `decisionState: data.decisionState ?? null`
- `speakQuestion(data.nextQuestion)` is called after the dispatch
- If `res.json()` throws, `API_ERROR { message: "Failed to read AI response." }` is dispatched

**DecisionPanel rendering (if already rendered by the decision-panel feature):**
- The `DecisionPanel` receives the updated `DecisionState` including `selectedQuestionId`. It does not need to display `selectedQuestionId` visually; existing rendering of `detectedSkills`, `coveredTopics`, `remainingGaps`, and `questionRationale` is unchanged.

**All other phases and UI elements:** unchanged.

## Edge Cases & Error Handling

1. **No bank found for session's job**: `getStaticQuestionBank` returns `[]`. The route enters the bank-exhausted path immediately. If `aiTurnCount >= 6`, returns static closing without calling the model. If `aiTurnCount < 6`, calls `callModelForBankSelection` with an empty `remainingQuestions`; the prompt instructs the model to close gracefully, which returns `isComplete: true`.

2. **Model returns a `selectedQuestionId` not in the remaining bank**: The route does not validate that the returned ID exists in `remainingQuestions`. The ID is stored in `decisionState` as returned. On the next turn, it will appear in `usedQuestionIds` and be filtered out. Net effect: one bank slot is consumed by a possibly hallucinated ID, reducing the effective remaining bank by one. This is acceptable given low probability of hallucination.

3. **Model returns `isComplete: true` after fewer than 6 questions**: The route respects the model's signal and completes the session. The `buildBankSelectionPrompt` instructs the model to ask at minimum 6 questions, but enforcement is not double-checked by the route.

4. **Bank exhausted and `aiTurnCount < 6`**: The route calls `callModelForBankSelection` with `remainingQuestions = []`. The prompt instructs the model to close gracefully in this case. The model returns `isComplete: true` with a closing statement and `selectedQuestionId: null`.

5. **Duplicate `selectedQuestionId` from concurrent requests**: Two simultaneous requests for the same session could both compute `remainingQuestions` without the other's selection. Both would store a `selectedQuestionId` in their respective AI turns. On subsequent turns, both IDs appear in `usedQuestionIds`. Worst case: two AI turns are created with the same selected question ID. The no-repeat guarantee holds for all subsequent turns. This race condition is acceptable; distributed locks are out of scope.

6. **Existing AI turns from before this feature have no `selectedQuestionId`**: The `usedQuestionIds` computation checks for a non-empty string value. Old turns with `decisionState` objects lacking `selectedQuestionId` contribute nothing to the set. The bank is presented as fully available for these legacy sessions, which is correct.

7. **`callModelForBankSelection` throws**: Route returns `500 { "error": "AI service unavailable. Please try again." }`. The user turn is already saved. On retry, the same `usedQuestionIds` and `remainingQuestions` are computed (idempotent) and the model is called again.

8. **`InterviewRoom.tsx` `res.json()` throws**: The catch block dispatches `API_ERROR { message: "Failed to read AI response." }`. The "Retry" button re-submits the same answer to the route.

9. **Initial hardcoded question is not a bank question**: The initial question ("Welcome! Please start by telling me about yourself and your background.") is hardcoded in `InterviewRoom.tsx` and saved as an AI turn with `decisionState: null`. It is not from the bank. `usedQuestionIds` correctly ignores turns with `null` decisionState. The bank selection starts from the second AI question.

10. **`aiTurnCount` includes the initial hardcoded question**: After the first user answer, `aiTurnCount === 1` (the initial question is an AI turn). After 5 bank questions are asked, `aiTurnCount === 6`, at which point the model may signal completion. With a minimum bank size of 10 and a minimum of 5 bank questions needed before the model can complete (plus the initial hardcoded question = 6 total), banks of 10 questions are sufficient for valid sessions.

## Acceptance Criteria

- [ ] `src/lib/question-bank.ts` exports `BankQuestion` type, `QUESTION_BANKS` constant, and `getStaticQuestionBank(jobId: string): BankQuestion[]` function
- [ ] `QUESTION_BANKS` contains entries for all 12 job IDs from `src/lib/jobs.ts`
- [ ] Each job's bank has at minimum 10 questions
- [ ] Each job's bank has at minimum 3 TECHNICAL, 3 BEHAVIORAL, and 2 SITUATIONAL questions
- [ ] All question IDs across all 12 banks are globally unique
- [ ] Question IDs follow the pattern `sqb-<abbrev>-<NNN>`
- [ ] `getStaticQuestionBank` returns the correct bank for a known job ID
- [ ] `getStaticQuestionBank` returns `[]` for an unknown job ID
- [ ] `src/lib/bank-selection.ts` exports `buildBankSelectionPrompt` and `callModelForBankSelection`
- [ ] `callModelForBankSelection` calls `aiClient.complete()` (not a direct Anthropic or OpenAI client instantiation)
- [ ] `callModelForBankSelection` strips markdown fences before JSON parsing
- [ ] `callModelForBankSelection` applies safe defaults for all fields when missing from response
- [ ] `callModelForBankSelection` throws when response is not parseable JSON
- [ ] `DecisionState` type in `src/types/index.ts` includes `selectedQuestionId: string | null` as the first field
- [ ] `BankQuestion` and `BankSelectionResponse` types are exported from `src/types/index.ts`
- [ ] `POST /api/interview` session query uses `include: { job: true }` (without nested `skills: true`)
- [ ] `POST /api/interview` calls `getStaticQuestionBank(session.jobId)` to load the bank
- [ ] `POST /api/interview` computes `usedQuestionIds` from existing AI turn `decisionState.selectedQuestionId` values
- [ ] `POST /api/interview` filters the bank to `remainingQuestions` before any AI call
- [ ] `POST /api/interview` calls `callModelForBankSelection` with the remaining bank and conversation history
- [ ] `POST /api/interview` does NOT call `callClaudeForNextQuestion` or `buildInterviewSystemPrompt`
- [ ] `POST /api/interview` saves `selectedQuestionId` in the AI Turn's `decisionState` JSON
- [ ] `POST /api/interview` returns `isComplete: true` with a static closing statement when `remainingQuestions` is empty and `aiTurnCount >= 6`, without calling the model
- [ ] `POST /api/interview` calls `callModelForBankSelection` with empty `remainingQuestions` when bank is exhausted and `aiTurnCount < 6`
- [ ] `POST /api/interview` returns `500 { "error": "AI service unavailable. Please try again." }` when `callModelForBankSelection` throws
- [ ] `POST /api/interview` returns 400/404/409 under the same conditions as the current implementation
- [ ] `InterviewRoom.tsx` `submitTurn` sends `currentQuestion: state.currentQuestion` in the request body
- [ ] `InterviewRoom.tsx` `submitTurn` removes all stream-reading code and calls `await res.json()` instead
- [ ] `InterviewRoom.tsx` dispatches `TURN_SAVED` with `nextQuestion`, `isComplete`, and `decisionState` from the parsed JSON
- [ ] `InterviewRoom.tsx` dispatches `API_ERROR` when `res.json()` throws
- [ ] `buildBankSelectionPrompt` output instructs the model to select at least 2 questions explicitly because of prior candidate statements and to cite those statements in `questionRationale`
- [ ] `POST /api/interview` returns the static `decisionState` `{ selectedQuestionId: null, detectedSkills: [], coveredTopics: [], remainingGaps: [], questionRationale: "Bank fully covered. Interview closed." }` when the bank-exhausted static closing path is taken
- [ ] `src/types/index.ts` re-exports `BankQuestion` from `@/lib/question-bank` and does not define it independently
- [ ] `src/__tests__/question-bank.test.ts` exists with tests covering all 12 jobs, uniqueness of IDs, shape validation, and unknown-ID fallback
- [ ] `src/__tests__/bank-selection.test.ts` exists with tests covering: prompt includes adaptive follow-up instruction (at least 2 questions grounded in prior candidate answers); prompt content (jobTitle present, question list present, bank-exhausted instruction present); JSON parsing; fence-stripping; safe defaults; throw-on-invalid-JSON
- [ ] `src/__tests__/interview-route.test.ts` is updated with bank-selection mocks and no-repeat tests; all tests pass
- [ ] `npx tsc --noEmit` passes with no errors after all changes

## Open Decisions

1. **Static TypeScript file for question bank, not DB-driven**: The feature request explicitly states the bank should live "alongside or inside lib/jobs.ts." Despite the existing `Skill`/`Question` DB models (from the `job-skills-question-bank` feature), a static file requires no seed step, makes question content immediately visible in code review, and eliminates the dependency between interview functionality and database seeding state. The existing `getQuestionBank` DB function is preserved for potential future use but is not used by this feature.

2. **New `src/lib/bank-selection.ts` instead of extending `anthropic.ts`**: `callModelForBankSelection` uses `aiClient.complete()` which is provider-agnostic (Anthropic or OpenRouter). Adding it to `anthropic.ts` — which is named after and dedicated to the Anthropic provider — would be misleading and create an inconsistent dependency on `ai-client.ts` within an Anthropic-named file. A dedicated file keeps the bank selection concern isolated.

3. **`aiClient.complete()` for question selection**: The feature request says "The OpenRouter provider (already wired) should be the one calling the model for question selection." The existing `aiClient` singleton supports OpenRouter when `AI_PROVIDER=openrouter`. Using `aiClient.complete()` satisfies this requirement via configuration without hardcoding a new OpenRouter-specific client, keeping the design consistent with the OpenRouter integration already in place.

4. **No route-level enforcement of the minimum 6-question rule**: The route delegates the question-count decision entirely to the model via the prompt. Double-checking in the route would require counting all AI turns and comparing to 6, which conflicts when the model judges readiness differently. Trusting the model's `isComplete` signal (which is guided by the prompt's count instruction and the `aiTurnCount` parameter) is consistent with the current design.

5. **`selectedQuestionId: null` on `DecisionState` for closing turns**: When `isComplete: true`, no bank question is selected, so `selectedQuestionId` is null. Making the field nullable rather than omitting it entirely keeps the `DecisionState` shape consistent across all AI turns, simplifies the `usedQuestionIds` extraction logic (always check for string), and prevents type narrowing issues in downstream consumers like `DecisionPanel`.

6. **`InterviewRoom.tsx` fix included in this spec**: The `submitTurn` function currently sends `turnNumber` instead of `currentQuestion` and reads the response as a stream rather than JSON. This bug was previously identified and specified in the `decision-panel` spec but was not yet implemented in the code. Because the adaptive-question-bank feature requires correct request and response handling end-to-end, the fix is included here. If the `decision-panel` implementation has already applied the fix, the implementer must confirm and skip the duplicate change without reverting it.

7. **Session query simplified to omit skills**: The current route fetches `job.skills` for use by `buildInterviewSystemPrompt`. Since this feature replaces `buildInterviewSystemPrompt` with `buildBankSelectionPrompt` (which uses the static bank, not DB skills), the `skills: true` include is no longer needed. Removing it reduces query payload. The `buildBankSelectionPrompt` function receives job title, description, and the static bank questions — all sufficient for the selection prompt.

8. **Static closing statement for bank-exhausted sessions with aiTurnCount >= 6**: Rather than making an AI call to generate a closing statement when the bank is fully used, a predefined closing statement is used. This keeps the completion path deterministic, avoids an unnecessary model call, and provides a professional candidate experience regardless of AI service availability.
