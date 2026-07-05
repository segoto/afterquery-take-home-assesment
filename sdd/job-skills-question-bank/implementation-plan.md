# Implementation Plan: Job Skills Question Bank

## Overview

This feature extends the Prisma schema with two enums (`Seniority`, `QuestionType`), two new models (`Skill`, `Question`), a `seniority` field on `Job`, and a utility function `getQuestionBank` that performs a single DB query to return a flat array of questions filtered by job and seniority. Seed data covering 3–4 skills and 6–8 questions per skill (across all three existing jobs) is also added, and all operations are kept idempotent via `upsert`.

## Prerequisites

1. A running PostgreSQL instance reachable via `DATABASE_URL` (already required by the project).
2. No new npm packages are required — this feature uses only Prisma (already installed) and the existing `@/lib/prisma` singleton.
3. The `src/generated/prisma` directory will be regenerated in T2; no manual cleanup is needed beforehand.

## Task Graph

| Task | Wave | Type    | Description                                                           | Depends on   |
|------|------|---------|-----------------------------------------------------------------------|--------------|
| T1   | 1    | backend | Update `prisma/schema.prisma` — enums, Skill model, Question model, Job changes | —    |
| T2   | 2    | backend | Run migration (`prisma migrate dev`) and `npx prisma generate`        | T1           |
| T3   | 3    | backend | Update `src/types/index.ts` and `src/lib/jobs.ts` — add seniority     | T2           |
| T4   | 3    | backend | Create `src/lib/questions.ts` — `QuestionBankItem` type and `getQuestionBank` | T2    |
| T5   | 3    | backend | Update `prisma/seed.ts` — upsert Skills and Questions for all three jobs | T2        |
| T6   | 4    | backend | Verify `npx tsc --noEmit` passes across the entire project            | T3, T4, T5  |

Wave 1 tasks are fully parallel. Wave N tasks start only when all Wave N-1 tasks are complete.

## Task Details

### T1: Update prisma/schema.prisma

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `prisma/schema.prisma` — add two enums, two models, and two fields on `Job`
- **Implementation notes**:

  Add the following two enums anywhere above the `Job` model (before other model definitions for readability):

  ```prisma
  enum Seniority {
    JUNIOR
    MID
    SENIOR
  }

  enum QuestionType {
    TECHNICAL
    BEHAVIORAL
    SITUATIONAL
  }
  ```

  Modify the existing `Job` model to add two new fields between `questionPack` and `sessions`:

  ```prisma
  seniority Seniority @default(MID)
  skills    Skill[]
  ```

  Add the `Skill` model after the `Job` model:

  ```prisma
  model Skill {
    id        String     @id @default(cuid())
    jobId     String     @map("job_id")
    name      String
    weight    Int        @default(1)
    questions Question[]
    job       Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)

    @@unique([jobId, name])
    @@map("skills")
  }
  ```

  Add the `Question` model after the `Skill` model:

  ```prisma
  model Question {
    id        String       @id @default(cuid())
    skillId   String       @map("skill_id")
    text      String
    seniority Seniority?
    type      QuestionType
    skill     Skill        @relation(fields: [skillId], references: [id], onDelete: Cascade)
    createdAt DateTime     @default(now()) @map("created_at")

    @@map("questions")
  }
  ```

  Every field that is camelCase in Prisma must have an `@map("snake_case")` annotation (already shown above for `jobId`, `skillId`, `createdAt`). The `@@map` annotations on each model map to the snake_case table names `"skills"` and `"questions"`. The new `seniority` column on `jobs` is already lowercase so no `@map` is needed on it.

  The `@default(MID)` on `Job.seniority` is required so that existing rows in the `jobs` table receive a valid non-null value when the migration runs — no manual backfill is needed.

- **Testing**:
  - Unit: none (schema edits are validated by the migration in T2).
  - Integration: After T2 runs the migration, confirm `npx prisma migrate status` shows no pending migrations and Prisma Studio shows the `skills` and `questions` tables plus the `seniority` column on `jobs`.
  - Manual: Open `prisma/schema.prisma` and verify every camelCase relation/FK field has `@map` and every model has `@@map`.

---

### T2: Migration and prisma generate

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `prisma/migrations/<timestamp>_add_skills_question_bank/migration.sql` — created automatically by Prisma
- **Implementation notes**:

  Run these two commands in sequence from the project root:

  ```bash
  npx prisma migrate dev --name add-skills-question-bank
  npx prisma generate
  ```

  The migration will:
  - Create the `Seniority` PostgreSQL enum type.
  - Create the `QuestionType` PostgreSQL enum type.
  - Add a `seniority` column (type `Seniority`, default `'MID'`) to the existing `jobs` table.
  - Create the `skills` table with columns `id`, `job_id`, `name`, `weight` and a unique index on `(job_id, name)`.
  - Create the `questions` table with columns `id`, `skill_id`, `text`, `seniority` (nullable), `type`, `created_at`.
  - Add FK constraints with `ON DELETE CASCADE` for `skills.job_id → jobs.id` and `questions.skill_id → skills.id`.

  After `npx prisma generate` completes, the types `Seniority` and `QuestionType` will be available as exports from `@/generated/prisma`.

  Do NOT commit the generated `src/generated/prisma` directory (it is gitignored). Do commit the new migration SQL file.

- **Testing**:
  - Unit: none.
  - Integration: Run `npx prisma migrate status` — output must show "Database schema is up to date". Optionally open Prisma Studio and verify the two new tables exist and the `jobs` table has the new `seniority` column with existing rows showing `'MID'`.
  - Manual: Confirm `src/generated/prisma` is regenerated (check file modification timestamps).

---

### T3: Update src/types/index.ts and src/lib/jobs.ts

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/types/index.ts` — update the `Job` interface; add `Seniority` and `QuestionType` type exports
  - `src/lib/jobs.ts` — add `seniority` field to each JOBS entry
- **Implementation notes**:

  **`src/types/index.ts`**: The existing `Job` interface does not have a `seniority` field. After T1/T2 add `seniority` to the Prisma `Job` model, the TypeScript `Job` interface must match. Add `seniority: 'JUNIOR' | 'MID' | 'SENIOR'` to the `Job` interface. This uses a string literal union (compatible with the generated Prisma enum) to avoid importing from `src/generated/prisma` in a file that is also imported by client components.

  Also add two type alias exports for downstream use (optional convenience, does not create circular dependency because these are plain string literals):

  ```typescript
  export type Seniority = 'JUNIOR' | 'MID' | 'SENIOR';
  export type QuestionType = 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
  ```

  The updated `Job` interface becomes:

  ```typescript
  export interface Job {
    id: string;
    slug: string;
    title: string;
    description: string;
    questionPack: unknown | null;
    seniority: Seniority;
  }
  ```

  Do NOT add `skills` to this interface — the static `Job` type is a lightweight DTO for the job listing; relational data is accessed via Prisma queries, not via this interface.

  **`src/lib/jobs.ts`**: The `JOBS` constant is typed `readonly Job[]`. Adding `seniority` to the `Job` interface makes each existing entry invalid until `seniority` is added. Add `seniority: 'MID' as const` to all three job objects:

  - Software Engineer: `seniority: 'MID'`
  - Product Manager: `seniority: 'MID'`
  - Data Analyst: `seniority: 'MID'`

  This is a reasonable default matching the Prisma schema default. Future callers that create jobs can supply a different seniority value.

- **Testing**:
  - Unit: Run `npx tsc --noEmit` locally after this task — the change must not introduce type errors.
  - Integration: The existing `src/__tests__/jobs.test.ts` test suite must continue to pass (`npm test -- --testPathPattern=jobs.test`). If the test asserts `job.questionPack` is `null`, it will still pass because `seniority` is a new field, not a changed one.
  - Manual: In `src/lib/jobs.ts`, confirm all three entries now have a `seniority` property.

---

### T4: Create src/lib/questions.ts

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/lib/questions.ts` — create this file
- **Implementation notes**:

  This is a server-only utility module. Add `'server-only'` is NOT required by project conventions (CLAUDE.md does not mandate it), but ensure this file is never imported from a client component or `'use client'` module.

  Import `Seniority` and `QuestionType` from `@/generated/prisma` (not from `@/types`) as specified in the feature spec. Import `prisma` from `@/lib/prisma`.

  Export the type:

  ```typescript
  export type QuestionBankItem = {
    id: string;
    skill: string;
    weight: number;
    type: QuestionType;
    question: string;
  };
  ```

  Export the async function:

  ```typescript
  export async function getQuestionBank(
    jobId: string,
    seniority: Seniority,
  ): Promise<QuestionBankItem[]> {
    const skills = await prisma.skill.findMany({
      where: { jobId },
      include: {
        questions: {
          where: {
            OR: [
              { seniority },
              { seniority: null },
            ],
          },
        },
      },
    });

    return skills.flatMap((skill) =>
      skill.questions.map((q) => ({
        id: q.id,
        skill: skill.name,
        weight: skill.weight,
        type: q.type,
        question: q.text,
      })),
    );
  }
  ```

  Key design constraints:
  - A single Prisma query using `findMany` with nested `include` and `where` — no N+1 queries.
  - Returns `[]` when `skills` is empty or when all nested `questions` arrays are empty after the filter — the `flatMap` handles this automatically without an explicit guard.
  - No `any` casts anywhere in the file; all Prisma-generated types flow through correctly.
  - The `OR` filter uses the `seniority` value directly plus `null` check, matching functional requirement 9.
  - The mapping is explicit and flat as required by functional requirement 10.

- **Testing**:
  - Unit: Create `src/__tests__/questions.test.ts`. Mock `prisma.skill.findMany` using the existing jest mock setup pattern from `src/__tests__/setup.ts`. Test cases:
    1. Empty result (no skills for jobId) → returns `[]`.
    2. One skill with two matching questions → returns two flat items with correct `skill`, `weight`, `type`, `question` fields.
    3. One skill with one SENIOR question and one null-seniority question, queried with `Seniority.SENIOR` → returns both.
    4. One skill with one JUNIOR question and one null-seniority question, queried with `Seniority.SENIOR` → returns only the null-seniority question.
    5. Two skills → result is flat (no nesting).
  - Integration: After running the seed (T5), call `getQuestionBank('clswe0001000000000000000001', 'MID')` in a test script and assert the returned array is non-empty and every element has `id`, `skill`, `weight`, `type`, `question` fields.
  - Manual: Import and call `getQuestionBank` from a temporary server action or API route in development to verify it returns data from the seeded DB.

---

### T5: Update prisma/seed.ts

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `prisma/seed.ts` — extend with Skills and Questions for all three jobs
- **Implementation notes**:

  The existing seed upserts three Job rows keyed by `id`. Keep that logic intact but add `seniority: 'MID'` to each job's `create` block (required now that `Job.seniority` is non-nullable in the schema). The `update: {}` remains a no-op update.

  After the job upserts, add skill and question upsert blocks for all three jobs. The structure for each skill is:

  ```typescript
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: '<JOB_ID>', name: '<SKILL_NAME>' } },
    update: {},
    create: { jobId: '<JOB_ID>', name: '<SKILL_NAME>', weight: <N> },
  });
  ```

  For questions, use `upsert` keyed by `id` with deterministic IDs assigned in the seed file. Format the question IDs as short readable strings, e.g. `'qswe-sys-001'` for Software Engineer → System Design → question 1. This makes the seed idempotent without needing a unique constraint on question text.

  ```typescript
  await prisma.question.upsert({
    where: { id: 'qswe-sys-001' },
    update: {},
    create: {
      id: 'qswe-sys-001',
      skillId: '<resolved skill id>',
      text: '<question text>',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  ```

  Because Skills are upserted first, retrieve each skill's `id` using `prisma.skill.findUniqueOrThrow({ where: { jobId_name: { jobId, name } } })` after upserting it, then use that `id` for question creates. Alternatively, assign deterministic `id` values to skills as well to avoid an extra query.

  **Seed data specification (must be followed exactly for acceptance criteria):**

  **Software Engineer** (`clswe0001000000000000000001`):
  - Skill "System Design" — weight 3, 7 questions (TECHNICAL×3, BEHAVIORAL×2, SITUATIONAL×2; JUNIOR×2, SENIOR×2, null×3)
  - Skill "TypeScript and Node.js" — weight 3, 7 questions (TECHNICAL×3, BEHAVIORAL×2, SITUATIONAL×2; MID×2, SENIOR×2, null×3)
  - Skill "Testing and Quality" — weight 2, 6 questions (TECHNICAL×2, BEHAVIORAL×2, SITUATIONAL×2; JUNIOR×1, MID×1, SENIOR×1, null×3)
  - Skill "Collaboration" — weight 1, 6 questions (BEHAVIORAL×3, SITUATIONAL×2, TECHNICAL×1; null×3, JUNIOR×1, SENIOR×2)

  **Product Manager** (`clspm0002000000000000000002`):
  - Skill "Product Strategy" — weight 3, 7 questions (TECHNICAL×2, BEHAVIORAL×3, SITUATIONAL×2; JUNIOR×2, SENIOR×2, null×3)
  - Skill "Stakeholder Management" — weight 2, 6 questions (BEHAVIORAL×3, SITUATIONAL×2, TECHNICAL×1; MID×2, SENIOR×1, null×3)
  - Skill "User Research" — weight 3, 7 questions (TECHNICAL×2, BEHAVIORAL×2, SITUATIONAL×3; JUNIOR×2, MID×2, null×3)
  - Skill "Prioritization" — weight 2, 6 questions (TECHNICAL×2, BEHAVIORAL×2, SITUATIONAL×2; JUNIOR×1, SENIOR×2, null×3)

  **Data Analyst** (`clsda0003000000000000000003`):
  - Skill "SQL and Data Querying" — weight 3, 7 questions (TECHNICAL×4, BEHAVIORAL×1, SITUATIONAL×2; JUNIOR×2, SENIOR×2, null×3)
  - Skill "Data Visualization" — weight 2, 6 questions (TECHNICAL×2, BEHAVIORAL×2, SITUATIONAL×2; MID×1, SENIOR×2, null×3)
  - Skill "Statistical Analysis" — weight 3, 7 questions (TECHNICAL×3, BEHAVIORAL×2, SITUATIONAL×2; JUNIOR×2, SENIOR×2, null×3)
  - Skill "Communication" — weight 1, 6 questions (BEHAVIORAL×3, SITUATIONAL×2, TECHNICAL×1; null×4, JUNIOR×1, SENIOR×1)

  Acceptance criteria per skill:
  - All three `QuestionType` values appear at least once.
  - At least two distinct non-null `Seniority` values appear (any two of JUNIOR, MID, SENIOR).
  - At least one question has `seniority: null`.
  - `weight` values within each job vary (the specs above use 1, 2, and 3 — not all equal).

  Use realistic, role-specific question text for every question (not lorem ipsum). Questions must be phrased as interview questions a human interviewer would ask.

- **Testing**:
  - Unit: none (seed scripts are integration-tested).
  - Integration: Run `npx prisma db seed` once, then run it again — the second run must complete without errors and must not create any duplicate rows. Verify by querying `SELECT COUNT(*) FROM skills` and `SELECT COUNT(*) FROM questions` before and after the second run; counts must be identical.
  - Manual: Open Prisma Studio after seeding and verify each job has the expected skills and each skill has the expected number of questions with the correct `type` and `seniority` distributions.

---

### T6: Verify npx tsc --noEmit

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - none — this task is a verification gate only
- **Implementation notes**:

  Run from the project root:

  ```bash
  npx tsc --noEmit
  ```

  Expected outcome: zero errors, zero warnings. The command exits with code 0.

  Common issues to check if tsc fails:
  - `src/lib/jobs.ts` JOBS entries missing `seniority` field (T3 must be complete).
  - `src/lib/questions.ts` using `any` casts or incorrect import paths for `Seniority`/`QuestionType`.
  - `prisma/seed.ts` passing a string where a `Seniority` enum value is expected (use string literals `'JUNIOR'` | `'MID'` | `'SENIOR'` directly; they are assignable to the Prisma enum type).
  - `src/types/index.ts` `Job` interface missing `seniority` field — would cause errors in `src/lib/jobs.ts`.

- **Testing**:
  - Unit: `npx tsc --noEmit` is the test. Exit code must be 0.
  - Integration: Also run `npm test` to confirm no existing tests are broken by the schema and type changes.
  - Manual: Review the tsc output for any warnings about unused imports or implicit `any`.

---

## Data migrations

### New enums (added to `prisma/schema.prisma`)

```prisma
enum Seniority {
  JUNIOR
  MID
  SENIOR
}

enum QuestionType {
  TECHNICAL
  BEHAVIORAL
  SITUATIONAL
}
```

### Modified model: `Job`

Add two fields after `questionPack`:

```prisma
seniority Seniority @default(MID)
skills    Skill[]
```

The `@default(MID)` ensures existing rows in the `jobs` table receive a valid value when the migration runs without any manual backfill.

### New model: `Skill`

```prisma
model Skill {
  id        String     @id @default(cuid())
  jobId     String     @map("job_id")
  name      String
  weight    Int        @default(1)
  questions Question[]
  job       Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([jobId, name])
  @@map("skills")
}
```

Table name: `skills`. Unique constraint on `(job_id, name)`. FK to `jobs.id` with `ON DELETE CASCADE`.

### New model: `Question`

```prisma
model Question {
  id        String       @id @default(cuid())
  skillId   String       @map("skill_id")
  text      String
  seniority Seniority?
  type      QuestionType
  skill     Skill        @relation(fields: [skillId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now()) @map("created_at")

  @@map("questions")
}
```

Table name: `questions`. `seniority` is nullable. FK to `skills.id` with `ON DELETE CASCADE`.

### Migration command

```bash
npx prisma migrate dev --name add-skills-question-bank
npx prisma generate
```

## API documentation updates

No new or modified API endpoints. `docs/openapi.yaml` is not changed by this feature.

## Cross-cutting concerns

1. **`prisma/schema.prisma` (T1) must complete before any other task**: T2 depends on it to run the migration, and all Wave 3 tasks depend on the generated types from T2.

2. **Generated types from T2**: After `npx prisma generate`, `Seniority` and `QuestionType` are exported from `@/generated/prisma`. T4 (`src/lib/questions.ts`) imports these directly. T3 (`src/types/index.ts`) defines compatible string literal types (`'JUNIOR' | 'MID' | 'SENIOR'`) to avoid importing the Prisma client into a file also used by client components.

3. **Idempotency contract**: Both T5 (`prisma/seed.ts`) and the existing job upsert use `update: {}` (no-op) so re-running the seed is always safe. Question IDs in the seed must be deterministic strings assigned in the source file — do not use `cuid()` or `uuid()` for seed question IDs.

4. **No API surface**: This feature adds no REST routes. `docs/openapi.yaml` is not modified. `getQuestionBank` is a server-side utility only — it must not be called from client components or exported from a route handler file without going through a proper API endpoint.

5. **`src/lib/prisma.ts` singleton**: All Prisma queries in `getQuestionBank` and `prisma/seed.ts` must go through the shared `prisma` instance from `@/lib/prisma`. Never instantiate `PrismaClient` directly.
