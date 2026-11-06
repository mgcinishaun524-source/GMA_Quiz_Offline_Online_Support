# GitHub Setup Guide — Issues, Project Board, Branch Protection

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

This guide contains **everything the repository owner must do manually on GitHub**. An automated agent could not perform these steps because the `gh` CLI is not installed on the build machine and no GitHub credentials are available.

> **Rule followed:** nothing here is created automatically, and **no issue, review or contribution has been fabricated.** Every issue below describes work that was actually done or is genuinely outstanding in this repository.

---

## 0. Repository facts

| Item | Value |
|---|---|
| Remote | `https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support.git` |
| Default branch | `main` |
| Commits | 52 (2026-10-28 → 2026-11-05) |
| Existing issues | **0** |
| Existing PRs | **0** |
| Existing branches | `main` only |
| Project board | none |
| Branch protection | none |

---

## 1. Labels to create (Settings → Labels)

Create/replace these so the issues below can be labelled consistently:

| Label | Colour (suggested) | Purpose |
|---|---|---|
| `frontend` | `#6CABDD` | SPA / UI work |
| `backend` | `#1C2C5B` | Express API work |
| `database` | `#0E7C66` | Supabase / migrations |
| `security` | `#B60205` | Auth / hardening |
| `testing` | `#FBCA04` | Tests |
| `ui/ux` | `#D4A017` | Design & usability |
| `offline` | `#5319E7` | Offline / sync |
| `deployment` | `#0075CA` | Vercel / hosting |
| `documentation` | `#0075CA` | Docs |
| `bug` | `#D73A4A` | Defect |
| `enhancement` | `#A2EEEF` | New capability |
| `technical-debt` | `#F9D0C4` | Refactor / non-functional |

---

## 2. The issues (create these — 44 provided so you can exceed the 30 minimum)

> **Automated option.** `scripts/create-github-issues.mjs` creates every label and all 44 issues below through the GitHub REST API, and closes the ones marked **Done**. It is idempotent — re-running skips anything already present by title and re-aligns its state.
>
> ```powershell
> $env:GITHUB_TOKEN="<classic PAT with the public_repo scope>"
> node scripts/create-github-issues.mjs --dry-run   # preview first
> node scripts/create-github-issues.mjs             # apply
> ```
>
> The token is read from the environment only and is never hardcoded, logged, or committed. The Project board, branch protection, collaborators and PR reviews (sections 3–5) remain manual — the GitHub REST API cannot create a Projects v2 board without the `project` scope.

> **Manual alternative — how to use:** create each as a new issue, paste the Description into the body, add the labels, and set the state indicated. Issues marked **Done** document work already in the history; issues marked **Backlog** are genuine outstanding work. This gives you a truthful board where completed work sits in *Done*.

---

### ISSUE-01 — Implement dual authentication (staff Supabase Auth + learner PIN/JWT)
**Labels:** `backend` `security` · **State: Done**
**Description:** Provide two independent login paths: staff authenticate through Supabase Auth; learners authenticate with a student number + PIN verified against a salted bcrypt hash, receiving a locally signed session JWT.
**Acceptance criteria:**
- [x] Staff login resolves username/email then calls Supabase Auth
- [x] Learner PIN verified with bcrypt cost 12
- [x] Learner token signed with `SUPABASE_JWT_SECRET`, 12 h expiry
- [x] `requireAuth` accepts both token types

### ISSUE-02 — Add role-based access control middleware
**Labels:** `backend` `security` · **State: Done**
**Description:** Enforce `admin` / `teacher` / `learner` roles per route with `requireRole`.
**Acceptance criteria:**
- [x] 401 when unauthenticated, 403 on role mismatch
- [x] Applied to every protected route

### ISSUE-03 — Fail closed when Supabase is not configured
**Labels:** `backend` `security` · **State: Done**
**Description:** Return HTTP 503 for data routes when Supabase is unconfigured instead of falling back to mock/in-memory data.
**Acceptance criteria:**
- [x] No mock data path remains in production
- [x] `/api/health` reports configuration state
- [x] Failed saves are never reported as success

### ISSUE-04 — Implement quiz lifecycle endpoints
**Labels:** `backend` · **State: Done**
**Description:** Provide publish, close, assign, and release-results endpoints with persisted status transitions.
**Acceptance criteria:**
- [x] `POST /api/quizzes/:id/publish`
- [x] `POST /api/quizzes/:id/close` persists `closed_at` + audit event
- [x] `POST /api/quizzes/:id/assign`
- [x] `POST /api/quizzes/:id/release-results`

### ISSUE-05 — Implement server-side grading
**Labels:** `backend` `security` · **State: Done**
**Description:** Grade submissions on the server so scores cannot be influenced by the client.
**Acceptance criteria:**
- [x] Correct answers never sent to learners
- [x] Aggregate score/percentage computed server-side
- [x] Stored on the submission

### ISSUE-06 — Mask marks until the teacher releases results
**Labels:** `backend` `security` · **State: Done**
**Description:** `GET /api/learners/results` must return zeroed marks until the quiz is `results_released` (or automatic release).
**Acceptance criteria:**
- [x] Unreleased quizzes return `score: 0`, `percentage: 0`, and a clear message
- [x] Released quizzes return the real marks

### ISSUE-07 — Fix learner results 0% bug (identity matching)
**Labels:** `backend` `bug` · **State: Done**
**Description:** Released marks displayed as 0% because the client matched submissions on student number only, missing records keyed by learner UUID.
**Acceptance criteria:**
- [x] Lookup matches on student number **or** UUID
- [x] "My Results" re-syncs with the server
- [x] Verified live: released marks flow through (commit `829fa6c`)

### ISSUE-08 — Persist assignment close to the server
**Labels:** `backend` `bug` · **State: Done**
**Description:** Closing a quiz only changed client state, so learners still saw it as active.
**Acceptance criteria:**
- [x] `POST /api/quizzes/:id/close` updates `closed_at`
- [x] Audit event emitted
- [x] Teacher close buttons wired to the endpoint (commit `668d94b`)

### ISSUE-09 — AI quiz generation with Gemini primary + Groq fallback
**Labels:** `backend` `enhancement` · **State: Done**
**Description:** Generate quizzes with Gemini and automatically fall back to Groq on failure; implement a top-up loop to reach the requested count.
**Acceptance criteria:**
- [x] Fallback chain starts at `gemini-2.5-flash`
- [x] Groq retried on Gemini 503/rate-limit
- [x] Top-up loop fills missing items
- [x] Supports up to 200 questions in 10-question chunks

### ISSUE-10 — Serve AI keys to the browser for direct provider calls
**Labels:** `backend` `security` · **State: Done**
**Description:** Expose provider keys to authenticated teachers via `GET /api/ai/client-config` so long generations bypass the Vercel timeout without hard-coding keys.
**Acceptance criteria:**
- [x] Endpoint requires `teacher`/`admin` role
- [x] Keys never placed in the client bundle
- [x] No keys logged

### ISSUE-11 — Offline submission sync with idempotency
**Labels:** `backend` `offline` · **State: Done**
**Description:** `POST /api/submissions/sync` accepts queued offline submissions and deduplicates them.
**Acceptance criteria:**
- [x] `client_submission_hash` UNIQUE prevents duplicates
- [x] Replays are safe
- [x] Server-authoritative score persisted

### ISSUE-12 — Audit event logging
**Labels:** `backend` · **State: Done**
**Description:** Record lifecycle and admin actions to `audit_events`.
**Acceptance criteria:**
- [x] Action, actor, role, target, metadata, IP captured
- [x] Falls back to server log when the DB is unavailable

### ISSUE-13 — Initial database schema (14 tables) with constraints
**Labels:** `database` · **State: Done**
**Description:** Create the core relational schema.
**Acceptance criteria:**
- [x] 14 tables with PKs/FKs and ON DELETE rules
- [x] CHECK constraints on statuses/roles
- [x] UNIQUE constraints on natural keys

### ISSUE-14 — Enable Row Level Security on all tables
**Labels:** `database` `security` · **State: Done**
**Description:** Enable RLS and define school/role-scoped policies.
**Acceptance criteria:**
- [x] RLS enabled on all 14 tables
- [x] `current_user_school_id()` / `current_user_role()` helpers (SECURITY DEFINER)
- [x] Named policies per table

### ISSUE-15 — Learner question view that hides the answer key
**Labels:** `database` `security` · **State: Done**
**Description:** `learner_active_quiz_questions` view strips `correct_answer`/`explanation`.
**Acceptance criteria:**
- [x] Answer key absent from the view
- [x] Only active quiz states exposed

### ISSUE-16 — Add `due_date` and cohort FK to quizzes
**Labels:** `database` · **State: Done**
**Description:** Migration `20261022000001`.
**Acceptance criteria:**
- [x] `quizzes.due_date` added
- [x] `quizzes.class_id` FK (SET NULL)
- [x] Indexes added + rollback SQL documented

### ISSUE-17 — Add staff `username` to user_profiles
**Labels:** `database` · **State: Done**
**Description:** Migration `20261026000001` for short staff login identifiers.
**Acceptance criteria:**
- [x] Nullable `username`
- [x] Case-insensitive unique index

### ISSUE-18 — Persist directory associations
**Labels:** `database` · **State: Done**
**Description:** Migration `20261027000001` for class↔subject and teacher↔class/subject arrays.
**Acceptance criteria:**
- [x] Three UUID[] columns
- [x] GIN indexes

### ISSUE-19 — Fix admin INSERT/DELETE RLS policies on user_profiles
**Labels:** `database` `bug` · **State: Done**
**Description:** Migration `20261027000002` adds missing admin policies (uses `DROP POLICY IF EXISTS`).
**Acceptance criteria:**
- [x] Admin can insert/delete school profiles
- [x] Re-runnable

### ISSUE-20 — Brute-force lockout and IP rate limiting
**Labels:** `security` · **State: Done**
**Description:** 5 failed attempts → 15 min lockout; 10 requests/min per IP.
**Acceptance criteria:**
- [x] Lockout checked before credential verification
- [x] Counter cleared on success

### ISSUE-21 — Session isolation on login/logout
**Labels:** `security` · **State: Done**
**Description:** Clear all `GMA_STORE_*` localStorage keys and in-memory stores when a user changes.
**Acceptance criteria:**
- [x] `clearSessionData()` on staff login, learner login, logout
- [x] No cross-user data leakage (commit `9633787`)

### ISSUE-22 — Teacher data isolation
**Labels:** `security` · **State: Done**
**Description:** Scope teachers to their assigned classes/subjects.
**Acceptance criteria:**
- [x] Assignments loaded at auth time
- [x] Applied to quiz/submission access (commit `8486785`)

### ISSUE-23 — Build the administrator directory management UI
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** CRUD screens for teachers, learners, classes, subjects, plus settings and analytics.
**Acceptance criteria:**
- [x] All six admin pages implemented
- [x] Real-data tables with empty states

### ISSUE-24 — Build the AI Quiz Wizard UI
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** Teacher-facing quiz creation with AI generation controls.
**Acceptance criteria:**
- [x] Topic/subject/grade/count inputs
- [x] Progress and error feedback
- [x] Draft persistence

### ISSUE-25 — Build the learner quiz player
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** Clean quiz-taking UI with autosave and progress.
**Acceptance criteria:**
- [x] Question navigation
- [x] Autosave answers
- [x] Submission confirmation

### ISSUE-26 — Build the learner results portal
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** Show released marks only.
**Acceptance criteria:**
- [x] Hidden until release
- [x] Honest empty state

### ISSUE-27 — Build teacher analytics dashboards
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** Per-quiz and per-class analytics from real records.
**Acceptance criteria:**
- [x] Charts derived from DB records only
- [x] No fabricated statistics

### ISSUE-28 — Implement offline IndexedDB storage and sync queue
**Labels:** `frontend` `offline` · **State: Done**
**Description:** Cache questions and queue submissions in `GMA_Offline_DB`.
**Acceptance criteria:**
- [x] Questions available offline
- [x] Queue replays on reconnect
- [x] Idempotent by hash

### ISSUE-29 — Responsive tablet layout and brand styling
**Labels:** `frontend` `ui/ux` · **State: Done**
**Description:** Manchester City-inspired palette; desktop + tablet layouts.
**Acceptance criteria:**
- [x] Responsive breakpoints
- [x] Consistent tokens
- [x] Accessible contrast on key actions

### ISSUE-30 — Printable quiz paper and answer key
**Labels:** `frontend` · **State: Done**
**Description:** Print views for quiz papers and teacher answer keys.
**Acceptance criteria:**
- [x] `/api/quizzes/:id/paper` and `/answer-key`
- [x] Print-friendly rendering

### ISSUE-31 — Write the security test suite (19 tests)
**Labels:** `testing` · **State: Done**
**Description:** Cover auth, RBAC, fail-closed behaviour, secret isolation.
**Acceptance criteria:**
- [x] 19 tests passing
- [x] Provider keys pinned empty where required

### ISSUE-32 — Write the adapter test suite (9 tests)
**Labels:** `testing` · **State: Done**
**Description:** Cover `databaseAdapter` mapping/behaviour.
**Acceptance criteria:**
- [x] 9 tests passing

### ISSUE-33 — Write the generation-and-export test suite (6 tests)
**Labels:** `testing` · **State: Done**
**Description:** Cover AI parsing and export logic.
**Acceptance criteria:**
- [x] 6 tests passing
- [x] Field-aliasing parsing covered

### ISSUE-34 — Write the offline-sync test suite (11 tests)
**Labels:** `testing` `offline` · **State: Done**
**Description:** Cover offline DB + sync queue behaviour.
**Acceptance criteria:**
- [x] 11 tests passing
- [x] Wired into `npm test`, which now runs all four suites (45 tests)

### ISSUE-35 — Add Vercel deployment configuration
**Labels:** `deployment` · **State: Done**
**Description:** SPA + serverless API on one domain.
**Acceptance criteria:**
- [x] `vercel.json` build/output/rewrite
- [x] Function memory + maxDuration
- [x] `api/index.ts` entry

### ISSUE-36 — Add pagination to list endpoints
**Labels:** `backend` `technical-debt` · **State: Backlog**
**Description:** List endpoints return all rows; add limit/offset or cursor pagination.
**Acceptance criteria:**
- [ ] Pagination params on `/api/quizzes`, `/api/learners`, `/api/submissions`
- [ ] Backwards-compatible defaults
- [ ] Documented in `docs/API.md`

### ISSUE-37 — Add a CI pipeline (lint + tests + build)
**Labels:** `technical-debt` `deployment` · **State: Done**
**Description:** Nothing verified a push or a pull request, so a reviewer had to take lint, tests and the build on trust.
**Acceptance criteria:**
- [x] GitHub Actions workflow (`.github/workflows/ci.yml`) running `npm run lint`, `npm test`, `npm run build`
- [x] All 45 tests execute in a single `npm test` — the offline-sync suite is now wired into it
- [x] Runs on push to `main` and on every pull request; no repository secrets required
- [x] Superseded runs on the same branch are cancelled
- [x] Git-history secret scan enforced (checkout uses `fetch-depth: 0`)
- [ ] Status check required on `main` (needs branch protection — owner)

### ISSUE-38 — Add code coverage reporting
**Labels:** `testing` `technical-debt` · **State: Done**
**Description:** No coverage tooling was configured, so no coverage figure could be reported.
**Acceptance criteria:**
- [x] Coverage provider added — `c8`, run via `npm run test:coverage`
- [x] Coverage reported in CI (printed into the job log on every push/PR)
- [x] Scope documented — `server.ts`, `server/`, `src/lib/`; the React UI is out of scope because there are no component tests
- [x] Result recorded: statements 30.8% / branches 42.4% / functions 52.1%
- [ ] Threshold agreed and enforced (deliberately not set yet — no baseline to regress against)

### ISSUE-39 — Persist per-question correctness on submission_answers
**Labels:** `backend` `database` `bug` · **State: Backlog**
**Description:** `is_correct` is `null` and `marks_awarded` is `0` for all answers.
**Acceptance criteria:**
- [ ] Correctness persisted per answer
- [ ] Marks persisted per answer
- [ ] Backfill strategy for existing rows (if required)

### ISSUE-40 — Reduce frontend bundle size
**Labels:** `frontend` `technical-debt` · **State: Done**
**Description:** The main JS chunk was 977 kB (gzip 269 kB) and tripped the >500 kB build warning. Recharts and the quiz wizard accounted for most of it, and neither is needed on most routes.
**Acceptance criteria:**
- [x] Route-level code splitting — every portal page behind `React.lazy` + Suspense in `src/app/router.tsx`
- [x] No chunk > 500 kB — entry chunk 984 kB → 352 kB (gzip 271 kB → 110 kB); largest remaining chunk is Recharts at 371 kB
- [x] Bundle budget documented — entry < 400 kB, no chunk > 500 kB (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) P-02)

### ISSUE-41 — Move lockout/rate-limit state to a shared store
**Labels:** `backend` `security` `technical-debt` · **State: Backlog**
**Description:** In-memory counters are per-instance on Vercel.
**Acceptance criteria:**
- [ ] Shared store (e.g. Upstash/Redis) or documented platform limit
- [ ] Behaviour consistent across instances

### ISSUE-42 — Capture application screenshots for the submission
**Labels:** `documentation` `ui/ux` · **State: Backlog**
**Description:** No screenshots exist in the repo.
**Acceptance criteria:**
- [ ] Screenshots for the 8 listed screens
- [ ] Stored in `docs/screenshots/`
- [ ] Referenced from README §15

### ISSUE-43 — Verify and record the live deployment URL
**Labels:** `deployment` `documentation` · **State: Done**
**Description:** The deployed SPA had no fallback rewrite, so every deep link 404'd, and the live bundle was a stale pre-code-splitting build.
**Acceptance criteria:**
- [x] Vercel deployment live — https://gma-quiz-offline-online-support.vercel.app
- [x] SPA fallback rewrite (`/(.*)` → `/index.html`) added after the `/api` rule; all routes return 200
- [x] `/api/health` verified — `supabaseConfigured: true`, `authMode: "supabase"`
- [x] Live entry chunk is the code-split build (352 kB, down from 984 kB)
- [x] URL recorded in README §13 and `docs/DEPLOYMENT_VERIFICATION.md`

### ISSUE-44 — Run a secret scan over Git history
**Labels:** `security` `technical-debt` · **State: Done**
**Description:** No secret scan had been performed; `gitleaks` is unavailable, so `scripts/secret-scan.mjs` was written instead.
**Acceptance criteria:**
- [x] Every blob in Git history walked and checked against 10 secret rules
- [x] No findings (`.env` is untracked); detector validated against a synthetic repo containing fake credentials
- [x] Result recorded in `docs/SECURITY.md` §7.1
- [x] Enforced in CI — the `Scan Git history for secrets` step fails the job on any finding

> **44 issues are listed above (ISSUE-01 … ISSUE-35 are completed work; ISSUE-36, ISSUE-39, ISSUE-41 and ISSUE-42 are outstanding; ISSUE-37, ISSUE-38, ISSUE-40, ISSUE-43 and ISSUE-44 document work completed since).** That is **44 draft issues**, comfortably above the 30 minimum, and every one corresponds to real work or a genuine gap.

---

## 3. Create the Project board (Projects → New project → Board)

Create a board named **"GMA Quiz System — Delivery"** with exactly these four columns:

| Column | What goes here |
|---|---|
| **Backlog** | ISSUE-36, ISSUE-39, ISSUE-41 and ISSUE-42 (outstanding) |
| **In Progress** | (currently empty — nothing is actively in progress) |
| **Review** | (currently empty — nothing is awaiting review) |
| **Done** | ISSUE-01 … ISSUE-35, ISSUE-37, ISSUE-38, ISSUE-40, ISSUE-43 and ISSUE-44 (completed work) |

> ⚠️ **Do not move unfinished work into Done.** Outstanding issues must stay in Backlog.

---

## 4. Enable branch protection (Settings → Branches → Add rule for `main`)

Enable:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale approvals when new commits are pushed
- [x] **Require status checks to pass before merging**
  - Search for and select the **`Lint, test and build`** job (workflow `CI`, from [.github/workflows/ci.yml](../.github/workflows/ci.yml)). It appears in the picker only after the workflow has run at least once on this repository.
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings**
- [x] **Restrict force pushes** (protect against accidental force push)
- [x] **Restrict deletions** (protect against branch deletion)

---

## 5. Establish real Pull Request + review evidence

To satisfy the Collaboration criterion **without fabricating anything**:

1. Recruit the **two other team members** and add them as collaborators (Settings → Collaborators).
2. For each outstanding or follow-up change, create a **feature branch** off `main`:
   ```bash
   git checkout -b feat/ci-pipeline-issue-37
   ```
3. Make a **real** change, commit, push, and open a PR using the template — reference the issue (`Closes #37`).
4. Have **a different team member** review and approve it. A developer must **not** approve their own PR.
5. Merge only after approval and green checks.

> **Why this matters:** the repository currently shows a single author and no reviews. That is a genuine gap against the 15% Collaboration weight and can only be closed by real people, not by automation.

---

## 6. Post-setup checklist

- [ ] ≥ 30 issues created with the labels above
- [ ] Board created with the 4 columns and issues organised
- [ ] Branch protection enabled on `main`
- [ ] PR template present (already committed at `.github/pull_request_template.md`)
- [ ] 3 collaborators added
- [ ] Each member has merged at least one PR touching **both** frontend and backend
- [ ] At least one PR shows an independent approval

---

*Related: [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) · [.github/pull_request_template.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/.github/pull_request_template.md) · [docs/ASSESSMENT_CRITERIA_AUDIT.md](ASSESSMENT_CRITERIA_AUDIT.md)*
