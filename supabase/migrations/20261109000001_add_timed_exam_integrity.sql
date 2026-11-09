-- ============================================================================
-- Growing Minds Academy — Forward Schema Migration
-- Migration: 20261109000001_add_timed_exam_integrity.sql
-- Description: Server-authoritative timed-exam clock (public.quiz_attempts) plus
--              exam-integrity marking on public.submissions. Supports hard
--              duration cutoffs and cheating-termination records.
--
-- The server owns the clock so a learner cannot reset the countdown by
-- reloading the page or by changing the tablet's system time. Enforcement is
-- entirely server-side: the deadline stored here is the single authority the
-- submission endpoint checks against.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TIMED EXAM ATTEMPTS: quiz_attempts
-- One row per (quiz, learner) sitting. `deadline_at` is computed by the server
-- as started_at + quizzes.duration_minutes and is never accepted from a client.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'terminated')),
    -- e.g. 'time_expired', 'integrity_violation:tab_hidden', 'integrity_violation:window_blur'
    termination_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A learner sits a given assessment once; reopening returns the same clock.
    UNIQUE (quiz_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_learner ON public.quiz_attempts(learner_id);

-- ----------------------------------------------------------------------------
-- 2. EXAM-INTEGRITY MARKING ON SUBMISSIONS
-- is_flagged marks an attempt that ended in an integrity violation so it is
-- surfaced to the teacher/admin; termination_reason records why.
-- ----------------------------------------------------------------------------
ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS termination_reason TEXT;
ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_submissions_flagged
    ON public.submissions(is_flagged) WHERE is_flagged;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- The server writes with the service-role key (bypasses RLS). Staff may read
-- attempts for quizzes belonging to their own school.
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read school quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Staff read school quiz attempts"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (
  quiz_id IN (
    SELECT id FROM public.quizzes WHERE school_id = public.current_user_school_id()
  )
);

-- ============================================================================
-- SAFE ROLLBACK INSTRUCTIONS (execute in order):
-- DROP POLICY IF EXISTS "Staff read school quiz attempts" ON public.quiz_attempts;
-- DROP INDEX IF EXISTS public.idx_submissions_flagged;
-- ALTER TABLE public.submissions DROP COLUMN IF EXISTS is_flagged;
-- ALTER TABLE public.submissions DROP COLUMN IF EXISTS termination_reason;
-- DROP INDEX IF EXISTS public.idx_quiz_attempts_learner;
-- DROP INDEX IF EXISTS public.idx_quiz_attempts_quiz;
-- DROP TABLE IF EXISTS public.quiz_attempts;
-- ============================================================================
