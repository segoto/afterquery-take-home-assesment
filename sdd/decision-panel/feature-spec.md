# Feature Spec: Decision Panel

## Overview

Replace the placeholder AI question generation in `POST /api/interview` with real Claude API calls, and surface the AI's decision-making state as a visible panel in the interview room. After each user answer, Claude returns a structured JSON object that includes the next question, whether the interview is complete, and a `decisionState` block — capturing which skills have been detected, which topics have been covered, which gaps remain, and why the AI chose its next question. The `DecisionPanel` component renders this structured state in a side panel alongside the interview controls, making the AI interviewer transparent and deterministic rather than a black box.

---

## Scope

**Included:**

- `src/lib/anthropic.ts` — New file: Anthropic client singleton + `buildInterviewSystemPrompt` function + `callClaudeForNextQuestion` function
- `src/app/api/interview/route.ts` — Modified: replace hardcoded placeholder logic with a real Claude API call; extend request/response to include `currentQuestion` and `decisionState`; update session status to `COMPLETED` when `isComplete: true`
- `prisma/schema.prisma` — Modified: add nullable `decision_state` JSON column to the `turns` table
- `src/types/index.ts` — Modified: add `DecisionState` type; extend `PostInterviewResponse` with `decisionState`; extend `InterviewRoomState` with `decisionState`; extend `InterviewRoomAction` with updated `TURN_SAVED` action
- `src/components/DecisionPanel.tsx` — New Client Component rendering the decision state panel
- `src/components/InterviewRoom.tsx` — Modified: add `currentQuestion` to the `/api/interview` request body; add `decisionState` field to state; render `DecisionPanel` in a responsive two-column layout; update reducer for `TURN_SAVED` action to include `decisionState`
- `src/app/interview/[jobId]/page.tsx` — Modified: widen layout from `max-w-2xl` to `max-w-5xl` to accommodate the two-column layout
- `src/__tests__/interview-route.test.ts` — Modified: update tests for the new request/response contract (replace `turnNumber` requirement, add `currentQuestion`, add `decisionState` to success assertion)
- `src/__tests__/Spinner.test.tsx` — New: unit tests for the Spinner component
- `src/__tests__/DecisionPanel.test.tsx` — New: unit tests for the DecisionPanel component
- `src/components/ui/Spinner.tsx` — New shared UI primitive for loading indicators; exported from `src/components/ui/index.ts`
- `docs/openapi.yaml` — Modified: update `POST /api/interview` entry to reflect new request/response contract
- `CLAUDE.md` — Modified: update the "Key constraints and decisions" bullet for `/api/interview` to reflect the synchronous JSON call (see Open Decision 1). This removes the binding contradiction between the CLAUDE.md streaming mandate and the implementation.

**Explicitly out of scope:**

- Streaming the question text character-by-character to the client (the single structured JSON call is non-streaming; streaming is deferred to a future enhancement)
- The evaluation endpoint (`/api/evaluate`) and results page (`/results/[sessionId]`) — already deferred
- Saving `decisionState` to the `Evaluation` model
- Modifying `POST /api/sessions` contract
- Displaying the decision panel on the results page (`/results/[sessionId]`)
- Internationalisation (prompt and output remain in English)
- `SpeechRecognition` polyfills

---

## User Stories

- As a candidate, I want the AI to ask me real, role-grounded questions (not hardcoded placeholders) so that the interview is relevant to the job I applied for.
- As a candidate, I want to see a live "AI Decision Panel" during the interview so that I understand why the AI is asking me each question.
- As a candidate, I want to see which skills the AI has detected from my answers so far so that I know what to elaborate on.
- As a candidate, I want to see which topics are still uncovered so that I can proactively address them in my answers.
- As a candidate, I want to see the AI's reasoning for why it picked the current question so that the process feels transparent and fair.
- As a candidate, I want the decision panel to update after each question so that I see the AI's evolving understanding.
- As a candidate, I want the decision panel to show a loading state while the AI is thinking so that I know the system is working.
- As a candidate, I want the decision panel to show an empty state before the first answer so that I understand what will appear there.
- As a candidate, I want the interview to end naturally (complete phase) after the AI has covered all required topics, indicated by `isComplete: true` from the server so that I do not have to count questions manually.

---

## Functional Requirements

### Data Model

1. **New `decision_state` column on `turns` table**: Add a nullable JSON column `decision_state` to the `turns` model in `prisma/schema.prisma`. The Prisma field name is `decisionState` (camelCase); the DB column name is `decision_state` (via `@map("decision_state")`). The column is `Json?` (nullable). It is `null` for all USER turns and for AI turns that predate this feature or represent the hardcoded initial question. For AI turns generated by Claude through this feature, it contains a serialised `DecisionState` object.

### AI Integration — lib/anthropic.ts

2. **Anthropic client singleton**: `src/lib/anthropic.ts` exports a single `Anthropic` instance created with `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`. The client must not be re-instantiated on every request. The file must NOT include `'use client'` — it is a server-only module imported only from API routes and server-side code.

3. **`buildInterviewSystemPrompt` function**: Exported from `src/lib/anthropic.ts` with signature:
   ```typescript
   function buildInterviewSystemPrompt(
     jobTitle: string,
     jobDescription: string,
     skills: Array<{ name: string; weight: number }>
   ): string
   ```
   The returned system prompt must:
   - Establish Claude as an AI interviewer for `jobTitle`
   - Include `jobDescription` verbatim
   - List skills (with weight shown as priority) as the rubric to assess
   - Instruct Claude to ask at minimum 6 questions, with at least 2 adaptive follow-ups based on the candidate's prior answers
   - Instruct Claude to respond **only** with valid JSON (no prose, no markdown fences) in the exact shape defined in requirement 5
   - Instruct Claude to set `isComplete: true` (and provide a closing statement in `question`) only after all required skills have been covered AND at least 6 questions have been asked
   - Instruct Claude to track and report `detectedSkills`, `coveredTopics`, `remainingGaps`, and `questionRationale` in every response

4. **`callClaudeForNextQuestion` function**: Exported from `src/lib/anthropic.ts` with signature:
   ```typescript
   function callClaudeForNextQuestion(
     systemPrompt: string,
     conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
   ): Promise<ClaudeInterviewResponse>
   ```
   Implementation:
   - Calls `anthropic.messages.create` with `model: 'claude-sonnet-4-6'`, `max_tokens: 1024`, the provided `systemPrompt` as `system`, and the provided `conversationHistory` as `messages`
   - Extracts the text content from the first content block of the response
   - Strips any markdown code fences (```` ```json ... ``` ````) before parsing, as per the defensive JSON parsing pattern in `docs/design-patterns.md`
   - Parses the cleaned string as JSON and validates it has the required keys
   - Returns a `ClaudeInterviewResponse` object (see requirement 5)
   - If the response text cannot be parsed as JSON at all, throws a typed error that the route handler catches (resulting in a `500` response)
   - If the JSON is parseable but missing optional sub-fields within `decisionState`, applies safe defaults (empty arrays for missing array fields, empty string for missing string fields) rather than throwing

5. **`ClaudeInterviewResponse` type**: Defined and exported in `src/types/index.ts`:
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
   The `ClaudeInterviewResponse` maps directly to what the system prompt instructs Claude to output.

### API — POST /api/interview (modified)

6. **Request body shape** (replaces current shape):
   ```json
   {
     "sessionId": "string (required, non-empty)",
     "userAnswer": "string (required, non-empty)",
     "currentQuestion": "string (required, non-empty)"
   }
   ```
   `turnNumber` is no longer required or used by the server. If included by the client it is silently ignored.

7. **Request validation**: If `sessionId` is missing or not a non-empty string, OR `userAnswer` is missing or not a non-empty string, OR `currentQuestion` is missing or not a non-empty string, return `400 { "error": "sessionId, userAnswer, and currentQuestion are required" }`.

8. **Session + job lookup**: Fetch `prisma.session.findUnique({ where: { id: sessionId }, include: { job: { include: { skills: true } } } })`. If null, return `404 { "error": "Session not found" }`. If `session.status !== 'IN_PROGRESS'`, return `409 { "error": "Session is not in progress" }`.

9. **Turn history fetch**: After session/job validation, fetch all existing turns for the session ordered by `created_at` ascending:
   ```
   prisma.turn.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } })
   ```

10. **Conversation history construction**: Build the Claude conversation history (array of `{ role, content }`) from the fetched turns:
    - AI turns (`speaker === 'AI'`) map to `{ role: 'assistant', content: turn.content }`
    - USER turns (`speaker === 'USER'`) map to `{ role: 'user', content: turn.content }`
    - If no AI turns exist in the DB (this is the first call for this session), prepend `{ role: 'assistant', content: currentQuestion }` to the history before appending the user's answer. This ensures Claude always sees the question that was answered.
    - Append `{ role: 'user', content: userAnswer }` as the last message.

11. **Save user answer (pre-Claude)**: Before calling Claude, apply the following deduplication check and then save turns to the DB:

    **Deduplication guard (retry safety)**: Before creating any turns, check whether the last fetched turn (`existingTurns[existingTurns.length - 1]`) has `speaker === 'USER'` and `content === userAnswer`. If true, the user's answer was already saved on a prior (failed) attempt. Skip all turn creates in this step and proceed directly to step 12 (the Claude call) using the history already constructed in step 10.

    If the deduplication guard does NOT skip: execute a single `prisma.$transaction` containing:
    - If no AI turns existed in `existingTurns` (first call for this session): `prisma.turn.create({ data: { sessionId, speaker: 'AI', content: currentQuestion, decisionState: null } })`
    - Always: `prisma.turn.create({ data: { sessionId, speaker: 'USER', content: userAnswer } })`

12. **Claude API call**: Build the system prompt using `buildInterviewSystemPrompt(job.title, job.description, job.skills)`. Call `callClaudeForNextQuestion(systemPrompt, conversationHistory)`.

13. **Save Claude's question**: After receiving the `ClaudeInterviewResponse`, save the AI turn:
    ```
    prisma.turn.create({
      data: {
        sessionId,
        speaker: 'AI',
        content: response.question,
        decisionState: response.decisionState  // stored as JSON
      }
    })
    ```

14. **Session completion**: If `response.isComplete === true`, also update the session status:
    ```
    prisma.session.update({ where: { id: sessionId }, data: { status: 'COMPLETED', endedAt: new Date() } })
    ```
    This update and the AI turn save are executed in a single `prisma.$transaction`.

15. **Success response** (`200`):
    ```json
    {
      "nextQuestion": "string",
      "isComplete": boolean,
      "decisionState": {
        "detectedSkills": ["string"],
        "coveredTopics": ["string"],
        "remainingGaps": ["string"],
        "questionRationale": "string"
      }
    }
    ```

16. **Claude API failure fallback**: If `callClaudeForNextQuestion` throws (parse error, network error, Anthropic API error), the route returns `500 { "error": "AI service unavailable. Please try again." }`. The turns saved in requirement 11 remain in the DB (they reflect real user answers and are not rolled back).

17. **Error handling**: Any other unexpected error returns `500 { "error": "Internal server error" }`.

### Types — src/types/index.ts

18. **New types** added to `src/types/index.ts`:
    - `DecisionState` (see requirement 5)
    - `ClaudeInterviewResponse` (see requirement 5)

19. **Modified `PostInterviewResponse`**:
    ```typescript
    export interface PostInterviewResponse {
      nextQuestion: string;
      isComplete: boolean;
      decisionState: DecisionState;
    }
    ```

20. **Modified `InterviewRoomState`**:
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
      decisionState: DecisionState | null;  // new field
    }
    ```
    `decisionState` is `null` in the initial state.

21. **Modified `InterviewRoomAction`**: The `TURN_SAVED` action gains a `decisionState` field:
    ```typescript
    | { type: 'TURN_SAVED'; nextQuestion: string; isComplete: boolean; decisionState: DecisionState | null }
    ```

### Shared UI Primitive — Spinner

22. **`src/components/ui/Spinner.tsx`**: A new Client Component (`'use client'`) with props:
    ```typescript
    interface SpinnerProps {
      'aria-label': string;
    }
    ```
    Renders:
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
    Exported from `src/components/ui/index.ts`. The inline spinner SVG in `InterviewRoom.tsx`'s `session_creating` render branch must be replaced with `<Spinner aria-label="Starting your interview…" />` to eliminate the remaining inline pattern.

### Component — DecisionPanel

23. **File**: `src/components/DecisionPanel.tsx` is a Client Component (`'use client'`).

24. **Props**:
    ```typescript
    interface DecisionPanelProps {
      decisionState: DecisionState | null;
      isLoading: boolean;
    }
    ```

25. **Loading state**: When `isLoading === true`, render a `Card` with a heading "AI Decision Panel" and `<Spinner aria-label="AI is thinking" />` (from `src/components/ui/Spinner`) centred in the card body.

26. **Empty state**: When `decisionState === null` and `isLoading === false`, render a `Card` with a heading "AI Decision Panel" and a paragraph: `"Complete your first answer to see the AI's reasoning."` in `text-zinc-400 text-sm`.

27. **Populated state**: When `decisionState` is not null and `isLoading === false`, render a `Card` with heading "AI Decision Panel" and four sections:
    - **Detected Skills**: Heading `"Detected Skills"`, then a flex-wrap row of `<Badge variant="ai">` elements, one per string in `decisionState.detectedSkills`. If the array is empty, show `<span className="text-zinc-400 text-sm">None yet</span>` instead.
    - **Topics Covered**: Heading `"Topics Covered"`, then a `<ul>` with `<li>` items for each string in `decisionState.coveredTopics`. If empty, `<span className="text-zinc-400 text-sm">None yet</span>`.
    - **Remaining Gaps**: Heading `"Remaining Gaps"`, then a `<ul>` with `<li>` items for each string in `decisionState.remainingGaps`. If empty, `<span className="text-zinc-400 text-sm text-green-600">All gaps covered</span>`.
    - **Why this question?**: Heading `"Why this question?"`, then `<p>{decisionState.questionRationale}</p>`. If the string is empty, show `<span className="text-zinc-400 text-sm">No rationale provided</span>`.

28. **Styling**: All elements use Tailwind utility classes only. Section headings use `text-xs font-semibold text-zinc-500 uppercase tracking-wide`. The card uses the existing `Card` primitive from `src/components/ui/`. No `style={{ }}` props.

29. **Accessibility**: The component renders a `<section aria-label="AI decision panel">` as its root element wrapping the `Card`. Section headings within use `<h3>`.

### Component — InterviewRoom (modified)

30. **`decisionState` field in initial state**: `decisionState: null` is added to `initialState`.

31. **`TURN_SAVED` reducer case**: The case is updated to spread `decisionState: action.decisionState` into the new state, in both the `isComplete: true` and `isComplete: false` branches.

32. **Turn submission fetch**: The `submitTurn` async function sends `currentQuestion` in the request body:
    ```json
    {
      "sessionId": "string",
      "userAnswer": "string",
      "currentQuestion": "string"
    }
    ```
    `turnNumber` is removed from the request body.

33. **`TURN_SAVED` dispatch**: On successful response, `InterviewRoom` dispatches:
    ```typescript
    dispatch({
      type: 'TURN_SAVED',
      nextQuestion: data.nextQuestion,
      isComplete: data.isComplete,
      decisionState: data.decisionState ?? null,
    })
    ```

34. **`DecisionPanel` rendering**: `InterviewRoom` renders `<DecisionPanel decisionState={state.decisionState} isLoading={state.phase === 'processing'} />` in a responsive layout alongside the main interview controls.

35. **Responsive layout**: The main interview content area and the `DecisionPanel` are arranged in a CSS grid:
    - Mobile (default): single column (`grid-cols-1`), `DecisionPanel` rendered below the main controls
    - Desktop (`lg:` breakpoint): two-column grid (`lg:grid-cols-[2fr_1fr]`), main controls on the left, `DecisionPanel` on the right

36. **Layout in all phases**: `DecisionPanel` is rendered in all phases except `session_creating` and `session_error` (where the panel is irrelevant). Specifically, it is rendered in phases: `awaiting_recording`, `recording`, `processing`, `api_error`, and `complete`.

37. **Inline spinner migration**: The inline SVG spinner in `InterviewRoom.tsx`'s `session_creating` render branch is replaced with `<Spinner aria-label="Starting your interview…" />` from `src/components/ui/Spinner`.

### Page — /interview/[jobId]/page.tsx (modified)

38. **Layout width**: Change `max-w-2xl` to `max-w-5xl` to accommodate the two-column layout introduced by the `DecisionPanel`.

### Tests

39. **`src/__tests__/Spinner.test.tsx` (new)**:
    - Test: renders a `role="status"` element with the provided `aria-label`
    - Test: the SVG child element has `aria-hidden="true"`

40. **`src/__tests__/interview-route.test.ts` (updated)**:
    - Remove all tests that assert `turnNumber` as a required field.
    - Add tests asserting `currentQuestion` is required (missing, empty string → `400 { "error": "sessionId, userAnswer, and currentQuestion are required" }`).
    - Update the success test to assert the response includes `decisionState` with the expected shape (mock the Claude call to return a fixed `ClaudeInterviewResponse`).
    - Add a test for `500 { "error": "AI service unavailable. Please try again." }` when the Claude call throws.
    - The mock for Prisma must be extended to include `turn.findMany` (returns empty array for first-turn tests) and `session.findUnique` with `include: { job: { include: { skills: true } } }`.

41. **`src/__tests__/DecisionPanel.test.tsx` (new)**:
    - Test: loading state renders `role="status"` element and heading "AI Decision Panel"
    - Test: empty state (null decisionState, not loading) renders "Complete your first answer to see the AI's reasoning."
    - Test: populated state renders all four sections with correct data
    - Test: empty `detectedSkills` array renders "None yet"
    - Test: empty `coveredTopics` array renders "None yet"
    - Test: empty `remainingGaps` array renders "All gaps covered"

42. **`src/__tests__/InterviewRoom.test.tsx` (updated)**:
    - Update `makeInterviewResponse` helper to include `decisionState` in the mock response.
    - Add test: decision panel renders in `awaiting_recording` phase.
    - Add test: decision panel shows loading state in `processing` phase.
    - Add test: decision panel shows decisionState data after `TURN_SAVED`.
    - Existing tests must continue to pass (the mock interview response now includes `decisionState`).

---

## Non-Functional Requirements

- **Performance**: The Claude API call adds latency. The `POST /api/interview` endpoint will take 2–8 s end-to-end depending on Claude response time. The UI must show the `DecisionPanel` in loading state (`isLoading === true`) during the entire `processing` phase so the user sees feedback.
- **Security**: The Anthropic API key is never exposed to the client. It is read only from `process.env.ANTHROPIC_API_KEY` in `src/lib/anthropic.ts`. The `callClaudeForNextQuestion` function is called only from the API route (server-side).
- **Defensive parsing**: Claude output must always be parsed with the fence-stripping pattern from `docs/design-patterns.md`. Missing keys in the parsed JSON must fall back to safe defaults: `detectedSkills: []`, `coveredTopics: []`, `remainingGaps: []`, `questionRationale: ''`, `isComplete: false`. Only a completely unparseable response triggers the `500` error.
- **Browser support**: `DecisionPanel` is a pure render component with no browser APIs. It must render correctly on Chrome, Firefox, Safari, and Edge.
- **Accessibility**: `DecisionPanel` root element is `<section aria-label="AI decision panel">`. Section headings are `<h3>`. The `Spinner` component is rendered with `aria-label="AI is thinking"` and carries `role="status"`. Empty-state messages use standard paragraph elements.
- **Type safety**: No `any` types in new or modified files. `DecisionState` and `ClaudeInterviewResponse` are defined in `src/types/index.ts`.
- **No inline styles**: All styling via Tailwind utility classes; no `style={{ }}` props.

---

## Data Model Changes

**Modified model: `Turn`**

Add one new nullable JSON field:

```
turns table
  id             TEXT     PK, cuid
  session_id     TEXT     FK → sessions.id
  speaker        ENUM     AI | USER
  content        TEXT
  decision_state JSONB?   nullable  ← NEW
  created_at     TIMESTAMP  auto now
```

Prisma schema change:
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

A migration is required: `npx prisma migrate dev --name add-decision-state-to-turns`.

The `decision_state` column is nullable, so no backfill is needed for existing rows.

---

## API Contracts

### POST /api/interview (modified)

- **Method + path**: `POST /api/interview`
- **File**: `src/app/api/interview/route.ts`

**Request body:**
```json
{
  "sessionId": "clxxx",
  "userAnswer": "I have 5 years of experience with TypeScript...",
  "currentQuestion": "Tell me about your experience with TypeScript."
}
```

**Success response `200`:**
```json
{
  "nextQuestion": "You mentioned distributed systems — can you walk me through how you'd design a rate limiter?",
  "isComplete": false,
  "decisionState": {
    "detectedSkills": ["TypeScript", "API Design"],
    "coveredTopics": ["Background", "Technical Experience"],
    "remainingGaps": ["System Design", "Team Collaboration"],
    "questionRationale": "Candidate demonstrated TypeScript fluency. Probing system design gap next."
  }
}
```

**Final question response `200` (when `isComplete: true`):**
```json
{
  "nextQuestion": "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.",
  "isComplete": true,
  "decisionState": {
    "detectedSkills": ["TypeScript", "API Design", "System Design", "Team Collaboration"],
    "coveredTopics": ["Background", "Technical Experience", "System Design", "Collaboration & Leadership"],
    "remainingGaps": [],
    "questionRationale": "All required skills have been assessed and at least 6 questions asked. Closing the interview."
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "sessionId, userAnswer, and currentQuestion are required" }` | Any required field missing, not a string, or empty |
| 404 | `{ "error": "Session not found" }` | No `Session` row with `id === sessionId` |
| 409 | `{ "error": "Session is not in progress" }` | `session.status !== 'IN_PROGRESS'` |
| 500 | `{ "error": "AI service unavailable. Please try again." }` | Claude API call or response parse fails |
| 500 | `{ "error": "Internal server error" }` | Any other unexpected failure |

---

## UI Behaviour

### `DecisionPanel` component

**Loading state** (`isLoading === true`):
- Renders a `Card` with heading "AI Decision Panel"
- Below the heading: `<Spinner aria-label="AI is thinking" />` from `src/components/ui/Spinner`, centred in the card body

**Empty state** (`decisionState === null`, `isLoading === false`):
- Renders a `Card` with heading "AI Decision Panel"
- Below the heading: `<p className="text-zinc-400 text-sm">Complete your first answer to see the AI's reasoning.</p>`

**Populated state** (`decisionState !== null`, `isLoading === false`):
- Renders a `Card` with heading "AI Decision Panel"
- Section 1 — **Detected Skills**: `<h3>` label, then flex-wrap row of `<Badge variant="ai">` per skill
- Section 2 — **Topics Covered**: `<h3>` label, then `<ul>` of `<li>` items
- Section 3 — **Remaining Gaps**: `<h3>` label, then `<ul>` of `<li>` items (green "All gaps covered" if empty)
- Section 4 — **Why this question?**: `<h3>` label, then `<p>` with rationale text

### `InterviewRoom` component (layout change)

**Phases where `DecisionPanel` is rendered**: `awaiting_recording`, `recording`, `processing`, `api_error`, `complete`

**Layout (responsive grid)**:
```
mobile (< lg):
  ┌──────────────────────────────┐
  │  Current question card       │
  │  Transcript view             │
  │  Voice recorder / controls   │
  ├──────────────────────────────┤
  │  Decision Panel              │
  └──────────────────────────────┘

desktop (≥ lg):
  ┌───────────────────────┬──────────────────┐
  │  Current question     │  Decision Panel  │
  │  Transcript view      │                  │
  │  Voice recorder       │                  │
  └───────────────────────┴──────────────────┘
```

The `DecisionPanel` passes `isLoading={state.phase === 'processing'}` so it shows the spinner while the Claude API call is in flight.

### `/interview/[jobId]/page.tsx`

`max-w-2xl` becomes `max-w-5xl` to give the two-column layout room. All other content (heading, back link) remains unchanged.

---

## Edge Cases & Error Handling

1. **Claude returns malformed JSON (cannot parse)**: `callClaudeForNextQuestion` throws. The route catches the error and returns `500 { "error": "AI service unavailable. Please try again." }`. The user answer was already saved to the DB (turns saved in step 11 are not rolled back). The client shows an error card with a "Retry" button, which re-submits the same `{ sessionId, userAnswer, currentQuestion }`. On retry, the server fetches existing turns from DB; the user's answer turn is now there, so the history is consistent and Claude is called again.

2. **Claude returns JSON missing some `decisionState` fields**: `callClaudeForNextQuestion` fills in defaults: missing arrays default to `[]`, missing string fields default to `''`, missing `isComplete` defaults to `false`. This prevents crashes when Claude partially respects the schema.

3. **Claude API rate limit (429) or timeout**: Anthropic SDK throws a typed error. The route catches it and returns `500 { "error": "AI service unavailable. Please try again." }`.

4. **First turn: no AI turns in DB yet**: The server detects `existingTurns.filter(t => t.speaker === 'AI').length === 0` and saves `currentQuestion` (the hardcoded initial greeting) as the first AI turn with `decisionState: null`. This ensures the conversation history is complete in the DB from the start.

5. **Retry after Claude failure causes duplicate user answer save**: On the first attempt, the USER turn was saved to the DB. On retry, the server fetches all existing turns — which now includes the USER turn. The server must detect that the latest turn in the DB is already a USER turn (meaning the current user answer was already saved) and skip the USER turn save to avoid duplication. Detection logic: `const lastTurn = existingTurns[existingTurns.length - 1]; const userAnswerAlreadySaved = lastTurn?.speaker === 'USER' && lastTurn?.content === userAnswer`. If true, skip the USER turn create.

6. **Job has no skills in the DB**: `buildInterviewSystemPrompt` receives an empty `skills` array. The system prompt falls back to deriving skills from the job description text alone. Claude still generates reasonable questions; the `detectedSkills` and `remainingGaps` in the decision state will be AI-inferred rather than pre-seeded from a rubric.

7. **`isComplete: true` on the very first turn**: This should not happen (Claude is instructed to ask ≥6 questions), but if it does, the session is marked `COMPLETED`, the client transitions to `complete` phase, and the final decision state is displayed with all gaps covered.

8. **`DecisionPanel` renders with empty arrays**: All sections that receive empty arrays gracefully show their fallback text ("None yet" or "All gaps covered"). No uncaught errors.

9. **`ANTHROPIC_API_KEY` environment variable missing**: `callClaudeForNextQuestion` will throw an Anthropic SDK authentication error. The route returns `500 { "error": "AI service unavailable. Please try again." }`. A startup check or health endpoint is out of scope.

10. **`turnNumber` sent by client in request body**: The server silently ignores it. No validation error is returned. Backward compatibility is maintained if a stale client build sends it.

---

## Acceptance Criteria

- [ ] `prisma/schema.prisma` has `decisionState Json? @map("decision_state")` on the `Turn` model
- [ ] A migration file exists for `add-decision-state-to-turns`
- [ ] `src/lib/anthropic.ts` exports `anthropic` (singleton), `buildInterviewSystemPrompt`, and `callClaudeForNextQuestion`
- [ ] `callClaudeForNextQuestion` strips markdown fences before `JSON.parse`
- [ ] `callClaudeForNextQuestion` fills in safe defaults for any missing `decisionState` fields
- [ ] `DecisionState` and `ClaudeInterviewResponse` types are exported from `src/types/index.ts`
- [ ] `PostInterviewResponse` includes `decisionState: DecisionState`
- [ ] `InterviewRoomState` includes `decisionState: DecisionState | null` initialised to `null`
- [ ] `TURN_SAVED` action includes `decisionState: DecisionState | null`
- [ ] `POST /api/interview` returns `400` when `currentQuestion` is missing or empty
- [ ] `POST /api/interview` returns `400` with message `"sessionId, userAnswer, and currentQuestion are required"` for any missing required field
- [ ] `POST /api/interview` no longer requires `turnNumber`
- [ ] `POST /api/interview` returns `404` when `sessionId` does not exist
- [ ] `POST /api/interview` returns `409` when `session.status !== 'IN_PROGRESS'`
- [ ] `POST /api/interview` calls Claude via `callClaudeForNextQuestion` and returns `decisionState` in the `200` response
- [ ] `POST /api/interview` saves the initial hardcoded question as an AI Turn (with `decisionState: null`) on the first call for a session
- [ ] `POST /api/interview` saves the user's answer as a USER Turn before calling Claude
- [ ] `POST /api/interview` saves Claude's question as an AI Turn with `decisionState` populated
- [ ] `POST /api/interview` marks session `COMPLETED` and sets `endedAt` when `isComplete: true`
- [ ] `POST /api/interview` returns `500 { "error": "AI service unavailable. Please try again." }` when Claude call fails
- [ ] `POST /api/interview` skips USER turn save on retry if the same user answer is already the last turn in DB
- [ ] `src/components/ui/Spinner.tsx` exists as a Client Component exported from `src/components/ui/index.ts`
- [ ] `Spinner` renders an SVG `animate-spin` element with `role="status"` and the provided `aria-label`
- [ ] `InterviewRoom.tsx` `session_creating` render branch uses `<Spinner aria-label="Starting your interview…" />` instead of an inline SVG
- [ ] `src/components/DecisionPanel.tsx` exists as a Client Component with props `{ decisionState: DecisionState | null; isLoading: boolean }`
- [ ] `DecisionPanel` renders `<Spinner aria-label="AI is thinking" />` and "AI Decision Panel" heading when `isLoading === true`
- [ ] `DecisionPanel` renders empty state text when `decisionState === null` and not loading
- [ ] `DecisionPanel` renders "Detected Skills" section with `Badge` elements per skill
- [ ] `DecisionPanel` renders "Topics Covered" section as a list
- [ ] `DecisionPanel` renders "Remaining Gaps" section as a list, with "All gaps covered" when empty
- [ ] `DecisionPanel` renders "Why this question?" section with rationale text
- [ ] `DecisionPanel` root element is `<section aria-label="AI decision panel">`
- [ ] `DecisionPanel` uses `Card`, `Badge`, and `Spinner` from `src/components/ui/` for shared primitives
- [ ] `InterviewRoom` sends `currentQuestion` (and omits `turnNumber`) in the `POST /api/interview` request
- [ ] `InterviewRoom` reducer handles `TURN_SAVED` with `decisionState` and updates `state.decisionState`
- [ ] `InterviewRoom` renders `DecisionPanel` in `awaiting_recording`, `recording`, `processing`, `api_error`, and `complete` phases
- [ ] `InterviewRoom` passes `isLoading={state.phase === 'processing'}` to `DecisionPanel`
- [ ] `InterviewRoom` layout uses a responsive grid: single column on mobile, `lg:grid-cols-[2fr_1fr]` on desktop
- [ ] `/interview/[jobId]/page.tsx` uses `max-w-5xl` layout container
- [ ] `src/__tests__/interview-route.test.ts` is updated and all tests pass
- [ ] `src/__tests__/DecisionPanel.test.tsx` exists and all tests pass
- [ ] `src/__tests__/InterviewRoom.test.tsx` is updated and all existing tests pass
- [ ] `docs/openapi.yaml` `POST /api/interview` entry is updated with the new request/response schema
- [ ] No `any` types in any new or modified file
- [ ] No `style={{ }}` props in any new or modified component
- [ ] `ANTHROPIC_API_KEY` is read only from `process.env.ANTHROPIC_API_KEY` server-side
- [ ] `CLAUDE.md` "Key constraints and decisions" bullet for `/api/interview` is updated to document the synchronous JSON call (replacing the streaming mandate)

---

## Open Decisions

1. **Non-streaming Claude call — requires CLAUDE.md update**: CLAUDE.md's "Key constraints and decisions" section mandates `stream: true` on `/api/interview`. This feature deliberately uses a non-streaming call to enable structured JSON output (question + decision state in a single parseable response). Streaming the question text is only useful when the raw text is rendered incrementally; here, both the question text and the decision-state panel must update atomically after Claude finishes, making streaming incompatible. The implementer must update the relevant bullet in CLAUDE.md to read: "`POST /api/interview` uses a synchronous (non-streaming) Anthropic call returning structured JSON (`{ question, isComplete, decisionState }`); streaming is reserved for future plain-text-only endpoints." This keeps CLAUDE.md authoritative and removes the contradiction for all future agents and developers.

2. **`currentQuestion` sent by client**: The server could reconstruct the current question from the DB (as the last AI turn), but on the first turn there is no AI turn in the DB yet. Sending `currentQuestion` from the client is simpler and avoids a conditional look-ahead fetch. The server validates it as a non-empty string.

3. **No streaming response format**: The system prompt instructs Claude to output only valid JSON, with no prose. This prevents partial renders and makes parsing deterministic. Future improvements could use Claude's extended thinking or tool-use APIs for even more structured output.

4. **`decision_state` stored on AI turns**: Storing the decision state on the AI Turn (rather than a separate model) keeps the data co-located with the question it pertains to, simplifies queries for the results page, and avoids an extra join. The nullable column means USER turns are unaffected.

5. **Session status set to COMPLETED when `isComplete: true`**: The evaluation endpoint is out of scope, but marking the session completed ensures the 409 guard on subsequent calls to `POST /api/interview` works correctly. The `endedAt` timestamp is set at this point.

6. **Retry deduplication by checking last USER turn content**: On retry, the server checks if the latest turn in the DB is a USER turn with the same content as `userAnswer`. This is a content-match heuristic rather than an idempotency key. It is sufficient for the interview use case (a candidate is unlikely to give identical answers on retry) and avoids adding an `idempotency_key` column to the schema.

7. **Initial question saved with `decisionState: null`**: The initial hardcoded question is displayed by the client without any AI involvement, so there is no decision state to associate with it. Saving it with `null` preserves the full conversation history in the DB while accurately representing that no AI decision was made for the opening question.

8. **`max-w-5xl` page width**: The two-column layout (2fr main + 1fr panel) needs horizontal space. `max-w-5xl` (64 rem) gives the decision panel enough room (~20 rem) while keeping the main interview area comfortable. On smaller screens the single-column stack takes priority.
