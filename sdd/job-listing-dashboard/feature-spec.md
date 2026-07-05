# Feature Spec: Job Listing Dashboard

## Overview

Transforms the authenticated home page (`/`) from a single-section job listing into a two-tabbed dashboard. The first tab ("Available Positions") preserves the current job-card grid. The second tab ("My Interviews") lists all past interview sessions belonging to the logged-in user, grouped by status, with context actions. A companion results page is created at `/results/[sessionId]` to display a session's full turn-by-turn transcript and structured evaluation data. A new `PATCH /api/sessions/[sessionId]` endpoint allows clients to mark an in-progress session as ABANDONED.

---

## Scope

**Included:**
- `src/app/page.tsx` (modified): adds server-side sessions fetch alongside jobs; renders `<DashboardTabs>` client component instead of the job grid directly; preserves auth guard and header unchanged.
- `src/components/DashboardTabs.tsx` (new): `'use client'` component that receives `jobs` and `sessions` props from the server component and implements the two-tab UI with client-side tab state.
- `src/components/ui/Badge.tsx` (extended): adds three new variants — `'in-progress'`, `'completed'`, `'abandoned'` — for session status display. Existing `'ai'` and `'user'` variants are unchanged.
- `src/components/ui/index.ts` (unchanged): Badge is already exported; no modification required.
- `src/app/api/sessions/[sessionId]/route.ts` (new): `PATCH` handler that marks an in-progress session as ABANDONED.
- `src/app/results/[sessionId]/page.tsx` (new): async React Server Component that fetches session, turns, and evaluation from the database and renders the full results view.
- `src/types/index.ts` (extended): adds `SessionListItem` interface for the RSC-to-client-component data boundary.
- `docs/openapi.yaml` (updated): documents `PATCH /api/sessions/{sessionId}`.
- `src/__tests__/HomePage.test.tsx` (updated): reflects the new page structure where both sections are rendered inside `DashboardTabs`.

**Explicitly out of scope:**
- Creating the `POST /api/evaluate` endpoint or modifying `InterviewRoom` to call it (deferred; the results page gracefully handles sessions with no evaluation).
- Adding `GET /api/sessions` as an API endpoint (sessions are fetched server-side in the RSC, consistent with how jobs are fetched).
- True session resumption: clicking "Continue" on an in-progress session navigates to `/interview/[jobId]` which creates a new session; the old session remains in the DB until explicitly abandoned.
- Pagination or filtering of sessions.
- Displaying sessions belonging to other users.
- Job creation, editing, or deletion UI.
- Changing `src/middleware.ts` — it already protects `/results/:path*`; no modification needed.

---

## User Stories

- As an authenticated user, I want to see both the available job positions and my past interview history on the home page so I can navigate the platform from one place.
- As an authenticated user, I want to switch between "Available Positions" and "My Interviews" tabs so I can focus on the section I need.
- As an authenticated user, I want each past session card to show the job title, a status badge, the start date, and the number of turns so I can identify my interviews at a glance.
- As an authenticated user with no past sessions, I want to see an empty state message in the "My Interviews" tab so I understand the section is working but empty.
- As an authenticated user, I want to click "View Results" on a completed session and be taken to `/results/[sessionId]` to see the full transcript and evaluation.
- As an authenticated user, I want to click "Continue" on an in-progress session to start the interview flow for that job again.
- As an authenticated user, I want to click "Abandon" on an in-progress session so I can clean up sessions I do not intend to finish; the session should disappear from the in-progress group after abandonment.
- As an authenticated user on the results page, I want to see every turn of the conversation in order so I can review the full interview.
- As an authenticated user on the results page, I want to see the overall evaluation score, strengths, and concerns if an evaluation exists so I can understand how I performed.
- As an authenticated user on the results page, I want a "Back to Home" link so I can navigate back to the dashboard.

---

## Functional Requirements

### Home Page — `src/app/page.tsx`

1. The page remains an `async` React Server Component with no `'use client'` directive. The auth guard (cookie verification, redirect to `/login`) is preserved exactly as currently implemented.

2. After a successful auth check, the page performs two independent database queries wrapped in separate `try/catch` blocks:
   - **Jobs query**: `prisma.job.findMany({ orderBy: { createdAt: 'asc' } })` (unchanged from current implementation).
   - **Sessions query**: `prisma.session.findMany({ where: { userId }, include: { job: { select: { id: true, title: true } }, evaluation: { select: { score: true } }, _count: { select: { turns: true } } }, orderBy: { startedAt: 'desc' } })` where `userId` is extracted from the verified JWT payload (`payload.sub`).

3. If the jobs query throws, `jobsError` is set to `true` and `jobs` is set to `[]`. The error is logged to `console.error`. The page does not crash.

4. If the sessions query throws, `sessionsError` is set to `true` and `sessions` is set to `[]`. The error is logged to `console.error`. The page does not crash.

5. The server component maps the raw Prisma session result into `SessionListItem[]` before passing it to `DashboardTabs`. The mapping converts `startedAt` and `endedAt` `Date` objects to ISO 8601 strings, maps `_count.turns` to `turnCount`, and maps `evaluation?.score ?? null` to `evaluationScore`.

6. The page renders:
   - The existing `<header>` (branding + user email + `LogoutButton`) — unchanged.
   - A `<main>` element with `flex-1` growth containing:
     ```tsx
     <DashboardTabs
       jobs={jobs}
       jobsError={jobsError}
       sessions={sessions}
       sessionsError={sessionsError}
     />
     ```

### `SessionListItem` Type — `src/types/index.ts`

7. A new interface `SessionListItem` is added to `src/types/index.ts`:
   ```typescript
   export interface SessionListItem {
     id: string;
     status: SessionStatus;
     startedAt: string; // ISO 8601 string
     endedAt: string | null; // ISO 8601 string
     job: {
       id: string;
       title: string;
     };
     turnCount: number;
     evaluationScore: number | null;
   }
   ```

### Dashboard Tabs Component — `src/components/DashboardTabs.tsx`

8. `DashboardTabs` is a `'use client'` component. It accepts the following props (all required):
   ```typescript
   interface DashboardTabsProps {
     jobs: Array<{ id: string; title: string; description: string }>;
     jobsError: boolean;
     sessions: SessionListItem[];
     sessionsError: boolean;
   }
   ```

9. Tab state is managed with `useState<'positions' | 'interviews'>` initialized to `'positions'`.

10. The component renders a tab bar with exactly two tab buttons: "Available Positions" and "My Interviews". The active tab button is visually distinct from the inactive one (border-bottom highlight or background change using Tailwind utility classes). The tab bar uses `role="tablist"`; each button uses `role="tab"` and `aria-selected={isActive}`.

11. Below the tab bar, the component conditionally renders one panel at a time:
    - When `activeTab === 'positions'`: renders the Available Positions panel (requirement 12).
    - When `activeTab === 'interviews'`: renders the My Interviews panel (requirement 15).

12. **Available Positions panel**: Identical to the job grid currently rendered directly in `page.tsx`:
    - If `jobsError === true`: renders `<p className="text-zinc-500 text-center py-12">Unable to load positions. Please try again later. <a href="/" className="underline text-zinc-700">Refresh</a></p>`.
    - If `jobs.length === 0` and `jobsError === false`: renders `<p className="text-zinc-500 text-center py-12">No positions available at this time.</p>`.
    - Otherwise: renders a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` grid. Each job renders one `<Card>` containing: `<h2>` with job title, `<p>` with description (`line-clamp-3`), and a `<Button href={"/interview/" + job.id} variant="primary" className="mt-4 w-full">Start Interview</Button>`.

13. The `<h1>` heading is removed from the page server component and moved into `DashboardTabs`, where it is replaced by the tab bar. The panel area begins immediately below the tab bar with no additional `<h1>`.

14. The tab panel area uses `role="tabpanel"`.

15. **My Interviews panel**: Lists all sessions passed via `sessions` prop.
    - If `sessionsError === true`: renders `<p className="text-zinc-500 text-center py-12">Unable to load interviews. Please try again later.</p>`.
    - If `sessions.length === 0` and `sessionsError === false`: renders `<p className="text-zinc-500 text-center py-12">No past interviews yet. Start one from the Available Positions tab.</p>`.
    - Otherwise: renders a vertical list (`flex flex-col gap-4`) of session cards, one per session (requirement 16).

16. **Session card**: Each session renders a `<Card>` containing:
    - First row: `<h2>` with `job.title` (font-semibold), and a `<Badge>` for `status` (see requirements 19–21) floated or flex-end.
    - Second row (metadata line, `text-sm text-zinc-500`): start date formatted as `"Started: <human-readable date>"` (e.g., `"Started: Jul 5, 2026"`) and turn count formatted as `"<n> turn(s)"`.
    - Third row (actions, right-aligned or flex-end): contextual action buttons (requirement 17).

17. **Session card action buttons** per status:
    - `IN_PROGRESS`:
      - `<Button variant="secondary" href={"/interview/" + session.job.id}>Continue</Button>` — links to the interview page for that job. No API call; the interview room will start a new session.
      - `<Button variant="secondary" onClick={handleAbandon(session.id)} loading={abandoningId === session.id} disabled={abandoningId !== null}>Abandon</Button>` — triggers the abandon flow (requirement 18).
    - `COMPLETED`:
      - `<Button variant="primary" href={"/results/" + session.id}>View Results</Button>` — navigates to the results page.
    - `ABANDONED`:
      - No action buttons. Renders only the status badge and metadata.

18. **Abandon flow** (inside `DashboardTabs`):
    - `abandoningId` state is `string | null`, initialized to `null`.
    - `abandonError` state is `string | null`, initialized to `null`. It holds the ID of the session whose abandon last failed (used to display an inline error on that card). It is cleared to `null` at the start of the next abandon attempt (before the fetch call).
    - When "Abandon" is clicked for session `id`:
      1. Sets `abandonError = null` (clears any prior error).
      2. Sets `abandoningId = id`.
      3. Calls `fetch('/api/sessions/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ABANDONED' }) })`.
      4. On success (HTTP 200): calls `router.refresh()` (from `useRouter`) and sets `abandoningId = null`.
      5. On non-2xx response or network error: sets `abandoningId = null` and sets `abandonError = id`. The session card for the failed abandon renders an inline error message: `<p className="text-red-600 text-sm mt-2">Failed to abandon session. Please try again.</p>` (visible only when `abandonError === session.id`).
    - While `abandoningId !== null`, all "Abandon" buttons across all cards are disabled (only one abandon can be in-flight at a time).

### Badge Component Extension — `src/components/ui/Badge.tsx`

19. `BadgeProps.variant` is extended to `'ai' | 'user' | 'in-progress' | 'completed' | 'abandoned'`. The union is additive — the existing `'ai'` and `'user'` branches are unchanged.

20. New variant rendering:
    - `'in-progress'`: `<span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>` with text "In Progress".
    - `'completed'`: `<span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>` with text "Completed".
    - `'abandoned'`: `<span className="inline-block bg-zinc-100 text-zinc-600 text-xs font-medium px-2 py-0.5 rounded-full">{children}</span>` with text "Abandoned".

21. The `children` prop is optional for the three new status variants. When a `SessionStatus` value is passed to `<Badge variant="in-progress">` etc., the `children` label is explicitly passed by the caller with the human-readable label.

    The session card renders the badge as:
    - `<Badge variant="in-progress">In Progress</Badge>`
    - `<Badge variant="completed">Completed</Badge>`
    - `<Badge variant="abandoned">Abandoned</Badge>`

### `PATCH /api/sessions/[sessionId]` — `src/app/api/sessions/[sessionId]/route.ts`

22. A new file `src/app/api/sessions/[sessionId]/route.ts` exports a `PATCH` handler. The handler:
    - Reads the `auth_token` cookie and calls `verifyToken`. If absent or invalid, returns `401 { error: 'Unauthorized' }`.
    - Parses the request body as JSON. If parsing fails, returns `400 { error: 'Invalid request body' }`.
    - Validates that `body.status === 'ABANDONED'`. Any other value returns `400 { error: 'status must be ABANDONED' }`.
    - Looks up the session by `params.sessionId` with `prisma.session.findUnique({ where: { id: params.sessionId } })`. If not found, returns `404 { error: 'Session not found' }`.
    - Verifies that `session.userId === payload.sub`. If not (including when `session.userId` is `null`, since `null !== payload.sub`), returns `403 { error: 'Forbidden' }`.
    - Verifies that `session.status === 'IN_PROGRESS'`. If already `ABANDONED` or `COMPLETED`, returns `409 { error: 'Session is not in progress' }`.
    - Calls `prisma.session.update({ where: { id: params.sessionId }, data: { status: 'ABANDONED', endedAt: new Date() } })`.
    - Returns `200 { id: session.id, status: 'ABANDONED' }`.
    - Wraps the entire handler body in a `try/catch` that returns `500 { error: 'Internal server error' }` on unexpected errors.

### Results Page — `src/app/results/[sessionId]/page.tsx`

23. `src/app/results/[sessionId]/page.tsx` is a new `async` React Server Component (no `'use client'`). The middleware at `src/middleware.ts` already protects `/results/:path*` — no changes to middleware are needed.

24. The page fetches:
    ```typescript
    prisma.session.findUnique({
      where: { id: params.sessionId },
      include: {
        job: { select: { id: true, title: true } },
        turns: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
      },
    })
    ```
    If the query throws, the page renders an error state (requirement 28). If the session is not found (returns `null`), the page renders a not-found state (requirement 27).

25. The page renders a full-page layout using the same outer shell as the home page:
    - A root `<div className="min-h-screen flex flex-col bg-zinc-50">`.
    - `<header className="border-b border-zinc-200 bg-white px-4 py-3 flex items-center justify-between">`: "AI Interviewer" branding on the left, user email and `<LogoutButton />` on the right.
    - `<main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-8">`: contains the session details section, transcript section, evaluation section, and "Back to Home" button.

    The auth token (for the user's email in the header) is read from the `auth_token` cookie using `cookies()` and `verifyToken`. If the token is invalid, the middleware already redirected; the component does not perform a secondary redirect (it may render the email as an empty string if somehow reached without a valid token).

26. **Session details section** (top of main):
    - `<h1>` containing `"<job.title> Interview"` (e.g., "Software Engineer Interview").
    - A metadata line showing start date (`startedAt` formatted as full locale date string), status badge using the extended `Badge` component.
    - If session has `evaluation`, display overall score prominently: `<p>Score: <score>/10</p>`.

27. **Not-found state**: Renders:
    ```tsx
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-zinc-700 mb-4">Session not found.</p>
      <Button href="/" variant="secondary">Back to Home</Button>
    </main>
    ```

28. **Error state**: Renders:
    ```tsx
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-zinc-700 mb-4">Something went wrong. Please try again.</p>
      <Button href="/" variant="secondary">Back to Home</Button>
    </main>
    ```

29. **Transcript section**: Renders `<h2>Transcript</h2>` followed by a list of turns in chronological order. Each turn renders using the existing `<TranscriptView>` component.

    Because the results page is a React Server Component and `TranscriptView` is a `'use client'` component, `Date` objects cannot cross the RSC→client boundary without serialization. The spec therefore requires that:
    - `TranscriptTurn.createdAt` in `src/types/index.ts` is changed from `Date` to `string` (ISO 8601). This is a non-breaking change to the existing type because the only consumer (`InterviewRoom`) already constructs turns with `new Date()` which must be converted to `.toISOString()` at the `TranscriptView` call-site, or alternatively `TranscriptView` is updated to accept `createdAt: string | Date` and always display using `.toLocaleString()` / `new Date(createdAt).toLocaleString()`.
    - The results page maps turns as:
      ```tsx
      <TranscriptView turns={session.turns.map(t => ({
        id: t.id,
        speaker: t.speaker,
        content: t.content,
        createdAt: t.createdAt.toISOString(),
      }))} />
      ```
    - `TranscriptView.tsx` is updated to accept `createdAt: string | Date` in its internal turn shape and convert strings to `Date` objects locally for display (e.g., `new Date(turn.createdAt).toLocaleTimeString()`). This is a backward-compatible change: `InterviewRoom` passes `new Date()` (still valid), and the results page passes an ISO string.

    If `session.turns` is empty, renders `<p className="text-zinc-500">No turns recorded.</p>` instead of `<TranscriptView>`.

30. **Evaluation section**: Renders `<h2>Evaluation</h2>` followed by evaluation data.
    - If `session.evaluation` is `null` (no evaluation generated yet), renders:
      ```tsx
      <p className="text-zinc-500">Evaluation not yet available.</p>
      ```
    - If `session.evaluation` is present:
      - Score: `<p className="text-2xl font-bold">Score: {evaluation.score}/10</p>`
      - Strengths: `<h3>Strengths</h3>` followed by a `<ul>` listing each item from `evaluation.strengths` (JSON array of strings).
      - Concerns: `<h3>Concerns</h3>` followed by a `<ul>` listing each item from `evaluation.concerns` (JSON array of strings).

31. **Back to Home link**: A `<Button href="/" variant="secondary">Back to Home</Button>` appears at the bottom of `<main>`.

---

## Non-Functional Requirements

- **Performance**: Sessions query must include `_count` for turns rather than fetching all turn rows; results page fetches full turns only for a single session. Both queries should complete under 500 ms under normal load. No client-side data waterfalls on the home page (all data is server-fetched).
- **Security**:
  - `PATCH /api/sessions/[sessionId]` verifies the JWT and checks `session.userId === payload.sub` to prevent cross-user session manipulation.
  - The results page is protected by the existing middleware JWT check. The page does not expose session data to unauthenticated users.
  - No raw Prisma error messages are surfaced to the client.
- **Browser support**: `DashboardTabs` uses only standard React hooks (`useState`, `useRouter`). No browser-specific APIs. The tab UI must render correctly in Chrome, Firefox, Safari, and Edge.
- **Accessibility**:
  - Tab bar uses `role="tablist"`, each tab button uses `role="tab"` and `aria-selected`.
  - Active tab panel uses `role="tabpanel"`.
  - Session card actions are keyboard-accessible via standard `<button>` and `<a>` elements (via `Button` component).
  - Status badges have sufficient color contrast (WCAG AA). Text labels are always present alongside color.
  - Heading hierarchy on home page: tab bar replaces the `<h1>` — there is no `<h1>` on the dashboard page itself. Each job card title uses `<h2>`. Each session card title uses `<h2>`. Results page has one `<h1>`.
- **Responsive design**: Session list renders as a single column at all viewport widths. Session card action buttons wrap gracefully on narrow viewports.
- **Type safety**: No `any` types. All component props and API response shapes are fully typed. Date serialization from RSC to client component boundary uses ISO strings (not `Date` objects).
- **Test regression**: `npm test` must pass in full after all changes, including the updated `src/__tests__/HomePage.test.tsx`.

---

## Data Model Changes

No new Prisma models or migrations are required. All required fields (`session.user_id`, `session.ended_at`, `session.status`, `evaluation.strengths`, `evaluation.concerns`, `evaluation.score`) already exist in `prisma/schema.prisma`.

The `PATCH` handler sets `endedAt` on abandon, which uses the existing `ended_at` column (`@map("ended_at")`).

---

## API Contracts

### `PATCH /api/sessions/{sessionId}`

**Purpose**: Mark an in-progress session as ABANDONED.

**Request**
```
PATCH /api/sessions/{sessionId}
Content-Type: application/json
Cookie: auth_token=<jwt>
```
```json
{ "status": "ABANDONED" }
```

**Success Response — `200 OK`**
```json
{ "id": "clxyz...", "status": "ABANDONED" }
```

**Error Responses**

| HTTP Status | Condition | Body |
|-------------|-----------|------|
| 400 | Body is not valid JSON | `{ "error": "Invalid request body" }` |
| 400 | `status` field is not `"ABANDONED"` | `{ "error": "status must be ABANDONED" }` |
| 401 | Missing or invalid `auth_token` cookie | `{ "error": "Unauthorized" }` |
| 403 | Session belongs to a different user | `{ "error": "Forbidden" }` |
| 404 | Session ID not found | `{ "error": "Session not found" }` |
| 409 | Session is not `IN_PROGRESS` | `{ "error": "Session is not in progress" }` |
| 500 | Unexpected server or database error | `{ "error": "Internal server error" }` |

**New type added to `src/types/index.ts`**:
```typescript
export interface PatchSessionResponse {
  id: string;
  status: 'ABANDONED';
}
```

---

## UI Behaviour

### `/` — Home Page (Dashboard)

**What the user sees:**
- The same header as before (branding, email, Log out button).
- A two-tab bar: "Available Positions" (default active) and "My Interviews".
- Below the tab bar: the content of the active tab.

**Available Positions tab:**
- Same job card grid as before.
- Loading: not applicable (data is server-fetched; page renders complete).
- Empty: "No positions available at this time."
- Error: "Unable to load positions. Please try again later. [Refresh]"

**My Interviews tab:**
- A vertical list of session cards, most recent first.
- Each card: job title, status badge, start date, turn count, action buttons.
- Empty: "No past interviews yet. Start one from the Available Positions tab."
- Error: "Unable to load interviews. Please try again later."
- During abandon: the clicked "Abandon" button shows a loading spinner; all other "Abandon" buttons are disabled.
- After successful abandon: `router.refresh()` re-fetches sessions; the abandoned session now shows with `ABANDONED` badge and no action buttons.

### `/results/[sessionId]` — Results Page

**What the user sees:**
- Same page header as the home page.
- Job title as `<h1>`, session metadata (date, status badge, score if present).
- "Transcript" section with all turns in order.
- "Evaluation" section with score, strengths, and concerns (or "not yet available").
- "Back to Home" button at the bottom.

**What the user can do:**
- Read the transcript.
- Read the evaluation.
- Click "Back to Home" to return to `/`.

**Loading state**: None — server component renders synchronously.

**Empty transcript**: "No turns recorded."

**Missing evaluation**: "Evaluation not yet available."

**Not-found state**: "Session not found." with "Back to Home" button.

**Error state**: "Something went wrong. Please try again." with "Back to Home" button.

---

## Edge Cases & Error Handling

1. **Jobs query fails but sessions query succeeds**: `jobsError` is `true`; jobs error state is shown in the Available Positions tab. My Interviews tab works normally. Page does not crash.

2. **Sessions query fails but jobs query succeeds**: `sessionsError` is `true`; sessions error state is shown in the My Interviews tab. Available Positions tab works normally.

3. **Both queries fail**: Both error states are shown in their respective tabs. The page still renders with the header and tab UI intact.

4. **Session has no `userId` (created without auth)**: `prisma.session.findMany({ where: { userId } })` will not return sessions where `userId` is `null` because `payload.sub` is always a non-null string. Such sessions are invisible to all users on the dashboard. This is expected behavior.

5. **Concurrent abandon clicks**: The `abandoningId` state prevents multiple simultaneous PATCH calls. While one is in-flight, all other "Abandon" buttons are disabled.

6. **Abandon fails (network error or non-2xx response)**: `abandoningId` is reset to `null` and `abandonError` is set to the session's ID. The affected session card shows `<p className="text-red-600 text-sm mt-2">Failed to abandon session. Please try again.</p>`. The error clears automatically on the next abandon attempt (see requirement 18 step 1).

7. **Abandon of already-ABANDONED or COMPLETED session**: The server returns `409`. The client treats this as a non-2xx response and shows the inline error per edge case 6.

8. **Results page — session belongs to a different user**: The middleware only verifies that the user is authenticated, not that they own the session. The results page does not verify ownership (showing another user's transcript is acceptable in this no-multi-tenancy design, consistent with the feature request's note that sessions are not strictly scoped). This is documented in Open Decisions.

9. **Results page — evaluation.strengths or evaluation.concerns is not a valid JSON array**: The `Evaluation.strengths` and `Evaluation.concerns` fields are `Json` in Prisma. The results page must defensively cast them and only render list items if the value is an array. If not an array, render `<p className="text-zinc-500">No data available.</p>` instead of the list.

10. **`DashboardTabs` receives sessions with mixed statuses**: The component does not group by status in separate visual sections — sessions are rendered as a flat list ordered by `startedAt` descending (most recent first). Status is indicated per-card via the Badge component.

11. **Very long job title in session card**: The session card `<h2>` uses `line-clamp-2` to prevent overflow.

12. **Results page — `TranscriptView` component**: The existing `TranscriptView` component is reused as-is. No modifications to `TranscriptView.tsx` are required.

---

## Acceptance Criteria

- [ ] The home page (`/`) renders a two-tab bar with "Available Positions" and "My Interviews" tabs.
- [ ] "Available Positions" is the active tab by default on page load.
- [ ] Clicking "My Interviews" tab shows the session list panel; clicking "Available Positions" shows the job grid.
- [ ] The Available Positions tab renders the same job card grid that previously existed on the page.
- [ ] The My Interviews tab shows a session card for each session belonging to the logged-in user.
- [ ] Session cards are ordered most recent first.
- [ ] Each session card displays the job title, a status badge, a formatted start date, and the turn count.
- [ ] A session with status `IN_PROGRESS` shows "Continue" and "Abandon" buttons.
- [ ] Clicking "Continue" on an in-progress session navigates to `/interview/[job.id]`.
- [ ] Clicking "Abandon" on an in-progress session calls `PATCH /api/sessions/[sessionId]` with `{ status: 'ABANDONED' }`.
- [ ] After a successful abandon, the session list refreshes and the session appears with `ABANDONED` status and no action buttons.
- [ ] While an abandon is in flight, the "Abandon" button shows a loading spinner and all other "Abandon" buttons are disabled.
- [ ] A session with status `COMPLETED` shows only a "View Results" button that links to `/results/[sessionId]`.
- [ ] A session with status `ABANDONED` shows no action buttons.
- [ ] The My Interviews empty state renders: "No past interviews yet. Start one from the Available Positions tab."
- [ ] The My Interviews error state renders when the sessions query throws.
- [ ] `PATCH /api/sessions/[sessionId]` returns `200 { id, status: 'ABANDONED' }` for a valid in-progress session owned by the caller.
- [ ] `PATCH /api/sessions/[sessionId]` returns `401` when called without a valid auth token.
- [ ] `PATCH /api/sessions/[sessionId]` returns `403` when the session belongs to a different user.
- [ ] `PATCH /api/sessions/[sessionId]` returns `404` when the session ID does not exist.
- [ ] `PATCH /api/sessions/[sessionId]` returns `409` when the session is already ABANDONED or COMPLETED.
- [ ] `PATCH /api/sessions/[sessionId]` returns `400` when `status` is any value other than `'ABANDONED'`.
- [ ] The results page (`/results/[sessionId]`) renders the job title as `<h1>`.
- [ ] The results page shows a status badge and formatted start date.
- [ ] The results page renders all turns in chronological order using `TranscriptView`.
- [ ] The results page renders the evaluation section with score, strengths, and concerns when an evaluation row exists.
- [ ] The results page renders "Evaluation not yet available." when no evaluation row exists.
- [ ] The results page renders "No turns recorded." when the session has no turns.
- [ ] The results page renders the not-found state with a "Back to Home" button when the session ID does not exist.
- [ ] The results page renders the error state with a "Back to Home" button when the database query throws.
- [ ] The `Badge` component accepts `'in-progress'`, `'completed'`, and `'abandoned'` variants without affecting existing `'ai'` and `'user'` variants.
- [ ] Status badges use blue, green, and zinc color schemes for in-progress, completed, and abandoned respectively.
- [ ] `src/types/index.ts` exports `SessionListItem` and `PatchSessionResponse`.
- [ ] `TranscriptTurn.createdAt` in `src/types/index.ts` accepts `string | Date` (or is changed to `string`), and `TranscriptView.tsx` handles both types without runtime errors.
- [ ] The results page passes serialized ISO string dates (`.toISOString()`) when calling `TranscriptView`.
- [ ] `docs/openapi.yaml` documents `PATCH /api/sessions/{sessionId}`.
- [ ] `npm test` passes in full after all changes, including the updated `src/__tests__/HomePage.test.tsx`.
- [ ] No `'use client'` directive appears in `src/app/page.tsx` or `src/app/results/[sessionId]/page.tsx`.
- [ ] No inline button or card styles are defined in any new component — all use primitives from `src/components/ui/`.
- [ ] `DashboardTabs` tab bar uses `role="tablist"`, tab buttons use `role="tab"` and `aria-selected`, and the panel uses `role="tabpanel"`.

---

## Open Decisions

1. **Session filtering by `userId` (not localStorage)**: The feature request mentions localStorage as one approach since "there is no user auth concept". However, the codebase has full auth (JWT cookie, `User` model, `session.user_id` FK). Sessions are already linked to `userId` when created. Filtering by `userId` from the JWT is more reliable, secure, and consistent with the existing data model. localStorage is not used.

2. **Sessions fetched server-side, not via `GET /api/sessions` endpoint**: The home page is a React Server Component that fetches data directly from Prisma, consistent with how jobs are fetched. Adding a `GET /api/sessions` route would introduce unnecessary client-side complexity (an extra network hop) for data that can be fetched during SSR. No `GET /api/sessions` endpoint is created.

3. **"Continue" creates a new session, not a true resume**: The `InterviewRoom` component always creates a new session on mount (dispatches `SESSION_CREATED` via `POST /api/sessions`). Making "Continue" resume an existing session would require significant changes to `InterviewRoom`, `/api/interview`, and the session state machine — well beyond the dashboard scope. "Continue" links to `/interview/[jobId]`, starting fresh. The old in-progress session remains in the DB until the user explicitly abandons it.

4. **Sessions not re-grouped by status**: The feature request says "grouped or labeled by status". The spec implements per-card status badges in a flat list sorted by recency. This is simpler to implement and provides equivalent information. If grouping into distinct sections (e.g., "In Progress", "Completed", "Abandoned" headers) is preferred, it can be added in a future iteration without API changes.

5. **Results page ownership check omitted**: The middleware verifies the user is authenticated but does not verify they own the session. The results page does not perform an additional ownership check. Since the platform is scoped to practice interviews (no competitive sensitivity), showing another user's transcript if they have the session ID is acceptable. A stricter check can be added if requirements change.

6. **`endedAt` is set to `new Date()` on abandon**: The `Session` model has an `ended_at` column intended to mark when a session finished. The abandon flow sets it at the time of the PATCH call. This is consistent with how a COMPLETED session would set `endedAt` via the future evaluate endpoint.

7. **Badge text is passed as children, not derived from variant**: The `Badge` component does not auto-generate label text from the variant name. Callers pass explicit human-readable labels. This makes the component more flexible (e.g., "In Progress" vs "in-progress" vs a localized string) without binding the component to specific copy.

8. **Heading hierarchy**: The current `page.tsx` has an `<h1>Available Positions</h1>`. After the refactor, the tab bar replaces the heading. The tab buttons serve as the primary navigation landmark for the two panels; no additional `<h1>` is needed. Each job card and session card uses `<h2>`. This maintains a valid heading hierarchy without a page-level `<h1>`.

9. **`DashboardTabs` error prop approach**: Rather than throwing in the server component and using a Next.js error boundary, errors in the sessions/jobs queries set boolean `*Error` flags that are passed as props to `DashboardTabs`. This allows both tabs to remain functional even if one data source fails, which is better UX than crashing the entire page.
