# Implementation Plan: Job Listing

## Overview
Build the authenticated home page (`/`) that displays a responsive grid of 12 job cards fetched from the database, using a server-side auth guard. The work covers extending static job definitions, updating the seed script, adding `href` support to the Button primitive, creating a client-side LogoutButton component, and replacing the boilerplate `src/app/page.tsx` with the real job listing page.

## Prerequisites
- PostgreSQL database must be reachable via `DATABASE_URL`.
- `JWT_SECRET` must be set (at least 32 characters) in `.env` for `verifyToken` to work.
- After T1 is merged, run `npx prisma db seed` to populate the database with 12 jobs before manual browser testing of T4.
- No new Prisma migrations are required. The `Job` model already has all necessary columns and correct `@map` / `@@map` snake_case annotations.

## Task Graph

| Task | Wave | Type | Description | Depends on |
|------|------|------|-------------|------------|
| T1   | 1    | backend  | Extend `src/lib/jobs.ts` with 9 new entries; update `prisma/seed.ts` to slug-based upserts; update `package.json` seed config | — |
| T2   | 1    | frontend | Add optional `href` prop to `src/components/ui/Button.tsx` | — |
| T3   | 1    | frontend | Create `src/components/LogoutButton.tsx` client component | — |
| T4   | 2    | frontend | Implement `src/app/page.tsx` as an authenticated async Server Component | T2, T3 |

Wave 1 tasks are fully independent and can run in parallel. Wave 2 starts only when T2 and T3 are both complete.

## Task Details

### T1: Extend jobs, fix seed script, update package.json

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/lib/jobs.ts` — append 9 new `Job` entries to the existing `JOBS` array
  - `prisma/seed.ts` — rewrite to use slug-based `upsert` (not id-based), wrapped in a `try/finally` with `prisma.$disconnect()`
  - `package.json` — update the existing `prisma.seed` value and add `tsx` to `devDependencies`

- **Implementation notes**:

  **`src/lib/jobs.ts`**

  The file already exports `JOBS: readonly Job[]` with 3 entries. Do NOT rewrite it — append the following 9 entries inside the same array literal. Every new entry must satisfy the full `Job` interface from `@/types`, which requires `seniority: Seniority`. Use `'MID'` for all new entries, consistent with the existing three. The static `id` values exist only to satisfy the TypeScript type and are NOT written to the database by the updated seed.

  Required entries (append in this order):

  | id (static, unique) | slug | title |
  |---|---|---|
  | `'clbfe0004000000000000000004'` | `'frontend-engineer'` | `'Frontend Engineer'` |
  | `'clbbe0005000000000000000005'` | `'backend-engineer'` | `'Backend Engineer'` |
  | `'cldvo0006000000000000000006'` | `'devops-engineer'` | `'DevOps Engineer'` |
  | `'cldate0007000000000000000007'` | `'data-engineer'` | `'Data Engineer'` |
  | `'clmle0008000000000000000008'` | `'ml-engineer'` | `'ML Engineer'` |
  | `'clqae0009000000000000000009'` | `'qa-engineer'` | `'QA Engineer'` |
  | `'clpmt0010000000000000000010'` | `'product-manager-technical'` | `'Product Manager – Technical'` |
  | `'clsre0011000000000000000011'` | `'site-reliability-engineer'` | `'Site Reliability Engineer'` |
  | `'clsec0012000000000000000012'` | `'security-engineer'` | `'Security Engineer'` |

  Each `description` must be 2–3 sentences describing the role and what the AI interview will probe. Write unique, non-empty descriptions. Set `questionPack: null` for all new entries.

  **`prisma/seed.ts`**

  The existing seed upserts by `id` (static) and includes the static id in the `create` block. This must be replaced. The new implementation:
  - Imports `prisma` from `'../src/lib/prisma'` and `JOBS` from `'../src/lib/jobs'` (unchanged import paths).
  - Uses a `for...of` loop (not `Promise.all`) over `JOBS`.
  - Each iteration calls `prisma.job.upsert({ where: { slug: job.slug }, update: { title: job.title, description: job.description }, create: { slug: job.slug, title: job.title, description: job.description } })`.
  - The `create` block does NOT include `id` — the database generates its own cuid via `@default(cuid())`.
  - The `create` block does NOT include `questionPack` or `seniority` — they use DB-level defaults (`null` and `MID` respectively).
  - Wraps the `main()` call with `.catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect())`.
  - Logs `Seeded ${JOBS.length} jobs.` after the loop completes.

  **`package.json`**

  The existing `"prisma"` top-level key must be updated:
  ```json
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
  ```
  Add `"tsx"` to `devDependencies` at its latest stable version (check npmjs.com or use `npm show tsx version` to get current stable). Do NOT remove `ts-node` or `tsconfig-paths` — they are used by other scripts.

- **Testing**:
  - Unit: Run `npm test -- --testPathPattern=jobs.test.ts` and confirm all 8 assertions pass (length ≥ 3, non-empty ids/slugs/titles/descriptions, unique ids, unique slugs, `questionPack === null`).
  - Integration: Run `npx prisma db seed` once — confirm "Seeded 12 jobs." is logged. Run it a second time — confirm no error and no duplicate rows (query `SELECT COUNT(*) FROM jobs` in psql or Prisma Studio; must remain 12).
  - Manual: Open Prisma Studio (`npx prisma studio`) and verify the `jobs` table has exactly 12 rows, each with the correct `slug`, `title`, and `description`. Verify `seniority` is `MID` and `question_pack` is `null` for all rows.

---

### T2: Extend Button with optional `href` prop

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/Button.tsx` — add `href?: string` to `ButtonProps`; conditionally render `<Link>` vs `<button>`

- **Implementation notes**:

  The file is already a `'use client'` component. Import `Link` from `'next/link'` at the top (alongside the existing `React` import).

  Add `href?: string` to `ButtonProps` (after `'aria-label'?`). When `href` is provided, the component renders:
  ```tsx
  <Link href={href} className={[base, variants[variant], className].filter(Boolean).join(' ')}>
    {children}
  </Link>
  ```
  The computed class string omits `disabledClasses` entirely (links cannot carry `disabled` semantics). The `type`, `disabled`, `loading`, `onClick`, and `'aria-label'` props are accepted in the TypeScript signature but have NO effect when `href` is present — do not spread them onto `<Link>`.

  When `href` is absent (the default), the component renders exactly as it does today — no behavior change. The conditional must be a simple `if (href) { return <Link ...> }` guard before the existing `return <button ...>`.

  Do NOT make `Button` async. Do NOT remove `'use client'`. Do NOT break the existing `ButtonProps` shape in any way that would affect existing call sites.

- **Testing**:
  - Unit: Run `npm test -- --testPathPattern=Button.test.tsx` and confirm all 8 existing assertions still pass (no regression). Then add — or verify a reviewer adds — the following new assertions in the same file:
    - `render(<Button href="/foo">Go</Button>)` renders an `<a>` element (not a `<button>`).
    - The rendered `<a>` has `href="/foo"`.
    - The rendered `<a>` has the primary variant classes (`bg-zinc-900`, `text-white`).
    - When `href` is provided with `variant="secondary"`, the `<a>` has secondary variant classes.
    - When `href` is provided with a `className` prop, the custom class is present on the `<a>`.
  - Manual: Render `<Button href="/login">Go to login</Button>` in any page; confirm the element is an anchor tag navigating to `/login`.

---

### T3: Create LogoutButton client component

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/LogoutButton.tsx` — new `'use client'` component

- **Implementation notes**:

  The file does not exist. Create it with the following structure:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { Button } from '@/components/ui/Button';

  export function LogoutButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleLogout() {
      setLoading(true);
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('[LogoutButton] logout request failed:', err);
      }
      router.push('/login');
    }

    return (
      <Button variant="secondary" loading={loading} disabled={loading} onClick={handleLogout}>
        Log out
      </Button>
    );
  }
  ```

  The component accepts no props. It always navigates to `/login` on completion — even if `fetch` throws (network error). The `loading` flag stays `true` during navigation (no `setLoading(false)` after success — the component will unmount).

  Export as a named export (`export function LogoutButton`), not a default export, to align with the existing component convention in `src/components/ui/`.

- **Testing**:
  - Unit: Create `src/__tests__/LogoutButton.test.tsx` with `@jest-environment jsdom`. Mock `next/navigation`'s `useRouter` and `global.fetch`. Assert:
    - The button renders with text "Log out".
    - Clicking the button calls `fetch('/api/auth/logout', { method: 'POST' })`.
    - After `fetch` resolves, `router.push('/login')` is called.
    - While the fetch is in flight, the button is disabled.
    - If `fetch` rejects, `console.error` is called and `router.push('/login')` is still called.
  - Manual: On the job listing page, click "Log out". Verify the button becomes disabled/shows spinner, then the page redirects to `/login`. Confirm the `auth_token` cookie is cleared (check DevTools > Application > Cookies).

---

### T4: Implement authenticated job listing page

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/page.tsx` — full replacement of the boilerplate default page

- **Implementation notes**:

  This is an `async` React Server Component. Do NOT add `'use client'` at the top. Do NOT use `getServerSideProps` or `getStaticProps`.

  Imports needed:
  ```ts
  import { cookies } from 'next/headers';
  import { redirect } from 'next/navigation';
  import { verifyToken } from '@/lib/auth';
  import { prisma } from '@/lib/prisma';
  import { Card } from '@/components/ui/Card';
  import { Button } from '@/components/ui/Button';
  import { LogoutButton } from '@/components/LogoutButton';
  ```

  **Auth guard** (must execute before any DB call):
  ```ts
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/login');
  const payload = await verifyToken(token);
  if (!payload) redirect('/login');
  ```
  `payload.email` is used in the header. Do not embed any other JWT field in rendered HTML.

  **Database query** — wrapped in try/catch:
  ```ts
  let jobs: { id: string; title: string; description: string }[] = [];
  let dbError = false;
  try {
    jobs = await prisma.job.findMany({ orderBy: { createdAt: 'asc' } });
  } catch (err) {
    console.error('[page] Failed to load jobs:', err);
    dbError = true;
  }
  ```

  **Page layout** (exact Tailwind class requirements from spec):
  ```tsx
  <div className="min-h-screen flex flex-col bg-zinc-50">
    <header className="...">
      <span className="font-bold text-lg">AI Interviewer</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-600 truncate">{payload.email}</span>
        <LogoutButton />
      </div>
    </header>
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Available Positions</h1>
      {dbError ? (
        <p className="text-zinc-500 text-center py-12">
          Unable to load positions. Please try again later.{' '}
          <a href="/" className="underline text-zinc-700">Refresh</a>
        </p>
      ) : jobs.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">No positions available at this time.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <Card key={job.id}>
              <h2 className="font-semibold text-lg text-zinc-900">{job.title}</h2>
              <p className="text-sm text-zinc-600 mt-2 line-clamp-3">{job.description}</p>
              <Button href={`/interview/${job.id}`} variant="primary" className="mt-4 w-full">
                Start Interview
              </Button>
            </Card>
          ))}
        </div>
      )}
    </main>
  </div>
  ```

  The "Start Interview" `href` uses `job.id` from `prisma.job.findMany()` — the DB-generated cuid — not the static id from `JOBS`.

  Do not define any inline button or input styles. All reusable elements come from `src/components/ui/`.

- **Testing**:
  - Unit: Create `src/__tests__/HomePage.test.tsx` with mocks for `next/headers` (`cookies`), `next/navigation` (`redirect`), `@/lib/auth` (`verifyToken`), and `@/lib/prisma` (`prisma.job.findMany`). Assert:
    - When cookie is absent, `redirect('/login')` is called.
    - When `verifyToken` returns `null`, `redirect('/login')` is called.
    - When authenticated and `findMany` returns jobs, the page renders an `<h1>` with "Available Positions" and a job title in an `<h2>`.
    - When authenticated and `findMany` returns `[]`, the "No positions available at this time." message is rendered.
    - When `findMany` throws, the error-state message is rendered and `console.error` is called.
    - The user's email is rendered in the header.
  - Manual: Visit `/` without being logged in — confirm redirect to `/login`. Log in, visit `/` — confirm 12 job cards appear after seeding. Click "Start Interview" on any card — confirm navigation to `/interview/<cuid>` where the cuid matches the database record. Test on mobile viewport (375 px) — confirm 1-column grid. Test on tablet (768 px) — confirm 2-column grid. Test on desktop (1280 px) — confirm 3-column grid. Click "Log out" — confirm redirect to `/login` and session cleared.

## Data migrations
No schema changes are required. The `Job` model in `prisma/schema.prisma` already defines all necessary columns:
- `id String @id @default(cuid())`
- `slug String @unique`
- `title String`
- `description String`
- `question_pack` via `@map("question_pack")`
- `created_at` via `@map("created_at")`
- `@@map("jobs")`

Do not run `prisma migrate dev` for this feature.

## API documentation updates
No new API endpoints are introduced. The home page reads the database directly as a Server Component. The logout flow uses the existing `POST /api/auth/logout` endpoint already documented in `docs/openapi.yaml`. No changes to `docs/openapi.yaml` are needed.

## Cross-cutting concerns
- **`Job` interface** (`src/types/index.ts`): Already includes `seniority: Seniority`. All new job entries in `src/lib/jobs.ts` must set `seniority: 'MID'`. Do not modify `src/types/index.ts`.
- **Prisma client singleton**: Always import from `@/lib/prisma` — never instantiate `PrismaClient` directly.
- **`verifyToken`**: Already returns `JwtPayload | null` asynchronously. The page awaits it. The `JwtPayload` type exposes `email` which is the only field rendered in the UI.
- **`cookies()` from `next/headers`**: In Next.js 14+, `cookies()` must be `await`-ed when called inside an async Server Component. Use `const cookieStore = await cookies();` then `cookieStore.get('auth_token')`.
- **`Button` as link vs. button**: When `href` is provided, `Button` renders a Next.js `<Link>` (an `<a>` tag). Existing call sites that omit `href` are unaffected. The `Card` component from `src/components/ui/Card.tsx` is already available and requires no modification.
