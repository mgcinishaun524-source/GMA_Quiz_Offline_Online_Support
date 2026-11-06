# Live Authenticated Verification Report

**Project:** Growing Minds Academy — AI Quiz System
**Date:** 2026-11-06
**Branch / Commit:** `main` @ `91b33f5` (working tree clean — no application source changed)
**Backend:** Express (`server.ts`) against live Supabase PostgreSQL + Supabase Auth
**Environment:** `GET /api/health` → `200`, `supabaseConfigured: true`, `authMode: "supabase"`

## Scope

Run the remaining live verification steps against the configured Supabase project
(admin + learner login round-trips, concurrent-duplicate submission check, submit-path
verification end-to-end), then remove all test records. This is verification-only: no
production code was modified.

## Result Summary

| # | Phase | Check | Result |
|---|-------|-------|--------|
| A | Server | `/api/health` reports `authMode: "supabase"` | **PASS** |
| B | Admin auth | `POST /api/auth/staff-login` + `GET /api/auth/me` | **PASS** |
| C | Teacher auth | Provision teacher + staff-login + `/me` | **PASS** |
| D | Quiz lifecycle | D1–D9 (create → publish → submit → release → results → answer-key → teacher view) | **PASS** |
| E | Submit hardening | 8 concurrent identical submissions persist exactly once | **PASS** |
| F | Learner auth | learner-login (correct PIN 200 / wrong PIN 401) + `/me` | **PASS** |
| G | Cleanup | All test records removed; baseline restored | **PASS** |

## Detail

### A. Server / configuration
`GET /api/health` → `200` with `supabaseConfigured: true`, `geminiConfigured: true`,
`groqConfigured: true`, `authMode: "supabase"`.

### B. Admin login round-trip
`POST /api/auth/staff-login` (`darksyntax`) → `200` + token; `GET /api/auth/me` → `200`,
`role: admin`, `school_id` present.

### C. Teacher provisioning + login round-trip
`POST /api/teachers` (admin) → `201`, `persisted: true`. Then `POST /api/auth/staff-login`
with the generated credentials → `200` + token, `role: teacher`; `GET /api/auth/me` → `200`,
`role: teacher`, name/email/school_id present.

### D. Full quiz lifecycle (live Supabase)
All nine assertions passed:

- D1 create draft → `201`
- D2 publish → `200`, status `in_progress`
- D4 learner submit → `200`, marks masked (`score 0 / 0%`), status `submitted`
- D5 teacher release results → `200`
- D6 identical resubmit → idempotent (`isDuplicate: true`)
- D7 learner results after release → `200`, `score 2 / 50%`, status `marked`
- D8 learner requests answer key → `403` (protected)
- D9 teacher views submissions → `200`, `1` submission

### E. Concurrent-duplicate submit-path verification
Eight concurrent `POST /api/submissions` with the **same** `clientSubmissionHash`:

- HTTP: 8/8 `200`, zero `5xx`
- Persisted rows for that hash: **exactly 1**

Sequential idempotency is covered by D6; for concurrent bursts the surviving guarantee is
the DB unique constraint on `client_submission_hash` (`saveSubmission` catches `23505` and
returns the existing row). Data is correct: one row, no duplicates, no errors.

### F. Learner login round-trip
Created an isolated test learner with a known 4-digit PIN:

- wrong PIN → `401` (rejected)
- correct PIN → `200` + token, `role: learner`
- `GET /api/auth/me` → `200`, `role: learner`, class + school_id present

## Root Cause Found & Fixed (recurring teacher-provision 400)

Earlier runs of the teacher provisioning script failed deterministically with
`400 "A user with this email address has already been registered"`, even though equivalent
probes succeeded.

**Cause:** the script used a hardcoded address `testteacher_deleteme@gma.edu`, which is
permanently blocked in Supabase Auth by a hidden/soft-deleted user row that
`admin.listUsers()` never returns — so it could not be found or cleared via the API.

**Proof** (`probe-delete-semantics.mjs`):

```
fixed_create                      -> ERROR: already registered
unique_create                     -> CREATED
default delete -> recreate        -> CREATED   (deleteUser does not block reuse)
hard delete    -> recreate        -> CREATED
```

**Fix:** provision with a unique address per run
(`testteacher_deleteme_<ts>_<rand>@gma.edu`). Only the teacher UUID matters downstream, so
this is correct and safe. The provisioning script now also performs the login round-trip
and emits the session JWT consumed by the lifecycle test.

## Observations (non-blocking, no action taken)

1. **Duplicate flag on concurrent bursts.** Of 8 concurrent identical submissions, only 2
   responses reported `isDuplicate: true`. Requests deduped inside `saveSubmission` via the
   `23505` path still return `isDuplicate: false`. Persistence is correct (1 row, all `200`),
   but the response flag is not a reliable concurrency signal. Possible hardening: after
   `saveSubmission`, detect that an existing row was returned and set the flag accordingly.
2. **Admin cannot author quizzes.** The admin account logs in but has no `user_profiles`
   row, so `quizzes.author_id` FK rejects inserts. Verification therefore used a teacher
   session. Not a defect for normal flows.
3. **Legacy stuck address.** `testteacher_deleteme@gma.edu` remains blocked by a hidden
   auth row that cannot be cleared through the API. Cosmetic only.

## Cleanup / Residual-State Verification

| Item | Before | Removed | After |
|------|--------|---------|-------|
| Test quizzes (`%Test Quiz (DELETE ME)%`) | 1 | 1 | **0** |
| Test teacher (auth + profile) | 1 | 1 | **0** |
| Residual test-teacher profiles | 2 | 2 | **0** |
| Residual test learners (`%DELETE ME%`) | 1 | 1 | **0** |

Final totals: **9 teachers, 9 quizzes, 20 learners**, no test artefacts remaining
(`verify-clean-state.mjs` → `clean: true`).

## Conclusion

All steps in the requested live-verification scope passed against the configured Supabase
project. The recurring teacher-provisioning failure was root-caused and resolved at the
script level. All created test records were removed and the database was returned to its
baseline. No application source files were modified (git tree clean at `91b33f5`).
