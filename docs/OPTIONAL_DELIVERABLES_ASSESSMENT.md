# Optional Extra-Credit Deliverables — Assessment

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

The Uncommon brief lists five optional extra-credit deliverables. This document records what was produced, what was assessed and **not** produced, and the reasoning — with explicit warnings against introducing risk into a working deployment.

---

## A. API collection (Postman) — ✅ COMPLETE

**Deliverable:** `docs/api/growing-minds-api.postman_collection.json`

| Requirement | Status |
|---|---|
| Postman-compatible collection | ✅ Collection v2.1.0 (JSON parsed successfully) |
| Real implemented endpoints | ✅ All 7 functional domains sourced from `server.ts` route inventory |
| HTTP methods | ✅ |
| Request URLs | ✅ via `{{baseUrl}}` variables |
| Required headers | ✅ collection-level Bearer auth; login/health override to `noauth` |
| Example request bodies | ✅ placeholders only |
| Expected response structures | ✅ |
| Authentication requirements | ✅ |
| Error responses | ✅ |
| **No real credentials or tokens** | ✅ variables are placeholders (`{{authToken}}`, etc.) |

**Contents:** 7 folders (Health, Auth, Staff & Directory, Quizzes, Submissions, Learner Results, AI), collection variables (`baseUrl`, `authToken`, `adminToken`, `learnerToken`, `quizId`, `learnerId`, `submissionId`, `teacherId`, `classId`, `subjectId`), and login requests with test scripts that auto-save the returned token.

**Gap:** the collection has not been executed against a live server (no deployment exists). It is structurally valid but **live execution is unverified**.

---

## B. Database ER diagram — ✅ COMPLETE

**Deliverable:** `docs/diagrams/database-er.md` (Mermaid `erDiagram`) + `docs/DATABASE.md`.

| Requirement | Status |
|---|---|
| Tables | ✅ all 14 |
| Primary keys | ✅ marked |
| Foreign keys + ON DELETE | ✅ marked |
| Relationships + cardinality | ✅ (incl. 1:1 `user_profiles↔teachers`, nullable FKs) |
| Important constraints | ✅ UNIQUE/CHECK documented |
| Editable source | ✅ Mermaid (text-editable) |

**Gap:** not rendered to PNG/SVG — no Mermaid CLI available in this environment. Rendering is a manual step (see `docs/DIAGRAM_CREATION_GUIDE.md`).

---

## C. Component Storybook — ⚠️ ASSESSED, NOT RECOMMENDED for the critical path

**Inspection result:** Storybook is **not installed** — there is no `.storybook/` configuration and no `*.stories.*` files anywhere in the repository.

**Assessment:**

| Factor | Finding | Weight |
|---|---|---|
| Is it already installed? | No | — |
| Would it require new dependencies? | Yes — `storybook`, `@storybook/react-vite`, `@storybook/addon-*` (several packages) | High |
| Would it require new config? | Yes — `.storybook/main.ts`, `preview.ts`, build integration | High |
| Assessment value | UI/UX is 15% of the mark and is already evidenced by the real, functional application | Medium |
| Risk to the working build | Medium — Storybook's Vite integration can conflict with the existing Vite 8 + Tailwind v4 setup; the brief explicitly says *"Do not install unnecessary dependencies"* and *"Do not sacrifice submission-critical work for optional Storybook setup"* | High |

**Recommendation:** **Do not add Storybook before submission.** The 15% UI/UX weight is better evidenced by live screenshots of the real app (ISSUE-42) than by a component catalogue that would be partially built under time pressure. If the team wants it after submission, do it on a feature branch with a PR (see `docs/GITHUB_SETUP_GUIDE.md`).

---

## D. Unit tests — ✅ COMPLETE (independently re-run)

**Command results (2026-11-05):**

| # | Requirement | Result |
|---|---|---|
| 1 | Total tests | **45** across 4 suites |
| 2 | Passed | **45** |
| 3 | Failed | **0** |
| 4 | Skipped | **0** |
| 5 | Coverage | ⚠️ **not available** — no coverage tooling configured |
| 6 | Untested critical workflows | multi-device offline→online sync (needs tablets); production Supabase-Auth staff login round-trip |

Suite breakdown:

| Suite | Tests | Runner |
|---|---:|---|
| `test/security.test.ts` | 19 | `npm test` |
| `test/adapter.test.ts` | 9 | `npm test` |
| `test/generation-and-export.test.ts` | 6 | `npm test` |
| `test/offline-sync.test.ts` | 11 | run separately (`npx tsx`) |
| **Total** | **45** | |

**Honesty notes:**
- The prior "43/43" figure in older reports does **not** match the current suite. The accurate figure is **45 tests across 4 files** (34 via `npm test` + 11 separately).
- Passing unit tests **do not prove** live database or production integration. Live verification is a separate activity (see `TESTING_REPORT.md`).

---

## E. Docker — ⚠️ ASSESSED, NOT RECOMMENDED for the critical path

**Inspection result:** No `Dockerfile`, no `docker-compose.yml`, and no `.dockerignore` exist.

**Assessment:**

| Factor | Finding | Weight |
|---|---|---|
| Does Docker exist today? | No | — |
| What is the real production target? | **Vercel serverless** (SPA + `api/index.ts`) + **Supabase** | High |
| Would a Dockerfile reflect production? | **No** — it would describe a hypothetical self-hosted deployment that is not how the app runs | High |
| Risk | Medium — a misconfigured container (e.g. bundling secrets via `ENV`, or expecting `app.listen` when it is guarded by `VERCEL !== '1'`) could mislead reviewers or be mistaken for the real deployment | High |

**Recommendation:** **Do not add Docker before submission.** It adds a build surface that does not match the actual architecture and could create a false impression of how the system is hosted. If the team later wants a containerised self-hosted option, it should be a dedicated, tested effort with the `VERCEL !== '1'` guard understood (the Express `app.listen` only binds a port when `VERCEL` is unset, so a container would need to set `VERCEL` unset/empty and expose port 3000).

> If a `Dockerfile` **is** requested anyway, the minimum safe shape is: multi-stage Node 20 build (`npm ci` → `npm run build`), runtime runs `node dist/server.js`, `.dockerignore` excludes `.env*`, `node_modules`, `dist`, and no secret is baked in — all secrets injected at runtime. This was **not** created because it is not recommended.

---

## Summary

| Deliverable | Status | Notes |
|---|---|---|
| A. Postman collection | ✅ **Complete** | Not live-executed (no deployment) |
| B. Database ERD | ✅ **Complete** | Not rendered to image (manual step) |
| C. Storybook | ⚠️ **Assessed — not recommended** | Would add dependencies + risk for limited value |
| D. Unit tests | ✅ **Complete** | 45/45 pass; no coverage tooling; run independently |
| E. Docker | ⚠️ **Assessed — not recommended** | Does not match the Vercel serverless target |

---

*Related: [docs/API.md](API.md) · [docs/DATABASE.md](DATABASE.md) · [docs/DIAGRAM_CREATION_GUIDE.md](DIAGRAM_CREATION_GUIDE.md) · [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md)*
