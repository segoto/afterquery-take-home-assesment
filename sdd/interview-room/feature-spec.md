# Feature Spec: Interview Room

## Overview

Implement the interview room page (`/interview/[jobId]`) and its supporting infrastructure. Candidates land on this page after selecting a job. The page creates a database session tied to the selected job and the authenticated user, then orchestrates a voice-driven turn-taking interview loop. The AI question is displayed and spoken via the browser's `SpeechSynthesis` API; the candidate responds via the `SpeechRecognition` API (Chrome/Edge only). Each completed turn (AI question + user answer) is persisted as `Turn` rows in the database and appended to a live transcript panel. For this feature, AI question generation is replaced by a static hardcoded placeholder — real Claude API integration is deferred. Two new API endpoints (`POST /api/sessions` and `POST /api/interview`) are created, along with the three client components (`InterviewRoom`, `VoiceRecorder`, `TranscriptView`), a new `Badge` UI primitive, static job definitions in `src/lib/jobs.ts`, and a database seed script at `prisma/seed.ts`.

---

## Scope

**Included:**
- `src/app/interview/[jobId]/page.tsx` — React Server Component that fetches the job from the DB and passes it to the client `InterviewRoom` component
- `src/components/InterviewRoom.tsx` — Client Component with `useReducer` state machine orchestrating the turn-taking loop
- `src/components/VoiceRecorder.tsx` — Client Component encapsulating the `SpeechRecognition` lifecycle
- `src/components/TranscriptView.tsx` — Client Component rendering the ordered list of Q&A turns
- `src/app/api/sessions/route.ts` — `POST /api/sessions` handler: creates a `Session` row and returns the session id
- `src/app/api/interview/route.ts` — `POST /api/interview` handler: saves `Turn` rows and returns a hardcoded next question
- `src/lib/jobs.ts` — Static job definitions (at least 3 roles) exported as a `JOBS` constant
- `prisma/seed.ts` — Idempotent seed script that upserts all jobs from `JOBS` into the `jobs` table
- `src/components/ui/Badge.tsx` — New shared UI primitive for speaker labels; exported from `src/components/ui/index.ts`
- New TypeScript types added to `src/types/index.ts`: `Job`, `SessionStatus`, `Speaker`, `TranscriptTurn`, `InterviewRoomState`, `InterviewRoomAction`, `PostSessionResponse`, `PostInterviewResponse`
- Unsupported-browser warning for non-Chrome/Edge browsers (SpeechRecognition absent)
- Visual recording feedback (pulsing red indicator while SpeechRecognition is active)
- TTS via `SpeechSynthesis` for reading AI questions aloud (non-blocking on failure)
- Both new endpoints documented in `docs/openapi.yaml`

**Explicitly out of scope:**
- Real Claude API calls for question generation or adaptive follow-ups
- The evaluation endpoint (`/api/evaluate`) and results page (`/results/[sessionId]`)
- The job listing page (`/`) — still a placeholder scaffold page
- Any authentication implementation changes — auth is already built; this feature reads the existing cookie
- `SpeechRecognition` polyfills for unsupported browsers
- Session resume after a page refresh
- Rate limiting

---

## User Stories

- As a candidate, I want to see the job title when I arrive at the interview room so that I know which role I am being interviewed for.
- As a candidate, I want the first AI question to be displayed and spoken immediately after the session starts so that the interview begins naturally.
- As a candidate, I want to click a microphone button to start recording my answer so that I control when I speak.
- As a candidate, I want to see my spoken words appear in real time as I speak so that I know the microphone is capturing my answer correctly.
- As a candidate, I want each question and my answer appended to a transcript panel so that I can follow the interview flow.
- As a candidate, I want the next AI question displayed and spoken automatically after I finish speaking so that I do not have to navigate anywhere.
- As a candidate on Firefox or Safari, I want a clear unsupported-browser message so that I know I need to switch to Chrome or Edge.
- As a candidate whose microphone access was denied, I want a clear error message so that I know how to fix the problem.
- As a candidate, I want my answered turns persisted to the database after each exchange so that the record is not lost.

---

## Functional Requirements

### Page

1. **Route existence**: `src/app/interview/[jobId]/page.tsx` must be a Next.js App Router page (React Server Component). The `[jobId]` path segment is the cuid `id` of a `Job` row.

2. **Server-side job fetch**: The page component queries `prisma.job.findUnique({ where: { id: params.jobId } })`. If the job is not found, it renders a full-page message: `"Job not found."` with a link to `/`. If the database throws, it renders: `"Something went wrong. Please try again."` with a link to `/`.

3. **Page renders InterviewRoom**: When the job is found, the page renders `<InterviewRoom job={job} />`. The job object passed as a prop has shape `{ id, title, description }`.

### Session Creation

4. **Session creation on mount**: On mount, `InterviewRoom` dispatches a session-creation action that calls `POST /api/sessions` with `{ jobId: job.id }`. While the request is in flight, the UI shows a full-area spinner with the label `"Starting your interview…"`. The recording controls are not rendered until the session is created.

5. **Session creation success**: On success, `InterviewRoom` dispatches `SESSION_CREATED` with the returned `sessionId`, sets `currentQuestion` to the hardcoded initial question constant, and triggers `SpeechSynthesis.speak()` with that question text. The UI transitions to the `awaiting_recording` phase.

6. **Session creation failure**: On network error or non-2xx response, `InterviewRoom` dispatches `SESSION_ERROR` with an error message. The UI renders an error card with the message and a `Button` labeled `"Retry"`. Clicking the Retry button dispatches `RETRY_SESSION`. The `RETRY_SESSION` reducer handler increments `state.retryCount` by 1 and sets `state.phase` to `'session_creating'`. A `useEffect` inside `InterviewRoom` that depends on `state.retryCount` re-triggers the `POST /api/sessions` call whenever `retryCount` changes. All retry state lives in the `useReducer` — no separate `useState` is used for the retry counter.

### Browser Compatibility

7. **SpeechRecognition detection**: On mount, `VoiceRecorder` checks `typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)`. If neither is present, the component renders a warning banner with `role="alert"` reading: `"Voice interviews require Chrome or Edge. Please switch browsers to continue."` styled with an amber background. No microphone button is rendered. The rest of the page (job title, question display, transcript) remains visible.

### Voice Recording

8. **Microphone button**: A `Button` (variant `primary`) from `src/components/ui/Button` with label `"Start Recording"` is shown when `phase === 'awaiting_recording'` and the browser supports SpeechRecognition. It is disabled while `disabled` prop is true (passed from InterviewRoom when phase is not `awaiting_recording`). Clicking it calls `SpeechRecognition.start()` and dispatches `RECORDING_STARTED`.

9. **Recording visual feedback**: While `phase === 'recording'`, a pulsing red circle indicator is rendered adjacent to the microphone button. The indicator is a `<span>` with Tailwind classes `animate-pulse bg-red-500 h-3 w-3 rounded-full inline-block`. It has `aria-label="Recording in progress"` and `aria-live="polite"`. The button label changes to `"Recording…"` and the button is disabled (recording stops automatically via SpeechRecognition `onend` — the user cannot manually stop it).

10. **Interim transcript**: While recording, `SpeechRecognition.onresult` events with `isFinal === false` cause `VoiceRecorder` to call the `onInterim(text: string)` prop callback. `InterviewRoom` dispatches `INTERIM_TRANSCRIPT` and displays the interim text below the current question card in gray italic text: `<p className="text-zinc-400 italic text-sm">{ interimTranscript }</p>`.

11. **Final transcript**: When `SpeechRecognition.onresult` fires with `isFinal === true`, `VoiceRecorder` calls `onTranscript(transcript: string)` and then calls `recognition.stop()`. `InterviewRoom` dispatches `FINAL_TRANSCRIPT`, appends the current question (as an AI turn) and the transcript (as a USER turn) to `state.turns` optimistically, clears `interimTranscript`, and transitions to `processing` phase.

12. **No-result on end**: If `SpeechRecognition.onend` fires without any final result having been received (the user spoke nothing, or the audio was too short), `VoiceRecorder` calls `onError("Recording ended without a result. Please try again.")`. `InterviewRoom` dispatches `API_ERROR` with that message and transitions back to `awaiting_recording` phase.

13. **Microphone permission denied**: When `SpeechRecognition.onerror` fires with `error.error === 'not-allowed'`, `VoiceRecorder` calls `onError("Microphone access denied. Please allow microphone access in your browser settings.")`. For all other error codes, it calls `onError("Recording failed. Please try again.")`. `InterviewRoom` dispatches `API_ERROR` and transitions back to `awaiting_recording`.

### Turn Persistence

14. **POST /api/interview call**: In `processing` phase, `InterviewRoom` calls `POST /api/interview` with `{ sessionId, userAnswer: finalTranscript, turnNumber: state.turnNumber }`. A `"Thinking…"` text is displayed below the transcript panel while in flight. The microphone button is not rendered in this phase.

15. **Turn saved success**: On a `200` response, `InterviewRoom` dispatches `TURN_SAVED` with `{ nextQuestion, isComplete }`. The reducer increments `turnNumber`, sets `currentQuestion` to `nextQuestion`, and transitions to `awaiting_recording`. TTS reads `nextQuestion` aloud. If `isComplete === true`, the phase transitions to `complete` (no further action in this feature iteration — evaluation is out of scope).

16. **Turn persistence failure**: On non-200 response or network error, `InterviewRoom` dispatches `API_ERROR` with message `"Failed to save your answer. Please try again."`. The UI renders a `Card` with the error and a `Button` labeled `"Retry"` that re-submits the same turn data (the optimistically appended turns remain visible).

### API — POST /api/sessions

17. **Handler**: `src/app/api/sessions/route.ts` exports an async `POST` function.

18. **Request validation**: Parses the JSON body. If `jobId` is missing or not a non-empty string, returns `400 { "error": "jobId is required" }`.

19. **Job existence check**: Queries `prisma.job.findUnique({ where: { id: jobId } })`. If null, returns `404 { "error": "Job not found" }`.

20. **UserId extraction**: Reads the `auth_token` cookie from the request using the existing `verifyToken` (or equivalent) utility from `src/lib/auth.ts`. If the token is valid, extracts `userId = payload.sub`. If missing, invalid, or expired, sets `userId = null` (does not block the request — middleware already protects the route).

21. **Session creation**: Calls `prisma.session.create({ data: { jobId, userId, status: 'IN_PROGRESS' } })`. Returns `201 { "id": session.id }`.

22. **Error handling**: Any unexpected error returns `500 { "error": "Internal server error" }`.

### API — POST /api/interview

23. **Handler**: `src/app/api/interview/route.ts` exports an async `POST` function.

24. **PLACEHOLDER_QUESTIONS constant**: A `readonly string[]` of exactly 7 strings defined at module scope:
    - Index 0: `"Welcome! Please start by telling me about yourself and your background."`
    - Index 1: `"Can you describe a challenging project you've worked on recently?"`
    - Index 2: `"How do you approach debugging a complex issue in production?"`
    - Index 3: `"Tell me about a time you disagreed with a team member. How did you handle it?"`
    - Index 4: `"How do you prioritize tasks when you have multiple deadlines?"`
    - Index 5: `"What are you most proud of in your career so far?"`
    - Index 6: `"Do you have any questions for us?"`

25. **NEXT_QUESTION constant**: A hardcoded string returned as the next question regardless of turn: `"Thank you. Can you walk me through a specific challenge you faced in a previous role and how you resolved it?"`.

26. **Request validation**: Parses the JSON body. If `sessionId` is not a non-empty string, or `userAnswer` is not a non-empty string, or `turnNumber` is not a non-negative integer, returns `400 { "error": "sessionId, userAnswer, and turnNumber are required" }`.

27. **Session lookup**: Queries `prisma.session.findUnique({ where: { id: sessionId } })`. If null, returns `404 { "error": "Session not found" }`. If `session.status !== 'IN_PROGRESS'`, returns `409 { "error": "Session is not in progress" }`.

28. **Turn persistence**: Executes `prisma.$transaction` that creates two `Turn` rows in order:
    1. `{ sessionId, speaker: 'AI', content: PLACEHOLDER_QUESTIONS[turnNumber] ?? PLACEHOLDER_QUESTIONS[0] }`
    2. `{ sessionId, speaker: 'USER', content: userAnswer }`

29. **Response**: Returns `200 { "nextQuestion": NEXT_QUESTION, "isComplete": false }`.

30. **Error handling**: Any unexpected error returns `500 { "error": "Internal server error" }`.

### Static Jobs and Seeding

31. **lib/jobs.ts**: `src/lib/jobs.ts` exports a `JOBS` constant typed as `readonly Job[]` with at least 3 entries. Each entry has: `id` (hardcoded valid cuid), `slug` (URL-safe kebab-case string), `title` (human-readable role name), `description` (2–4 sentence role summary), `questionPack: null`. Example roles: Software Engineer, Product Manager, Data Analyst.

32. **prisma/seed.ts**: Imports `JOBS` from `src/lib/jobs.ts` and `prisma` from `src/lib/prisma`. For each job, calls `prisma.job.upsert({ where: { id: job.id }, update: {}, create: { ...job } })`. The script is idempotent — running it multiple times produces no duplicate rows.

33. **package.json seed config**: `package.json` must include `"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }` so that `npx prisma db seed` runs the script.

### Types

34. **New types in `src/types/index.ts`**:
    ```typescript
    export interface Job {
      id: string;
      slug: string;
      title: string;
      description: string;
      questionPack: unknown | null;
    }

    export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

    export type Speaker = 'AI' | 'USER';

    export interface TranscriptTurn {
      id: string;
      speaker: Speaker;
      content: string;
      createdAt: Date;
    }

    export type InterviewPhase =
      | 'session_creating'
      | 'session_error'
      | 'awaiting_recording'
      | 'recording'
      | 'processing'
      | 'api_error'
      | 'complete';

    export interface InterviewRoomState {
      phase: InterviewPhase;
      sessionId: string | null;
      currentQuestion: string;
      turns: TranscriptTurn[];
      turnNumber: number;
      errorMessage: string | null;
      interimTranscript: string;
      retryCount: number; // incremented by RETRY_SESSION to re-trigger the session creation useEffect
    }

    export type InterviewRoomAction =
      | { type: 'SESSION_CREATED'; sessionId: string }
      | { type: 'SESSION_ERROR'; message: string }
      | { type: 'RECORDING_STARTED' }
      | { type: 'INTERIM_TRANSCRIPT'; text: string }
      | { type: 'FINAL_TRANSCRIPT'; transcript: string; currentQuestion: string }
      | { type: 'TURN_SAVED'; nextQuestion: string; isComplete: boolean }
      | { type: 'API_ERROR'; message: string }
      | { type: 'RETRY_SESSION' };

    export interface PostSessionResponse {
      id: string;
    }

    export interface PostInterviewResponse {
      nextQuestion: string;
      isComplete: boolean;
    }
    ```

### Shared UI Primitives

35. **Badge component**: `src/components/ui/Badge.tsx` is created as a Client Component (`'use client'`):
    ```typescript
    interface BadgeProps {
      variant: 'ai' | 'user';
      children: React.ReactNode;
    }
    ```
    - `ai` variant: `inline-block bg-zinc-800 text-white text-xs font-medium px-2 py-0.5 rounded-full`
    - `user` variant: `inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full`
    - Exported from `src/components/ui/index.ts` alongside existing primitives.

36. **No inline styles**: No button, card, or badge styles are defined inline in any page or component. All styling is via Tailwind utility classes. All reusable elements use primitives from `src/components/ui/`.

### OpenAPI Docs

37. **docs/openapi.yaml**: Append entries for `POST /api/sessions` (tag: `sessions`) and `POST /api/interview` (tag: `interview`). Each entry includes: `summary`, `operationId`, `tags`, `description`, `requestBody` with full JSON schema, `responses` with schemas for all status codes listed in requirements 17–22 and 23–30.

---

## Non-Functional Requirements

- **Performance**: `POST /api/sessions` must respond in under 200 ms under normal DB load. `POST /api/interview` (no AI, just two DB writes) must respond in under 300 ms.
- **Security**: The `userId` field in session creation is always derived server-side from the auth cookie; the client never sends a userId and the API ignores any `userId` in the request body. No sensitive data is returned beyond `{ id: sessionId }`.
- **Browser support**: All UI except voice recording (SpeechRecognition) must render and function correctly on Chrome, Firefox, Safari, and Edge. SpeechRecognition is restricted to Chrome/Edge; the unsupported-browser banner handles all other browsers gracefully.
- **Accessibility**: Microphone button has `aria-label="Start recording"` when idle. The pulsing indicator has `aria-label="Recording in progress"` and `aria-live="polite"`. The unsupported-browser banner has `role="alert"`. Transcript turns have clear speaker labels via the `Badge` component. All `Card` and `Button` usages follow the existing accessible patterns established in `src/components/ui/`.
- **Type safety**: No `any` types anywhere in new or modified files. All component props, reducer state, and API response types are explicitly typed via types in `src/types/index.ts` or inline where local.
- **No inline styles**: All styling via Tailwind utility classes; no `style={{ }}` props.

---

## Data Model Changes

No new Prisma models and no schema migrations are required. The existing `Session` and `Turn` models (already present in `prisma/schema.prisma`) are used as-is:

```
sessions table (existing)
  id           TEXT    PK, cuid
  job_id       TEXT    FK → jobs.id
  user_id      TEXT?   FK → users.id (nullable)
  started_at   TIMESTAMP  auto now
  ended_at     TIMESTAMP? nullable
  status       ENUM    IN_PROGRESS | COMPLETED | ABANDONED

turns table (existing)
  id           TEXT    PK, cuid
  session_id   TEXT    FK → sessions.id
  speaker      ENUM    AI | USER
  content      TEXT
  created_at   TIMESTAMP  auto now
```

---

## API Contracts

### POST /api/sessions

- **Method + path**: `POST /api/sessions`
- **File**: `src/app/api/sessions/route.ts`

**Request body:**
```json
{ "jobId": "clxxx" }
```

**Success response `201`:**
```json
{ "id": "clyyyy" }
```

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "jobId is required" }` | `jobId` missing, not a string, or empty |
| 404 | `{ "error": "Job not found" }` | No `Job` row with `id === jobId` |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

### POST /api/interview

- **Method + path**: `POST /api/interview`
- **File**: `src/app/api/interview/route.ts`

**Request body:**
```json
{ "sessionId": "clyyyy", "userAnswer": "I have 5 years of experience...", "turnNumber": 0 }
```

**Success response `200`:**
```json
{
  "nextQuestion": "Thank you. Can you walk me through a specific challenge you faced in a previous role and how you resolved it?",
  "isComplete": false
}
```

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "sessionId, userAnswer, and turnNumber are required" }` | Any required field missing, wrong type, or `userAnswer` empty |
| 404 | `{ "error": "Session not found" }` | No `Session` row with `id === sessionId` |
| 409 | `{ "error": "Session is not in progress" }` | `session.status !== 'IN_PROGRESS'` |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## UI Behaviour

### `/interview/[jobId]` (Server Component Page)

**What the user sees:**
- Page title: the job title (e.g., `"Software Engineer Interview"`).
- Below the title: the `InterviewRoom` client component.

**Loading state**: Not applicable — this is a Server Component; data is fetched before the HTML is streamed. Slow DB queries will delay the initial page render.

**Error states:**
- Job not found: full-page centered message `"Job not found."` with a link styled as a button to `/`.
- Unexpected error: full-page `"Something went wrong. Please try again."` with a link to `/`.

---

### `InterviewRoom` component

**State machine phases:**

| Phase | What the user sees |
|-------|--------------------|
| `session_creating` | Full-area spinner, label `"Starting your interview…"`. No recording controls. |
| `session_error` | Error card with message, `Button` labeled `"Retry"`. |
| `awaiting_recording` | Current question in a `Card`. `TranscriptView`. `VoiceRecorder` with button enabled. |
| `recording` | Current question in `Card`. Interim transcript text below question. Pulsing indicator next to button. |
| `processing` | Current question in `Card`. `TranscriptView` with optimistic turns. `"Thinking…"` text below transcript. No button. |
| `api_error` | Current question in `Card`. `TranscriptView`. Error card with `"Retry"` button. |
| `complete` | Reserved for future — displays `"Interview complete."` text only. |

**Initial question constant**: Defined as `const INITIAL_QUESTION = "Welcome! Please start by telling me about yourself and your background."` inside `InterviewRoom.tsx`.

**TTS behavior**: Called as `window.speechSynthesis.speak(new SpeechSynthesisUtterance(questionText))` after `SESSION_CREATED` and after `TURN_SAVED`. If `window.speechSynthesis` is undefined (e.g., Firefox with TTS disabled), the call is silently skipped.

---

### `VoiceRecorder` component

**Props:**
```typescript
interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  onInterim: (text: string) => void;
  onError: (message: string) => void;
  onStart: () => void;
  disabled: boolean;
}
```

**Rendered when browser is supported (`session_creating` done):**
- A `Button` (variant `primary`, disabled when `props.disabled === true`) labeled `"Start Recording"` or `"Recording…"` when active.
- When `isRecording` internal state is true: the pulsing indicator is rendered.

**Rendered when browser is unsupported:**
- A `<div role="alert">` with amber/yellow background (`bg-amber-50 border border-amber-300 text-amber-800 rounded-md p-4`): `"Voice interviews require Chrome or Edge. Please switch browsers to continue."`. The `Button` is not rendered.

**SpeechRecognition configuration:**
- `recognition.continuous = false`
- `recognition.interimResults = true`
- `recognition.lang = 'en-US'`

**Lifecycle:**
- `recognition.onresult`: iterates results; for each `isFinal === true` result, calls `onTranscript(transcript)` and sets an internal flag `finalReceived = true`; for `isFinal === false`, calls `onInterim(interim)`.
- `recognition.onend`: if `finalReceived === false`, calls `onError("Recording ended without a result. Please try again.")`. Resets `isRecording` to false.
- `recognition.onerror`: on `'not-allowed'`, calls `onError("Microphone access denied. Please allow microphone access in your browser settings.")`. On other codes, calls `onError("Recording failed. Please try again.")`.

---

### `TranscriptView` component

**Props:**
```typescript
interface TranscriptViewProps {
  turns: TranscriptTurn[];
}
```

**Rendered structure (per turn):**
```
<div key={turn.id}>
  <Badge variant={turn.speaker === 'AI' ? 'ai' : 'user'}>
    {turn.speaker === 'AI' ? 'AI Interviewer' : 'You'}
  </Badge>
  <p>{turn.content}</p>
</div>
```

**Auto-scroll**: A `ref` is attached to the last turn element. On `turns` change, `lastTurnRef.current?.scrollIntoView({ behavior: 'smooth' })`.

**Empty state**: `<p className="text-zinc-400 text-sm">The interview will appear here.</p>`

**Container**: Scrollable `<div>` with `overflow-y-auto max-h-96` (or equivalent constrained height to avoid full-page scroll).

---

### `Badge` component (`src/components/ui/Badge.tsx`)

```typescript
interface BadgeProps {
  variant: 'ai' | 'user';
  children: React.ReactNode;
}
```

- `ai`: `inline-block bg-zinc-800 text-white text-xs font-medium px-2 py-0.5 rounded-full`
- `user`: `inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full`

---

## Edge Cases & Error Handling

1. **Invalid `jobId` in URL**: The server component's `findUnique` returns null. The page renders `"Job not found."` — the user never reaches `InterviewRoom`.

2. **Session creation network failure**: `InterviewRoom` enters `session_error` phase. A "Retry" button is shown; clicking it dispatches `RETRY_SESSION`. The reducer increments `state.retryCount` and sets `phase` to `'session_creating'`. A `useEffect` dependent on `state.retryCount` re-fires the `POST /api/sessions` call. All state is in the reducer — no separate `useState` counter is used.

3. **SpeechRecognition unavailable**: `VoiceRecorder` renders the amber warning banner. The interview cannot proceed on this browser. The job title and initial question text are still rendered (the page is usable in text-only mode, but no recording is possible).

4. **Microphone permission denied**: `SpeechRecognition.onerror` with `'not-allowed'` fires. The error message is propagated to `InterviewRoom` via `onError`. The phase returns to `awaiting_recording` so the user can try again (they may have granted permission in browser settings).

5. **Empty transcript**: `SpeechRecognition.onend` fires with no final result. `VoiceRecorder` calls `onError("Recording ended without a result. Please try again.")`. `InterviewRoom` returns to `awaiting_recording`. No turns are appended.

6. **POST /api/interview network failure or 5xx**: `InterviewRoom` enters `api_error` phase. The optimistically appended turns remain visible. A "Retry" button re-calls the same `POST /api/interview` request with the same `sessionId`, `userAnswer`, and `turnNumber`. On a retry success, an additional pair of duplicate Turn rows would be written to the DB (this is acceptable in the placeholder version; deduplication logic is deferred to the AI integration phase).

7. **POST /api/interview 404**: Rendered as an error message: `"Session not found."`. No retry is offered — the user must refresh to start a new session.

8. **POST /api/interview 409**: Rendered as: `"Your session has already ended."`. No retry.

9. **TTS failure**: If `window.speechSynthesis` is undefined or `speak()` throws, the exception is caught silently. The question is displayed in the UI regardless.

10. **`turnNumber` out of bounds in PLACEHOLDER_QUESTIONS on the server**: The handler falls back to `PLACEHOLDER_QUESTIONS[0]` for any index outside 0–6. This prevents crashes on unexpected client state.

11. **Page refresh mid-interview**: The frontend state is lost. The page reloads and creates a new session. The previous session rows and turns remain in the DB with `status: IN_PROGRESS` (orphaned — cleanup is out of scope for this feature).

12. **Multiple rapid clicks on "Start Recording"**: The button is disabled immediately after the first click (`disabled` prop set to true when `phase !== 'awaiting_recording'`), preventing double-`start()` calls.

13. **`SpeechSynthesis` speaking when new TTS is triggered**: Before calling `speak()`, call `window.speechSynthesis.cancel()` to stop any in-progress utterance. This prevents overlapping speech when questions arrive quickly.

---

## Acceptance Criteria

- [ ] Visiting `/interview/<valid-jobId>` renders the job title and the InterviewRoom component.
- [ ] Visiting `/interview/<invalid-jobId>` renders `"Job not found."` with a link to `/`.
- [ ] A database error during job fetch renders `"Something went wrong. Please try again."` with a link to `/`.
- [ ] On mount, InterviewRoom shows `"Starting your interview…"` while `POST /api/sessions` is in flight.
- [ ] After session creation succeeds, `"Welcome! Please start by telling me about yourself and your background."` is displayed as the current question.
- [ ] After session creation, TTS reads the initial question aloud (verifiable on Chrome).
- [ ] If session creation fails, an error and a "Retry" button are shown; clicking "Retry" re-attempts `POST /api/sessions`.
- [ ] On Chrome or Edge: the `"Start Recording"` button is visible and clickable in `awaiting_recording` phase.
- [ ] On Firefox or Safari: the amber unsupported-browser banner is visible instead of the recording button.
- [ ] Clicking `"Start Recording"` triggers `SpeechRecognition.start()` and the pulsing red indicator appears.
- [ ] Interim transcript text appears in real time below the current question while recording.
- [ ] When SpeechRecognition produces a final result, the AI turn (current question) and USER turn (transcript) are appended to the TranscriptView immediately.
- [ ] After a final transcript, `POST /api/interview` is called with `{ sessionId, userAnswer, turnNumber }`.
- [ ] While `POST /api/interview` is in flight, `"Thinking…"` is shown and the microphone button is not visible.
- [ ] After a successful `POST /api/interview`, `nextQuestion` is displayed and read aloud via TTS.
- [ ] The `Turn` rows for both the AI question and the user answer are present in the database after each completed turn.
- [ ] Denying microphone access shows `"Microphone access denied. Please allow microphone access in your browser settings."` and the button is re-enabled.
- [ ] If `POST /api/interview` fails, `"Failed to save your answer. Please try again."` is shown with a "Retry" button.
- [ ] Clicking "Retry" after an API failure resubmits the same turn data.
- [ ] The `TranscriptView` scrolls to show the most recently appended turn.
- [ ] `Badge` renders `"AI Interviewer"` (dark background) for AI turns and `"You"` (blue background) for user turns.
- [ ] The empty TranscriptView displays `"The interview will appear here."`.
- [ ] All buttons use `src/components/ui/Button`; no inline button styles exist.
- [ ] `InterviewRoom` state is managed entirely via `useReducer` — no `useState` for any interview phase, session, turn, or question data.
- [ ] `POST /api/sessions` returns `400` when `jobId` is missing.
- [ ] `POST /api/sessions` returns `404` when the job does not exist.
- [ ] `POST /api/sessions` returns `201 { "id": "<sessionId>" }` on success.
- [ ] `POST /api/interview` returns `400` when any required field is missing or invalid.
- [ ] `POST /api/interview` returns `404` when `sessionId` does not exist.
- [ ] `POST /api/interview` returns `409` when the session status is not `IN_PROGRESS`.
- [ ] `POST /api/interview` creates exactly two `Turn` rows per call (one AI, one USER) in a single transaction.
- [ ] `POST /api/sessions` and `POST /api/interview` are documented in `docs/openapi.yaml` with full request/response schemas.
- [ ] `src/lib/jobs.ts` exports `JOBS` with at least 3 job objects each having `id`, `slug`, `title`, `description`, `questionPack`.
- [ ] `prisma/seed.ts` exists, imports from `src/lib/jobs.ts`, and upserts jobs idempotently.
- [ ] Running `npx prisma db seed` twice results in exactly 3 (or however many JOBS has) rows in the `jobs` table — no duplicates.
- [ ] `Badge` is in `src/components/ui/Badge.tsx` and exported from `src/components/ui/index.ts`.
- [ ] New types (`Job`, `SessionStatus`, `Speaker`, `TranscriptTurn`, `InterviewPhase`, `InterviewRoomState`, `InterviewRoomAction`, `PostSessionResponse`, `PostInterviewResponse`) are exported from `src/types/index.ts`.
- [ ] No `any` type appears in any new or modified file.
- [ ] No `style={{ }}` props appear in any new component.

---

## Open Decisions

1. **INITIAL_QUESTION duplicated between frontend and backend**: `INITIAL_QUESTION` in `InterviewRoom.tsx` matches `PLACEHOLDER_QUESTIONS[0]` on the server. This duplication is intentional — when AI integration replaces the placeholder, the backend generates the first question dynamically. The frontend will then fetch it (e.g., from session creation). No extra network round-trip is introduced now for simplicity.

2. **Session created client-side on mount, not server-side**: The session represents the candidate actively starting the interview (an intentional user action). Creating it during SSR would create orphaned sessions on accidental page visits or refreshes before the user is ready.

3. **Retry after API failure re-creates duplicate Turn rows**: In the placeholder version, retrying `POST /api/interview` after a partial failure will create duplicate rows. This is acceptable for the placeholder phase. The AI integration phase will introduce idempotency keys or turn-count validation.

4. **`turnNumber` sent by client**: The client tracks `turnNumber` in the reducer state and sends it. The server uses it solely to index into `PLACEHOLDER_QUESTIONS`. This field will be replaced by server-side conversation history tracking once AI integration is added.

5. **TTS is non-blocking on failure**: TTS failure causes the question to be displayed silently without an error. Rationale: TTS is an enhancement; the interview is fully functional in text-only mode. TTS is not available in all browsers (notably some headless test environments) and should never block core functionality.

6. **`lib/jobs.ts` and `prisma/seed.ts` are in scope for this feature**: Without job data in the DB, the interview room would always render "Job not found." Seeding is prerequisite infrastructure to make the feature end-to-end testable.

7. **`userId` populated from auth cookie in POST /api/sessions**: The auth middleware guarantees a valid session for `/interview/:path*`, so the cookie is present. The handler uses `src/lib/auth.ts` to extract `userId`. On verification failure (edge case), `userId` is set to null rather than blocking the session creation — the interview should not be broken by an auth library edge case since the middleware has already validated the user.

8. **`SpeechRecognition.continuous = false`**: Setting `continuous` to false means SpeechRecognition auto-stops after a pause in speech. This matches the interview flow: the user speaks one answer, there is a pause, and recognition ends. The user clicks "Start Recording" again for the next answer.

9. **`recognition.lang = 'en-US'`**: Hard-coded to English for this assessment. Internationalization is out of scope.

10. **No `turnNumber` column in the `Turn` model**: Ordering is by `created_at` timestamp, which is sufficient for sequential interview turns written in order within a transaction. No migration is needed.

11. **Session-creation retry uses `retryCount` in the reducer, not a separate `useState`**: CLAUDE.md requires the interview state machine to live entirely in a `useReducer`. Therefore the retry counter (`retryCount`) is a field in `InterviewRoomState` and is incremented by the `RETRY_SESSION` action. A `useEffect` that lists `state.retryCount` in its dependency array re-triggers the `POST /api/sessions` fetch whenever the user clicks Retry. No `useState` is introduced for this concern.
