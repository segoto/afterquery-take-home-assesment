# Implementation Plan: Auth

## Overview

Email-and-password authentication is added to the AI Interviewer Platform using custom JWT-based sessions stored in HttpOnly cookies. The implementation introduces a `User` Prisma model, a `PasswordResetToken` model, a nullable `userId` FK on `Session`, six API route handlers under `/api/auth/`, Next.js Edge middleware for route protection, and four auth pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`).

## Prerequisites

1. Install new npm packages before any code task begins:
   ```bash
   npm install jose bcryptjs
   npm install -D @types/bcryptjs
   ```
2. Add `JWT_SECRET` to `.env.example` (a 32+ character random string placeholder with a comment) and to the local `.env` file before running the migration or starting the dev server.
3. A running PostgreSQL instance accessible via `DATABASE_URL` (already required by the project).

## Task Graph

| Task | Wave | Type     | Description                                              | Depends on    |
|------|------|----------|----------------------------------------------------------|---------------|
| T1   | 1    | backend  | Prisma schema changes + migration + client regeneration  | —             |
| T2   | 1    | backend  | `src/lib/auth.ts` — Edge-safe JWT + cookie utilities    | —             |
| T3   | 1    | frontend | `src/components/ui/` — Button, Input, Card primitives    | —             |
| T4   | 1    | backend  | `src/types/index.ts` — shared auth TypeScript types      | —             |
| T5   | 2    | backend  | `POST /api/auth/signup` route handler                    | T1, T2, T4   |
| T6   | 2    | backend  | `POST /api/auth/login` route handler                     | T1, T2, T4   |
| T7   | 2    | backend  | `POST /api/auth/logout` + `GET /api/auth/me` handlers    | T1, T2, T4   |
| T8   | 2    | backend  | `POST /api/auth/forgot-password` route handler           | T1, T2, T4   |
| T9   | 2    | backend  | `POST /api/auth/reset-password` route handler            | T1, T2, T4   |
| T10  | 2    | backend  | `src/middleware.ts` — JWT-based route protection         | T2, T4        |
| T11  | 3    | frontend | `/login` page                                            | T3, T5, T6   |
| T12  | 3    | frontend | `/signup` page                                           | T3, T5        |
| T13  | 3    | frontend | `/forgot-password` page                                  | T3, T8        |
| T14  | 3    | frontend | `/reset-password` page                                   | T3, T9        |
| T15  | 3    | backend  | `docs/openapi.yaml` — document all six auth endpoints    | T5–T9, T7    |

Wave 1 tasks are fully parallel. Wave 2 tasks start only when all Wave 1 tasks are complete. Wave 3 tasks start only when all Wave 2 tasks are complete.

## Task Details

### T1: Prisma schema changes + migration

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `prisma/schema.prisma` — add `User` model, `PasswordResetToken` model, and `userId` nullable FK on `Session`
  - `.env.example` — add `JWT_SECRET` line with placeholder and comment
- **Implementation notes**:
  Add the following models verbatim (they match the spec exactly and comply with `@map`/`@@map` rules):

  ```prisma
  model User {
    id           String    @id @default(cuid())
    email        String    @unique
    passwordHash String    @map("password_hash")
    createdAt    DateTime  @default(now()) @map("created_at")
    updatedAt    DateTime  @updatedAt @map("updated_at")
    sessions     Session[]

    @@map("users")
  }

  model PasswordResetToken {
    id        String   @id @default(cuid())
    token     String   @unique
    email     String
    expiresAt DateTime @map("expires_at")
    createdAt DateTime @default(now()) @map("created_at")

    @@map("password_reset_tokens")
  }
  ```

  Modify the existing `Session` model to add the nullable `userId` field and `user` relation between `jobId` and `startedAt`:

  ```prisma
  userId     String?       @map("user_id")
  user       User?         @relation(fields: [userId], references: [id])
  ```

  After editing the schema, run:
  ```bash
  npx prisma migrate dev --name add-auth-models
  npx prisma generate
  ```

  Add to `.env.example`:
  ```
  # JWT secret — must be at least 32 characters in production
  JWT_SECRET="change-me-to-a-32-char-random-string"
  ```

- **Testing**:
  - Unit: none required for a schema migration.
  - Integration: After running the migration, open Prisma Studio (`npx prisma studio`) and confirm `users` and `password_reset_tokens` tables exist, and that `sessions` has a nullable `user_id` column.
  - Manual: Run `npx prisma migrate status` and confirm no pending migrations remain.

---

### T2: `src/lib/auth.ts` — Edge-safe JWT + cookie utilities

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/lib/auth.ts` — create this file
- **Implementation notes**:
  This module must be importable from both Next.js API routes (Node.js runtime) and `src/middleware.ts` (Edge runtime). Therefore it must use only Edge-compatible APIs. Do **not** import `bcryptjs` or Node.js `crypto` here; those belong in the individual route handlers.

  Export the following functions:

  1. `getJwtSecret(): string` — reads `process.env.JWT_SECRET`. In production (`NODE_ENV === "production"`), throws `new Error("JWT_SECRET environment variable is not set")` if the value is falsy or shorter than 32 characters. In development, logs a warning but does not throw. Returns the secret string.

  2. `signToken(payload: { sub: string; email: string }): Promise<string>` — uses `jose`'s `new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret)` where `secret = new TextEncoder().encode(getJwtSecret())`. Returns the signed JWT string.

  3. `verifyToken(token: string): Promise<JwtPayload | null>` — uses `jose`'s `jwtVerify`. Returns the `payload` as `JwtPayload` on success, returns `null` on any error (expired, invalid signature, etc.). Never throws. Import `JWTPayload` from `jose` and intersect with `{ sub: string; email: string }` for the return type — use the `JwtPayload` type defined in `src/types/index.ts`.

  4. `buildAuthCookie(token: string): string` — returns a `Set-Cookie` header value string:
     ```
     auth_token=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800<Secure flag>
     ```
     Append `; Secure` only when `process.env.NODE_ENV === "production"`.

  5. `clearAuthCookie(): string` — returns:
     ```
     auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
     ```

  All functions are exported as named exports. No default export.

- **Testing**:
  - Unit: Create `src/lib/auth.test.ts`. Test `signToken` + `verifyToken` round-trip: sign a payload, verify it, assert the returned payload matches. Test `verifyToken` with a tampered token returns `null`. Test `verifyToken` with an expired token returns `null` (use a short expiry for the test). Test `buildAuthCookie` includes `Secure` only when `NODE_ENV=production`. Test `getJwtSecret` throws in production when the var is missing/short.
  - Integration: none beyond unit tests.
  - Manual: none.

---

### T3: `src/components/ui/` — Button, Input, Card primitives

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/Button.tsx` — create
  - `src/components/ui/Input.tsx` — create
  - `src/components/ui/Card.tsx` — create
  - `src/components/ui/index.ts` — create barrel export
- **Implementation notes**:
  All primitives are Client Components (`'use client'`) only when they need browser event handlers; otherwise Server Components. Since these primitives accept `onChange` and `onClick` props that will be used in client forms, they should all use `'use client'`.

  **Button** props interface:
  ```ts
  interface ButtonProps {
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
  }
  ```
  - `primary` variant: filled background (`bg-zinc-900 text-white hover:bg-zinc-700`)
  - `secondary` variant: outlined (`border border-zinc-300 text-zinc-900 hover:bg-zinc-50`)
  - When `loading=true`, render a small inline spinner (an animated SVG or a CSS border-based spinner) alongside the children and set `disabled` attribute.
  - When `disabled=true` (and not loading), apply `opacity-50 cursor-not-allowed`.
  - Base classes: `inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2`.

  **Input** props interface:
  ```ts
  interface InputProps {
    id: string;
    name: string;
    type?: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    disabled?: boolean;
    autoComplete?: string;
    placeholder?: string;
  }
  ```
  - Render a `<div>` wrapper containing a `<label htmlFor={id}>` and an `<input>`.
  - When `error` is provided, render `<p role="alert" className="mt-1 text-sm text-red-600">{error}</p>` immediately after the input, and add `border-red-500` to the input border.
  - Input base classes: `block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500`.
  - Label classes: `block text-sm font-medium text-zinc-700 mb-1`.

  **Card** props interface:
  ```ts
  interface CardProps {
    children: React.ReactNode;
    className?: string;
  }
  ```
  - A `<div>` with classes: `rounded-lg border border-zinc-200 bg-white p-6 shadow-sm`.

  **Barrel export** (`src/components/ui/index.ts`):
  ```ts
  export { Button } from './Button';
  export { Input } from './Input';
  export { Card } from './Card';
  ```

- **Testing**:
  - Unit: Render each component with `@testing-library/react` (if testing infra exists) or verify visually.
  - Manual: Import each primitive in a temporary test page or the home page and confirm it renders with correct styles and that Button shows the spinner when `loading=true`.

---

### T4: `src/types/index.ts` — shared auth TypeScript types

- **Type**: backend
- **Wave**: 1
- **Files to create or modify**:
  - `src/types/index.ts` — create this file
- **Implementation notes**:
  Define and export the following types. No `any` types are permitted anywhere in this file or in any file that imports from it.

  ```ts
  // The minimal user shape returned to clients
  export interface AuthUser {
    id: string;
    email: string;
  }

  // Shape of the JWT payload (what is signed into the token)
  export interface JwtPayload {
    sub: string;    // user id
    email: string;
    exp?: number;
    iat?: number;
  }

  // Standard success/error API response shapes
  export interface ApiSuccessResponse<T> {
    data: T;
  }

  export interface ApiErrorResponse {
    error: string;
  }

  // Auth-specific response types
  export type SignupResponse = AuthUser;
  export type LoginResponse = AuthUser;
  export type MeResponse = AuthUser;

  export interface LogoutResponse {
    success: true;
  }

  export interface ForgotPasswordResponse {
    token: string | null;
  }

  export interface ResetPasswordResponse {
    success: true;
  }
  ```

- **Testing**:
  - Unit: Run `npx tsc --noEmit` to confirm no type errors after file creation.
  - Manual: none.

---

### T5: `POST /api/auth/signup` route handler

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/auth/signup/route.ts` — create
- **Implementation notes**:
  The handler is a named export `POST`. It runs on the default Node.js runtime (do not add `export const runtime = 'edge'`).

  Logic:
  1. Parse JSON body: `{ email, password, confirmPassword }`. If any field is missing return `400 { error: "Email is required" }` / `400 { error: "Password must be at least 8 characters" }` as appropriate per spec.
  2. Validate `password === confirmPassword`; if not, return `400 { error: "Passwords do not match" }`.
  3. Validate `password.length >= 8`; if not, return `400 { error: "Password must be at least 8 characters" }`.
  4. Import `bcryptjs` and call `bcrypt.hash(password, 12)` to produce `passwordHash`.
  5. Call `prisma.user.create({ data: { email, passwordHash } })`. Catch Prisma error code `P2002` (unique constraint violation) and return `409 { error: "Email already registered" }`.
  6. Call `signToken({ sub: user.id, email: user.email })` from `@/lib/auth`.
  7. Build response: `NextResponse.json({ id: user.id, email: user.email }, { status: 201 })` and set the `Set-Cookie` header using `buildAuthCookie(token)`.
  8. Wrap all in try/catch; on unexpected error return `500 { error: "Internal server error" }`.

  Import `prisma` from `@/lib/prisma`. Import `signToken`, `buildAuthCookie` from `@/lib/auth`. Import types from `@/types`.

- **Testing**:
  - Unit: Mock `prisma.user.create` and `bcryptjs.hash`. Test all validation branches (missing fields, short password, mismatched passwords, P2002 error).
  - Integration: POST to `/api/auth/signup` with valid body; assert `201` status, response body has `id` and `email`, and response headers include `Set-Cookie` with `auth_token`, `HttpOnly`, and `Max-Age=604800`.
  - Manual: Use curl or a browser devtools Network panel to confirm the cookie is set with `HttpOnly` (not readable via `document.cookie`).

---

### T6: `POST /api/auth/login` route handler

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/auth/login/route.ts` — create
- **Implementation notes**:
  Logic:
  1. Parse `{ email, password }`. If either is missing, return `400 { error: "Email and password are required" }`.
  2. Call `prisma.user.findUnique({ where: { email } })`. If `null`, return `401 { error: "Invalid credentials" }` (same message as wrong password — prevents email enumeration).
  3. Call `bcrypt.compare(password, user.passwordHash)`. If `false`, return `401 { error: "Invalid credentials" }`.
  4. Call `signToken({ sub: user.id, email: user.email })`.
  5. Return `200 { id: user.id, email: user.email }` with `Set-Cookie` header.
  6. Wrap in try/catch; return `500` on unexpected error.

  Critical: The `401` response message must be identical for "email not found" and "wrong password" cases. Do not short-circuit before calling `bcrypt.compare` in a way that reveals timing differences — always call `bcrypt.compare` even if the user is not found (compare against a dummy hash) to prevent timing-based email enumeration. Use a constant dummy hash `"$2a$12$dummyhashfortimingprotectionXXXXXXXXXXX"` when the user is not found.

- **Testing**:
  - Unit: Mock `prisma.user.findUnique` and `bcryptjs.compare`. Test unknown email returns `401`, wrong password returns `401`, correct credentials return `200` with cookie.
  - Integration: POST with correct credentials after signup; assert `200` and cookie is set. POST with wrong password; assert `401` with `"Invalid credentials"`.
  - Manual: In browser devtools, log in and confirm `auth_token` is in cookies but not accessible via `document.cookie`.

---

### T7: `POST /api/auth/logout` + `GET /api/auth/me` handlers

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/auth/logout/route.ts` — create
  - `src/app/api/auth/me/route.ts` — create
- **Implementation notes**:
  **Logout** (`POST /api/auth/logout`):
  1. Return `200 { success: true }` with `Set-Cookie: <clearAuthCookie()>` header.
  2. No DB query needed.
  3. Wrap in try/catch; return `500` on unexpected error.

  **Me** (`GET /api/auth/me`):
  1. Read the `auth_token` cookie from the request: `request.cookies.get('auth_token')?.value`.
  2. If absent, return `401 { error: "Unauthenticated" }`.
  3. Call `verifyToken(token)` from `@/lib/auth`. If it returns `null`, return `401 { error: "Unauthenticated" }`.
  4. Query `prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true } })`.
  5. If `null` (valid JWT but deleted user), return `401 { error: "Unauthenticated" }`.
  6. Return `200 { id: user.id, email: user.email }`.
  7. Wrap in try/catch.

  The `GET` handler in the me route file is a named export `GET`. The `POST` handler in the logout route file is a named export `POST`.

- **Testing**:
  - Unit: For me, mock cookie extraction, `verifyToken`, and `prisma.user.findUnique`. Test: no cookie → `401`, invalid token → `401`, valid token but deleted user → `401`, valid token and existing user → `200`.
  - Integration: Call `GET /api/auth/me` without cookie → `401`. Call after login → `200`. Call `POST /api/auth/logout` → `200` with `Max-Age=0` cookie. Then call `GET /api/auth/me` → `401`.
  - Manual: Log in, open devtools, call `/api/auth/me` — confirm `{ id, email }` is returned. Log out, call again — confirm `401`.

---

### T8: `POST /api/auth/forgot-password` route handler

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/auth/forgot-password/route.ts` — create
- **Implementation notes**:
  Logic:
  1. Parse `{ email }`. If missing, return `400 { error: "Email is required" }`.
  2. Query `prisma.user.findUnique({ where: { email }, select: { email: true } })`.
  3. If the user does **not** exist, return `200 { token: null }` immediately (same status as success — avoids email enumeration).
  4. If the user exists:
     a. Delete any existing token rows: `prisma.passwordResetToken.deleteMany({ where: { email } })`.
     b. Generate a 64-character hex token: `import { randomBytes } from 'crypto'; const token = randomBytes(32).toString('hex');`
     c. Set expiry: `const expiresAt = new Date(Date.now() + 60 * 60 * 1000);` (1 hour from now).
     d. Insert: `prisma.passwordResetToken.create({ data: { token, email, expiresAt } })`.
     e. Return `200 { token }`.
  5. Wrap in try/catch; return `500` on unexpected error.

  `randomBytes` is imported from Node.js `crypto` (not the Web Crypto API). This route runs on Node.js runtime.

- **Testing**:
  - Unit: Mock `prisma.user.findUnique` and `prisma.passwordResetToken`. Test: missing email → `400`. Unknown email → `200 { token: null }`. Known email → `200 { token: "<64 hex chars>" }` and verify deleteMany was called before create.
  - Integration: POST with an unknown email; assert `200 { token: null }`. POST with a known email; assert `200` and `token` is a 64-character hex string. Call again for the same email; confirm old token row is gone and new one exists (query Prisma Studio or DB).
  - Manual: Submit the form on `/forgot-password` with a registered email and confirm the page redirects to `/reset-password?token=<token>`.

---

### T9: `POST /api/auth/reset-password` route handler

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/app/api/auth/reset-password/route.ts` — create
- **Implementation notes**:
  Logic:
  1. Parse `{ token, password, confirmPassword }`. If `token` missing → `400 { error: "Token is required" }`. If `password.length < 8` → `400 { error: "Password must be at least 8 characters" }`. If `password !== confirmPassword` → `400 { error: "Passwords do not match" }`.
  2. Query: `prisma.passwordResetToken.findUnique({ where: { token } })`.
  3. If `null` → `400 { error: "Invalid or expired reset token" }`.
  4. If `tokenRow.expiresAt < new Date()`:
     - Delete: `prisma.passwordResetToken.delete({ where: { token } })`.
     - Return `400 { error: "Invalid or expired reset token" }`.
  5. Hash new password: `bcrypt.hash(password, 12)`.
  6. Update user: `prisma.user.update({ where: { email: tokenRow.email }, data: { passwordHash } })`.
  7. Delete used token: `prisma.passwordResetToken.delete({ where: { token } })`.
  8. Return `200 { success: true }`.
  9. Wrap in try/catch; return `500` on unexpected error.

  Steps 6 and 7 should ideally be a Prisma transaction (`prisma.$transaction`) to ensure atomicity.

- **Testing**:
  - Unit: Mock all Prisma calls. Test: missing token → `400`. Short password → `400`. Mismatched passwords → `400`. Token not found → `400`. Expired token → `400` and deleteMany called. Valid token → `200`, user.update called, token deleted.
  - Integration: Create a user, call forgot-password to get token, call reset-password with the token and a new password → `200`. Then call reset-password again with same token → `400`. Then call login with new password → `200`.
  - Manual: Use the `/forgot-password` → `/reset-password` flow end-to-end in the browser. Confirm new password works on login.

---

### T10: `src/middleware.ts` — JWT-based route protection

- **Type**: backend
- **Wave**: 2
- **Files to create or modify**:
  - `src/middleware.ts` — create at `src/middleware.ts`
- **Implementation notes**:
  Next.js middleware runs on the **Edge runtime**. Only import `@/lib/auth` (which uses only `jose`, Edge-safe) and `next/server`. Do **not** import `bcryptjs` or Node.js `crypto`.

  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { verifyToken } from '@/lib/auth';

  export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value;
    const pathname = request.nextUrl.pathname;

    if (!token) {
      return redirectToLogin(request, pathname);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return redirectToLogin(request, pathname);
    }

    return NextResponse.next();
  }

  function redirectToLogin(request: NextRequest, pathname: string) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  export const config = {
    matcher: ['/interview/:path*', '/results/:path*'],
  };
  ```

  The `redirect` query param is set to the original pathname (not the full URL with query string, to keep it simple). The client must validate that the `redirect` value starts with `/` before using it.

- **Testing**:
  - Unit: Middleware functions are difficult to unit-test directly. Write an integration test or rely on manual testing.
  - Integration: Make a GET request to `/interview/test-job` without a cookie; assert the response is a `307` redirect to `/login?redirect=/interview/test-job`. Make the same request with a valid JWT cookie; assert the request proceeds (does not redirect).
  - Manual: While logged out, navigate to `/interview/some-id` in the browser; confirm redirect to `/login?redirect=/interview/some-id`. Log in; navigate again — confirm the page loads.

---

### T11: `/login` page

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/login/page.tsx` — create
- **Implementation notes**:
  This is a Client Component (`'use client'`). It uses `useState` for form state and `useRouter` + `useSearchParams` from `next/navigation` for redirect handling.

  State:
  ```ts
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  ```

  On submit:
  1. Call `event.preventDefault()`.
  2. Set `loading = true`, `error = ''`.
  3. `fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })`.
  4. If `response.ok`: read `redirect` from `useSearchParams().get('redirect')`. If the value is a string starting with `/`, `router.push(redirect)`. Otherwise `router.push('/')`.
  5. If not ok: parse `{ error }` from response body, `setError(error)`, focus the error element.
  6. Finally: `setLoading(false)`.

  Layout: A full-page centered flex container wrapping a `Card`. Inside the Card:
  - Platform name heading (`h1` or `h2`).
  - Two `Input` components: `type="email"` label "Email", `type="password"` label "Password".
  - A `Button` with `variant="primary"`, `loading={loading}`, `disabled={loading}`, `type="submit"` — label "Sign in".
  - If `error` is non-empty: `<p role="alert" ref={errorRef} tabIndex={-1}>{error}</p>` (focus this element after render when error changes using `useEffect`).
  - A `<Link>` to `/signup`: "Don't have an account? Sign up".
  - A `<Link>` to `/forgot-password`: "Forgot your password?".

  All inputs must have associated `<label>` elements (handled by the `Input` component). Error messages use `role="alert"`. Move focus to error using a `ref` and `useEffect`.

- **Testing**:
  - Unit: Render the page, fill form, submit — assert fetch is called with correct body. Mock fetch to return `401` — assert error message renders. Mock fetch to return `200` — assert `router.push` called with `/`.
  - Integration: Fill form with valid credentials in a test environment; confirm redirect.
  - Manual: Open `/login` in Firefox and Safari — confirm page renders and functions (no Web Speech API dependency). Test loading state disables inputs and button. Test error message appears and receives focus.

---

### T12: `/signup` page

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/signup/page.tsx` — create
- **Implementation notes**:
  Client Component. State: `email`, `password`, `confirmPassword`, `error`, `loading`.

  On submit:
  1. `event.preventDefault()`.
  2. **Client-side validation**: If `password.length < 8`, `setError("Password must be at least 8 characters")` — do not call fetch. If `password !== confirmPassword`, `setError("Passwords do not match")` — do not call fetch.
  3. If client validation passes, set `loading = true`, call `fetch('/api/auth/signup', ...)`.
  4. On `response.ok` (201): redirect to `redirect` query param (if safe) or `/`.
  5. On error: parse and `setError`.
  6. Finally `setLoading(false)`.

  Layout: Same centered Card pattern as `/login`. Three `Input` components: `type="email"` label "Email", `type="password"` label "Password", `type="password"` label "Confirm Password". One `Button variant="primary"` labeled "Create account". A `<Link>` to `/login`.

- **Testing**:
  - Unit: Test that submitting with `password !== confirmPassword` sets an error and does not call fetch. Test that submitting with short password sets an error and does not call fetch. Test successful signup calls fetch and redirects.
  - Manual: Verify client-side error appears without network activity (check Network tab is silent on validation errors). Verify duplicate email shows server error inline.

---

### T13: `/forgot-password` page

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/forgot-password/page.tsx` — create
- **Implementation notes**:
  Client Component. State: `email`, `error`, `loading`, `tokenNull` (boolean).

  On submit:
  1. `event.preventDefault()`.
  2. Set `loading = true`, `error = ''`.
  3. `fetch('/api/auth/forgot-password', { method: 'POST', ... body: { email } })`.
  4. Parse response: `const { token } = await response.json()`.
  5. If `token !== null`: `router.push('/reset-password?token=' + token)` — no message shown.
  6. If `token === null`: set `tokenNull = true` — render static message "If an account exists for that email, you will be redirected to set a new password." No redirect.
  7. On error (non-200): parse `{ error }` and `setError`.
  8. Finally `setLoading(false)`.

  Layout: Centered Card. One `Input type="email"` labeled "Email". One `Button variant="primary"` labeled "Send reset link". A `<Link>` to `/login` labeled "Back to sign in". If `tokenNull`, render the static message paragraph.

- **Testing**:
  - Unit: Mock fetch returning `{ token: "abc" }` — assert `router.push` called. Mock returning `{ token: null }` — assert static message rendered and no redirect.
  - Manual: Enter a registered email — confirm redirect to `/reset-password`. Enter an unknown email — confirm static message appears.

---

### T14: `/reset-password` page

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/app/reset-password/page.tsx` — create
- **Implementation notes**:
  Client Component. On mount, read `useSearchParams().get('token')`.

  State: `password`, `confirmPassword`, `error`, `loading`, `success` (boolean).

  If `token` is `null` or empty string on mount: render an error state immediately — display "No reset token found. Please start the process again." with a `<Link>` to `/forgot-password`. Do not render the form.

  On submit (form present):
  1. `event.preventDefault()`.
  2. Client-side validation: password length and match — set `error` if invalid, do not call fetch.
  3. Set `loading = true`.
  4. `fetch('/api/auth/reset-password', { method: 'POST', body: { token, password, confirmPassword } })`.
  5. On `response.ok`: set `success = true`. Call `setTimeout(() => router.push('/login'), 2000)`.
  6. On error: parse and `setError`.
  7. Finally `setLoading(false)`.

  When `success = true`: render "Password updated. Redirecting to login…" and hide the form.
  When `error` is set (from server): render the error message with `role="alert"` and a `<Link>` to `/forgot-password`.

  Layout: Centered Card. Two `Input type="password"` fields labeled "New Password" and "Confirm New Password". One `Button variant="primary"` labeled "Set new password". A `<Link>` to `/login` labeled "Back to sign in".

  **Important**: This page uses `useSearchParams`, which requires wrapping in `<Suspense>` at the page level in Next.js App Router. Wrap the form component in `<Suspense fallback={null}>` to avoid build errors.

- **Testing**:
  - Unit: Render with no `token` param — assert error message shown and no form. Render with a token — assert form shown. Mock fetch returning success — assert success message and setTimeout called. Mock fetch returning `400` — assert error message with link to `/forgot-password`.
  - Integration: Navigate to `/reset-password` without `?token` — confirm error. Navigate with a valid token from the DB — confirm success flow.
  - Manual: Manually test the full flow: signup → forgot-password → reset-password → login with new password.

---

### T15: `docs/openapi.yaml` — auth endpoint documentation

- **Type**: backend
- **Wave**: 3
- **Files to create or modify**:
  - `docs/openapi.yaml` — modify (add auth tag and all six auth endpoint paths)
- **Implementation notes**:
  Add `auth` to the `tags` list:
  ```yaml
  - name: auth
    description: Authentication — signup, login, logout, JWT session, and password reset
  ```

  Add paths for all six endpoints under `paths:`. Each path entry must include:
  - `summary` and `operationId`
  - `tags: [auth]`
  - `requestBody` with `application/json` schema (for POST endpoints)
  - `responses` for every possible HTTP status code documented in the spec (200, 201, 400, 401, 409, 500 as applicable)
  - For `POST /api/auth/signup` and `POST /api/auth/login`: include a note in the description that the response sets an `auth_token` HttpOnly cookie.
  - For `POST /api/auth/logout`: note the cookie is cleared.

  Use OpenAPI 3.1.0 syntax. Follow the existing file structure (the `paths: {}` placeholder is at the bottom).

  Endpoints to document:
  1. `POST /api/auth/signup`
  2. `POST /api/auth/login`
  3. `POST /api/auth/logout`
  4. `GET /api/auth/me`
  5. `POST /api/auth/forgot-password`
  6. `POST /api/auth/reset-password`

- **Testing**:
  - Run `npx @redocly/cli lint docs/openapi.yaml` (or equivalent validator) to confirm the YAML is valid OpenAPI 3.1.
  - Manual: Review each endpoint entry matches the spec's API contracts (status codes, request/response shapes).

---

## Data migrations

### Prisma schema additions (T1)

**New model: `User`**
```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  sessions     Session[]

  @@map("users")
}
```

**New model: `PasswordResetToken`**
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("password_reset_tokens")
}
```

**Modified model: `Session`** — add between `jobId`/`job` and `startedAt`:
```prisma
userId     String?       @map("user_id")
user       User?         @relation(fields: [userId], references: [id])
```

**Migration command:**
```bash
npx prisma migrate dev --name add-auth-models
npx prisma generate
```

The `userId` column is nullable so existing `sessions` rows are not broken. No data backfill is required.

## API documentation updates

All six new endpoints must be added to `docs/openapi.yaml` by the backend-implementer in T15:

| Method | Path                          | Status codes        |
|--------|-------------------------------|---------------------|
| POST   | `/api/auth/signup`            | 201, 400, 409, 500  |
| POST   | `/api/auth/login`             | 200, 400, 401, 500  |
| POST   | `/api/auth/logout`            | 200, 500            |
| GET    | `/api/auth/me`                | 200, 401            |
| POST   | `/api/auth/forgot-password`   | 200, 400, 500       |
| POST   | `/api/auth/reset-password`    | 200, 400, 500       |

## Cross-cutting concerns

The following must be created before any Wave 2 or Wave 3 task begins (all are Wave 1):

1. **`src/types/index.ts`** (T4): `AuthUser`, `JwtPayload`, and auth response types are used by all API routes and frontend pages. The backend-implementer for T4 must finish before T5–T10 start.

2. **`src/lib/auth.ts`** (T2): `signToken`, `verifyToken`, `buildAuthCookie`, `clearAuthCookie` are used by T5, T6, T7, T8, T9, T10. Must be complete and tested before Wave 2 begins.

3. **`src/components/ui/`** (T3): `Button`, `Input`, `Card` are used by all four auth pages (T11–T14). Must exist before Wave 3 frontend tasks begin.

4. **npm packages**: `jose`, `bcryptjs`, `@types/bcryptjs` must be installed before any Wave 1 backend task begins. The implementer for T1 or T2 should run `npm install jose bcryptjs` and `npm install -D @types/bcryptjs` as the first step.

5. **`JWT_SECRET` env var**: must be added to the local `.env` file (and to `.env.example` as part of T1) before the dev server is started for testing.
