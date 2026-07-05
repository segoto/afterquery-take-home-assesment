# Implementation Plan: Job Listing Dashboard

## Overview

Transforms the authenticated home page into a two-tabbed dashboard (Available Positions + My Interviews), adds a `/results/[sessionId]` RSC for viewing transcripts and evaluations, and introduces a `PATCH /api/sessions/[sessionId]` endpoint to mark sessions as ABANDONED. All data is server-fetched; the only new client-side logic is the tab state and abandon flow inside `DashboardTabs`.

## Prerequisites

No new Prisma migrations are needed. All required DB columns already exist: `sessions.user_id`, `sessions.ended_at`, `sessions.status`, `evaluations.strengths`, `evaluations.concerns`, `evaluations.score`. The middleware at `src/middleware.ts` already protects `/results/:path*` — no changes required.

## Task Graph

| Task | Wave | Type | Description | Depends on |
|------|------|------|-------------|------------|
| T1 | 1 | backend | Extend `src/types/index.ts`: add `SessionListItem`, `PatchSessionResponse`; change `TranscriptTurn.createdAt` to `string \| Date` | — |
| T2 | 1 | frontend | Extend `Badge` component with `in-progress`, `completed`, `abandoned` variants and add tests | — |
| T3 | 2 | backend | Create `PATCH /api/sessions/[sessionId]` route handler, unit tests, and update `docs/openapi.yaml` | T1 |
| T4 | 2 | frontend | Create `src/components/DashboardTabs.tsx` client component with tab UI and abandon flow | T1, T2 |
| T5 | 2 | backend | Create `src/app/results/[sessionId]/page.tsx` RSC with transcript and evaluation sections | T1, T2 |
| T6 | 3 | backend | Update `src/app/page.tsx` to fetch sessions, map to `SessionListItem[]`, and render `<DashboardTabs>` | T1, T4 |
| T7 | 4 | backend | Update `src/__tests__/HomePage.test.tsx` to mock session query and assert new page structure | T6 |

Wave 1 tasks (T1, T2) have no dependencies and run in parallel. Wave 2 tasks (T3, T4, T5) all start once both Wave 1 tasks are complete. T6 starts after Wave 2 completes. T7 starts after T6 completes.

## Task Details

### T1: Extend shared types in `src/types/index.ts`

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — three changes described below
- **Implementation notes**:
  1. Change `TranscriptTurn.createdAt` from `Date` to `string | Date`. This is backward-compatible: `InterviewRoom.tsx` already passes `new Date()` (a `Date`, still valid), and the results page RSC will pass `.toISOString()` strings. `TranscriptView.tsx` does not access `createdAt` in its render output, so no runtime handling change is needed there.
  2. Add the `SessionListItem` interface (the serialized form used across the RSC→client boundary):
     ```typescript
     export interface SessionListItem {
       id: string;
       status: SessionStatus;
       startedAt: string; // ISO 8601
       endedAt: string | null; // ISO 8601
       job: {
         id: string;
         title: string;
       };
       turnCount: number;
       evaluationScore: number | null;
     }
     ```
  3. Add the `PatchSessionResponse` type:
     ```typescript
     export interface PatchSessionResponse {
       id: string;
       status: 'ABANDONED';
     }
     ```
  All existing exports remain untouched.
- **Testing**:
  - Unit: No new unit tests are needed for pure type additions; TypeScript compilation (`npx tsc --noEmit`) enforces correctness.
  - Integration: Verified transitively by T3 (PATCH endpoint types), T4 (DashboardTabs prop types), T5 (Results page), T6 (page.tsx mapping), and T7 (HomePage test).
  - Manual: Run `npx tsc --noEmit` after this task to confirm no type regressions.

---

### T2: Extend `Badge` component with session-status variants

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/Badge.tsx` — extend `BadgeProps.variant` union and add three new render branches
  - `src/__tests__/Badge.test.tsx` — add tests for the three new variants
- **Implementation notes**:
  The existing `'ai'` and `'user'` branches are unchanged. Add `'in-progress' | 'completed' | 'abandoned'` to the variant union:
  - `'in-progress'`: `<span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>`
  - `'completed'`: `<span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>`
  - `'abandoned'`: `<span className="inline-block bg-zinc-100 text-zinc-600 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>`

  The `children` prop stays `React.ReactNode`. Callers pass explicit human-readable labels (e.g., `<Badge variant="in-progress">In Progress</Badge>`). Do not derive label text from the variant name inside the component.

  Note: the existing `user` variant already uses `bg-blue-100 text-blue-800`; the new `in-progress` variant uses the same colours intentionally (different semantic meaning, distinguished by label text).
- **Testing**:
  - Unit: In `src/__tests__/Badge.test.tsx`, add three `describe` blocks (one per new variant) each checking: (a) children are rendered, (b) the container has the expected Tailwind bg class, (c) the container has the expected text colour class.
  - Integration: The new variants are exercised in T4 (DashboardTabs renders session cards with status badges) and T5 (Results page status badge).
  - Manual: Render a session card in the browser and confirm badge colours: blue for IN_PROGRESS, green for COMPLETED, zinc for ABANDONED.

---

### T3: `PATCH /api/sessions/[sessionId]` route + OpenAPI docs

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/sessions/[sessionId]/route.ts` — new file; exports only a `PATCH` handler
  - `src/__tests__/sessions-patch.test.ts` — new file; unit tests for the PATCH handler
  - `docs/openapi.yaml` — append `PATCH /api/sessions/{sessionId}` path entry
- **Implementation notes**:
  The new directory `src/app/api/sessions/[sessionId]/` sits alongside the existing `src/app/api/sessions/route.ts` without conflict (Next.js App Router resolves them to separate paths).

  Handler logic (exact sequence, match the spec):
  1. Read `auth_token` cookie via `request.cookies.get('auth_token')?.value`. Call `verifyToken`. If absent or returns `null`, return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.
  2. Parse request body with `request.json()`. Wrap in try/catch — on parse failure return `400 { error: 'Invalid request body' }`.
  3. Validate `body.status === 'ABANDONED'`. Any other value: `400 { error: 'status must be ABANDONED' }`.
  4. Look up session: `prisma.session.findUnique({ where: { id: params.sessionId } })`. Not found: `404 { error: 'Session not found' }`.
  5. Check ownership: `session.userId === payload.sub`. Fails (including when `session.userId` is `null`): `403 { error: 'Forbidden' }`.
  6. Check status: `session.status === 'IN_PROGRESS'`. Fails: `409 { error: 'Session is not in progress' }`.
  7. Update: `prisma.session.update({ where: { id: params.sessionId }, data: { status: 'ABANDONED', endedAt: new Date() } })`.
  8. Return `200 { id: session.id, status: 'ABANDONED' }` typed as `PatchSessionResponse`.
  9. Outer `try/catch` around the entire body: `500 { error: 'Internal server error' }`.

  Import `PatchSessionResponse` and `ApiErrorResponse` from `@/types`. Import `prisma` from `@/lib/prisma`. Import `verifyToken` from `@/lib/auth`.

  For the OpenAPI entry, add the path `/api/sessions/{sessionId}` with a `patch` operation under `tags: [sessions]`. Include all error response schemas (400, 401, 403, 404, 409, 500) and the 200 success schema (`{ id: string, status: 'ABANDONED' }`). Use `cookieAuth` security scheme. Follow the exact format of the existing entries in `docs/openapi.yaml`.

- **Testing**:
  - Unit (`src/__tests__/sessions-patch.test.ts`): Follow the same jest.unstable_mockModule + dynamic import pattern as `src/__tests__/sessions.test.ts`. Mock `@/lib/prisma` with `{ prisma: { session: { findUnique: mockSessionFindUnique, update: mockSessionUpdate } } }` and `@/lib/auth` with `{ verifyToken: mockVerifyToken }`. Write one test per error branch (401, 400 bad body, 400 wrong status, 404, 403, 409) and one happy-path test verifying `update` is called with `{ status: 'ABANDONED', endedAt: expect.any(Date) }` and returns `200 { id, status: 'ABANDONED' }`.
  - Integration: Covered by the manual browser test in T4 (Abandon button flow).
  - Manual: Use `curl` or Postman to hit `PATCH /api/sessions/<id>` with and without auth, with a wrong `status` value, and with a valid in-progress session — confirm each HTTP status code.

---

### T4: Create `DashboardTabs` client component

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/DashboardTabs.tsx` — new `'use client'` component
- **Implementation notes**:
  Props interface (typed, no `any`):
  ```typescript
  interface DashboardTabsProps {
    jobs: Array<{ id: string; title: string; description: string }>;
    jobsError: boolean;
    sessions: SessionListItem[];
    sessionsError: boolean;
  }
  ```
  Import `SessionListItem` from `@/types`. Import `Badge`, `Button`, `Card` from `@/components/ui`. Import `useRouter` from `next/navigation` and `useState` from `react`.

  **Tab state**: `const [activeTab, setActiveTab] = useState<'positions' | 'interviews'>('positions')`.

  **Abandon state**: `const [abandoningId, setAbandoningId] = useState<string | null>(null)` and `const [abandonError, setAbandonError] = useState<string | null>(null)`.

  **Tab bar** (render above the panel):
  ```tsx
  <div role="tablist" className="flex border-b border-zinc-200 mb-6">
    <button
      role="tab"
      aria-selected={activeTab === 'positions'}
      onClick={() => setActiveTab('positions')}
      className={activeTab === 'positions'
        ? 'px-4 py-2 text-sm font-medium border-b-2 border-zinc-900 text-zinc-900'
        : 'px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700'}
    >
      Available Positions
    </button>
    <button
      role="tab"
      aria-selected={activeTab === 'interviews'}
      onClick={() => setActiveTab('interviews')}
      className={activeTab === 'interviews'
        ? 'px-4 py-2 text-sm font-medium border-b-2 border-zinc-900 text-zinc-900'
        : 'px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700'}
    >
      My Interviews
    </button>
  </div>
  ```

  **Panel wrapper**: `<div role="tabpanel">` wrapping the conditional content.

  **Available Positions panel** (when `activeTab === 'positions'`): Replicate the job grid currently in `src/app/page.tsx`:
  - Error: `<p className="text-zinc-500 text-center py-12">Unable to load positions. Please try again later. <a href="/" className="underline text-zinc-700">Refresh</a></p>`
  - Empty: `<p className="text-zinc-500 text-center py-12">No positions available at this time.</p>`
  - Jobs grid: `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">` — each job in a `<Card>` with `<h2>` (font-semibold text-lg), `<p>` (text-sm text-zinc-600 mt-2 line-clamp-3), and `<Button href={"/interview/" + job.id} variant="primary" className="mt-4 w-full">Start Interview</Button>`.

  **My Interviews panel** (when `activeTab === 'interviews'`):
  - Error: `<p className="text-zinc-500 text-center py-12">Unable to load interviews. Please try again later.</p>`
  - Empty: `<p className="text-zinc-500 text-center py-12">No past interviews yet. Start one from the Available Positions tab.</p>`
  - Sessions list: `<div className="flex flex-col gap-4">` — one `<Card>` per session.

  **Session card layout**:
  ```tsx
  <Card key={session.id}>
    <div className="flex items-start justify-between gap-2">
      <h2 className="font-semibold text-zinc-900 line-clamp-2">{session.job.title}</h2>
      {session.status === 'IN_PROGRESS' && <Badge variant="in-progress">In Progress</Badge>}
      {session.status === 'COMPLETED' && <Badge variant="completed">Completed</Badge>}
      {session.status === 'ABANDONED' && <Badge variant="abandoned">Abandoned</Badge>}
    </div>
    <p className="text-sm text-zinc-500 mt-1">
      Started: {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      {' · '}{session.turnCount} turn(s)
    </p>
    {/* action buttons row */}
    <div className="flex gap-2 justify-end mt-4 flex-wrap">
      {session.status === 'IN_PROGRESS' && (
        <>
          <Button variant="secondary" href={"/interview/" + session.job.id}>Continue</Button>
          <Button
            variant="secondary"
            onClick={() => handleAbandon(session.id)}
            loading={abandoningId === session.id}
            disabled={abandoningId !== null}
          >
            Abandon
          </Button>
        </>
      )}
      {session.status === 'COMPLETED' && (
        <Button variant="primary" href={"/results/" + session.id}>View Results</Button>
      )}
    </div>
    {abandonError === session.id && (
      <p className="text-red-600 text-sm mt-2">Failed to abandon session. Please try again.</p>
    )}
  </Card>
  ```

  **`handleAbandon` function**:
  ```typescript
  async function handleAbandon(id: string) {
    setAbandonError(null);
    setAbandoningId(id);
    try {
      const res = await fetch('/api/sessions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABANDONED' }),
      });
      if (res.ok) {
        router.refresh();
        setAbandoningId(null);
      } else {
        setAbandoningId(null);
        setAbandonError(id);
      }
    } catch {
      setAbandoningId(null);
      setAbandonError(id);
    }
  }
  ```
  `router` is `const router = useRouter()`.

- **Testing**:
  - Unit: No dedicated unit test file is required for this component (the component is exercised by T7's HomePage test which renders through the page and mocks DashboardTabs, and the manual browser test).
  - Integration: After T6 (page.tsx update), render `http://localhost:3000/` in the browser and verify both tabs render, job cards appear, and session cards appear with the correct badges and action buttons.
  - Manual: (a) Click "My Interviews" tab — verify it shows session list. (b) Click "Available Positions" tab — verify job grid reappears. (c) Click "Abandon" on an IN_PROGRESS session — verify button shows spinner, then session refreshes with ABANDONED badge. (d) Test fail case: use DevTools to intercept the PATCH response and return 500; verify inline error message appears.

---

### T5: Create `/results/[sessionId]` React Server Component

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/results/[sessionId]/page.tsx` — new `async` RSC (no `'use client'`)
- **Implementation notes**:
  The middleware already protects `/results/:path*` via `src/middleware.ts`; no middleware changes are needed.

  **Auth / email extraction** at top of the component:
  ```typescript
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value ?? '';
  const payload = await verifyToken(token);
  const userEmail = payload?.email ?? '';
  ```
  Do not redirect if token is invalid — middleware already handles it. If somehow reached with invalid token, `userEmail` renders as empty string.

  **Data fetch**:
  ```typescript
  let session: <full Prisma type including job, turns, evaluation> | null = null;
  let fetchError = false;
  try {
    session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      include: {
        job: { select: { id: true, title: true } },
        turns: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
      },
    });
  } catch {
    fetchError = true;
  }
  ```

  **Not-found state** (render when `!fetchError && session === null`):
  ```tsx
  <main className="flex min-h-screen flex-col items-center justify-center p-8">
    <p className="text-zinc-700 mb-4">Session not found.</p>
    <Button href="/" variant="secondary">Back to Home</Button>
  </main>
  ```

  **Error state** (render when `fetchError === true`):
  ```tsx
  <main className="flex min-h-screen flex-col items-center justify-center p-8">
    <p className="text-zinc-700 mb-4">Something went wrong. Please try again.</p>
    <Button href="/" variant="secondary">Back to Home</Button>
  </main>
  ```

  **Full layout** (when session is found):
  ```tsx
  <div className="min-h-screen flex flex-col bg-zinc-50">
    <header className="border-b border-zinc-200 bg-white px-4 py-3 flex items-center justify-between">
      <span className="font-bold text-lg">AI Interviewer</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-600 truncate">{userEmail}</span>
        <LogoutButton />
      </div>
    </header>
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
      {/* Session details */}
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">{session.job.title} Interview</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-zinc-500">
            {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          {session.status === 'IN_PROGRESS' && <Badge variant="in-progress">In Progress</Badge>}
          {session.status === 'COMPLETED' && <Badge variant="completed">Completed</Badge>}
          {session.status === 'ABANDONED' && <Badge variant="abandoned">Abandoned</Badge>}
        </div>
        {session.evaluation && (
          <p className="text-lg font-semibold mt-2">Score: {session.evaluation.score}/10</p>
        )}
      </section>
      {/* Transcript */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">Transcript</h2>
        {session.turns.length === 0 ? (
          <p className="text-zinc-500">No turns recorded.</p>
        ) : (
          <TranscriptView turns={session.turns.map(t => ({
            id: t.id,
            speaker: t.speaker,
            content: t.content,
            createdAt: t.createdAt.toISOString(),
          }))} />
        )}
      </section>
      {/* Evaluation */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">Evaluation</h2>
        {!session.evaluation ? (
          <p className="text-zinc-500">Evaluation not yet available.</p>
        ) : (
          <>
            <p className="text-2xl font-bold mb-4">Score: {session.evaluation.score}/10</p>
            <h3 className="text-lg font-semibold mt-4 mb-2">Strengths</h3>
            {Array.isArray(session.evaluation.strengths) ? (
              <ul className="list-disc list-inside text-zinc-700">
                {(session.evaluation.strengths as string[]).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : (
              <p className="text-zinc-500">No data available.</p>
            )}
            <h3 className="text-lg font-semibold mt-4 mb-2">Concerns</h3>
            {Array.isArray(session.evaluation.concerns) ? (
              <ul className="list-disc list-inside text-zinc-700">
                {(session.evaluation.concerns as string[]).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            ) : (
              <p className="text-zinc-500">No data available.</p>
            )}
          </>
        )}
      </section>
      <div>
        <Button href="/" variant="secondary">Back to Home</Button>
      </div>
    </main>
  </div>
  ```

  Import `cookies` from `next/headers`, `verifyToken` from `@/lib/auth`, `prisma` from `@/lib/prisma`, `Button` and `Badge` from `@/components/ui`, `LogoutButton` from `@/components/LogoutButton`, `TranscriptView` from `@/components/TranscriptView`.

  The `TranscriptView` is a `'use client'` component. Since the results page is an RSC, it can render `TranscriptView` directly (Next.js allows RSCs to import and render client components). `createdAt` is passed as `.toISOString()` (a string), which is safe across the RSC→client boundary and satisfies `TranscriptTurn.createdAt: string | Date` from T1.

- **Testing**:
  - Unit: No dedicated test file is required (results page is an RSC with straightforward DB-fetch-and-render logic; edge cases covered by error/not-found states).
  - Integration / Manual: (a) Navigate to `/results/<id>` for an existing session — verify job title as h1, status badge, turns rendered, evaluation data (or "not yet available"). (b) Navigate to `/results/nonexistent-id` — verify "Session not found." with Back button. (c) Test with no `auth_token` cookie — middleware redirects to `/login` before the page renders.

---

### T6: Update `src/app/page.tsx` to render `DashboardTabs`

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/page.tsx` — modify existing file
- **Implementation notes**:
  The file remains a `async` RSC with no `'use client'` directive. The auth guard (cookie + `verifyToken` + redirect) is preserved exactly as currently implemented.

  **After auth**, add the sessions query alongside the existing jobs query:
  ```typescript
  let jobs: { id: string; title: string; description: string }[] = [];
  let jobsError = false;
  try {
    jobs = await prisma.job.findMany({ orderBy: { createdAt: 'asc' } });
  } catch (err) {
    console.error('[page] Failed to load jobs:', err);
    jobsError = true;
  }

  let sessions: SessionListItem[] = [];
  let sessionsError = false;
  try {
    const rawSessions = await prisma.session.findMany({
      where: { userId: payload.sub },
      include: {
        job: { select: { id: true, title: true } },
        evaluation: { select: { score: true } },
        _count: { select: { turns: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    sessions = rawSessions.map(s => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      job: s.job,
      turnCount: s._count.turns,
      evaluationScore: s.evaluation?.score ?? null,
    }));
  } catch (err) {
    console.error('[page] Failed to load sessions:', err);
    sessionsError = true;
  }
  ```

  **Remove** the existing `<h1 className="...">Available Positions</h1>` from the JSX. The `<main>` element keeps `flex-1 max-w-6xl mx-auto w-full px-4 py-8` and now renders only:
  ```tsx
  <DashboardTabs
    jobs={jobs}
    jobsError={jobsError}
    sessions={sessions}
    sessionsError={sessionsError}
  />
  ```

  Add imports for `SessionListItem` from `@/types` and `DashboardTabs` from `@/components/DashboardTabs`. Remove the now-unused `Card`, `Button`, and `Link` imports from the page (they are used inside `DashboardTabs` instead).

- **Testing**:
  - Unit: Covered by T7 (updated `HomePage.test.tsx`).
  - Manual: Visit `http://localhost:3000/` — confirm two tabs render, jobs appear under Available Positions, sessions appear under My Interviews (ordered most-recent first).

---

### T7: Update `src/__tests__/HomePage.test.tsx`

- **Type**: backend
- **Wave**: 4
- **Files to create or modify**:
  - `src/__tests__/HomePage.test.tsx` — modify existing file
- **Implementation notes**:
  The test uses `jest.unstable_mockModule` with dynamic imports. The following changes are required:

  1. **Add session mock**: Add `mockSessionFindMany` mock function and include it in the `@/lib/prisma` mock:
     ```typescript
     const mockSessionFindMany = jest.fn<() => Promise<Array<...>>>();
     jest.unstable_mockModule('@/lib/prisma', () => ({
       prisma: {
         job: { findMany: mockJobFindMany },
         session: { findMany: mockSessionFindMany },
       },
     }));
     ```
     The mock return type should match the shape returned by the Prisma query with `include`/`_count` (i.e., include `job`, `evaluation`, `_count.turns`, `status`, `startedAt`, `endedAt`).

  2. **Add `DashboardTabs` mock**: Add a mock for `@/components/DashboardTabs` that renders a simple div capturing its props, so assertions can check what data the page passes:
     ```typescript
     const mockDashboardTabs = jest.fn<(props: Record<string, unknown>) => React.ReactElement>();
     jest.unstable_mockModule('@/components/DashboardTabs', () => ({
       DashboardTabs: mockDashboardTabs,
     }));
     ```
     In `beforeEach`, set `mockDashboardTabs.mockImplementation(() => React.createElement('div', { 'data-testid': 'dashboard-tabs' }))`.

  3. **Update `beforeEach`**: Set `mockSessionFindMany.mockResolvedValue([])` as the default (empty sessions list). Set `mockDashboardTabs` default implementation per step 2.

  4. **Update assertions**: The test currently checks for `h1 "Available Positions"` which no longer exists. Replace that assertion with a check that `screen.getByTestId('dashboard-tabs')` is in the document. Remove or update test `'renders h1 "Available Positions" and job titles when authenticated'` — it should instead assert that `DashboardTabs` was called with `jobs: SAMPLE_JOBS` and `jobsError: false`.

  5. **Add new tests**: 
     - `sessions query is called with userId from JWT payload`: verify `mockSessionFindMany` is called with `{ where: { userId: 'user-1' }, include: { ... }, orderBy: { startedAt: 'desc' } }`.
     - `sessions error sets sessionsError=true`: mock `mockSessionFindMany.mockRejectedValue(new Error('DB error'))` and verify `mockDashboardTabs` is called with `sessionsError: true`.
     - `both queries fail independently`: mock both to reject; verify page still renders without crashing and `DashboardTabs` called with both error flags `true`.

  6. **Preserve existing tests**: Auth redirect tests (`calls redirect("/login") when cookie is absent`, `calls redirect("/login") when verifyToken returns null`) remain intact with the same assertions.

- **Testing**:
  - Unit: Run `npx jest src/__tests__/HomePage.test.tsx` — all tests must pass.
  - Integration: Run `npm test` — the full test suite must pass with no regressions.
  - Manual: `npm run build` must succeed (no TypeScript or import errors).

## Data migrations

No Prisma schema changes are required. All fields used by this feature (`sessions.user_id`, `sessions.ended_at`, `sessions.status`, `evaluations.score`, `evaluations.strengths`, `evaluations.concerns`) already exist with correct `@map("snake_case")` annotations.

## API documentation updates

`docs/openapi.yaml` must be updated in T3 with the following new path entry:

```yaml
/api/sessions/{sessionId}:
  patch:
    summary: Mark an in-progress session as ABANDONED
    operationId: abandonSession
    tags: [sessions]
    security:
      - cookieAuth: []
    parameters:
      - name: sessionId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [status]
            properties:
              status:
                type: string
                enum: [ABANDONED]
    responses:
      '200': { id: string, status: 'ABANDONED' }
      '400': Invalid body or wrong status value
      '401': Missing or invalid auth token
      '403': Session belongs to a different user
      '404': Session ID not found
      '409': Session is not IN_PROGRESS
      '500': Unexpected server error
```

The backend-implementer for T3 must write the complete YAML block following the formatting conventions of the existing entries in `docs/openapi.yaml`.

## Cross-cutting concerns

- **`SessionListItem`** (added in T1) is consumed by T4 (`DashboardTabs` props), T6 (`page.tsx` mapping), and T7 (test mock types). T1 must complete before any of these tasks begin.
- **`Badge` new variants** (added in T2) are consumed by T4 (`DashboardTabs` session card) and T5 (Results page status display). T2 must complete before T4 and T5 begin.
- **`TranscriptTurn.createdAt: string | Date`** (changed in T1) enables T5 (Results page) to safely pass `.toISOString()` strings to `TranscriptView`. No code changes are needed in `TranscriptView.tsx` itself since it does not access `createdAt` in its render output.
- **UI primitives used**: `Button`, `Card`, `Badge` from `src/components/ui/` — all already exist. No new primitives need to be created.
- **Auth utility reuse**: `verifyToken` from `@/lib/auth` and `prisma` from `@/lib/prisma` are used in T3, T5, and T6 without modification.
