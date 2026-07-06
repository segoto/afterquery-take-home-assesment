# Implementation Plan: Adaptive Question Bank (DB-Driven)

## Overview

This feature replaces the static `src/lib/question-bank.ts` with a database-driven approach by modifying the existing `Question` Prisma model to carry an optional `jobId` foreign key, seeding ≥10 role-appropriate questions per job for all 12 jobs, and updating `POST /api/interview` to fetch the question bank from the DB via `prisma.question.findMany`. It also deletes the now-redundant static file and its test, and revises `BankQuestion`, `bank-selection.ts`, and all affected tests to remove the `skill` field.

## Prerequisites

1. The migration `20260705230445_add_decision_state_to_turns` is already applied — do NOT create another migration for `decisionState`.
2. The migration `20260706001056_add_source_to_turns` is already applied.
3. No new environment variables are required.
4. The Prisma client must be regenerated (`npx prisma generate`) after the schema change in T1.
5. The new migration must be applied (`npx prisma migrate dev`) before the seed in T6.
6. Correct execution order: T1 → generate → T3 (migrate) → T6 (seed). Code changes in T2, T4, T5, T7, T8 are independent of the migration order.

## Task Graph

| Task | Wave | Type    | Description                                                                                     | Depends on |
|------|------|---------|-------------------------------------------------------------------------------------------------|------------|
| T1   | 1    | backend | Modify `prisma/schema.prisma`: make `skillId` nullable, add `jobId`/`job` to Question, add `questions` to Job | —          |
| T2   | 1    | backend | Update `src/types/index.ts`: inline `BankQuestion` (id, text, type only), remove re-export     | —          |
| T3   | 2    | backend | Generate and apply migration `make_skill_nullable_add_job_id_to_questions`                      | T1         |
| T4   | 2    | backend | Update `src/lib/bank-selection.ts`: change import source to `@/types`, remove `skill` from prompt format | T2         |
| T5   | 3    | backend | Update `src/app/api/interview/route.ts` to fetch bank from DB; delete `src/lib/question-bank.ts` and `src/__tests__/question-bank.test.ts` | T2, T3, T4 |
| T6   | 4    | backend | Extend `prisma/seed.ts`: upsert ≥10 bank questions per job for all 12 jobs with `jobId` set    | T3, T5     |
| T7   | 4    | backend | Update `src/__tests__/bank-selection.test.ts` and `src/__tests__/interview-route.test.ts`       | T2, T4, T5 |
| T8   | 4    | backend | Update `docs/openapi.yaml`: revise `POST /api/interview` description to reflect DB-sourced bank | T5         |

Wave 1 tasks are fully parallel. Wave 2 tasks start only when all Wave 1 tasks are complete. Wave 3 tasks start when all Wave 2 tasks are complete. Wave 4 tasks are all parallel and start when Wave 3 is complete.

## Task Details

### T1: Modify Prisma Schema
- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `prisma/schema.prisma` — Modify the `Question` model and `Job` model
- **Implementation notes**:
  The `Question` model currently has `skillId String @map("skill_id")` and `skill Skill @relation(...)`. Both must become optional:
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
  The `Job` model must gain a reverse relation field (Prisma requires both sides):
  ```prisma
  questions Question[]
  ```
  Add this line to the `Job` model alongside `skills Skill[]` and `sessions Session[]`. The `QuestionType` enum is unchanged. After editing, run `npx prisma generate` to verify the schema compiles without errors.
- **Testing**:
  - Unit: N/A (schema change, no logic).
  - Integration: Run `npx prisma generate` and confirm it exits 0 with no errors. Run `npx tsc --noEmit` and confirm no type errors related to `Question` or `Job`.
  - Manual: Open Prisma Studio (`npx prisma studio`) after the migration (T3) and confirm the `questions` table shows a nullable `job_id` column.

---

### T2: Update `src/types/index.ts`
- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — Remove the re-export of `BankQuestion` from the deleted file; add `BankQuestion` inline
- **Implementation notes**:
  Remove line 1 of the current file:
  ```typescript
  export type { BankQuestion } from '@/lib/question-bank';
  ```
  Replace it with the inline definition placed before the `AuthUser` interface (or at any logical position near the top):
  ```typescript
  export interface BankQuestion {
    id: string;
    text: string;
    type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
  }
  ```
  The `skill` field is intentionally absent. No other types in `src/types/index.ts` change — `DecisionState`, `BankSelectionResponse`, `ClaudeInterviewResponse`, `PostInterviewSuccessResponse`, and all auth types remain identical.
- **Testing**:
  - Unit: N/A (type-only change).
  - Integration: Run `npx tsc --noEmit` and confirm no errors. The `BankQuestion` type must be importable from `@/types` without error.
  - Manual: None required.

---

### T3: Generate and Apply Migration
- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `prisma/migrations/` — A new migration directory is created by the command
- **Implementation notes**:
  Run exactly:
  ```bash
  npx prisma migrate dev --name make_skill_nullable_add_job_id_to_questions
  ```
  The generated SQL must:
  1. Drop the `NOT NULL` constraint on `skill_id` in the `questions` table.
  2. Add a nullable `job_id` column (TEXT or VARCHAR) to the `questions` table.
  3. Add a foreign key constraint from `questions.job_id` to `jobs.id` with `ON DELETE CASCADE`.
  4. Create an index on `questions(job_id)` for query performance (the route queries `WHERE job_id = ?` on every turn).

  If Prisma does not auto-generate the index, add it manually to the migration SQL file before applying:
  ```sql
  CREATE INDEX "questions_job_id_idx" ON "questions"("job_id");
  ```
  Verify the migration applies cleanly on the dev DB. The existing `skill_id` NOT NULL constraint drop is a PostgreSQL DDL operation; confirm no errors in output.

  After the migration, run `npx prisma generate` to refresh the Prisma client with the updated schema.
- **Testing**:
  - Unit: N/A.
  - Integration: Confirm `npx prisma migrate dev` exits 0. Confirm `npx prisma generate` exits 0. Connect to the DB (via Prisma Studio or psql) and verify `questions.job_id` exists as a nullable column with a foreign key to `jobs.id`.
  - Manual: Run `npx prisma studio`, open the `questions` table, confirm both `job_id` and `skill_id` are nullable.

---

### T4: Update `src/lib/bank-selection.ts`
- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/lib/bank-selection.ts` — Change import source; update prompt format line
- **Implementation notes**:
  **Change 1 — import:**
  Remove:
  ```typescript
  import type { BankQuestion } from '@/lib/question-bank';
  ```
  Replace with:
  ```typescript
  import type { BankQuestion } from '@/types';
  ```

  **Change 2 — prompt format:**
  In `buildBankSelectionPrompt`, find the line inside the `map` callback:
  ```typescript
  `[id: ${q.id}] (${q.type} | ${q.skill}) ${q.text}`
  ```
  Replace with:
  ```typescript
  `[id: ${q.id}] (${q.type}) ${q.text}`
  ```
  This is the only change to the prompt format. All other sections — selection rules, tracking fields instruction, JSON response instruction, safe defaults in `callModelForBankSelection`, fence-stripping — are preserved verbatim.
- **Testing**:
  - Unit: `npx jest src/__tests__/bank-selection.test.ts` — tests use fixtures without `skill`, which are updated in T7. Confirm `npx tsc --noEmit` passes after this change.
  - Integration: N/A.
  - Manual: N/A.

---

### T5: Update Interview Route and Delete Static Files
- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/api/interview/route.ts` — Replace static bank call with Prisma query; remove import of `@/lib/question-bank`
- **Files to delete**:
  - `src/lib/question-bank.ts` — Delete entirely; no file in `src/` may import from it after deletion
  - `src/__tests__/question-bank.test.ts` — Delete entirely
- **Implementation notes**:
  **Step 1 — Remove import:**
  Remove line:
  ```typescript
  import { getStaticQuestionBank } from '@/lib/question-bank';
  ```

  **Step 2 — Replace bank fetch:**
  Find the line in the route (currently line 176):
  ```typescript
  const fullBank = getStaticQuestionBank(session.jobId);
  ```
  Replace with:
  ```typescript
  const fullBank = await prisma.question.findMany({
    where: { jobId: session.jobId },
    select: { id: true, text: true, type: true },
    orderBy: { createdAt: 'asc' },
  }) as BankQuestion[];
  ```
  The `as BankQuestion[]` cast is acceptable because `prisma.question.findMany` returns `QuestionType` (the Prisma enum) for `type`, while `BankQuestion.type` is `'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL'`. The string values are identical at runtime.

  **Step 3 — Ensure BankQuestion is imported:**
  Verify `BankQuestion` is imported from `@/types` in the route's import line. The current import line reads:
  ```typescript
  import type { PostInterviewSuccessResponse, ApiErrorResponse, BankSelectionResponse } from '@/types';
  ```
  Add `BankQuestion` to that import:
  ```typescript
  import type { PostInterviewSuccessResponse, ApiErrorResponse, BankSelectionResponse, BankQuestion } from '@/types';
  ```

  **Step 4 — Delete files:**
  Delete `src/lib/question-bank.ts` and `src/__tests__/question-bank.test.ts`. After deletion, run:
  ```bash
  grep -r "question-bank" /Users/segoto/PersonalProjects/afterquery-take-home-assesment/src/
  ```
  Confirm zero results.

  All other route logic is preserved unchanged: session validation (400/404/409), deduplication guard, user/AI turn saving, `usedQuestionIds` computation from `decisionState.selectedQuestionId`, `remainingQuestions` filtering, `aiTurnCount` computation, bank-exhausted path, `callModelForBankSelection` call, OpenRouter follow-up phases, session completion.
- **Testing**:
  - Unit: Run `npx tsc --noEmit` and confirm no errors after the deletions and route edit.
  - Integration: After T7 completes, run `npm test` and confirm all test suites pass.
  - Manual: Start the dev server (`npm run dev`). Navigate to `/interview/<any-job-slug>` for a job that has been seeded (after T6). Complete a two-question exchange. Confirm the response JSON contains `nextQuestion`, `isComplete: false`, and `decisionState.selectedQuestionId` matching the `qb-<abbrev>-NNN` pattern.

---

### T6: Extend `prisma/seed.ts` with Bank Questions
- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `prisma/seed.ts` — Add ≥10 bank questions per job for all 12 jobs; keep existing skill-based seeds untouched
- **Implementation notes**:
  Append a new section to `prisma/seed.ts` after the existing `console.log('Seeded Data Analyst skills and questions.')` line and before `console.log('Seed complete.')`.

  **Pattern per job:**
  ```typescript
  const sweJob2 = await prisma.job.findUniqueOrThrow({ where: { slug: 'software-engineer' } });
  await prisma.question.upsert({
    where: { id: 'qb-swe-001' },
    update: {},
    create: {
      id: 'qb-swe-001',
      jobId: sweJob2.id,
      skillId: null,
      text: 'Walk me through how you design a type-safe REST API in TypeScript, including error handling and input validation.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  // ... 9+ more questions for Software Engineer
  console.log('Seeded 12 bank questions for Software Engineer.');
  ```
  Note: The variable names for `findUniqueOrThrow` results in the bank section must be distinct from those in the existing seed (e.g., use `sweJob2` or rename using a `const bankJobs = await Promise.all([...])` block to avoid variable shadowing within the `main` function scope).

  **ID scheme** (must be used exactly as specified in the feature spec):
  - Software Engineer → `qb-swe-001` to `qb-swe-012`
  - Product Manager → `qb-pm-001` to `qb-pm-012`
  - Data Analyst → `qb-da-001` to `qb-da-012`
  - Frontend Engineer → `qb-fe-001` to `qb-fe-012`
  - Backend Engineer → `qb-be-001` to `qb-be-012`
  - DevOps Engineer → `qb-dvo-001` to `qb-dvo-012`
  - Data Engineer → `qb-de-001` to `qb-de-012`
  - ML Engineer → `qb-mle-001` to `qb-mle-012`
  - QA Engineer → `qb-qa-001` to `qb-qa-012`
  - Product Manager – Technical → `qb-pmt-001` to `qb-pmt-012`
  - Site Reliability Engineer → `qb-sre-001` to `qb-sre-012`
  - Security Engineer → `qb-sec-001` to `qb-sec-012`

  **Per-job minimum type composition** (12 questions per job recommended, 10 minimum):
  - ≥3 questions of type `TECHNICAL`
  - ≥3 questions of type `BEHAVIORAL`
  - ≥2 questions of type `SITUATIONAL`
  - Remaining 2+ may be any type

  **Question content source**: The file being deleted (`src/lib/question-bank.ts`) contains 12 well-crafted questions for each of the 12 jobs. Copy the text verbatim from there — only the IDs change (e.g., `sqb-swe-001` → `qb-swe-001`, `sqb-spm-001` → `qb-pm-001`). The `skill` field from the static bank is dropped; `skillId: null` is used for all bank questions. This guarantees high-quality, role-appropriate question text without inventing new content.

  **Job slug to abbreviation mapping** (for `findUniqueOrThrow` calls):
  - `software-engineer` → questions use `swe`
  - `product-manager` → questions use `pm`
  - `data-analyst` → questions use `da`
  - `frontend-engineer` → questions use `fe`
  - `backend-engineer` → questions use `be`
  - `devops-engineer` → questions use `dvo`
  - `data-engineer` → questions use `de`
  - `ml-engineer` → questions use `mle`
  - `qa-engineer` → questions use `qa`
  - `product-manager-technical` → questions use `pmt`
  - `site-reliability-engineer` → questions use `sre`
  - `security-engineer` → questions use `sec`

  Use `prisma.job.findUniqueOrThrow` (not `findUnique`) so a missing job causes a hard failure. Group all 12 job lookups in a single `Promise.all` block to minimize sequential DB round-trips.

  The existing skill-based question seeds (IDs like `qswe-sys-001`, `qspm-str-001`, `qsda-sql-001`) must not be modified or removed. They serve different purposes and may be referenced by existing sessions.

  Idempotency: All new questions are upserted via `prisma.question.upsert({ where: { id: '...' }, update: {}, create: { ... } })`. Running the seed twice produces no duplicate rows.
- **Testing**:
  - Unit: N/A (seed script, not unit-testable).
  - Integration: Run `npx prisma db seed` and confirm it exits 0 with the per-job log messages. Run it again and confirm still exits 0 (idempotency). Query the DB: `SELECT COUNT(*) FROM questions WHERE job_id IS NOT NULL` should return ≥120.
  - Manual: Start the dev server. Navigate to any job's interview room and complete ≥3 turns. Confirm `decisionState.selectedQuestionId` values match the `qb-<abbrev>-NNN` pattern in the network responses.

---

### T7: Update Test Files
- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `src/__tests__/bank-selection.test.ts` — Remove `skill` field from `BankQuestion` fixtures
  - `src/__tests__/interview-route.test.ts` — Replace static bank mock with `prisma.question.findMany` mock; remove all references to `@/lib/question-bank`
- **Implementation notes**:

  **`src/__tests__/bank-selection.test.ts` changes:**

  In the `sampleBank` fixture (lines 33–46), remove the `skill` field from both entries:
  ```typescript
  const sampleBank: BankQuestion[] = [
    { id: 'sqb-swe-001', text: 'Describe your TypeScript experience.', type: 'TECHNICAL' },
    { id: 'sqb-swe-002', text: 'Tell me about a time you handled a production incident.', type: 'BEHAVIORAL' },
  ];
  ```
  No other changes are needed. All 10 existing test assertions remain valid: Test 2 checks `question.id` and `question.text` (not `skill`), so it passes unchanged. All other tests do not reference the `skill` field.

  **`src/__tests__/interview-route.test.ts` changes:**

  1. **Remove** the `mockGetStaticQuestionBank` mock function declaration (line 53):
     ```typescript
     // DELETE this line:
     const mockGetStaticQuestionBank = jest.fn<() => BankQuestion[]>();
     ```

  2. **Add** a new mock function for `prisma.question.findMany` (insert near the other mock function declarations):
     ```typescript
     const mockQuestionFindMany = jest.fn<
       (args: unknown) => Promise<Array<{ id: string; text: string; type: string }>>
     >();
     ```

  3. **Remove** the entire `jest.unstable_mockModule('@/lib/question-bank', ...)` block (lines 77–80):
     ```typescript
     // DELETE entire block:
     jest.unstable_mockModule('@/lib/question-bank', () => ({
       getStaticQuestionBank: mockGetStaticQuestionBank,
       QUESTION_BANKS: {},
     }));
     ```

  4. **Update** the prisma mock object to include `question: { findMany: mockQuestionFindMany }`:
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

  5. **Update** the `defaultBank` fixture (lines 138–141) to remove `skill`:
     ```typescript
     const defaultBank: BankQuestion[] = [
       { id: 'qb-swe-001', text: 'Q1', type: 'TECHNICAL' },
       { id: 'qb-swe-002', text: 'Q2', type: 'BEHAVIORAL' },
     ];
     ```

  6. **Update** `beforeEach` (line 153): Replace:
     ```typescript
     mockGetStaticQuestionBank.mockReturnValue(defaultBank);
     ```
     with:
     ```typescript
     mockQuestionFindMany.mockResolvedValue(defaultBank);
     ```

  7. **Update** the bank-exhausted path tests: In both bank-exhausted test cases (lines ~370 and ~391), replace:
     ```typescript
     mockGetStaticQuestionBank.mockReturnValue([]);
     ```
     with:
     ```typescript
     mockQuestionFindMany.mockResolvedValue([]);
     ```
     All other assertions in those tests remain unchanged.

  8. The no-repeat guarantee test requires no assertion changes — `buildBankSelectionPrompt.mock.calls[0][2]` still receives `remainingQuestions` as the third argument. The fixture IDs in `defaultBank` (`qb-swe-001`, `qb-swe-002`) are already updated in step 5. The test assertion that the already-used question ID is excluded from `remainingQuestions` continues to pass.

  9. Confirm the file's top-level imports do NOT reference `@/lib/question-bank`. The `BankQuestion` type is imported from `@/types` (line 12 already does this). Run `grep "question-bank" src/__tests__/interview-route.test.ts` and confirm zero results after changes.

  All existing test assertions — 400/404/409/500 responses, deduplication guard, turn saving, `selectedQuestionId` in stored `decisionState`, bank-exhausted static closing statement, `isComplete: true` when model signals completion — must pass without modifying any assertion.
- **Testing**:
  - Unit: `npx jest src/__tests__/bank-selection.test.ts` — all 10 tests must pass. `npx jest src/__tests__/interview-route.test.ts` — all tests must pass.
  - Integration: `npm test` — no failing test suites across the entire project.
  - Manual: N/A (test-only changes).

---

### T8: Update `docs/openapi.yaml`
- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `docs/openapi.yaml` — Update `POST /api/interview` description to reflect DB-sourced question bank
- **Implementation notes**:
  The existing `POST /api/interview` entry already documents `selectedQuestionId` (confirmed at line 608 of the current file) and the `decisionState` response schema is correct and unchanged. Only the prose description needs updating.

  Locate the `description` field of the `POST /api/interview` path item and update any references to:
  - "static question bank" → "database question bank (fetched via `prisma.question.findMany({ where: { jobId } })`)"
  - Any mention of `getStaticQuestionBank` → remove or replace with the Prisma query description

  The updated description should state:
  - On each turn, bank questions are fetched from the `questions` table filtered by `job_id = session.jobId`.
  - The `selectedQuestionId` in `decisionState` references a `questions` table row (e.g., `qb-swe-001`).
  - All other behaviour — no-repeat guarantee via `decisionState.selectedQuestionId`, bank-exhausted path, OpenRouter follow-up phases, decisionState shape — is unchanged.

  No changes to response schema definitions or error response schemas are needed.
- **Testing**:
  - Unit: N/A.
  - Integration: Validate YAML syntax after edits. Run `node -e "require('js-yaml').load(require('fs').readFileSync('docs/openapi.yaml','utf8'))"` from the project root and confirm no parse error.
  - Manual: N/A.

---

## Data Migrations

The following schema changes require a new migration (the `decisionState` migration is already applied and must NOT be repeated):

**Modified `prisma/schema.prisma` — `Question` model:**
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

**Modified `prisma/schema.prisma` — `Job` model addition:**
```prisma
questions Question[]
```

**Migration command:**
```bash
npx prisma migrate dev --name make_skill_nullable_add_job_id_to_questions
```

**Expected generated SQL (implementer must verify and add index if missing):**
```sql
ALTER TABLE "questions" ALTER COLUMN "skill_id" DROP NOT NULL;
ALTER TABLE "questions" ADD COLUMN "job_id" TEXT;
ALTER TABLE "questions" ADD CONSTRAINT "questions_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "questions_job_id_idx" ON "questions"("job_id");
```

## API Documentation Updates

`POST /api/interview` in `docs/openapi.yaml` — The response schema is unchanged (the `selectedQuestionId` field and `decisionState` object shape are identical to the prior implementation). Only the prose description requires an update to reflect that `fullBank` is now fetched from `prisma.question.findMany({ where: { jobId: session.jobId } })` instead of `getStaticQuestionBank(session.jobId)`. No new endpoints are added or removed.

## Cross-cutting Concerns

- **`BankQuestion` type** (inlined in `src/types/index.ts` after T2): Used by `src/lib/bank-selection.ts` (T4), `src/app/api/interview/route.ts` (T5), `src/__tests__/bank-selection.test.ts` (T7), and `src/__tests__/interview-route.test.ts` (T7). T2 must complete before T4, T5, and T7 begin.
- **Migration prerequisite for seed**: T3 (migration applied) must complete before T6 (seed) runs, because the seed writes rows with `jobId` set, which requires the `job_id` column to exist in the `questions` table.
- **File deletion ordering**: `src/lib/question-bank.ts` must not be deleted until both `src/types/index.ts` (T2) and `src/app/api/interview/route.ts` (T5) have been updated to no longer import from it. The deletion is the final step within T5.
- **No frontend changes**: This feature has no UI component changes. All 8 tasks are backend-only. No changes to `src/components/ui/` are required.
- **`npx tsc --noEmit` checkpoint**: Run after T1+T2 complete, after T4 completes, after T5 completes, and after T7 completes. Each checkpoint must produce zero errors before proceeding to the next wave.
