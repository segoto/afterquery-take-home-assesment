# Implementation Plan: OpenRouter Integration

## Overview

This feature introduces a provider-agnostic AI client abstraction (`src/lib/ai-client.ts`) that routes AI calls to either Anthropic (via `@anthropic-ai/sdk`) or OpenRouter (via the `openai` package) depending on the `AI_PROVIDER` environment variable. Alongside the new abstraction, the `/api/interview` route is rewritten to stream real AI responses as `text/plain`, a new `/api/evaluate` route is created for post-interview scoring, and `InterviewRoom.tsx` is updated to consume the streaming interview response.

## Prerequisites

- No Prisma schema changes are required. The existing `Session`, `Turn`, and `Evaluation` models are sufficient.
- No seed data changes are required.
- The `@anthropic-ai/sdk` and `openai` npm packages must be installed (handled in T1) before any AI client code is written.
- At runtime, at least one of `ANTHROPIC_API_KEY` (when `AI_PROVIDER=anthropic` or unset) or `OPENROUTER_API_KEY` (when `AI_PROVIDER=openrouter`) must be present in the environment.

## Task Graph

| Task | Wave | Type | Description | Depends on |
|------|------|------|-------------|------------|
| T1 | 1 | backend | Install `@anthropic-ai/sdk` and `openai` npm packages; update `.env.example` | — |
| T2 | 1 | backend | Create `src/lib/anthropic.ts` with prompt-builder functions | — |
| T3 | 2 | backend | Create `src/lib/ai-client.ts` — provider-agnostic singleton with `streamCompletion` and `complete` | T1 |
| T4 | 3 | backend | Rewrite `src/app/api/interview/route.ts` to use real AI streaming via `aiClient`; rewrite `src/__tests__/interview-route.test.ts` | T2, T3 |
| T5 | 3 | backend | Create `src/app/api/evaluate/route.ts`; create `src/__tests__/evaluate-route.test.ts` | T2, T3 |
| T6 | 4 | frontend | Update `src/components/InterviewRoom.tsx` to consume streaming response; remove `PostInterviewResponse` from `src/types/index.ts` | T4 |
| T7 | 4 | backend | Update `docs/openapi.yaml` for the `/api/interview` streaming format and the new `/api/evaluate` endpoint | T4, T5 |

Wave 1 tasks (T1, T2) are fully parallel. T3 starts only after T1 completes. T4 and T5 are parallel and start only after T3 (and T2) complete. T6 and T7 are parallel and start only after T4 and T5 complete.

## Task Details

### T1: Install npm packages and update `.env.example`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `package.json` — add `@anthropic-ai/sdk` and `openai` as production dependencies by running `npm install @anthropic-ai/sdk openai`
  - `.env.example` — add three new documented entries: `AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- **Implementation notes**:
  - Run `npm install @anthropic-ai/sdk openai` from the project root. Do not pin to a specific minor version; let npm resolve the latest compatible version.
  - In `.env.example`, add the following block after the existing `ANTHROPIC_API_KEY` entry:
    ```
    # AI provider: "anthropic" (default) or "openrouter"
    AI_PROVIDER="anthropic"

    # Required when AI_PROVIDER=openrouter
    OPENROUTER_API_KEY="sk-or-..."

    # Optional — OpenRouter model identifier; defaults to "anthropic/claude-sonnet-4-6"
    OPENROUTER_MODEL="anthropic/claude-sonnet-4-6"
    ```
  - Do not modify any other file in this task.
- **Testing**:
  - Unit: none — this is a dependency and config task.
  - Integration: after running `npm install`, confirm `npx tsc --noEmit` still passes with no errors.
  - Manual: verify that `node_modules/@anthropic-ai/sdk` and `node_modules/openai` exist after install.

---

### T2: Create `src/lib/anthropic.ts` — prompt builders

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/lib/anthropic.ts` — new file; exports `buildInterviewSystemPrompt` and `buildEvaluationPrompt`
- **Implementation notes**:
  - This file must import only `Job` from `@/types` — no external SDK imports.
  - `buildInterviewSystemPrompt(job: Job): string` must return a multi-line string that includes all of the following:
    1. The job title and full description so the AI is grounded in the role.
    2. A rubric section listing the skills to probe (derive them from the job description; the prompt should instruct the AI to infer the key competencies from the job description it has been given).
    3. An explicit rule: "You must ask the candidate at least 6 questions in total."
    4. An adaptive follow-up rule: "Generate at least 2 follow-up questions that probe areas the candidate's prior answers reveal as important or unclear."
    5. A termination rule: "After your final question, append the token `[INTERVIEW_COMPLETE]` as the very last characters of your response — with no text after it."
    6. An instruction to ask only one question at a time.
  - `buildEvaluationPrompt(turns: Array<{ speaker: string; content: string }>): string` must return a string that includes:
    1. A formatted transcript section with each turn labeled `CANDIDATE:` or `INTERVIEWER:` based on `speaker` value (`USER` → `CANDIDATE`, `AI` → `INTERVIEWER`).
    2. An instruction: "Based on the interview transcript above, evaluate the candidate. Respond with ONLY valid JSON — no surrounding text, no markdown code fences — containing exactly these keys: `strengths` (array of strings), `concerns` (array of strings), `overall_score` (integer from 1 to 10)."
  - Both functions must be pure (no side effects, no I/O).
- **Testing**:
  - Unit: create `src/__tests__/anthropic-prompts.test.ts`. Test that `buildInterviewSystemPrompt` returns a string containing the job title, the `[INTERVIEW_COMPLETE]` sentinel instruction, the "at least 6 questions" rule, and the "at least 2 follow-up" rule. Test that `buildEvaluationPrompt` formats turns with the correct speaker labels and includes the JSON instruction.
  - Integration: none — pure functions.
  - Manual: call both functions with a sample `Job` and log the output; verify the prompts read naturally.

---

### T3: Create `src/lib/ai-client.ts` — provider-agnostic AI client singleton

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/lib/ai-client.ts` — new file; exports singleton `aiClient`
- **Implementation notes**:
  - Read `process.env.AI_PROVIDER` at module load time. Accepted values: `"anthropic"` (also the default when the var is absent) and `"openrouter"`. Any other non-empty value must throw synchronously:
    ```
    Error: Unsupported AI_PROVIDER: <value>. Must be "anthropic" or "openrouter"
    ```
  - Export a single interface type `AiClientMessages` (or inline the parameter type) — `Array<{ role: 'user' | 'assistant'; content: string }>`.
  - Export a singleton object `aiClient` with two methods:
    - `streamCompletion({ systemPrompt: string, messages: AiClientMessages }): Promise<ReadableStream<Uint8Array>>`
    - `complete({ systemPrompt: string, messages: AiClientMessages }): Promise<string>`
  - **Anthropic provider** (when `AI_PROVIDER=anthropic` or unset):
    - If `process.env.ANTHROPIC_API_KEY` is absent, throw at module load:
      ```
      Error: ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic
      ```
    - Instantiate `Anthropic` from `@anthropic-ai/sdk` using `{ apiKey: process.env.ANTHROPIC_API_KEY }`.
    - Model: hardcoded `"claude-sonnet-4-6"` per CLAUDE.md.
    - `streamCompletion`: call `anthropic.messages.stream({ model, max_tokens: 2048, system: systemPrompt, messages })`. Wrap the async iterator in a `ReadableStream<Uint8Array>` using `TextEncoder` to encode `event.delta.text` for each `content_block_delta` event with `delta.type === 'text_delta'`. Call `controller.close()` after the loop and `controller.error(err)` on exception.
    - `complete`: call `anthropic.messages.create({ model, max_tokens: 2048, stream: false, system: systemPrompt, messages })`. Return `(response.content[0] as { text: string }).text`.
  - **OpenRouter provider** (when `AI_PROVIDER=openrouter`):
    - If `process.env.OPENROUTER_API_KEY` is absent, throw at module load:
      ```
      Error: OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter
      ```
    - Model: `process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-6"`.
    - Instantiate `OpenAI` from `openai` with:
      ```typescript
      {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'AI Interviewer Platform',
        },
      }
      ```
    - `streamCompletion`: call `openai.chat.completions.create({ model, stream: true, messages: [{ role: 'system', content: systemPrompt }, ...messages] })`. Wrap the async iterable in a `ReadableStream<Uint8Array>`, encoding `chunk.choices[0]?.delta?.content ?? ''` for each chunk. Skip empty strings. Call `controller.close()` and `controller.error(err)` appropriately.
    - `complete`: call `openai.chat.completions.create({ model, stream: false, messages: [{ role: 'system', content: systemPrompt }, ...messages] })`. Return `response.choices[0].message.content ?? ''`.
  - Use the singleton pattern from `src/lib/prisma.ts` as the model if needed, but since `ai-client.ts` only runs server-side (never in the browser), a plain module-level singleton (not stored on `globalThis`) is sufficient.
  - All errors thrown at module initialisation are intentional — they fail Next.js startup loudly.
- **Testing**:
  - Unit: create `src/__tests__/ai-client.test.ts`. Use `jest.unstable_mockModule` to mock `@anthropic-ai/sdk` and `openai`. Test:
    1. With `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` set: module initialises without error.
    2. With `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` absent: module throws `ANTHROPIC_API_KEY is required...`.
    3. With `AI_PROVIDER=openrouter` and `OPENROUTER_API_KEY` set: module initialises without error.
    4. With `AI_PROVIDER=openrouter` and `OPENROUTER_API_KEY` absent: module throws `OPENROUTER_API_KEY is required...`.
    5. With `AI_PROVIDER=gemini`: module throws `Unsupported AI_PROVIDER: gemini...`.
    6. `streamCompletion` returns a `ReadableStream` (verify instanceof or duck-type check).
    7. `complete` returns a string.
  - Note: because `ai-client.ts` reads env vars at module load, each test case that changes the provider must use dynamic import after setting the env var, and must isolate module state via `jest.resetModules()`.
  - Integration: none in automated tests — real API calls are manual only.
  - Manual: set `AI_PROVIDER=anthropic` with a valid key, start the dev server, and confirm it starts. Repeat with `AI_PROVIDER=openrouter`. Confirm a missing key prevents startup.

---

### T4: Rewrite `src/app/api/interview/route.ts`; rewrite `src/__tests__/interview-route.test.ts`

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — full rewrite; replaces placeholder logic with real AI streaming
  - `src/__tests__/interview-route.test.ts` — full rewrite; the existing tests are invalidated by the new response format
- **Implementation notes**:

  **Route (`src/app/api/interview/route.ts`)**:
  - Remove the `PLACEHOLDER_QUESTIONS` and `NEXT_QUESTION` constants, the `PostInterviewResponse` import, and the `$transaction` call.
  - Import `aiClient` from `@/lib/ai-client` and `buildInterviewSystemPrompt` from `@/lib/anthropic`.
  - The function signature changes to `export async function POST(request: NextRequest): Promise<Response>` — return a plain `Response`, not `NextResponse`, because streaming requires constructing the response manually.
  - **Validation** (unchanged logic): return `NextResponse.json({ error: 'sessionId, userAnswer, and turnNumber are required' }, { status: 400 })` for invalid inputs.
  - **Session and job loading**: use `prisma.session.findUnique({ where: { id: sessionId }, include: { job: true } })`. Return 404 if null. Return 409 if `session.status !== 'IN_PROGRESS'`.
  - **Persist user turn** (before calling AI): `await prisma.turn.create({ data: { sessionId, speaker: 'USER', content: userAnswer } })`.
  - **Load conversation history**: `await prisma.turn.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } })`. Map to `{ role: turn.speaker === 'AI' ? 'assistant' : 'user', content: turn.content }`.
  - **Call AI**: wrap in try/catch around `await aiClient.streamCompletion(...)`. If it throws, return `NextResponse.json({ error: 'AI provider error' }, { status: 502 })`.
  - **Stream construction**: create a `ReadableStream<Uint8Array>` whose `start(controller)` callback does the following:
    1. Obtain a `ReadableStreamDefaultReader` from the AI stream.
    2. Decode each chunk using `TextDecoder` (with `{ stream: true }` option).
    3. Append each decoded chunk to an `accumulated` string.
    4. Strip the `[INTERVIEW_COMPLETE]` sentinel from each chunk before forwarding: `const forwarded = chunk.replace('[INTERVIEW_COMPLETE]', ''); if (forwarded) controller.enqueue(encoder.encode(forwarded));`
    5. On read completion, call `controller.close()`.
    6. In the catch block, call `controller.error(err)`.
    7. After `controller.close()` (using a `finally` block or code after the loop), perform DB writes:
       - `const cleanContent = accumulated.replace('[INTERVIEW_COMPLETE]', '').trim();`
       - `const isComplete = accumulated.includes('[INTERVIEW_COMPLETE]');`
       - `await prisma.turn.create({ data: { sessionId, speaker: 'AI', content: cleanContent } });`
       - If `isComplete`: `await prisma.session.update({ where: { id: sessionId }, data: { status: 'COMPLETED', endedAt: new Date() } });`
    8. Wrap all DB writes in a try/catch and log errors (they cannot propagate to the client since the response has already started streaming).
  - **Return value**: `return new Response(outputStream, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })`.
  - Handle unexpected outer errors with `return NextResponse.json({ error: 'Internal server error' }, { status: 500 })`.

  **Test file rewrite (`src/__tests__/interview-route.test.ts`)**:
  - Mock both `@/lib/prisma` AND `@/lib/ai-client` using `jest.unstable_mockModule`.
  - For `@/lib/ai-client`, mock `aiClient.streamCompletion` to return a `ReadableStream<Uint8Array>` that emits a configurable text string.
  - Helper: create a `makeTextStream(text: string): ReadableStream<Uint8Array>` that synchronously enqueues `encoder.encode(text)` and closes.
  - The mocked Prisma must now include `session.findUnique` (returning a session with `job` relation), `turn.create`, `turn.findMany`, and `session.update`.
  - Test cases to cover:
    1. Returns 400 for all invalid input combinations (sessionId missing/empty, userAnswer missing/empty, turnNumber missing/non-integer/negative) — same as before.
    2. Returns 404 when session not found.
    3. Returns 409 when session status is COMPLETED or ABANDONED.
    4. Returns 502 when `aiClient.streamCompletion` throws.
    5. Returns 200 with `Content-Type: text/plain; charset=utf-8` on success.
    6. On success without sentinel: reads stream body as text, verifies it matches the mocked AI text; verifies `turn.create` is called twice (once for USER, once for AI); verifies `session.update` is NOT called.
    7. On success with sentinel (`[INTERVIEW_COMPLETE]` appended to stream text): verifies sentinel is absent in the response body; verifies `session.update` is called with `status: 'COMPLETED'`.
  - Note: reading the streaming response body in tests requires `await res.text()` or accumulating the reader — use `await res.text()` for simplicity.

- **Testing**:
  - Unit: the rewritten `src/__tests__/interview-route.test.ts` covers all cases above.
  - Integration: with a running DB and valid AI key, POST to `/api/interview` with a valid `sessionId` and `userAnswer`; verify the response streams text and that Turn rows appear in the DB.
  - Manual: open the interview UI, record an answer, observe the "Thinking…" phase, and verify the next question appears after the stream ends.

---

### T5: Create `src/app/api/evaluate/route.ts` and `src/__tests__/evaluate-route.test.ts`

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/api/evaluate/route.ts` — new file
  - `src/__tests__/evaluate-route.test.ts` — new file
- **Implementation notes**:

  **Route (`src/app/api/evaluate/route.ts`)**:
  - Import `aiClient` from `@/lib/ai-client`, `buildEvaluationPrompt` from `@/lib/anthropic`, and `prisma` from `@/lib/prisma`.
  - Accept `POST` with body `{ sessionId: string }`.
  - **Validation**: if `sessionId` is missing or not a non-empty string, return `NextResponse.json({ error: 'sessionId is required' }, { status: 400 })`.
  - **Session load**: `prisma.session.findUnique({ where: { id: sessionId } })`. Return 404 if null.
  - **ABANDONED check**: if `session.status === 'ABANDONED'`, return 409 `{ error: 'Session is not in progress or completed' }`.
  - **Duplicate evaluation check**: `prisma.evaluation.findUnique({ where: { sessionId } })`. If it exists, return 409 `{ error: 'Evaluation already exists' }`.
  - **Load turns**: `prisma.turn.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } })`.
  - **Build prompt and call AI**: `const rawResponse = await aiClient.complete({ systemPrompt: '', messages: [{ role: 'user', content: buildEvaluationPrompt(turns) }] })`. Note: `buildEvaluationPrompt` returns a user-turn prompt (the entire evaluation request), so pass it as the only user message with an empty system prompt.
  - **Strip markdown fences**: apply the regex `rawResponse.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()` before parsing.
  - **Parse JSON**: wrap in try/catch. If `JSON.parse` throws, return `NextResponse.json({ error: 'AI returned an unparseable evaluation' }, { status: 502 })`.
  - **Normalise fields**:
    - `strengths`: `Array.isArray(parsed.strengths) ? parsed.strengths : []`
    - `concerns`: `Array.isArray(parsed.concerns) ? parsed.concerns : []`
    - `overall_score`: parse as number. Apply `Math.round` if float. Clamp: `Math.max(1, Math.min(10, rounded))`.
  - **Persist Evaluation**: `prisma.evaluation.create({ data: { sessionId, strengths: strengths, concerns: concerns, score: score } })`.
  - **Update session** if `endedAt` is null: `prisma.session.update({ where: { id: sessionId }, data: { status: 'COMPLETED', endedAt: new Date() } })`.
  - Return `NextResponse.json({ id: evaluation.id, strengths, concerns, score }, { status: 201 })`.
  - Wrap the entire handler body in try/catch; return 500 for unexpected errors.

  **Test file (`src/__tests__/evaluate-route.test.ts`)**:
  - Mock `@/lib/prisma` and `@/lib/ai-client` using `jest.unstable_mockModule`.
  - Mock `aiClient.complete` to return a configurable JSON string.
  - Test cases:
    1. Returns 400 when `sessionId` is missing or empty.
    2. Returns 404 when session is not found.
    3. Returns 409 `Session is not in progress or completed` when `session.status === 'ABANDONED'`.
    4. Returns 409 `Evaluation already exists` when an evaluation row already exists.
    5. Returns 502 when `aiClient.complete` returns unparseable JSON.
    6. Returns 201 with `{ id, strengths, concerns, score }` on success with a valid JSON response.
    7. Strips markdown fences: mock `aiClient.complete` to return `` ```json\n{"strengths":[],"concerns":[],"overall_score":7}\n``` ``; verify it still parses and returns 201.
    8. Normalises `overall_score`: mock returning `7.8` → score should be `8`; mock returning `15` → score should be `10`; mock returning `0` → score should be `1`.
    9. Uses empty arrays for missing `strengths` or `concerns`.
    10. Returns 500 on unexpected Prisma error.

- **Testing**:
  - Unit: `src/__tests__/evaluate-route.test.ts` covers all cases above.
  - Integration: after completing an interview session (with Turn rows in the DB), POST `{ sessionId }` to `/api/evaluate` and verify a 201 response with a valid evaluation object; verify the `evaluations` table row and the session's `endedAt` and `status` fields.
  - Manual: complete a full interview in the browser, then trigger evaluation via the UI or curl; verify the evaluation renders on the results page.

---

### T6: Update `InterviewRoom.tsx` and remove `PostInterviewResponse` from `src/types/index.ts`

- **Type**: frontend
- **Wave**: 4
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — update `submitTurn` to consume the streaming response body
  - `src/types/index.ts` — remove the `PostInterviewResponse` interface
- **Implementation notes**:

  **`src/types/index.ts`**:
  - Delete the `PostInterviewResponse` interface (lines defining `nextQuestion: string` and `isComplete: boolean`). No replacement type is needed.

  **`src/components/InterviewRoom.tsx`**:
  - In the `import` statement at the top, remove `PostInterviewResponse` from the named import list of `@/types`. The other types (`Job`, `InterviewRoomState`, `InterviewRoomAction`, `PostSessionResponse`) remain.
  - Locate the `submitTurn` async function inside the `useEffect` for the `processing` phase. Replace the block that calls `res.json()` with the streaming read logic:
    ```typescript
    // After the existing !res.ok error handling block:
    if (!res.body) {
      dispatch({ type: 'API_ERROR', message: 'Failed to read AI response.' });
      return;
    }
    let accumulated = '';
    try {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (cancelled) return;
      }
    } catch {
      if (!cancelled) {
        dispatch({ type: 'API_ERROR', message: 'Failed to read AI response.' });
      }
      return;
    }
    const SENTINEL = '[INTERVIEW_COMPLETE]';
    const isComplete = accumulated.includes(SENTINEL);
    const nextQuestion = accumulated.replace(SENTINEL, '').trim();
    dispatch({ type: 'TURN_SAVED', nextQuestion, isComplete });
    speakQuestion(nextQuestion);
    ```
  - The `cancelled` variable is already in scope from the outer `useEffect` closure — the check after each read prevents stale state updates.
  - Do not change any rendered JSX, other action handlers, or the reducer logic.
  - The `RETRY_TURN` action dispatches back to `processing` phase, which re-runs `submitTurn`. This is unchanged behaviour and still works correctly.

  **`src/__tests__/InterviewRoom.test.tsx`**:
  - Update any test that mocks `fetch` for `/api/interview` to return a streaming response instead of a JSON response. Use a `Response` with a `ReadableStream` body containing the question text as UTF-8.
  - Verify that after the stream resolves, the component transitions out of the `processing` phase and displays the next question.
  - Verify that when the stream body contains `[INTERVIEW_COMPLETE]`, the component moves to the `complete` phase.

- **Testing**:
  - Unit: update `src/__tests__/InterviewRoom.test.tsx` as described.
  - Integration: none (browser-only streaming API).
  - Manual: run the full interview flow in Chrome; verify each answer submission causes the next question to appear after streaming completes; verify the interview ends when the AI appends `[INTERVIEW_COMPLETE]`.

---

### T7: Update `docs/openapi.yaml`

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `docs/openapi.yaml` — update `/api/interview` 200 response; add `/api/evaluate` endpoint
- **Implementation notes**:

  **Update `/api/interview` 200 response**:
  - Replace the existing `application/json` schema for the 200 response (which had `nextQuestion` and `isComplete` properties) with:
    ```yaml
    '200':
      description: |
        AI next question streamed as plain UTF-8 text. The [INTERVIEW_COMPLETE]
        sentinel is stripped before the stream is forwarded. When the session
        has ended the server updates status to COMPLETED server-side.
      headers:
        Transfer-Encoding:
          schema:
            type: string
            example: chunked
      content:
        text/plain:
          schema:
            type: string
            example: "Can you walk me through a specific technical challenge you faced recently?"
    ```
  - Add the `502` response entry to `/api/interview` alongside the existing 400/404/409/500:
    ```yaml
    '502':
      description: AI provider returned an error or stream failed.
      content:
        application/json:
          schema:
            type: object
            required: [error]
            properties:
              error:
                type: string
                example: "AI provider error"
    ```
  - Update the `description` of `/api/interview` to reflect the new real-AI streaming behaviour (remove references to hardcoded/placeholder questions).

  **Add `/api/evaluate` endpoint**:
  - Add a new path entry `POST /api/evaluate` with:
    - `operationId: evaluateSession`
    - `tags: [evaluate]`
    - Request body: `{ sessionId: string }` (required)
    - Response `201`: `{ id: string, strengths: string[], concerns: string[], score: integer }` — include a clear `description` and example values
    - Response `400`: `{ error: "sessionId is required" }`
    - Response `404`: `{ error: "Session not found" }`
    - Response `409` (two examples):
      - `{ error: "Session is not in progress or completed" }` — when status is ABANDONED
      - `{ error: "Evaluation already exists" }` — when an evaluation row already exists
    - Response `502`: `{ error: "AI returned an unparseable evaluation" }`
    - Response `500`: `{ error: "Internal server error" }`

- **Testing**:
  - Unit: none (YAML is documentation).
  - Integration: validate the YAML is well-formed by running `npx js-yaml docs/openapi.yaml` or similar; if no YAML validator is installed, visually inspect indentation.
  - Manual: open the YAML file, verify the `/api/interview` 200 response no longer references `nextQuestion`/`isComplete`, the `502` entry is present, and the `/api/evaluate` entry covers all six response codes.

---

## Data migrations

No Prisma schema changes are required. All necessary models (`Session`, `Turn`, `Evaluation`) and their fields (`strengths Json`, `concerns Json`, `score Int`, `endedAt DateTime?`) already exist. Do not run any migration commands.

## API documentation updates

- `POST /api/interview` — updated in T7. The 200 response changes from `application/json` with `{ nextQuestion, isComplete }` to `text/plain; charset=utf-8` with a streaming body. A new `502` response is added.
- `POST /api/evaluate` — new endpoint, documented in T7. All six response codes (201/400/404/409/502/500) must be present in `docs/openapi.yaml`.

## Cross-cutting concerns

- **`aiClient` singleton** (`src/lib/ai-client.ts`): shared by T4 (`/api/interview`) and T5 (`/api/evaluate`). Must be fully implemented in T3 before T4 and T5 begin.
- **Prompt builders** (`src/lib/anthropic.ts`): `buildInterviewSystemPrompt` used by T4; `buildEvaluationPrompt` used by T5. Both must be implemented in T2 before T4 and T5 begin.
- **`[INTERVIEW_COMPLETE]` sentinel constant**: defined as a string literal `'[INTERVIEW_COMPLETE]'` in both the interview route (T4) and `InterviewRoom.tsx` (T6). It must match exactly. Consider extracting it to a shared constant in `src/lib/anthropic.ts` (e.g. `export const INTERVIEW_COMPLETE_SENTINEL = '[INTERVIEW_COMPLETE]';`) to prevent typo drift. T4 and T6 implementers should both import this constant.
- **`PostInterviewResponse` removal**: T6 removes the type from `src/types/index.ts` and its import from `InterviewRoom.tsx`. T4 removes its import from `src/app/api/interview/route.ts` as part of the route rewrite. Implementers must coordinate — T4 should already drop this import; T6 cleans up the type definition itself.
- **npm packages**: T1 installs `@anthropic-ai/sdk` and `openai`. T3 (and indirectly T4/T5 via T3) depends on these packages. T1 must be fully merged (i.e. `package.json` and `package-lock.json` committed) before T3 begins coding.
