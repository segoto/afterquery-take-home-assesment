# Feature Spec: Job Skills Question Bank

## Overview

Extend the Prisma schema so that each `Job` has a set of `Skill` records, and each `Skill` has a bank of `Question` records. Questions are seniority-aware (JUNIOR / MID / SENIOR, or null for all levels) and typed (TECHNICAL / BEHAVIORAL / SITUATIONAL). A new utility function `getQuestionBank` queries the database and returns a compact, flat array suitable for serialisation into an LLM prompt without context overload. Seed data for all three existing jobs is also included. No API routes or frontend changes are part of this feature.

## Scope

**Included:**
- Two new Prisma enums: `Seniority` and `QuestionType`.
- Two new Prisma models: `Skill` and `Question`.
- One new field on the existing `Job` model: `seniority Seniority`.
- A new file `src/lib/questions.ts` exporting `getQuestionBank(jobId, seniority)`.
- A new TypeScript type `QuestionBankItem` exported from `src/lib/questions.ts`.
- Updated `prisma/seed.ts` populating Skills and Questions for all three existing jobs.
- A new Prisma migration covering all schema additions.
- `npx prisma generate` and `npx tsc --noEmit` must pass cleanly after implementation.

**Explicitly OUT of scope:**
- OpenRouter / LLM integration — `getQuestionBank` only queries and returns data; it does not call any external API.
- Any new REST API endpoint — `docs/openapi.yaml` is not modified.
- Any frontend or UI changes.
- Modifications to the `Session`, `Turn`, `Evaluation`, `User`, or `PasswordResetToken` models.
- Admin or management UI for skills/questions.

## User Stories

- As an implementer, I want the Prisma schema to define Skills and Questions per Job so that the data layer is ready for seniority-aware question selection.
- As an implementer, I want a `getQuestionBank` utility that returns the correct questions filtered by job and seniority so that future LLM-selection code has a single, tested entry point.
- As a developer seeding a fresh database, I want all three existing jobs to have realistic Skills and Questions already present so that the interview flow works end-to-end without manual data entry.

## Functional Requirements

1. The Prisma schema must define a `Seniority` enum with values `JUNIOR`, `MID`, `SENIOR`. The DB-level type name must be `"Seniority"` (Prisma default for enums — no `@map` needed on the enum itself).
2. The Prisma schema must define a `QuestionType` enum with values `TECHNICAL`, `BEHAVIORAL`, `SITUATIONAL`.
3. The `Job` model must gain a non-nullable field `seniority` of type `Seniority` with a DB column name of `seniority`. Because the `jobs` table already exists, the migration must supply a default (e.g. `@default(MID)`) so that existing rows receive a valid value.
4. The `Skill` model must be defined exactly as:
   - `id String @id @default(cuid())`
   - `jobId String @map("job_id")`
   - `name String`
   - `weight Int @default(1)` — relative importance hint for the LLM; higher values indicate higher priority
   - `questions Question[]` relation
   - `job Job` relation with `onDelete: Cascade`
   - `@@unique([jobId, name])` — a job cannot have two skills with the same name
   - `@@map("skills")`
5. The `Question` model must be defined exactly as:
   - `id String @id @default(cuid())`
   - `skillId String @map("skill_id")`
   - `text String` — the full question text
   - `seniority Seniority?` — nullable; null means the question applies to all seniority levels
   - `type QuestionType`
   - `skill Skill` relation with `onDelete: Cascade`
   - `createdAt DateTime @default(now()) @map("created_at")`
   - `@@map("questions")`
6. The `Job` model must include a `skills Skill[]` relation field.
7. The file `src/lib/questions.ts` must export the type:
   ```typescript
   export type QuestionBankItem = {
     id: string;
     skill: string;
     weight: number;
     type: QuestionType;
     question: string;
   };
   ```
   `QuestionType` must be imported from `@/generated/prisma` (the generated Prisma client output path).
8. The file `src/lib/questions.ts` must export an async function with the exact signature:
   ```typescript
   export async function getQuestionBank(
     jobId: string,
     seniority: Seniority,
   ): Promise<QuestionBankItem[]>
   ```
   where `Seniority` is imported from `@/generated/prisma`.
9. `getQuestionBank` must query the database via the shared Prisma client from `@/lib/prisma` and return all questions where `skill.jobId = jobId` AND (`question.seniority = seniority` OR `question.seniority IS NULL`).
10. The returned array must be flat (not nested). Each element must map to `QuestionBankItem` as: `id` → question id, `skill` → skill name, `weight` → skill weight, `type` → question type, `question` → question text.
11. `getQuestionBank` must return an empty array (not throw) when no matching questions exist for the given `jobId`/`seniority` combination.
12. The updated `prisma/seed.ts` must upsert (not plain insert) all Jobs, Skills, and Questions so that running `npx prisma db seed` is idempotent. The three existing job IDs defined in `src/lib/jobs.ts` must be preserved exactly: `clswe0001000000000000000001`, `clspm0002000000000000000002`, `clsda0003000000000000000003`.
13. Each job in the seed must have 3–4 `Skill` records.
14. Each `Skill` in the seed must have 6–8 `Question` records. Across those questions, all three `QuestionType` values (`TECHNICAL`, `BEHAVIORAL`, `SITUATIONAL`) must appear at least once per skill, and at least two `Seniority` levels must be represented among the non-null seniority questions. Some questions must have `seniority: null`.
15. Skill `weight` values in the seed must vary within a job (not all identical) to exercise the priority logic.
16. After implementation, `npx prisma generate` must complete without error.
17. After implementation, `npx tsc --noEmit` must complete without error across the entire project.

## Non-Functional Requirements

- **Performance**: `getQuestionBank` performs a single Prisma query with an `include`; no N+1 queries. For typical question bank sizes (≤ 200 questions per job), this must resolve in under 200 ms against a local PostgreSQL instance.
- **Security**: `getQuestionBank` is a server-side utility only; it must never be called from client components or exposed directly as an API route.
- **Type safety**: All Prisma-generated types must be used. No `any` casts in `src/lib/questions.ts`.
- **Browser support**: N/A — this is a backend-only feature.
- **Accessibility**: N/A — no UI changes.
- **Idempotency**: `npx prisma db seed` must be safe to run multiple times without creating duplicate records.

## Data Model Changes

### New enums

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

Add field (DB column `seniority`):
```prisma
seniority Seniority @default(MID)
skills    Skill[]
```

The `@default(MID)` ensures the migration does not fail on existing rows. Applications that create new `Job` rows must supply an explicit `seniority` value; the default is only a migration safety net.

### New model: `Skill`

| Prisma field | DB column   | Type     | Constraints                          |
|--------------|-------------|----------|--------------------------------------|
| id           | id          | TEXT     | PK, cuid()                           |
| jobId        | job_id      | TEXT     | FK → jobs.id, CASCADE DELETE         |
| name         | name        | TEXT     | NOT NULL                             |
| weight       | weight      | INTEGER  | NOT NULL, DEFAULT 1                  |

Table name: `skills`. Unique index on `(job_id, name)`.

### New model: `Question`

| Prisma field | DB column   | Type        | Constraints                       |
|--------------|-------------|-------------|-----------------------------------|
| id           | id          | TEXT        | PK, cuid()                        |
| skillId      | skill_id    | TEXT        | FK → skills.id, CASCADE DELETE    |
| text         | text        | TEXT        | NOT NULL                          |
| seniority    | seniority   | Seniority?  | NULLABLE                          |
| type         | type        | QuestionType| NOT NULL                          |
| createdAt    | created_at  | TIMESTAMP   | DEFAULT now()                     |

Table name: `questions`.

### Cascade behaviour

Deleting a `Job` cascades to its `Skill` records. Deleting a `Skill` cascades to its `Question` records.

## API Contracts

No new or modified API endpoints. `docs/openapi.yaml` is not changed.

## UI Behaviour

No UI changes.

## Edge Cases & Error Handling

1. **No skills for job**: `getQuestionBank` receives a valid `jobId` that has no `Skill` records. Returns `[]`.
2. **No questions matching seniority**: A skill exists but all its questions target a different seniority level and none have `seniority: null`. `getQuestionBank` returns only the questions with `seniority: null` (if any); if none, returns `[]`.
3. **Invalid jobId**: `getQuestionBank` receives a `jobId` that does not exist in the database. Prisma returns no rows; the function returns `[]` without throwing.
4. **Seed idempotency**: Running `npx prisma db seed` twice must not create duplicate Skills or Questions. Use `upsert` with `update: {}` (no-op update) or equivalent to achieve this.
5. **Migration on existing data**: The `seniority` column added to `jobs` must have a default value (`MID`) so that rows already in the table receive a valid non-null value without a manual back-fill step.
6. **Unique skill name constraint**: Attempting to create a `Skill` with a `(jobId, name)` pair that already exists must fail at the database level with a unique-constraint violation. The utility function does not handle this case; it is the responsibility of callers (seed or future admin tooling).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` defines `Seniority` and `QuestionType` enums.
- [ ] `prisma/schema.prisma` defines `Skill` model with `@@map("skills")`, all required fields with correct `@map` snake_case column names, `@@unique([jobId, name])`, and `onDelete: Cascade` on the `job` relation.
- [ ] `prisma/schema.prisma` defines `Question` model with `@@map("questions")`, all required fields with correct `@map` snake_case column names, nullable `seniority`, and `onDelete: Cascade` on the `skill` relation.
- [ ] `prisma/schema.prisma` adds `seniority Seniority @default(MID)` and `skills Skill[]` to the `Job` model.
- [ ] A Prisma migration file exists that adds the `seniority` enum, `questiontype` enum, `skills` table, `questions` table, and `seniority` column to `jobs`.
- [ ] `npx prisma generate` completes without error.
- [ ] `npx tsc --noEmit` completes without error across the whole project.
- [ ] `src/lib/questions.ts` exports `QuestionBankItem` type with exactly the fields: `id`, `skill`, `weight`, `type`, `question`.
- [ ] `src/lib/questions.ts` exports `getQuestionBank(jobId: string, seniority: Seniority): Promise<QuestionBankItem[]>`.
- [ ] `getQuestionBank` returns questions where `skill.jobId` matches AND (`question.seniority` equals the given seniority OR is null).
- [ ] `getQuestionBank` issues a single database query (no N+1).
- [ ] `getQuestionBank` returns `[]` (not an error) when no questions match.
- [ ] `prisma/seed.ts` upserts jobs (preserving the three existing IDs), skills (3–4 per job), and questions (6–8 per skill).
- [ ] Each skill in the seed has questions covering all three `QuestionType` values.
- [ ] Each skill in the seed has questions at at least two distinct non-null `Seniority` levels plus at least one null-seniority question.
- [ ] Skill `weight` values within each job vary (not all equal to 1).
- [ ] Running `npx prisma db seed` twice does not produce duplicate records.

## Open Decisions

1. **`seniority` default on `Job` model set to `MID`**: The feature request did not specify a default for the new `seniority` field on `Job`. `MID` was chosen as the safest neutral default to handle the migration of existing rows and reasonable future defaults without over-promoting or under-weighting candidates.

2. **`QuestionBankItem` and `Seniority`/`QuestionType` imports from `@/generated/prisma`**: The generated client is placed at `src/generated/prisma` per the existing `schema.prisma` generator config. All type imports in `src/lib/questions.ts` use this path for consistency with the rest of the codebase.

3. **Seed uses `upsert` keyed on `id` for Questions**: Questions have no natural unique key other than `id`. The seed assigns deterministic ids (or uses `upsert` by `id`) to make the operation idempotent. Skills are upserted on `(jobId, name)` which is the declared unique constraint.

4. **No index on `questions.skill_id`**: Prisma adds an implicit index for FK columns on PostgreSQL by default. An additional composite index on `(skill_id, seniority)` was considered but omitted — the question bank is small (≤ 200 rows per job) and the single-query approach via `findMany` with `where` is sufficient.

5. **`getQuestionBank` does not sort the result**: The returned array order is determined by PostgreSQL's natural row order. Sorting responsibility is left to callers (e.g. the future LLM-selection layer), keeping this function minimal.
