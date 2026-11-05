# Final Project Presentation

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Challenge:** Uncommon Full-Stack Development Challenge
**Format:** 15–20 minutes + Q&A
**Document version:** 1.0
**Date:** 2026-11-05

> ⚠️ **PowerPoint not generated.** No verified PPTX-generation tool is available in this environment, so an editable `.pptx` was **not** created (and will not be claimed). This Markdown is structured slide-by-slide so it can be pasted directly into Google Slides / PowerPoint / Keynote.
> ⚠️ **No screenshots exist yet** (see [KNOWN_ISSUES D-02](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/docs/KNOWN_ISSUES.md)). Capture them before presenting (ISSUE-42).
> ⚠️ **Slide 15 (Team Collaboration) must be completed by the team.** It is a placeholder — nothing has been fabricated.

---

## Timing plan (target ≈ 18 minutes)

| # | Section | Slide(s) | Time |
|---|---|---:|---:|
| 1 | Title & agenda | 1–2 | 1:00 |
| 2 | Problem statement | 3 | 1:30 |
| 3 | Target users & objectives | 4 | 1:00 |
| 4 | Solution overview | 5 | 1:00 |
| 5 | Main features | 6 | 2:00 |
| 6 | **Live demonstration** | 7 | 5:00 |
| 7 | Technology stack | 8 | 1:00 |
| 8 | Architecture & key components | 9–10 | 2:30 |
| 9 | Database design | 11 | 1:30 |
| 10 | Security implementation | 12 | 1:30 |
| 11 | Offline-first functionality | 13 | 1:30 |
| 12 | Challenges & solutions | 14 | 1:30 |
| 13 | Team collaboration | 15 | 1:00 |
| 14 | Lessons learned | 16 | 0:45 |
| 15 | Future improvements | 17 | 0:45 |
| 16 | Conclusion & Q&A | 18 | 0:45 + Q&A |

---

## Slide 1 — Title

**Title:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System

**Subtitle:** Offline-first assessment for schools • Uncommon Full-Stack Development Challenge

**Visual:** The Growing Minds Academy logo (`public/assets/Logo.png`) centred; team names below.

**Speaker notes:** "Good morning. We built Growing Minds Academy — an offline-first assessment platform that lets teachers create AI-generated quizzes, learners take them even without internet, and marks are graded securely on the server and released only when the teacher decides."

---

## Slide 2 — Agenda

**Title:** What we'll cover

**Bullets:** Problem → Objectives → Features → Live demo → Technology → Architecture → Database → Security → Offline-first → Challenges → Collaboration → Lessons → Future → Conclusion.

**Speaker notes:** "We'll spend most of our time on the live demo, then walk through how it's built and secured."

---

## Slide 3 — Problem Statement

**Title:** The problem with paper-based assessment

**Bullets:**
- Marking is slow — feedback arrives days later, or never.
- No analytics — teachers cannot see which topics the class struggled with.
- No offline capability — most online tools stop working when the Wi-Fi drops.
- Assessment integrity is hard to guarantee — answer keys leak, and results are often shared too early.
- Grading in the browser can be tampered with.

**Speaker notes:** "In many schools, particularly with limited connectivity, assessment is still printed and hand-marked. That means slow feedback, no data, and no control over when learners see their marks. Our platform targets exactly those gaps."

---

## Slide 4 — Target Users & Objectives

**Title:** Who it's for, and what we set out to do

**Three columns:**

| Administrator | Teacher | Learner |
|---|---|---|
| Manage the school directory | Create & assign quizzes | Take assigned quizzes |
| Teachers, learners, classes, subjects | Use AI to generate content | Work on a tablet, online or offline |
| School settings & analytics | Grade, release, analyse | See results only when released |

**Objectives:** reduce teacher workload (AI generation) · work offline in class · keep grading server-side · control results release · derive insights from real data only.

**Speaker notes:** "Three roles, three jobs. The key objectives were: reduce workload with AI, survive poor connectivity, and protect assessment integrity."

---

## Slide 5 — Solution Overview

**Title:** One platform, three roles, online or offline

**Diagram:** The architecture diagram (render `docs/diagrams/architecture.mmd`).

**Speaker notes:** "A React single-page app talks to an Express API, which talks to Supabase PostgreSQL. AI generation happens browser-direct using short-lived keys issued by the server — which is how we get around serverless timeouts. Learners' devices cache questions locally and queue submissions when offline."

---

## Slide 6 — Main Features

**Title:** What's built

**Bullets:**
- **AI Quiz Wizard** — up to 200 questions, Gemini with automatic Groq fallback, top-up loop guarantees the count.
- **Full quiz lifecycle** — draft → publish → in progress → closed → results released.
- **Server-side grading** with release gating.
- **Offline quiz taking** with an idempotent sync queue.
- **Directory management** — teachers, learners, classes, subjects, associations.
- **Analytics** for teachers and administrators, from real records only.
- **Print/export** quiz papers and teacher answer keys.
- **Dual authentication** — Supabase Auth for staff, PIN for learners.

**Speaker notes:** "These are the headline features. The ones we're most proud of are the AI generation reliability and the offline sync."

---

## Slide 7 — Live Demonstration

**Title:** Live demo (≈5 minutes)

**Demonstration sequence (follow in this order):**

| Step | Role | Action | Talking point |
|---|---|---|---|
| 1 | — | Load the app; open `/api/health` | Fail-closed design; health reports `authMode: supabase` |
| 2 | Admin | Log in as `darksyntax` | Supabase Auth; role-aware shell |
| 3 | Admin | Create a subject, a class, a teacher, a learner | Real DB writes; FK constraints |
| 4 | Teacher | Open the AI Quiz Wizard; generate ~10 questions | Gemini generation + fallback |
| 5 | Teacher | Publish & assign the quiz to the class | Lifecycle + assignment |
| 6 | Teacher | Show the printable paper and answer key | Answer key is teacher-only |
| 7 | Learner | Log in with student number + PIN; take the quiz | bcrypt PIN; player UX |
| 8 | Learner | Toggle the network simulator; submit while "offline" | IndexedDB caching + queue |
| 9 | Learner | Reconnect; show the queued submission sync | Idempotent sync |
| 10 | Teacher | Grade/review; release results | Server-side marking + gating |
| 11 | Learner | Open "My Results"; show the correct mark | The 0% bug fix in action |
| 12 | Teacher | Open analytics | Charts from real records |

**Fallback if the live environment is unavailable:** use screenshots (ISSUE-42) and narrate.

**Speaker notes:** "We'll run through the full journey: admin sets up the school, the teacher generates and assigns a quiz, the learner takes it — including offline — and finally the teacher releases marks and the learner sees them. Watch the offline step in particular."

---

## Slide 8 — Technology Stack

**Title:** Built with

**Two columns:**

| Frontend | Backend & Data |
|---|---|
| React 19.0.1 | Node.js ≥ 20, Express 4.21.2 |
| Vite 8.3.0 | Supabase (PostgreSQL + Auth) 2.118.0 |
| TypeScript 7.0.2 | `@google/genai` 2.4.0 (Gemini) |
| Tailwind CSS 4.3.3 | `groq-sdk` 1.6.0 (fallback) |
| Recharts 3.10.1 | bcryptjs 3.0.3, jsonwebtoken 9.0.3 |
| React Router 7.18.4 | Deployed on Vercel (serverless) |

**Speaker notes:** "A modern, deliberately current stack — React 19, Vite 8, TypeScript 7, Express with Supabase."

---

## Slide 9 — Architecture

**Title:** How it fits together

**Diagram:** Architecture diagram.

**Bullets:**
- SPA + serverless API on one domain (no separate backend host).
- `server.ts` — 36 REST endpoints.
- `databaseAdapter` — the single fail-closed data boundary.
- Browser-direct AI calls via a server-issued key.

**Speaker notes:** "The important architectural decision is the fail-closed adapter: if the database isn't reachable, the API returns 503 rather than pretending to save."

---

## Slide 10 — Key Code Components

**Title:** Where the logic lives

| File | Responsibility |
|---|---|
| `server.ts` | All 36 API routes, lifecycle, grading |
| `server/auth.ts` | JWT/PIN utilities, middleware, lockout, rate limit |
| `server/db.ts` | Supabase clients (admin vs auth), audit logging |
| `server/db/databaseAdapter.ts` | Fail-closed data access |
| `src/lib/ai-quiz-core.ts` | Prompts, schemas, robust parsing (single source of truth) |
| `src/lib/offline-db.ts` | IndexedDB offline store |
| `src/lib/sync-queue.ts` | Submission queue + idempotent replay |
| `src/hooks/useServerSync.ts` | Role-aware live hydration |

**Speaker notes:** "AI logic is centralised in one core file — that was a deliberate refactor after we hit inconsistent provider response shapes."

---

## Slide 11 — Database Design

**Title:** 14 tables, fully constrained, RLS everywhere

**Diagram:** ERD (`docs/diagrams/database-er.md`).

**Bullets:**
- 14 tables with PK/FK and explicit `ON DELETE` rules.
- 19 indexes including 3 GIN indexes for array membership.
- RLS enabled on **all 14 tables**.
- `learner_active_quiz_questions` view strips the answer key.
- 5 additive, re-runnable migrations.

**Speaker notes:** "Every table has RLS. Learners literally cannot query the answer key — it's removed at the view level, not hidden in the app."

---

## Slide 12 — Security Implementation

**Title:** Secure by default, fail closed

**Bullets:**
- **Dual auth:** Supabase Auth (staff) + bcrypt PIN → signed JWT (learners).
- **RBAC** on every protected route (401/403).
- **Fail closed:** no mock fallback in production; unrecognised tokens rejected.
- **Brute-force defence:** 5 attempts → 15-min lockout; 10 req/min/IP.
- **Secrets:** env-only; `VITE_` isolation; AI keys issued at runtime.
- **Answer key isolation** + **server-side grading**.
- **Session isolation** on login/logout.

**Speaker notes:** "The theme is fail-closed. If anything is missing — a secret, the database, a recognised profile — the system denies rather than defaults."

---

## Slide 13 — Offline-First Functionality

**Title:** Works in class, even without internet

**Diagram:** Offline sync flow (`docs/diagrams/offline-sync.mmd`).

**Steps:**
1. Questions cached in IndexedDB (`GMA_Offline_DB`) while online.
2. Learner answers while offline; progress autosaved locally.
3. Submission queued with a `client_submission_hash`.
4. On reconnect, the queue POSTs to `/api/submissions/sync`.
5. Server grades and persists; the hash makes replays idempotent.

**Speaker notes:** "This is the feature that matters most for our target schools. The idempotency hash means we can retry safely — a dropped connection can never duplicate a submission."

---

## Slide 14 — Challenges Faced & Solutions

**Title:** What was hard, and how we solved it

*(All real, drawn from the commit history.)*

| Challenge | Solution |
|---|---|
| Gemini returning HTTP 503 "high demand" | Model fallback chain starting at `gemini-2.5-flash` |
| AI returning fewer questions than requested | "Top-up loop" that re-requests the missing items |
| Provider response field names differed (`question` vs `prompt`) | Field-aliasing parser in `ai-quiz-core.ts`; bare strings treated as short-answer drafts |
| Vercel 10-second function timeout on long generations | Moved AI calls browser-direct using server-issued keys; chunked to 10 questions/batch |
| Learners saw 0% for released marks | Identity-matching fix: match on student number **or** UUID |
| Closing a quiz didn't persist | Dedicated `POST /api/quizzes/:id/close` endpoint + audit event |
| supabase-js downgrading the service-role client | Split into two clients: `getSupabaseAdmin` vs `getSupabaseAuth` |

**Speaker notes:** "Most of these came from the AI integration. The most instructive was the service-role downgrade bug — signing in on the data client silently dropped it to the user's permissions."

---

## Slide 15 — Team Collaboration

**Title:** How we worked together

**⚠️ PLACEHOLDER — to be completed by the team. Nothing here has been invented.**

| Member | Role | Frontend contribution | Backend contribution | Key PRs |
|---|---|---|---|---|
| *(name)* | *(role)* | *(e.g. learner player, admin directory)* | *(e.g. sync endpoint, RLS policies)* | *#…* |
| *(name)* | *(role)* | *(…)* | *(…)* | *#…* |
| *(name)* | *(role)* | *(…)* | *(…)* | *#…* |

**Also cover:** branch strategy, PR review process, how conflicts were resolved.

**Speaker notes:** *(to be written by the team, describing their real process — not scripted here.)*

> The brief requires a **team of three**, each contributing to both frontend and backend, with PRs reviewed by someone other than the author. See `docs/GITHUB_SETUP_GUIDE.md` for how to establish that evidence.

---

## Slide 16 — Lessons Learned

**Title:** What we'd carry forward

**Bullets:**
- Design the **failure mode** first — fail-closed saved us repeatedly.
- Centralise third-party integrations — provider quirks belong in **one** file.
- Verify with **live data**, not just unit tests — the 0% bug passed all unit tests.
- Idempotency is non-negotiable for anything that syncs from a flaky network.
- Read the SDK: the service-role downgrade was a library-behaviour trap.

**Speaker notes:** "The biggest lesson: unit tests were green while a real bug shipped. Live verification is not optional."

---

## Slide 17 — Future Improvements

**Title:** Where we'd take it next

**Bullets:**
- Pagination and server-side caching on list endpoints.
- Move lockout/rate-limit state to a shared store (Redis/Upstash).
- Split the frontend bundle (currently one 977 kB chunk).
- Persist per-question correctness for richer analytics.
- Add a CI pipeline and code coverage.
- Formal schema validation and an accessibility audit.
- Parent/guardian reporting and scheduled term reports.

**Speaker notes:** "We're honest about the gaps — pagination, caching, and distributed rate limiting are the top of the list."

---

## Slide 18 — Conclusion

**Title:** Submission-ready foundations

**Bullets:**
- A complete, working assessment platform for all three roles.
- Genuinely offline-capable, with idempotent synchronisation.
- Server-side grading and release gating that protect integrity.
- 45 automated tests, clean lint, clean production build.
- Documented: API, database, security, deployment, and a Postman collection.

**Closing line:** "Thank you — we're happy to take questions."

**Speaker notes:** "To summarise: a real, offline-first assessment platform, built on a security-first foundation, fully documented, and honestly reported. Thank you."

---

## Appendix — Pre-presentation checklist

- [ ] Deploy the app and record the live URL (ISSUE-43)
- [ ] Capture the 8 required screenshots (ISSUE-42)
- [ ] Complete Slide 15 with real team information
- [ ] Create the QR code / link to the live app
- [ ] Render both Mermaid diagrams (`architecture`, `offline-sync`, `database-er`)
- [ ] Rehearse to confirm the 15–20 minute window incl. demo
- [ ] Prepare the demo fallback (screenshots) in case of connectivity issues

---

*Related: [docs/diagrams/](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/docs/diagrams) · [README.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/README.md) · [docs/ASSESSMENT_CRITERIA_AUDIT.md](file:///c:/Users/thula/Downloads/growing-minds-academy-ai-quiz-system%20(1)/docs/ASSESSMENT_CRITERIA_AUDIT.md)*
