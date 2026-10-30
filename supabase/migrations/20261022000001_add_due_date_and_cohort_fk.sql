-- ============================================================================
-- Growing Minds Academy — Forward Schema Migration
-- Migration: 20261022000001_add_due_date_and_cohort_fk.sql
-- Description: Adds deadline (due_date) and optional primary cohort foreign key (class_id)
--              to public.quizzes, aligning persistent PostgreSQL schema with the TypeScript model.
-- ============================================================================

-- 1. Add due_date column to public.quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 2. Add class_id foreign key column to public.quizzes (nullable, SET NULL on class deletion)
-- This provides a direct cohort association for primary single-class assessments
-- while preserving the existing many-to-many public.quiz_assignments table for multi-class distributions.
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- 3. Create performance indexes for deadlines and class queries
CREATE INDEX IF NOT EXISTS idx_quizzes_due_date ON public.quizzes(due_date);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON public.quizzes(class_id);

-- ============================================================================
-- SAFE ROLLBACK INSTRUCTIONS:
-- In the event a rollback is required, execute the following commands in order:
-- DROP INDEX IF EXISTS public.idx_quizzes_class_id;
-- DROP INDEX IF EXISTS public.idx_quizzes_due_date;
-- ALTER TABLE public.quizzes DROP COLUMN IF EXISTS class_id;
-- ALTER TABLE public.quizzes DROP COLUMN IF EXISTS due_date;
-- ============================================================================
