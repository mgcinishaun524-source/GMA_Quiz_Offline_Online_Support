-- ============================================================================
-- Growing Minds Academy — AI-Powered Quiz & Learning Analytics System
-- Initial PostgreSQL Relational Schema & Row-Level Security Policies
-- Migration: 20261020000001_initial_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TENANT ROOT: schools
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    academic_year TEXT NOT NULL DEFAULT '2026-2027',
    current_term TEXT NOT NULL DEFAULT 'Term 2',
    term_end_date DATE DEFAULT '2026-12-18',
    pass_mark_percent INTEGER NOT NULL DEFAULT 60,
    allow_offline_quizzes BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. USER PROFILES: user_profiles (Staff linked to Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
    avatar_initials VARCHAR(4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. FACULTY RECORDS: teachers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    title_role TEXT NOT NULL DEFAULT 'Subject Teacher' CHECK (title_role IN ('Subject Teacher', 'Lead Teacher', 'Head of Department')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. CLASS GROUPS: classes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    room TEXT,
    form_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);

-- ----------------------------------------------------------------------------
-- 5. CURRICULUM SUBJECTS: subjects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    grade_levels TEXT[] NOT NULL DEFAULT '{}',
    topic_count INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, code)
);

-- ----------------------------------------------------------------------------
-- 6. TEACHER SUBJECT & CLASS ASSIGNMENTS: teacher_assignments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id, class_id, subject_id)
);

-- ----------------------------------------------------------------------------
-- 7. LEARNERS: learners (Student Directory & Salted PIN Storage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    pin_hash TEXT NOT NULL, -- bcrypt/argon2 salted hash (Never stored in plaintext)
    pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    guardian_contact TEXT,
    enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. CLASS MEMBERSHIPS: class_memberships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026-2027',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, learner_id, academic_year)
);

-- ----------------------------------------------------------------------------
-- 9. ASSESSMENTS: quizzes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    author_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    grade TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    instructions TEXT,
    learning_objectives TEXT,
    topics_covered TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'closed', 'results_released')),
    release_policy TEXT NOT NULL DEFAULT 'manual' CHECK (release_policy IN ('manual', 'automatic')),
    allow_offline BOOLEAN NOT NULL DEFAULT TRUE,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    results_released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. QUIZ COHORT ASSIGNMENTS: quiz_assignments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (quiz_id, class_id)
);

-- ----------------------------------------------------------------------------
-- 11. QUESTIONS: questions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false', 'short_answer')),
    prompt TEXT NOT NULL,
    options JSONB, -- Array of { id: string, text: string }
    correct_answer TEXT NOT NULL, -- Protected from direct learner queries
    marks INTEGER NOT NULL DEFAULT 2,
    topic TEXT NOT NULL,
    explanation TEXT, -- Withheld until results are formally released
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. SUBMISSIONS: submissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    total_marks INTEGER NOT NULL,
    percentage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'saved_offline', 'pending_sync', 'synced', 'marked')),
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'offline_queued', 'sync_error')),
    is_offline_submission BOOLEAN NOT NULL DEFAULT FALSE,
    client_submission_hash TEXT NOT NULL UNIQUE, -- Idempotency key for offline sync
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    teacher_feedback TEXT,
    topics_to_practise TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 13. QUESTION RESPONSES: submission_answers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    response TEXT,
    is_correct BOOLEAN,
    marks_awarded INTEGER NOT NULL DEFAULT 0,
    UNIQUE (submission_id, question_id)
);

-- ----------------------------------------------------------------------------
-- 14. COMPLIANCE & SECURITY AUDIT LOG: audit_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    actor_id TEXT, -- User UUID or Student Number
    actor_role TEXT, -- 'admin', 'teacher', 'learner', 'system'
    action TEXT NOT NULL, -- e.g. 'AUTH_PIN_LOCKOUT', 'RESULTS_RELEASED', 'SUBMISSION_SYNCED'
    target_entity TEXT NOT NULL,
    target_id TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PERFORMANCE & INTEGRITY INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_school ON public.user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON public.subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_learners_school ON public.learners(school_id);
CREATE INDEX IF NOT EXISTS idx_learners_student_number ON public.learners(student_number);
CREATE INDEX IF NOT EXISTS idx_class_memberships_learner ON public.class_memberships(learner_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_class ON public.class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_school_status ON public.quizzes(school_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_class ON public.quiz_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_sort ON public.questions(quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_learner ON public.submissions(quiz_id, learner_id);
CREATE INDEX IF NOT EXISTS idx_submissions_hash ON public.submissions(client_submission_hash);
CREATE INDEX IF NOT EXISTS idx_audit_school_action ON public.audit_events(school_id, action);

-- ============================================================================
-- SECURE LEARNER PROJECTION VIEW (Strips correct_answer & pre-release explanations)
-- ============================================================================
CREATE OR REPLACE VIEW public.learner_active_quiz_questions AS
SELECT
    q.id,
    q.quiz_id,
    q.type,
    q.prompt,
    q.options,
    q.marks,
    q.topic,
    q.sort_order
FROM public.questions q
JOIN public.quizzes z ON q.quiz_id = z.id
WHERE z.status IN ('published', 'in_progress', 'closed', 'results_released');

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Helper function: current user school_id
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Schools: Staff can read their own school
CREATE POLICY "Staff read own school"
ON public.schools FOR SELECT
TO authenticated
USING (id = public.current_user_school_id());

-- User Profiles:
CREATE POLICY "Staff read school profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Users update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Teachers:
CREATE POLICY "Staff read school teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Admins manage teachers"
ON public.teachers FOR ALL
TO authenticated
USING (public.current_user_role() = 'admin' AND school_id = public.current_user_school_id());

-- Classes:
CREATE POLICY "Staff read school classes"
ON public.classes FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Staff manage school classes"
ON public.classes FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id());

-- Subjects:
CREATE POLICY "Staff read school subjects"
ON public.subjects FOR SELECT
TO authenticated
USING (school_id = public.current_user_school_id());

CREATE POLICY "Staff manage school subjects"
ON public.subjects FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id());

-- Teacher Assignments:
CREATE POLICY "Staff read teacher assignments"
ON public.teacher_assignments FOR SELECT
TO authenticated
USING (
  class_id IN (SELECT id FROM public.classes WHERE school_id = public.current_user_school_id())
);

CREATE POLICY "Staff manage teacher assignments"
ON public.teacher_assignments FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM public.classes WHERE school_id = public.current_user_school_id())
);

-- Learners:
CREATE POLICY "Staff manage school learners"
ON public.learners FOR ALL
TO authenticated
USING (school_id = public.current_user_school_id());

-- Class Memberships:
CREATE POLICY "Staff manage class memberships"
ON public.class_memberships FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM public.classes WHERE school_id = public.current_user_school_id())
);

-- Quizzes:
-- 1. Admins read/manage all quizzes for their school
CREATE POLICY "Admins manage school quizzes"
ON public.quizzes FOR ALL
TO authenticated
USING (
  public.current_user_role() = 'admin' AND school_id = public.current_user_school_id()
);

-- 2. Teachers manage quizzes they authored or assigned in their school
CREATE POLICY "Teachers manage assigned quizzes"
ON public.quizzes FOR ALL
TO authenticated
USING (
  public.current_user_role() = 'teacher' AND
  school_id = public.current_user_school_id() AND
  (author_id = auth.uid() OR id IN (
    SELECT qa.quiz_id FROM public.quiz_assignments qa
    JOIN public.teacher_assignments ta ON qa.class_id = ta.class_id
    WHERE ta.teacher_id = auth.uid()
  ))
);

-- Quiz Assignments:
CREATE POLICY "Staff manage quiz assignments"
ON public.quiz_assignments FOR ALL
TO authenticated
USING (
  quiz_id IN (SELECT id FROM public.quizzes WHERE school_id = public.current_user_school_id())
);

-- Questions:
-- Only teachers and admins of the school can access questions with answers directly
CREATE POLICY "Staff read questions with answer keys"
ON public.questions FOR ALL
TO authenticated
USING (
  quiz_id IN (
    SELECT id FROM public.quizzes WHERE school_id = public.current_user_school_id()
  )
);

-- Submissions:
-- Teachers and admins can view submissions for school quizzes
CREATE POLICY "Staff read submissions"
ON public.submissions FOR SELECT
TO authenticated
USING (
  quiz_id IN (
    SELECT id FROM public.quizzes WHERE school_id = public.current_user_school_id()
  )
);

-- Submission Answers:
CREATE POLICY "Staff read submission answers"
ON public.submission_answers FOR SELECT
TO authenticated
USING (
  submission_id IN (
    SELECT s.id FROM public.submissions s
    JOIN public.quizzes q ON s.quiz_id = q.id
    WHERE q.school_id = public.current_user_school_id()
  )
);

-- Audit Events:
CREATE POLICY "Staff insert audit events"
ON public.audit_events FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_user_school_id());

CREATE POLICY "Admins read school audit events"
ON public.audit_events FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'admin' AND school_id = public.current_user_school_id()
);

-- Service Role (Server backend) has bypass permissions for server-evaluated auto-marking and sync.
