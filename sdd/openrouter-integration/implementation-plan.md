# Implementation Plan: OpenRouter Integration — Adaptive Follow-Up Questions

## Overview

After the Anthropic-driven main interview concludes (Claude signals `isComplete: true` internally), the `POST /api/interview` route generates up to 2 additional adaptive follow-up questions via a dedicated OpenRouter client before returning `isComplete: true` to the candidate. Phase routing is determined by counting existing `OPENROUTER`-sourced AI `Turn` rows; the `Turn` model gains a nullable `TurnSource` enum field to track AI provenance.

## Prerequisites

- PostgreSQL must be running and `DATABASE_URL` set. The Prisma migration added in T1 must be applied before T4 can be deployed or tested end-to-end.
- `OPENROUTER_API_KEY` is optional at runtime — its absence triggers graceful degradation; the server still starts normally without it.
- The `openai` npm package (v6.45.0) is already installed. No new dependency is needed.

## Task Graph

| Task | Wave | Type     | Description                                                                                     | Depends on   |
|------|------|----------|-------------------------------------------------------------------------------------------------|--------------|
| T1   | 1    | backend  | Prisma schema: add `TurnSource` enum and nullable `source` field to `Turn`; create migration    | —            |
| T2   | 1    | backend  | Create `src/lib/openrouter.ts` with `generateAdaptiveFollowUp`; add `OPENROUTER_FOLLOWUP_MODEL` to `.env.example` | — |
| T3   | 1    | backend  | Add `PostInterviewSuccessResponse` interface to `src/types/index.ts`                           | —            |
| T4   | 2    | backend  | Rewrite `POST /api/interview` route with phase routing; update `docs/openapi.yaml`              | T1, T2, T3  |
| T5   | 2    | frontend | Update `InterviewRoom.tsx` type import from `PostInterviewResponse` to `PostInterviewSuccessResponse` | T3      |

Wave 1 tasks are fully parallel. Wave 2 tasks start only when all Wave 1 tasks are complete. T4 and T5 within Wave 2 are independent and may run in parallel.

## Task Details

### T1: Prisma schema migration — add `TurnSource` enum and `source` field to `Turn`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `prisma/schema.prisma` — add `TurnSource` enum; add `source TurnSource?` field to `Turn` model
- **Implementation notes**:
  Add the `TurnSource` enum immediately before the existing `Speaker` enum (keep enums grouped):
  ```prisma
  enum TurnSource {
    ANTHROPIC
    OPENROUTER
  }
  ```
  Add the `source` field to the `Turn` model after the `content` field and before `decisionState`:
  ```prisma
  source TurnSource?
  ```
  No `@map` directive is needed because the field name `source` is already snake_case and matches the intended DB column name exactly.

  The complete updated `Turn` model must read:
  ```prisma
  model Turn {
    id            String      @id @default(cuid())
    sessionId     String      @map("session_id")
    session       Session     @relation(fields: [sessionId], references: [id])
    speaker       Speaker
    content       String
    source        TurnSource?
    decisionState Json?       @map("decision_state")
    createdAt     DateTime    @default(now()) @map("created_at")

    @@map("turns")
  }
  ```

  After editing the schema, run:
  ```bash
  npx prisma migrate dev --name add_source_to_turns
  npx prisma generate
  ```

  The migration adds the `TurnSource` Postgres enum type and a nullable `source` column to `turns`. Existing rows receive `NULL` for `source`, which is the correct default for pre-existing AI turns and all `USER`-speaker turns.

- **Testing**:
  - Unit: none required for a schema-only migration.
  - Integration: open Prisma Studio (`npx prisma studio`) after the migration and verify the `turns` table shows a nullable `source` column of the `TurnSource` enum type. Confirm existing rows show `NULL`.
  - Manual: run `npx tsc --noEmit` to confirm the generated Prisma client exposes `source` as `TurnSource | null` on the `Turn` type with no compilation errors.

---

### T2: Create `src/lib/openrouter.ts` and update `.env.example`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/lib/openrouter.ts` — new server-only file; exports `generateAdaptiveFollowUp`
  - `.env.example` — add `OPENROUTER_FOLLOWUP_MODEL` optional variable
- **Implementation notes**:
  Create `src/lib/openrouter.ts`. This file must NOT include a `'use client'` directive and must NOT be barrel-exported through any client-facing index.

  Exported function signature:
  ```typescript
  export async function generateAdaptiveFollowUp(
    transcript: Array<{ speaker: string; content: string }>,
    followUpIndex: 1 | 2
  ): Promise<string | null>
  ```

  Implementation requirements:

  1. **Lazy key check** — at the start of the function body (not at module load), read `process.env.OPENROUTER_API_KEY`. If the value is falsy (absent or empty string), immediately `return null` without throwing. This allows the server to start normally without the key.

  2. **Lazy client construction** — after the key check, instantiate an `OpenAI` client (from the `openai` package, already installed) inside the function body:
     ```typescript
     import OpenAI from 'openai';

     const client = new OpenAI({
       baseURL: 'https://openrouter.ai/api/v1',
       apiKey: process.env.OPENROUTER_API_KEY,
       defaultHeaders: {
         'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
         'X-Title': 'AI Interviewer Platform',
       },
     });
     ```

  3. **Model selection** — use `process.env.OPENROUTER_FOLLOWUP_MODEL ?? 'meta-llama/llama-3.1-8b-instruct'`.

  4. **Transcript formatting** — map the `transcript` array into a string where `AI`-speaker entries are labelled `INTERVIEWER` and all other entries are labelled `CANDIDATE`. Join entries with `\n\n`.

  5. **User message** — send a single `user` role message asking the model to generate one concrete, adaptive follow-up question grounded in the candidate's specific answers, indicating this is follow-up number `followUpIndex`. The message must request plain text — not JSON.

  6. **Non-streaming call** — use `client.chat.completions.create({ model, stream: false, messages })` and extract `response.choices[0]?.message?.content ?? ''`.

  7. **Return value** — return the result of `.trim()` on the extracted content string. Return even if the trimmed string is empty; the route handler (T4) checks for empty string.

  8. **Error propagation** — do NOT wrap the `OpenAI` SDK call in try/catch inside this function. Let network errors, rate-limit errors, and 4xx/5xx SDK errors propagate as thrown exceptions. The route handler is responsible for catching them and degrading gracefully.

  For `.env.example`, add the following block after the existing `OPENROUTER_MODEL` line:
  ```
  # Optional — model for adaptive follow-up questions; defaults to "meta-llama/llama-3.1-8b-instruct"
  OPENROUTER_FOLLOWUP_MODEL="meta-llama/llama-3.1-8b-instruct"
  ```

- **Testing**:
  - Unit: write `src/__tests__/openrouter.test.ts`. Mock the `openai` module using `jest.unstable_mockModule`. Test: (a) returns `null` without throwing when `OPENROUTER_API_KEY` is absent or empty; (b) calls `chat.completions.create` with `stream: false` and the correct model string; (c) returns the trimmed content string on a successful API call; (d) propagates SDK errors — assert that a thrown SDK error is not swallowed by the function (use `expect(...).rejects.toThrow()`).
  - Integration: none required at this layer; integration is validated by T4's manual test.
  - Manual: with a valid `OPENROUTER_API_KEY` set locally, call the function from a one-off script (`npx tsx`) and verify a non-empty question string is returned.

---

### T3: Add `PostInterviewSuccessResponse` to `src/types/index.ts`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — add `PostInterviewSuccessResponse` interface after `PostInterviewResponse`
- **Implementation notes**:
  Insert the following exported interface immediately after the existing `PostInterviewResponse` interface (currently around line 120):
  ```typescript
  export interface PostInterviewSuccessResponse {
    nextQuestion: string;
    isComplete: boolean;
    decisionState: DecisionState | null;
  }
  ```

  Do NOT modify `ClaudeInterviewResponse` or `PostInterviewResponse`. `ClaudeInterviewResponse.decisionState` remains `DecisionState` (non-nullable) because it accurately represents Anthropic's structured response shape and the `claudeResponse.decisionState as object` cast used when persisting Anthropic AI turns relies on this being non-nullable. `PostInterviewResponse.decisionState` also remains `DecisionState` (non-nullable) for backward compatibility with existing test snapshots; the route will use `PostInterviewSuccessResponse` instead.

  `PostInterviewSuccessResponse` is the type used as `NextResponse.json<PostInterviewSuccessResponse>()` in all success branches of `POST /api/interview` (T4), explicitly allowing `decisionState: null` for OpenRouter follow-up turns and the static closing statement.

- **Testing**:
  - Unit: none required for a type-only addition.
  - Manual: run `npx tsc --noEmit` — must pass with no errors. The interface should be importable from `@/types` in both the route handler and `InterviewRoom.tsx`.

---

### T4: Rewrite `POST /api/interview` route with phase routing; update OpenAPI

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — replace single-phase Anthropic logic with three-phase routing
  - `docs/openapi.yaml` — update `POST /api/interview` description and `decisionState` schema
- **Implementation notes**:

  **Imports to change in `route.ts`:**
  - Add: `import { generateAdaptiveFollowUp } from '@/lib/openrouter';`
  - Replace: `PostInterviewResponse` → `PostInterviewSuccessResponse` in the import from `@/types`

  **Constant to add at module level:**
  ```typescript
  const CLOSING_STATEMENT =
    "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.";
  ```

  **Phase routing logic** — after the user-answer save block (steps 1–6 in the current code), replace the existing Anthropic-call-and-save block with the three-phase logic described below.

  **Step A — Count OpenRouter turns from `existingTurns`:**
  ```typescript
  const openrouterCount = existingTurns.filter(
    (t) => t.speaker === 'AI' && t.source === 'OPENROUTER'
  ).length;
  ```
  `existingTurns` is fetched before saving the user answer. This count is correct because OpenRouter turns are only added in prior requests, never in the current request's user-save step.

  **Step B — Add `source: 'ANTHROPIC'` to initial AI question save:**
  The existing transaction that saves the first-turn initial AI question (the `!hasAiTurns` branch) must set `source: 'ANTHROPIC'` on the turn create:
  ```typescript
  prisma.turn.create({
    data: {
      sessionId,
      speaker: 'AI',
      content: currentQuestion,
      source: 'ANTHROPIC',
      decisionState: Prisma.JsonNull,
    },
  }),
  ```

  **Step C — `fetchFullTranscript` helper:**
  Define an inner async function used before each OpenRouter call. It re-fetches after the user answer has been saved, ensuring the latest user turn is included:
  ```typescript
  async function fetchFullTranscript() {
    const allTurns = await prisma.turn.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return allTurns.map((t) => ({
      speaker: t.speaker as string,
      content: t.content,
    }));
  }
  ```

  **Phase: complete** (`openrouterCount >= 2`) — save closing turn and mark `COMPLETED` in a single `$transaction`; return `isComplete: true`:
  ```typescript
  if (openrouterCount >= 2) {
    await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: CLOSING_STATEMENT,
          source: 'ANTHROPIC',
          decisionState: Prisma.JsonNull,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      }),
    ]);
    return NextResponse.json<PostInterviewSuccessResponse>({
      nextQuestion: CLOSING_STATEMENT,
      isComplete: true,
      decisionState: null,
    });
  }
  ```

  **Phase: openrouter-followup-2** (`openrouterCount === 1`) — attempt follow-up 2; fall through to complete on failure:
  ```typescript
  if (openrouterCount === 1) {
    let followUp2: string | null = null;
    try {
      const transcript = await fetchFullTranscript();
      followUp2 = await generateAdaptiveFollowUp(transcript, 2);
    } catch {
      followUp2 = null; // graceful degradation on network/API error
    }
    if (followUp2 && followUp2.trim()) {
      await prisma.turn.create({
        data: { sessionId, speaker: 'AI', content: followUp2.trim(), source: 'OPENROUTER' },
      });
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion: followUp2.trim(),
        isComplete: false,
        decisionState: null,
      });
    }
    // Follow-up 2 failed — complete the interview
    await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: CLOSING_STATEMENT,
          source: 'ANTHROPIC',
          decisionState: Prisma.JsonNull,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      }),
    ]);
    return NextResponse.json<PostInterviewSuccessResponse>({
      nextQuestion: CLOSING_STATEMENT,
      isComplete: true,
      decisionState: null,
    });
  }
  ```

  **Phase: main-interview** (`openrouterCount === 0`) — call Anthropic as today; then gate on `claudeResponse.isComplete`:

  Keep the `buildInterviewSystemPrompt` + `callClaudeForNextQuestion` calls and the same try/catch that returns `500 { error: 'AI service unavailable. Please try again.' }` on Anthropic failure.

  After `callClaudeForNextQuestion` succeeds:

  - **If `claudeResponse.isComplete === false`** — save Anthropic turn with `source: 'ANTHROPIC'` and return normally:
    ```typescript
    await prisma.turn.create({
      data: {
        sessionId,
        speaker: 'AI',
        content: claudeResponse.question,
        source: 'ANTHROPIC',
        decisionState: claudeResponse.decisionState as object,
      },
    });
    return NextResponse.json<PostInterviewSuccessResponse>({
      nextQuestion: claudeResponse.question,
      isComplete: false,
      decisionState: claudeResponse.decisionState,
    });
    ```

  - **If `claudeResponse.isComplete === true`** — attempt follow-up 1:
    ```typescript
    let followUp1: string | null = null;
    try {
      const transcript = await fetchFullTranscript();
      followUp1 = await generateAdaptiveFollowUp(transcript, 1);
    } catch {
      followUp1 = null;
    }
    if (followUp1 && followUp1.trim()) {
      // Do NOT save Anthropic's closing turn; do NOT mark session COMPLETED
      await prisma.turn.create({
        data: { sessionId, speaker: 'AI', content: followUp1.trim(), source: 'OPENROUTER' },
      });
      return NextResponse.json<PostInterviewSuccessResponse>({
        nextQuestion: followUp1.trim(),
        isComplete: false,
        decisionState: null,
      });
    }
    // Follow-up 1 failed — fall through: use Anthropic closing and complete
    await prisma.$transaction([
      prisma.turn.create({
        data: {
          sessionId,
          speaker: 'AI',
          content: claudeResponse.question,
          source: 'ANTHROPIC',
          decisionState: claudeResponse.decisionState as object,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      }),
    ]);
    return NextResponse.json<PostInterviewSuccessResponse>({
      nextQuestion: claudeResponse.question,
      isComplete: true,
      decisionState: claudeResponse.decisionState,
    });
    ```

  **`Prisma.JsonNull` usage**: Use `decisionState: Prisma.JsonNull` for turns that store no decision state (OpenRouter turns, closing-statement turns). Use `claudeResponse.decisionState as object` only for Anthropic-generated turns where the `decisionState` object is populated. `Prisma.JsonNull` stores SQL `NULL` in the JSON column; JavaScript `null` would be treated differently by Prisma and stored as the JSON string `"null"`.

  **OpenAPI changes in `docs/openapi.yaml`:**

  Update the `description` field for `POST /api/interview` to document three-phase behaviour: the Anthropic main interview drives the primary Q&A; after Anthropic signals internal completion, up to 2 additional OpenRouter-powered adaptive follow-up questions are injected (one per request) before `isComplete: true` is returned; if `OPENROUTER_API_KEY` is absent or OpenRouter fails, the interview completes gracefully without follow-ups.

  Update the `200` response `decisionState` schema from a required plain object to a `oneOf` that allows `null`:
  ```yaml
  decisionState:
    oneOf:
      - type: object
        required: [detectedSkills, coveredTopics, remainingGaps, questionRationale]
        properties:
          detectedSkills:
            type: array
            items: { type: string }
          coveredTopics:
            type: array
            items: { type: string }
          remainingGaps:
            type: array
            items: { type: string }
          questionRationale:
            type: string
      - type: 'null'
  ```

  Add an `openrouterFollowUp` example to the existing `200` `examples` block:
  ```yaml
  openrouterFollowUp:
    summary: OpenRouter adaptive follow-up question (decisionState is null)
    value:
      nextQuestion: "You mentioned struggling with async race conditions — can you walk me through the debugging approach you took?"
      isComplete: false
      decisionState: null
  ```

- **Testing**:
  - Unit: write `src/__tests__/interview-route-phase.test.ts`. Mock `@/lib/prisma`, `@/lib/anthropic` (`callClaudeForNextQuestion`), and `@/lib/openrouter` (`generateAdaptiveFollowUp`) using `jest.unstable_mockModule`. Cover these seven branches: (1) `openrouterCount >= 2` → closing statement, `isComplete: true`, session marked COMPLETED in transaction; (2) `openrouterCount === 1` + OpenRouter success → follow-up question, `isComplete: false`, OPENROUTER turn saved; (3) `openrouterCount === 1` + OpenRouter returns `null` → fall through to complete; (4) `openrouterCount === 1` + OpenRouter throws → fall through to complete; (5) `openrouterCount === 0` + Anthropic `isComplete: false` → Anthropic question returned, ANTHROPIC turn saved; (6) `openrouterCount === 0` + Anthropic `isComplete: true` + OpenRouter success → follow-up 1 returned, `isComplete: false`, OPENROUTER turn saved, session NOT marked COMPLETED; (7) `openrouterCount === 0` + Anthropic `isComplete: true` + OpenRouter failure → Anthropic closing returned, `isComplete: true`, session marked COMPLETED.
  - Integration: run `npx tsc --noEmit` after implementation to confirm no type errors.
  - Manual: start the dev server with a valid `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY`. Run a full interview. After Anthropic signals completion, verify two additional questions appear before the completion screen. Inspect the `turns` table and confirm follow-up turns have `source = 'OPENROUTER'`. Verify the session stays `IN_PROGRESS` during follow-ups and becomes `COMPLETED` only after the static closing statement. Repeat with `OPENROUTER_API_KEY` unset and confirm the interview completes normally after Anthropic's closing statement.

---

### T5: Update `InterviewRoom.tsx` type import

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — replace `PostInterviewResponse` import and type assertion with `PostInterviewSuccessResponse`
- **Implementation notes**:
  The existing `InterviewRoom.tsx` already sends `currentQuestion` (not `turnNumber`) in the request body and already calls `res.json()` to parse the response — those fixes are already in place. The only changes required are:

  1. In the import block, replace `PostInterviewResponse` with `PostInterviewSuccessResponse`:
     ```typescript
     import type {
       Job,
       InterviewRoomState,
       InterviewRoomAction,
       PostSessionResponse,
       PostInterviewSuccessResponse,
     } from '@/types';
     ```

  2. In `submitTurn`, change the type assertion on `res.json()`:
     ```typescript
     const data = (await res.json()) as PostInterviewSuccessResponse;
     ```

  No logic changes are needed. The `data.decisionState ?? null` null-coalescing already present in the `TURN_SAVED` dispatch correctly handles `decisionState: null` from OpenRouter responses.

- **Testing**:
  - Unit: update `src/__tests__/InterviewRoom.test.tsx` — any `fetch` mock that returns a `PostInterviewResponse`-shaped object should be updated so that `decisionState` can be `null`. Verify that a mocked response with `decisionState: null` causes the `TURN_SAVED` dispatch to receive `decisionState: null` without throwing a type error or runtime exception.
  - Manual: run `npx tsc --noEmit` to confirm no errors. Open the interview room in a browser and verify the existing turn-submission flow is visually unchanged.

---

## Data migrations

Add the following to `prisma/schema.prisma` before the `Speaker` enum:

```prisma
enum TurnSource {
  ANTHROPIC
  OPENROUTER
}
```

Add the following field to the `Turn` model after `content` and before `decisionState`:

```prisma
source TurnSource?
```

The DB column name is `source` (no `@map` needed; the field name is already snake_case).

Migration command:
```bash
npx prisma migrate dev --name add_source_to_turns
npx prisma generate
```

Existing `Turn` rows receive `NULL` for `source`. No backfill is required.

## API documentation updates

`POST /api/interview` in `docs/openapi.yaml` (updated by T4 backend implementer):
- `description`: describe the three-phase behaviour — main interview via Anthropic, then up to 2 OpenRouter follow-ups, then static closing with `isComplete: true`.
- `200` response `decisionState` schema: change from a required object to `oneOf` allowing `null`.
- `200` response `examples`: add `openrouterFollowUp` example showing `decisionState: null`.

No new endpoints are introduced by this feature.

## Cross-cutting concerns

- **`generateAdaptiveFollowUp` is server-only.** Verify `src/lib/openrouter.ts` has no `'use client'` directive and is not re-exported from any client-facing barrel.
- **`Prisma.JsonNull` vs JavaScript `null` for `decisionState`.** The route must use `Prisma.JsonNull` (imported from `@/generated/prisma/client`) when saving turns without a decisionState. Using plain JavaScript `null` would cause Prisma to emit the JSON string `"null"` rather than SQL `NULL`.
- **`TurnSource` string literals vs enum import.** After running `npx prisma generate`, the generated client accepts the string literals `'ANTHROPIC'` and `'OPENROUTER'` directly in `turn.create({ data: { source: 'ANTHROPIC' } })` due to TypeScript's enum assignability. An explicit `import { TurnSource } from '@/generated/prisma/client'` is not required in the route handler, but is acceptable if the implementer prefers it.
- **`PostInterviewSuccessResponse` is the authoritative response type for `POST /api/interview`.** Both T4 (route) and T5 (component) must use this type. The existing `PostInterviewResponse` interface in `src/types/index.ts` is kept unchanged to avoid breaking test snapshots that reference it; it is simply no longer used by the route.
