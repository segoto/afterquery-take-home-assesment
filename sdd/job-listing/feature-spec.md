# Feature Spec: Job Listing

## Overview

Implement the authenticated home page (`/`) that displays a grid of software/tech job openings stored in the database. When an authenticated user visits the root URL, they see all available job positions as cards. Each card shows the job title, a short description, and a "Start Interview" link-button that navigates to `/interview/[jobId]`. Unauthenticated visitors are redirected to `/login` via a server-side auth check in the page component. The existing `src/lib/jobs.ts` file is extended from 3 to 12 roles, and a new seed script (`prisma/seed.ts`) populates the database with idempotent upserts using the slug as the unique key.

---

## Scope

**Included:**
- `src/app/page.tsx` — Async React Server Component (replaces the boilerplate default page) that: verifies the `auth_token` cookie, redirects unauthenticated visitors to `/login`, fetches all jobs from the DB, and renders a responsive card grid
- `src/lib/jobs.ts` — EXTENDED (not rewritten): 9 new job entries added to the existing `JOBS` constant, maintaining the existing `readonly Job[]` type, `id`, `slug`, `title`, `description`, `questionPack: null` shape
- `prisma/seed.ts` — New idempotent seed script that upserts all jobs from `JOBS` using `slug` as the unique key
- `package.json` — Add `"prisma": { "seed": "npx tsx prisma/seed.ts" }` top-level key and add `"tsx"` to `devDependencies`
- `src/components/ui/Button.tsx` — Extended with an optional `href` prop; renders a Next.js `<Link>` with button styling when `href` is provided
- `src/components/LogoutButton.tsx` — New `'use client'` component: renders a secondary `Button`, calls `POST /api/auth/logout` on click, then redirects to `/login`

**Explicitly out of scope:**
- Interview room page (`/interview/[jobId]`) — already specced separately
- Results page (`/results/[sessionId]`)
- Job creation, editing, or deletion UI
- Pagination, search, or filtering
- Modifying `src/middleware.ts` — auth for `/` is handled by the server component directly
- Any new API endpoints for the listing page (the server component reads the DB directly)
- Changes to `src/types/index.ts` — the `Job` interface already exists correctly with `{ id, slug, title, description, questionPack: unknown | null }`
- The `docs/openapi.yaml` file — no new API endpoints are introduced by this feature

---

## User Stories

- As an authenticated user, I want to see all available job positions on the home page so that I can choose which role to interview for.
- As an authenticated user, I want to click "Start Interview" on a job card and be taken directly to the interview room for that role.
- As an unauthenticated visitor, I want to be redirected to `/login` when I visit `/` so that I know I need to sign in first.
- As an authenticated user, I want to see each job's title and description on its card so that I understand the role before starting an interview.
- As an authenticated user on a mobile device, I want the job listing to be readable and usable on a small screen.
- As an authenticated user, I want to see my email in the header and be able to log out from the home page so that I can manage my session.
- As a developer, I want to run `npx prisma db seed` and have at least 12 jobs upserted into the database so that the app is ready to use immediately.

---

## Functional Requirements

### Static Job Definitions (`src/lib/jobs.ts`)

1. `src/lib/jobs.ts` currently exports `JOBS` typed as `readonly Job[]` (where `Job` is imported from `@/types`) with 3 entries. This file is extended — NOT rewritten — to add the following 9 new job entries. The existing 3 entries (Software Engineer, Product Manager, Data Analyst) are preserved unchanged. The final `JOBS` array must have at least 12 entries total.

2. All 9 of the following new entries must be added to `JOBS` (exact slugs as listed):

   | Slug | Title |
   |------|-------|
   | `frontend-engineer` | Frontend Engineer |
   | `backend-engineer` | Backend Engineer |
   | `devops-engineer` | DevOps Engineer |
   | `data-engineer` | Data Engineer |
   | `ml-engineer` | ML Engineer |
   | `qa-engineer` | QA Engineer |
   | `product-manager-technical` | Product Manager – Technical |
   | `site-reliability-engineer` | Site Reliability Engineer |
   | `security-engineer` | Security Engineer |

   All 9 entries are required. Together with the 3 existing entries, the final `JOBS` array has 12 entries.

3. Each new `JOBS` entry must conform to the existing `Job` interface: `{ id: string, slug: string, title: string, description: string, questionPack: unknown | null }`. Specifically:
   - `id`: a unique, hardcoded, non-empty string that does not collide with any other entry's `id`. Following the existing convention, use a cuid-format string (e.g., `"clbfe0004000000000000000004"` for frontend-engineer).
   - `slug`: the kebab-case value from the table above.
   - `title`: the display title from the table above.
   - `description`: 2–3 sentences describing the role and what the AI interview will test. Must be a non-empty string.
   - `questionPack`: `null` (consistent with all existing entries).

4. All slugs in the final `JOBS` array (existing + new) must remain unique.

5. The existing tests in `src/__tests__/jobs.test.ts` must continue to pass after the extension. Those tests assert:
   - `JOBS.length >= 3` (satisfied by ≥10 entries)
   - Every entry has a non-empty `id` string
   - Every entry has a non-empty `slug` string
   - Every entry has a non-empty `title` string
   - Every entry has a non-empty `description` string
   - All `id` values are unique
   - All `slug` values are unique
   - `questionPack === null` for every entry

### Seed Script (`prisma/seed.ts`)

6. `prisma/seed.ts` imports `JOBS` from `../src/lib/jobs` (the extended constant) and the Prisma client singleton from `../src/lib/prisma`. For each job in `JOBS`, it executes:
   ```typescript
   prisma.job.upsert({
     where: { slug: job.slug },
     update: { title: job.title, description: job.description },
     create: { slug: job.slug, title: job.title, description: job.description },
   })
   ```
   The upsert key is `slug` (not `id`). The `create` block does NOT include the static `id` from the `JOBS` array — the database generates its own cuid as the primary key via `@default(cuid())`. The upserts run sequentially in a `for...of` loop (not `Promise.all`) to avoid connection pool exhaustion. After all upserts complete, the script calls `prisma.$disconnect()` in a `finally` block.

7. `package.json` gains a top-level `"prisma"` key:
   ```json
   "prisma": {
     "seed": "npx tsx prisma/seed.ts"
   }
   ```
   `tsx` is added to `devDependencies` (latest stable version at time of implementation). The seed is invoked via `npx prisma db seed`.

8. Running the seed script twice on the same database must not create duplicate rows. The `slug` field has a `@unique` constraint in the Prisma schema, and `upsert` is keyed on `slug`.

### Home Page (`src/app/page.tsx`)

9. `src/app/page.tsx` is an `async` React Server Component. It does not contain `'use client'` at the top. It does not use the Pages Router (`getServerSideProps`, `getStaticProps`).

10. **Authentication guard**: The page reads the `auth_token` cookie using `cookies()` imported from `next/headers`. It passes the cookie value to `verifyToken` imported from `@/lib/auth`. If the cookie is absent, or if `verifyToken` returns `null`, the page calls `redirect('/login')` imported from `next/navigation`. The returned `JwtPayload` (containing `payload.email`) is stored for rendering the header. The page proceeds to fetch jobs only after a valid token is confirmed.

11. **Database query**: The page calls `prisma.job.findMany({ orderBy: { createdAt: 'asc' } })`. This executes on the server during rendering. No client-side data fetch is performed for the job listing.

12. **Page layout structure**: The rendered HTML consists of:
    - A root `<div>` with a full-min-height flex column layout (e.g., `min-h-screen flex flex-col bg-zinc-50`)
    - A `<header>` element containing:
      - Left: the text "AI Interviewer" styled as bold/prominent branding
      - Right: the authenticated user's email in a `<span>` and a `<LogoutButton />` component
    - A `<main>` element with `flex-1` growth, containing an `<h1>` "Available Positions" and below it either the job card grid, empty-state message, or error message

13. **Job card grid**: When jobs are returned, they are displayed in a CSS grid using Tailwind classes `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`. Each job in the array renders one card (see requirement 14).

14. **Each job card**: A single card renders using `<Card>` from `src/components/ui/Card`. Inside the card (top to bottom):
    - An `<h2>` element containing the job title, styled with `font-semibold text-lg text-zinc-900`
    - A `<p>` element containing the job description, styled with `text-sm text-zinc-600 mt-2 line-clamp-3`
    - A `<Button href={"/interview/" + job.id} variant="primary" className="mt-4 w-full">Start Interview</Button>` using the extended `Button` component

15. **Empty state**: If `prisma.job.findMany()` returns an empty array, the `<main>` area renders the following instead of the grid:
    ```
    <p className="text-zinc-500 text-center py-12">No positions available at this time.</p>
    ```

16. **Database error state**: The `prisma.job.findMany()` call is wrapped in a `try/catch`. If it throws, the page renders the following instead of the grid:
    ```
    <p className="text-zinc-500 text-center py-12">
      Unable to load positions. Please try again later.{' '}
      <a href="/" className="underline text-zinc-700">Refresh</a>
    </p>
    ```
    The error is also logged server-side via `console.error`.

### Button Component Extension (`src/components/ui/Button.tsx`)

17. `ButtonProps` gains an optional `href?: string` field. When `href` is provided:
    - The component imports `Link` from `next/link`
    - The component renders `<Link href={href} className={computedClasses}>{children}</Link>` where `computedClasses` is the same string produced by the existing `base + variants[variant] + className` logic (without `disabledClasses`, since links cannot be disabled)
    - The `type`, `disabled`, `loading`, and `onClick` props are present in the TypeScript signature but have no effect when `href` is provided — no disabled attribute, no spinner, no onClick handler is attached to the `<Link>`
    - `variant` and `className` behave identically to the standard button rendering

18. When `href` is absent, the component behaves exactly as it does today — no behavior change, no regression to any existing usage or test.

### Logout Button Component (`src/components/LogoutButton.tsx`)

19. `src/components/LogoutButton.tsx` is a `'use client'` component. It accepts no props. It uses `useState` for a boolean `loading` flag and `useRouter` from `next/navigation`. It renders:
    ```tsx
    <Button variant="secondary" loading={loading} disabled={loading} onClick={handleLogout}>
      Log out
    </Button>
    ```
    `handleLogout` is an async function that:
    1. Sets `loading = true`
    2. Calls `fetch('/api/auth/logout', { method: 'POST' })`
    3. On completion (success or network error), calls `router.push('/login')`
    4. If `fetch` rejects (network error), logs the error to `console.error` and still navigates to `/login`

---

## Non-Functional Requirements

- **Performance**: `prisma.job.findMany()` must complete in under 500 ms under normal load. The page produces no client-side data waterfalls.
- **Security**: The `auth_token` cookie is verified using the shared `verifyToken` from `@/lib/auth`. No user secrets or JWT payloads are embedded in rendered HTML (only `payload.email` is displayed, which the user already knows).
- **Browser support**: The home page uses no browser-specific APIs (no SpeechRecognition, no Web Speech API). It must render correctly in Chrome, Firefox, Safari, and Edge.
- **Accessibility**:
  - Heading hierarchy: one `<h1>` for "Available Positions"; each job title uses `<h2>`.
  - "Start Interview" renders as an `<a>` element (via Next.js `<Link>`), which is semantically correct for navigation.
  - The "Log out" button has clear visible label text.
  - Color contrast follows WCAG AA minimums for all text/background pairs.
- **Responsive design**: Grid adapts from 1 column (mobile) → 2 columns (sm, 640 px+) → 3 columns (lg, 1024 px+). On mobile, the header collapses gracefully (email truncated with `truncate` if needed).
- **Type safety**: No `any` types. All component props are fully typed. `JOBS` remains typed as `readonly Job[]`.
- **Test regression**: `npm test` must pass in full after all file changes are applied, including `src/__tests__/jobs.test.ts` and `src/__tests__/Button.test.tsx`.

---

## Data Model Changes

No new Prisma models or migrations are required. The `Job` model already exists in `prisma/schema.prisma` with all necessary fields and correct snake_case DB column names:

```
model Job {
  id           String    @id @default(cuid())
  slug         String    @unique
  title        String
  description  String
  questionPack Json?     @map("question_pack")
  sessions     Session[]
  createdAt    DateTime  @default(now()) @map("created_at")

  @@map("jobs")
}
```

---

## API Contracts

No new API endpoints are introduced by this feature. The home page reads the database directly as a React Server Component. The logout flow uses the existing `POST /api/auth/logout` endpoint (already implemented in the auth feature).

---

## UI Behaviour

### `/` — Home Page (Job Listing)

**What the user sees:**
- A full-page layout with a `<header>` at the top containing:
  - Left: "AI Interviewer" branding
  - Right: the authenticated user's email in a `<span>` and a "Log out" button (secondary variant)
- Below the header, a `<main>` area with:
  - `<h1>Available Positions</h1>`
  - A responsive grid of job cards below the heading (or empty/error state)
- Each job card contains: job title (`<h2>`), job description (`<p>` with `line-clamp-3`), and a "Start Interview" primary link-button

**What the user can do:**
- Click "Start Interview" on any card → navigates to `/interview/[job.id]` (the DB cuid, obtained from `prisma.job.findMany()`)
- Click "Log out" → calls logout API, then redirects to `/login`

**States:**

| State | Trigger | Rendered output |
|-------|---------|-----------------|
| Unauthenticated | Cookie absent or invalid | Server-side `redirect('/login')` — nothing rendered |
| Authenticated — jobs exist | Normal path after seed | Header + grid of job cards |
| Authenticated — no jobs | DB empty (seed not run) | Header + "No positions available at this time." |
| Authenticated — DB error | `prisma.job.findMany()` throws | Header + error message + Refresh link |
| Logout in flight | User clicked "Log out" | "Log out" button shows spinner, is disabled |

---

## Edge Cases & Error Handling

1. **Unauthenticated visit**: Server Component calls `redirect('/login')` before any DB query. The redirect is immediate with no HTML content rendered.

2. **Expired or tampered cookie**: `verifyToken` returns `null`. The page redirects to `/login`. The middleware at `src/middleware.ts` does not protect `/`, making this in-component check mandatory.

3. **Seed not run (empty DB)**: `prisma.job.findMany()` returns `[]`. The empty-state message is rendered. The page does not crash.

4. **DB connection failure**: The `try/catch` around `prisma.job.findMany()` catches and logs the error server-side, then renders the error-state message with a Refresh link.

5. **`Button` with `href` and also `disabled`**: When `href` is provided, `disabled` has no effect — the rendered `<Link>` is not disabled. Callers must not rely on `disabled` for link-buttons. This is documented in the Open Decisions.

6. **Very long description**: The `line-clamp-3` Tailwind class truncates descriptions that exceed 3 lines, maintaining uniform card height.

7. **Logout network error**: Logged to `console.error`. The component still navigates to `/login`. If the cookie was not cleared by the server, the user will be redirected back to `/login` again when they try to access `/` (since the cookie check happens again on the next request and if the JWT has expired, they'd be redirected).

8. **`href` on existing Button usages**: No existing call site in the codebase passes `href` to `Button`. The TypeScript addition is purely additive and all existing tests continue to pass.

9. **Static `id` in JOBS vs. DB-generated id**: The `id` field in each `JOBS` entry is a static string used only by `src/__tests__/jobs.test.ts` to verify uniqueness. The seed script creates DB rows with `prisma.job.create` which generates real cuids via `@default(cuid())`. The home page uses DB-generated cuids (from `prisma.job.findMany()`) in the "Start Interview" URL — not the static `JOBS` ids.

---

## Acceptance Criteria

- [ ] Visiting `/` without a valid `auth_token` cookie redirects to `/login`.
- [ ] Visiting `/` with an expired `auth_token` cookie redirects to `/login`.
- [ ] A logged-in user visiting `/` sees the job listing page with an `<h1>Available Positions</h1>` heading.
- [ ] After running `npx prisma db seed`, the database contains at least 12 job rows.
- [ ] Running `npx prisma db seed` a second time does not create duplicate job rows.
- [ ] All 12 job cards are displayed after the seed has been run and the user is authenticated.
- [ ] Each job card shows: the job title in an `<h2>`, the description in a `<p>`, and a "Start Interview" primary button-link.
- [ ] Clicking "Start Interview" navigates to `/interview/[job.id]` using the DB-generated cuid (not the static id from `JOBS`).
- [ ] The job grid renders 1 column on viewports narrower than 640 px.
- [ ] The job grid renders 2 columns on viewports 640 px–1023 px.
- [ ] The job grid renders 3 columns on viewports 1024 px and wider.
- [ ] The page header displays the authenticated user's email.
- [ ] Clicking "Log out" sends `POST /api/auth/logout` and redirects to `/login`.
- [ ] While the logout request is in flight, the "Log out" button is disabled and shows a loading spinner.
- [ ] If no jobs exist in the DB, the message "No positions available at this time." is displayed.
- [ ] If `prisma.job.findMany()` throws, a user-friendly error message is displayed and the error is logged server-side.
- [ ] `src/lib/jobs.ts` exports a `JOBS` constant with at least 12 entries typed as `readonly Job[]`.
- [ ] Every entry in `JOBS` has a non-empty unique `id`, non-empty unique `slug`, non-empty `title`, non-empty `description`, and `questionPack === null`.
- [ ] The 9 required slugs (`frontend-engineer`, `backend-engineer`, `devops-engineer`, `data-engineer`, `ml-engineer`, `qa-engineer`, `product-manager-technical`, `site-reliability-engineer`, `security-engineer`) are all present in `JOBS`.
- [ ] `prisma/seed.ts` reads from `src/lib/jobs` and upserts via Prisma using `slug` as the unique key.
- [ ] `package.json` includes a top-level `"prisma": { "seed": "npx tsx prisma/seed.ts" }` key.
- [ ] `tsx` is listed in `devDependencies` in `package.json`.
- [ ] The `Button` component accepts an optional `href` prop and renders a Next.js `<Link>` with button styling when `href` is provided.
- [ ] The existing `Button` behavior (without `href`) is unchanged — all assertions in `src/__tests__/Button.test.tsx` pass.
- [ ] All assertions in `src/__tests__/jobs.test.ts` pass after `src/lib/jobs.ts` is extended.
- [ ] `npm test` passes in full after all changes are applied.
- [ ] `src/app/page.tsx` has no `'use client'` directive.
- [ ] No inline button or input styles are defined in `src/app/page.tsx` — all styling uses primitives from `src/components/ui/`.
- [ ] Heading elements use correct semantic levels: `<h1>` for "Available Positions", `<h2>` for each job title.
- [ ] `src/components/LogoutButton.tsx` exists as a `'use client'` component.
- [ ] No new entries are added to `docs/openapi.yaml` (no new API endpoints introduced).

---

## Open Decisions

1. **Auth check in Server Component vs. middleware**: The existing `src/middleware.ts` only matches `/interview/:path*` and `/results/:path*`. Adding `/` to the matcher would require exclusion rules for `/login`, `/signup`, `/forgot-password`, `/reset-password`, and all `/api/*` routes to avoid redirect loops. Instead, the home page server component performs its own auth check using `cookies()` and `verifyToken`. This is idiomatic for Next.js App Router and avoids middleware complexity. The middleware is not modified by this feature.

2. **Including a header with logout button**: The feature request specifies the job listing page content but does not explicitly mention a page header or logout button. However, having no way to log out from the only authenticated page is a significant UX gap. A minimal header with the user's email and a logout button is included. This is consistent with the auth spec, which implemented the logout endpoint for this purpose.

3. **`LogoutButton` as a separate component**: Because the home page is a React Server Component (no `'use client'`), but logout requires `useRouter` and `useState` (client hooks), the logout button is extracted into `src/components/LogoutButton.tsx` as a `'use client'` component. This avoids making the entire page a client component and follows Next.js best practices for mixed RSC/client trees.

4. **`src/lib/jobs.ts` extended, not rewritten**: The file already exists and is used by `src/__tests__/jobs.test.ts`. The `Job` type (from `@/types`) includes `id` and `questionPack` fields that the tests verify. New entries maintain the same shape. The `src/types/index.ts` file is not modified — the `Job` interface already correctly represents the data.

5. **Seed uses `slug` as the upsert key, not `id`**: The static `id` values in `JOBS` entries exist to satisfy the `Job` TypeScript interface (which requires `id`). At the DB level, rows are keyed by `slug` in the seed. This means the DB primary key is a DB-generated cuid, not the static `id` in `JOBS`. The home page always reads from the DB and uses the DB-generated id in URLs — there is no reliance on the static JOBS ids for navigation.

6. **`Button` extended with `href` rather than a new primitive**: A new `LinkButton` or `NavButton` primitive would duplicate the Button's styling logic. Extending `Button` with an optional `href` prop keeps the interface simple and avoids primitive proliferation. The extension is purely additive — no existing call site is affected. When `href` is present, `disabled` and `loading` have no effect; callers must not rely on those props for link-style buttons.

7. **Job card order**: Jobs are fetched with `orderBy: { createdAt: 'asc' }`. Since the seed runs entries in array order sequentially, card display order follows the `JOBS` array order.

8. **`tsx` for seed execution**: `tsx` is the standard modern approach for running TypeScript scripts in Node.js without a compilation step. It is compatible with ESM and CJS modules and works with the project's existing TypeScript configuration. Adding it to `devDependencies` ensures reproducible installs.

9. **No new types in `src/types/index.ts`**: The `Job` interface already exists in `src/types/index.ts` with fields `{ id, slug, title, description, questionPack: unknown | null }` and is already imported by `src/lib/jobs.ts`. The home page component can use `Job` from `@/types` or the Prisma model type for page-level rendering — the DB fields used on the page (`id`, `title`, `description`) are a subset of either type. No additional type declarations are needed for this feature.
