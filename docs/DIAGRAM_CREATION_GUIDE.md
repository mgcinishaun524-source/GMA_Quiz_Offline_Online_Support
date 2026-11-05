# Diagram Creation Guide — Growing Minds Academy AI Quiz System

This guide is a **specification** for every diagram the project needs. It is
written so a human (or a diagramming tool) can reproduce each diagram
*accurately* from the real code and schema. **No image files are generated here
and none should be rendered from this guide automatically** — treat the
component lists, relationships, arrow labels, and Mermaid sources below as the
authoritative spec.

Ready-to-paste Mermaid sources live alongside this file in `docs/diagrams/`:

| Diagram | Mermaid source |
|---|---|
| System architecture | `docs/diagrams/architecture.mmd` |
| Data flow | `docs/diagrams/data-flow.mmd` |
| Quiz / submission lifecycle | `docs/diagrams/quiz-lifecycle.mmd` |
| Authentication & authorisation | `docs/diagrams/auth-flow.mmd` |
| Offline synchronisation | `docs/diagrams/offline-sync.mmd` |
| Deployment architecture | `docs/diagrams/deployment.mmd` |
| Database ER | `docs/diagrams/database-er.md` |

---

## 0. Ground rules (apply to every diagram)

- Every node must map to a **real file, route, table, or external service** in
  the repository. Do not invent components.
- Use the following consistent shape/colour conventions so the diagrams read the
  same across the set (optional but recommended):
  - Rectangles = processes / code modules.
  - Cylinders = data stores (PostgreSQL, IndexedDB).
  - Rounded/stadium = external services (Supabase Auth, Gemini, Groq).
  - Subgraphs/boxes = trust or deployment boundaries (Browser, Vercel, Supabase, Google/Groq).
- Label arrows with the concrete mechanism (HTTP method + path, function name, or
  DB column) — never a vague "data".
- State the trust boundary: the **browser uses the anon key (RLS enforced)**; the
  **server uses the service-role key (RLS bypassed)**.

---

## 1. System Architecture Diagram

**Purpose:** show the major runtime components of the SPA, the serverless
backend, the database, and the AI providers, and how they are wired.

### Components / entities

| Node | Represents | Real file |
|---|---|---|
| Browser SPA | React 19 + Vite single-page app | `src/main.tsx`, `src/App.tsx` |
| Router / Pages | role-based routes (admin/teacher/learner) | `src/app/router.tsx`, `src/features/**` |
| AuthContext + authService | client session state & login calls | `src/app/AuthContext.tsx`, `src/services/auth-service.ts` |
| AI Service | browser-direct Gemini/Groq chunked generation | `src/lib/ai-service.ts`, `src/lib/ai-quiz-core.ts` |
| Network Manager | online/offline detection | `src/lib/network.ts` |
| Sync Queue | retry + idempotent offline submission sync | `src/lib/sync-queue.ts` |
| IndexedDB `GMA_Offline_DB` | offline stores | `src/lib/offline-db.ts` |
| appDataStore | in-memory browser data cache | `src/services/storage.ts` |
| Service Worker | offline asset cache | `public/sw.js` |
| Vercel rewrite | `/api/:path*` → `/api/index` | `vercel.json` |
| Serverless function | Node handler exporting Express app | `api/index.ts` |
| Express backend | REST API + middleware | `server.ts` |
| Auth middleware | JWT/Supabase verification | `server/auth.ts` |
| DatabaseAdapter | row ⇄ model mapping, persistence | `server/db/databaseAdapter.ts` |
| Supabase admin client | service-role client | `server/db.ts` |
| PostgreSQL | 14 tables + view, RLS | `supabase/migrations/*` |
| Supabase Auth | `auth.users` | Supabase managed |
| Gemini API | primary AI provider | `@google/genai` |
| Groq API | fallback AI provider | `groq-sdk` |

### Relationships / arrows and labels

- Browser SPA → Router (renders pages).
- Router/AuthContext → authService → `POST /api/auth/staff-login|learner-login`.
- All `fetch('/api/...')` calls → Vercel rewrite → serverless function →
  Express routes.
- Express → auth middleware (`requireAuth`, `requireRole`) → route handler → DatabaseAdapter → Supabase admin client → PostgreSQL.
- Supabase admin client → Supabase Auth (`signInWithPassword`, `getUser`) — **separate client** so signing in never downgrades the data client (`server/db.ts` comment).
- Browser AI Service → `GET /api/ai/client-config` (authenticated) to obtain provider keys, then **directly** → Gemini (primary) / Groq (fallback).
- Express → `/api/ai/generate-quiz` server-side fallback → Gemini → Groq.
- Sync Queue → `POST /api/submissions/sync`.
- IndexedDB ⇄ Sync Queue and ⇄ pages (offline reads/writes).
- Service Worker → browser asset cache (dashed, optional).

### Files / structures to reference
`src/app/router.tsx`, `src/services/auth-service.ts`, `src/lib/ai-service.ts`,
`src/lib/offline-db.ts`, `src/lib/sync-queue.ts`, `src/lib/network.ts`,
`src/lib/supabase.ts`, `server.ts`, `server/auth.ts`, `server/db.ts`,
`server/db/databaseAdapter.ts`, `api/index.ts`, `vercel.json`.

**Mermaid source:** `docs/diagrams/architecture.mmd`.

---

## 2. Database ER Diagram

**Purpose:** document all 14 tables, their primary/foreign keys, and cardinality.

**Reference the file directly:** `docs/diagrams/database-er.md` (contains the
complete Mermaid `erDiagram` plus a relationship summary table). Full column
types, CHECK constraints, defaults, indexes, the `learner_active_quiz_questions`
view, and RLS policies are documented in `docs/DATABASE.md`.

### Key points to preserve if you redraw it
- 14 tables: `schools`, `user_profiles`, `teachers`, `classes`, `subjects`,
  `teacher_assignments`, `learners`, `class_memberships`, `quizzes`,
  `quiz_assignments`, `questions`, `submissions`, `submission_answers`,
  `audit_events`.
- `user_profiles.id` → `auth.users(id)` (external).
- `teachers.id` → `user_profiles(id)` is **1:1**.
- `classes.form_teacher_id` and `quizzes.class_id` are **nullable** (0..1).
- Junction tables with composite UNIQUE keys: `teacher_assignments`,
  `class_memberships`, `quiz_assignments`.
- ON DELETE behaviour: CASCADE (most children), RESTRICT
  (`user_profiles.school_id`, `teachers.school_id`, `quizzes.subject_id`,
  `quizzes.author_id`), SET NULL (`classes.form_teacher_id`,
  `quizzes.class_id`).
- Unique business keys: `schools.code`, `user_profiles.email`,
  `learners.student_number`, `submissions.client_submission_hash`,
  `submission_answers (submission_id, question_id)`, plus the composite ones.

---

## 3. Data Flow Diagram (request + offline paths)

**Purpose:** show the request lifecycle for online calls and the offline
store-and-forward path.

### Online path (entity order)
`Browser SPA (fetch + Bearer token)` → `Vercel rewrite /api/:path* → /api/index`
→ `Express server.ts (route + requireAuth/requireRole)` →
`databaseAdapter (row ⇄ model)` → `Supabase PostgreSQL (RLS or service role)` →
response unwinds back to the SPA.

### Offline path (entity order)
`LearnerQuizPlayer` → `getCachedQuizById()` (`cached_quizzes`) →
`saveActiveAnswers()` (`active_answers`) → on submit
`queueOfflineSubmission()` (`submission_queue`) → `networkManager.isOnline()` →
`SyncQueueService.processQueue()` → `POST /api/submissions/sync` →
`Express /api/submissions/sync (idempotent by client_submission_hash, server-side
marking)` → `Supabase PostgreSQL` → server-authoritative submission returned →
`updateQueueItemStatus('synced')` + `removeQueueItem()` +
`appDataStore.saveSubmission()`.

### Arrows and labels
- Label online arrows with the HTTP verb + path; label the DB hop with
  "service-role key (bypasses RLS)".
- Label offline arrows with the exact function names in `src/lib/offline-db.ts`
  and `src/lib/sync-queue.ts`.
- Show the two sync triggers: network reconnect event and the **25-second poll**.
- Show that marks are withheld from the learner until results release.

### Files / structures to reference
`src/lib/offline-db.ts`, `src/lib/sync-queue.ts`, `src/lib/network.ts`,
`server.ts` (`/api/submissions`, `/api/submissions/sync`),
`server/db/databaseAdapter.ts` (`saveSubmission`, `getSubmissionByHash`),
`submissions.client_submission_hash`.

**Mermaid source:** `docs/diagrams/data-flow.mmd`.

---

## 4. Application Workflow Diagram (Quiz Lifecycle)

**Purpose:** show the quiz status lifecycle and the submit / mark / release
sequence.

### Quiz status states (from the CHECK constraint in M1)
`draft` → `published` / `in_progress` → `closed` → `results_released`.

### Transitions (from `server.ts`)
| From | To | Trigger |
|---|---|---|
| — | `draft` | teacher/admin creates a quiz |
| `draft` | `in_progress` | `POST /api/quizzes/:id/publish` (validates cohort + questions; **the endpoint sets `in_progress`**) |
| `draft`/other | `published` | persisted state allowed by the CHECK constraint |
| `published`/`in_progress` | `closed` | `POST /api/quizzes/:id/close` |
| `closed`/`in_progress` | `results_released` | `POST /api/quizzes/:id/release-results` (also marks all submissions `marked`) |

### Submission status flow (from `submissions.status` CHECK + submit endpoints)
- Submit with `release_policy = manual` → `submitted`.
- Submit with `release_policy = automatic` (or quiz already `results_released`)
  → `marked` immediately.
- Offline attempt: `saved_offline` / `pending_sync` → `synced` after
  `/api/submissions/sync`.
- On release, all submissions for the quiz become `marked`.

### Important accuracy notes
- `draft` and `closed` reject new submissions (`/api/submissions`).
- Marking is **server-side** against `questions.correct_answer`; client scores are
  never trusted.
- `saveSubmission()` is **monotonic** — retries never revert `marked` to
  `submitted`, never wipe teacher feedback, never revert an adjusted score.

**Mermaid source:** `docs/diagrams/quiz-lifecycle.mmd`.

---

## 5. Authentication & Authorisation Flow

**Purpose:** contrast the two login paths and show how tokens are validated on
every request.

### Staff path (Supabase Auth)
`POST /api/auth/staff-login` → IP rate limit (20/60 s) → account lockout check
(5 fails → 15 min) → if the identifier has no `@`, resolve
`user_profiles.username → email` → Supabase Auth `signInWithPassword()` on the
**dedicated auth client** → fetch `user_profiles` (`role`, `school_id`) → return
the Supabase `access_token` (7-day expiry). Audit events:
`AUTH_STAFF_LOGIN` / `AUTH_STAFF_FAILED` / `AUTH_STAFF_LOCKED`.

### Learner path (bcrypt PIN → local JWT)
`POST /api/auth/learner-login` → IP rate limit (10/60 s) → PIN must match
`/^\d{4}$/` → lockout check (in-memory map **and** `learners.pin_locked_until`)
→ lookup `learners` + `class_memberships` → `bcrypt.compare(PIN, pin_hash)` →
on success clear lockout, reset `pin_failed_attempts`, set `last_active`
→ `generateLearnerToken()` signs a **locally issued JWT** (`SUPABASE_JWT_SECRET`,
12-hour expiry). Audit events: `AUTH_LEARNER_LOGIN` / `AUTH_PIN_FAILED` /
`AUTH_PIN_LOCKED`.

### Token verification on every request (`server/auth.ts` `requireAuth`)
1. `verifyLearnerToken()` (local JWT, role=learner) → `req.user`.
2. Else Supabase `auth.getUser(token)` → load `user_profiles`
   (`role`, `school_id`); for teachers also load `teacher_assignments`
   (`class_id`, `subject_id`) and `classes` where they are `form_teacher_id`.
   **Fail closed** if no recognized staff profile.
3. Else `verifyStaffToken()` (fallback/test).
4. Else `401`.
Then `requireRole([...])` enforces per-route role; failures → `403`.

### Storage & guards
`authService` stores the user in `localStorage` (`GMA_AUTH_SESSION`,
`GMA_AUTH_TOKEN`). `src/app/router.tsx` `ProtectedRoute` gates pages by role.

### Files / structures to reference
`server.ts` (`/api/auth/staff-login`, `/api/auth/learner-login`, `/api/auth/me`),
`server/auth.ts` (`requireAuth`, `requireRole`, `hashPin`, `verifyPin`,
`checkLockout`, `recordFailedAttempt`, `generate*Token`), `src/services/auth-service.ts`,
`src/app/AuthContext.tsx`, `src/app/router.tsx`, `learners.pin_hash`,
`user_profiles.role`.

**Mermaid source:** `docs/diagrams/auth-flow.mmd`.

---

## 6. Offline Synchronisation Workflow

**Purpose:** show how a cached quiz is taken offline and how the queued
submission is replayed exactly once.

### Steps
1. `getCachedQuizById()` reads `cached_quizzes` in `GMA_Offline_DB`.
2. Answers are persisted continuously via `saveActiveAnswers()` →
   `active_answers` (localStorage fallback `GMA_DRAFT_<quiz>_<learner>`).
3. On submit, a `Submission` is built with `clientSubmissionHash` (idempotency
   key) and queued via `queueOfflineSubmission()` → `submission_queue`
   (`status='pending'`, `retryCount=0`).
4. Sync is triggered by a network reconnect event (`networkManager.subscribe`) and
   a **25-second poll** (`SyncQueueService` constructor).
5. `processQueue()` marks each item `syncing`, then `POST /api/submissions/sync`
   with `Authorization: Bearer <token>`.
6. Server per-item outcomes: duplicate hash → `synced`/`isDuplicate`; validation
   failure (missing quiz, draft, expired deadline, impersonation, wrong class,
   attempt limit exceeded) → `rejected`; accepted → server-side marking, INSERT
   `submissions` (idempotent via `client_submission_hash` UNIQUE), upsert
   `submission_answers`.
7. Client marks `synced`, removes the item from the queue, and mirrors the
   server-authoritative submission via `appDataStore.saveSubmission()`.
8. Failed items are marked `failed` (`retryCount++`) and retried next cycle.

### Files / structures to reference
`src/lib/offline-db.ts`, `src/lib/sync-queue.ts`, `src/lib/network.ts`,
`src/hooks/useServerSync.ts`, `src/components/feedback/NetworkSimulatorBar.tsx`,
`server.ts` (`POST /api/submissions/sync`), `submissions.client_submission_hash`,
`submissions.sync_status`, `submissions.status`.

**Mermaid source:** `docs/diagrams/offline-sync.mmd`.

---

## 7. Deployment Architecture Diagram

**Purpose:** show the Vercel + Supabase topology, the SPA/serverless split, and
where AI is called from.

### Components
- **Vercel project**: static SPA (`dist/` from `vite build`) + one Node
  serverless function (`api/index.ts`, 1024 MB, 30 s max) + the rewrite
  `/api/:path*` → `/api/index`.
- **Supabase**: managed PostgreSQL (`public` schema, 14 tables, RLS) and
  Supabase Auth (`auth.users`).
- **AI providers**: Gemini (primary) and Groq (fallback), called **browser-direct**
  by teachers after fetching keys from `/api/ai/client-config`; server-side
  `/api/ai/generate-quiz` exists as a fallback.
- **Environment variables**: server-only (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`,
  `GROQ_API_KEY`, `INITIAL_ADMIN_PASSWORD`) vs build-time Vite vars
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### Arrows and labels
- Users → HTTPS → static SPA (page routes) and → Vercel rewrite (`/api/*`).
- Rewrite → serverless function → Supabase (label: service-role, bypasses RLS).
- SPA → `/api/ai/client-config` (authenticated) → provider keys → direct
  Gemini/Groq calls (label: chunked < 30 s per chunk).
- Env vars feed both the function (runtime) and the static bundle (VITE_ vars
  inlined at build).

### Files / structures to reference
`vercel.json`, `package.json` (build script: `vite build` then `esbuild`
server bundle), `api/index.ts`, `server.ts` (`VERCEL !== '1'` guard, static
serving), `DEPLOYMENT.md`, `.env.example`.

**Mermaid source:** `docs/diagrams/deployment.mmd`.

---

## Rendering note

To turn any `.mmd` file into an image, paste its contents into a Mermaid-capable
renderer (e.g. mermaid.live, the VS Code Mermaid preview, or a docs platform that
supports Mermaid), or reuse the fenced ```mermaid blocks from
`docs/diagrams/database-er.md`. This guide intentionally ships only the **sources
and specifications**, not generated images.
