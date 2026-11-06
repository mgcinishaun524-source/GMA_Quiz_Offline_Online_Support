# Deployment Verification

**Project:** Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
**Document version:** 1.1
**Date:** 2026-11-06
**Status:** ✅ **DEPLOYED AND PARTIALLY VERIFIED — authenticated flows still need the owner**

---

## 1. Summary

The application is **live on Vercel** and the unauthenticated surface has been verified externally on 2026-11-06: the SPA boots, every client-side route resolves, the serverless API answers, and the deployed bundle is the current code-split build.

Two defects were found and fixed during this verification:

1. **Every deep link 404'd.** [vercel.json](../vercel.json) only rewrote `/api/:path*`. Because the project sets `framework: null` + `outputDirectory: "dist"`, Vercel does **not** apply an SPA fallback of its own, so it looked for `dist/login`, found nothing, and returned 404 instead of serving `index.html`. Fixed by appending `{ "source": "/(.*)", "destination": "/index.html" }` **after** the `/api` rule (order matters — the API rule must match first).
2. **The deployed bundle was stale** — the live entry chunk was the pre-code-splitting 984 kB build. Fixed by pushing the code-splitting work, which triggered a redeploy; the entry chunk is now **352 kB**.

Flows that need real credentials (staff login, learner PIN login, results release, RLS at runtime) are **not** verified here and remain owner actions — see §5.

---

## 2. Verified production URLs

| Target | Platform | Verified URL | Status |
|---|---|---|---|
| **Frontend** | Vercel | `https://gma-quiz-offline-online-support.vercel.app` | ✅ live — `/` returns 200 |
| **Backend API** | Vercel serverless function | `https://gma-quiz-offline-online-support.vercel.app/api/*` | ✅ live — `/api/health` returns 200 |
| **Database / Auth** | Supabase | `https://qfsvuzczjotvtbttdtjc.supabase.co` (project ref from source) | ✅ reachable — the deployed function reports `supabaseConfigured: true`, `authMode: "supabase"` |

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

## 4. Live production verification (2026-11-06)

Externally probed against the deployment above. Status codes are as returned by Vercel.

| # | Check | Result |
|---|---|---|
| 1 | `GET /` | ✅ 200 (`text/html`, 1.55 kB) |
| 2 | `GET /login` | ✅ 200 — SPA fallback returns `index.html` |
| 3 | `GET /unauthorized` | ✅ 200 |
| 4 | `GET /teacher/dashboard` | ✅ 200 |
| 5 | `GET /learner/dashboard` | ✅ 200 |
| 6 | `GET /admin/dashboard` | ✅ 200 |
| 7 | `GET /api/health` | ✅ 200 — `{"status":"ok","service":"Growing Minds Academy Assessment Backend","version":"1.0.0","geminiConfigured":true,"groqConfigured":true,"aiConfigured":true,"supabaseConfigured":true,"authMode":"supabase"}` |
| 8 | `GET /assets/Logo.png` | ✅ 200 (`image/png`) |
| 9 | Entry chunk is the code-split build | ✅ `/assets/index-BMGFs0UQ.js` = **352,269 bytes** (was 984,262 bytes) |
| 10 | Portal page chunks are emitted and served | ✅ **22** page chunks referenced by the entry (e.g. `AdminDashboard-D9spvhAG.js` 10.3 kB, `AdminAnalyticsPage-CylJnnTX.js` 29.5 kB), each returning 200 with `application/javascript` |
| 11 | API keys reach the deployment | ✅ `geminiConfigured`, `groqConfigured` and `aiConfigured` are all `true` |
| 12 | Fail-closed posture in production | ✅ reports `authMode: "supabase"` — no demo/local fallback |

> Item 10 is the direct check that the SPA fallback rewrite did **not** swallow static assets: Vercel matches files on disk before applying rewrites, so `/assets/*` still serves the real file rather than `index.html`.

### Still unverified (needs credentials or a browser)

| Check | Why it is still open |
|---|---|
| Staff login round-trip (`darksyntax` + `INITIAL_ADMIN_PASSWORD`) | Requires the owner's production password |
| Learner login (student number + PIN) and the results flow | Requires learner records in the production database |
| Browser console is error-free on the login page | Requires a real browser session |
| RLS policies observed at runtime | Requires a non-service-role client |
| Vercel build/server logs | Requires the owner's Vercel account |

---

## 5. What could NOT be verified (requires the owner)

| # | Check | Why blocked |
|---|---|---|
| 1 | ~~Live frontend URL loads~~ | ✅ **verified 2026-11-06** — see §4 |
| 2 | Responsive behaviour in a real browser | Needs a browser session |
| 3 | Browser console is error-free | Needs a browser session |
| 4 | ~~`/api/health` returns `authMode: "supabase"`~~ | ✅ **verified 2026-11-06** — see §4 |
| 5 | Staff login round-trip against Supabase Auth in production | Needs admin credentials |
| 6 | Learner login + results flow end-to-end in production | Needs learner records |
| 7 | Supabase connectivity from the deployed function | Needs a data-touching request (health only reports configuration) |
| 8 | Server logs on Vercel | Needs Vercel account |
| 9 | CORS in production | Expected: same-origin, no config required — not independently confirmed |
| 10 | RLS policies observed at runtime | Needs a non-service-role client |

---

## 6. Exact steps to deploy and verify (owner)

### 6.1 Deploy

```powershell
# From the project root, ensure everything is committed and pushed
git status
git push origin main
```

1. Go to **https://vercel.com → Add New → Project → Import** the GitHub repo
   `mgcinishaun524-source/GMA_Quiz_Offline_Online_Support`.
2. Framework preset: **Vite** (vercel.json overrides the build).
3. **Do not** deploy before setting the environment variables in §6.2.

> The deployment already exists, so normally you only `git push origin main` and Vercel rebuilds automatically.

### 6.2 Environment variables (Project → Settings → Environment Variables)

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

### 6.3 Verify after deploy

Already confirmed on 2026-11-06 (see §4):

- [x] `GET https://gma-quiz-offline-online-support.vercel.app/api/health` → `{"supabaseConfigured":true,"authMode":"supabase",...}`
- [x] The SPA loads at `https://gma-quiz-offline-online-support.vercel.app/`
- [x] Every client-side route resolves (no 404 on `/login`, `/teacher/dashboard`, `/learner/dashboard`, `/admin/dashboard`)

Still to confirm by the owner (needs credentials / a browser):

- [ ] Browser console shows no errors on the login page
- [ ] Log in as `darksyntax` with `INITIAL_ADMIN_PASSWORD`
- [ ] Create a learner, class and subject (admin console)
- [ ] Log in as the learner (student number + PIN)
- [ ] Assign a quiz and confirm it appears for the learner
- [ ] Submit an answer, then release results as the teacher, and confirm the learner sees the correct mark
- [ ] Resize to tablet/mobile width and confirm the layout is usable
- [ ] Toggle the network simulator to confirm the offline state renders

### 6.4 Record the result

§2 now holds the live URLs. Complete the owner checklist in §6.3, then update [README.md §13](../README.md#13-deployment-information).

---

## 7. Local production-mode smoke test (optional pre-deploy check)

```bash
npm run build
npm run start        # runs dist/server.js locally
# then:
curl http://localhost:3000/api/health
```

This exercises the production server bundle — but note it uses your **local** `.env`, so it validates code paths, **not** the live hosting environment.

---

## 8. Deployment configuration reference

| File | Purpose |
|---|---|
| [vercel.json](../vercel.json) | Build command, output dir, `/api` rewrite, SPA fallback rewrite, function memory + duration |
| [api/index.ts](../api/index.ts) | Serverless entry re-exporting the Express `app` |
| [server.ts](../server.ts) | `app.listen` guarded by `NODE_ENV !== 'test' && VERCEL !== '1'` |
| [.env.example](../.env.example) | Environment template |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Original step-by-step deploy guide |

---

*Related: [README.md](../README.md) · [DEPLOYMENT.md](../DEPLOYMENT.md) · [docs/SUBMISSION_GAP_ANALYSIS.md](SUBMISSION_GAP_ANALYSIS.md)*
