# Implementation Plan: Decision Panel

## Overview

This feature replaces the hardcoded placeholder logic in `POST /api/interview` with a real Claude API call that returns a structured JSON response (`{ question, isComplete, decisionState }`), and surfaces that decision state as a live `DecisionPanel` component rendered alongside the interview controls in a responsive two-column layout.

## Prerequisites

- `DATABASE_URL` must be set and the database must be reachable before running the migration.
- `ANTHROPIC_API_KEY` must be set in `.env` (server-only; never exposed to the client).
- `@anthropic-ai/sdk` must be installed (`npm install @anthropic-ai/sdk` — verify it is already in `package.json` before adding).

## Task Graph

| Task | Wave | Type     | Description                                                                 | Depends on    |
|------|------|----------|-----------------------------------------------------------------------------|---------------|
| T1   | 1    | backend  | Add `decisionState Json?` to `Turn` model in `prisma/schema.prisma` and run migration | —   |
| T2   | 1    | backend  | Add `DecisionState`, `ClaudeInterviewResponse` types; update `PostInterviewResponse`, `InterviewRoomState`, `InterviewRoomAction` in `src/types/index.ts` | — |
| T3   | 1    | frontend | Create `src/components/ui/Spinner.tsx`; export from `src/components/ui/index.ts` | — |
| T4   | 2    | backend  | Create `src/lib/anthropic.ts` with Anthropic singleton, `buildInterviewSystemPrompt`, and `callClaudeForNextQuestion` | T2 |
| T5   | 2    | frontend | Create `src/components/DecisionPanel.tsx`                                   | T2, T3        |
| T6   | 3    | backend  | Rewrite `src/app/api/interview/route.ts` with real Claude integration; update `docs/openapi.yaml` and `CLAUDE.md` | T1, T2, T4 |
| T7   | 4    | frontend | Modify `src/components/InterviewRoom.tsx` (state, reducer, request body, layout, DecisionPanel); update `src/app/interview/[jobId]/page.tsx` layout | T2, T5, T6 |
| T8   | 5    | backend  | Update `src/__tests__/interview-route.test.ts` for new request/response contract | T6 |
| T9   | 5    | frontend | Create `src/__tests__/Spinner.test.tsx` and `src/__tests__/DecisionPanel.test.tsx` | T3, T5 |
| T10  | 5    | frontend | Update `src/__tests__/InterviewRoom.test.tsx` for new state shape and DecisionPanel presence | T7 |

Wave 1 tasks are fully parallel. Wave N tasks start only when all Wave N-1 tasks are complete.

## Task Details

### T1: Prisma schema — add `decision_state` to `turns` table
- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `prisma/schema.prisma` — add `decisionState Json? @map("decision_state")` field to the `Turn` model
- **Implementation notes**:
  The existing `Turn` model gains one nullable JSON field. The TypeScript field name is `decisionState`; the DB column is `decision_state` (enforced by `@map`). No other models change. After editing the schema, run:
  ```
  npx prisma migrate dev --name add-decision-state-to-turns
  npx prisma generate
  ```
  The column is nullable so no backfill or data migration is needed for existing rows. The final `Turn` model must be:
  ```prisma
  model Turn {
    id            String   @id @default(cuid())
    sessionId     String   @map("session_id")
    session       Session  @relation(fields: [sessionId], references: [id])
    speaker       Speaker
    content       String
    decisionState Json?    @map("decision_state")
    createdAt     DateTime @default(now()) @map("created_at")

    @@map("turns")
  }
  ```
- **Testing**:
  - Unit: none (schema-only change).
  - Integration: `npx prisma migrate deploy` must succeed in CI without errors.
  - Manual: After migration, run `npx prisma studio` and confirm `turns` table has a nullable `decision_state` column of type `jsonb`.

---

### T2: Types — add `DecisionState`, `ClaudeInterviewResponse`; update existing types
- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — add two new interfaces; update three existing ones
- **Implementation notes**:
  Add the following new interfaces after the existing `PostInterviewResponse`:
  ```typescript
  export interface DecisionState {
    detectedSkills: string[];
    coveredTopics: string[];
    remainingGaps: string[];
    questionRationale: string;
  }

  export interface ClaudeInterviewResponse {
    question: string;
    isComplete: boolean;
    decisionState: DecisionState;
  }
  ```

  Update `PostInterviewResponse` to include `decisionState`:
  ```typescript
  export interface PostInterviewResponse {
    nextQuestion: string;
    isComplete: boolean;
    decisionState: DecisionState;
  }
  ```

  Update `InterviewRoomState` to add `decisionState: DecisionState | null` (initialised to `null`):
  ```typescript
  export interface InterviewRoomState {
    phase: InterviewPhase;
    sessionId: string | null;
    currentQuestion: string;
    turns: TranscriptTurn[];
    turnNumber: number;
    errorMessage: string | null;
    interimTranscript: string;
    retryCount: number;
    decisionState: DecisionState | null;
  }
  ```

  Update the `TURN_SAVED` variant in `InterviewRoomAction` union to include `decisionState`:
  ```typescript
  | { type: 'TURN_SAVED'; nextQuestion: string; isComplete: boolean; decisionState: DecisionState | null }
  ```

  No `any` types. All new types must be exported.
- **Testing**:
  - Unit: run `npx tsc --noEmit` — must compile with zero errors after this task and all tasks that depend on it.
  - Manual: no browser interaction needed.

---

### T3: Spinner — new shared UI primitive
- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/Spinner.tsx` — new Client Component
  - `src/components/ui/index.ts` — add `export { Spinner } from './Spinner'`
- **Implementation notes**:
  Create `src/components/ui/Spinner.tsx` as a `'use client'` component. Props interface (no `any`):
  ```typescript
  interface SpinnerProps {
    'aria-label': string;
  }
  ```
  Render:
  ```tsx
  <div aria-label={props['aria-label']} role="status">
    <svg
      className="h-8 w-8 animate-spin text-zinc-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
  ```
  No `style={{ }}` props. No inline styles. Append `export { Spinner } from './Spinner'` to `src/components/ui/index.ts`.
- **Testing**:
  - Unit: covered by T9 (`src/__tests__/Spinner.test.tsx`).
  - Manual: render on a test page; verify the SVG spins with Tailwind `animate-spin`.

---

### T4: `src/lib/anthropic.ts` — Anthropic client singleton and helper functions
- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/lib/anthropic.ts` — new server-only module (no `'use client'` directive)
- **Implementation notes**:
  This file must NOT have `'use client'`. It is imported exclusively from API routes.

  **Singleton**:
  ```typescript
  import Anthropic from '@anthropic-ai/sdk';
  export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  ```
  The instance is created once at module-load time; it must never be instantiated inside a request handler.

  **`buildInterviewSystemPrompt`**:
  Signature as specified in the spec (FR 3). The system prompt must:
  - Identify Claude as an AI interviewer for `jobTitle`
  - Include `jobDescription` verbatim
  - List each skill with its `weight` as a priority indicator (e.g., `"TypeScript (priority: 3)"`)
  - Instruct Claude to ask at minimum 6 questions with at least 2 adaptive follow-ups
  - Instruct Claude to respond **only** with valid JSON — no prose, no markdown fences — in the exact shape:
    ```json
    {
      "question": "string",
      "isComplete": false,
      "decisionState": {
        "detectedSkills": [],
        "coveredTopics": [],
        "remainingGaps": [],
        "questionRationale": "string"
      }
    }
    ```
  - Instruct Claude to set `isComplete: true` only after all required skills are covered AND at least 6 questions asked
  - If `skills` is empty, instruct Claude to derive skills from the job description

  **`callClaudeForNextQuestion`**:
  Signature as specified in the spec (FR 4). Implementation:
  - Call `anthropic.messages.create` with `model: 'claude-sonnet-4-6'`, `max_tokens: 1024`, `stream: false`, `system: systemPrompt`, `messages: conversationHistory`
  - Extract text from `response.content[0]` (type-guard that it is a `TextBlock`)
  - Strip markdown fences using the pattern from `docs/design-patterns.md`:
    ```typescript
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    ```
  - `JSON.parse(clean)` — if this throws, rethrow so the route catches it and returns 500
  - Apply safe defaults for missing fields:
    - `parsed.decisionState?.detectedSkills ?? []`
    - `parsed.decisionState?.coveredTopics ?? []`
    - `parsed.decisionState?.remainingGaps ?? []`
    - `parsed.decisionState?.questionRationale ?? ''`
    - `parsed.isComplete ?? false`
  - Return a fully-typed `ClaudeInterviewResponse` (imported from `@/types`)
  - No `any` types; use `unknown` for the parsed JSON intermediate and narrow it

  Import `ClaudeInterviewResponse` and `DecisionState` from `@/types` (established in T2).
- **Testing**:
  - Unit: tested indirectly through T8 (the route test mocks `@/lib/anthropic`). A direct unit test for `callClaudeForNextQuestion` is out of scope for this feature but the function must be mockable via `jest.unstable_mockModule('@/lib/anthropic', ...)`.
  - Manual: after T6 is complete, call `POST /api/interview` with a valid session and verify Claude returns a structured JSON response in the server logs.

---

### T5: `DecisionPanel` — new Client Component
- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/DecisionPanel.tsx` — new Client Component
- **Implementation notes**:
  Add `'use client'` at the top. Import `Card`, `Badge`, `Spinner` from `@/components/ui`. Import `DecisionState` from `@/types`.

  Props interface:
  ```typescript
  interface DecisionPanelProps {
    decisionState: DecisionState | null;
    isLoading: boolean;
  }
  ```

  Root element: `<section aria-label="AI decision panel">` wrapping a `<Card>`.

  **Loading state** (`isLoading === true`): render `<Card>` with `<h2 className="...">AI Decision Panel</h2>` and `<div className="flex justify-center mt-4"><Spinner aria-label="AI is thinking" /></div>`.

  **Empty state** (`decisionState === null && !isLoading`): render `<Card>` with heading and `<p className="text-zinc-400 text-sm">Complete your first answer to see the AI's reasoning.</p>`.

  **Populated state** (`decisionState !== null && !isLoading`): render `<Card>` with heading and four sections. Each section uses `<h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">` as the section heading.

  Section 1 — **Detected Skills**: flex-wrap row (`<div className="flex flex-wrap gap-2">`), one `<Badge variant="ai">{skill}</Badge>` per item in `decisionState.detectedSkills`. If array is empty: `<span className="text-zinc-400 text-sm">None yet</span>`.

  Section 2 — **Topics Covered**: `<ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">` with `<li>` per item in `decisionState.coveredTopics`. If empty: `<span className="text-zinc-400 text-sm">None yet</span>`.

  Section 3 — **Remaining Gaps**: same `<ul>` pattern for `decisionState.remainingGaps`. If empty: `<span className="text-sm text-green-600">All gaps covered</span>`.

  Section 4 — **Why this question?**: `<p className="text-sm text-zinc-700">{decisionState.questionRationale}</p>`. If `questionRationale` is empty string: `<span className="text-zinc-400 text-sm">No rationale provided</span>`.

  No `style={{ }}` props. Sections separated by `<div className="mb-4">` wrappers. No `any` types.
- **Testing**:
  - Unit: covered by T9 (`src/__tests__/DecisionPanel.test.tsx`).
  - Manual: render `<DecisionPanel decisionState={null} isLoading={false} />` in a test page to verify empty state. Populate with sample data to verify all four sections.

---

### T6: Rewrite `POST /api/interview` route + update `docs/openapi.yaml` and `CLAUDE.md`
- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — full rewrite
  - `docs/openapi.yaml` — update `POST /api/interview` entry
  - `CLAUDE.md` — update the streaming mandate bullet in "Key constraints and decisions"
- **Implementation notes**:

  **Route rewrite** (`src/app/api/interview/route.ts`):

  Remove all placeholder constants (`PLACEHOLDER_QUESTIONS`, `NEXT_QUESTION`).

  Import `prisma` from `@/lib/prisma`. Import `buildInterviewSystemPrompt` and `callClaudeForNextQuestion` from `@/lib/anthropic`. Import `PostInterviewResponse`, `ApiErrorResponse`, `DecisionState` from `@/types`.

  **Validation** — new required fields are `sessionId`, `userAnswer`, `currentQuestion`. All must be non-empty strings. `turnNumber` is silently ignored if present. Return `400 { "error": "sessionId, userAnswer, and currentQuestion are required" }` on failure.

  **Session + job lookup**:
  ```typescript
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { job: { include: { skills: true } } },
  });
  ```
  Return `404` if null. Return `409` if `session.status !== 'IN_PROGRESS'`.

  **Turn history fetch** (after session validation):
  ```typescript
  const existingTurns = await prisma.turn.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
  ```

  **Conversation history construction**:
  - Map each existing turn: `speaker === 'AI'` → `{ role: 'assistant', content: turn.content }`, `speaker === 'USER'` → `{ role: 'user', content: turn.content }`
  - Detect first-turn: `const hasAiTurns = existingTurns.some(t => t.speaker === 'AI')`
  - If `!hasAiTurns`: prepend `{ role: 'assistant', content: currentQuestion }` to the history
  - Always append `{ role: 'user', content: userAnswer }` as the last message

  **Deduplication guard** (retry safety):
  ```typescript
  const lastTurn = existingTurns[existingTurns.length - 1];
  const userAnswerAlreadySaved =
    lastTurn?.speaker === 'USER' && lastTurn?.content === userAnswer;
  ```
  If `userAnswerAlreadySaved` is true, skip the transaction in the next step.

  **Save user answer (pre-Claude)** — only if `!userAnswerAlreadySaved`:
  Execute a `prisma.$transaction`. If `!hasAiTurns`, include `prisma.turn.create({ data: { sessionId, speaker: 'AI', content: currentQuestion, decisionState: null } })`. Always include `prisma.turn.create({ data: { sessionId, speaker: 'USER', content: userAnswer } })`.

  **Claude API call**:
  ```typescript
  const systemPrompt = buildInterviewSystemPrompt(
    session.job.title,
    session.job.description,
    session.job.skills
  );
  ```
  Wrap `callClaudeForNextQuestion(systemPrompt, conversationHistory)` in a `try/catch`. On any thrown error, return `500 { "error": "AI service unavailable. Please try again." }`. Do NOT roll back the user turn saves.

  **Save Claude's response + optional session completion**:
  ```typescript
  const ops = [
    prisma.turn.create({
      data: {
        sessionId,
        speaker: 'AI',
        content: claudeResponse.question,
        decisionState: claudeResponse.decisionState as object,
      },
    }),
  ];
  if (claudeResponse.isComplete) {
    ops.push(
      prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      })
    );
  }
  await prisma.$transaction(ops);
  ```

  **Success response** (`200`):
  ```typescript
  return NextResponse.json({
    nextQuestion: claudeResponse.question,
    isComplete: claudeResponse.isComplete,
    decisionState: claudeResponse.decisionState,
  });
  ```

  **Outer catch**: any error not already handled returns `500 { "error": "Internal server error" }`.

  **`docs/openapi.yaml` update** — replace the existing `POST /api/interview` entry with the new contract:
  - Remove `turnNumber` from required fields and properties in the requestBody schema
  - Add `currentQuestion` as a required string field in the requestBody schema
  - Update the `200` response schema to include `decisionState` as a required object with properties `detectedSkills` (array of strings), `coveredTopics` (array of strings), `remainingGaps` (array of strings), `questionRationale` (string)
  - Update the `400` error example to say `"sessionId, userAnswer, and currentQuestion are required"`
  - Add a new `500` response example for `"AI service unavailable. Please try again."` (separate from generic `"Internal server error"`)
  - Update the `description` to reflect the synchronous Claude call and structured JSON response

  **`CLAUDE.md` update** — in the "Key constraints and decisions" section, replace the bullet:
  > "Use streaming (`stream: true`) from the Anthropic SDK on `/api/interview` and pipe with `ReadableStream` so the first words of the AI question appear quickly."

  with:
  > "`POST /api/interview` uses a synchronous (non-streaming) Anthropic call returning structured JSON (`{ question, isComplete, decisionState }`); streaming is reserved for future plain-text-only endpoints."
- **Testing**:
  - Unit: covered by T8 (`src/__tests__/interview-route.test.ts` update).
  - Integration: with a real database and `ANTHROPIC_API_KEY`, do a full interview turn via `curl` or Postman and verify the `decisionState` fields are non-empty in the `200` response.
  - Manual: start `npm run dev`, go through the interview flow, and observe structured JSON in the browser devtools network panel for `POST /api/interview`.

---

### T7: `InterviewRoom` modifications + page layout update
- **Type**: frontend
- **Wave**: 4
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — state, reducer, request body, layout, Spinner migration, DecisionPanel rendering
  - `src/app/interview/[jobId]/page.tsx` — change `max-w-2xl` to `max-w-5xl`
- **Implementation notes**:

  **Imports**: add `DecisionPanel` from `@/components/DecisionPanel`; add `Spinner` from `@/components/ui`.

  **`initialState`**: add `decisionState: null` field (type `DecisionState | null`).

  **Reducer — `TURN_SAVED` case**: spread `decisionState: action.decisionState` in both the `isComplete: true` branch (phase → `'complete'`) and the `isComplete: false` branch (phase → `'awaiting_recording'`).

  **`submitTurn` fetch body**: replace `turnNumber: state.turnNumber` with `currentQuestion: state.currentQuestion`. The `turnNumber` key is removed entirely from the request body.

  **`TURN_SAVED` dispatch on success**:
  ```typescript
  dispatch({
    type: 'TURN_SAVED',
    nextQuestion: data.nextQuestion,
    isComplete: data.isComplete,
    decisionState: data.decisionState ?? null,
  });
  ```

  **Spinner migration** — the `session_creating` render branch currently has an inline SVG. Replace it with:
  ```tsx
  <div className="flex flex-col items-center justify-center min-h-48 gap-4">
    <Spinner aria-label="Starting your interview…" />
    <p className="text-zinc-500 text-sm">Starting your interview&hellip;</p>
  </div>
  ```

  **Layout restructure** — the main return (for phases `awaiting_recording`, `recording`, `processing`, `api_error`) and the `complete` phase both need the `DecisionPanel`. Use this layout pattern for phases that include `DecisionPanel`:

  For `awaiting_recording | recording | processing | api_error`:
  ```tsx
  <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
    <div className="flex flex-col gap-6">
      {/* existing Card, TranscriptView, processing message, api_error card, VoiceRecorder */}
    </div>
    <DecisionPanel
      decisionState={state.decisionState}
      isLoading={state.phase === 'processing'}
    />
  </div>
  ```

  For `complete` phase:
  ```tsx
  <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
    <p className="text-zinc-700">Interview complete.</p>
    <DecisionPanel decisionState={state.decisionState} isLoading={false} />
  </div>
  ```

  `session_creating` and `session_error` phases do NOT render `DecisionPanel` — their render branches are unchanged (except for the Spinner migration in `session_creating`).

  **Page layout** (`src/app/interview/[jobId]/page.tsx`): change `max-w-2xl` to `max-w-5xl` in the `<main>` className. All other content unchanged.

  No `any` types. No `style={{ }}` props.
- **Testing**:
  - Unit: covered by T10 (`src/__tests__/InterviewRoom.test.tsx` update).
  - Manual: load `/interview/[jobId]` in the browser. Verify:
    1. The `DecisionPanel` shows an empty-state card before the first answer.
    2. The `DecisionPanel` shows the spinner while `processing`.
    3. After an answer is submitted, the `DecisionPanel` populates with skills, topics, gaps, and rationale.
    4. On desktop (≥1024px), the panel appears to the right of the main controls.
    5. On mobile (<1024px), the panel stacks below the main controls.

---

### T8: Update `src/__tests__/interview-route.test.ts`
- **Type**: backend
- **Wave**: 5
- **Files to create or modify**:
  - `src/__tests__/interview-route.test.ts` — update existing test file
- **Implementation notes**:

  **New module mocks to register** (before dynamic import of route):
  - `@/lib/anthropic` — mock `callClaudeForNextQuestion` and `buildInterviewSystemPrompt`:
    ```typescript
    const mockCallClaudeForNextQuestion = jest.fn<() => Promise<ClaudeInterviewResponse>>();
    const mockBuildInterviewSystemPrompt = jest.fn<() => string>().mockReturnValue('mock-system-prompt');
    jest.unstable_mockModule('@/lib/anthropic', () => ({
      callClaudeForNextQuestion: mockCallClaudeForNextQuestion,
      buildInterviewSystemPrompt: mockBuildInterviewSystemPrompt,
    }));
    ```

  **Update Prisma mock** to include `turn.findMany` and update `session.findUnique` to return session with job+skills:
  ```typescript
  const mockSessionFindUnique = jest.fn<() => Promise<{
    id: string; status: string;
    job: { id: string; title: string; description: string; skills: Array<{ id: string; name: string; weight: number }> }
  } | null>>();
  const mockTurnFindMany = jest.fn<() => Promise<Array<{ id: string; speaker: string; content: string }>>>();
  ```
  Update the `prisma` mock object to include `turn: { create: mockTurnCreate, findMany: mockTurnFindMany }`.

  **`beforeEach`** default mock values:
  ```typescript
  mockSessionFindUnique.mockResolvedValue({
    id: 'session_id_123',
    status: 'IN_PROGRESS',
    job: { id: 'job_123', title: 'Software Engineer', description: 'Test description', skills: [] },
  });
  mockTurnFindMany.mockResolvedValue([]);
  mockCallClaudeForNextQuestion.mockResolvedValue({
    question: 'Next AI question',
    isComplete: false,
    decisionState: {
      detectedSkills: ['TypeScript'],
      coveredTopics: ['Background'],
      remainingGaps: ['System Design'],
      questionRationale: 'Probing system design next.',
    },
  });
  mockTransaction.mockResolvedValue([]);
  ```

  **Remove** all tests that assert `turnNumber` as a required field (6 tests: missing, negative, non-integer, etc.).

  **Add** validation tests for `currentQuestion`:
  - Returns `400` when `currentQuestion` is missing → `{ "error": "sessionId, userAnswer, and currentQuestion are required" }`
  - Returns `400` when `currentQuestion` is an empty string → same error

  **Update** existing success test: the request body now uses `currentQuestion` instead of `turnNumber`. Assert that the `200` response body includes `decisionState` with the shape returned by the mock.

  **Add** test for `500 { "error": "AI service unavailable. Please try again." }` when `mockCallClaudeForNextQuestion` throws.

  **Add** test that `turn.findMany` is called with `{ where: { sessionId }, orderBy: { createdAt: 'asc' } }` on a successful request.

  **Preserve** existing session lookup tests (404, 409) — update the request body in those tests to include `currentQuestion` and remove `turnNumber`.

  **Preserve** the two unexpected-error tests (500 from `$transaction`, 500 from `session.findUnique`) — update request bodies similarly.

  Valid request body helper for all tests:
  ```typescript
  function makeRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/interview', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const VALID_BODY = {
    sessionId: 'session_id_123',
    userAnswer: 'My answer',
    currentQuestion: 'Tell me about yourself.',
  };
  ```
- **Testing**:
  - Run `npx jest src/__tests__/interview-route.test.ts` — all tests must pass.
  - Run `npx tsc --noEmit` — must compile with zero errors.

---

### T9: New `Spinner.test.tsx` and `DecisionPanel.test.tsx`
- **Type**: frontend
- **Wave**: 5
- **Files to create or modify**:
  - `src/__tests__/Spinner.test.tsx` — new test file
  - `src/__tests__/DecisionPanel.test.tsx` — new test file
- **Implementation notes**:

  Both files need `@jest-environment jsdom` directive.

  **`src/__tests__/Spinner.test.tsx`**:
  - Import `Spinner` from `@/components/ui/Spinner`
  - Test 1: renders a `role="status"` element with the provided `aria-label`
    ```typescript
    render(<Spinner aria-label="Loading data" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading data');
    ```
  - Test 2: the SVG child has `aria-hidden="true"`
    ```typescript
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    ```

  **`src/__tests__/DecisionPanel.test.tsx`**:
  - Import `DecisionPanel` from `@/components/DecisionPanel` (dynamic import after mocks)
  - No module mocks needed beyond standard jsdom environment

  - Test 1: loading state renders `role="status"` element and heading "AI Decision Panel"
    ```typescript
    render(<DecisionPanel decisionState={null} isLoading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('AI Decision Panel')).toBeInTheDocument();
    ```
  - Test 2: empty state renders the empty message and heading
    ```typescript
    render(<DecisionPanel decisionState={null} isLoading={false} />);
    expect(screen.getByText('Complete your first answer to see the AI\'s reasoning.')).toBeInTheDocument();
    ```
  - Test 3: populated state renders all four sections with correct data from `decisionState`
  - Test 4: empty `detectedSkills` array renders "None yet" (and does not render any Badge elements)
  - Test 5: empty `coveredTopics` array renders "None yet" in that section
  - Test 6: empty `remainingGaps` array renders "All gaps covered"

  Use a fixed `sampleDecisionState` fixture:
  ```typescript
  const sampleDecisionState = {
    detectedSkills: ['TypeScript', 'React'],
    coveredTopics: ['Background'],
    remainingGaps: ['System Design'],
    questionRationale: 'Probing system design.',
  };
  ```
- **Testing**:
  - Run `npx jest src/__tests__/Spinner.test.tsx src/__tests__/DecisionPanel.test.tsx` — all tests must pass.

---

### T10: Update `src/__tests__/InterviewRoom.test.tsx`
- **Type**: frontend
- **Wave**: 5
- **Files to create or modify**:
  - `src/__tests__/InterviewRoom.test.tsx` — update existing test file
- **Implementation notes**:

  **Update `makeInterviewResponse`** to include `decisionState` in the mock response:
  ```typescript
  function makeInterviewResponse(
    nextQuestion = 'Next question',
    isComplete = false
  ): Response {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        nextQuestion,
        isComplete,
        decisionState: {
          detectedSkills: ['TypeScript'],
          coveredTopics: ['Background'],
          remainingGaps: ['System Design'],
          questionRationale: 'Probing system design.',
        },
      }),
    } as unknown as Response;
  }
  ```

  **All 8 existing tests must continue to pass.** Check each one:
  - Test 7 ("Thinking…") still passes because `<p>Thinking…</p>` is still rendered in the `processing` phase (inside the left column).
  - Test 8 ("Interview complete.") still passes because that text is still present in the `complete` render branch.

  **Add test: DecisionPanel renders in `awaiting_recording` phase** — after session creation, the `DecisionPanel` element with `aria-label="AI decision panel"` should be in the DOM.

  **Add test: DecisionPanel shows loading state in `processing` phase** — after the mock record button is clicked and the interview fetch is pending, `role="status"` element from `Spinner` should be visible.

  **Add test: DecisionPanel shows decisionState data after `TURN_SAVED`** — after the interview fetch resolves (using `makeInterviewResponse`), the `decisionState.questionRationale` text `"Probing system design."` should be visible.

  **Update the fetch mock assertion** in the submit-turn test to verify the new request body shape. The body should now contain `currentQuestion` instead of `turnNumber`:
  ```typescript
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/interview',
    expect.objectContaining({
      body: expect.stringContaining('"currentQuestion"'),
    })
  );
  ```
- **Testing**:
  - Run `npx jest src/__tests__/InterviewRoom.test.tsx` — all existing and new tests must pass.
  - Run `npx jest` (full suite) — no regressions.

---

## Data migrations

The `Turn` model in `prisma/schema.prisma` gains one new nullable JSON field:

```prisma
decisionState Json? @map("decision_state")
```

Migration command (run during T1):
```bash
npx prisma migrate dev --name add-decision-state-to-turns
npx prisma generate
```

The `decision_state` column is `JSONB?` in PostgreSQL (nullable). No backfill is needed. Existing rows will have `NULL` in this column.

## API documentation updates

The `POST /api/interview` entry in `docs/openapi.yaml` must be updated in T6:

- **Request body** (`required`): replace `[sessionId, userAnswer, turnNumber]` with `[sessionId, userAnswer, currentQuestion]`. Remove the `turnNumber` integer property. Add `currentQuestion` as a required string property with example `"Tell me about your experience with TypeScript."`.
- **Response `200`**: add `decisionState` as a required object in the response schema with nested required properties: `detectedSkills` (array of strings), `coveredTopics` (array of strings), `remainingGaps` (array of strings), `questionRationale` (string). Add an example for both the non-complete and complete cases.
- **Response `400`**: update the error string example to `"sessionId, userAnswer, and currentQuestion are required"`.
- **Response `500`**: add a second example for the AI-specific error `"AI service unavailable. Please try again."` distinct from the generic `"Internal server error"`.
- **Description**: rewrite to describe the synchronous Claude call and structured JSON output; remove references to placeholder logic or `turnNumber`.

## Cross-cutting concerns

The following must exist before any wave-2+ tasks begin:

- **`DecisionState` and `ClaudeInterviewResponse` types** (T2): imported by `src/lib/anthropic.ts` (T4), `src/components/DecisionPanel.tsx` (T5), `src/app/api/interview/route.ts` (T6), and `src/components/InterviewRoom.tsx` (T7).
- **`Spinner` component** (T3): imported by `src/components/DecisionPanel.tsx` (T5) and `src/components/InterviewRoom.tsx` (T7).
- **`callClaudeForNextQuestion` and `buildInterviewSystemPrompt`** (T4): imported only by `src/app/api/interview/route.ts` (T6). These are server-only — never imported from a Client Component.
