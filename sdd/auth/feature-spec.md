# Feature Spec: Auth

## Overview

Add email-and-password authentication to the AI Interviewer Platform. Users must be able to sign up, log in, log out, and reset their password without any external email service. Authenticated sessions are stored as HttpOnly JWT cookies. The interview and results pages are protected; unauthenticated visitors are redirected to `/login`. A new `User` model is added to Prisma and existing `Session` (interview session) rows are linked to their owning user.

---

## Scope

**Included:**
- Sign-up page (`/signup`) and API endpoint
- Login page (`/login`) and API endpoint
- Logout API endpoint (cookie-clearing)
- Forgot-password page (`/forgot-password`) and API endpoint (generates token, no email sent)
- Reset-password page (`/reset-password`) and API endpoint (validates token, updates password)
- JWT-based session management via HttpOnly cookies (custom implementation — no NextAuth.js)
- Middleware-level route protection for `/interview/[jobId]` and `/results/[sessionId]`
- `User` Prisma model and `PasswordResetToken` Prisma model
- Nullable `userId` foreign key added to the `Session` (interview session) model
- New environment variable `JWT_SECRET`
- New dependencies: `jose` (JWT, Edge-compatible), `bcryptjs` + `@types/bcryptjs`
- All new endpoints documented in `docs/openapi.yaml`

**Out of scope:**
- OAuth / social login
- Email delivery of any kind (signup confirmation, password reset links)
- Account deletion
- Email change
- Two-factor authentication
- Role-based access control beyond "authenticated vs. unauthenticated"
- Rate limiting (not required for this assessment)
- Attaching `userId` to newly-created `Session` rows at session-creation time (the schema FK is added now; the write path will be added when the sessions API is implemented in the core interview feature)

---

## User Stories

- As a new user, I want to create an account with my email and password so that I can access the platform.
- As a returning user, I want to log in with my email and password so that I can resume or start interviews.
- As an authenticated user, I want to log out so that my session is cleared.
- As a user who forgot their password, I want to reset it immediately (without waiting for an email) so that I can regain access.
- As an unauthenticated visitor who lands on `/interview/[jobId]` or `/results/[sessionId]`, I want to be redirected to `/login` so that I understand the page requires authentication.
- As an authenticated user, I want my login state to persist across page refreshes (up to 7 days) so that I do not have to log in on every visit.
- As a user submitting a duplicate email on signup, I want a clear error message so that I know the email is already taken.
- As a user entering an incorrect password on login, I want a clear error message without revealing whether the email exists so that the system is not vulnerable to email enumeration.
- As a user on the reset-password page with an expired or invalid token, I want a clear error message so that I know I must start the forgot-password flow again.

---

## Functional Requirements

1. **Signup**: `POST /api/auth/signup` accepts `{ email, password, confirmPassword }`. It validates that all fields are present, that `password === confirmPassword`, that the password is at least 8 characters, and that the email is not already registered. On success it creates a `User` row with the password hashed via `bcryptjs` (cost factor 12), sets the `auth_token` cookie, and returns `201` with `{ id, email }`.

2. **Login**: `POST /api/auth/login` accepts `{ email, password }`. It looks up the user by email, compares the password with `bcryptjs.compare`, sets the `auth_token` cookie on success, and returns `200` with `{ id, email }`. If the email does not exist or the password is wrong, it returns `401 { error: "Invalid credentials" }` (same message in both cases to prevent email enumeration).

3. **Logout**: `POST /api/auth/logout` clears the `auth_token` cookie by setting it with `Max-Age=0` and returns `200 { success: true }`.

4. **Current user**: `GET /api/auth/me` reads the `auth_token` cookie, verifies the JWT, and returns `200 { id, email }`. If the token is absent or invalid, it returns `401 { error: "Unauthenticated" }`.

5. **Forgot password**: `POST /api/auth/forgot-password` accepts `{ email }`. If the email exists in the `User` table, it:
   - Deletes any existing `PasswordResetToken` rows for that email.
   - Generates a cryptographically random token (32 bytes, hex-encoded, 64 characters).
   - Stores a `PasswordResetToken` row with that token, the email, and `expiresAt = now + 1 hour`.
   - Returns `200 { token }` (the token is returned directly in the response body so the client can redirect to `/reset-password?token=<token>` without email).
   - If the email does NOT exist, it returns `200 { token: null }` — the client shows the same "check your screen" UI either way, to avoid revealing whether an account exists.

6. **Reset password**: `POST /api/auth/reset-password` accepts `{ token, password, confirmPassword }`. It:
   - Validates that `password === confirmPassword` and that the password is at least 8 characters.
   - Looks up the `PasswordResetToken` row by `token`.
   - If not found, returns `400 { error: "Invalid or expired reset token" }`.
   - If `expiresAt` is in the past, deletes the row and returns `400 { error: "Invalid or expired reset token" }`.
   - If valid, hashes the new password, updates the `User` row, deletes the `PasswordResetToken` row, and returns `200 { success: true }`.

7. **JWT cookie**: The `auth_token` cookie is set with:
   - `HttpOnly: true`
   - `Secure: true` in production (`NODE_ENV === "production"`), `false` in development
   - `SameSite: Lax`
   - `Path: /`
   - `Max-Age: 604800` (7 days in seconds)
   - The JWT payload is `{ sub: userId, email }`, signed with `HS256` using `JWT_SECRET`, with a 7-day expiry (`exp`).

8. **Middleware route protection**: `src/middleware.ts` intercepts all requests to `/interview/:path*` and `/results/:path*`. It reads the `auth_token` cookie, verifies the JWT using `jose`. If verification succeeds, the request proceeds. If absent or invalid, it redirects to `/login?redirect=<original-path>`.

9. **Login redirect**: After a successful login or signup, the client checks for a `redirect` query parameter. If present and the value starts with `/`, it redirects there; otherwise it redirects to `/`.

10. **Session schema change**: The `Session` (interview session) model gains a nullable `userId` field (`String?`) with a foreign key to `User.id` and a corresponding `user` relation. This migration is in scope. Populating `userId` at session creation time is NOT in scope for this feature — it will be addressed when the `/api/sessions` endpoint is implemented as part of the core interview feature. Until then, all `Session.userId` values remain `null`.

11. **Login page (`/login`)**: Renders email and password inputs, a submit button (using `src/components/ui/Button`), a link to `/signup`, and a link to `/forgot-password`. On submit failure, an inline error message is shown below the form. While submitting, the button is disabled and shows a loading state.

12. **Signup page (`/signup`)**: Renders email, password, and confirm-password inputs, a submit button, and a link to `/login`. Client-side validation ensures the passwords match before submission. On submit failure, an inline error message is shown. While submitting, the button is disabled.

13. **Forgot-password page (`/forgot-password`)**: Renders an email input and a submit button. After the form is submitted:
   - If the API returns a non-null token: the page immediately redirects to `/reset-password?token=<token>` with no message shown.
   - If the API returns `{ token: null }`: the page shows the static message "If an account exists for that email, you will be redirected to set a new password." with no redirect.

14. **Reset-password page (`/reset-password`)**: Reads `?token` from the URL query string on mount. Renders a new-password input, a confirm-password input, and a submit button. On success, shows "Password updated. Redirecting to login…" and redirects to `/login` after 2 seconds. On error (invalid/expired token), shows the error message and a link back to `/forgot-password`.

15. **Password validation** (both signup and reset): minimum 8 characters. This is enforced on both client and server. The client shows an inline error before submission if the field is shorter than 8 characters.

16. **Shared UI primitives**: All forms use primitives from `src/components/ui/`. The following primitives must exist (and be created by this feature if they do not already exist):
    - `Button` — accepts `variant` (`primary` | `secondary`), `disabled`, `loading` props
    - `Input` — accepts `type`, `label`, `error`, `id`, `name`, `value`, `onChange`, `disabled` props
    - `Card` — a padded container with a subtle border/shadow

17. **No page reload on form submission**: All auth forms use `fetch`-based handlers (`event.preventDefault()`), not native HTML form submission. State is managed with `useState`.

---

## Non-Functional Requirements

- **Performance**: Auth API routes must respond in under 500 ms under normal load. `bcryptjs` cost factor 12 (~200–300 ms) is acceptable.
- **Security**:
  - Passwords are never stored in plaintext; only `bcryptjs` hashes with cost factor 12.
  - JWTs are stored in HttpOnly cookies, not `localStorage`.
  - The `JWT_SECRET` must be at least 32 characters; if missing in production, the server must throw a startup error (not a silent failure).
  - Forgot-password response is identical for existing and non-existing emails to prevent enumeration.
  - Reset tokens expire in 1 hour and are single-use (deleted immediately after use).
- **Browser support**: Auth pages are standard HTML/CSS with no Web Speech API dependency; they must work in all modern browsers (Chrome, Firefox, Safari, Edge).
- **Accessibility**: All form inputs have associated `<label>` elements. Error messages are rendered with `role="alert"`. Focus is moved to the error message after a failed submission.
- **Type safety**: No `any` types. All API response shapes are described in shared types (`src/types/index.ts`).
- **Environment**: `JWT_SECRET` must be added to `.env.example` with a placeholder value and a comment.

---

## Data Model Changes

### New model: `User`

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

### New model: `PasswordResetToken`

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

### Modified model: `Session`

Add a nullable `userId` field with a foreign key relation to `User`:

```prisma
model Session {
  id         String        @id @default(cuid())
  jobId      String        @map("job_id")
  job        Job           @relation(fields: [jobId], references: [id])
  userId     String?       @map("user_id")
  user       User?         @relation(fields: [userId], references: [id])
  startedAt  DateTime      @default(now()) @map("started_at")
  endedAt    DateTime?     @map("ended_at")
  status     SessionStatus @default(IN_PROGRESS)
  turns      Turn[]
  evaluation Evaluation?

  @@map("sessions")
}
```

All DB column names are snake_case via `@map`. All Prisma field names remain camelCase.

---

## API Contracts

### `POST /api/auth/signup`

**Request body:**
```json
{ "email": "user@example.com", "password": "secret123", "confirmPassword": "secret123" }
```

**Success response `201`:**
```json
{ "id": "clxxx", "email": "user@example.com" }
```
Sets cookie: `auth_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Email is required" }` | `email` missing |
| 400 | `{ "error": "Password must be at least 8 characters" }` | password shorter than 8 chars |
| 400 | `{ "error": "Passwords do not match" }` | `password !== confirmPassword` |
| 409 | `{ "error": "Email already registered" }` | duplicate email |
| 500 | `{ "error": "Internal server error" }` | unexpected failure |

---

### `POST /api/auth/login`

**Request body:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**Success response `200`:**
```json
{ "id": "clxxx", "email": "user@example.com" }
```
Sets cookie: `auth_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Email and password are required" }` | either field missing |
| 401 | `{ "error": "Invalid credentials" }` | email not found OR wrong password |
| 500 | `{ "error": "Internal server error" }` | unexpected failure |

---

### `POST /api/auth/logout`

**Request body:** none

**Success response `200`:**
```json
{ "success": true }
```
Sets cookie: `auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 500 | `{ "error": "Internal server error" }` | unexpected failure |

---

### `GET /api/auth/me`

**Request:** no body; reads `auth_token` cookie

**Success response `200`:**
```json
{ "id": "clxxx", "email": "user@example.com" }
```

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "Unauthenticated" }` | cookie absent or JWT invalid/expired |

---

### `POST /api/auth/forgot-password`

**Request body:**
```json
{ "email": "user@example.com" }
```

**Success response `200` (email exists):**
```json
{ "token": "a3f2b1...64hexchars" }
```

**Success response `200` (email does NOT exist):**
```json
{ "token": null }
```

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Email is required" }` | `email` missing |
| 500 | `{ "error": "Internal server error" }` | unexpected failure |

---

### `POST /api/auth/reset-password`

**Request body:**
```json
{ "token": "a3f2b1...64hexchars", "password": "newpassword", "confirmPassword": "newpassword" }
```

**Success response `200`:**
```json
{ "success": true }
```

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Token is required" }` | `token` missing |
| 400 | `{ "error": "Password must be at least 8 characters" }` | too short |
| 400 | `{ "error": "Passwords do not match" }` | mismatch |
| 400 | `{ "error": "Invalid or expired reset token" }` | token not found OR expired |
| 500 | `{ "error": "Internal server error" }` | unexpected failure |

---

## UI Behaviour

### `/login`

**What the user sees:**
- A centered card with the platform name or logo at the top, an "Email" input, a "Password" input, a "Sign in" primary button, a "Don't have an account? Sign up" link (→ `/signup`), and a "Forgot your password?" link (→ `/forgot-password`).

**What the user can do:**
- Type email and password, then click "Sign in".
- Navigate to signup or forgot-password.

**States:**
- **Idle**: form fields empty, button enabled.
- **Loading**: after form submit, button disabled and shows a spinner or "Signing in…" label; inputs disabled.
- **Error**: inline error message rendered below the form with `role="alert"` showing the server error string.
- **Success**: redirect to `?redirect` value (if safe) or `/`.

---

### `/signup`

**What the user sees:**
- A centered card with "Email", "Password", "Confirm Password" inputs, a "Create account" primary button, and a "Already have an account? Sign in" link (→ `/login`).

**What the user can do:**
- Fill all fields and click "Create account".

**States:**
- **Idle**: form empty, button enabled.
- **Client validation error**: if `password !== confirmPassword` or password < 8 chars, an inline error is shown without submitting.
- **Loading**: button disabled with spinner; inputs disabled.
- **Error**: inline server error below the form.
- **Success**: redirect to `/` (or `?redirect` if present).

---

### `/forgot-password`

**What the user sees:**
- A centered card with an "Email" input, a "Send reset link" primary button, and a "Back to sign in" link (→ `/login`).

**What the user can do:**
- Enter their email and submit.

**States:**
- **Idle**: email field empty, button enabled.
- **Loading**: button disabled.
- **Success (token returned)**: page immediately calls `router.push('/reset-password?token=<token>')` with no message shown.
- **Success (token null)**: page shows static message "If an account exists for that email, you will be redirected to set a new password." with no redirect.
- **Error**: inline error below the form.

---

### `/reset-password`

**What the user sees:**
- A centered card with a "New Password" input, a "Confirm New Password" input, a "Set new password" primary button, and a "Back to sign in" link (→ `/login`).
- The page reads the `?token` query param on mount; if the param is absent, it immediately shows an error message: "No reset token found. Please start the process again." with a link to `/forgot-password`.

**What the user can do:**
- Enter and confirm a new password.
- Click "Set new password".

**States:**
- **No token**: error state shown immediately (no form rendered).
- **Idle**: form shown, button enabled.
- **Client validation error**: password < 8 chars or mismatch shown inline before submission.
- **Loading**: button disabled.
- **Success**: shows "Password updated. Redirecting to login…" and redirects to `/login` after 2 seconds.
- **Error**: inline error from server, with a link to `/forgot-password`.

---

## Edge Cases & Error Handling

1. **Duplicate signup email**: `POST /api/auth/signup` returns `409 { error: "Email already registered" }`. The login page shows this error inline.

2. **Wrong password / unknown email on login**: Both cases return `401 { error: "Invalid credentials" }`. The same message is shown to prevent revealing which condition triggered the error.

3. **Expired JWT cookie**: Middleware detects expiry via `jose` verification, treats it as unauthenticated, and redirects to `/login`.

4. **Tampered JWT cookie**: `jose` signature verification fails; treated the same as absent cookie.

5. **Expired reset token**: The `POST /api/auth/reset-password` handler checks `expiresAt` and returns `400 { error: "Invalid or expired reset token" }`. The stale row is deleted.

6. **Multiple forgot-password requests for same email**: Each new request deletes the prior token row before inserting the new one. Only one valid token exists per email at a time.

7. **Reset token already used**: Once `reset-password` succeeds, the token row is deleted. A second use of the same token returns `400 { error: "Invalid or expired reset token" }`.

8. **Missing `JWT_SECRET` environment variable**: `src/lib/auth.ts` throws an error at module load time in production if `JWT_SECRET` is undefined, causing the server to fail fast rather than silently using an empty secret.

9. **`?redirect` parameter with external URL**: Middleware and client code ignore the `redirect` param if the value does not start with `/`, defaulting to `/`.

10. **Concurrent account creation with the same email**: Database-level `UNIQUE` constraint on `users.email` causes a Prisma `P2002` error; the handler maps this to `409`.

11. **Password < 8 characters on reset**: Validated on both client (before submission) and server (before DB write). Server returns `400 { error: "Password must be at least 8 characters" }`.

12. **`/api/auth/me` with valid but deleted user**: If the JWT is valid but the user no longer exists in the DB, return `401 { error: "Unauthenticated" }`.

---

## Acceptance Criteria

- [ ] A new user can sign up with a valid email and password and is redirected to `/` after signup.
- [ ] Signing up with an already-registered email shows "Email already registered" inline.
- [ ] Signing up with a password shorter than 8 characters shows a client-side error before the request is sent.
- [ ] Signing up with mismatched passwords shows a client-side error before the request is sent.
- [ ] A registered user can log in and is redirected to `/` (or the `?redirect` path).
- [ ] Logging in with an unknown email returns "Invalid credentials".
- [ ] Logging in with a wrong password returns "Invalid credentials".
- [ ] A logged-in user can log out; subsequent visits to protected pages redirect to `/login`.
- [ ] After logout, the `auth_token` cookie is absent.
- [ ] The `auth_token` cookie is HttpOnly (cannot be read via `document.cookie` in the browser).
- [ ] The `auth_token` cookie is set with `Max-Age=604800` (7 days); an authenticated user who navigates away and returns within that period is not redirected to `/login`.
- [ ] Visiting `/interview/anything` without a valid cookie redirects to `/login?redirect=/interview/anything`.
- [ ] Visiting `/results/anything` without a valid cookie redirects to `/login?redirect=/results/anything`.
- [ ] The forgot-password form submits the email and, when the email exists, immediately redirects to `/reset-password?token=<token>`.
- [ ] When the email does not exist, the forgot-password page shows a neutral message and does not redirect.
- [ ] The reset-password page without a `?token` param shows an error message and a link to `/forgot-password`.
- [ ] A valid reset token allows setting a new password; after success, the token row is deleted from the DB.
- [ ] Reusing an already-consumed reset token returns "Invalid or expired reset token".
- [ ] An expired reset token (older than 1 hour) returns "Invalid or expired reset token".
- [ ] After a successful password reset, the user can log in with the new password.
- [ ] `GET /api/auth/me` returns `{ id, email }` for an authenticated request.
- [ ] `GET /api/auth/me` returns `401` for an unauthenticated request.
- [ ] All new API endpoints are documented in `docs/openapi.yaml`.
- [ ] The `User`, `PasswordResetToken` models exist in `prisma/schema.prisma` with correct `@map` and `@@map` annotations.
- [ ] The `Session` model has a nullable `userId` field mapped to `user_id`.
- [ ] All form inputs have associated `<label>` elements.
- [ ] Error messages use `role="alert"`.

---

## Open Decisions

1. **Custom JWT vs NextAuth.js**: Chosen custom `jose`-based JWT in HttpOnly cookie over NextAuth.js. Rationale: the feature requires email/password only with no OAuth, which is the simplest possible auth case. NextAuth.js introduces adapter configuration, provider setup, and session strategy decisions that add friction without benefit here. `jose` is Edge-compatible and integrates cleanly with Next.js middleware.

2. **`bcryptjs` vs native `bcrypt`**: Chosen `bcryptjs` (pure JavaScript). Rationale: native `bcrypt` requires native bindings that can break on Vercel's serverless Node.js environment. `bcryptjs` has zero native dependencies and is sufficient for this scale.

3. **Cost factor 12 for bcrypt**: Standard for 2024+ hardware. Fast enough for user experience (<300 ms), strong enough to resist brute-force attacks on stolen hashes.

4. **Password reset without email — immediate redirect**: Since no email service is configured, the API returns the reset token directly in the response body, and the client immediately redirects to `/reset-password?token=<token>`. The token is still stored in the DB with an expiry to satisfy the "validate token on reset page" requirement. This approach is explicitly documented as appropriate for an assessment context without a mail provider.

5. **Nullable `userId` on `Session` — schema added now, write path deferred**: The FK column is added now (nullable) so the data model is ready. Populating it at session creation is deferred to the core interview feature that implements `/api/sessions`. Making it nullable also avoids migration failures if the DB already has session rows with no user.

6. **Token format**: 32 random bytes as a hex string (64 characters). Cryptographically random via Node.js `crypto.randomBytes`. Sufficient entropy to prevent guessing attacks.

7. **Reset token uniqueness**: Enforced at both the DB level (`@unique` constraint) and application level (regenerate if collision, though probability is negligible). Only one token per email at a time (old token deleted before new one is inserted).

8. **7-day session duration**: Balances convenience (users do not log in daily) with security (not indefinite). Standard for consumer web apps.

9. **`auth_token` cookie name**: Simple, descriptive, and not in conflict with any existing cookie name in the app.

10. **`/api/auth/*` route namespace**: Groups all auth endpoints under a single `/api/auth/` prefix for clarity and future extensibility.
