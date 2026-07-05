# Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ App Router, TypeScript |
| Styling | Tailwind CSS |
| AI | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| Voice I/O | Web Speech API (`SpeechRecognition` STT, `SpeechSynthesis` TTS) |
| ORM | Prisma 6+ (PostgreSQL) |
| Deployment | Vercel |

## Directory layout

```
src/
  app/
    page.tsx                      # Job listing page (Server Component)
    interview/[jobId]/page.tsx    # Interview room
    results/[sessionId]/page.tsx  # Transcript + evaluation
    api/
      interview/route.ts          # Streaming AI turn handler
      evaluate/route.ts           # Post-interview evaluation
      sessions/route.ts           # Session CRUD
  components/
    ui/                           # Shared design-system primitives (Button, Card, etc.)
    VoiceRecorder.tsx             # Mic capture via SpeechRecognition
    InterviewRoom.tsx             # Turn-taking state machine (useReducer)
    TranscriptView.tsx            # Q/A turn renderer
    EvaluationCard.tsx            # Structured JSON evaluation renderer
  lib/
    anthropic.ts                  # Anthropic client singleton + prompt builders
    prisma.ts                     # Prisma client singleton
    jobs.ts                       # Static job definitions
    interview.ts                  # Session state helpers
  types/
    index.ts                      # Shared TypeScript types
  generated/
    prisma/                       # Generated Prisma client (gitignored)
prisma/
  schema.prisma                   # Source of truth for DB schema
  migrations/                     # Migration history
  seed.ts                         # Seed data
docs/
  openapi.yaml                    # OpenAPI 3.1 endpoint documentation
  architecture.md                 # This file
  design-patterns.md              # Design pattern decisions
sdd/
  summary.md                      # SDD feature index
  <feature-name>/
    feature-spec.md               # Approved feature specification
    implementation-plan.md        # Task graph and implementation notes
```

## Data flow

1. User selects a job from `/` → static job list from `lib/jobs.ts`
2. `/interview/[jobId]` creates a `Session` row, starts turn loop:
   - AI asks via `SpeechSynthesis` (TTS)
   - User answers; `VoiceRecorder` captures via `SpeechRecognition` (STT)
   - Answer posted to `/api/interview` → streams Claude response back
   - `Turn` rows saved for both sides
   - Loop repeats until ≥6 turns and AI emits `[INTERVIEW_COMPLETE]`
3. `/api/evaluate` scores the full transcript → saves `Evaluation` row
4. `/results/[sessionId]` renders transcript + evaluation

## Key constraints

- `SpeechRecognition` is Chrome/Edge only — show warning on other browsers
- Voice capture requires explicit user gesture (mic button) — no autostart
- Streaming AI responses use `ReadableStream` for low latency
- `InterviewRoom.tsx` owns the entire interview state machine via `useReducer`
- All Prisma imports go through `@/lib/prisma` (singleton prevents pool exhaustion)
- Evaluate JSON from Claude defensively — strip markdown fences before `JSON.parse`

## Database conventions

- All table names: `snake_case` (via `@@map`)
- All column names: `snake_case` (via `@map`)
- Prisma model/field names in TypeScript: `camelCase` (Prisma convention)
