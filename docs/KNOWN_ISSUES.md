# Known Issues & Limitations

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

This is an honest inventory of every known defect, limitation and caveat in the current codebase. Items are classified by severity. Nothing here is hidden to make the project appear more complete than it is.

**Severity key:** 🔴 High · 🟠 Medium · 🟡 Low · ℹ️ Informational

---

## 1. Functional defects

| ID | Sev | Area | Issue | Impact | Workaround | Reference |
|---|---|---|---|---|---|---|
| F-01 | 🟡 | Grading data | `submission_answers.is_correct` is stored as `null` and `marks_awarded` as `0` for **all** answers — including correct ones. Per-question correctness is **not persisted**. | Per-question analytics cannot be derived from the DB. **Aggregate** submission scores/percentages are correct. | None needed for current features; compute per-question correctness differs from stored columns. | Live verification 2026-11-05 |
| F-02 | 🟠 | Quiz lifecycle | Quizzes closed **before** the `POST /api/quizzes/:id/close` endpoint existed remain `published` in Supabase. | Those specific quizzes still appear active to learners. | Teacher performs a one-time manual close on each legacy quiz to sync it. | Commit `668d94b` |
| F-03 | 🟡 | API naming | `POST /api/quizzes/:id/publish` sets `status = 'in_progress'`, not `'published'`. | The route name is misleading vs the resulting status. | None — behaviour is intentional in code. | [docs/API.md](API.md) |
| F-04 | 🟡 | Display | `authorName` on submissions is hard-coded as `"Faculty Teacher"`. | The real teacher's name is not shown on submission records. | None. | [docs/API.md](API.md) |

---

## 2. Security & operational limitations

| ID | Sev | Area | Issue | Impact | Reference |
|---|---|---|---|---|---|
| S-01 | 🟠 | Rate limiting | Lockout and IP-rate counters live in **in-memory `Map`s**. Not shared across Vercel serverless instances; reset on cold start. | Effective against single-instance bursts only; not a distributed limiter. | [docs/SECURITY.md §4](SECURITY.md) |
| S-02 | 🟡 | Validation | No schema-validation library (Zod/etc.); validation is hand-rolled per route. No explicit output-sanitisation layer. | Higher risk of missed edge cases; mitigated by React escaping text output. | [docs/SECURITY.md §8](SECURITY.md) |
| S-03 | 🟡 | Headers | No explicit CSP / HSTS / X-Frame-Options configured; platform defaults apply. | Reduced hardening against XSS/clickjacking. | [docs/SECURITY.md §9](SECURITY.md) |
| S-04 | 🟡 | RLS | RLS policies were reasoned from SQL but **not exercised end-to-end live**. | Policy correctness is unproven at runtime. | [TESTING_REPORT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/TESTING_REPORT.md) |
| S-05 | ℹ️ | MFA | No multi-factor authentication for staff/admin accounts. | Password is the sole factor for admin. | — |
| S-06 | ℹ️ | Scanning | No dependency/vulnerability scanning and **no secret scan** has been run over Git history. | Unknown; recommended before submission. | [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) |

---

## 3. Performance & scalability

| ID | Sev | Area | Issue | Impact | Reference |
|---|---|---|---|---|---|
| P-01 | 🟠 | API | **No pagination** on list endpoints (`/api/quizzes`, `/api/learners`, `/api/submissions`, …). | Large datasets return in one response; may degrade at scale. | [docs/API.md](API.md) |
| P-02 | ✅ | Frontend bundle | **Resolved.** Was a single 977.66 kB chunk (gzip 269.36 kB) warning above 500 kB. Every portal page now sits behind `React.lazy` + Suspense in [src/app/router.tsx](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/src/app/router.tsx). | Entry chunk is now **352 kB (gzip 110 kB)**; largest remaining chunk is Recharts at 371 kB. Budget: entry < 400 kB and no chunk > 500 kB — both met. | `npm run build` |
| P-03 | 🟡 | Caching | No server-side caching layer; every request hits Supabase. | Extra DB load under concurrency. | [docs/ASSESSMENT_CRITERIA_AUDIT.md](ASSESSMENT_CRITERIA_AUDIT.md) |
| P-04 | ℹ️ | Cold starts | Serverless functions cold-start; AI generation was moved browser-direct to avoid the 10 s function timeout. | First request after idle may be slow. | [DEPLOYMENT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/DEPLOYMENT.md) |

---

## 4. Testing gaps

| ID | Sev | Issue | Reference |
|---|---|---|---|
| T-01 | 🟠 | **No coverage tooling** is configured; no coverage percentage can be reported. | [README.md §12](../README.md#12-testing) |
| T-02 | 🟡 | `test/offline-sync.test.ts` (11 tests) is **not wired into `npm test`** — it must be run separately, so the default `npm test` reports only 34 of 45 tests. | `package.json` |
| T-03 | 🟠 | Untested critical workflows: true **multi-device offline→online sync** (needs physical tablets) and the full **Supabase-Auth staff login** round-trip in production. | [TESTING_REPORT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/TESTING_REPORT.md) |
| T-04 | 🟡 | No CI pipeline — tests/lint/build are not run automatically on push or PR. | [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) |

---

## 5. Submission-packaging gaps

| ID | Sev | Issue | Reference |
|---|---|---|---|
| D-01 | 🟠 | **Live deployment URL not verified** — no production URL exists in the repo. | [README.md §13](../README.md#13-deployment-information) |
| D-02 | 🟠 | **No application screenshots** in the repo. | [README.md §15](../README.md#15-screenshots-and-demo-references) |
| D-03 | 🔴 | **Team collaboration evidence absent** — Git shows a single author, no PRs, no reviews. The brief requires a team of three. | [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md) |
| D-04 | 🟠 | **< 30 GitHub issues**, no Project board, no branch protection. | [docs/GITHUB_SETUP_GUIDE.md](GITHUB_SETUP_GUIDE.md) |
| D-05 | ℹ️ | **Storybook not installed** (assessed, not recommended for the critical path). | [docs/OPTIONAL_DELIVERABLES_ASSESSMENT.md](OPTIONAL_DELIVERABLES_ASSESSMENT.md) |
| D-06 | ℹ️ | **Docker not present** (assessed, not recommended — production target is Vercel serverless). | [docs/OPTIONAL_DELIVERABLES_ASSESSMENT.md](OPTIONAL_DELIVERABLES_ASSESSMENT.md) |
| D-07 | ℹ️ | `package.json` `name` is still the generic `"react-example"`. | `package.json` |
| D-08 | ℹ️ | Diagram sources are Mermaid; rendering to PNG/SVG is a manual step. | [docs/DIAGRAM_CREATION_GUIDE.md](DIAGRAM_CREATION_GUIDE.md) |

---

## 6. Behavioural notes (not defects, but worth knowing)

- **Fail-closed by design:** when Supabase is unavailable the API returns **HTTP 503** for every data route. This is intentional — there is no mock fallback in production. If you see 503s, check your environment variables first.
- **AI does not fabricate questions:** if neither Gemini nor Groq is reachable, generation reports an error rather than substituting synthetic questions.
- **Answer-key isolation:** `correct_answer` / `explanation` are stripped by the `learner_active_quiz_questions` view and never sent to learners.
- **Offline sync is idempotent:** `client_submission_hash` is `UNIQUE`, so replaying the queue cannot create duplicate submissions.
- **Admin bootstrap is idempotent:** it never overwrites an existing password unless `ADMIN_PASSWORD_RESET="true"`.

---

*Related: [docs/SECURITY.md](SECURITY.md) · [TESTING_REPORT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/TESTING_REPORT.md) · [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md)*
