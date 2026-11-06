# Security Documentation

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

This document describes the security model **as implemented in the codebase**. Every claim below is traceable to a source file. Where a control has a known limitation, it is stated explicitly rather than omitted.

---

## 1. Security Principles

| Principle | How it is applied |
|---|---|
| **Fail closed** | When the database is unavailable the API returns HTTP 503; there is no mock/in-memory fallback in production. Unrecognised tokens are rejected rather than defaulted to a privileged role. |
| **Least privilege** | The service-role key lives only on the server. The browser receives only the public anon key. |
| **Defence in depth** | Auth middleware + per-route role checks + Supabase Row Level Security (RLS) on all 14 tables. |
| **No secrets in source** | All secrets come from environment variables. `.env` is gitignored; `.env.example` contains placeholders only. |
| **Least exposure of the answer key** | `questions.correct_answer` never reaches a learner's device; it is stripped by a database view. |
| **Grading on the server** | Scores are computed server-side so a learner's device cannot influence the mark. |

---

## 2. Authentication

The platform has **two independent authentication paths**.

### 2.1 Staff (administrator & teacher) — Supabase Auth

- Staff sign in with email/username + password via Supabase Auth (`signInWithPassword`).
- Non-email identifiers (e.g. `darksyntax`) are resolved to the profile email before calling Supabase Auth (via `user_profiles.username`).
- On every request, `requireAuth` calls `supabaseAuth.auth.getUser(token)`.
- The account's role is then loaded from `user_profiles`. **Fail-closed:** an authenticated Supabase user with **no** recognised staff profile (or no `school_id`) is rejected with HTTP 401 — they are never defaulted to `admin`/`teacher`.

Source: [server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts) (`requireAuth`, lines ~402–495)

### 2.2 Learners — student number + PIN → locally signed JWT

- Learners sign in with a **student number + PIN**.
- The PIN is verified against a **salted bcrypt hash (cost 12)**.
- On success the server issues a **locally signed JWT** (`generateLearnerToken`) containing `role: 'learner'`, `studentNumber`, `name`, `grade`, `className`, `classId`, `schoolId`, with a **12-hour expiry** ("single school day").

Source: [server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts) (`hashPin`/`verifyPin` cost 12; `generateLearnerToken`)

### 2.3 Session-signing secret resolution

`getJwtSecret()` in [server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts#L20-L39) resolves the learner-token signing secret:

1. If `SUPABASE_JWT_SECRET` is set → used verbatim.
2. If **unset in production** (`NODE_ENV=production`) → **throws** ("Refusing to sign or verify session tokens in production without a server-only secret"). This is the fail-closed behaviour.
3. If unset in non-production → an **ephemeral random** per-process secret is generated (tokens die on restart).

Staff tokens issued by `generateStaffToken` (fallback/test path) expire in **7 days**; production staff tokens are Supabase-issued and validated through `auth.getUser`.

> **Important:** `SUPABASE_JWT_SECRET` here is a **dedicated local session-signing secret** for learner tokens. It is **not** Supabase's project JWT secret and does not need to match it.

---

## 3. Authorisation

- `requireRole([...])` ([server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts#L497-L511)) enforces role membership per route:
  - `admin`, `teacher`, `learner`.
  - Missing authentication → HTTP 401; wrong role → HTTP 403.
- Teacher data isolation: when a teacher authenticates, their assigned classes and subjects are loaded from `teacher_assignments` and `classes.form_teacher_id`, and stored on `req.user` for downstream scoping.
- **Database layer:** RLS is enabled on **all 14 tables** (see §6). Two helper functions, `current_user_school_id()` and `current_user_role()`, are `SECURITY DEFINER` and drive the tenant/role predicates in the policies.

---

## 4. Brute-force and abuse protection

| Control | Implementation | Parameters |
|---|---|---|
| Per-account lockout | `recordFailedAttempt` / `checkLockout` | **5** failed attempts → **15-minute** lockout |
| IP rate limit | `checkIpRateLimit` | **10** requests per **60 s** window per IP (defaults) |
| Lockout reset on success | `clearLockout` | — |

Source: [server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts#L247-L285), lines ~379–397.

> **Limitation:** the lockout and IP-rate counters are held in **in-memory `Map`s**. On Vercel's serverless runtime each instance has its own memory, so counters are **not shared across instances** and **reset on cold start**. This is effective against rapid single-instance attacks but is not a distributed rate limiter. (See [docs/KNOWN_ISSUES.md](KNOWN_ISSUES.md).)

---

## 5. Credential storage & password hashing

- Learner PINs and staff passwords handled by the app are hashed with **bcryptjs, cost factor 12** (`hashPin`, `hashPassword`).
- The `learners` table stores only the hash.
- **No plaintext credentials** are stored by the application, and none are written to logs.

---

## 6. Database security (Supabase / PostgreSQL)

- **RLS enabled on all 14 tables** (`schools`, `user_profiles`, `teachers`, `classes`, `subjects`, `teacher_assignments`, `learners`, `class_memberships`, `quizzes`, `questions`, `quiz_assignments`, `submissions`, `submission_answers`, `audit_events`).
- Tenant isolation is keyed on `school_id`; role isolation on `current_user_role()`.
- **Two separate Supabase clients by design** ([server/db.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/db.ts)):
  - `getSupabaseAdmin()` — service-role client used for data (bypasses RLS, server-only).
  - `getSupabaseAuth()` — used **exclusively** for Auth calls (`signInWithPassword`, `getUser`, `auth.admin.*`).
  - Rationale: in supabase-js v2, calling `signInWithPassword()` on the data client would attach the signed-in user's token to every subsequent PostgREST request and silently downgrade the service-role client to that user under RLS. The split keeps the admin client at service-role for the process lifetime.
- **Answer-key protection:** the `learner_active_quiz_questions` view **omits** `correct_answer` and `explanation`, and only exposes quizzes in `published` / `in_progress` / `closed` / `results_released` states. Learners cannot read the answer key through the API.
- **Integrity constraints:** `submissions.client_submission_hash` is `UNIQUE` (idempotent sync), `submission_answers (submission_id, question_id)` is `UNIQUE`, and `user_profiles.username` has a case-insensitive unique index.

Full inventory: [docs/DATABASE.md](DATABASE.md).

---

## 7. Secrets management

| Rule | Enforcement |
|---|---|
| Secrets read from environment only | `process.env.*` via `dotenv` |
| `.env` never committed | Listed in [.gitignore](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/.gitignore) (`.env*`, except `.env.example`) |
| `.env.example` holds placeholders | [.env.example](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/.env.example) |
| Client/server separation | Server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, AI keys) are **never** prefixed `VITE_`. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the browser bundle. |
| AI keys not hard-coded | The browser fetches AI keys at runtime from `GET /api/ai/client-config` (authenticated teachers only) |
| Admin password never auto-overwritten | Bootstrap only realigns the Supabase Auth password when `ADMIN_PASSWORD_RESET="true"` |

### 7.1 Git history secret scan

Performed on **2026-11-06** across the entire repository history:

```powershell
node scripts/secret-scan.mjs
```

| Item | Value |
|---|---|
| Engine | [scripts/secret-scan.mjs](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/scripts/secret-scan.mjs) — `gitleaks` is not installed on the build machine |
| Scope | Every blob reachable from any ref **plus the reflog** — the whole history, not just the working tree |
| Patterns | Google `AIza…`, Groq `gsk_…`, GitHub `gh[pousr]_…`, AWS `AKIA…`, Slack `xox…`, PEM private-key blocks, JWTs (Supabase keys/session tokens), assignments to known secret variable names, and DB connection strings with inline credentials |
| **Result** | **CLEAN — 0 findings** (376 revisions at the latest run). One placeholder occurrence (`YOUR_GEMINI_API_KEY` in `.env.example`) was correctly ignored. |
| `.env` tracked? | **No** — `git ls-files` returns only `.env.example` |

The detector was validated against a synthetic repository containing fake Groq, GitHub, JWT and Gemini credentials: it flagged all four and ignored a `<your-key-here>` placeholder. Matches are redacted to a 4-character prefix plus length, so a report can be shared without leaking a value. Re-run before submission and after introducing any new configuration file.

---

## 8. Input validation & error handling

- Route handlers validate required fields and return HTTP 400 with a message for malformed input.
- A global error handler in `server.ts` converts uncaught errors into a generic JSON error response (no stack traces to the client).
- **Not implemented:** a formal schema-validation library (e.g. Zod). Validation is hand-rolled per route. There is **no explicit output sanitisation layer**, although the SPA renders via React (which escapes interpolated text by default).

---

## 9. Transport & platform

- Vercel serves the SPA and API over **HTTPS**; Supabase connections use TLS.
- Same-origin API (no permissive CORS wildcard required) — the SPA and `/api` are served from one domain.
- Security headers (CSP/HSTS/X-Frame-Options) are **not** explicitly configured by the app; Vercel's defaults apply.

---

## 10. Audit logging

- `logAuditEvent()` writes to the `audit_events` table (action, actor, role, target entity/id, metadata, IP).
- If the database is unavailable, the event is written to the server log instead — it is **never silently dropped**, but it is also **not** persisted in that case.
- Quiz lifecycle transitions (including `POST /api/quizzes/:id/close` and results release) emit audit events.

Source: [server/db.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/db.ts#L68-L98)

---

## 11. Known security limitations (honest summary)

| # | Limitation | Impact | Reference |
|---|---|---|---|
| 1 | In-memory rate-limit / lockout store | Not shared across serverless instances; resets on cold start | §4 |
| 2 | No schema-validation library; hand-rolled validation | Higher chance of missed edge cases | §8 |
| 3 | No explicit security headers / CSP | Reduced hardening against XSS/clickjacking | §9 |
| 4 | No MFA for staff | Password is the sole second factor for admin | — |
| 5 | No CSRF tokens | Mitigated by bearer-token auth rather than cookies | — |
| 6 | RLS policies were not exercised end-to-end live in testing | Policy correctness reasoned from SQL, not observed at runtime | [TESTING_REPORT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/TESTING_REPORT.md) |
| 7 | No automated dependency/vulnerability scanning, and the secret scan of §7.1 runs on demand rather than in CI | CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) gates lint, tests and the build, but does not yet run `scripts/secret-scan.mjs` or `npm audit` | [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) |

These are documented rather than hidden. None expose a stored secret or a bypass of authentication/authorisation.

---

*Related: [docs/API.md](API.md) · [docs/DATABASE.md](DATABASE.md) · [docs/KNOWN_ISSUES.md](KNOWN_ISSUES.md) · [.env.example](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/.env.example)*
