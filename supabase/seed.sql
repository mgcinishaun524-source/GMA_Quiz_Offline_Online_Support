-- ============================================================================
-- Growing Minds Academy — Seed Reference Data (Clearly Labelled Test Cohorts)
-- File: supabase/seed.sql
-- Note: Contains only mock/test records for developmental verification.
-- ============================================================================

-- Seed School
INSERT INTO public.schools (id, name, code, academic_year, current_term, pass_mark_percent)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Growing Minds Academy',
    'GMA',
    '2026-2027',
    'Term 2',
    60
) ON CONFLICT (code) DO NOTHING;

-- Seed Subjects
INSERT INTO public.subjects (id, school_id, name, code, grade_levels, topic_count, description)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH-PRI', ARRAY['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], 14, 'Core numeracy, fractional thinking, patterns, geometry and mental arithmetic.'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Integrated Science', 'SCI-PRI', ARRAY['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], 12, 'Empirical inquiry, living systems, forces, material states, and energy.'),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'English Language', 'ENG-PRI', ARRAY['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], 16, 'Reading comprehension, syntax, contextual vocabulary and analytical expression.'),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'ICT & Digital Literacy', 'ICT-PRI', ARRAY['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], 9, 'Hardware architecture, digital citizenship, safety, algorithmic flow.')
ON CONFLICT (school_id, code) DO NOTHING;

-- Seed Classes
INSERT INTO public.classes (id, school_id, name, grade_level, room)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Grade 3A', 'Grade 3', 'Room 12B - Main Wing'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Grade 3B', 'Grade 3', 'Room 14A - Main Wing'),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Grade 4A', 'Grade 4', 'Room 21 - Science Block')
ON CONFLICT (school_id, name) DO NOTHING;

-- Seed Test Learners with Salted Hashes for PIN '4821' (Marcus, Amara, Leo)
-- bcrypt hash for '4821': $2b$10$KOwCZbGyZmYN5/BzRgB.JOybmx1yPwKtGIn24sy3Ez3og4w9N4..S
-- (All student PINs in production are hashed upon enrollment via the server auth layer; never plaintext)
INSERT INTO public.learners (id, school_id, student_number, first_name, last_name, pin_hash, is_active)
VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'GMA-2026-0301', 'Marcus', 'Vance', '$2b$10$KOwCZbGyZmYN5/BzRgB.JOybmx1yPwKtGIn24sy3Ez3og4w9N4..S', true),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'GMA-2026-0302', 'Amara', 'Okafor', '$2b$10$KOwCZbGyZmYN5/BzRgB.JOybmx1yPwKtGIn24sy3Ez3og4w9N4..S', true),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'GMA-2026-0303', 'Leo', 'Chen', '$2b$10$KOwCZbGyZmYN5/BzRgB.JOybmx1yPwKtGIn24sy3Ez3og4w9N4..S', true)
ON CONFLICT (student_number) DO NOTHING;

-- Seed Class Memberships
INSERT INTO public.class_memberships (class_id, learner_id, academic_year)
VALUES
    ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-2027'),
    ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-2027'),
    ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '2026-2027')
ON CONFLICT (class_id, learner_id, academic_year) DO NOTHING;
