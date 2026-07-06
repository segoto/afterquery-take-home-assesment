# AI Interviewer Platform

A full-stack AI-powered interview platform where candidates select a job and complete a voice-driven AI interview. The AI asks at least 6 questions — including adaptive follow-ups based on prior answers — then generates a structured evaluation at the end.

## Tech stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **AI**: Anthropic Claude (`claude-sonnet-4-6`) or OpenRouter
- **Voice I/O**: Web Speech API (Chrome/Edge only)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT (jose + bcryptjs)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ **or** Docker
- An Anthropic API key (or an OpenRouter API key)

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in the required values in `.env`:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes (default) | Anthropic API key |
| `AI_PROVIDER` | No | `anthropic` (default) or `openrouter` |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Defaults to `anthropic/claude-sonnet-4-6` |
| `OPENROUTER_FOLLOWUP_MODEL` | No | Defaults to `meta-llama/llama-3.1-8b-instruct` |
| `JWT_SECRET` | Yes | At least 32 characters in production |
| `NEXT_PUBLIC_APP_URL` | No | Defaults to `http://localhost:3000` |

### 3. Start the database

**Option A — Docker (recommended)**

```bash
docker compose up -d
```

The `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_PORT` from `.env`. Add those to your `.env` to match your `DATABASE_URL`, for example:

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=ai_interviewer
POSTGRES_PORT=5432
DATABASE_URL="postgresql://user:password@localhost:5432/ai_interviewer?schema=public"
```

**Option B — existing PostgreSQL**

Point `DATABASE_URL` at your running instance.

### 4. Run database migrations and seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Chrome or Edge** (voice capture requires Web Speech API).

## Application flow

1. **Sign up / log in** at `/signup` or `/login`
2. **Pick a job** from the listing page (`/`)
3. **Complete the interview** — the AI asks questions via text-to-speech; you answer with your microphone
4. **View results** — transcript and structured evaluation at `/results/[sessionId]`

## Available scripts

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm test           # Jest test suite

npx prisma studio          # Visual DB browser
npx prisma migrate dev --name <name>  # Create a new migration (dev)
npx prisma migrate reset   # Drop and re-run all migrations (dev only — destructive)
```

## Browser compatibility

Voice input uses the Web Speech API which is supported on **Chrome and Edge only**. A browser warning is shown on Firefox and Safari.
