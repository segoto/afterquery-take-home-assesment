# Feature Spec: Adaptive Question Bank — DB-Driven Design

## Overview

This feature replaces the static TypeScript question bank (`src/lib/question-bank.ts`) with a database-driven approach. Interview questions are stored in the existing `Question` Prisma model, associated directly with a `Job` via a new `jobId` foreign key, and seeded into the database via `prisma/seed.ts` on first deploy. On each interview turn, `POST /api/interview` fetches the question bank from the database, filters out questions whose IDs have already been stored in `Turn.decisionState.selectedQuestionId`, and sends the remaining candidates to the AI model for adaptive selection via the existing `bank-selection.ts` logic. The no-repeat guarantee, OpenRouter follow-up phases, and all other existing route behaviours are preserved unchanged.

## Scope

**Included:**
- `prisma/schema.prisma` — Modify `Question` model: make `skillId` nullable, add direct `jobId` nullable field and `job` relation; add `questions Question[]` to `Job` model
- New Prisma migration — `make_skill_nullable_add_job_id_to_questions` (additive only: makes one column nullable, adds one nullable column)
- `prisma/seed.ts` — Add seed questions for all 12 jobs (≥10 per job) with `jobId` set directly and `skillId: null`; existing skill-based question seeds for SWE/PM/DA remain unchanged
- `src/types/index.ts` — Define `BankQuestion` locally (remove re-export from deleted file); drop the `skill` field from `BankQuestion`
- `src/lib/bank-selection.ts` — Update import source for `BankQuestion` (from `@/types` instead of `@/lib/question-bank`); update prompt line format to omit the `skill` label
- `src/app/api/interview/route.ts` — Replace `getStaticQuestionBank()` call with `prisma.question.findMany({ where: { jobId: session.jobId }, select: { id, text, type } })`; remove import of `@/lib/question-bank`
- `src/__tests__/bank-selection.test.ts` — Update `BankQuestion` fixtures to remove `skill` field (no other assertion changes)
- `src/__tests__/interview-route.test.ts` — Replace `@/lib/question-bank` mock with `prisma.question.findMany` mock inside the existing prisma mock object; update `BankQuestion` fixtures to remove `skill` field; all existing test assertions preserved
- **DELETED**: `src/lib/question-bank.ts` — static question arrays replaced by DB seed
- **DELETED**: `src/__tests__/question-bank.test.ts` — tests a file that no longer exists

**Explicitly out of scope:**
- `src/components/InterviewRoom.tsx` — the `currentQuestion`/JSON-parse fix was already applied and is not repeated here
- `src/lib/questions.ts` — the existing `getQuestionBank(jobId, seniority)` DB helper (fetches via skills) is preserved unchanged for potential future use
- Admin UI for question management
- Seniority-based question filtering
- Changes to `POST /api/evaluate` or the results page
- OpenRouter follow-up logic (covered by the `openrouter-integration` spec, already implemented)
- AI-generated fallback questions when the bank is exhausted below 6 turns (model closes gracefully when given empty remaining questions)

## User Stories

- As a candidate, I want the AI interviewer to ask questions drawn from a curated bank stored in the database so that questions are consistent and role-appropriate for every session.
- As a candidate, I want no question to be repeated within my session so that my interview time is used efficiently.
- As a candidate, I want at least 2 questions to be selected because of something I said in a prior answer so that the interview adapts to my responses.
- As a platform operator, I want questions to be managed through the database (seeded via `prisma/seed.ts`) so that content updates can be deployed as migrations without modifying TypeScript source files.
- As a developer, I want `src/lib/question-bank.ts` deleted and replaced by seed data so that there is no divergence between TypeScript-defined questions and the live database state.

## Functional Requirements

### 1. Prisma Schema Changes

1. The `Question` model in `prisma/schema.prisma` must be modified so that `skillId` is nullable (`String?` instead of `String`). The `skill` relation becomes `Skill?` with an appropriate optional relation annotation. The `onDelete: Cascade` on the skill relation must be changed to `onDelete: SetNull` to allow questions with `skillId: null` to exist independently.

2. A new nullable field `jobId String? @map("job_id")` must be added to the `Question` model. A corresponding optional relation `job Job? @relation(fields: [jobId], references: [id], onDelete: Cascade)` must be added. DB column name is `job_id` (snake_case, via `@map`).

3. The `Job` model must gain a `questions Question[]` relation field to complete the two-way Prisma relation.

4. The updated `Question` model must compile without errors under `npx prisma generate`.

5. The `QuestionType` enum (`TECHNICAL`, `BEHAVIORAL`, `SITUATIONAL`) already in the schema is reused unchanged.

**Resulting Question model shape (for implementer reference):**
```prisma
model Question {
  id        String       @id @default(cuid())
  jobId     String?      @map("job_id")
  skillId   String?      @map("skill_id")
  text      String
  seniority Seniority?
  type      QuestionType
  job       Job?         @relation(fields: [jobId], references: [id], onDelete: Cascade)
  skill     Skill?       @relation(fields: [skillId], references: [id], onDelete: SetNull)
  createdAt DateTime     @default(now()) @map("created_at")

  @@map("questions")
}
```

### 2. Prisma Migration

6. A new migration named `make_skill_nullable_add_job_id_to_questions` must be created via `npx prisma migrate dev --name make_skill_nullable_add_job_id_to_questions`. It must produce SQL that:
   - Drops the NOT NULL constraint on `skill_id` in the `questions` table
   - Adds a nullable `job_id` column of type `TEXT` (or the appropriate varchar) to the `questions` table
   - Adds a foreign key constraint from `questions.job_id` to `jobs.id` with `ON DELETE CASCADE`

7. The migration must be applied to the local dev database before the seed step.

### 3. Seed Data (`prisma/seed.ts`)

8. `prisma/seed.ts` must be extended to seed ≥10 questions for each of the 12 jobs in `src/lib/jobs.ts`. Each new question must be inserted with `jobId` set to the job's DB ID (looked up via `job.findUniqueOrThrow({ where: { slug: ... } })`) and `skillId: null`.

9. Questions are upserted (not inserted), using the question `id` as the upsert key so that re-running the seed is idempotent.

10. New bank question IDs must follow the pattern `qb-<abbrev>-<NNN>` where `<abbrev>` is a 2–6 character unique lowercase abbreviation for the job, and `<NNN>` is a 3-digit zero-padded integer starting at 001. All question IDs across all 12 banks must be globally unique. Example: `qb-swe-001` for the first Software Engineer bank question; `qb-sre-005` for the fifth Site Reliability Engineer bank question.

11. Abbreviations per job (implementer must use exactly these to avoid collisions):
    - Software Engineer → `swe`
    - Product Manager → `pm`
    - Data Analyst → `da`
    - Frontend Engineer → `fe`
    - Backend Engineer → `be`
    - DevOps Engineer → `dvo`
    - Data Engineer → `de`
    - ML Engineer → `mle`
    - QA Engineer → `qa`
    - Product Manager – Technical → `pmt`
    - Site Reliability Engineer → `sre`
    - Security Engineer → `sec`

12. Each job's bank must contain: at minimum 3 questions of type `TECHNICAL`, at minimum 3 of type `BEHAVIORAL`, and at minimum 2 of type `SITUATIONAL`. The remaining questions (at minimum 2) may be any type.

13. The existing skill-based question seeds for Software Engineer, Product Manager, and Data Analyst (using IDs like `qswe-sys-001`, `qspm-str-001`, etc.) must remain in `prisma/seed.ts` unchanged to preserve backward compatibility with sessions that have already run.

14. The seed function must log a success message per job after seeding that job's questions (e.g., `"Seeded 12 bank questions for Software Engineer."`).

### 4. `BankQuestion` Type (`src/types/index.ts`)

15. The line `export type { BankQuestion } from '@/lib/question-bank';` must be REMOVED from `src/types/index.ts` (since `question-bank.ts` is being deleted).

16. `BankQuestion` must be defined directly in `src/types/index.ts`:
    ```typescript
    export interface BankQuestion {
      id: string;
      text: string;
      type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
    }
    ```
    The `skill` field is intentionally omitted. DB-sourced questions carry no separate skill label; the `type` field provides sufficient categorisation for the selection prompt.

17. All other types in `src/types/index.ts` — `BankSelectionResponse`, `DecisionState`, `ClaudeInterviewResponse`, `PostInterviewSuccessResponse`, and all auth/session/interview types — remain unchanged.

### 5. `src/lib/bank-selection.ts`

18. The import `import type { BankQuestion } from '@/lib/question-bank';` must be removed and replaced with `import type { BankQuestion } from '@/types';`.

19. The question line format inside `buildBankSelectionPrompt` must be changed from:
    ```typescript
    `[id: ${q.id}] (${q.type} | ${q.skill}) ${q.text}`
    ```
    to:
    ```typescript
    `[id: ${q.id}] (${q.type}) ${q.text}`
    ```
    This is the only change to the prompt format; all selection rules, JSON shape instruction, tracking fields instruction, and completion logic remain identical.

20. All other code in `src/lib/bank-selection.ts` — `buildBankSelectionPrompt` structure, `callModelForBankSelection` logic, JSON fence-stripping, safe defaults — is preserved unchanged.

### 6. Route: `src/app/api/interview/route.ts`

21. The import `import { getStaticQuestionBank } from '@/lib/question-bank';` must be removed entirely.

22. The line `const fullBank = getStaticQuestionBank(session.jobId);` must be replaced with a Prisma query:
    ```typescript
    const fullBank = await prisma.question.findMany({
      where: { jobId: session.jobId },
      select: { id: true, text: true, type: true },
      orderBy: { createdAt: 'asc' },
    });
    ```
    The result is typed as `Array<{ id: string; text: string; type: QuestionType }>` where `QuestionType` is imported from `@/generated/prisma/client`.

23. Since `BankQuestion` no longer has a `skill` field, the `BankQuestion[]` type is now fully compatible with the result of the `findMany` query above (both have `id`, `text`, `type`). The route must cast or assign the result directly as `BankQuestion[]`. If the Prisma-generated `QuestionType` enum values differ in TypeScript from the literal union in `BankQuestion`, an explicit cast `as BankQuestion[]` is acceptable.

24. All other route logic is preserved unchanged: session validation (400/404/409), deduplication guard, user/AI turn saving, `usedQuestionIds` computation from `decisionState.selectedQuestionId`, `remainingQuestions` filtering, `aiTurnCount` computation, bank-exhausted path, `callModelForBankSelection` call, OpenRouter follow-up phases, session completion.

### 7. File Deletions

25. `src/lib/question-bank.ts` must be deleted. No TypeScript source file in `src/` may import from `@/lib/question-bank` after this deletion.

26. `src/__tests__/question-bank.test.ts` must be deleted. It tested the now-deleted static file and provides no value in the DB-driven design.

### 8. Test Updates

27. `src/__tests__/bank-selection.test.ts` — The `BankQuestion` fixtures must be updated to remove the `skill` field, since `BankQuestion` no longer has that field:
    ```typescript
    const sampleBank: BankQuestion[] = [
      { id: 'sqb-swe-001', text: 'Describe your TypeScript experience.', type: 'TECHNICAL' },
      { id: 'sqb-swe-002', text: 'Tell me about a time you handled a production incident.', type: 'BEHAVIORAL' },
    ];
    ```
    All 10 existing test assertions remain valid and must continue to pass without other changes.

28. `src/__tests__/bank-selection.test.ts` — The test that checks prompt format (`'includes each question id and text when remainingQuestions is non-empty'`) must continue to pass. Since the prompt no longer emits `q.skill`, the test must NOT assert on skill being in the prompt. Verify the existing assertion only checks for `question.id` and `question.text` — no change needed to the assertion itself.

29. `src/__tests__/interview-route.test.ts` — The `@/lib/question-bank` mock block must be removed:
    ```typescript
    // REMOVE this entire block:
    jest.unstable_mockModule('@/lib/question-bank', () => ({
      getStaticQuestionBank: mockGetStaticQuestionBank,
      QUESTION_BANKS: {},
    }));
    ```

30. `src/__tests__/interview-route.test.ts` — The `mockGetStaticQuestionBank` function declaration must be removed.

31. `src/__tests__/interview-route.test.ts` — A new mock function must be added for `prisma.question.findMany`:
    ```typescript
    const mockQuestionFindMany = jest.fn<
      (args: unknown) => Promise<Array<{ id: string; text: string; type: string }>>
    >();
    ```

32. `src/__tests__/interview-route.test.ts` — The prisma mock object must include `question: { findMany: mockQuestionFindMany }`:
    ```typescript
    jest.unstable_mockModule('@/lib/prisma', () => ({
      prisma: {
        session: { findUnique: mockSessionFindUnique, update: mockSessionUpdate },
        turn: { create: mockTurnCreate, findMany: mockTurnFindMany },
        question: { findMany: mockQuestionFindMany },
        $transaction: mockTransaction,
      },
    }));
    ```

33. `src/__tests__/interview-route.test.ts` — The `defaultBank` fixture must be updated to remove `skill`:
    ```typescript
    const defaultBank: BankQuestion[] = [
      { id: 'qb-swe-001', text: 'Q1', type: 'TECHNICAL' },
      { id: 'qb-swe-002', text: 'Q2', type: 'BEHAVIORAL' },
    ];
    ```

34. `src/__tests__/interview-route.test.ts` — In `beforeEach`, replace `mockGetStaticQuestionBank.mockReturnValue(defaultBank)` with `mockQuestionFindMany.mockResolvedValue(defaultBank)`.

35. `src/__tests__/interview-route.test.ts` — The bank-exhausted path tests that previously set `mockGetStaticQuestionBank.mockReturnValue([])` must be updated to set `mockQuestionFindMany.mockResolvedValue([])`. All other assertions in those tests remain unchanged.

36. `src/__tests__/interview-route.test.ts` — The no-repeat guarantee test that checks `buildBankSelectionPrompt.mock.calls[0][2]` (the third argument, `remainingQuestions`) must continue to assert that the already-used question ID is excluded. The test logic is unchanged; only the mock setup changes from the static bank mock to the Prisma mock.

37. All existing test assertions (400/404/409/500 responses, deduplication guard, turn saving, `selectedQuestionId` in stored `decisionState`, bank-exhausted static closing statement, `isComplete: true` when model signals completion) must continue to pass without modification.

## Non-Functional Requirements

- **Performance**: `prisma.question.findMany({ where: { jobId } })` adds one DB round-trip per interview turn. Expected query time: <10 ms on a properly indexed table. The `job_id` column must be indexed in the migration. The total route latency remains dominated by the AI model call (2–8 s).
- **Security**: No new secrets. The question bank is read-only data; no user input can influence which questions are seeded or their content.
- **Type safety**: All new and modified files must compile with no errors under `npx tsc --noEmit`. No unchecked `any` casts in production code.
- **Idempotency**: Running `npx prisma db seed` multiple times must not create duplicate question rows (upsert on `id` ensures this).
- **Backward compatibility**: Sessions created before this migration was applied have `Turn.decisionState` without `selectedQuestionId`. The route's `usedQuestionIds` computation already handles this by checking for a non-empty string value before adding to the set. Old sessions are unaffected.

## Data Model Changes

The `Question` model is modified as follows:

| Change | Before | After |
|--------|--------|-------|
| `skillId` nullability | `String` (NOT NULL) | `String?` (nullable) |
| `skill` relation | `Skill @relation(...)` required | `Skill? @relation(...)` optional, `onDelete: SetNull` |
| `jobId` field | does not exist | `String? @map("job_id")` nullable |
| `job` relation | does not exist | `Job? @relation(fields: [jobId], references: [id], onDelete: Cascade)` optional |

The `Job` model gains one relation field: `questions Question[]`.

New DB-level columns (all snake_case):
- `questions.job_id` — nullable text, foreign key to `jobs.id`

Existing DB-level column changed:
- `questions.skill_id` — NOT NULL constraint dropped (becomes nullable)

A new index on `questions.job_id` should be included in the migration for query performance.

No other models are changed.

## API Contracts

### POST /api/interview (unchanged except source of bank questions)

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
  "nextQuestion": "Tell me about a time your code design decision turned out to be wrong.",
  "isComplete": false,
  "decisionState": {
    "selectedQuestionId": "qb-swe-004",
    "detectedSkills": ["TypeScript", "API Design"],
    "coveredTopics": ["Background", "TypeScript Experience"],
    "remainingGaps": ["System Design", "Error Handling"],
    "questionRationale": "Candidate described strong TypeScript skills but mentioned a past mistake briefly."
  }
}
```

**Success response (200) — interview complete:**
```json
{
  "nextQuestion": "Thank you for your time today. We've covered all the key areas — we'll be in touch with next steps.",
  "isComplete": true,
  "decisionState": null
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "sessionId, userAnswer, and currentQuestion are required" }` | Any required field missing, not a string, or empty |
| 404 | `{ "error": "Session not found" }` | No session row with the given sessionId |
| 409 | `{ "error": "Session is not in progress" }` | session.status is not IN_PROGRESS |
| 500 | `{ "error": "AI service unavailable. Please try again." }` | `callModelForBankSelection` throws |
| 500 | `{ "error": "Internal server error" }` | Any other unexpected failure |

The only behavioural change from the prior implementation: `fullBank` is now fetched from `prisma.question.findMany({ where: { jobId: session.jobId } })` instead of `getStaticQuestionBank(session.jobId)`. All other route logic is identical.

## UI Behaviour

No UI changes in this feature. `InterviewRoom.tsx` already sends `currentQuestion` and parses responses as JSON (applied in a prior implementation). `DecisionPanel` continues to display `decisionState` as before. The `selectedQuestionId` stored in `decisionState` now references a DB question `id` (e.g., `qb-swe-001`) rather than a static-file ID, but the panel does not render `selectedQuestionId` visually.

## Edge Cases & Error Handling

1. **No bank questions seeded for a job**: `prisma.question.findMany({ where: { jobId } })` returns `[]`. The route enters the bank-exhausted path. If `aiTurnCount >= 6`, returns the static closing statement without calling the model. If `aiTurnCount < 6`, calls the model with `remainingQuestions = []`; the prompt instructs the model to close gracefully.

2. **Model returns a `selectedQuestionId` not present in the returned bank**: The route does not validate that the returned ID matches a question in `fullBank`. The ID is stored in `decisionState` and on subsequent turns appears in `usedQuestionIds`, effectively consuming one bank slot. Acceptable given low hallucination probability.

3. **Model returns `isComplete: true` before 6 questions**: The route respects the model's signal. The prompt instructs the model to ask ≥6 questions; enforcement is not double-checked by the route.

4. **Concurrent requests for the same session**: Two simultaneous requests compute `usedQuestionIds` without seeing each other's in-flight write. Both may select the same question. On subsequent turns, both IDs appear in `usedQuestionIds` and are excluded. The no-repeat guarantee holds for all subsequent turns.

5. **Migration fails to make `skill_id` nullable**: This is a PostgreSQL DDL operation and is non-transactional in some versions. The implementer must verify the migration applies cleanly on the dev DB before committing.

6. **Seed run before migration**: If `prisma db seed` is run before the migration that adds `job_id`, the seed will fail on any question with `jobId` set. The correct order is: `prisma migrate dev` then `prisma db seed`.

7. **`callModelForBankSelection` throws**: Route returns `500 { "error": "AI service unavailable. Please try again." }`. The user turn is already saved. On retry, the same `usedQuestionIds` and `remainingQuestions` are recomputed idempotently and the model is called again.

8. **Old sessions (pre-migration) continue working**: Sessions created before this feature was deployed have no `decisionState.selectedQuestionId`. The `usedQuestionIds` extraction checks `typeof value === 'string' && value !== ''`, so turns with `null` or pre-existing `decisionState` objects without `selectedQuestionId` contribute nothing to the set. Old sessions present the full bank on every new turn.

## Acceptance Criteria

- [ ] `src/lib/question-bank.ts` does not exist in the repository
- [ ] `src/__tests__/question-bank.test.ts` does not exist in the repository
- [ ] No file in `src/` imports from `@/lib/question-bank`
- [ ] `prisma/schema.prisma` `Question` model has `skillId String?` (nullable)
- [ ] `prisma/schema.prisma` `Question` model has `jobId String? @map("job_id")`
- [ ] `prisma/schema.prisma` `Job` model has `questions Question[]` relation
- [ ] A migration file `make_skill_nullable_add_job_id_to_questions` exists in `prisma/migrations/`
- [ ] `prisma/seed.ts` seeds ≥10 questions per job for all 12 jobs with `jobId` set and `skillId: null`
- [ ] Seed questions use IDs matching pattern `qb-<abbrev>-<NNN>` as defined in requirement 11
- [ ] All 12 jobs' seed questions include ≥3 TECHNICAL, ≥3 BEHAVIORAL, and ≥2 SITUATIONAL
- [ ] Seed is idempotent (running twice does not create duplicate rows)
- [ ] `src/types/index.ts` defines `BankQuestion` directly with only `id`, `text`, `type` fields
- [ ] `src/types/index.ts` does NOT re-export from `@/lib/question-bank`
- [ ] `src/lib/bank-selection.ts` imports `BankQuestion` from `@/types`
- [ ] `src/lib/bank-selection.ts` prompt format does not include `q.skill`
- [ ] `src/app/api/interview/route.ts` does not import from `@/lib/question-bank`
- [ ] `src/app/api/interview/route.ts` fetches bank via `prisma.question.findMany({ where: { jobId: session.jobId } })`
- [ ] All existing `POST /api/interview` route behaviour is preserved (400/404/409, deduplication, no-repeat, bank-exhausted path, OpenRouter phases)
- [ ] `src/__tests__/bank-selection.test.ts` `BankQuestion` fixtures have no `skill` field and all tests pass
- [ ] `src/__tests__/interview-route.test.ts` mocks `prisma.question.findMany` instead of `getStaticQuestionBank`
- [ ] `src/__tests__/interview-route.test.ts` has no import or reference to `@/lib/question-bank`
- [ ] `src/__tests__/interview-route.test.ts` all existing assertions pass (validation, no-repeat, bank-exhausted, decisionState saved correctly)
- [ ] `npx tsc --noEmit` passes with no errors after all changes
- [ ] `npx prisma generate` completes without errors after schema changes
- [ ] `npm test` passes with no failing test suites

## Open Decisions

1. **Nullable `skillId` instead of a separate model**: Rather than creating a new `BankQuestion` Prisma model or a new DB table, the existing `Question` model is extended with an optional `jobId`. This avoids a naming collision (model name `Question` is already used), keeps the DB schema smaller, and reuses the existing `QuestionType` enum. Old skill-based questions remain valid with `skillId` set and `jobId null`; new bank questions have `jobId` set and `skillId null`. The two populations coexist cleanly.

2. **Drop `skill` from `BankQuestion` type**: The `skill` label field on `BankQuestion` was a property of the static file design (each question was manually tagged with a skill area string). In the DB-driven design, questions have a `type` enum (TECHNICAL/BEHAVIORAL/SITUATIONAL) which provides sufficient categorisation for the selection prompt. Removing `skill` simplifies the type, removes the need for a `skill_label` column in the DB, and makes the prompt format cleaner. Test fixtures and the prompt builder are updated accordingly.

3. **Selection prompt format without skill label**: The prompt line changes from `[id: X] (TYPE | Skill Area) text` to `[id: X] (TYPE) text`. The AI model still receives full context from `jobTitle`, `jobDescription`, and the conversation history to make contextually appropriate selections. The type alone (TECHNICAL/BEHAVIORAL/SITUATIONAL) is sufficient categorisation metadata.

4. **Existing skill-based seed data preserved**: The seed entries for SWE/PM/DA jobs that use the `Skill → Question` chain (IDs like `qswe-sys-001`) are kept in `prisma/seed.ts` unchanged. These questions are unreachable by the route (which queries by `jobId`) but preserve data integrity for any session or analytics that references them via the skill relation.

5. **Index on `job_id`**: The migration must create an index on `questions.job_id` because the route queries `WHERE job_id = ?` on every turn. Without the index, this query scans the full `questions` table. With 10–15 questions per job and 12 jobs (120–180 rows total), the performance difference is negligible today but indexing is the correct practice.

6. **Seed question content**: The seed must provide substantive, role-appropriate question text (not placeholder text). The implementer should source question content from the static file being deleted (`src/lib/question-bank.ts`) — it already has well-crafted questions for all 12 jobs. Those texts can be reused verbatim; only the IDs change (from `sqb-swe-001` to `qb-swe-001`).
