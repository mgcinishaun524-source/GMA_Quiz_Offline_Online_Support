# Phase 1–3 Findings: Growing Minds Academy AI Quiz System

**Generated:** 2026-10-28  
**Agent:** Kiro (Workflow Step — Phase 1–3 Inspect, Baseline, Health)

---

## 1. Architecture Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19, Vite 8.3, TypeScript, Tailwind CSS v4 | SPA, bundled client |
| Routing | React Router DOM v7 | Role-based protected routes |
| Backend | Express 4.21, TypeScript (tsx dev / esbuild prod) | Monorepo: `server.ts` (2664 lines) |
| Auth (staff) | Supabase Auth (signInWithPassword + getUser) | JWT from Supabase; profile role checked |
| Auth (learner) | bcryptjs cost-12 PIN hash + custom JWT | 12h expiry, lockout, rate limiting |
| Database | Supabase PostgreSQL | Service-role client server-side only |
| AI Generation | Google Gemini (`@google/genai` v2.4) | Guarded; refuses if key is placeholder |
| Offline storage | IndexedDB (`GMA_Offline_DB` v1) | 4 stores: cached_quizzes, active_answers, submission_queue, sync_logs |
| Sync queue | Custom `SyncQueueService` | Periodic + reconnect trigger, idempotent hash |
| State | React context (AuthContext) + service layer | No global state library |
| Charts | Recharts v3 | Analytics pages |
| Animation | Motion (framer-motion) v12 | UI transitions |

### Key design decisions observed

- **Fail-closed everywhere**: `isSupabaseConfigured()` + `assertPersistence()` guard all DB operations. No mock/demo fallback path remains.
- **Dual Supabase clients**: `getSupabaseAdmin()` for data (service role) and `getSupabaseAuth()` for auth ops — prevents session downgrade bug.
- **Token strategy**: Supabase-issued JWTs for staff (verified via `auth.getUser()`), custom JWTs signed with `SUPABASE_JWT_SECRET` for learners.
- **Offline auth**: Learner offline login only restores a previously-authenticated device session; no PIN bypass offline.
- **No demo accounts**: `ALLOW_DEMO_AUTH` branch deleted; both login endpoints return 503 when no DB configured.

---

## 2. Available npm Scripts

| Script | Command |
|--------|---------|
| `dev` | `tsx server.ts` — starts Express + Vite dev server |
| `build` | `vite build` + `esbuild server.ts` — frontend + backend production bundles |
| `start` | `node dist/server.js` — serves production build |
| `preview` | `vite preview` |
| `clean` | Deletes `dist/` |
| `lint` | `tsc --noEmit` — TypeScript type-check only (no ESLint configured) |
| `test` | Runs three test suites via `cross-env NODE_ENV=test tsx` |

**Test suites:**
1. `test/security.test.ts` — 19 tests
2. `test/adapter.test.ts` — 7 tests
3. `test/generation-and-export.test.ts` — 6 tests

---

## 3. Environment Variables

All queried using `node -e "require('dotenv').config(); ..."` from project root. Values hidden.

| Variable | Status |
|----------|--------|
| `SUPABASE_URL` | SET (value hidden) |
| `SUPABASE_SERVICE_ROLE_KEY` | SET (value hidden) |
| `SUPABASE_JWT_SECRET` | SET (value hidden) |
| `GEMINI_API_KEY` | SET (value hidden) |
| `INITIAL_ADMIN_PASSWORD` | SET (value hidden) |
| `VITE_SUPABASE_URL` | SET (value hidden) |
| `VITE_SUPABASE_ANON_KEY` | SET (value hidden) |

All required production secrets are present in `.env`.

---

## 4. Baseline Results

### 4.1 Node / npm versions

- **Node.js:** v24.19.0
- **npm:** 11.17.0

### 4.2 Lint (`tsc --noEmit`)

```
Exit code: 0
Output: (no errors — clean)
```

**Result: PASS** — Zero TypeScript errors.

### 4.3 Tests (`cross-env NODE_ENV=test tsx <suite>`)

All three suites run with Supabase and Gemini env vars cleared to empty so they exercise the unconfigured/fail-closed path (as designed).

| Suite | Tests | Passed | Failed | Exit Code |
|-------|-------|--------|--------|-----------|
| `security.test.ts` | 19 | 19 | 0 | 0 |
| `adapter.test.ts` | 7 | 7 | 0 | 0 |
| `generation-and-export.test.ts` | 6 | 6 | 0 | 0 |
| **TOTAL** | **32** | **32** | **0** | **0** |

**Result: PASS** — 32/32 tests passing.

### 4.4 Production Build (`vite build`)

```
vite v8.3.5 building client environment for production...
2285 modules transformed.
dist/index.html              1.39 kB  gzip: 0.62 kB
dist/assets/index-*.css     33.22 kB  gzip: 6.73 kB
dist/assets/index-*.js   1,314.28 kB  gzip: 344.36 kB
built in 17.05s
Exit code: 0
```

**Warning (non-fatal):** Main JS bundle is 1,314 kB (344 kB gzipped) — exceeds Vite's 500 kB suggestion. No code-splitting applied. This is a performance concern for tablet/low-bandwidth scenarios but does not break the build.

**Result: PASS** — Build exits 0. Frontend bundle produced. Server bundle also in `dist/server.js`.

---

## 5. Server Health Response

Server was already running on port 3000 from a previous session. Health response confirmed:

```json
{
  "status": "ok",
  "timestamp": "2026-10-28T09:55:36.819Z",
  "service": "Growing Minds Academy Assessment Backend",
  "version": "1.0.0",
  "geminiConfigured": true,
  "supabaseConfigured": true,
  "authMode": "supabase"
}
```

HTTP status: **200 OK**

**Key findings:**
- `supabaseConfigured: true` — Supabase URL and service-role key are valid (not placeholder values)
- `geminiConfigured: true` — Gemini API key is present and not a placeholder
- `authMode: "supabase"` — Live database auth mode; no fallback mode
- Server startup log: `[Admin Bootstrap] Administrator account already exists in Supabase.` — admin bootstrap ran idempotently, detected existing account, made no changes

**Result: PASS** — Health endpoint responds correctly; both Supabase and Gemini report as configured.

---

## 6. API Surface (Observed from `server.ts`)

### Authentication endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/auth/staff-login` | None | — |
| POST | `/api/auth/learner-login` | None | — |
| GET | `/api/auth/me` | Required | Any |
| POST | `/api/staff` | Required | admin |

### Directory endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/learners` | Required | admin, teacher |
| POST | `/api/learners` | Required | admin |
| PUT | `/api/learners/:id` | Required | admin |
| DELETE | `/api/learners/:id` | Required | admin |
| GET | `/api/subjects` | Required | admin, teacher |
| POST | `/api/subjects` | Required | admin |
| PUT | `/api/subjects/:id` | Required | admin |
| GET | `/api/classes` | Required | admin, teacher |
| POST | `/api/classes` | Required | admin |
| PUT | `/api/classes/:id` | Required | admin |
| GET | `/api/teachers` | Required | admin, teacher |
| POST | `/api/teachers` | Required | admin |
| PUT | `/api/teachers/:id` | Required | admin |

### Quiz endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/quizzes` | Required | any |
| GET | `/api/quizzes/:id` | Required | any |
| POST | `/api/quizzes` | Required | admin, teacher |
| PUT | `/api/quizzes/:id` | Required | admin, teacher |
| DELETE | `/api/quizzes/:id` | Required | admin, teacher |
| POST | `/api/quizzes/:id/publish` | Required | admin, teacher |
| POST | `/api/quizzes/:id/assign` | Required | admin, teacher |
| POST | `/api/quizzes/:id/release-results` | Required | admin, teacher |
| GET | `/api/quizzes/:id/paper` | Required | any staff |
| GET | `/api/quizzes/:id/answer-key` | Required | admin, teacher |
| GET | `/api/quizzes/:id/submissions` | Required | admin, teacher |

### Submission / sync / AI endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/submissions` | Required | any |
| PUT | `/api/submissions/:id/feedback` | Required | admin, teacher |
| POST | `/api/submissions/sync` | Required | any |
| GET | `/api/learners/results` | Required | learner |
| POST | `/api/ai/generate-quiz` | Required | admin, teacher |

---

## 7. Offline Storage Implementation

**File:** `src/lib/offline-db.ts`  
**File:** `src/lib/sync-queue.ts`

### IndexedDB schema (`GMA_Offline_DB` v1)

| Store | Key | Purpose |
|-------|-----|---------|
| `cached_quizzes` | `id` (quiz UUID) | Quizzes cached for offline access |
| `active_answers` | `key` = `${quizId}_${learnerId}` | In-progress answers auto-saved per learner per quiz |
| `submission_queue` | `id` (submission UUID) | Queued offline submissions pending sync |
| `sync_logs` | auto-increment | Sync event log |

### Sync behaviour
- `SyncQueueService` runs in browser context only
- Triggers: network reconnect event + periodic 25-second interval
- Per-item: marks as `syncing`, POSTs to `/api/submissions/sync`, marks `synced` and removes from queue on success; marks `failed` with error on failure
- Idempotency: server checks `client_submission_hash` before inserting; duplicate retries return existing record
- Fallback: if IndexedDB unavailable, `active_answers` and `submission_queue` fall back to localStorage

---

## 8. Database Migrations Applied

| Migration file | Description |
|----------------|-------------|
| `20261020000001_initial_schema.sql` | Full initial schema (19 KB) — tables, RLS, indexes |
| `20261022000001_add_due_date_and_cohort_fk.sql` | Due date + cohort FK |
| `20261026000001_add_username_to_user_profiles.sql` | `username` column for short login |
| `20261027000001_add_directory_associations.sql` | Class subject_ids, teacher assignment arrays |
| `20261027000002_fix_rls_policies.sql` | Admin INSERT/DELETE policies on user_profiles |

---

## 9. Test Coverage Gaps

The existing 32 tests are **server-side unit/integration tests** run against an unconfigured (no-DB) backend. They verify:
- Fail-closed behaviour
- Auth enforcement
- Role-based access control
- Input validation
- Token tamper detection
- Admin bootstrap safety
- AI configuration honesty

### NOT covered by automated tests
| Area | Gap | Risk |
|------|-----|------|
| Live Supabase integration | No tests against real DB (requires credentials) | HIGH — real persistence untested |
| Full quiz lifecycle | Create → publish → submit → grade → release | HIGH — happy path unverified |
| Offline browser behaviour | IndexedDB, answer persistence, sync | HIGH — requires browser environment |
| Learner answer marking | Server-side auto-marking logic | MEDIUM — correctness unverified |
| Gemini AI generation | Real API request | MEDIUM — BLOCKED pending API cost approval |
| Concurrent submissions | Race conditions on duplicate hash | MEDIUM |
| Frontend component tests | Zero React component tests | MEDIUM |
| Result visibility controls | Confirm withheld until released | MEDIUM |
| Analytics accuracy | Match submissions vs displayed | LOW |

---

## 10. Key Observations

### Security posture (strong)
- No demo/mock fallback anywhere in the auth or data path
- Dual Supabase client correctly prevents session downgrade
- bcryptjs cost-12 for PIN hashing; lockout after 5 failures
- IP rate limiting on both auth endpoints
- `SUPABASE_JWT_SECRET` required in production; ephemeral only in non-prod
- Answer keys forbidden to learners; test confirmed (403)
- No secrets echoed in health endpoint or error messages

### Code quality observations
- `server.ts` is 2664 lines — very large single file; no defects found but hard to maintain
- Bundle size 1.3 MB gzipped to 344 KB — acceptable for LAN/school WiFi but borderline for mobile data
- No ESLint configured — only tsc type-checking; runtime style issues would not be caught
- No Vitest/Jest for frontend component tests — React component behaviour untested
- `src/lib/offline-db.ts` localStorage fallback in `saveActiveAnswers` does not clear on answer update (minor: stale draft could persist after IndexedDB recovery)

### Confirmed working (from this phase)
- TypeScript types: CLEAN (exit 0)
- 32 security/adapter/AI tests: ALL PASS
- Production build: SUCCESS
- Health endpoint: 200 OK, supabaseConfigured=true, geminiConfigured=true, authMode=supabase
- Admin bootstrap: idempotent (found existing admin, no overwrite)
- All env vars: present in .env

### Pending for subsequent phases
- Live authentication flow verification (Phase 4)
- Supabase schema and RLS policy verification (Phase 5)
- Full quiz lifecycle test (Phase 6)
- Gemini API real-request test (Phase 7 — may be BLOCKED)
- Offline browser testing (Phase 8 — requires browser automation or manual)
- Concurrent submission testing (Phase 9)

---

## 11. Security Recommendation (Non-Code)

The admin account (`darksyntax`) was provisioned and confirmed as existing. Per the original task instructions: **recommend rotating the administrator password outside this report** using a password manager or the Supabase dashboard. Do not store the current value in any report or commit.

---

*End of Phase 1–3 Findings*
