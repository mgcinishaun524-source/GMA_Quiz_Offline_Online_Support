# Deployment Guide — GitHub + Vercel

The repo is push-ready. Build, lint, and all 45 tests pass. Test records have been
cleaned out of the live Supabase project (teachers back to 2, quizzes/submissions at 0).

## 1. Push to GitHub

`gh` CLI is not installed on this machine, so do this in a terminal (or via github.com):

```powershell
# Create an empty repo on github.com first (no README, no .gitignore — the repo has them).
# Then in the project folder:
git remote add origin https://github.com/<your-user>/<your-repo>.git
git branch -M main
git push -u origin main
```

The current branch is `master` — `git branch -M main` renames it to `main` before pushing
(GitHub's default). Use `master` instead if your repo is set to default on `master`.

**Already verified safe to push:**
- `.env` is gitignored (never tracked) — confirmed `git ls-files .env` returns nothing.
- `.agents/` (test scaffolding, output files, UUIDs) is gitignored and untracked.
- No secrets, tokens, or passwords appear in any tracked file.
- `TESTING_REPORT.md` contains only UUIDs and HTTP statuses, never secret values.

## 2. Import to Vercel

1. https://vercel.com → New Project → Import the GitHub repo.
2. Vercel auto-detects Vite. The `vercel.json` already sets:
   - `buildCommand`: `npm run build`
   - `outputDirectory`: `dist` (the Vite SPA)
   - `rewrites`: `/api/(.*)` → `/api/index` (the serverless function)
3. Framework preset can stay "Vite" — `vercel.json` overrides the build.

## 3. Set Environment Variables in Vercel (Project → Settings → Environment Variables)

Set these exactly as in your local `.env`. **All are required for a working deploy.**

Server-only (do NOT prefix with VITE_):
| Name | Purpose |
|------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend only) |
| `SUPABASE_JWT_SECRET` | Signs/verifies learner + staff session tokens (prod requires this) |
| `GEMINI_API_KEY` | Gemini API key (omit only if you accept AI generation being refused) |
| `INITIAL_ADMIN_PASSWORD` | Bootstrap admin `darksyntax` password (≥8 chars) |
| `VITE_APP_MODE` | `production` |
| `ALLOW_DEMO_AUTH` | `false` |
| `NODE_ENV` | `production` |

Client-exposed (Vite inlines these into the browser bundle — that's intended; the anon key is public):
| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Public Supabase URL (same as SUPABASE_URL) |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable key |

> Mark the server-only ones for "Production" + "Preview" + "Development" environments.
> The `VITE_` ones must be present at BUILD time (Vite inlines them), so set them
> before the first deploy, not just at runtime.

## 4. Deploy

Click Deploy. Vercel runs `npm run build` (Vite frontend → `dist/`, plus `esbuild`
server bundle which is unused on Vercel but harmless) and builds `api/index.ts` as a
Node serverless function. The rewrite sends every `/api/*` request to that function;
everything else serves the SPA.

## 5. Verify after deploy

- `https://<your-app>.vercel.app/api/health` → should return
  `{"supabaseConfigured":true,"geminiConfigured":true,"authMode":"supabase"}`
  (set `geminiConfigured` based on whether you set `GEMINI_API_KEY`).
- Log in as `darksyntax` with the admin password.
- The first deploy triggers admin bootstrap, which is idempotent — it will see the
  existing admin in Supabase and not overwrite it.

## Notes / caveats

- The Express server is served as a Vercel serverless function (`api/index.ts`
  re-exports the Express `app`). `app.listen()` is guarded with `VERCEL !== '1'` so
  it does not bind a port on Vercel. Locally, `npm run dev` still starts the full
  server on port 3000 as before.
- Serverless functions have a max duration (set to 30s in `vercel.json`). Gemini
  generation of up to 50 questions should fit; very long generations could time out.
- IndexedDB offline + sync work in the browser regardless of host; reconnect triggers
  the sync queue to POST to `/api/submissions/sync`.
- Supabase Row Level Security is defined in the migrations. The server uses the
  service-role key (bypasses RLS); client calls use the anon key. This was not
  live-exercised end-to-end in testing (see TESTING_REPORT.md).
