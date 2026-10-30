-- Migration: 20261027000002_fix_rls_policies.sql
-- Description: Adds missing INSERT and DELETE policies for user_profiles
--              to allow administrators to manage staff records.

-- 1. Allow administrators to create new user profiles for their school
DROP POLICY IF EXISTS "Admins insert school profiles" ON public.user_profiles;
CREATE POLICY "Admins insert school profiles"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (
  -- The actor must be an admin in the same school
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND school_id = public.user_profiles.school_id
  )
);

-- 2. Allow administrators to delete user profiles for their school
DROP POLICY IF EXISTS "Admins delete school profiles" ON public.user_profiles;
CREATE POLICY "Admins delete school profiles"
ON public.user_profiles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND school_id = public.user_profiles.school_id
  )
);
