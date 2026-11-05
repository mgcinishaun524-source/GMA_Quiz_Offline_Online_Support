# Database ER Diagram — Growing Minds Academy AI Quiz System

Entity-relationship diagram for the 14 `public` tables produced by
`supabase/migrations/20261020000001_initial_schema.sql` and the four additive
migrations. Primary keys (`PK`), foreign keys (`FK`) and unique constraints
(`UK`) are marked; column names match the migrations exactly.

> **Legend**
> - `pk` = primary key, `fk` = foreign key, `uk` = unique constraint.
> - Cardinality: `||` = exactly one, `o|` = zero or one, `o{` = zero or more,
>   `|{` = one or more.
> - `auth_users` is the Supabase-managed `auth.users` table (external, not one of
>   the 14 application tables) — shown only to anchor the staff-profile link.
> - `uuid_array` = PostgreSQL `UUID[]` (M4 directory associations);
>   `text_array` = PostgreSQL `TEXT[]`.

```mermaid
erDiagram
    auth_users ||--o| user_profiles : "authenticates staff"

    schools ||--o{ user_profiles : "employs staff"
    schools ||--o{ teachers : "has faculty"
    schools ||--o{ classes : "has cohorts"
    schools ||--o{ subjects : "offers subjects"
    schools ||--o{ learners : "enrols learners"
    schools ||--o{ quizzes : "owns quizzes"
    schools ||--o{ audit_events : "logs"

    user_profiles ||--o| teachers : "profile may be a teacher"

    teachers ||--o{ teacher_assignments : "assigned via"
    classes ||--o{ teacher_assignments : "covered by"
    subjects ||--o{ teacher_assignments : "taught in"
    teachers o|--o{ classes : "form teacher of"

    classes ||--o{ class_memberships : "enrols"
    learners ||--o{ class_memberships : "member of"

    subjects ||--o{ quizzes : "assessed by"
    teachers ||--o{ quizzes : "authors"
    classes o|--o{ quizzes : "primary cohort"

    quizzes ||--o{ quiz_assignments : "distributed via"
    classes ||--o{ quiz_assignments : "receives"

    quizzes ||--o{ questions : "contains"
    quizzes ||--o{ submissions : "receives"
    learners ||--o{ submissions : "submits"

    submissions ||--o{ submission_answers : "records"
    questions ||--o{ submission_answers : "answered in"

    auth_users {
        uuid id PK
    }

    schools {
        uuid id PK
        text name
        text code UK
        text academic_year
        text current_term
        date term_end_date
        integer pass_mark_percent
        boolean allow_offline_quizzes
        timestamptz created_at
        timestamptz updated_at
    }

    user_profiles {
        uuid id PK "FK auth.users ON DELETE CASCADE"
        uuid school_id FK "schools ON DELETE RESTRICT"
        text email UK
        text full_name
        text role "CHECK admin|teacher"
        varchar avatar_initials
        text username UK "unique LOWER(username) (M3)"
        timestamptz created_at
        timestamptz updated_at
    }

    teachers {
        uuid id PK "FK user_profiles ON DELETE CASCADE"
        uuid school_id FK "schools ON DELETE RESTRICT"
        text title_role "CHECK (M1)"
        boolean is_active
        date joined_date
        uuid_array assigned_class_ids "M4"
        uuid_array assigned_subject_ids "M4"
        timestamptz created_at
    }

    classes {
        uuid id PK
        uuid school_id FK "schools ON DELETE CASCADE"
        text name
        text grade_level
        text room
        uuid form_teacher_id FK "teachers ON DELETE SET NULL"
        uuid_array subject_ids "M4"
        timestamptz created_at
    }

    subjects {
        uuid id PK
        uuid school_id FK "schools ON DELETE CASCADE"
        text name
        text code
        text description
        text_array grade_levels
        integer topic_count
        timestamptz created_at
    }

    teacher_assignments {
        uuid id PK
        uuid teacher_id FK "teachers ON DELETE CASCADE"
        uuid class_id FK "classes ON DELETE CASCADE"
        uuid subject_id FK "subjects ON DELETE CASCADE"
        timestamptz assigned_at
    }

    learners {
        uuid id PK
        uuid school_id FK "schools ON DELETE CASCADE"
        text student_number UK
        text first_name
        text last_name
        text pin_hash
        integer pin_failed_attempts
        timestamptz pin_locked_until
        boolean is_active
        text guardian_contact
        date enrolled_date
        timestamptz last_active
        timestamptz created_at
    }

    class_memberships {
        uuid id PK
        uuid class_id FK "classes ON DELETE CASCADE"
        uuid learner_id FK "learners ON DELETE CASCADE"
        text academic_year
        timestamptz enrolled_at
    }

    quizzes {
        uuid id PK
        uuid school_id FK "schools ON DELETE CASCADE"
        uuid subject_id FK "subjects ON DELETE RESTRICT"
        uuid author_id FK "teachers ON DELETE RESTRICT"
        uuid class_id FK "classes ON DELETE SET NULL (M2)"
        text title
        text grade
        text difficulty "CHECK easy|medium|hard"
        integer duration_minutes
        text instructions
        text learning_objectives
        text_array topics_covered
        text status "CHECK draft|published|in_progress|closed|results_released"
        text release_policy "CHECK manual|automatic"
        boolean allow_offline
        integer max_attempts
        timestamptz due_date "M2"
        timestamptz published_at
        timestamptz closed_at
        timestamptz results_released_at
        timestamptz created_at
        timestamptz updated_at
    }

    quiz_assignments {
        uuid id PK
        uuid quiz_id FK "quizzes ON DELETE CASCADE"
        uuid class_id FK "classes ON DELETE CASCADE"
        timestamptz assigned_at
    }

    questions {
        uuid id PK
        uuid quiz_id FK "quizzes ON DELETE CASCADE"
        text type "CHECK multiple_choice|true_false|short_answer"
        text prompt
        jsonb options
        text correct_answer "protected from learners"
        integer marks
        text topic
        text explanation "withheld pre-release"
        integer sort_order
        timestamptz created_at
    }

    submissions {
        uuid id PK
        uuid quiz_id FK "quizzes ON DELETE CASCADE"
        uuid learner_id FK "learners ON DELETE CASCADE"
        integer score
        integer total_marks
        integer percentage
        text status "CHECK (7 values)"
        text sync_status "CHECK synced|pending|offline_queued|sync_error"
        boolean is_offline_submission
        text client_submission_hash UK "offline idempotency"
        timestamptz submitted_at
        timestamptz synced_at
        text teacher_feedback
        text_array topics_to_practise
        timestamptz created_at
    }

    submission_answers {
        uuid id PK
        uuid submission_id FK "submissions ON DELETE CASCADE"
        uuid question_id FK "questions ON DELETE CASCADE"
        text response
        boolean is_correct
        integer marks_awarded
    }

    audit_events {
        uuid id PK
        uuid school_id FK "schools ON DELETE CASCADE"
        text actor_id
        text actor_role
        text action
        text target_entity
        text target_id
        jsonb metadata
        text ip_address
        timestamptz created_at
    }
```

## Relationship summary

| Parent | Child | Cardinality | FK column | ON DELETE |
|---|---|---|---|---|
| `auth.users` | `user_profiles` | 1 : 0..1 | `id` | CASCADE |
| `schools` | `user_profiles` | 1 : 0..N | `school_id` | RESTRICT |
| `user_profiles` | `teachers` | 1 : 0..1 | `teachers.id` | CASCADE |
| `schools` | `teachers` | 1 : 0..N | `school_id` | RESTRICT |
| `schools` | `classes` | 1 : 0..N | `school_id` | CASCADE |
| `teachers` | `classes` (form teacher) | 0..1 : 0..N | `form_teacher_id` | SET NULL |
| `schools` | `subjects` | 1 : 0..N | `school_id` | CASCADE |
| `teachers` | `teacher_assignments` | 1 : 0..N | `teacher_id` | CASCADE |
| `classes` | `teacher_assignments` | 1 : 0..N | `class_id` | CASCADE |
| `subjects` | `teacher_assignments` | 1 : 0..N | `subject_id` | CASCADE |
| `schools` | `learners` | 1 : 0..N | `school_id` | CASCADE |
| `classes` | `class_memberships` | 1 : 0..N | `class_id` | CASCADE |
| `learners` | `class_memberships` | 1 : 0..N | `learner_id` | CASCADE |
| `schools` | `quizzes` | 1 : 0..N | `school_id` | CASCADE |
| `subjects` | `quizzes` | 1 : 0..N | `subject_id` | RESTRICT |
| `teachers` | `quizzes` (author) | 1 : 0..N | `author_id` | RESTRICT |
| `classes` | `quizzes` (primary cohort) | 0..1 : 0..N | `class_id` | SET NULL |
| `quizzes` | `quiz_assignments` | 1 : 0..N | `quiz_id` | CASCADE |
| `classes` | `quiz_assignments` | 1 : 0..N | `class_id` | CASCADE |
| `quizzes` | `questions` | 1 : 0..N | `quiz_id` | CASCADE |
| `quizzes` | `submissions` | 1 : 0..N | `quiz_id` | CASCADE |
| `learners` | `submissions` | 1 : 0..N | `learner_id` | CASCADE |
| `submissions` | `submission_answers` | 1 : 0..N | `submission_id` | CASCADE |
| `questions` | `submission_answers` | 1 : 0..N | `question_id` | CASCADE |
| `schools` | `audit_events` | 1 : 0..N | `school_id` | CASCADE |

## UNIQUE / composite constraints shown

- `schools.code`
- `user_profiles.email`; partial unique `LOWER(username)` (M3)
- `learners.student_number`
- `classes (school_id, name)`
- `subjects (school_id, code)`
- `teacher_assignments (teacher_id, class_id, subject_id)`
- `class_memberships (class_id, learner_id, academic_year)`
- `quiz_assignments (quiz_id, class_id)`
- `submissions.client_submission_hash`
- `submission_answers (submission_id, question_id)`

See `docs/DATABASE.md` for full column types, CHECK constraints, defaults, the
`learner_active_quiz_questions` view, and the RLS policy inventory.
