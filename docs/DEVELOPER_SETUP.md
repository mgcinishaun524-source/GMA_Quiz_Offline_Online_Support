# Developer Setup Guide

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05

This guide gets a new developer from a fresh machine to a running local instance.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **≥ 20** | Required by `engines` in `package.json` |
| npm | bundled with Node | |
| Git | any recent | |
| A Supabase account | free tier OK | PostgreSQL + Auth |
| Gemini and/or Groq API key | optional | Needed only for AI quiz generation |

> **Windows note:** if PowerShell blocks `.ps1` shims, use `npm.cmd` / `npx.cmd`, or run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in the current session only.

---

## 2. Clone and install

```bash
git clone https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support.git
cd GMA_Quiz_Offline_Online_Support
npm install
```

---

## 3. Environment configuration

```bash
cp .env.example .env                     # macOS/Linux
# Windows PowerShell:
Copy-Item .env.example .env
```

Fill in `.env`. Minimum for a working system:

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only) |
| `SUPABASE_JWT_SECRET` | Strong random string — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `INITIAL_ADMIN_PASSWORD` | ≥ 8 chars — bootstraps the `darksyntax` admin |
| `VITE_APP_MODE` | `production` |
| `ALLOW_DEMO_AUTH` | `false` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | At least one for AI generation |

Full reference: [README.md §8](../README.md#8-required-environment-variables).

> ⚠️ `VITE_`-prefixed values are inlined into the browser bundle. Never prefix a secret with `VITE_`.

---

## 4. Database setup

Apply the migrations in `supabase/migrations/` **in filename order** (SQL editor or Supabase CLI `supabase db push`). They are additive and idempotent. See [docs/DATABASE.md](DATABASE.md) for the full schema and [README.md §9](../README.md#9-database-setup-and-migration-instructions).

After the schema exists, restart the server — the `darksyntax` administrator is provisioned idempotently.

**Foreign keys:** `learners`, `subjects`, `classes` reference `schools`; learner/subject/class rows must be created through the admin console (or SQL) before dependent rows can be inserted.

---

## 5. Run locally

```bash
npm run dev        # Express API + Vite dev server → http://localhost:3000
```

- If port 3000 is taken, the server automatically uses 3001.
- Log in as `darksyntax` with `INITIAL_ADMIN_PASSWORD`.

---

## 6. Project structure

```
├─ api/index.ts               # Vercel serverless entry (re-exports the Express app)
├─ server.ts                  # Express API — all 36 routes, fail-closed boot
├─ server/
│  ├─ auth.ts                 # JWT/PIN utilities, middleware, lockout, rate limit
│  ├─ db.ts                   # Supabase clients (admin vs auth), audit logging
│  └─ db/databaseAdapter.ts   # Data access layer (fail-closed)
├─ src/
│  ├─ app/                    # AuthContext, router
│  ├─ components/             # ui/, layout/, feedback/
│  ├─ features/
│  │  ├─ admin/               # Admin dashboard + directory pages
│  │  ├─ teacher/             # Teacher pages incl. QuizWizard/NewQuizPage
│  │  ├─ learner/             # Learner dashboard, player, results
│  │  └─ auth/                # Login, unauthorized
│  ├─ hooks/useServerSync.ts  # Live server hydration, role-aware
│  ├─ lib/                    # ai-quiz-core, ai-service, offline-db, sync-queue, tokens, network, supabase
│  ├─ services/               # quiz-api, learner-api, directory-api, auth-service, storage
│  └─ types/                  # Shared TypeScript models
├─ supabase/migrations/       # 5 forward migrations
├─ test/                      # 4 test suites
├─ docs/                      # Submission documentation
└─ vercel.json                # Build + API rewrite config
```

---

## 7. Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run locally (port 3000) |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm test` | Run 3 suites (34 tests) |
| `npx tsx test/offline-sync.test.ts` | Run the 11 offline-sync tests |
| `npm run build` | Production build → `dist/` |
| `npm start` | Run the built server bundle |
| `npm run clean` | Remove `dist/` |

---

## 8. Testing

```bash
npm run lint
npm test
npx tsx test/offline-sync.test.ts
npm run build
```

Expected: **45 tests pass** (34 via `npm test` + 11 offline-sync), lint clean, build clean. Details: [README.md §12](../README.md#12-testing).

Tests set `NODE_ENV=test`; the security suite pins `GROQ_API_KEY` / `GEMINI_API_KEY` to empty strings so assertions about unconfigured AI backends remain valid.

---

## 9. Code conventions

- **TypeScript everywhere**; strict typing; shared models in `src/types/`.
- **Feature-folder organisation** — UI grouped by role under `src/features/`.
- **AI logic** lives in `src/lib/ai-quiz-core.ts` (single source of truth for prompts, schemas, parsing) — extend there, not in page components.
- **Server access** goes through `server/db/databaseAdapter.ts`; do not talk to Supabase directly from route handlers.
- **Never** move service-role operations into frontend code.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `security:`, `style:`).
- Use `cross-env` for any new npm script that needs environment variables (Windows compatibility).

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `cannot be loaded because running scripts is disabled` | PowerShell execution policy | Use `npm.cmd` / `npx.cmd`, or bypass for the session |
| App starts on port 3001 | Port 3000 in use by a stray Node process | Stop the stray process or accept 3001 |
| HTTP 503 from every `/api` route | Supabase not configured | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Learner tokens rejected after restart | `SUPABASE_JWT_SECRET` unset in dev → ephemeral secret rotates | Set `SUPABASE_JWT_SECRET` in `.env` |
| AI generation returns "0 questions" / error | No AI key configured, or provider rate-limited | Set `GEMINI_API_KEY` and/or `GROQ_API_KEY` |
| `/api/health` shows `authMode` not `supabase` | Database unavailable | Verify Supabase credentials |
| Admin login blocked | Stale password in Supabase Auth | Set `ADMIN_PASSWORD_RESET="true"` once, restart, then remove it |

---

*Related: [README.md](../README.md) · [DEPLOYMENT.md](../DEPLOYMENT.md) · [docs/SECURITY.md](SECURITY.md) · [docs/KNOWN_ISSUES.md](KNOWN_ISSUES.md)*
