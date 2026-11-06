# Changelog

All notable changes to the Growing Minds Academy AI Quiz System are documented here.

This changelog is **derived from the actual Git history** of the repository (52 commits, 2026-10-28 → 2026-11-05, single branch `main`). Commit prefixes follow Conventional Commits. Entries are grouped by date because the project has no tagged releases yet.

---

## [Unreleased]

### Added — Submission documentation pack
- `docs/SUBMISSION_GAP_ANALYSIS.md` — requirement-by-requirement audit.
- `docs/API.md` — full REST API reference (36 endpoints).
- `docs/DATABASE.md` — schema, indexes, constraints and RLS inventory.
- `docs/SECURITY.md`, `docs/DEVELOPER_SETUP.md`, `docs/KNOWN_ISSUES.md`.
- `docs/DIAGRAM_CREATION_GUIDE.md` + Mermaid sources under `docs/diagrams/` and a database ERD.
- `docs/api/growing-minds-api.postman_collection.json` — Postman collection.
- `.github/pull_request_template.md`.

### Added — Continuous integration
- `.github/workflows/ci.yml` — runs `npm run lint`, `npm test`, the offline-sync suite and `npm run build` on every push to `main` and every pull request. `npm test` covers 34 of the 45 tests, so the offline-sync suite is invoked explicitly; otherwise CI would report green while 11 tests never ran. No repository secrets are required, because each suite pins its own configuration before importing the server.

### Changed
- `README.md` rewritten to the full Uncommon submission specification (15 required points).

---

## 2026-11-05

### Fixed
- **Grading:** learners now see correct released marks instead of `0%` — the "My Results" lookup matches on student number **or** learner UUID (commit `829fa6c`).
- **Quiz lifecycle:** closing an assessment now persists to the server via `POST /api/quizzes/:id/close` (updates `closed_at`, emits an audit event) instead of only changing client state (commit `668d94b`).
- **AI generation:** Gemini/Groq generation made reliable and now reaches the requested question count (fallback chain + top-up loop) (commit `e5f6f35`).
- Reduced AI batch delay 1200 ms → 200 ms to avoid the Vercel 10 s timeout; explicit `maxDuration` set.
- Excluded API routes from service-worker caching (was serving stale responses).

### Security
- **Session isolation:** `clearSessionData()` clears all `GMA_STORE_*` localStorage keys and in-memory stores on staff login, learner login and logout (commit `9633787`).
- **Teacher data isolation:** strict scoping of teachers to their assigned classes/subjects (commit `8486785`).

### Changed — UI
- Redesigned the role badge to a glassmorphism style with role-specific icons (`GraduationCap`/`Settings`), refined header typography (commit `0d44da3`).

---

## 2026-11-04

### Added
- Comprehensive AI generation error handling and detailed logging (commit `cb02d2c`).
- Raised AI question limit to **200**; `maxOutputTokens` bumped to 32768 for Gemini and Groq (commit `43026af`).

### Fixed
- Restored the working `@google/genai` SDK setup after experimentation (commits `73f1625`, `4f6ebe4`).
- Wrapped the Gemini `responseSchema` in an object root (array root unsupported) (commit `ac055eb`).
- Updated Gemini model to `gemini-3.8-flash` (commit `612113d`).
- Fixed a syntax error (missing brace + undefined `batchSize`) (commit `305af5c`).

---

## 2026-11-03

### Added
- Role-aware server sync — learners fetch results, teachers fetch per-quiz submissions (commit `b7f3dcb`).
- Live Supabase fetch on every page mount (fixes empty dashboard on new devices) (commit `f4492fd`).
- School logo in the login page and app header; refined two-row header layout (commits `2529d34`, `81626a8`).
- Modern UI/UX pass — navy/gold palette, button system, rounded components, responsive mobile layout, micro-interactions (commit `e04989f`).

### Fixed
- Header nav active state, profile truncation, connection-bar polish (commit `fc0996f`).
- Removed unsupported cron (Hobby plan); added `engines node>=20`; restored AI SDK externals (commit `b4846a1`).
- Gemini model updated to `gemini-2.5-flash` (commit `1e57ef2`).
- Corrected Gemini REST field names (`systemInstruction`, `responseMimeType`) + `responseSchema` (commit `a0432b9`).
- Removed the `/api/debug-gemini` debug endpoint.

---

## 2026-10-30

### Added
- Vercel deployment configuration and quiz-lifecycle fixes + cleanup (commit `c97b27a`).
- GitHub + Vercel deployment guide (commit `6dd709d`).
- `.env.example` template — placeholders only, no secrets (commit `09c0f84`).
- Groq as an automatic AI fallback when Gemini rate-limits or fails (commits `6cad856`, `cad814c`).
- Full application source added (frontend, configs, Supabase migrations, server modules) — earlier commits had only ~10 files, which broke the Vercel build (commit `4023dac`).

### Fixed
- Corrected Vercel serverless routing — preserve full `/api/:path*`, use a Node handler (commit `e266520`).
- `requireAuth` + `requireRole` on the AI generation endpoint (Supabase JWT was not being verified correctly) (commit `b98e339`).
- Switched AI calls to a direct Gemini REST API (more reliable on Vercel serverless); added a global error handler (commit `4328e7f`).
- Groq model corrected to `openai/gpt-oss-20b` (Llama models retired on the Groq free tier) (commits `f58bbeb`, `0d464d6`).
- Added `responseMimeType: application/json` for clean JSON output (commit `413f321`).
- Corrected Gemini model name to `gemini-2.0-flash` (commit `ecf80a4`).

### Debug (temporary)
- Added Gemini/Groq raw-output logging and temporary error-detail exposure while diagnosing empty generations (commits `56e813f`, `fbd7c96`, `f036fa4`, `07521a4`).

---

## 2026-10-29

### Added
- Test-teacher provisioning agent scripts.

---

## 2026-10-28

### Added
- Initial Phase 1–3 findings report (inspect, baseline, health) — the first commit in the repository.

---

> **Note on history quality:** the history contains some journey/debug commits (`debug:`, `chore: trigger redeploy`). Per the submission brief, Git history has **not** been rewritten. This changelog presents the same history as a coherent narrative.
