# Design Patterns

Decisions recorded here are binding for all implementers. The SDD pipeline enforces these patterns during code review.

## Backend

### Singleton clients
`lib/prisma.ts` and `lib/anthropic.ts` export singleton instances. Never instantiate `PrismaClient` or `Anthropic` directly elsewhere.

### API route structure
Each resource gets its own directory: `src/app/api/<resource>/route.ts`.
Handlers are named exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

### Consistent error shape
All error responses return `{ error: string }` with an appropriate HTTP status code. No ad-hoc error shapes.

### Streaming AI responses
Endpoints that call Claude with streaming use `ReadableStream` and set `Content-Type: text/event-stream`. The client consumes the stream and updates state incrementally.

### Defensive JSON parsing
Claude may wrap JSON in markdown fences. Always strip before parsing:
```ts
const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
const parsed = JSON.parse(clean);
```

## Frontend

### Design system primitives
All reusable UI elements (Button, Card, Input, Badge, Spinner, etc.) live in `src/components/ui/`. No page or feature component should define its own button or input — it must use the shared primitive.

### State machine
`InterviewRoom.tsx` owns the full interview turn-taking state via `useReducer`. State is not split across sibling components or lifted into a context. This is a hard constraint from CLAUDE.md.

### Server vs Client Components
Default to Server Components. Add `'use client'` only when the component needs browser APIs (`SpeechRecognition`, `SpeechSynthesis`) or React hooks (`useState`, `useReducer`, `useEffect`).

### Loading / empty / error states
Every async operation must render three explicit states. The user must never see a blank screen or an unhandled rejection.

## Database

### snake_case mapping
All Prisma model names use `@@map("snake_case_table")`.
All field names use `@map("snake_case_column")` for any camelCase field.
TypeScript-side names remain camelCase — only the DB layer is snake_case.

### Single shared Prisma instance
Import from `@/lib/prisma`. The singleton prevents connection pool exhaustion during Next.js hot-reload in development.
