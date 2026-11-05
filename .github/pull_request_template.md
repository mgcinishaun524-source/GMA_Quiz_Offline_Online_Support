<!--
  Growing Minds Academy — Pull Request Template
  Fill in every section. A PR that cannot be reviewed from its description
  will be sent back.
-->

## Summary

<!-- One or two sentences: what does this PR change and why? -->

## Related Issue

<!-- Required: reference the issue this PR resolves. -->
Closes #

## Type of Change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `docs` — documentation only
- [ ] `test` — adding or updating tests
- [ ] `chore` / `ci` — build, tooling or dependency changes
- [ ] `security` — security-related change

## Changes Made

<!-- Bullet list of the concrete changes. -->
-

## Layer(s) Touched

- [ ] Frontend (`src/`)
- [ ] Backend API (`server.ts`, `server/`)
- [ ] Database (`supabase/migrations/`)
- [ ] Documentation (`docs/`, root `*.md`)
- [ ] Deployment / configuration (`vercel.json`, `.env.example`)

## How This Was Tested

<!-- Paste exact commands and observed results. Do not write "tested locally" without evidence. -->

```bash
npm run lint
npm test
npx tsx test/offline-sync.test.ts
npm run build
```

Result:

<!-- e.g. lint clean · 45/45 tests pass · build succeeds -->

## Screenshots / Recordings

<!-- For UI changes, attach before/after screenshots. Delete this section if not applicable. -->

## Checklist

- [ ] The branch is up to date with `main`
- [ ] `npm run lint` passes
- [ ] `npm test` passes (and `offline-sync` if affected)
- [ ] `npm run build` succeeds
- [ ] No secrets, keys, tokens or real credentials are included
- [ ] No production data was modified
- [ ] Documentation updated where behaviour changed
- [ ] The linked issue's acceptance criteria are met

## Reviewer Notes

<!-- Anything the reviewer should focus on, known limitations, or follow-ups. -->
