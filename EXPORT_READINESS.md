# Growing Minds Academy AI Quiz System — Trae IDE Export Readiness

This document provides complete instructions for unzipping, inspecting, configuring, developing, building, and verifying the **Growing Minds Academy AI Quiz System** in **Trae IDE** (or any standard Node.js / VS Code-compatible environment).

---

## 1. Project Overview & Architecture

* **Frontend:** React 19 SPA with TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React icons, Recharts for analytics, and Motion for transitions.
* **Backend:** Express 4 on Node.js with Vite development middlewares in dev mode, and precompiled static serving in production.
* **Storage & Persistence:** Supabase PostgreSQL is the single authority for online data via `server/db/databaseAdapter.ts`:
  * **Online:** All quiz, learner, teacher, class, subject, submission and audit records persist to Supabase (`@supabase/supabase-js`) with Row Level Security, under a fail-closed adapter (`assertPersistence()` throws when Supabase is unconfigured, so a failed write can never be reported as success).
  * **Offline (client only):** Browser IndexedDB (`GMA_Offline_DB` v1) caches real quizzes and queues real submissions for background sync. It never generates or stores fabricated users, quizzes or results.
  * **Database unavailable:** The server returns HTTP 503 and the UI shows an honest error/empty state. There is no in-memory or mock fallback.
* **Authentication:** Real credentials only. Staff authenticate through Supabase Auth; learners authenticate with salted bcrypt (cost 12) PINs exchanged for signed session tokens. There is no demo account, role switch or local fallback auth path.
* **AI Engine:** Google Gemini Flash (`@google/genai` v2.4.0) with automated question batching, deduplication, and partial failure recovery for custom question counts up to 50 items. If the key is missing or a placeholder, generation is refused with a clear error — synthetic questions are never substituted for AI output.
* **Assessment & Printing:** Dedicated printable exam papers (`GET /api/quizzes/:id/paper`) and authorized teacher-only mark schemes (`GET /api/quizzes/:id/answer-key`) with browser Print / "Save as PDF" styling.

---

## 2. Directory Structure

```text
├── .env.example                  # Template of required and optional environment variables
├── .gitignore                    # Git ignore file (excludes node_modules, dist, .env*)
├── EXPORT_READINESS.md           # This verification and migration manual
├── index.html                    # Single-Page Application HTML entry point
├── metadata.json                 # AI Studio capability manifest
├── package.json                  # Dependencies and npm scripts
├── tsconfig.json                 # TypeScript compiler configuration (ES2022, bundler)
├── vite.config.ts                # Vite 8 config with Tailwind v4 & React plugins
├── server.ts                     # Main Express server & API routes
│
├── server/                       # Backend architecture modules
│   ├── auth.ts                   # JWT tokens, bcrypt PIN hashing, lockout & IP rate limiter
│   ├── db.ts                     # Supabase client singleton & audit logging
│   └── db/
│       └── databaseAdapter.ts    # Fail-closed Supabase persistence adapter
│
├── src/                          # Frontend source code
│   ├── main.tsx                  # React DOM mount
│   ├── App.tsx                   # Main router and top-level layouts
│   ├── index.css                 # Global CSS importing Tailwind (@import "tailwindcss";)
│   ├── app/                      # Shared layout and navigation components
│   ├── components/               # UI components, badges, modals, print previews
│   │   ├── PrintableQuizPage.tsx # School-branded printable exam paper & answer key
│   │   └── ...
│   ├── features/                 # Domain-specific modules (teacher, learner, analytics)
│   ├── lib/                      # Core browser utilities
│   │   ├── offline-db.ts         # IndexedDB v1 manager (GMA_Offline_DB)
│   │   ├── sync-queue.ts         # Idempotent submission sync queue manager
│   │   └── network.ts            # Online/offline network event listener
│   ├── services/                 # API client services
│   │   ├── auth-service.ts       # Staff/learner authentication (no demo bypass)
│   │   ├── directory-api.ts      # Learners, teachers, classes, subjects client
│   │   ├── learner-api.ts        # Learner records & results client
│   │   ├── quiz-api.ts           # Quiz lifecycle client
│   │   └── storage.ts            # Local client preferences store
│   └── types/                    # Shared TypeScript interfaces
│       ├── learner.ts            # Learner, Teacher, Class, Subject models
│       ├── quiz.ts               # Quiz, Question, Option, Paper types
│       └── submission.ts         # Submission, AnswerRecord, Sync types
│
├── public/                       # Static public assets
│   ├── manifest.json             # Web App Manifest for PWA installation
│   ├── sw.js                     # Service Worker for offline asset caching
│   └── assets/                   # Vector icons & school branding assets
│       └── icon.svg
│
├── supabase/                     # PostgreSQL database assets
│   ├── seed.sql                  # OPTIONAL manual reference data (test cohorts; never auto-run)
│   └── migrations/               # DDL schema migrations (apply in filename order)
│       ├── 20261020000001_initial_schema.sql
│       ├── 20261022000001_add_due_date_and_cohort_fk.sql
│       ├── 20261026000001_add_username_to_user_profiles.sql
│       ├── 20261027000001_add_directory_associations.sql
│       └── 20261027000002_fix_rls_policies.sql
│
└── test/                         # Automated test suite
    ├── security.test.ts          # Fail-closed auth, RBAC, demo-removal & tenant isolation
    ├── adapter.test.ts           # Fail-closed database adapter and UUID mapping
    └── generation-and-export.test.ts # AI configuration honesty and protected exports
```

---

## 3. Environment Variables Reference

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

| Variable Name | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `3000` | Port for the Express server to listen on. |
| `NODE_ENV` | Optional | `development` | Set to `production` for production builds. |
| `VITE_APP_MODE` | **Required** | `production` | Must be `production` for real-user deployment. Strict database enforcement is always on; there is no demo mode. |
| `ALLOW_DEMO_AUTH` | **Required** | `false` | Must be `false`. Demo/fallback authentication has been removed, so this must never be set to `true`. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Google Gemini API key. If omitted or left as a placeholder, AI generation is refused with a clear error and `/api/health` reports `geminiConfigured: false`. Synthetic questions are never substituted. |
| `APP_URL` | Optional | `http://localhost:3000` | Canonical public URL of the application. |
| `SUPABASE_URL` | Optional (Prod) | `https://your-id.supabase.co` | Supabase PostgreSQL project URL for persistent backend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional (Prod) | `eyJhbGciOi...` | Supabase service role key (backend only, never expose to client). |
| `SUPABASE_JWT_SECRET` | **Required (Prod)** | `secret-string` | Server-only secret used to sign and verify learner/staff session tokens. In production (`NODE_ENV=production`) the server **fails closed** if this is unset (tokens cannot be signed or verified). In development/test an ephemeral per-process secret is generated automatically. |
| `INITIAL_ADMIN_PASSWORD` | Optional | *(empty)* | Server-only password used to idempotently bootstrap the initial administrator (`darksyntax`) on startup. Never commit a real value; leave empty in source control. If unset or under 8 characters, no admin is created. |
| `INITIAL_ADMIN_EMAIL` | Optional | `darksyntax@gma.edu` | Overrides the bootstrap administrator email. |
| `VITE_SUPABASE_URL` | Optional (Prod) | `https://your-id.supabase.co` | Public Supabase URL exposed to client. |
| `VITE_SUPABASE_ANON_KEY` | Optional (Prod) | `eyJhbGciOi...` | Public Supabase anon key exposed to client. |

> **Security Rule:** Never commit the `.env` file to git. `.gitignore` is already configured to prevent `.env*` files from being tracked. No secret, password, API key, or JWT secret is hardcoded anywhere in the source tree.

---

## 4. Exact Commands & Workflows

Ensure **Node.js 20+** or **Node.js 22+** is installed on your machine (`node -v`).

### 4.1 Install Dependencies
```bash
npm install
```

### 4.2 Run All Tests
Executes the automated regression suite (32 tests verifying fail-closed authentication, demo-removal guarantees, RBAC, database-adapter behaviour, AI configuration honesty, and protected exports):
```bash
npm test
```

### 4.3 Validate TypeScript
Validates type safety without compiling files:
```bash
npm run lint
```

### 4.4 Start Development Server (Hot Reload & API)
Starts the Express server with Vite middleware mounted on `http://localhost:3000` (if port 3000 is already in use, start with `PORT=3100`):
```bash
npm run dev
```

### 4.5 Production Build
Builds the client SPA into `dist/` and bundles `server.ts` into `dist/server.js`:
```bash
npm run build
```

### 4.6 Start Production Server
Runs the compiled server serving static production assets and live API routes:
```bash
npm start
```

### 4.7 Clean Build Artifacts
```bash
npm run clean
```

---

## 5. External Services & Database Setup

### 5.1 Operational Modes (Demo Behaviour Removed)
There is no local demo/mock mode. The application always runs in strict, database-backed mode:

* **Database configured (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):** all reads and writes go to Supabase. Set `VITE_APP_MODE="production"` and `ALLOW_DEMO_AUTH="false"`.
* **Database not configured or unreachable:** the server **fails closed**. Directory reads, writes, submissions sync and AI generation return HTTP 503, and the UI shows an honest error/empty state. It never returns fabricated records or reports a failed write as success.
* **Offline (client-side only):** the browser may cache real quizzes and queue real submissions in IndexedDB while offline, then replay them on reconnect. This stores only real records captured from the live backend.
* **No demo accounts exist.** There is no `admin@gma.edu` / `demo` login, no teacher/learner seed accounts, no role switching, and no disabled-account fixtures. Any such credentials are rejected.
* **Initial Administrator (`darksyntax`):** provisioned idempotently from the server-only `INITIAL_ADMIN_PASSWORD` variable (see §5.3). The real password is never embedded in source, tests, seeds, or docs.

### 5.2 Connecting Real Supabase PostgreSQL (Required for Real-User Testing)
When deploying to a live database:
1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, execute the migrations **in filename order**:
   * `supabase/migrations/20261020000001_initial_schema.sql`
   * `supabase/migrations/20261022000001_add_due_date_and_cohort_fk.sql`
   * `supabase/migrations/20261026000001_add_username_to_user_profiles.sql`
   * `supabase/migrations/20261027000001_add_directory_associations.sql`
   * `supabase/migrations/20261027000002_fix_rls_policies.sql`
   * *(Optional)* `supabase/seed.sql` — clearly labelled test cohorts only. This file is **never** run automatically; only load it if you deliberately want development sample rows. Real school data should be created through the app.
3. Copy your project URL, Service Role Key, and Anon Key into `.env`:
   ```env
   VITE_APP_MODE="production"
   ALLOW_DEMO_AUTH="false"
   SUPABASE_URL="https://<project-ref>.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="<service-role-secret>"
   SUPABASE_JWT_SECRET="<jwt-secret>"
   INITIAL_ADMIN_PASSWORD="<strong-admin-password-min-8-chars>"
   VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<anon-public-key>"
   ```
   > `SUPABASE_JWT_SECRET` is required once `NODE_ENV=production`; without it the server refuses to sign or verify session tokens (fails closed) instead of using a shared default.
4. Restart the server. Verify with `curl http://localhost:3000/api/health` — it will return `"supabaseConfigured": true` and `"authMode": "supabase"`. The server also prints a one-line bootstrap result for the initial administrator.
5. To enable real AI generation, set `GEMINI_API_KEY` to a real key. While it is empty or a placeholder, `/api/health` reports `"geminiConfigured": false` and generation requests are refused.

### 5.3 Initial Administrator Provisioning & Reset
* The bootstrap username is fixed as `darksyntax`.
* Staff can sign in with either the username `darksyntax` or its email. Supabase Auth authenticates by email, so the server resolves the username to the profile email through the additive `user_profiles.username` column (migration `20261026000001`); email logins are unaffected.
* On startup, if `INITIAL_ADMIN_PASSWORD` is set (≥ 8 characters), the server creates the administrator **idempotently**:
  * If the account already exists in Supabase, it is **left untouched** — credentials are never overwritten automatically.
  * If the variable is missing or too short, a clear message is logged and no account is created.
* There is **no public administrator registration** endpoint.
* **Rotate/reset the password:** set a new `INITIAL_ADMIN_PASSWORD`, set `ADMIN_PASSWORD_RESET="true"` for one restart to realign the Supabase Auth password (or delete the existing `darksyntax` account first), then unset the flag.
* The password is hashed (bcrypt, cost 12) **before** storage and is never logged, returned in responses, or committed.

---

## 6. Verification Status (Local Audit — 2026-10-28)

All results below were produced **locally** on the audited repository (Windows, PowerShell, Node.js `v24.19.0`).

| Check | Command | Result | Evidence |
| :--- | :--- | :--- | :--- |
| TypeScript typecheck | `npm run lint` | **PASS** | `tsc --noEmit` exit 0, zero errors |
| Automated tests | `npm test` | **PASS** | **32 passed, 0 failed** (19 security + 7 adapter + 6 AI/export) |
| Production build | `npm run build` | **PASS** | `dist/index.html` (1.39 kB), `dist/assets/index-*.css` (33.22 kB), `dist/assets/index-*.js` (961.85 kB), `dist/server.js` (~124 kB) |
| Live health (database configured) | `GET /api/health` | **PASS** | `{"status":"ok","geminiConfigured":false,"supabaseConfigured":true,"authMode":"supabase"}` — honest: AI reported unavailable while the key is a placeholder |
| Fail-closed health (no database) | `GET /api/health` (tests) | **PASS** | reports `authMode:"strict-production"`, `supabaseConfigured:false`, and leaks no connection string, service key, or JWT |
| Demo authentication removed | tests | **PASS** | demo staff (`admin@gma.edu`/`demo`) and seeded learner credentials rejected; no session token issued |
| Unauthenticated API guard | tests | **PASS** | protected endpoints return 401 without a valid token |
| Unauthorized role access | tests | **PASS** | learner → staff endpoints 403; teacher → admin endpoints 403 |
| Real admin login (live) | `POST /api/auth/staff-login` | **PASS** | username `darksyntax` returns 200 with `role=admin` and a valid token; a wrong password returns 401 |

**Live database authentication: VERIFIED for the administrator.** With a live `.env`, `GET /api/health` reported `authMode:"supabase"`, and `POST /api/auth/staff-login` with the username `darksyntax` returned **200** (`role=admin`, valid token) while an incorrect password returned **401**. The stored Supabase Auth password had previously drifted from the `.env` value; it was realigned once with the temporary `scripts/one-time-admin-password-reset.mjs` (Supabase Admin API, `updateUserById`, no user created/deleted, no role or RLS change), and `INITIAL_ADMIN_PASSWORD` in `.env` was updated to match. Teacher login and CRUD remain untested pending a real teacher account.

**Windows / PowerShell note:** This machine blocks `npm.ps1` via the execution policy, so the `npm` shim fails with "running scripts is disabled on this system". Use `npm.cmd <script>` instead of `npm <script>` on Windows, or run `Set-ExecutionPolicy -Scope Process Bypass` in the session. This is an environment quirk, not a project issue.

---

## 7. Trae IDE Post-Extraction Checklist

After extracting the ZIP archive into Trae IDE:

- [ ] **Check Node.js Version:** Run `node -v` (Node.js 20.x or 22.x recommended).
- [ ] **Install Packages:** Run `npm install` and verify `node_modules/` is created without errors.
- [ ] **Verify Environment Template:** Confirm `.env.example` exists and create `.env` if custom keys are needed.
- [ ] **Execute Test Suite:** Run `npm test` and confirm all 32 tests pass.
- [ ] **Validate TypeScript:** Run `npm run lint` and verify zero errors.
- [ ] **Verify Production Build:** Run `npm run build` and confirm `dist/index.html` and `dist/server.js` are created.
- [ ] **Verify Health:** Run `npm run dev` and open `http://localhost:3000/api/health`. Confirm `authMode` is `supabase` (database configured) or `strict-production` (not configured), and that `geminiConfigured` is truthful for your `GEMINI_API_KEY`.
- [ ] **Verify Real Login:** Sign in as the real administrator and a real teacher against the live database, then create a subject, a class, and a quiz and confirm the records persist after a refresh.
- [ ] **Verify Offline PWA:** Open DevTools > Application > Service Workers and IndexedDB, confirm `GMA_Offline_DB` is present and that queued submissions replay on reconnect without creating fabricated records.
