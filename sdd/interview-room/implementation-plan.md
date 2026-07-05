# Implementation Plan: Interview Room

## Overview

This plan implements the `/interview/[jobId]` interview room feature end-to-end: two API routes (`POST /api/sessions` and `POST /api/interview`), three client components (`InterviewRoom`, `VoiceRecorder`, `TranscriptView`), a `Badge` UI primitive, shared TypeScript types, static job definitions in `src/lib/jobs.ts`, and an idempotent Prisma seed script. Real Claude API calls are deferred — the AI question handler returns placeholder questions for this iteration.

## Prerequisites

- The Prisma schema already contains all required models (`Job`, `Session`, `Turn`) with correct `@map` snake_case annotations. No new migration is needed.
- `DATABASE_URL` must be set in `.env` so `npx prisma db seed` can run after T8 is complete.
- `ts-node` is not yet in `package.json`. T8 must install it as a devDependency (`npm install --save-dev ts-node`) so the Prisma seed script can run.
- The auth middleware in `src/middleware.ts` already protects `/interview/:path*`, so no middleware changes are needed.

## Task Graph

| Task | Wave | Type     | Description                                                          | Depends on     |
|------|------|----------|----------------------------------------------------------------------|----------------|
| T1   | 1    | backend  | Add interview-room shared types to `src/types/index.ts`             | —              |
| T2   | 1    | frontend | Create `Badge` UI primitive and update `src/components/ui/index.ts` | —              |
| T3   | 2    | backend  | Create `src/lib/jobs.ts` with `JOBS` constant (3 roles)             | T1             |
| T4   | 2    | backend  | Create `src/app/api/sessions/route.ts` — `POST /api/sessions`       | T1             |
| T5   | 2    | backend  | Create `src/app/api/interview/route.ts` — `POST /api/interview`     | T1             |
| T6   | 2    | frontend | Create `src/components/TranscriptView.tsx`                          | T1, T2         |
| T7   | 2    | frontend | Create `src/components/VoiceRecorder.tsx`                           | T1             |
| T8   | 3    | backend  | Create `prisma/seed.ts` and update `package.json` seed config       | T3             |
| T9   | 3    | backend  | Update `docs/openapi.yaml` with `/api/sessions` and `/api/interview` | T4, T5        |
| T10  | 3    | frontend | Create `src/components/InterviewRoom.tsx`                            | T1, T2, T6, T7 |
| T11  | 4    | frontend | Create `src/app/interview/[jobId]/page.tsx`                          | T10            |

Wave 1 tasks (T1, T2) are fully independent. Wave 2 tasks (T3–T7) start only after both Wave 1 tasks complete. Wave 3 tasks (T8, T9, T10) start after all Wave 2 tasks complete. Wave 4 task (T11) starts after all Wave 3 tasks complete.

---

## Task Details

### T1: Add interview-room shared types to `src/types/index.ts`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — append the new interview-room types below the existing auth types; do not remove or alter the existing exports
- **Implementation notes**:
  Append the following exact exports to the existing file (after the last existing export). Use `readonly` and specific literal union types where the spec mandates them. The `InterviewRoomState` `retryCount` field drives the session-creation retry `useEffect` in `InterviewRoom` — it must live in the reducer state, not a separate `useState`. The `questionPack` field on `Job` is typed `unknown | null` (not `Json`) to avoid a Prisma-generated-type import in shared types.

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
    retryCount: number;
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

- **Testing**:
  - Unit: No runtime logic to test. Run `npx tsc --noEmit` to confirm no type errors are introduced.
  - Integration: Downstream tasks (T3, T4, T5, T6, T7, T10) import from this file — type errors in those tasks indicate a problem here.
  - Manual: N/A.

---

### T2: Create `Badge` UI primitive

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/Badge.tsx` — new file; `'use client'` directive at top
  - `src/components/ui/index.ts` — add `export { Badge } from './Badge';` line
- **Implementation notes**:
  The component accepts `variant: 'ai' | 'user'` and `children: React.ReactNode`. No other props. Apply Tailwind classes directly in the JSX render — no dynamic class merging needed since there are only two variants. Exact Tailwind classes per variant:
  - `ai`: `inline-block bg-zinc-800 text-white text-xs font-medium px-2 py-0.5 rounded-full`
  - `user`: `inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full`

  The component renders a `<span>` (not a `<div>`) since it is inline within a transcript turn row. No `style={{}}` props, no `any` type. Follow the same structure as `src/components/ui/Card.tsx` (named export, explicit interface, `'use client'` directive).

- **Testing**:
  - Unit: Create `src/__tests__/Badge.test.tsx` with `@jest-environment jsdom` annotation. Test: renders children for `ai` variant; renders children for `user` variant; `ai` variant has `bg-zinc-800` class; `user` variant has `bg-blue-100` class; `user` variant has `text-blue-800` class.
  - Integration: `TranscriptView` (T6) imports `Badge` — type errors there indicate a problem here.
  - Manual: Verify in browser by navigating to the interview room after all tasks complete and confirming AI turns show a dark badge and user turns show a blue badge.

---

### T3: Create `src/lib/jobs.ts`

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/lib/jobs.ts` — new file; exports `JOBS` constant
- **Implementation notes**:
  Import `Job` from `@/types`. Declare `JOBS` as `readonly Job[]`. Use three hardcoded cuid-format string IDs (e.g. `clswe0001000000000000000001`). Each entry needs `id`, `slug` (kebab-case), `title`, `description` (2–4 sentence summary), `questionPack: null`.

  Suggested three roles:
  1. `{ id: 'clswe0001000000000000000001', slug: 'software-engineer', title: 'Software Engineer', description: 'Build and maintain scalable backend services and APIs. Collaborate with product and design to deliver features end-to-end. Debug complex issues in distributed systems. Write clean, well-tested TypeScript and Node.js code.', questionPack: null }`
  2. `{ id: 'clspm0002000000000000000002', slug: 'product-manager', title: 'Product Manager', description: 'Define product vision and roadmap in collaboration with engineering and design. Translate user research into actionable requirements and acceptance criteria. Prioritize the backlog to maximize customer and business value. Drive alignment across cross-functional stakeholders.', questionPack: null }`
  3. `{ id: 'clsda0003000000000000000003', slug: 'data-analyst', title: 'Data Analyst', description: 'Transform raw data into actionable insights using SQL and Python. Build dashboards and reports that inform strategic decisions. Identify trends and anomalies in large datasets. Partner with engineering to ensure data quality and pipeline reliability.', questionPack: null }`

  No runtime logic — just a constant. No `any` types.

- **Testing**:
  - Unit: Create `src/__tests__/jobs.test.ts`. Verify: `JOBS` has length ≥ 3; every entry has non-empty `id`, `slug`, `title`, `description`; every `id` is unique; every `slug` is unique; `questionPack` is `null` for all entries.
  - Integration: `prisma/seed.ts` (T8) imports `JOBS` — failures there indicate a problem here.
  - Manual: After running `npx prisma db seed`, verify 3 rows exist in `jobs` table via `npx prisma studio`.

---

### T4: Create `POST /api/sessions` route

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/sessions/route.ts` — new file
- **Implementation notes**:
  Follow the existing pattern in `src/app/api/auth/login/route.ts`: single exported `POST` function, typed return `Promise<NextResponse<T | ApiErrorResponse>>`. Import `prisma` from `@/lib/prisma`, `verifyToken` from `@/lib/auth`, types from `@/types`.

  Implementation steps in order:
  1. Wrap entire body in `try/catch`; catch returns `500 { error: 'Internal server error' }`.
  2. Parse `request.json()`. If it throws, return `500`.
  3. Validate: if `jobId` is missing, not a string, or empty string → `400 { error: 'jobId is required' }`.
  4. Query `prisma.job.findUnique({ where: { id: jobId } })`. If null → `404 { error: 'Job not found' }`.
  5. Extract `userId`: read `request.cookies.get('auth_token')?.value`, call `await verifyToken(token ?? '')`. If valid, `userId = payload.sub`. If invalid/missing, `userId = null`. **Never block** on auth failure — middleware already verified the cookie; this is a defensive fallback.
  6. Call `prisma.session.create({ data: { jobId, userId, status: 'IN_PROGRESS' } })`.
  7. Return `NextResponse.json({ id: session.id }, { status: 201 })`.

  The response shape is `PostSessionResponse` (`{ id: string }`) on success. No `userId` is read from the request body — only from the cookie.

- **Testing**:
  - Unit: Create `src/__tests__/sessions.test.ts` using `jest.unstable_mockModule` pattern (same as `src/__tests__/signup.test.ts`). Mock `@/lib/prisma` (job.findUnique, session.create), `@/lib/auth` (verifyToken). Test cases:
    - Returns `400` when `jobId` missing
    - Returns `400` when `jobId` is empty string
    - Returns `400` when `jobId` is not a string
    - Returns `404` when `job.findUnique` returns null
    - Returns `201 { id }` on success
    - Sets `userId` from cookie when `verifyToken` succeeds
    - Sets `userId = null` when `verifyToken` returns null
    - Returns `500` on unexpected error from `session.create`
  - Integration: Start dev server; call `POST http://localhost:3000/api/sessions` with valid auth cookie and valid jobId from seeded data; verify 201 response and new session row in DB.
  - Manual: Visit `/interview/<valid-jobId>` while logged in; verify session row is created (Prisma Studio).

---

### T5: Create `POST /api/interview` route

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — new file
- **Implementation notes**:
  Follow the same route handler pattern. Import `prisma` from `@/lib/prisma`, types from `@/types`.

  At module scope, define:
  ```typescript
  const PLACEHOLDER_QUESTIONS: readonly string[] = [
    "Welcome! Please start by telling me about yourself and your background.",
    "Can you describe a challenging project you've worked on recently?",
    "How do you approach debugging a complex issue in production?",
    "Tell me about a time you disagreed with a team member. How did you handle it?",
    "How do you prioritize tasks when you have multiple deadlines?",
    "What are you most proud of in your career so far?",
    "Do you have any questions for us?",
  ] as const;

  const NEXT_QUESTION =
    "Thank you. Can you walk me through a specific challenge you faced in a previous role and how you resolved it?";
  ```

  Implementation steps in order:
  1. Outer `try/catch`; catch returns `500`.
  2. Parse `request.json()`.
  3. Validate: `sessionId` must be a non-empty string; `userAnswer` must be a non-empty string; `turnNumber` must be a non-negative integer (`Number.isInteger(n) && n >= 0`). If any fails → `400 { error: 'sessionId, userAnswer, and turnNumber are required' }`.
  4. Query `prisma.session.findUnique({ where: { id: sessionId } })`. If null → `404 { error: 'Session not found' }`.
  5. If `session.status !== 'IN_PROGRESS'` → `409 { error: 'Session is not in progress' }`.
  6. `const questionContent = PLACEHOLDER_QUESTIONS[turnNumber] ?? PLACEHOLDER_QUESTIONS[0];`
  7. Execute `prisma.$transaction([...])` that creates two Turn rows sequentially: first `{ sessionId, speaker: 'AI', content: questionContent }`, then `{ sessionId, speaker: 'USER', content: userAnswer }`.
  8. Return `200 { nextQuestion: NEXT_QUESTION, isComplete: false }`.

  The `turnNumber` from the client indexes into `PLACEHOLDER_QUESTIONS` to select which question was asked. Out-of-bounds index falls back to index 0 to prevent crashes.

- **Testing**:
  - Unit: Create `src/__tests__/interview-route.test.ts` using `jest.unstable_mockModule`. Mock `@/lib/prisma` (session.findUnique, $transaction). Test cases:
    - Returns `400` when `sessionId` missing
    - Returns `400` when `userAnswer` is empty string
    - Returns `400` when `turnNumber` is not an integer (e.g. `1.5`)
    - Returns `400` when `turnNumber` is negative
    - Returns `404` when session not found
    - Returns `409` when session status is `COMPLETED`
    - Returns `409` when session status is `ABANDONED`
    - Returns `200 { nextQuestion, isComplete: false }` on success
    - Calls `$transaction` with two Turn creates when successful
    - `PLACEHOLDER_QUESTIONS[0]` is used when `turnNumber` is out of bounds (e.g. 999)
    - Returns `500` on unexpected error
  - Integration: With a valid `IN_PROGRESS` session, `POST /api/interview` with `{ sessionId, userAnswer: 'test answer', turnNumber: 0 }`; verify 2 Turn rows in DB.
  - Manual: Complete one voice turn in the interview room and verify turns in Prisma Studio.

---

### T6: Create `TranscriptView` component

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/TranscriptView.tsx` — new file; `'use client'` directive
- **Implementation notes**:
  Import `TranscriptTurn` from `@/types`. Import `Badge` from `@/components/ui`. Props interface:
  ```typescript
  interface TranscriptViewProps {
    turns: TranscriptTurn[];
  }
  ```

  Structure:
  - Container `<div>` with `overflow-y-auto max-h-96 flex flex-col gap-4` classes.
  - When `turns` is empty: render `<p className="text-zinc-400 text-sm">The interview will appear here.</p>`.
  - For each turn, render:
    ```tsx
    <div key={turn.id} className="flex flex-col gap-1">
      <Badge variant={turn.speaker === 'AI' ? 'ai' : 'user'}>
        {turn.speaker === 'AI' ? 'AI Interviewer' : 'You'}
      </Badge>
      <p className="text-zinc-900 text-sm">{turn.content}</p>
    </div>
    ```
  - Attach a `ref` (`useRef<HTMLDivElement>(null)`) to the last turn's wrapper `<div>`. Use a `useEffect` that depends on `[turns]` and calls `lastTurnRef.current?.scrollIntoView({ behavior: 'smooth' })` whenever turns change. Use `useRef` array indexing or a single ref for the last element using a callback ref pattern — whichever is simpler. The simplest approach: maintain a single `useRef` and conditionally assign it to the last rendered turn using `ref={i === turns.length - 1 ? lastTurnRef : undefined}`.

  No `any` types. No `style={{}}`.

- **Testing**:
  - Unit: Create `src/__tests__/TranscriptView.test.tsx` with `@jest-environment jsdom`. Test cases:
    - Renders empty state message when `turns` is empty array
    - Renders correct number of turn items for a populated `turns` array
    - AI turn renders `'AI Interviewer'` label with dark badge class
    - User turn renders `'You'` label with blue badge class
    - Turn content text is rendered
  - Manual: Start an interview; verify transcript panel shows turns in order as they are added; verify panel scrolls to newest turn.

---

### T7: Create `VoiceRecorder` component

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/VoiceRecorder.tsx` — new file; `'use client'` directive
- **Implementation notes**:
  This component is entirely self-contained for SpeechRecognition lifecycle. Import `Button` from `@/components/ui`.

  Props interface (define inline in the file — not exported from types since it is component-local):
  ```typescript
  interface VoiceRecorderProps {
    onTranscript: (transcript: string) => void;
    onInterim: (text: string) => void;
    onError: (message: string) => void;
    onStart: () => void;
    disabled: boolean;
  }
  ```

  Internal state: `isRecording` (boolean, `useState`). Refs: `recognitionRef` (`useRef<InstanceType<typeof SpeechRecognition> | null>(null)`), `finalReceivedRef` (`useRef<boolean>(false)`).

  **Browser support detection**: Compute at component render time (inside the component function, not at module scope, to avoid SSR issues):
  ```typescript
  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
      : null;
  const isSupported = SpeechRecognitionAPI !== null;
  ```

  **Unsupported browser render**: When `!isSupported`, return:
  ```tsx
  <div role="alert" className="bg-amber-50 border border-amber-300 text-amber-800 rounded-md p-4">
    Voice interviews require Chrome or Edge. Please switch browsers to continue.
  </div>
  ```

  **Supported browser render**:
  ```tsx
  <div className="flex items-center gap-3">
    <Button
      variant="primary"
      disabled={props.disabled || isRecording}
      aria-label="Start recording"
      onClick={handleStart}
    >
      {isRecording ? 'Recording…' : 'Start Recording'}
    </Button>
    {isRecording && (
      <span
        className="animate-pulse bg-red-500 h-3 w-3 rounded-full inline-block"
        aria-label="Recording in progress"
        aria-live="polite"
      />
    )}
  </div>
  ```

  **`handleStart` function**:
  ```typescript
  function handleStart() {
    if (!SpeechRecognitionAPI) return;
    finalReceivedRef.current = false;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalReceivedRef.current = true;
          props.onTranscript(result[0].transcript);
          recognition.stop();
        } else {
          props.onInterim(result[0].transcript);
        }
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (!finalReceivedRef.current) {
        props.onError('Recording ended without a result. Please try again.');
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        props.onError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        props.onError('Recording failed. Please try again.');
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    props.onStart();
  }
  ```

  Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` only if TypeScript cannot resolve the SpeechRecognition types from `@types/dom-speech-recognition`. Do NOT use `any` — use the proper DOM types. The SpeechRecognition types are included in the standard `lib.dom.d.ts` TypeScript library. If the TypeScript compiler reports missing types for `window.SpeechRecognition`, use a type assertion cast: `(window as Window & typeof globalThis & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition`.

- **Testing**:
  - Unit: Create `src/__tests__/VoiceRecorder.test.tsx` with `@jest-environment jsdom`. Mock `window.SpeechRecognition`. Test cases:
    - When `window.SpeechRecognition` is undefined and `window.webkitSpeechRecognition` is undefined, renders the `role="alert"` warning banner
    - When `SpeechRecognition` is available, renders the `"Start Recording"` button
    - Button is disabled when `props.disabled === true`
    - `props.onStart` is called when button is clicked
  - Manual: In Chrome, click "Start Recording", speak a sentence, and verify the pulsing indicator appears during recording and disappears on stop.

---

### T8: Create `prisma/seed.ts` and update `package.json`

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `prisma/seed.ts` — new file
  - `package.json` — add `"prisma"` key with `"seed"` command; install `ts-node` devDependency
- **Implementation notes**:
  The seed script must use CommonJS-compatible imports since Prisma runs it with `ts-node --compiler-options {"module":"CommonJS"}`. Use `import` syntax (TypeScript) — `ts-node` with CommonJS compiler option handles the transpilation.

  `prisma/seed.ts`:
  ```typescript
  import { prisma } from '../src/lib/prisma';
  import { JOBS } from '../src/lib/jobs';

  async function main() {
    for (const job of JOBS) {
      await prisma.job.upsert({
        where: { id: job.id },
        update: {},
        create: {
          id: job.id,
          slug: job.slug,
          title: job.title,
          description: job.description,
          questionPack: job.questionPack ?? undefined,
        },
      });
    }
    console.log(`Seeded ${JOBS.length} jobs.`);
  }

  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
  ```

  `package.json` changes:
  1. Add to the `"devDependencies"` section: `"ts-node": "^10.9.2"` (run `npm install --save-dev ts-node` to get the latest compatible version).
  2. Add at the top level of `package.json` (alongside `"scripts"`, `"dependencies"`, etc.):
  ```json
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
  ```

  The `upsert` with `update: {}` is the idempotency mechanism — it creates the row if absent, leaves it unchanged if it already exists.

- **Testing**:
  - Unit: No unit test needed for the seed script itself; the correctness is validated manually and via T3 unit tests.
  - Integration: Run `npx prisma db seed` once; verify exactly 3 rows in `jobs` table. Run it a second time; verify still exactly 3 rows (no duplicates).
  - Manual: Open Prisma Studio (`npx prisma studio`) and confirm 3 job rows with the expected titles.

---

### T9: Update `docs/openapi.yaml` with new endpoints

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `docs/openapi.yaml` — append two new path entries before the closing comment `# Additional endpoints are added here...`
- **Implementation notes**:
  Add entries for `POST /api/sessions` (tag: `sessions`) and `POST /api/interview` (tag: `interview`). Both endpoints are already listed in the `tags` array at the top of the file. Place the new entries in the `paths` section immediately before the trailing comment line.

  For `/api/sessions`:
  - `operationId: createSession`
  - `security: [{ cookieAuth: [] }]`
  - Request body required: `{ jobId: string }` (non-empty string)
  - Responses: `201` with `{ id: string }`, `400` with `{ error: string }` (jobId missing/invalid), `404` with `{ error: string }` (job not found), `500` with `{ error: string }`

  For `/api/interview`:
  - `operationId: submitInterviewTurn`
  - `security: [{ cookieAuth: [] }]`
  - Request body required: `{ sessionId: string, userAnswer: string, turnNumber: integer (minimum 0) }`
  - Responses: `200` with `{ nextQuestion: string, isComplete: boolean }`, `400` with `{ error: string }`, `404` with `{ error: string }` (session not found), `409` with `{ error: string }` (session not in progress), `500` with `{ error: string }`

  All response schemas must include `required` arrays and `properties` with `type` and `example` for every field, consistent with the existing auth endpoint documentation style in the file.

- **Testing**:
  - Unit: Validate YAML is syntactically correct (`npx js-yaml docs/openapi.yaml` or open in a YAML-aware editor).
  - Integration: Load the YAML in Swagger UI (or Redoc) and confirm both endpoints render correctly with all status codes.
  - Manual: Visual inspection of the rendered spec.

---

### T10: Create `InterviewRoom` component

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — new file; `'use client'` directive
- **Implementation notes**:
  This is the most complex component. It uses `useReducer` for all state. No `useState` for any interview-phase, session, turn, question, or error data — only `useReducer`.

  **Imports**: `useReducer`, `useEffect`, `useCallback` from React. `Card`, `Button` from `@/components/ui`. `VoiceRecorder` from `./VoiceRecorder`. `TranscriptView` from `./TranscriptView`. Types from `@/types`.

  **Constants** (module scope):
  ```typescript
  const INITIAL_QUESTION =
    "Welcome! Please start by telling me about yourself and your background.";
  ```

  **Props**:
  ```typescript
  interface InterviewRoomProps {
    job: Job;
  }
  ```

  **Initial state**:
  ```typescript
  const initialState: InterviewRoomState = {
    phase: 'session_creating',
    sessionId: null,
    currentQuestion: '',
    turns: [],
    turnNumber: 0,
    errorMessage: null,
    interimTranscript: '',
    retryCount: 0,
  };
  ```

  **Reducer** (`function interviewReducer(state: InterviewRoomState, action: InterviewRoomAction): InterviewRoomState`):
  - `SESSION_CREATED`: `{ ...state, phase: 'awaiting_recording', sessionId: action.sessionId, currentQuestion: INITIAL_QUESTION, errorMessage: null }`
  - `SESSION_ERROR`: `{ ...state, phase: 'session_error', errorMessage: action.message }`
  - `RECORDING_STARTED`: `{ ...state, phase: 'recording' }`
  - `INTERIM_TRANSCRIPT`: `{ ...state, interimTranscript: action.text }`
  - `FINAL_TRANSCRIPT`: `{ ...state, phase: 'processing', interimTranscript: '', turns: [...state.turns, { id: crypto.randomUUID(), speaker: 'AI' as const, content: action.currentQuestion, createdAt: new Date() }, { id: crypto.randomUUID(), speaker: 'USER' as const, content: action.transcript, createdAt: new Date() }] }`
  - `TURN_SAVED`: if `action.isComplete` → `{ ...state, phase: 'complete', turnNumber: state.turnNumber + 1, currentQuestion: action.nextQuestion }` else → `{ ...state, phase: 'awaiting_recording', turnNumber: state.turnNumber + 1, currentQuestion: action.nextQuestion, errorMessage: null }`
  - `API_ERROR`: `{ ...state, phase: 'api_error', errorMessage: action.message }`
  - `RETRY_SESSION`: `{ ...state, phase: 'session_creating', retryCount: state.retryCount + 1 }`

  **TTS helper** (defined inside component with `useCallback([], [])`):
  ```typescript
  const speakQuestion = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch {
      // TTS failure is non-blocking — question is shown in UI regardless
    }
  }, []);
  ```

  **Session creation effect** (depends on `[state.retryCount]`):
  ```typescript
  useEffect(() => {
    if (state.phase !== 'session_creating') return;
    let cancelled = false;
    async function createSession() {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          dispatch({ type: 'SESSION_ERROR', message: data.error ?? 'Failed to start session.' });
          return;
        }
        const data = await res.json() as PostSessionResponse;
        dispatch({ type: 'SESSION_CREATED', sessionId: data.id });
        speakQuestion(INITIAL_QUESTION);
      } catch {
        if (!cancelled) dispatch({ type: 'SESSION_ERROR', message: 'Network error. Please check your connection.' });
      }
    }
    createSession();
    return () => { cancelled = true; };
  }, [state.retryCount]); // eslint-disable-line react-hooks/exhaustive-deps
  ```

  **Turn submission effect** (depends on `[state.phase]`):
  ```typescript
  useEffect(() => {
    if (state.phase !== 'processing' || !state.sessionId) return;
    let cancelled = false;
    const userAnswer = state.turns[state.turns.length - 1]?.content ?? '';
    async function submitTurn() {
      try {
        const res = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            userAnswer,
            turnNumber: state.turnNumber,
          }),
        });
        if (cancelled) return;
        if (res.status === 404) {
          dispatch({ type: 'API_ERROR', message: 'Session not found.' });
          return;
        }
        if (res.status === 409) {
          dispatch({ type: 'API_ERROR', message: 'Your session has already ended.' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'API_ERROR', message: 'Failed to save your answer. Please try again.' });
          return;
        }
        const data = await res.json() as PostInterviewResponse;
        dispatch({ type: 'TURN_SAVED', nextQuestion: data.nextQuestion, isComplete: data.isComplete });
        speakQuestion(data.nextQuestion);
      } catch {
        if (!cancelled) dispatch({ type: 'API_ERROR', message: 'Failed to save your answer. Please try again.' });
      }
    }
    submitTurn();
    return () => { cancelled = true; };
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  ```

  **Render**:
  - `session_creating`: Full-area div with centered spinner SVG (reuse the Spinner pattern from Button.tsx, but sized `h-8 w-8`) + `<p>Starting your interview…</p>`. No recording controls.
  - `session_error`: `<Card>` with `state.errorMessage` and `<Button onClick={() => dispatch({ type: 'RETRY_SESSION' })}>Retry</Button>`.
  - `awaiting_recording` | `recording` | `processing` | `api_error`:
    ```tsx
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-zinc-500 mb-1">Current question</p>
        <p className="text-zinc-900 font-medium">{state.currentQuestion}</p>
        {state.phase === 'recording' && state.interimTranscript && (
          <p className="text-zinc-400 italic text-sm mt-2">{state.interimTranscript}</p>
        )}
      </Card>
      <TranscriptView turns={state.turns} />
      {state.phase === 'processing' && (
        <p className="text-zinc-500 text-sm">Thinking…</p>
      )}
      {state.phase === 'api_error' && (
        <Card>
          <p className="text-red-600 text-sm mb-2">{state.errorMessage}</p>
          <Button onClick={handleRetryTurn}>Retry</Button>
        </Card>
      )}
      {(state.phase === 'awaiting_recording' || state.phase === 'recording') && (
        <VoiceRecorder
          disabled={state.phase !== 'awaiting_recording'}
          onStart={() => dispatch({ type: 'RECORDING_STARTED' })}
          onInterim={(text) => dispatch({ type: 'INTERIM_TRANSCRIPT', text })}
          onTranscript={(transcript) => dispatch({ type: 'FINAL_TRANSCRIPT', transcript, currentQuestion: state.currentQuestion })}
          onError={(message) => dispatch({ type: 'API_ERROR', message })}
        />
      )}
    </div>
    ```
  - `complete`: `<p className="text-zinc-700">Interview complete.</p>`

  **`handleRetryTurn`**: a `useCallback` that re-sets `state.phase` back to `'processing'`. Since dispatch in a `useCallback` is tricky when the state used is stale, the simplest pattern is to dispatch a new action `{ type: 'RETRY_TURN' }` but that would require adding it to the reducer. Alternatively, since the `processing` effect depends on `state.phase`, and `api_error` changed `phase` away from `processing`, re-triggering requires dispatching `FINAL_TRANSCRIPT` again with the same transcript. A simpler approach: add a `retryTurnCount` field to state (increment on retry) and add `RETRY_TURN` action to the reducer + to `InterviewRoomAction` type. However, the spec does not require `RETRY_TURN` explicitly, but it's necessary for the retry UI. The spec says "clicking 'Retry' re-submits the same turn data" — implement by adding a `RETRY_TURN` action in the reducer that sets `phase` back to `'processing'` without changing turns or turnNumber. Update `InterviewRoomAction` in `src/types/index.ts` to include `| { type: 'RETRY_TURN' }` — this is a minor additive change to T1's output that T10 is responsible for.

- **Testing**:
  - Unit: Create `src/__tests__/InterviewRoom.test.tsx` with `@jest-environment jsdom`. Mock `fetch` globally. Test cases:
    - On mount, `fetch('/api/sessions')` is called with `{ jobId: job.id }`
    - While fetch is pending, `"Starting your interview…"` is rendered
    - After session creation succeeds, `INITIAL_QUESTION` text is rendered
    - When session creation fails, error message and "Retry" button appear
    - Clicking "Retry" re-calls `fetch('/api/sessions')`
    - After `SESSION_CREATED`, `VoiceRecorder` is rendered
    - When phase is `'processing'`, `"Thinking…"` is rendered
    - When phase is `'complete'`, `"Interview complete."` is rendered
  - Manual: Full end-to-end browser test (see Acceptance Criteria in the spec).

---

### T11: Create `src/app/interview/[jobId]/page.tsx`

- **Type**: frontend
- **Wave**: 4
- **Files to create or modify**:
  - `src/app/interview/[jobId]/page.tsx` — new file; React Server Component (no `'use client'` directive)
- **Implementation notes**:
  This is a Next.js App Router RSC. Import `prisma` from `@/lib/prisma`. Import `InterviewRoom` from `@/components/InterviewRoom`. Import `Job` from `@/types`.

  Page component signature:
  ```typescript
  export default async function InterviewPage({
    params,
  }: {
    params: Promise<{ jobId: string }>;
  }) {
    const { jobId } = await params;
    ...
  }
  ```

  Note: In Next.js 15+ (which this project uses — `"next": "16.2.10"`), `params` is a Promise and must be awaited before accessing route parameters.

  Implementation:
  ```typescript
  let job: Job | null;
  try {
    job = await prisma.job.findUnique({ where: { id: jobId } });
  } catch {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Something went wrong. Please try again.</p>
        <a href="/" className="text-blue-600 underline">Back to home</a>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Job not found.</p>
        <a href="/" className="text-blue-600 underline">Back to home</a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-6">
        {job.title} Interview
      </h1>
      <InterviewRoom job={job} />
    </main>
  );
  ```

  The `job` object passed to `InterviewRoom` has shape `{ id, slug, title, description, questionPack }` which matches the `Job` type from `@/types`. The Prisma `Job` model returns `questionPack` as `Prisma.JsonValue | null` — cast or map it to `unknown | null` to satisfy the `Job` type: `const jobForClient: Job = { ...job, questionPack: job.questionPack as unknown }`.

  No metadata export is needed for this feature. No `generateStaticParams` — the page is fully dynamic.

- **Testing**:
  - Unit: Not practical to unit-test RSC with Prisma directly; rely on integration testing.
  - Integration: Start dev server; visit `http://localhost:3000/interview/<valid-seeded-jobId>` while authenticated; verify job title renders and `InterviewRoom` mounts. Visit `/interview/nonexistent-id`; verify "Job not found." message with link to `/`.
  - Manual: Full E2E walkthrough per the spec's Acceptance Criteria section.

---

## Data migrations

No Prisma schema changes are required. All models (`Job`, `Session`, `Turn`) and enums (`SessionStatus`, `Speaker`) already exist in `prisma/schema.prisma` with correct snake_case `@map` annotations. No `prisma migrate dev` command needs to be run for this feature.

The seeding command to run after T8 is complete:
```bash
npx prisma db seed
```

---

## API documentation updates

The backend-implementer for T9 must add the following to `docs/openapi.yaml` under `paths`:

| Path | Method | operationId | Tags |
|------|--------|-------------|------|
| `/api/sessions` | POST | `createSession` | `sessions` |
| `/api/interview` | POST | `submitInterviewTurn` | `interview` |

Full request/response schemas per the API Contracts section of the feature spec (requirements 17–30).

---

## Cross-cutting concerns

1. **`src/types/index.ts` (T1)** must be completed before T3, T4, T5, T6, T7, and T10 begin. It is the single source of truth for `Job`, `InterviewRoomState`, `InterviewRoomAction`, `TranscriptTurn`, `PostSessionResponse`, and `PostInterviewResponse`.

2. **`src/components/ui/Badge.tsx` (T2)** must be completed before T6 (TranscriptView) and T10 (InterviewRoom, which renders TranscriptView) begin.

3. **`src/lib/jobs.ts` (T3)** must be completed before T8 (seed script) begins. T11 (page) does not import from `jobs.ts` — it queries Prisma directly — so T3 does not block T11 directly.

4. **`RETRY_TURN` action**: T10 adds `| { type: 'RETRY_TURN' }` to `InterviewRoomAction` in `src/types/index.ts`. Since T1 and T10 are in different waves (T10 is wave 3), T10's implementer must modify `src/types/index.ts` to add this action before implementing the retry button in `InterviewRoom`. This is an additive change and does not break any other wave-2 tasks.

5. **`ts-node` installation (T8)**: The seed script requires `ts-node` as a devDependency. T8's implementer must run `npm install --save-dev ts-node` and commit the updated `package.json` and `package-lock.json`.

6. **No shared state between components**: `InterviewRoom` owns all state. `VoiceRecorder` and `TranscriptView` are purely presentation/callback components — they hold no interview state themselves.
