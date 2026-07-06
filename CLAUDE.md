# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI Interviewer Platform** — a full-stack web app where candidates select a job and complete a voice-driven AI interview. The AI asks at minimum 6 questions (≥2 adaptive follow-ups based on prior answers), the interview is role-grounded, and the session is saved with a full transcript + structured evaluation at the end.

See `test_assesment.md` for the complete requirements and stretch goals (implement stretch goals in listed order once core is done).

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
- **Voice I/O**: Web Speech API — `SpeechRecognition` for STT, `SpeechSynthesis` for TTS (browser-native, no extra service needed)
- **ORM**: Prisma (PostgreSQL) — stores jobs, sessions, transcripts, evaluations
- **Deployment**: Vercel

## Commands

```bash
# Install dependencies
npm install

# Dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Type-check without emitting
npx tsc --noEmit

# Lint
npm run lint

# Run tests
npm test

# Run a single test file
npx jest path/to/file.test.ts

# --- Prisma ---
# Generate client after schema changes
npx prisma generate

# Create and apply a new migration (dev only)
npx prisma migrate dev --name <migration-name>

# Apply pending migrations (CI / production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Reset DB and re-run all migrations (destructive — dev only)
npx prisma migrate reset
```

## Architecture

### Directory layout (once scaffolded)

```
app/
  page.tsx                  # Job listing page
  interview/[jobId]/
    page.tsx                # Interview room
  results/[sessionId]/
    page.tsx                # Transcript + evaluation
  api/
    interview/route.ts      # Streaming AI turn handler
    evaluate/route.ts       # Post-interview evaluation endpoint
    sessions/route.ts       # CRUD for sessions
components/
  VoiceRecorder.tsx         # Microphone capture → SpeechRecognition
  InterviewRoom.tsx         # Orchestrates turn-taking loop
  TranscriptView.tsx        # Renders Q/A turns
  EvaluationCard.tsx        # Renders structured JSON evaluation
lib/
  anthropic.ts              # Anthropic client singleton + prompt builders
  prisma.ts                 # Prisma client singleton (single shared instance, prevents connection pool exhaustion in dev)
  jobs.ts                   # Static job definitions (at least 3)
  interview.ts              # Session state machine + turn logic
types/
  index.ts                  # Shared TypeScript types (Job, Session, Turn, Evaluation)
```

### Core data flow

1. **Job list** (`/`) → static jobs from `lib/jobs.ts`, seeded into the DB via `prisma/seed.ts` on first deploy.
2. **Interview room** (`/interview/[jobId]`) → creates a `Session` row via Prisma, then runs a turn-taking loop:
   - AI speaks first question via TTS (`SpeechSynthesis`)
   - `VoiceRecorder` captures user answer via `SpeechRecognition` and sends transcript to `/api/interview`
   - `/api/interview` saves the `Turn` rows, sends full conversation history + job context to Claude (streaming), returns next question
   - Repeat until ≥6 turns or AI signals completion
3. **Evaluation** → after the last turn, `/api/evaluate` sends the complete transcript to Claude, saves the `Evaluation` row, and marks the session `COMPLETED`
4. **Results** (`/results/[sessionId]`) → reads session + turns + evaluation from Prisma and renders them

### AI prompting strategy

- **System prompt** (built in `lib/anthropic.ts`): includes the job title/description, the rubric (what skills to probe), instructions to ask ≥6 questions, and rules for generating follow-ups when the candidate's answer reveals something worth probing.
- **Conversation history**: every `{ role, content }` turn is appended and sent on each API call — Claude sees full context to generate adaptive follow-ups.
- **Termination signal**: instruct Claude to output a sentinel (e.g. `[INTERVIEW_COMPLETE]`) after the final question so the client knows to stop and trigger evaluation.
- **Evaluation prompt**: separate prompt asking Claude to return only valid JSON with keys `strengths` (string[]), `concerns` (string[]), `overall_score` (1–10).

### Prisma schema (prisma/schema.prisma)

Models: `Job`, `Session` (status: `IN_PROGRESS | COMPLETED | ABANDONED`), `Turn` (speaker: `AI | USER`), `Evaluation`. Full schema is the source of truth — see the file directly.

The Prisma client is generated to `src/generated/prisma` (gitignored). Always import from `@/lib/prisma` rather than instantiating `PrismaClient` directly.

Seed data lives in `prisma/seed.ts` and runs via `npx prisma db seed`.

### Environment variables

```
DATABASE_URL=                # PostgreSQL connection string
ANTHROPIC_API_KEY=           # Claude API key (server-only)
NEXT_PUBLIC_APP_URL=         # Used for absolute URLs (e.g. OG images)
```

See `.env.example` for the full list.

## Hard rules — never violate these

- **Database column and table names must always be snake_case.** Use `@map("snake_case_name")` on every camelCase field and `@@map("snake_case_table")` on every model. The Prisma model and field names in TypeScript stay camelCase; only the DB-level names are affected.
- **All features are built through the SDD pipeline.** No code is written directly — every feature starts with the `orchestrator` agent. See [SDD workflow](#spec-driven-development-sdd-workflow) below.
- **No agent pastes file contents in its response.** Every agent communicates only via `Status: <STATUS> | File: <path>` lines. Full content lives in md files.
- **Shared UI primitives only.** All reusable elements (Button, Card, Input, etc.) live in `src/components/ui/`. No page component defines its own button or input styles inline.

## Spec-Driven Development (SDD) workflow

All features in this project are built through a pipeline of specialized agents. To start a feature:

1. Spawn the `orchestrator` agent with your feature request.
2. The orchestrator drives the full pipeline automatically.

### Pipeline order

```
orchestrator
  └─► feature-spec-planner        writes sdd/<feature>/feature-spec.md
        └─► feature-spec-evaluator  writes sdd/<feature>/reviews/spec-evaluation.md
  └─► implementation-planner      writes sdd/<feature>/implementation-plan.md
  └─► implementation-orchestrator
        ├─► backend-implementer (per backend task)
        │     └─► backend-code-reviewer
        └─► frontend-implementer (per frontend task)
              └─► frontend-code-reviewer
```

### Persistent artifacts (never delete)

| File | Created by | Purpose |
|------|-----------|---------|
| `sdd/<feature>/feature-spec.md` | feature-spec-planner | Approved feature specification |
| `sdd/<feature>/implementation-plan.md` | implementation-planner | Task graph and implementation notes |
| `sdd/summary.md` | orchestrator | Index of all completed features |

### Temporary artifacts (deleted by orchestrator when feature is done)

- `sdd/<feature>/reviews/` — all review and evaluation files

### Agent communication protocol

Every agent responds with exactly:
```
Status: <STATUS> | File: <path>
```
or
```
Status: <STATUS> | Feature: <name>
```
Never with full content in the message body.

## Docs folder

```
docs/
  openapi.yaml        # OpenAPI 3.1 — updated by backend-implementer per endpoint
  architecture.md     # System architecture and directory layout
  design-patterns.md  # Binding design pattern decisions
```

All new API endpoints must be documented in `docs/openapi.yaml` by the `backend-implementer` before the feature can be considered done.

## Key constraints and decisions

- `SpeechRecognition` is Chrome/Edge-only; show a clear unsupported-browser warning on Firefox/Safari.
- Voice capture must be gated behind explicit user gesture (microphone button) — autoplay policy blocks otherwise.
- `POST /api/interview` uses a synchronous (non-streaming) Anthropic call returning structured JSON (`{ question, isComplete, decisionState }`); streaming is reserved for future plain-text-only endpoints.
- The interview state machine lives in `InterviewRoom.tsx` as a `useReducer`; do not split it across multiple components.
- Evaluation JSON must be parsed defensively — Claude occasionally wraps it in markdown code fences; strip before `JSON.parse`.
