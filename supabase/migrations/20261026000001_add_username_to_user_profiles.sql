-- ============================================================================
-- Growing Minds Academy — Forward Schema Migration
-- Migration: 20261026000001_add_username_to_user_profiles.sql
-- Description: Adds an optional, unique staff login username to public.user_profiles
--              so staff (e.g. the bootstrap administrator "darksyntax") can sign in
--              with a short username while Supabase Auth continues to authenticate by
--              email. Additive and non-destructive: the column is nullable, no existing
--              rows or credentials are modified, and email login keeps working.
-- ============================================================================

-- 1. Add the nullable username column (safe to re-run)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Enforce case-insensitive uniqueness across non-null usernames only
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
ON public.user_profiles (LOWER(username))
WHERE username IS NOT NULL;
