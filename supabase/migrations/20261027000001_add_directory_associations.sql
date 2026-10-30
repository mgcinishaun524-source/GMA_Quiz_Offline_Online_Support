-- ============================================================================
-- Growing Minds Academy — Forward Schema Migration
-- Migration: 20261027000001_add_directory_associations.sql
-- Description: Persists the directory associations captured in the admin console:
--                * which subjects a class (grade cohort) teaches
--                * which classes and subjects a faculty member is assigned to
--              Additive and non-destructive: every column is nullable-friendly with
--              an empty-array default, no existing rows are modified, and the API
--              tolerates the columns being absent until this migration is applied.
-- ============================================================================

-- 1. Class → curriculum subjects
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS subject_ids UUID[] NOT NULL DEFAULT '{}';

-- 2. Teacher → assigned classes
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS assigned_class_ids UUID[] NOT NULL DEFAULT '{}';

-- 3. Teacher → assigned subjects
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS assigned_subject_ids UUID[] NOT NULL DEFAULT '{}';

-- Indexes to keep array membership lookups efficient
CREATE INDEX IF NOT EXISTS idx_classes_subject_ids ON public.classes USING GIN (subject_ids);
CREATE INDEX IF NOT EXISTS idx_teachers_assigned_class_ids ON public.teachers USING GIN (assigned_class_ids);
CREATE INDEX IF NOT EXISTS idx_teachers_assigned_subject_ids ON public.teachers USING GIN (assigned_subject_ids);
