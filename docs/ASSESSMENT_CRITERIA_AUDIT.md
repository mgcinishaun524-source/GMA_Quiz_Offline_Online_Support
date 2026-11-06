# Assessment Criteria Audit

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

Audit of the application against the five weighted Uncommon assessment areas. Each area lists what was inspected, the evidence found, an honest self-assessment, and — critically — the **evidence gaps that require human action**.

Status vocabulary: **STRONG** · **ADEQUATE** · **WEAK** · **MISSING / REQUIRES HUMAN ACTION**.

---

## 1. Functionality — 40%

### Evidence found

| Required workflow | Implemented? | Evidence |
|---|---|---|
| Administrator workflows | ✅ | 6 admin pages: `AdminDashboard`, `AdminTeachersPage`, `AdminLearnersPage`, `AdminClassesPage`, `AdminSubjectsPage`, `AdminSettingsPage`, `AdminAnalyticsPage` |
| Teacher workflows | ✅ | `TeacherDashboard`, `TeacherQuizzesPage`, `NewQuizPage` (AI Wizard), `TeacherQuizDetailPage`, `TeacherSubmissionsPage`, `TeacherResultsPage`, `TeacherClassesPage`, `TeacherAnalyticsPage` |
| Learner workflows | ✅ | `LearnerDashboard`, `LearnerQuizzesPage`, `LearnerQuizPlayer`, `LearnerSubmittedPage`, `LearnerResultsPage` |
| Quiz generation | ✅ | `src/lib/ai-quiz-core.ts` + `ai-service.ts`; Gemini primary, Groq fallback; top-up loop; up to 200 items |
| Quiz creation and publishing | ✅ | `POST /api/quizzes`, `PUT /api/quizzes/:id`, `POST /api/quizzes/:id/publish` |
| Quiz taking | ✅ | Learner player with autosave |
| Server-side grading | ✅ | Graded in `server.ts`; aggregate stored on the submission |
| Results release | ✅ | `POST /api/quizzes/:id/release-results`; masked until release in `GET /api/learners/results` |
| Analytics | ✅ | Teacher + admin analytics from real records (Recharts) |
| Offline assessment | ✅ | `src/lib/offline-db.ts` (`GMA_Offline_DB`) caches questions |
| Synchronisation | ✅ | `src/lib/sync-queue.ts` + `POST /api/submissions/sync`; idempotent via `client_submission_hash` |
| Error and empty states | ✅ | Honest empty states; 503 fail-closed; AI errors surfaced (no fabricated questions) |

### Self-assessment: **STRONG (code) / ADEQUATE (live evidence)**

All twelve required workflows are implemented in code. Independent tests (45/45) support correctness, and the application is now **live** — every route resolves and `/api/health` reports Supabase, Gemini and Groq configured ([docs/DEPLOYMENT_VERIFICATION.md](DEPLOYMENT_VERIFICATION.md) §4). The remaining live gap is that the **authenticated** flows have not been walked end-to-end with real credentials, so they are documented rather than demonstrated.

### Evidence gaps (require human action)
- 🟠 **Authenticated live walkthrough** (staff login → assign → learner submit → release results) still needs the owner's credentials.
- 🟠 **Screenshots/recordings** of each workflow (ISSUE-42).
- 🟠 **Multi-device offline→online sync** unproven without physical tablets.
- 🟡 Legacy quizzes closed before the close-endpoint fix remain `published` (F-02).

---

## 2. Code Quality — 20%

### Evidence found

| Criterion | Finding |
|---|---|
| Code organisation | Feature-folder structure (`src/features/{admin,teacher,learner,auth}`, `src/components/{ui,layout,feedback}`, `src/lib`, `src/services`, `src/types`) |
| Reusable components | Shared UI kit: `Buttons`, `FormControls`, `DataTable`, `PageHeader`, `StatusLabel`, `ConfirmDialog` |
| TypeScript usage | TypeScript throughout; shared models in `src/types/`; `npm run lint` (`tsc --noEmit`) clean |
| Naming conventions | Consistent camelCase functions, PascalCase components, `kebab-case` files |
| Error handling | Global Express error handler; fail-closed guards; AI error surfacing; honest empty states |
| Separation of concerns | Routes → `databaseAdapter` → Supabase; AI logic centralised in `ai-quiz-core.ts`; services layer in `src/services` |
| Dependency health | Modern, current versions (React 19, Vite 8, TS 7); no known unnecessary deps added |
| Duplication | Low; AI prompts/parsing centralised to avoid duplication |
| Maintainability | `server.ts` is large (~3,220 lines, 36 routes) — a single-file API is the main maintainability smell |

### Self-assessment: **STRONG**

Clear structure, strict typing, a shared AI core, and a real service/adapter separation. The one notable weakness is the monolithic `server.ts`.

### Evidence gaps
- 🟡 `server.ts` size — no refactor performed (rule 9: no broad refactors without a verified blocker).
- ✅ ~~No CI enforcing lint/build on PRs~~ — now enforced by [.github/workflows/ci.yml](../.github/workflows/ci.yml): lint, all 45 tests and the production build run on every push and PR. Marking the check *required* on `main` still needs branch protection (owner).

---

## 3. UI/UX Design — 15%

### Evidence found

| Criterion | Finding |
|---|---|
| Responsive layouts | Tailwind breakpoints; two-row header; tablet-oriented |
| Navigation | Role-aware `AppShell` with active-state nav |
| Consistency | Shared component kit + design tokens; glassmorphism role badge with role icons |
| Accessibility | Semantic buttons/labels, focus styles via component kit; **no formal a11y audit performed** |
| Form usability | `FormControls` with labels, validation messaging |
| Loading states | Present across pages; connection bar; network simulator |
| Error feedback | Inline errors; honest empty states; 503 messaging |
| Tablet and mobile usability | Tablet-first; mobile supported via responsive layout |
| Brand consistency | Manchester City-inspired palette (sky blue `#6CABDD`, navy `#1C2C5B`, `#F5F8FC`/`#E8F3FC`); Logo in header/login |

### Self-assessment: **ADEQUATE (code) / WEAK (evidence)**

The implementation looks polished and consistent, and a deliberate redesign removed "AI status indicator" styling in favour of descriptive role icons. But **without screenshots or a live URL, a reviewer cannot see any of it** — and this is a 15% category that is entirely visual.

### Evidence gaps (require human action)
- 🔴 **Screenshots** of every screen (ISSUE-42) — the single highest-leverage gap in this category.
- 🟠 No formal accessibility audit (contrast, keyboard traps, screen-reader flow).

---

## 4. Collaboration — 15% — ⚠️ **REQUIRES HUMAN ACTION**

### Evidence found (this is the honest problem area)

| Criterion | Finding |
|---|---|
| Contributions by each team member | ❌ **Only one author identity** ("Kiro Agent") across every commit |
| Commit history | ✅ Conventional-Commit prefixes across the history (some journey/debug commits) |
| Branch activity | ❌ `main` only — no feature branches |
| Issues assigned | ❌ **0 issues** exist |
| Pull requests | ❌ **0 PRs** |
| Reviews and approvals | ❌ **None** — the brief forbids self-approval |
| Frontend + backend contributions per member | ❌ Cannot be evidenced; brief requires a **team of three**, each doing both |

### Self-assessment: **MISSING / REQUIRES HUMAN ACTION**

Git shows a **single author** and no collaborative artefacts. The brief explicitly states a developer must not approve their own work and that contributions must not be fabricated. **This 15% cannot be earned by automation** — it requires real teammates, real branches, real PRs and independent reviews.

### What the owner must do
1. Recruit/confirm the **three-person team** and add them as collaborators.
2. Create **≥ 30 issues** and the **4-column board** (drafts ready in `docs/GITHUB_SETUP_GUIDE.md`).
3. Enable **branch protection** (PR required + 1 approval).
4. Have each member open PRs touching **both** frontend and backend, reviewed by another member.
5. Fill in README §14 with real names and contributions.

---

## 5. Technical Implementation — 10%

### Evidence found

| Criterion | Finding | Status |
|---|---|---|
| Database relationships | 14 tables with PK/FK + ON DELETE rules | ✅ |
| Database indexes | 13 (M1) + 2 (M2) + 1 partial-unique (M3) + 3 GIN (M4) | ✅ |
| Security | RLS on all 14 tables; service-role server-only; answer key stripped by view | ✅ |
| Authentication & authorisation | Dual auth; `requireRole` on every protected route | ✅ |
| Input validation | Hand-rolled per route | ⚠️ Partial |
| Input sanitisation | No explicit layer; React escaping mitigates | ⚠️ Partial |
| Rate limiting | 5-attempt lockout + 10 req/min IP limit | ⚠️ In-memory only |
| API performance | Direct queries; no N+1 hot spots identified; but no caching | ⚠️ Partial |
| Pagination | ❌ Not implemented | ❌ |
| Caching | ❌ No server-side cache (client IndexedDB is offline storage, not a cache) | ❌ |
| Error handling | Global handler; fail-closed 503; typed errors | ✅ |
| Database access controls | RLS + service-role boundaries + DB helper functions | ✅ |

Source references: [docs/DATABASE.md](DATABASE.md), [docs/SECURITY.md](SECURITY.md), [docs/API.md](API.md).

### Self-assessment: **ADEQUATE**

Strong on schema, security and access control. Weaker on the non-functional items the brief explicitly lists — **pagination, caching, formal validation** — which are honestly flagged as not implemented.

### Evidence gaps
- 🟠 No pagination (ISSUE-36) and no caching (P-03).
- 🟡 Validation is hand-rolled (S-02).

---

## 6. Weighted summary

| Area | Weight | Self-assessment | Primary gap |
|---|---:|---|---|
| Functionality | 40% | STRONG (code) / ADEQUATE (live demo) | Authenticated walkthrough + screenshots |
| Code quality | 20% | STRONG | Monolithic `server.ts` |
| UI/UX | 15% | ADEQUATE (code) / WEAK (evidence) | Screenshots |
| Collaboration | 15% | **MISSING / REQUIRES HUMAN ACTION** | No team, issues, PRs or reviews |
| Technical implementation | 10% | ADEQUATE | Pagination, caching, validation |

**The application itself is strong. The submission's weakest point is Collaboration (15%), which is entirely dependent on human action, followed by missing visual/live evidence.**

---

## 7. Prioritised improvements by impact

| # | Action | Area | Weight at stake |
|---|---|---|---|
| 1 | Recruit the team; create issues/board/PRs/reviews | Collaboration | 15% |
| 2 | Deploy live and verify workflows | Functionality | 40% (evidencing) |
| 3 | Capture screenshots | UI/UX + Functionality | 15% + 40% |
| 4 | Add CI (lint/test/build on PR) | Code quality | 20% |
| 5 | Add pagination + caching | Tech implementation | 10% |

---

*Related: [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) · [docs/GITHUB_SETUP_GUIDE.md](GITHUB_SETUP_GUIDE.md) · [docs/DEPLOYMENT_VERIFICATION.md](DEPLOYMENT_VERIFICATION.md) · [docs/KNOWN_ISSUES.md](KNOWN_ISSUES.md)*
