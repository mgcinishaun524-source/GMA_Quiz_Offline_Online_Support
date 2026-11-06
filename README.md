<div align="center">

<img width="150" alt="Growing Minds Academy logo" src="public/assets/Logo.png" />

# Growing Minds Academy — AI-Powered Quiz & Learning Analytics System

**An offline-first assessment platform for schools: teachers generate curriculum-aligned quizzes with AI, learners complete them on tablets (online or offline), and marks are graded server-side and released to a secure results portal.**

[![Tests](https://img.shields.io/badge/tests-45%20passing-brightgreen)](#12-testing)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#10-available-scripts)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue)]()
[![License](https://img.shields.io/badge/license-Academic-lightgrey)]()

</div>

---

## 1. Project Title and Description

**Growing Minds Academy** is a full-stack web application built for the Uncommon Full-Stack Development Challenge. It replaces paper-based classroom assessment with a digital workflow that:

- lets **teachers** generate quizzes using AI (Google Gemini with an automatic Groq fallback) aligned to a subject, grade and topic;
- lets **administrators** manage the school directory — teachers, learners, classes and subjects;
- lets **learners** take quizzes on a tablet, **including with no network connection**, and syncs their submission when connectivity returns;
- **grades responses on the server** and keeps marks hidden from learners until the teacher explicitly releases them;
- provides **analytics dashboards** derived from real database records only.

The system enforces a strict **fail-closed** security model: when the database is unavailable it returns HTTP 503 rather than silently falling back to mock data.

---

## 2. Problem Statement

Many schools — particularly those with limited connectivity — still rely on printed tests. This creates slow marking turnaround, no analytics, no offline capability, and no consistent control over when results are shared with learners. Existing online quiz tools assume constant internet access, expose answer keys to the client, or hide grading logic on the browser where it can be tampered with.

**Growing Minds Academy solves this by:**

1. Generating standards-aligned assessment content quickly with AI, reducing teacher workload.
2. Running entirely on a tablet in class even when the Wi-Fi drops (IndexedDB cache + queued sync).
3. Grading on the **server** so scores cannot be manipulated by a learner's device.
4. Gating results behind an explicit teacher release action, protecting assessment integrity.

---

## 3. Main Features

### Administrator
- Dashboard with live school-wide metrics.
- Manage **teachers**, **learners**, **classes (cohorts)** and **subjects**.
- Assign subjects to classes and classes/subjects to teachers.
- School settings (academic year, term, pass mark, offline quiz policy).
- Admin analytics across the school.

### Teacher
- **AI Quiz Wizard** — generate up to 200 questions from a topic; Gemini primary with automatic Groq fallback; top-up loop guarantees the requested count.
- Quiz lifecycle: **draft → published → in progress → closed → results released**.
- Assign quizzes to one or more classes; set a due date; optional automatic release.
- Submissions workspace with per-learner feedback.
- **Server-side grading** and explicit **release results** control.
- Print/export a printable quiz paper and a teacher answer key.
- Teacher analytics per quiz and per class.

### Learner
- Sign in with a **student number + PIN** (salted bcrypt, cost 12).
- See only their own assigned quizzes.
- Take quizzes with a clean player UI, autosave, and progress indication.
- **Offline mode** — questions cached in IndexedDB; submissions queued and replayed on reconnect (idempotent, deduplicated by `client_submission_hash`).
- Results portal that shows marks **only after** the teacher releases them.

### Platform-wide
- Dual authentication: staff via Supabase Auth (JWT); learners via a locally signed session token.
- Role-based access control on every protected API route.
- Fail-closed backend: HTTP 503 when Supabase is not configured.
- Honest empty states — no fabricated sample data is ever displayed.
- Responsive layout for desktop and tablet; Manchester City-inspired brand palette.
- Network simulator bar for demonstrating offline behaviour.

---

## 4. Technology Stack (actual versions)

| Layer | Technology | Version |
|---|---|---|
| UI framework | React | 19.0.1 |
| | React DOM | 19.0.1 |
| Routing | React Router DOM | 7.18.4 |
| Build tool | Vite | 8.3.0 |
| Language | TypeScript | 7.0.2 |
| Styling | Tailwind CSS | 4.3.3 |
| | @tailwindcss/vite | 4.3.3 |
| Icons | lucide-react | 0.546.0 |
| Animation | motion | 12.23.24 |
| Charts | Recharts | 3.10.1 |
| Backend runtime | Node.js (ESM) | ≥ 20 |
| Backend framework | Express | 4.21.2 |
| Database / Auth | @supabase/supabase-js | 2.118.0 |
| AI (primary) | @google/genai (Gemini) | 2.4.0 |
| AI (fallback) | groq-sdk | 1.6.0 |
| Password hashing | bcryptjs | 3.0.3 |
| Session tokens | jsonwebtoken | 9.0.3 |
| Config | dotenv | 17.2.3 |
| Server bundle | esbuild | 0.28.0 |
| Dev runner | tsx | 4.21.0 |
| Test/CI helper | cross-env | 7.0.3 |

Full list in [package.json](package.json).

---

## 5. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (React 19 + Vite)                    │
│  Feature pages (admin / teacher / learner)                          │
│  Services: quiz-api, learner-api, directory-api, auth-service       │
│  Offline: IndexedDB (GMA_Offline_DB) + sync-queue                   │
│  AI: browser-direct calls to Gemini/Groq using server-issued keys   │
└───────────────┬──────────────────────────────┬─────────────────────┘
                │ fetch /api/*                 │ direct (AI only)
                ▼                              ▼
┌──────────────────────────────┐   ┌───────────────────────────────┐
│   Express API (server.ts)    │   │  Gemini API  /  Groq API      │
│   36 REST endpoints          │   │  (browser → provider)         │
│   Dual auth · RBAC · limits  │   └───────────────────────────────┘
│   databaseAdapter (fail-closed)                                  │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL (14 tables, RLS)               │
│  schools · user_profiles · teachers · classes · subjects ·          │
│  teacher_assignments · learners · class_memberships · quizzes ·      │
│  questions · quiz_assignments · submissions · submission_answers ·  │
│  audit_events · (view) learner_active_quiz_questions                │
└────────────────────────────────────────────────────────────────────┘
```
*(Editable source: [docs/diagrams/architecture.mmd](docs/diagrams/architecture.mmd))*

**Deployment shape:** the frontend is a Vite SPA and the Express API runs as a **Vercel serverless function** ([api/index.ts](api/index.ts) re-exports the Express `app`; `vercel.json` rewrites `/api/:path*` → `/api/index`). There is **no separate always-on backend host** — the API is served from the same domain as the SPA.

**Key architectural decisions**
- **Server-side grading** — the answer key never reaches the learner's device; `questions.correct_answer` is stripped by the `learner_active_quiz_questions` view.
- **Browser-direct AI calls** — API keys are provisioned server-side via `/api/ai/client-config` to authenticated teachers, so long generations bypass the Vercel function timeout while keys are never hard-coded in the bundle.
- **Two Supabase clients** — `getSupabaseAdmin()` (service-role, data) and `getSupabaseAuth()` (auth) are deliberately separate so that `signInWithPassword` cannot downgrade the service-role client.
- **Idempotent sync** — each submission carries a `client_submission_hash` (UNIQUE) so replaying the offline queue cannot create duplicates.

More detail: [docs/diagrams/](docs/diagrams/), [docs/DATABASE.md](docs/DATABASE.md), [docs/API.md](docs/API.md).

---

## 6. Installation and Setup

### Prerequisites
- **Node.js ≥ 20** (see `engines` in `package.json`)
- **npm**
- A **Supabase** project (PostgreSQL + Auth)
- *(Optional)* A **Gemini** API key and/or a **Groq** API key for AI quiz generation
- **Windows users:** use `npm.cmd` / `npx.cmd` if your execution policy blocks `.ps1` scripts.

---

## 7. Clone, Install and Run

```bash
# 1. Clone
git clone https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support.git
cd GMA_Quiz_Offline_Online_Support

# 2. Install dependencies
npm install

# 3. Create your environment file from the template
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 4. Edit .env and fill in the values described in section 8

# 5. Start the development server (Vite SPA + Express API on one port)
npm run dev                   # http://localhost:3000
```

> If port 3000 is already in use the server automatically selects 3001.

---

## 8. Required Environment Variables

Copy [.env.example](.env.example) to `.env`. **Never commit `.env`** (it is gitignored). Values below are names/purposes only — no secrets.

**Server-only (must NOT be prefixed with `VITE_`):**

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key (backend only; bypasses RLS) |
| `SUPABASE_JWT_SECRET` | Yes (production) | Signs/verifies **learner** session tokens. Server **fails closed** if missing in production. |
| `INITIAL_ADMIN_PASSWORD` | Recommended | Bootstraps the `darksyntax` administrator (≥ 8 chars). Idempotent. |
| `INITIAL_ADMIN_EMAIL` | No | Overrides the admin email (default `darksyntax@gma.edu`) |
| `GEMINI_API_KEY` | No* | Primary AI provider |
| `GROQ_API_KEY` | No* | Fallback AI provider |
| `GEMINI_MODEL` | No | Override default model (`gemini-2.5-flash`) |
| `GROQ_MODEL` | No | Override default model (`openai/gpt-oss-20b`) |
| `VITE_APP_MODE` | Yes | `production` for real deployments |
| `ALLOW_DEMO_AUTH` | Yes | `false` — demo auth has been removed |
| `APP_URL` | No | Public base URL of the app |

\* At least **one** of `GEMINI_API_KEY` / `GROQ_API_KEY` must be set for AI generation; otherwise generation fails with an explicit error (it never substitutes fake questions).

**Client-exposed (inlined into the bundle at build time — the anon key is public by design):**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Public Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon/publishable key |

> **Security:** `VITE_` variables are embedded in the browser bundle. Never place a service-role key, JWT secret, or AI key behind a `VITE_` prefix.

---

## 9. Database Setup and Migration Instructions

The database is **Supabase PostgreSQL**. Apply the migrations **in filename order** via the Supabase SQL editor or the Supabase CLI:

| # | Migration | Adds |
|---|---|---|
| 1 | `supabase/migrations/20261020000001_initial_schema.sql` | 14 tables, 13 indexes, `learner_active_quiz_questions` view, RLS enablement, helper functions and policies |
| 2 | `supabase/migrations/20261022000001_add_due_date_and_cohort_fk.sql` | `quizzes.due_date`, `quizzes.class_id` (FK, SET NULL) + 2 indexes |
| 3 | `supabase/migrations/20261026000001_add_username_to_user_profiles.sql` | `user_profiles.username` + case-insensitive unique index |
| 4 | `supabase/migrations/20261027000001_add_directory_associations.sql` | `classes.subject_ids`, `teachers.assigned_class_ids`, `teachers.assigned_subject_ids` (UUID[]) + 3 GIN indexes |
| 5 | `supabase/migrations/20261027000002_fix_rls_policies.sql` | Missing admin INSERT/DELETE policies on `user_profiles` |

All migrations are **additive and safe to re-run** (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`). Migration 2 includes rollback SQL.

```bash
# Option A — Supabase SQL editor: paste each file in order and run.
# Option B — Supabase CLI:
supabase db push
```

After the schema is in place, set `INITIAL_ADMIN_PASSWORD` and start the server — the `darksyntax` administrator is provisioned **idempotently** on boot (existing accounts are never overwritten).

**Foreign-key note:** learner records require pre-existing `schools`, `subjects` and `classes` rows (FK constraints). Seed these through the admin console.

Full schema reference, indexes, constraints and RLS inventory: [docs/DATABASE.md](docs/DATABASE.md).

---

## 10. Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx server.ts` | Start the Express API + Vite dev server on port 3000 |
| `build` | `vite build && esbuild …` | Production build → `dist/` (SPA + `dist/server.js`) |
| `start` | `node dist/server.js` | Run the production server bundle |
| `preview` | `vite preview` | Preview the built SPA |
| `lint` | `tsc --noEmit` | Type-check the whole project |
| `test` | `cross-env NODE_ENV=test tsx …` | Run the security, adapter and AI/export suites (34 tests) |
| `clean` | `node -e "…fs.rmSync('dist'…)"` | Remove the `dist/` build output |

---

## 11. API Overview

The backend exposes **36 REST endpoints** under `/api`, grouped as:

| Domain | Examples |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/staff-login`, `POST /api/auth/learner-login`, `GET /api/auth/me` |
| Staff & Directory | `/api/staff`, `/api/teachers`, `/api/learners`, `/api/classes`, `/api/subjects` |
| Quizzes | `GET/POST/PUT/DELETE /api/quizzes`, `POST /api/quizzes/:id/{publish,close,assign,release-results}`, `GET /api/quizzes/:id/{paper,answer-key,submissions}` |
| Submissions | `POST /api/submissions`, `POST /api/submissions/sync`, `PUT /api/submissions/:id/feedback` |
| Learner Results | `GET /api/learners/results` (marks masked until release) |
| AI | `GET /api/ai/client-config`, `POST /api/ai/generate-quiz` |

**Authentication:** every route except health and the two login routes requires a bearer token. Staff use Supabase-issued JWTs; learners use locally signed session tokens. Role checks (`admin` / `teacher` / `learner`) are enforced per route.

Complete request/response reference, error envelope and auth model: [docs/API.md](docs/API.md).
Postman collection: [docs/api/growing-minds-api.postman_collection.json](docs/api/growing-minds-api.postman_collection.json).

---

## 12. Testing

```bash
npm run lint     # TypeScript type-check (tsc --noEmit) — clean
npm test         # 34 tests: security (19), adapter (9), generation & export (6)
npx tsx test/offline-sync.test.ts   # + 11 offline-sync tests
npm run build    # production build verification
```

**Independently re-run results (2026-11-05):**

| Suite | Tests | Status |
|---|---:|---|
| `test/security.test.ts` | 19 | ✅ pass |
| `test/adapter.test.ts` | 9 | ✅ pass |
| `test/generation-and-export.test.ts` | 6 | ✅ pass |
| `test/offline-sync.test.ts` | 11 | ✅ pass |
| **Total** | **45** | **45 passed · 0 failed · 0 skipped** |

- `npm test` runs the first three suites (34 tests); `offline-sync.test.ts` is run separately.
- ✅ Lint clean · ✅ Production build clean.
- ⚠️ **No coverage tooling is configured**, so no coverage percentage is reported.
- ⚠️ Unit tests do **not** prove live database or production integration; live end-to-end checks are described in [TESTING_REPORT.md](TESTING_REPORT.md).
- ⚠️ **Untested critical workflows:** true multi-device offline→online sync (requires physical tablets) and the full Supabase-Auth staff login round-trip in production.

---

## 13. Deployment Information

**Frontend + backend:** Vercel (single project — SPA + serverless API). **Database/Auth:** Supabase.

| | |
|---|---|
| **Live app** | https://gma-quiz-offline-online-support.vercel.app |
| **Health check** | https://gma-quiz-offline-online-support.vercel.app/api/health |

- Build: `npm run build`; Output: `dist/`; API rewrite: `/api/:path*` → `/api/index`; SPA fallback: `/(.*)` → `/index.html` ([vercel.json](vercel.json)). The SPA fallback must stay **after** the API rewrite.
- Required Vercel environment variables: see section 8 (mark the non-`VITE_` secrets for Production + Preview).
- Verified 2026-11-06: `/`, `/login`, `/teacher/dashboard`, `/learner/dashboard`, `/admin/dashboard` all return 200, and `/api/health` returns `{"supabaseConfigured":true,"geminiConfigured":true,"aiConfigured":true,"authMode":"supabase"}`.

> ⚠️ **Authenticated production flows are not yet verified** — the staff login round-trip, the learner flow and browser-console cleanliness still need the owner's credentials. Full record: [docs/DEPLOYMENT_VERIFICATION.md](docs/DEPLOYMENT_VERIFICATION.md).

---

## 14. Team Members and Contributions

> ⚠️ **REQUIRES HUMAN ACTION — intentionally not fabricated.**
>
> The Git history currently shows a **single author identity** and **no pull requests or peer reviews**. The Uncommon brief requires a **team of three**, each contributing to both frontend and backend. The real names and their contributions must be supplied by the team.

| Member | Role | Frontend contribution | Backend contribution |
|---|---|---|---|
| *(to be supplied)* | — | — | — |
| *(to be supplied)* | — | — | — |
| *(to be supplied)* | — | — | — |

Replace this table with the real team roster before submission. See [docs/GITHUB_SETUP_GUIDE.md](docs/GITHUB_SETUP_GUIDE.md) for how to establish the corresponding GitHub evidence (issues, branches, PRs, reviews).

---

## 15. Screenshots and Demo References

> ⚠️ **No application screenshots currently exist in the repository.** The only image asset is the school logo ([public/assets/Logo.png](public/assets/Logo.png)). Placeholder imagery has deliberately **not** been inserted.

Capture and add screenshots of the following before submission:

1. Login screen
2. Administrator dashboard + directory management
3. Teacher dashboard + AI Quiz Wizard
4. Quiz lifecycle detail (publish / assign / close / release)
5. Learner quiz player
6. Learner results portal
7. Offline / network-simulator state and sync queue
8. Teacher analytics

Recommended location: `docs/screenshots/`.

---

## Documentation Index

| Document | Purpose |
|---|---|
| [docs/FINAL_SUBMISSION_CHECKLIST.md](docs/FINAL_SUBMISSION_CHECKLIST.md) | Requirement-by-requirement submission status |
| [docs/SUBMISSION_GAP_ANALYSIS.md](docs/SUBMISSION_GAP_ANALYSIS.md) | Requirement-by-requirement audit |
| [docs/ASSESSMENT_CRITERIA_AUDIT.md](docs/ASSESSMENT_CRITERIA_AUDIT.md) | Audit against the 5 weighted assessment areas |
| [docs/API.md](docs/API.md) | Full REST API reference (36 endpoints) |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, indexes, constraints, RLS |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and limitations |
| [docs/DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md) | Local setup guide |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Known issues and limitations |
| [docs/TECHNICAL_DOCUMENTATION_PACK.md](docs/TECHNICAL_DOCUMENTATION_PACK.md) | Consolidated SRS / architecture / QA / manuals / handover |
| [docs/DEPLOYMENT_VERIFICATION.md](docs/DEPLOYMENT_VERIFICATION.md) | Deployment verification status + steps |
| [docs/GITHUB_SETUP_GUIDE.md](docs/GITHUB_SETUP_GUIDE.md) | Issues, board, branch protection, PR workflow |
| [docs/OPTIONAL_DELIVERABLES_ASSESSMENT.md](docs/OPTIONAL_DELIVERABLES_ASSESSMENT.md) | Postman / ERD / Storybook / tests / Docker assessment |
| [docs/DIAGRAM_CREATION_GUIDE.md](docs/DIAGRAM_CREATION_GUIDE.md) | Specifications for all diagrams |
| [docs/diagrams/](docs/diagrams/) | Mermaid diagram sources + ERD |
| [docs/presentation/FINAL_PROJECT_PRESENTATION.md](docs/presentation/FINAL_PROJECT_PRESENTATION.md) | Slide-by-slide final presentation |
| [docs/api/growing-minds-api.postman_collection.json](docs/api/growing-minds-api.postman_collection.json) | Postman collection |
| [CHANGELOG.md](CHANGELOG.md) | Release history derived from Git |
| [DEPLOYMENT.md](DEPLOYMENT.md) | GitHub + Vercel deployment guide |
| [TESTING_REPORT.md](TESTING_REPORT.md) | Honest test + live-verification report |
| [EXPORT_READINESS.md](EXPORT_READINESS.md) | Audit + verification status |
| [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) | Demo-removal / fail-closed migration report |

---

<div align="center">
<sub>Built for the Uncommon Full-Stack Development Challenge.</sub>
</div>
