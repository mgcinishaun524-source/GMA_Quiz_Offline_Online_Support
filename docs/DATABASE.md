# Database Reference — Growing Minds Academy AI Quiz System

> All content in this document is derived directly from the SQL migrations in
> `supabase/migrations/`, the seed data in `supabase/seed.sql`, the persistence
> layer `server/db/databaseAdapter.ts`, and the shared TypeScript models in
> `src/types/`. Nothing here is invented; where a detail was not present in the
> source files it is explicitly marked as *not found*.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Engine | Supabase-hosted **PostgreSQL** |
| Schema namespace | `public` (all application tables) |
| Extension required | `pgcrypto` (`CREATE EXTENSION IF NOT EXISTS "pgcrypto"` — provides `gen_random_uuid()`) |
| Server access | Express backend (`server.ts`) / Vercel serverless (`api/index.ts`) connects with the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`), which **bypasses Row Level Security**. |
| Client access | Browser SPA uses the **anon/publishable key** (`VITE_SUPABASE_ANON_KEY`) via `src/lib/supabase.ts`; every query is subject to RLS. |
| RLS | Enabled on **all 14 tables** (see §5). |
| Tables | 14 application tables + 1 helper view. |
| Seed data | `supabase/seed.sql` inserts one school, 4 subjects, 3 classes, 3 test learners, and 3 class memberships. |
| Migrations | 5 forward migrations (see §6). |

**Fail-closed persistence policy.** `server/db/databaseAdapter.ts` refuses every
persistence operation when Supabase is not configured (`assertPersistence()`), and
the API returns HTTP 503 rather than serving in-memory fallback data. There is no
local server-side store.

**Row → model mapping.** `databaseAdapter.ts` maps snake_case DB columns to the
camelCase models in `src/types/quiz.ts`, `src/types/learner.ts`, and
`src/types/submission.ts`. Column names in this document are the actual DB names.

---

## 2. Table-by-Table Reference

Legend for the **Source** column: `M1` = `20261020000001_initial_schema.sql`,
`M2` = `20261022000001_add_due_date_and_cohort_fk.sql`,
`M3` = `20261026000001_add_username_to_user_profiles.sql`,
`M4` = `20261027000001_add_directory_associations.sql`,
`M5` = `20261027000002_fix_rls_policies.sql`.

Unless stated otherwise every table and every base column below was introduced by
**M1**.

### 2.1 `schools` — tenant root

**Purpose:** Top-level tenant (one row per academy/school). Every other tenant
scoped table references `schools.id`.

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `name` | TEXT | NOT NULL | — | M1 |
| `code` | TEXT | NOT NULL, **UNIQUE** | — | M1 |
| `academic_year` | TEXT | NOT NULL | `'2026-2027'` | M1 |
| `current_term` | TEXT | NOT NULL | `'Term 2'` | M1 |
| `term_end_date` | DATE | — | `'2026-12-18'` | M1 |
| `pass_mark_percent` | INTEGER | NOT NULL | `60` | M1 |
| `allow_offline_quizzes` | BOOLEAN | NOT NULL | `TRUE` | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; UNIQUE `code`.

### 2.2 `user_profiles` — staff accounts linked to Supabase Auth

**Purpose:** One row per staff member (admin/teacher). `id` is the Supabase
`auth.users.id` so the profile is bound to a verified authentication identity.

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK**, **FK → `auth.users(id)` ON DELETE CASCADE** | — | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE RESTRICT** | — | M1 |
| `email` | TEXT | NOT NULL, **UNIQUE** | — | M1 |
| `full_name` | TEXT | NOT NULL | — | M1 |
| `role` | TEXT | NOT NULL, **CHECK** `role IN ('admin','teacher')` | — | M1 |
| `avatar_initials` | VARCHAR(4) | — | — | M1 |
| `username` | TEXT | nullable; **UNIQUE on `LOWER(username)` where not null** | — | **M3** |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** If a school is deleted, `ON DELETE RESTRICT` blocks removal while staff
rows exist. `username` is additive/non-destructive — email login keeps working;
the unique index is `idx_user_profiles_username_lower` (case-insensitive,
partial).

### 2.3 `teachers` — faculty records

**Purpose:** Extended faculty metadata for staff whose role is `teacher`.
Shares the primary key with `user_profiles`.

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK**, **FK → `user_profiles(id)` ON DELETE CASCADE** | — | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE RESTRICT** | — | M1 |
| `title_role` | TEXT | NOT NULL, **CHECK** `IN ('Subject Teacher','Lead Teacher','Head of Department')` | `'Subject Teacher'` | M1 |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | M1 |
| `joined_date` | DATE | NOT NULL | `CURRENT_DATE` | M1 |
| `assigned_class_ids` | UUID[] | NOT NULL | `'{}'` | **M4** |
| `assigned_subject_ids` | UUID[] | NOT NULL | `'{}'` | **M4** |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** `assigned_class_ids` / `assigned_subject_ids` are the admin-console
directory associations persisted by M4 (array columns with matching GIN indexes).

### 2.4 `classes` — class / grade cohorts

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE CASCADE** | — | M1 |
| `name` | TEXT | NOT NULL | — | M1 |
| `grade_level` | TEXT | NOT NULL | — | M1 |
| `room` | TEXT | nullable | — | M1 |
| `form_teacher_id` | UUID | **FK → `teachers(id)` ON DELETE SET NULL** | — | M1 |
| `subject_ids` | UUID[] | NOT NULL | `'{}'` | **M4** |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; **UNIQUE (`school_id`, `name`)**.

**Notes:** `form_teacher_id` is nullable (a cohort may have no form teacher);
deleting a teacher nulls it rather than removing the class. `subject_ids` is the
M4 class → curriculum association.

### 2.5 `subjects` — curriculum subjects

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE CASCADE** | — | M1 |
| `name` | TEXT | NOT NULL | — | M1 |
| `code` | TEXT | NOT NULL | — | M1 |
| `description` | TEXT | nullable | — | M1 |
| `grade_levels` | TEXT[] | NOT NULL | `'{}'` | M1 |
| `topic_count` | INTEGER | NOT NULL | `10` | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; **UNIQUE (`school_id`, `code`)**.

### 2.6 `teacher_assignments` — teacher ↔ class ↔ subject junction

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `teacher_id` | UUID | NOT NULL, **FK → `teachers(id)` ON DELETE CASCADE** | — | M1 |
| `class_id` | UUID | NOT NULL, **FK → `classes(id)` ON DELETE CASCADE** | — | M1 |
| `subject_id` | UUID | NOT NULL, **FK → `subjects(id)` ON DELETE CASCADE** | — | M1 |
| `assigned_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; **UNIQUE (`teacher_id`, `class_id`, `subject_id`)**.

### 2.7 `learners` — student directory & salted PIN storage

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE CASCADE** | — | M1 |
| `student_number` | TEXT | NOT NULL, **UNIQUE** | — | M1 |
| `first_name` | TEXT | NOT NULL | — | M1 |
| `last_name` | TEXT | NOT NULL | — | M1 |
| `pin_hash` | TEXT | NOT NULL (bcrypt/argon2 salted hash — never plaintext) | — | M1 |
| `pin_failed_attempts` | INTEGER | NOT NULL | `0` | M1 |
| `pin_locked_until` | TIMESTAMPTZ | nullable | — | M1 |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | M1 |
| `guardian_contact` | TEXT | nullable | — | M1 |
| `enrolled_date` | DATE | NOT NULL | `CURRENT_DATE` | M1 |
| `last_active` | TIMESTAMPTZ | nullable | — | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** The learner login flow (server.ts `/api/auth/learner-login`) verifies
the PIN against `pin_hash`, maintains the in-memory brute-force lockout, and
writes `pin_locked_until` on lockout. `pin_failed_attempts` is reset to `0` and
`pin_locked_until` to `null` on a successful login.

### 2.8 `class_memberships` — learner ↔ class enrolment

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `class_id` | UUID | NOT NULL, **FK → `classes(id)` ON DELETE CASCADE** | — | M1 |
| `learner_id` | UUID | NOT NULL, **FK → `learners(id)` ON DELETE CASCADE** | — | M1 |
| `academic_year` | TEXT | NOT NULL | `'2026-2027'` | M1 |
| `enrolled_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; **UNIQUE (`class_id`, `learner_id`, `academic_year`)**.

### 2.9 `quizzes` — assessments

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE CASCADE** | — | M1 |
| `subject_id` | UUID | NOT NULL, **FK → `subjects(id)` ON DELETE RESTRICT** | — | M1 |
| `author_id` | UUID | NOT NULL, **FK → `teachers(id)` ON DELETE RESTRICT** | — | M1 |
| `title` | TEXT | NOT NULL | — | M1 |
| `grade` | TEXT | NOT NULL | — | M1 |
| `difficulty` | TEXT | NOT NULL, **CHECK** `IN ('easy','medium','hard')` | `'medium'` | M1 |
| `duration_minutes` | INTEGER | NOT NULL | `15` | M1 |
| `instructions` | TEXT | nullable | — | M1 |
| `learning_objectives` | TEXT | nullable | — | M1 |
| `topics_covered` | TEXT[] | NOT NULL | `'{}'` | M1 |
| `status` | TEXT | NOT NULL, **CHECK** `IN ('draft','published','in_progress','closed','results_released')` | `'draft'` | M1 |
| `release_policy` | TEXT | NOT NULL, **CHECK** `IN ('manual','automatic')` | `'manual'` | M1 |
| `allow_offline` | BOOLEAN | NOT NULL | `TRUE` | M1 |
| `max_attempts` | INTEGER | NOT NULL | `1` | M1 |
| `published_at` | TIMESTAMPTZ | nullable | — | M1 |
| `closed_at` | TIMESTAMPTZ | nullable | — | M1 |
| `results_released_at` | TIMESTAMPTZ | nullable | — | M1 |
| `due_date` | TIMESTAMPTZ | nullable | — | **M2** |
| `class_id` | UUID | nullable, **FK → `classes(id)` ON DELETE SET NULL** | — | **M2** |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:**
- `class_id` (M2) is the *optional primary cohort* for single-class assessments;
  the many-to-many distribution is still `quiz_assignments`. Deleting a class
  sets this to NULL.
- `subject_id` and `author_id` use `ON DELETE RESTRICT` — a subject/teacher with
  quizzes cannot be deleted while referenced.

### 2.10 `quiz_assignments` — quiz ↔ class cohort junction

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `quiz_id` | UUID | NOT NULL, **FK → `quizzes(id)` ON DELETE CASCADE** | — | M1 |
| `class_id` | UUID | NOT NULL, **FK → `classes(id)` ON DELETE CASCADE** | — | M1 |
| `assigned_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Constraints:** PK `id`; **UNIQUE (`quiz_id`, `class_id`)**.

### 2.11 `questions` — individual questions

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `quiz_id` | UUID | NOT NULL, **FK → `quizzes(id)` ON DELETE CASCADE** | — | M1 |
| `type` | TEXT | NOT NULL, **CHECK** `IN ('multiple_choice','true_false','short_answer')` | — | M1 |
| `prompt` | TEXT | NOT NULL | — | M1 |
| `options` | JSONB | nullable (array of `{ id, text }`) | — | M1 |
| `correct_answer` | TEXT | NOT NULL — **protected from direct learner queries** | — | M1 |
| `marks` | INTEGER | NOT NULL | `2` | M1 |
| `topic` | TEXT | NOT NULL | — | M1 |
| `explanation` | TEXT | nullable — withheld until results released | — | M1 |
| `sort_order` | INTEGER | NOT NULL | `0` | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** `correct_answer` is never returned to learners by the secure view (see
§4). The adapter derives `questions.id` from `quizId + questionId`
(`questionDbId()`) so non-UUID question ids reused across quizzes never collide on
the PK.

### 2.12 `submissions` — learner attempts

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `quiz_id` | UUID | NOT NULL, **FK → `quizzes(id)` ON DELETE CASCADE** | — | M1 |
| `learner_id` | UUID | NOT NULL, **FK → `learners(id)` ON DELETE CASCADE** | — | M1 |
| `score` | INTEGER | NOT NULL | `0` | M1 |
| `total_marks` | INTEGER | NOT NULL | — | M1 |
| `percentage` | INTEGER | NOT NULL | `0` | M1 |
| `status` | TEXT | NOT NULL, **CHECK** `IN ('not_started','in_progress','submitted','saved_offline','pending_sync','synced','marked')` | `'submitted'` | M1 |
| `sync_status` | TEXT | NOT NULL, **CHECK** `IN ('synced','pending','offline_queued','sync_error')` | `'synced'` | M1 |
| `is_offline_submission` | BOOLEAN | NOT NULL | `FALSE` | M1 |
| `client_submission_hash` | TEXT | NOT NULL, **UNIQUE** — offline idempotency key | — | M1 |
| `submitted_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |
| `synced_at` | TIMESTAMPTZ | nullable | — | M1 |
| `teacher_feedback` | TEXT | nullable | — | M1 |
| `topics_to_practise` | TEXT[] | nullable | `'{}'` | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** `client_submission_hash` is the offline idempotency key (see §7). The
adapter's `saveSubmission()` performs a pre-insert hash lookup and also catches
PostgreSQL unique-violation code `23505` to return the existing row.

### 2.13 `submission_answers` — per-question responses

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `submission_id` | UUID | NOT NULL, **FK → `submissions(id)` ON DELETE CASCADE** | — | M1 |
| `question_id` | UUID | NOT NULL, **FK → `questions(id)` ON DELETE CASCADE** | — | M1 |
| `response` | TEXT | nullable | — | M1 |
| `is_correct` | BOOLEAN | nullable | — | M1 |
| `marks_awarded` | INTEGER | NOT NULL | `0` | M1 |

**Constraints:** PK `id`; **UNIQUE (`submission_id`, `question_id`)** — one answer
row per question per submission (used as the `upsert` conflict target).

### 2.14 `audit_events` — compliance & security log

| Column | Type | Constraints | Default | Source |
|---|---|---|---|---|
| `id` | UUID | **PK** | `gen_random_uuid()` | M1 |
| `school_id` | UUID | NOT NULL, **FK → `schools(id)` ON DELETE CASCADE** | — | M1 |
| `actor_id` | TEXT | nullable (user UUID or student number) | — | M1 |
| `actor_role` | TEXT | nullable (`'admin'`, `'teacher'`, `'learner'`, `'system'`) | — | M1 |
| `action` | TEXT | NOT NULL (e.g. `AUTH_PIN_LOCKOUT`, `RESULTS_RELEASED`, `SUBMISSION_SYNCED`) | — | M1 |
| `target_entity` | TEXT | NOT NULL | — | M1 |
| `target_id` | TEXT | nullable | — | M1 |
| `metadata` | JSONB | nullable | `'{}'` | M1 |
| `ip_address` | TEXT | nullable | — | M1 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | M1 |

**Notes:** Written by `logAuditEvent()` in `server/db.ts`. Observed actions
include `AUTH_STAFF_LOGIN`, `AUTH_STAFF_FAILED`, `AUTH_STAFF_LOCKED`,
`AUTH_LEARNER_LOGIN`, `AUTH_PIN_FAILED`, `AUTH_PIN_LOCKED`,
`SUBMISSION_RECORDED`, `OFFLINE_SYNC_BATCH`.

---

## 3. Index Inventory

### M1 — performance & integrity indexes

| Index | Table (columns) | Supports |
|---|---|---|
| `idx_user_profiles_school` | `user_profiles(school_id)` | RLS school-scoped staff lookups |
| `idx_classes_school` | `classes(school_id)` | school class listing |
| `idx_subjects_school` | `subjects(school_id)` | school subject listing |
| `idx_learners_school` | `learners(school_id)` | school learner listing |
| `idx_learners_student_number` | `learners(student_number)` | learner login lookup |
| `idx_class_memberships_learner` | `class_memberships(learner_id)` | "my classes" for a learner |
| `idx_class_memberships_class` | `class_memberships(class_id)` | roster / cohort membership |
| `idx_quizzes_school_status` | `quizzes(school_id, status)` | dashboard & learner-visible quiz filtering |
| `idx_quiz_assignments_class` | `quiz_assignments(class_id)` | class → assigned quizzes |
| `idx_questions_quiz_sort` | `questions(quiz_id, sort_order)` | ordered question fetch per quiz |
| `idx_submissions_quiz_learner` | `submissions(quiz_id, learner_id)` | per-quiz / per-learner submission lookup |
| `idx_submissions_hash` | `submissions(client_submission_hash)` | idempotency hash lookup |
| `idx_audit_school_action` | `audit_events(school_id, action)` | audit filtering by school/action |

### M2 — deadline & cohort indexes

| Index | Table (columns) | Supports |
|---|---|---|
| `idx_quizzes_due_date` | `quizzes(due_date)` | deadline scans / expiry checks |
| `idx_quizzes_class_id` | `quizzes(class_id)` | quizzes for a cohort |

### M3 — username uniqueness

| Index | Table | Supports |
|---|---|---|
| `idx_user_profiles_username_lower` | `user_profiles(LOWER(username))` — **UNIQUE** partial, `WHERE username IS NOT NULL` | case-insensitive username login uniqueness |

### M4 — directory association indexes (GIN)

| Index | Table (columns) | Supports |
|---|---|---|
| `idx_classes_subject_ids` | `classes USING GIN (subject_ids)` | class → subjects array membership |
| `idx_teachers_assigned_class_ids` | `teachers USING GIN (assigned_class_ids)` | teacher → classes array membership |
| `idx_teachers_assigned_subject_ids` | `teachers USING GIN (assigned_subject_ids)` | teacher → subjects array membership |

### Implicit indexes from UNIQUE / PK constraints

Unique constraints also create backing indexes: `schools.code`,
`user_profiles.email`, `learners.student_number`, `classes(school_id,name)`,
`subjects(school_id,code)`, `teacher_assignments(teacher_id,class_id,subject_id)`,
`class_memberships(class_id,learner_id,academic_year)`,
`quiz_assignments(quiz_id,class_id)`,
`submissions.client_submission_hash`,
`submission_answers(submission_id,question_id)`, plus every PK.

---

## 4. The `learner_active_quiz_questions` View

```sql
CREATE OR REPLACE VIEW public.learner_active_quiz_questions AS
SELECT q.id, q.quiz_id, q.type, q.prompt, q.options, q.marks, q.topic, q.sort_order
FROM public.questions q
JOIN public.quizzes z ON q.quiz_id = z.id
WHERE z.status IN ('published', 'in_progress', 'closed', 'results_released');
```

**Purpose:** the learner-safe projection of quiz questions.

**What it strips and why:**
- It **omits `correct_answer`** — the answer key is never exposed to learners
  (marking is authoritative and server-side only).
- It **omits `explanation`** — explanations are withheld until results are
  formally released.
- It **omits `created_at`** — not needed by the client.

**What it keeps:** `id`, `quiz_id`, `type`, `prompt`, `options`, `marks`,
`topic`, `sort_order`.

**Row filter:** only questions belonging to a quiz whose `status` is one of
`published`, `in_progress`, `closed`, `results_released` are visible — draft
quizzes never leak their questions.

---

## 5. RLS Policy Inventory

**RLS is enabled on all 14 tables** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
in M1).

### Helper functions (M1)

| Function | Definition (summary) | Returns |
|---|---|---|
| `public.current_user_school_id()` | `SELECT school_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1` — `LANGUAGE sql STABLE SECURITY DEFINER` | UUID |
| `public.current_user_role()` | `SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1` — `LANGUAGE sql STABLE SECURITY DEFINER` | TEXT |

Both are `SECURITY DEFINER` so they can read `user_profiles` regardless of the
caller's own RLS grants.

### Named policies

| Table | Policy | Command | Role | Predicate (summary) | Source |
|---|---|---|---|---|---|
| `schools` | Staff read own school | SELECT | authenticated | `id = current_user_school_id()` | M1 |
| `user_profiles` | Staff read school profiles | SELECT | authenticated | `school_id = current_user_school_id()` | M1 |
| `user_profiles` | Users update own profile | UPDATE | authenticated | `USING id = auth.uid()` / `WITH CHECK id = auth.uid()` | M1 |
| `user_profiles` | Admins insert school profiles | INSERT | authenticated | `EXISTS` admin in same school | **M5** |
| `user_profiles` | Admins delete school profiles | DELETE | authenticated | `EXISTS` admin in same school | **M5** |
| `teachers` | Staff read school teachers | SELECT | authenticated | `school_id = current_user_school_id()` | M1 |
| `teachers` | Admins manage teachers | ALL | authenticated | `current_user_role() = 'admin' AND school_id = current_user_school_id()` | M1 |
| `classes` | Staff read school classes | SELECT | authenticated | `school_id = current_user_school_id()` | M1 |
| `classes` | Staff manage school classes | ALL | authenticated | `school_id = current_user_school_id()` | M1 |
| `subjects` | Staff read school subjects | SELECT | authenticated | `school_id = current_user_school_id()` | M1 |
| `subjects` | Staff manage school subjects | ALL | authenticated | `school_id = current_user_school_id()` | M1 |
| `teacher_assignments` | Staff read teacher assignments | SELECT | authenticated | `class_id IN (classes of current school)` | M1 |
| `teacher_assignments` | Staff manage teacher assignments | ALL | authenticated | `class_id IN (classes of current school)` | M1 |
| `learners` | Staff manage school learners | ALL | authenticated | `school_id = current_user_school_id()` | M1 |
| `class_memberships` | Staff manage class memberships | ALL | authenticated | `class_id IN (classes of current school)` | M1 |
| `quizzes` | Admins manage school quizzes | ALL | authenticated | `current_user_role() = 'admin' AND school_id = current_user_school_id()` | M1 |
| `quizzes` | Teachers manage assigned quizzes | ALL | authenticated | `current_user_role() = 'teacher' AND school_id = current_user_school_id() AND (author_id = auth.uid() OR id IN (assignments via teacher_assignments))` | M1 |
| `quiz_assignments` | Staff manage quiz assignments | ALL | authenticated | `quiz_id IN (quizzes of current school)` | M1 |
| `questions` | Staff read questions with answer keys | ALL | authenticated | `quiz_id IN (quizzes of current school)` | M1 |
| `submissions` | Staff read submissions | SELECT | authenticated | `quiz_id IN (quizzes of current school)` | M1 |
| `submission_answers` | Staff read submission answers | SELECT | authenticated | `submission_id IN (submissions of current-school quizzes)` | M1 |
| `audit_events` | Staff insert audit events | INSERT | authenticated | `WITH CHECK school_id = current_user_school_id()` | M1 |
| `audit_events` | Admins read school audit events | SELECT | authenticated | `current_user_role() = 'admin' AND school_id = current_user_school_id()` | M1 |

**Server-role bypass note (from M1 footer and DEPLOYMENT.md):** the Express /
Vercel server backend connects with the **service-role key**, which **bypasses
Row Level Security** for server-evaluated auto-marking, sync, and cross-table
reads (e.g. the submission join in `databaseAdapter.getSubmissions()`). RLS
therefore protects the browser/anon path; the server applies its own explicit
school/teacher scoping in code.

---

## 6. Migration Order & How to Apply

Apply in lexical/numeric order (Supabase CLI sorts by filename timestamp):

| # | File | Summary |
|---|---|---|
| 1 | `20261020000001_initial_schema.sql` | `pgcrypto`; 14 tables; 13 indexes; `learner_active_quiz_questions` view; RLS enabled on all tables; helper functions; base policies |
| 2 | `20261022000001_add_due_date_and_cohort_fk.sql` | Adds `quizzes.due_date` and nullable `quizzes.class_id` (FK, SET NULL); 2 indexes; documented safe rollback |
| 3 | `20261026000001_add_username_to_user_profiles.sql` | Adds nullable `user_profiles.username`; unique partial index on `LOWER(username)` |
| 4 | `20261027000001_add_directory_associations.sql` | Adds `classes.subject_ids`, `teachers.assigned_class_ids`, `teachers.assigned_subject_ids` (UUID[] NOT NULL DEFAULT '{}'); 3 GIN indexes |
| 5 | `20261027000002_fix_rls_policies.sql` | Adds `Admins insert school profiles` and `Admins delete school profiles` policies on `user_profiles` |

All statements are written defensively: tables use `CREATE TABLE IF NOT EXISTS`,
additive columns use `ADD COLUMN IF NOT EXISTS`, and M5 drops policies before
recreating them — so re-running is safe.

**Typical local application:**
```bash
supabase db push          # applies all pending migrations in order
supabase db reset         # (dev only) rebuilds and re-runs migrations + seed
```

**Seed data:** `supabase/seed.sql` inserts a school (`code = 'GMA'`), 4 subjects,
3 classes (`Grade 3A/3B`, `Grade 4A`), 3 learners with a bcrypt hash of PIN
`4821`, and 3 class memberships. All inserts use `ON CONFLICT ... DO NOTHING`.

**Safe rollback (M2).** The M2 migration embeds rollback instructions:
```sql
DROP INDEX IF EXISTS public.idx_quizzes_class_id;
DROP INDEX IF EXISTS public.idx_quizzes_due_date;
ALTER TABLE public.quizzes DROP COLUMN IF EXISTS class_id;
ALTER TABLE public.quizzes DROP COLUMN IF EXISTS due_date;
```
M3 and M4 are additive/non-destructive; no rollback SQL is embedded in them.

---

## 7. Data-Integrity Notes

1. **`client_submission_hash` UNIQUE (offline idempotency).**
   Each submission carries a client-generated hash that is unique across the
   `submissions` table (`idx_submissions_hash`). Both `/api/submissions` and
   `/api/submissions/sync` first call `getSubmissionByHash()`; if a row already
   exists they return it instead of inserting (idempotent replay of a queued
   offline submission). `saveSubmission()` additionally catches PostgreSQL
   unique-violation code `23505` and returns the existing row, so a duplicate
   replay can never create a second submission. Replayed updates are **monotonic**:
   a stale retry never reverts a `marked` submission back to `submitted`, never
   wipes authoritative teacher feedback, and never reverts a teacher-adjusted
   score.

2. **`questions.correct_answer` protection.**
   `correct_answer` is `NOT NULL` but is deliberately excluded from the
   `learner_active_quiz_questions` view (§4) and from learner-facing API
   responses. Marking is performed **server-side** in `server.ts` against the
   quiz's stored answer key; learner-submitted scores/marks are never trusted. The
   quiz-transfer payload sent to learners strips the answer key.

3. **`submission_answers` UNIQUE (`submission_id`, `question_id`).**
   Guarantees at most one saved answer per question per submission. The adapter
   upserts with `onConflict: 'submission_id,question_id'`, so re-saving a
   submission overwrites rather than duplicates answer rows.

4. **Teacher/tenant isolation on the server path.** Because the service role
   bypasses RLS, `databaseAdapter.getQuizzes()` and `getSubmissions()` apply
   explicit `school_id` and teacher-author/assigned-class filters in code.

5. **Fail-closed writes.** With no configured Supabase connection, persistence
   throws and the API returns HTTP 503 — a failed save can never be reported as a
   success.

---

## Appendix A — Seed reference UUIDs

These fixed IDs come from `supabase/seed.sql` and are mirrored in
`SEED_ID_MAP` (`server/db/databaseAdapter.ts`):

| Entity | Slug | UUID |
|---|---|---|
| School (Growing Minds Academy, `GMA`) | `default-school` | `00000000-0000-0000-0000-000000000001` |
| Subject Mathematics (`MATH-PRI`) | `subj-math` | `10000000-0000-0000-0000-000000000001` |
| Subject Integrated Science (`SCI-PRI`) | `subj-sci` | `10000000-0000-0000-0000-000000000002` |
| Subject English Language (`ENG-PRI`) | `subj-eng` | `10000000-0000-0000-0000-000000000003` |
| Subject ICT & Digital Literacy (`ICT-PRI`) | `subj-ict` | `10000000-0000-0000-0000-000000000004` |
| Class Grade 3A | `cls-3a` | `20000000-0000-0000-0000-000000000001` |
| Class Grade 3B | `cls-3b` | `20000000-0000-0000-0000-000000000002` |
| Class Grade 4A | `cls-4a` | `20000000-0000-0000-0000-000000000003` |
| Learner Marcus Vance (`GMA-2026-0301`) | `GMA-2026-0301` | `30000000-0000-0000-0000-000000000001` |
| Learner Amara Okafor (`GMA-2026-0302`) | `GMA-2026-0302` | `30000000-0000-0000-0000-000000000002` |
| Learner Leo Chen (`GMA-2026-0303`) | `GMA-2026-0303` | `30000000-0000-0000-0000-000000000003` |

## Appendix B — External dependency

`user_profiles.id` references **`auth.users(id)`** — the Supabase-managed
authentication table in the `auth` schema (not part of the 14 application
tables, and not created by these migrations).

## Appendix C — Uncertainties / not found in source

- The migrations do not define a `WITH CHECK` clause for most `FOR ALL` policies;
  PostgreSQL applies the `USING` expression to verify writes. This is faithfully
  reported above rather than assumed.
- No triggers, sequences, or stored procedures exist in the migrations other than
  the two `SECURITY DEFINER` helper functions and the view.
- `submissions.topics_to_practise` and `audit_events.metadata` rely on the
  `DEFAULT '{}'`; neither is declared `NOT NULL`.
