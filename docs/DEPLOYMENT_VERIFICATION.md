# Deployment Verification

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.0
**Date:** 2026-11-05
**Status:** ⚠️ **LIVE DEPLOYMENT NOT VERIFIED — REQUIRES HUMAN ACTION**

---

## 1. Summary

The application's deployment **configuration** is complete and verified locally (build, lint, tests, rewrite rules, function settings). However, **no live production deployment could be verified** because:

- No production URL exists anywhere in the repository.
- The only URL in the repo is the placeholder `https://<your-app>.vercel.app` in [DEPLOYMENT.md](../DEPLOYMENT.md).
- Deploying requires the owner's Vercel account and secret environment variables.

**No URL has been invented.** The record below is deliberately blank where a value could not be observed.

---

## 2. Verified production URLs

| Target | Platform | Verified URL | Status |
|---|---|---|---|
| **Frontend** | Vercel (expected) | *(none — not deployed/verified)* | ⚠️ **REQUIRES HUMAN ACTION** |
| **Backend API** | Vercel serverless function | *(none — not deployed/verified)* | ⚠️ **REQUIRES HUMAN ACTION** |
| **Database / Auth** | Supabase | `https://qfsvuzczjotvtbttdtjc.supabase.co` (project ref from source) | ✅ exists (live connectivity re-check not performed this session to avoid touching production data) |

> **Architecture deviation from the brief:** the brief anticipates the backend on "Railway, Render or equivalent". This project deploys the Express API as a **Vercel serverless function** ([api/index.ts](../api/index.ts)) served from the same domain as the SPA. There is **no separate always-on backend host**. The backend URL will therefore be `<frontend-url>/api/...`.

---

## 3. What WAS verified (local, 2026-11-05)

| Check | Command | Result |
|---|---|---|
| Type-check | `npm run lint` (`tsc --noEmit`) | ✅ clean |
| Unit tests | `npm test` + `npx tsx test/offline-sync.test.ts` | ✅ **45 passed / 0 failed** |
| Production build | `npm run build` | ✅ clean — `dist/index.html` 1.39 kB, `dist/assets/index-*.js` 977.66 kB (gzip 269.36 kB), `dist/server.js` 138.7 kB |
| Serverless entry | [api/index.ts](../api/index.ts) re-exports the Express `app`; `app.listen` guarded by `VERCEL !== '1'` | ✅ present |
| API rewrite | [vercel.json](../vercel.json) `"/api/:path*" → "/api/index"` | ✅ present |
| Function limits | `memory: 1024`, `maxDuration: 30` | ✅ present |
| Build/output config | `buildCommand: npm run build`, `outputDirectory: dist` | ✅ present |
| Env template | [.env.example](../.env.example) — placeholders only | ✅ no secrets |
| Secrets in Git | `.env` gitignored; `git ls-files .env` empty (earlier check) | ✅ no tracked secrets |

---

## 4. What could NOT be verified (requires the owner)

| # | Check | Why blocked |
|---|---|---|
| 1 | Live frontend URL loads | No deployment / no URL |
| 2 | Responsive behaviour in a real browser | No live URL |
| 3 | Browser console is error-free | No live URL |
| 4 | `/api/health` returns `authMode: "supabase"` | No live URL |
| 5 | Staff login round-trip against Supabase Auth in production | Needs live deployment + admin credentials |
| 6 | Learner login + results flow end-to-end in production | Needs live deployment + learner records |
| 7 | Supabase connectivity from the deployed function | Needs live deployment |
| 8 | Server logs on Vercel | Needs Vercel account |
| 9 | CORS in production | Needs live deployment (expected: same-origin, no config required) |
| 10 | RLS policies observed at runtime | Needs live deployment + non-service-role client |

---

## 5. Exact steps to deploy and verify (owner)

### 5.1 Deploy

```powershell
# From the project root, ensure everything is committed and pushed
git status
git push origin main
```

1. Go to **https://vercel.com → Add New → Project → Import** the GitHub repo
   `mgcinishaun524-source/GMA_Quiz_Offline_Online_Support`.
2. Framework preset: **Vite** (vercel.json overrides the build).
3. **Do not** deploy before setting the environment variables in §5.2.

### 5.2 Environment variables (Project → Settings → Environment Variables)

Set each for **Production + Preview** (the `VITE_` ones must exist at **build** time):

| Name | Value source |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service role) |
| `SUPABASE_JWT_SECRET` | A strong random string you generate (≥ 32 bytes) |
| `INITIAL_ADMIN_PASSWORD` | ≥ 8 chars (bootstraps `darksyntax`) |
| `GEMINI_API_KEY` | Google AI Studio (optional but recommended) |
| `GROQ_API_KEY` | console.groq.com (optional fallback) |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `VITE_APP_MODE` | `production` |
| `ALLOW_DEMO_AUTH` | `false` |
| `NODE_ENV` | `production` |

> ⚠️ Never prefix `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `INITIAL_ADMIN_PASSWORD` or the AI keys with `VITE_`.

### 5.3 Verify after deploy (paste results into §2 above)

- [ ] `GET https://<your-app>.vercel.app/api/health` → `{"supabaseConfigured":true,"authMode":"supabase",...}`
- [ ] The SPA loads at `https://<your-app>.vercel.app/`
- [ ] Browser console shows no errors on the login page
- [ ] Log in as `darksyntax` with `INITIAL_ADMIN_PASSWORD`
- [ ] Create a learner, class and subject (admin console)
- [ ] Log in as the learner (student number + PIN)
- [ ] Export/assign a quiz and confirm it appears for the learner
- [ ] Submit an answer, then release results as the teacher, and confirm the learner sees the correct mark
- [ ] Resize to tablet/mobile width and confirm the layout is usable
- [ ] Toggle the network simulator to confirm the offline state renders

### 5.4 Record the result

Replace the *(none — not deployed/verified)* cells in **§2** with the real URLs and the date you verified them. Then update [README.md §13](../README.md#13-deployment-information).

---

## 6. Local production-mode smoke test (optional pre-deploy check)

```bash
npm run build
npm run start        # runs dist/server.js locally
# then:
curl http://localhost:3000/api/health
```

This exercises the production server bundle — but note it uses your **local** `.env`, so it validates code paths, **not** the live hosting environment.

---

## 7. Deployment configuration reference

| File | Purpose |
|---|---|
| [vercel.json](../vercel.json) | Build command, output dir, `/api` rewrite, function memory + duration |
| [api/index.ts](../api/index.ts) | Serverless entry re-exporting the Express `app` |
| [server.ts](../server.ts) | `app.listen` guarded by `NODE_ENV !== 'test' && VERCEL !== '1'` |
| [.env.example](../.env.example) | Environment template |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Original step-by-step deploy guide |

---

*Related: [README.md](../README.md) · [DEPLOYMENT.md](../DEPLOYMENT.md) · [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md)*
