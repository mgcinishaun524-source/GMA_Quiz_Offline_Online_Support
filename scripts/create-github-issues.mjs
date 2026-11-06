#!/usr/bin/env node
/**
 * GitHub submission bootstrap for the Growing Minds Academy AI Quiz System.
 *
 * Creates the submission labels and the 44 issue drafts from
 * docs/GITHUB_SETUP_GUIDE.md, and closes the ones that document work already
 * present in the Git history (ISSUE-01 … ISSUE-35). The genuinely outstanding
 * items (ISSUE-36 … ISSUE-44) are created open.
 *
 * Idempotent: re-running skips any issue that already exists by title and
 * re-aligns its open/closed state, so it is safe to run repeatedly.
 *
 * Usage (PowerShell):
 *   $env:GITHUB_TOKEN="<your-token>"
 *   node scripts/create-github-issues.mjs --dry-run    # preview, no writes
 *   node scripts/create-github-issues.mjs             # apply
 *
 * Token: a classic PAT with the `public_repo` scope (or `repo` for a private
 * repository). The token is read from the environment only — it is never
 * hardcoded, written to disk, printed, or committed. Do not pass it on the
 * command line, where it would land in your shell history.
 */

const OWNER_REPO =
  process.env.GITHUB_REPO ?? 'mgcinishaun524-source/GMA_Quiz_Offline_Online_Support';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const DRY_RUN = process.argv.includes('--dry-run');
const API_ROOT = 'https://api.github.com';

/** Delay between mutating calls, to stay clear of secondary rate limits. */
const WRITE_DELAY_MS = 1100;

const LABELS = [
  { name: 'frontend', color: '6CABDD', description: 'SPA / UI work' },
  { name: 'backend', color: '1C2C5B', description: 'Express API work' },
  { name: 'database', color: '0E7C66', description: 'Supabase / migrations' },
  { name: 'security', color: 'B60205', description: 'Auth / hardening' },
  { name: 'testing', color: 'FBCA04', description: 'Tests' },
  { name: 'ui/ux', color: 'D4A017', description: 'Design & usability' },
  { name: 'offline', color: '5319E7', description: 'Offline / sync' },
  { name: 'deployment', color: '0075CA', description: 'Vercel / hosting' },
  { name: 'documentation', color: '0075CA', description: 'Docs' },
  { name: 'bug', color: 'D73A4A', description: 'Defect' },
  { name: 'enhancement', color: 'A2EEEF', description: 'New capability' },
  { name: 'technical-debt', color: 'F9D0C4', description: 'Refactor / non-functional' },
];

/**
 * `state` is the truthful state of each item: 'Done' means the work is already
 * in the Git history, 'Backlog' means it is genuinely outstanding.
 */
const ISSUES = [
  {
    id: 'ISSUE-01',
    title: 'Implement dual authentication (staff Supabase Auth + learner PIN/JWT)',
    labels: ['backend', 'security'],
    state: 'Done',
    description:
      'Provide two independent login paths: staff authenticate through Supabase Auth; learners authenticate with a student number + PIN verified against a salted bcrypt hash, receiving a locally signed session JWT.',
    criteria: `
- [x] Staff login resolves username/email then calls Supabase Auth
- [x] Learner PIN verified with bcrypt cost 12
- [x] Learner token signed with \`SUPABASE_JWT_SECRET\`, 12 h expiry
- [x] \`requireAuth\` accepts both token types`,
  },
  {
    id: 'ISSUE-02',
    title: 'Add role-based access control middleware',
    labels: ['backend', 'security'],
    state: 'Done',
    description: 'Enforce `admin` / `teacher` / `learner` roles per route with `requireRole`.',
    criteria: `
- [x] 401 when unauthenticated, 403 on role mismatch
- [x] Applied to every protected route`,
  },
  {
    id: 'ISSUE-03',
    title: 'Fail closed when Supabase is not configured',
    labels: ['backend', 'security'],
    state: 'Done',
    description:
      'Return HTTP 503 for data routes when Supabase is unconfigured instead of falling back to mock/in-memory data.',
    criteria: `
- [x] No mock data path remains in production
- [x] \`/api/health\` reports configuration state
- [x] Failed saves are never reported as success`,
  },
  {
    id: 'ISSUE-04',
    title: 'Implement quiz lifecycle endpoints',
    labels: ['backend'],
    state: 'Done',
    description:
      'Provide publish, close, assign, and release-results endpoints with persisted status transitions.',
    criteria: `
- [x] \`POST /api/quizzes/:id/publish\`
- [x] \`POST /api/quizzes/:id/close\` persists \`closed_at\` + audit event
- [x] \`POST /api/quizzes/:id/assign\`
- [x] \`POST /api/quizzes/:id/release-results\``,
  },
  {
    id: 'ISSUE-05',
    title: 'Implement server-side grading',
    labels: ['backend', 'security'],
    state: 'Done',
    description: 'Grade submissions on the server so scores cannot be influenced by the client.',
    criteria: `
- [x] Correct answers never sent to learners
- [x] Aggregate score/percentage computed server-side
- [x] Stored on the submission`,
  },
  {
    id: 'ISSUE-06',
    title: 'Mask marks until the teacher releases results',
    labels: ['backend', 'security'],
    state: 'Done',
    description:
      '`GET /api/learners/results` must return zeroed marks until the quiz is `results_released` (or automatic release).',
    criteria: `
- [x] Unreleased quizzes return \`score: 0\`, \`percentage: 0\`, and a clear message
- [x] Released quizzes return the real marks`,
  },
  {
    id: 'ISSUE-07',
    title: 'Fix learner results 0% bug (identity matching)',
    labels: ['backend', 'bug'],
    state: 'Done',
    description:
      'Released marks displayed as 0% because the client matched submissions on student number only, missing records keyed by learner UUID.',
    criteria: `
- [x] Lookup matches on student number **or** UUID
- [x] "My Results" re-syncs with the server
- [x] Verified live: released marks flow through (commit \`829fa6c\`)`,
  },
  {
    id: 'ISSUE-08',
    title: 'Persist assignment close to the server',
    labels: ['backend', 'bug'],
    state: 'Done',
    description: 'Closing a quiz only changed client state, so learners still saw it as active.',
    criteria: `
- [x] \`POST /api/quizzes/:id/close\` updates \`closed_at\`
- [x] Audit event emitted
- [x] Teacher close buttons wired to the endpoint (commit \`668d94b\`)`,
  },
  {
    id: 'ISSUE-09',
    title: 'AI quiz generation with Gemini primary + Groq fallback',
    labels: ['backend', 'enhancement'],
    state: 'Done',
    description:
      'Generate quizzes with Gemini and automatically fall back to Groq on failure; implement a top-up loop to reach the requested count.',
    criteria: `
- [x] Fallback chain starts at \`gemini-2.5-flash\`
- [x] Groq retried on Gemini 503/rate-limit
- [x] Top-up loop fills missing items
- [x] Supports up to 200 questions in 10-question chunks`,
  },
  {
    id: 'ISSUE-10',
    title: 'Serve AI keys to the browser for direct provider calls',
    labels: ['backend', 'security'],
    state: 'Done',
    description:
      'Expose provider keys to authenticated teachers via `GET /api/ai/client-config` so long generations bypass the Vercel timeout without hard-coding keys.',
    criteria: `
- [x] Endpoint requires \`teacher\`/\`admin\` role
- [x] Keys never placed in the client bundle
- [x] No keys logged`,
  },
  {
    id: 'ISSUE-11',
    title: 'Offline submission sync with idempotency',
    labels: ['backend', 'offline'],
    state: 'Done',
    description:
      '`POST /api/submissions/sync` accepts queued offline submissions and deduplicates them.',
    criteria: `
- [x] \`client_submission_hash\` UNIQUE prevents duplicates
- [x] Replays are safe
- [x] Server-authoritative score persisted`,
  },
  {
    id: 'ISSUE-12',
    title: 'Audit event logging',
    labels: ['backend'],
    state: 'Done',
    description: 'Record lifecycle and admin actions to `audit_events`.',
    criteria: `
- [x] Action, actor, role, target, metadata, IP captured
- [x] Falls back to server log when the DB is unavailable`,
  },
  {
    id: 'ISSUE-13',
    title: 'Initial database schema (14 tables) with constraints',
    labels: ['database'],
    state: 'Done',
    description: 'Create the core relational schema.',
    criteria: `
- [x] 14 tables with PKs/FKs and ON DELETE rules
- [x] CHECK constraints on statuses/roles
- [x] UNIQUE constraints on natural keys`,
  },
  {
    id: 'ISSUE-14',
    title: 'Enable Row Level Security on all tables',
    labels: ['database', 'security'],
    state: 'Done',
    description: 'Enable RLS and define school/role-scoped policies.',
    criteria: `
- [x] RLS enabled on all 14 tables
- [x] \`current_user_school_id()\` / \`current_user_role()\` helpers (SECURITY DEFINER)
- [x] Named policies per table`,
  },
  {
    id: 'ISSUE-15',
    title: 'Learner question view that hides the answer key',
    labels: ['database', 'security'],
    state: 'Done',
    description: '`learner_active_quiz_questions` view strips `correct_answer`/`explanation`.',
    criteria: `
- [x] Answer key absent from the view
- [x] Only active quiz states exposed`,
  },
  {
    id: 'ISSUE-16',
    title: 'Add `due_date` and cohort FK to quizzes',
    labels: ['database'],
    state: 'Done',
    description: 'Migration `20261022000001`.',
    criteria: `
- [x] \`quizzes.due_date\` added
- [x] \`quizzes.class_id\` FK (SET NULL)
- [x] Indexes added + rollback SQL documented`,
  },
  {
    id: 'ISSUE-17',
    title: 'Add staff `username` to user_profiles',
    labels: ['database'],
    state: 'Done',
    description: 'Migration `20261026000001` for short staff login identifiers.',
    criteria: `
- [x] Nullable \`username\`
- [x] Case-insensitive unique index`,
  },
  {
    id: 'ISSUE-18',
    title: 'Persist directory associations',
    labels: ['database'],
    state: 'Done',
    description:
      'Migration `20261027000001` for class↔subject and teacher↔class/subject arrays.',
    criteria: `
- [x] Three UUID[] columns
- [x] GIN indexes`,
  },
  {
    id: 'ISSUE-19',
    title: 'Fix admin INSERT/DELETE RLS policies on user_profiles',
    labels: ['database', 'bug'],
    state: 'Done',
    description: 'Migration `20261027000002` adds missing admin policies (uses `DROP POLICY IF EXISTS`).',
    criteria: `
- [x] Admin can insert/delete school profiles
- [x] Re-runnable`,
  },
  {
    id: 'ISSUE-20',
    title: 'Brute-force lockout and IP rate limiting',
    labels: ['security'],
    state: 'Done',
    description: '5 failed attempts → 15 min lockout; 10 requests/min per IP.',
    criteria: `
- [x] Lockout checked before credential verification
- [x] Counter cleared on success`,
  },
  {
    id: 'ISSUE-21',
    title: 'Session isolation on login/logout',
    labels: ['security'],
    state: 'Done',
    description: 'Clear all `GMA_STORE_*` localStorage keys and in-memory stores when a user changes.',
    criteria: `
- [x] \`clearSessionData()\` on staff login, learner login, logout
- [x] No cross-user data leakage (commit \`9633787\`)`,
  },
  {
    id: 'ISSUE-22',
    title: 'Teacher data isolation',
    labels: ['security'],
    state: 'Done',
    description: 'Scope teachers to their assigned classes/subjects.',
    criteria: `
- [x] Assignments loaded at auth time
- [x] Applied to quiz/submission access (commit \`8486785\`)`,
  },
  {
    id: 'ISSUE-23',
    title: 'Build the administrator directory management UI',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'CRUD screens for teachers, learners, classes, subjects, plus settings and analytics.',
    criteria: `
- [x] All six admin pages implemented
- [x] Real-data tables with empty states`,
  },
  {
    id: 'ISSUE-24',
    title: 'Build the AI Quiz Wizard UI',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'Teacher-facing quiz creation with AI generation controls.',
    criteria: `
- [x] Topic/subject/grade/count inputs
- [x] Progress and error feedback
- [x] Draft persistence`,
  },
  {
    id: 'ISSUE-25',
    title: 'Build the learner quiz player',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'Clean quiz-taking UI with autosave and progress.',
    criteria: `
- [x] Question navigation
- [x] Autosave answers
- [x] Submission confirmation`,
  },
  {
    id: 'ISSUE-26',
    title: 'Build the learner results portal',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'Show released marks only.',
    criteria: `
- [x] Hidden until release
- [x] Honest empty state`,
  },
  {
    id: 'ISSUE-27',
    title: 'Build teacher analytics dashboards',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'Per-quiz and per-class analytics from real records.',
    criteria: `
- [x] Charts derived from DB records only
- [x] No fabricated statistics`,
  },
  {
    id: 'ISSUE-28',
    title: 'Implement offline IndexedDB storage and sync queue',
    labels: ['frontend', 'offline'],
    state: 'Done',
    description: 'Cache questions and queue submissions in `GMA_Offline_DB`.',
    criteria: `
- [x] Questions available offline
- [x] Queue replays on reconnect
- [x] Idempotent by hash`,
  },
  {
    id: 'ISSUE-29',
    title: 'Responsive tablet layout and brand styling',
    labels: ['frontend', 'ui/ux'],
    state: 'Done',
    description: 'Manchester City-inspired palette; desktop + tablet layouts.',
    criteria: `
- [x] Responsive breakpoints
- [x] Consistent tokens
- [x] Accessible contrast on key actions`,
  },
  {
    id: 'ISSUE-30',
    title: 'Printable quiz paper and answer key',
    labels: ['frontend'],
    state: 'Done',
    description: 'Print views for quiz papers and teacher answer keys.',
    criteria: `
- [x] \`/api/quizzes/:id/paper\` and \`/answer-key\`
- [x] Print-friendly rendering`,
  },
  {
    id: 'ISSUE-31',
    title: 'Write the security test suite (19 tests)',
    labels: ['testing'],
    state: 'Done',
    description: 'Cover auth, RBAC, fail-closed behaviour, secret isolation.',
    criteria: `
- [x] 19 tests passing
- [x] Provider keys pinned empty where required`,
  },
  {
    id: 'ISSUE-32',
    title: 'Write the adapter test suite (9 tests)',
    labels: ['testing'],
    state: 'Done',
    description: 'Cover `databaseAdapter` mapping/behaviour.',
    criteria: `
- [x] 9 tests passing`,
  },
  {
    id: 'ISSUE-33',
    title: 'Write the generation-and-export test suite (6 tests)',
    labels: ['testing'],
    state: 'Done',
    description: 'Cover AI parsing and export logic.',
    criteria: `
- [x] 6 tests passing
- [x] Field-aliasing parsing covered`,
  },
  {
    id: 'ISSUE-34',
    title: 'Write the offline-sync test suite (11 tests)',
    labels: ['testing', 'offline'],
    state: 'Done',
    description: 'Cover offline DB + sync queue behaviour.',
    criteria: `
- [x] 11 tests passing
- [ ] **Outstanding:** wire this suite into \`npm test\` (currently run separately)`,
  },
  {
    id: 'ISSUE-35',
    title: 'Add Vercel deployment configuration',
    labels: ['deployment'],
    state: 'Done',
    description: 'SPA + serverless API on one domain.',
    criteria: `
- [x] \`vercel.json\` build/output/rewrite
- [x] Function memory + maxDuration
- [x] \`api/index.ts\` entry`,
  },
  {
    id: 'ISSUE-36',
    title: 'Add pagination to list endpoints',
    labels: ['backend', 'technical-debt'],
    state: 'Backlog',
    description: 'List endpoints return all rows; add limit/offset or cursor pagination.',
    criteria: `
- [ ] Pagination params on \`/api/quizzes\`, \`/api/learners\`, \`/api/submissions\`
- [ ] Backwards-compatible defaults
- [ ] Documented in \`docs/API.md\``,
  },
  {
    id: 'ISSUE-37',
    title: 'Add a CI pipeline (lint + tests + build)',
    labels: ['technical-debt', 'deployment'],
    state: 'Backlog',
    description: 'No CI currently runs on push/PR.',
    criteria: `
- [ ] GitHub Actions workflow running \`npm run lint\`, \`npm test\`, \`npm run build\`
- [ ] Status check required on \`main\``,
  },
  {
    id: 'ISSUE-38',
    title: 'Add code coverage reporting',
    labels: ['testing', 'technical-debt'],
    state: 'Backlog',
    description: 'No coverage tooling is configured.',
    criteria: `
- [ ] Coverage provider added
- [ ] Coverage reported in CI
- [ ] Threshold agreed`,
  },
  {
    id: 'ISSUE-39',
    title: 'Persist per-question correctness on submission_answers',
    labels: ['backend', 'database', 'bug'],
    state: 'Backlog',
    description: '`is_correct` is `null` and `marks_awarded` is `0` for all answers.',
    criteria: `
- [ ] Correctness persisted per answer
- [ ] Marks persisted per answer
- [ ] Backfill strategy for existing rows (if required)`,
  },
  {
    id: 'ISSUE-40',
    title: 'Reduce frontend bundle size',
    labels: ['frontend', 'technical-debt'],
    state: 'Done',
    description:
      'The main JS chunk was 977 kB (gzip 269 kB) and tripped the >500 kB build warning. Recharts and the quiz wizard accounted for most of it, and neither is needed on most routes.',
    criteria: `
- [x] Route-level code splitting — every portal page behind \`React.lazy\` + Suspense in \`src/app/router.tsx\`
- [x] No chunk > 500 kB — entry chunk 984 kB → 352 kB (gzip 271 kB → 110 kB); largest remaining chunk is Recharts at 371 kB
- [x] Bundle budget documented — entry < 400 kB, no chunk > 500 kB (see KNOWN_ISSUES.md P-02)`,
  },
  {
    id: 'ISSUE-41',
    title: 'Move lockout/rate-limit state to a shared store',
    labels: ['backend', 'security', 'technical-debt'],
    state: 'Backlog',
    description: 'In-memory counters are per-instance on Vercel.',
    criteria: `
- [ ] Shared store (e.g. Upstash/Redis) or documented platform limit
- [ ] Behaviour consistent across instances`,
  },
  {
    id: 'ISSUE-42',
    title: 'Capture application screenshots for the submission',
    labels: ['documentation', 'ui/ux'],
    state: 'Backlog',
    description: 'No screenshots exist in the repo.',
    criteria: `
- [ ] Screenshots for the 8 listed screens
- [ ] Stored in \`docs/screenshots/\`
- [ ] Referenced from README §15`,
  },
  {
    id: 'ISSUE-43',
    title: 'Verify and record the live deployment URL',
    labels: ['deployment', 'documentation'],
    state: 'Backlog',
    description: 'No production URL exists.',
    criteria: `
- [ ] Vercel deployment live
- [ ] \`/api/health\` verified
- [ ] URL recorded in README §13 and \`docs/DEPLOYMENT_VERIFICATION.md\``,
  },
  {
    id: 'ISSUE-44',
    title: 'Run a secret scan over Git history',
    labels: ['security', 'technical-debt'],
    state: 'Done',
    description:
      'No secret scan had been performed. `gitleaks` is not installed on the build machine, so `scripts/secret-scan.mjs` was written to scan every blob reachable from any ref plus the reflog.',
    criteria: `
- [x] \`scripts/secret-scan.mjs\` run over the full history — \`gitleaks\` unavailable, substitute documented
- [x] 0 findings; the single placeholder (\`YOUR_GEMINI_API_KEY\` in \`.env.example\`) correctly ignored
- [x] Detector validated against a synthetic repository containing fake credentials
- [x] Result recorded in \`docs/SECURITY.md\` §7.1`,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Build the issue body from the description and acceptance criteria. */
function buildBody(issue) {
  return [
    `> Tracked from \`docs/GITHUB_SETUP_GUIDE.md\` (${issue.id}).`,
    '',
    issue.description,
    '',
    '**Acceptance criteria:**',
    issue.criteria.trim(),
  ].join('\n');
}

function fatal(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/**
 * Call the GitHub REST API. Returns the status and parsed payload without
 * throwing on non-2xx so callers can branch on the status.
 */
async function api(method, path, body) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gma-submission-bootstrap',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: res.status, ok: res.ok, payload, retryAfter: res.headers.get('retry-after') };
}

/** Retry once the rate limit resets, up to three times. */
async function apiWithRetry(method, path, body, attempt = 1) {
  const result = await api(method, path, body);
  const rateLimited = result.status === 403 || result.status === 429;
  if (rateLimited && attempt <= 3) {
    const waitMs = (Number(result.retryAfter) || 60) * 1000 + 2000;
    console.log(
      `  … rate limited (HTTP ${result.status}), waiting ${Math.round(waitMs / 1000)}s (retry ${attempt}/3)`,
    );
    await sleep(waitMs);
    return apiWithRetry(method, path, body, attempt + 1);
  }
  return result;
}

function describeError(result) {
  const message = result.payload?.message ?? JSON.stringify(result.payload);
  const details = Array.isArray(result.payload?.errors)
    ? ` — ${result.payload.errors.map((e) => e.message ?? JSON.stringify(e)).join('; ')}`
    : '';
  return `HTTP ${result.status}: ${message}${details}`;
}

/** Create or update every label so colours stay consistent. */
async function ensureLabels() {
  console.log(`\nLabels (${LABELS.length})`);
  let created = 0;
  let updated = 0;

  for (const label of LABELS) {
    if (DRY_RUN) {
      console.log(`  ? ${label.name}`);
      continue;
    }
    const body = { name: label.name, color: label.color, description: label.description };
    const created_ = await apiWithRetry('POST', `/repos/${OWNER_REPO}/labels`, body);

    if (created_.status === 201) {
      console.log(`  + ${label.name}`);
      created++;
    } else if (created_.status === 422) {
      // Already exists — re-align the colour/description.
      const patched = await apiWithRetry('PATCH', `/repos/${OWNER_REPO}/labels/${encodeURIComponent(label.name)}`, body);
      console.log(patched.ok ? `  ~ ${label.name}` : `  ! ${label.name} (${describeError(patched)})`);
      if (patched.ok) updated++;
    } else {
      console.log(`  ! ${label.name} (${describeError(created_)})`);
    }
    await sleep(WRITE_DELAY_MS);
  }

  if (!DRY_RUN) console.log(`  → ${created} created, ${updated} updated`);
}

/** Map of every existing issue title to its number and state. */
async function fetchExistingIssues() {
  const existing = new Map();
  let page = 1;

  for (;;) {
    const result = await api(
      'GET',
      `/repos/${OWNER_REPO}/issues?state=all&per_page=100&page=${page}`,
    );
    if (!result.ok) fatal(`Could not list existing issues — ${describeError(result)}`);

    const items = result.payload.filter((item) => !item.pull_request);
    for (const item of items) {
      existing.set(item.title, { number: item.number, state: item.state });
    }
    if (result.payload.length < 100) break;
    page++;
  }
  return existing;
}

async function ensureIssues(existing) {
  console.log(`\nIssues (${ISSUES.length})`);
  const summary = { created: 0, closed: 0, skipped: 0, failed: 0 };

  for (const issue of ISSUES) {
    const desiredState = issue.state === 'Done' ? 'closed' : 'open';
    const current = existing.get(issue.title);

    if (DRY_RUN) {
      const action = current ? `exists as #${current.number}` : 'would create';
      console.log(`  ? ${issue.id} — ${action} (${desiredState})`);
      continue;
    }

    if (current) {
      let note = `skipped, already #${current.number}`;
      if (current.state !== desiredState) {
        const patched = await apiWithRetry('PATCH', `/repos/${OWNER_REPO}/issues/${current.number}`, {
          state: desiredState,
          state_reason: desiredState === 'closed' ? 'completed' : 'reopened',
        });
        if (patched.ok) {
          note = `#${current.number} aligned to ${desiredState}`;
          if (desiredState === 'closed') summary.closed++;
        } else {
          note = `#${current.number} state align failed (${describeError(patched)})`;
          summary.failed++;
        }
        await sleep(WRITE_DELAY_MS);
      }
      console.log(`  = ${issue.id} — ${note}`);
      summary.skipped++;
      continue;
    }

    const createdResult = await apiWithRetry('POST', `/repos/${OWNER_REPO}/issues`, {
      title: issue.title,
      body: buildBody(issue),
      labels: issue.labels,
    });

    if (!createdResult.ok) {
      console.log(`  ✗ ${issue.id} — ${describeError(createdResult)}`);
      summary.failed++;
      await sleep(WRITE_DELAY_MS);
      continue;
    }

    const number = createdResult.payload.number;
    console.log(`  + ${issue.id} — #${number}`);
    summary.created++;
    await sleep(WRITE_DELAY_MS);

    if (desiredState === 'closed') {
      const closed = await apiWithRetry('PATCH', `/repos/${OWNER_REPO}/issues/${number}`, {
        state: 'closed',
        state_reason: 'completed',
      });
      if (closed.ok) {
        console.log(`    ↳ closed as completed`);
        summary.closed++;
      } else {
        console.log(`    ↳ close failed (${describeError(closed)})`);
        summary.failed++;
      }
      await sleep(WRITE_DELAY_MS);
    }
  }

  return summary;
}

async function main() {
  console.log('Growing Minds Academy — GitHub submission bootstrap');
  console.log(`  repo   : ${OWNER_REPO}`);
  console.log(`  mode   : ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}`);
  console.log(`  token  : ${TOKEN ? 'provided via GITHUB_TOKEN' : 'NOT SET'}`);

  if (!TOKEN && !DRY_RUN) {
    fatal(
      'GITHUB_TOKEN is not set. Create a classic PAT with the `public_repo` scope, then run:\n' +
        '      $env:GITHUB_TOKEN="<your-token>"\n' +
        '      node scripts/create-github-issues.mjs\n' +
        '    Or preview without a token: node scripts/create-github-issues.mjs --dry-run',
    );
  }

  let existing = new Map();
  if (!DRY_RUN) {
    const repo = await api('GET', `/repos/${OWNER_REPO}`);
    if (!repo.ok) fatal(`Cannot access ${OWNER_REPO} — ${describeError(repo)}`);
    console.log(`  access : ok (${repo.payload.full_name}, default branch ${repo.payload.default_branch})`);
    existing = await fetchExistingIssues();
    console.log(`  issues : ${existing.size} already present`);
  }

  console.log(`\nPlanned: ${LABELS.length} labels, ${ISSUES.length} issues`);

  await ensureLabels();
  const summary = await ensureIssues(existing);

  if (DRY_RUN) {
    console.log('\nDry run complete — nothing was written. Re-run without --dry-run to apply.');
    return;
  }

  console.log('\n' + '-'.repeat(58));
  console.log(
    `Issues: ${summary.created} created · ${summary.closed} closed · ${summary.skipped} already present · ${summary.failed} failed`,
  );
  console.log('-'.repeat(58));

  console.log(`
Next steps (owner, still manual):

  1. Project board — create a Board project named "GMA Quiz System — Delivery"
     with columns Backlog / In Progress / Review / Done, then add the issues:
       Backlog     : ISSUE-36 … ISSUE-43 (open)
       Done        : ISSUE-01 … ISSUE-35 and ISSUE-44 (closed)
     https://github.com/${OWNER_REPO}/projects

  2. Branch protection — Settings → Branches → add a rule for "main":
       require a pull request, 1 approval, dismiss stale approvals,
       require conversation resolution, block force pushes and deletions.
     https://github.com/${OWNER_REPO}/settings/branches

  3. Collaborators — add the other two team members, then open real PRs
     (referencing these issue numbers) and have someone else review them.
     Self-approval does not satisfy the brief.
     https://github.com/${OWNER_REPO}/settings/access
`);

  if (summary.failed > 0) process.exit(1);
}

main().catch((error) => fatal(error?.stack ?? String(error)));
