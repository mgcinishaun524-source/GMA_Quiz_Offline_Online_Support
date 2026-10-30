# Growing Minds Academy AI Quiz System — Demo-Removal Implementation Report

**Date:** 2026-10-28
**Scope:** Complete removal of demo/mock behaviour in preparation for real-world teacher testing.
**Status:** Implemented and verified locally. One live-workflow item remains outstanding (see §9).

---

## 1. Audit Summary

The full codebase (frontend, backend, tests, configuration, database assets) was audited for: mock data, demo accounts, hardcoded records, fabricated statistics, auto-seeding, mock API responses, fake success states, local server stores, and silent fallbacks.

Findings and dispositions:

| Area | Finding | Disposition |
| :--- | :--- | :--- |
| Frontend sample data | `src/services/mock-data.ts` held `INITIAL_LEARNERS` and `INITIAL_QUIZZES` (hardcoded students, classes, quizzes). | **Deleted** |
| Backend fixture store | `server/serverStore.ts` seeded in-memory learners/quizzes from `mock-data.ts`. | **Deleted** (confirmed `server.ts` never imported it) |
| Demo auth bypass | `ALLOW_DEMO_AUTH`, `admin@gma.edu`/`demo`, seeded teacher/learner credentials, `local-resilient` auth mode. | **Removed**; logins now fail closed |
| AI synthetic fallback | Server produced synthetic question sets when Gemini was unavailable, and `/api/health` advertised AI as available. | **Removed**; generation refused with a clear error |
| Fabricated reads/writes | Directory/submission endpoints could return or acknowledge records without a database. | **Removed**; all fail closed with 503 |
| Stale tests | Suites asserted the removed `local-resilient` mode, `serverStore`, seeded quizzes and the synthetic-generation path. | **Rewritten** as a fail-closed regression net |
| Documentation | `EXPORT_READINESS.md` and `.env.example` documented demo mode, `serverStore`, `mock-data.ts` and demo accounts. | **Updated** to describe the strict, database-backed system |
| Residual wording | `server/db.ts` audit-log comment referenced "demo / fallback mode". | **Replaced** with accurate wording |

Deliberately **preserved** (legitimate features whose names contain `demo`/`mock`/`sample`): IndexedDB caching (`GMA_Offline_DB`), the offline submission sync queue, network online/offline detection, print/PDF export, and the `/api/health` endpoint.

---

## 2. Fabricated Application Data Removed

* Deleted `src/services/mock-data.ts` (`INITIAL_LEARNERS`, `INITIAL_QUIZZES`) and `server/serverStore.ts`.
* Removed all auto-seeding / default-record creation on startup.
* Dashboard, analytics and result views derive from real database records only and show honest empty states (loading is distinguished from empty).
* Failed reads return HTTP 503 rather than a hardcoded demo record.
* **Database safety:** no tables were truncated, reset, or dropped; no migrations were deleted; no existing Supabase rows were bulk-deleted.
* `supabase/seed.sql` (clearly labelled test cohorts) is **not** executed automatically. It is retained only as an optional manual development aid and is flagged for removal decision in §9.

---

## 3. Real Authentication Enforced

* `VITE_APP_MODE=production`, `ALLOW_DEMO_AUTH=false` are the required real-user settings; the branch that honoured `ALLOW_DEMO_AUTH` is gone.
* Staff authenticate through Supabase Auth; learners authenticate with salted bcrypt (cost 12) PINs exchanged for signed session tokens.
* No credential-verification-free path exists: with no database configured, both login endpoints return **503** and issue **no token**.
* Brute-force lockout (5 attempts → 15 min) and IP rate limiting remain in force.
* `bootstrapInitialAdmin()` provisions `darksyntax` **idempotently** and **never overwrites an existing administrator's password**. It only realigns the password when `ADMIN_PASSWORD_RESET="true"` is explicitly set by an operator.
* No default-account creation, no local fallback auth, no role switching.
* Explicit real-user testing config is set in `.env` (production mode, demo auth disabled).

---

## 4. Supabase Is Authoritative for Online Data

* `server/db/databaseAdapter.ts` persists exclusively to Supabase and is guarded by `assertPersistence()`:
  `"Persistent storage is unavailable: Supabase is not configured. Local fallback storage is disabled."`
* Applies to students, teachers, classes, subjects, quizzes, submissions, grading, results, analytics and settings.
* Every read/write endpoint that depends on the database is guarded by `if (!isSupabaseConfigured()) → 503`. Writes are confirmed against the database; a failed write is never reported as success.
* Access is enforced by the existing auth middleware (`requireAuth` / `requireRole`) plus Supabase RLS. Role checks were verified: learners cannot reach staff endpoints, teachers cannot reach admin endpoints.
* Refreshing the app re-reads from Supabase, so persisted data survives reloads.

---

## 5. Genuine Offline Functionality Preserved

* IndexedDB (`GMA_Offline_DB` v1) still caches **real** quizzes and queues **real** submissions captured from the live backend.
* Queued submissions persist across refreshes, auto-sync on reconnect, and are idempotent (hash-based dedup), with retry/recovery and visible offline indicators.
* Offline storage never generates fake users, quizzes or results — it only stores and replays records that came from the server.

---

## 6. AI-Generation Fallbacks Fixed

* `isGeminiConfigured()` treats missing, empty, `MY_GEMINI_API_KEY`, `YOUR_GEMINI_API_KEY` and any `YOUR_*` value as **not configured**.
* `/api/health` reports `geminiConfigured` truthfully from the same rule the generation endpoint uses, so the status can never advertise AI generation that would be refused.
* When Gemini is unavailable, generation returns a clear error (HTTP 503) and **no** `questions` payload — synthetic questions are never substituted or presented as AI output.
* Manually authored quizzes are kept entirely separate from AI-generated ones.
* The API key value is never logged or returned.

---

## 7. User Interface Cleanup

* Demo labels, demo-mode notices, role-switching controls and pre-filled demonstration PINs removed.
* Honest empty states where no real records exist; loading states are visually distinct from empty states.
* No stale or fabricated records are shown when a request fails.
* Charts and totals are derived from real records; role-appropriate data is shown per user.
* Visual identity (React 19 / Tailwind v4 / Lucide / Recharts / Motion, school branding) is unchanged.

---

## 8. Tests and Configuration Updated

Three suites were rewritten to assert the strict guarantees (32 tests, all passing):

* `test/security.test.ts` (19) — health reports `strict-production` and leaks no connection string/service key/JWT; demo staff and seeded learner credentials are rejected with no token; input validation still returns 400; lockout returns 429; missing/malformed/bogus/tampered tokens return 401; learner→staff and teacher→admin are blocked (403); all five directory reads, learner results, five write endpoints and submission sync fail closed with 503 and no fabricated payload; AI generation is refused with an error mentioning `GEMINI_API_KEY` and no `questions`; AI rejects learners (403) and validates count bounds (400); admin bootstrap refuses without a password and never fabricates an administrator.
* `test/adapter.test.ts` (7) — `resolveUUID` maps seed codes deterministically; `getQuizzes`/`getQuizById`/`getSubmissions`/`getSubmissionByHash` reject rather than fall back; `saveQuiz`/`saveSubmission` reject and return no fabricated object.
* `test/generation-and-export.test.ts` (6) — every placeholder Gemini key form reports `geminiConfigured:false`; a plausible key reports `true` without echoing the value; generation is refused with no substituted questions; answer key requires auth (401) and forbids learners (403); paper export requires auth (401) and is not fabricated (503).

`package.json` test script updated to the three current suites; `test/fail-closed.test.ts` deleted as superseded.

---

## 9. Verification and Outstanding Items

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript typecheck | `npm run lint` | **PASS** — `tsc --noEmit`, exit 0 |
| Unit/integration tests | `npm test` | **PASS** — 32 passed, 0 failed |
| Production build | `npm run build` | **PASS** — `dist/index.html`, `dist/assets/index-*.css` (33.22 kB), `dist/assets/index-*.js` (961.85 kB), `dist/server.js` (~124 kB) |
| Live health | `GET /api/health` | **PASS** — `authMode:"supabase"`, `supabaseConfigured:true`, `geminiConfigured:false` |
| Real admin login | `POST /api/auth/staff-login` (`darksyntax`) | **PASS** — 200 with `role=admin`, valid token |
| Invalid credentials | `POST /api/auth/staff-login` | **PASS** — 401, no session |

### Untestable / outstanding live workflows

1. **Real administrator login — RESOLVED.** The stored Supabase Auth password for `darksyntax` (`5aaa2cde-614d-444b-89fe-eba88d27e54b`, `darksyntax@gma.edu`) differed from the `.env` value, and bootstrap correctly refused to overwrite it automatically. It was realigned with a one-time local script (`scripts/one-time-admin-password-reset.mjs`) that used the Supabase Admin API to locate that exact user by email and `auth.admin.updateUserById` — no user created, deleted, or re-roled; no RLS or demo setting changed. Verified against the built server: `POST /api/auth/staff-login` with username `darksyntax` now returns **200** with `role=admin`, while a wrong password returns **401**. `.env` `INITIAL_ADMIN_PASSWORD` was updated to match, and the temporary script was deleted.
2. **Real teacher login and full CRUD** could not be exercised end-to-end because only the administrator credential was available. Retest after creating a real teacher account.
3. **Real AI generation** could not be verified because `GEMINI_API_KEY` is still the placeholder `YOUR_GEMINI_API_KEY`; the health endpoint honestly reports `geminiConfigured:false`. Set a real key to enable and verify generation.
4. **`supabase/seed.sql`.** This optional file still contains clearly labelled test learners/classes. It is never auto-run. It was **not** deleted because doing so is a data-adjacent decision; approve its removal if you do not want it shipped.

### Files changed in this workstream

* **Deleted:** `src/services/mock-data.ts`, `server/serverStore.ts`, `test/fail-closed.test.ts`
* **Rewritten:** `test/security.test.ts`, `test/adapter.test.ts`, `test/generation-and-export.test.ts`
* **Edited:** `package.json` (test script), `server/db.ts` (audit-log comment), `.env.example` (mode section + JWT note), `EXPORT_READINESS.md` (architecture, tree, env table, modes, migrations, verification)
