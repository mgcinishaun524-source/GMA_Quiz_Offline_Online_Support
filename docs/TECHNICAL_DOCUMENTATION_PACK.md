<div align="center">

<img width="120" alt="Growing Minds Academy logo" src="../../public/assets/Logo.png" />

# Technical Documentation Pack

## Growing Minds Academy — AI-Powered Quiz & Learning Analytics System

**Uncommon Full-Stack Development Challenge**

</div>

| Field | Value |
|---|---|
| **Project** | Growing Minds Academy — AI-Powered Quiz & Learning Analytics System |
| **Document** | Consolidated Technical Documentation Pack |
| **Version** | 1.0 |
| **Date** | 2026-11-05 |
| **Status** | Reflects the actual application as at commit `829fa6c` |
| **Repository** | `https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support` |

> ⚠️ **PDF not produced.** No verified PDF/Markdown-to-PDF toolchain is available in this environment, so a PDF version was **not** generated. This Markdown is the editable source; convert it externally (e.g. a Markdown-to-PDF tool or print-to-PDF) if a PDF is required.
> ⚠️ **Screenshots:** the repository contains **no application screenshots** yet. Placeholders are marked `[SCREENSHOT: …]` — capture them (ISSUE-42) and insert before submission.

---

## Table of Contents

1. [Software Requirements Specification (SRS)](#1-software-requirements-specification-srs)
2. [Software Architecture & System Design](#2-software-architecture--system-design)
3. [Testing & Quality Assurance Report](#3-testing--quality-assurance-report)
4. [User Manuals (Administrator, Teacher, Learner)](#4-user-manuals)
5. [Technical Deployment & Handover Document](#5-technical-deployment--handover-document)
6. [Appendices](#6-appendices)

---

# 1. Software Requirements Specification (SRS)

## 1.1 Purpose
Specify the functional and non-functional requirements of the Growing Minds Academy assessment platform, so that its behaviour can be understood, verified and maintained.

## 1.2 Scope
A web application for schools that supports AI-assisted quiz creation, online and offline quiz delivery, server-side grading, controlled results release, directory management and analytics. Out of scope: payment/finance, timetable management, parent portals, formal accreditation.

## 1.3 Definitions

| Term | Meaning |
|---|---|
| **Quiz** | A collection of questions with a status, assignments and a release policy |
| **Submission** | A learner's answers to a quiz, graded server-side |
| **Release** | The explicit act of making marks visible to learners |
| **Cohort / Class** | A grade group of learners |
| **Fail closed** | Refuse the request rather than fall back to insecure/mock behaviour |

## 1.4 Actors

| Actor | Description |
|---|---|
| **Administrator** | Manages the school directory, settings and school-wide analytics |
| **Teacher** | Creates, generates, assigns and closes quizzes; releases results |
| **Learner** | Takes assigned quizzes (online or offline) and views released results |

## 1.5 Functional Requirements

### 1.5.1 Authentication & authorisation
| ID | Requirement |
|---|---|
| FR-A1 | Staff authenticate via Supabase Auth (email or username). |
| FR-A2 | Learners authenticate with student number + PIN (bcrypt, cost 12). |
| FR-A3 | The system issues a signed session token on login. |
| FR-A4 | Every protected route enforces role (`admin`/`teacher`/`learner`). |

### 1.5.2 Administrator
| ID | Requirement |
|---|---|
| FR-D1 | Manage teachers, learners, classes and subjects (create/read/update/delete). |
| FR-D2 | Associate subjects with classes and classes/subjects with teachers. |
| FR-D3 | Configure school settings (academic year, term, pass mark, offline policy). |
| FR-D4 | View school-wide analytics. |

### 1.5.3 Teacher
| ID | Requirement |
|---|---|
| FR-T1 | Generate a quiz from a topic using AI (up to 200 questions). |
| FR-T2 | Create/edit quizzes and manage question content. |
| FR-T3 | Publish, assign (one or more classes), set a due date, close a quiz. |
| FR-T4 | Grade/review submissions and add per-learner feedback. |
| FR-T5 | Release results (manual or automatic policy). |
| FR-T6 | Export/print quiz papers and answer keys. |
| FR-T7 | View per-quiz and per-class analytics. |

### 1.5.4 Learner
| ID | Requirement |
|---|---|
| FR-L1 | Sign in and see only assigned quizzes. |
| FR-L2 | Take a quiz with autosave and progress. |
| FR-L3 | Take a quiz while offline using cached questions. |
| FR-L4 | Sync queued submissions on reconnect (idempotent). |
| FR-L5 | View marks only after release. |

### 1.5.5 System
| ID | Requirement |
|---|---|
| FR-S1 | Grade submissions on the server. |
| FR-S2 | Never expose the answer key to learners. |
| FR-S3 | Fail closed (HTTP 503) when the database is unavailable. |
| FR-S4 | Record audit events for lifecycle/admin actions. |

## 1.6 Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Security | Secrets only from environment; service-role never in the client. |
| NFR-2 | Security | RLS enabled on all tables. |
| NFR-3 | Reliability | Offline submission sync must be idempotent. |
| NFR-4 | Performance | AI generation of up to 200 items must complete despite serverless timeouts (chunked + browser-direct). |
| NFR-5 | Usability | Responsive, tablet-first, consistent branding. |
| NFR-6 | Maintainability | TypeScript throughout; centralised AI logic. |
| NFR-7 | Portability | Cross-platform npm scripts (`cross-env`). |

## 1.7 Constraints
- Node.js ≥ 20; single Vercel project (SPA + serverless API); Supabase PostgreSQL.
- No demo/mock data in production.

## 1.8 Assumptions
- Learners have a tablet with a modern browser.
- One school tenant per deployment (schema is multi-tenant-ready via `school_id`).

---

# 2. Software Architecture & System Design

## 2.1 High-level architecture

```
Browser SPA (React 19 + Vite)  ──fetch /api/*──►  Express API (server.ts, 36 routes)
        │                                                  │
        ├── IndexedDB (GMA_Offline_DB) + sync queue         ▼
        │                                        databaseAdapter (fail-closed)
        └── direct AI calls ──► Gemini / Groq               ▼
                                              Supabase PostgreSQL (14 tables, RLS)
```

Editable source: [docs/diagrams/architecture.mmd](../diagrams/architecture.mmd) · Data flow: [docs/diagrams/data-flow.mmd](../diagrams/data-flow.mmd).

## 2.2 Component responsibilities

| Component | Responsibility |
|---|---|
| `src/features/*` | Role-specific UI pages |
| `src/services/*` | Client API clients (`quiz-api`, `learner-api`, `directory-api`, `auth-service`) |
| `src/lib/ai-quiz-core.ts` | AI prompts, schemas, robust parsing |
| `src/lib/offline-db.ts` / `sync-queue.ts` | Offline storage + idempotent replay |
| `src/hooks/useServerSync.ts` | Role-aware live hydration |
| `server.ts` | REST routes, grading, lifecycle, AI key issuing |
| `server/auth.ts` | Token/PIN utilities, middleware, lockout, rate limiting |
| `server/db.ts` | Supabase clients (admin/auth), audit logging |
| `server/db/databaseAdapter.ts` | Single fail-closed data boundary |
| `supabase/migrations/*` | Schema + RLS |

## 2.3 Key design decisions

| Decision | Rationale |
|---|---|
| Server-side grading | Prevents client tampering; answer key never leaves the server. |
| `learner_active_quiz_questions` view | Removes `correct_answer`/`explanation` at the database layer. |
| Two Supabase clients | Avoids `signInWithPassword` downgrading the service-role client. |
| Browser-direct AI calls | Bypasses the 10 s serverless timeout; keys issued at runtime. |
| Idempotent sync (`client_submission_hash`) | Safe retries from flaky networks. |
| Fail-closed adapter | A failed save can never be reported as success. |

## 2.4 Data flow (summary)
1. Teacher generates questions (AI) → review → save quiz.
2. Publish → assign to classes → learners see it.
3. Learner answers → server grades on submit → submission persisted.
4. Teacher releases → `GET /api/learners/results` begins returning marks.

Full sequence diagrams: [docs/diagrams/quiz-lifecycle.mmd](../diagrams/quiz-lifecycle.mmd), [auth-flow.mmd](../diagrams/auth-flow.mmd), [offline-sync.mmd](../diagrams/offline-sync.mmd).

## 2.5 Deployment architecture
Vercel project serving the SPA from `dist/` and the Express `app` as a serverless function via `api/index.ts`; Supabase as managed PostgreSQL + Auth. See [docs/diagrams/deployment.mmd](../diagrams/deployment.mmd) and [docs/DEPLOYMENT_VERIFICATION.md](../DEPLOYMENT_VERIFICATION.md).

---

# 3. Testing & Quality Assurance Report

## 3.1 Automated test results (independently re-run, 2026-11-05)

| Suite | Tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| `test/security.test.ts` | 19 | 19 | 0 | 0 |
| `test/adapter.test.ts` | 9 | 9 | 0 | 0 |
| `test/generation-and-export.test.ts` | 6 | 6 | 0 | 0 |
| `test/offline-sync.test.ts` | 11 | 11 | 0 | 0 |
| **Total** | **45** | **45** | **0** | **0** |

- `npm test` runs the first three suites (34 tests); `offline-sync.test.ts` is run separately.
- **Lint:** `npm run lint` (`tsc --noEmit`) — clean.
- **Build:** `npm run build` — clean.
- **Coverage:** ⚠️ not available (no coverage tooling configured).

## 3.2 Test coverage by area

| Area | Covered by |
|---|---|
| Auth, RBAC, fail-closed, secret isolation | `security.test.ts` |
| Data-access adapter behaviour/mapping | `adapter.test.ts` |
| AI response parsing, export logic | `generation-and-export.test.ts` |
| Offline DB + sync queue | `offline-sync.test.ts` |

## 3.3 Manual / live verification performed previously
A prior live Supabase probe plus an in-process HTTP test of `GET /api/learners/results` confirmed that released marks flow through correctly (the 0% bug fix). Details: [TESTING_REPORT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/TESTING_REPORT.md).

## 3.4 Untested workflows (honest gaps)
- Multi-device offline→online sync (requires physical tablets).
- Full Supabase-Auth staff login round-trip in production.
- RLS policy behaviour observed at runtime.
- No CI pipeline runs the suite automatically.

> Unit tests do **not** prove live database or production integration.

---

# 4. User Manuals

## 4.1 Administrator Manual

1. **Sign in** at the app URL as `darksyntax` with the admin password.
2. **Dashboard** — live school metrics. `[SCREENSHOT: Admin dashboard]`
3. **Subjects** — create subjects (code + name). `[SCREENSHOT: Subjects]`
4. **Classes** — create cohorts (name, grade level, room, form teacher). `[SCREENSHOT: Classes]`
5. **Teachers** — add faculty (name, email, username) and assign classes/subjects. `[SCREENSHOT: Teachers]`
6. **Learners** — add learners (student number, name, grade, PIN); assign to a class. `[SCREENSHOT: Learners]`
7. **Settings** — academic year, term, pass mark, offline policy.
8. **Analytics** — school-wide performance.

> **Order matters:** create the school/classes/subjects before learners, due to foreign keys.

## 4.2 Teacher Manual

1. **Sign in** with your Supabase email/username.
2. **New Quiz (AI Wizard)** — choose subject/grade/topic, set the question count, generate. `[SCREENSHOT: AI wizard]`
3. **Review/edit** generated questions; save as a draft.
4. **Publish** the quiz, then **assign** it to one or more classes and set a due date.
5. **Take attendance of submissions** — view the submissions workspace; add per-learner feedback. `[SCREENSHOT: Submissions]`
6. **Close** the quiz when the window ends (`Close assessment`).
7. **Release results** when ready (or use automatic release).
8. **Export/print** the quiz paper or the answer key. `[SCREENSHOT: Answer key]`
9. **Analytics** — per-quiz and per-class performance. `[SCREENSHOT: Teacher analytics]`

## 4.3 Learner Manual

1. **Sign in** with your student number and PIN.
2. **My Quizzes** — see only quizzes assigned to your class. `[SCREENSHOT: Learner quizzes]`
3. **Take a quiz** — answer each question; progress saves automatically. `[SCREENSHOT: Quiz player]`
4. **Offline** — if the network drops, keep answering; your submission is queued and syncs automatically when you reconnect.
5. **Submit** — confirm; you'll see a submitted screen.
6. **My Results** — marks appear **only after your teacher releases them**. `[SCREENSHOT: My Results]`

---

# 5. Technical Deployment & Handover Document

## 5.1 Environments

| Environment | Purpose |
|---|---|
| Local | `npm run dev` (port 3000/3001) |
| Preview | Vercel preview deployment per PR |
| Production | Vercel production + Supabase |
| Test | `NODE_ENV=test` (in-process, no external services) |

## 5.2 Deployment procedure (summary)
1. Push `main` to GitHub.
2. Import to Vercel; set environment variables (see [README §8](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/README.md#8-required-environment-variables)).
3. Build runs `npm run build`; API served via `api/index.ts`.
4. Verify `/api/health`.
Full steps: [DEPLOYMENT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/DEPLOYMENT.md), [docs/DEPLOYMENT_VERIFICATION.md](../DEPLOYMENT_VERIFICATION.md).

## 5.3 Environment variables
See [README §8](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/README.md#8-required-environment-variables). Server-only vs `VITE_`-exposed is explicit; no secret values are documented anywhere.

## 5.4 Database
Schema, indexes, constraints, RLS and migration order: [docs/DATABASE.md](../DATABASE.md). Migrations are additive and re-runnable.

## 5.5 Operational runbook

| Task | Action |
|---|---|
| Rotate the admin password | Set `ADMIN_PASSWORD_RESET="true"` + new `INITIAL_ADMIN_PASSWORD`, restart once, then remove `ADMIN_PASSWORD_RESET`. |
| DB unavailable | Expect HTTP 503; check `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. |
| AI generation failing | Check `GEMINI_API_KEY` / `GROQ_API_KEY`; check provider status. |
| Learner can't log in | Check lockout (5 attempts → 15 min); verify PIN hash. |
| Emergency | Roll back the Vercel deployment to a previous build; DB migrations are additive (migration 2 includes rollback SQL). |

## 5.6 Handover checklist
- [ ] Repository access granted to all team members
- [ ] Vercel project access granted
- [ ] Supabase project access granted (owner + at least one other)
- [ ] Secrets stored in Vercel (not in Git)
- [ ] Admin credentials rotated away from any shared value
- [ ] This documentation pack reviewed and accepted

---

# 6. Appendices

## Appendix A — Known limitations
See [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md). Highlights: no pagination, no server-side caching, in-memory rate limiting, no coverage tooling, no CI, no screenshots, live URL unverified.

## Appendix B — Source file references

| Topic | File |
|---|---|
| API routes | [server.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server.ts) |
| Auth & middleware | [server/auth.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/auth.ts) |
| Supabase clients & audit | [server/db.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/db.ts) |
| Data adapter | [server/db/databaseAdapter.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/server/db/databaseAdapter.ts) |
| AI core | [src/lib/ai-quiz-core.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/src/lib/ai-quiz-core.ts) |
| Offline DB / sync | [src/lib/offline-db.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/src/lib/offline-db.ts), [src/lib/sync-queue.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/src/lib/sync-queue.ts) |
| Schema + RLS | [supabase/migrations/](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/supabase/migrations) |
| Deployment config | [vercel.json](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/vercel.json), [api/index.ts](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/api/index.ts) |

## Appendix C — Related documents

| Document | Link |
|---|---|
| Submission gap analysis | [docs/SUBMISSION_GAP_ANALYSIS.md](../SUBMISSION_GAP_ANALYSIS.md) |
| API reference | [docs/API.md](../API.md) |
| Database reference | [docs/DATABASE.md](../DATABASE.md) |
| Security | [docs/SECURITY.md](../SECURITY.md) |
| Developer setup | [docs/DEVELOPER_SETUP.md](../DEVELOPER_SETUP.md) |
| Known issues | [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) |
| Assessment audit | [docs/ASSESSMENT_CRITERIA_AUDIT.md](../ASSESSMENT_CRITERIA_AUDIT.md) |
| GitHub setup | [docs/GITHUB_SETUP_GUIDE.md](../GITHUB_SETUP_GUIDE.md) |
| Deployment verification | [docs/DEPLOYMENT_VERIFICATION.md](../DEPLOYMENT_VERIFICATION.md) |
| Presentation | [docs/presentation/FINAL_PROJECT_PRESENTATION.md](FINAL_PROJECT_PRESENTATION.md) |
| Diagram guide | [docs/DIAGRAM_CREATION_GUIDE.md](../DIAGRAM_CREATION_GUIDE.md) |

## Appendix D — Document control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-05 | Delivery audit | Initial consolidated pack |
