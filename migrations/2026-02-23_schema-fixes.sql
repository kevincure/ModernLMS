-- ============================================================
-- ModernLMS — Schema Migration 2026-02-23
-- Run in the Supabase SQL editor (or psql as superuser).
-- Sections are independently safe to run; they are ordered so
-- that data migrations happen before any destructive DDL.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Security — tighten profile SELECT policy
--
-- The old "Profiles are viewable by authenticated users" policy
-- allowed every logged-in user to read ALL columns of ALL
-- profiles, exposing gemini_key. Replaced with:
--   • own profile   → full row access (gemini_key included)
--   • course peers  → row access only for co-enrolled users
--     (column protection handled client-side: see code change
--      in database_interactions.js)
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Own profile: full access (includes gemini_key)
CREATE POLICY "profiles: own full read"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Co-enrolled users: row visible, but client requests only
-- non-sensitive columns (id, email, name, avatar, given_name,
-- family_name). See database_interactions.js profiles select fix.
CREATE POLICY "profiles: course peers read"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.enrollments e1
      JOIN   public.enrollments e2 ON e1.course_id = e2.course_id
      WHERE  e1.user_id = auth.uid()
        AND  e2.user_id = profiles.id
    )
  );


-- ────────────────────────────────────────────────────────────
-- SECTION 2  Security — tighten enrollment INSERT RLS
--
-- Old policy: any authenticated user could enroll themselves
-- into any course whose UUID they knew, bypassing the invite
-- system entirely.
-- New policy: self-enrollment requires a matching pending invite.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "enrollments: insert" ON public.enrollments;

CREATE POLICY "enrollments: insert"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (
    -- Privileged actors can enroll anyone
    is_course_creator(course_id)
    OR is_course_instructor(course_id)
    OR (course_id IN (SELECT get_superadmin_course_ids()))
    -- Students may self-enroll only if they hold a pending invite
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM   public.invites  i
        JOIN   public.profiles p ON p.id = auth.uid()
        WHERE  i.course_id = enrollments.course_id
          AND  i.email     = p.email
          AND  i.status    = 'pending'
      )
    )
  );


-- ────────────────────────────────────────────────────────────
-- SECTION 3  Schema — courses.code: make nullable
--
-- The column was NOT NULL but the admin UI allowed blank values,
-- causing constraint violations on insert.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.courses ALTER COLUMN code DROP NOT NULL;


-- ────────────────────────────────────────────────────────────
-- SECTION 4  Schema — quiz_submissions: add missing columns
--
-- The client upserts auto_score and graded, but the schema
-- lacked both columns, causing every quiz submit to fail.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS auto_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS graded     boolean NOT NULL DEFAULT false;


-- ────────────────────────────────────────────────────────────
-- SECTION 5  Schema — assignments: add missing column
--
-- The client maps a.late_penalty_type but the column was absent
-- from the schema, causing the mapped value to always be the
-- fallback ('per_day') regardless of what was stored.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS late_penalty_type text NOT NULL DEFAULT 'per_day';


-- ────────────────────────────────────────────────────────────
-- SECTION 6  Schema — add updated_at to mutable tables
--
-- submissions, grades, quiz_submissions, module_items, and
-- rubric_criteria had no updated_at column, making cache
-- invalidation and incremental sync unreliable.
-- Reuses the existing update_updated_at() trigger function.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.module_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.rubric_criteria
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Wire up the triggers
CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER grades_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER quiz_submissions_updated_at
  BEFORE UPDATE ON public.quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER module_items_updated_at
  BEFORE UPDATE ON public.module_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER rubric_criteria_updated_at
  BEFORE UPDATE ON public.rubric_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- SECTION 7  Schema — question_type enum cleanup
--
-- The enum contained three deprecated values that were
-- superseded by more specific ones:
--   multiple_choice → mc_single
--   true_false      → mc_single  (two-option single-choice)
--   short_answer    → essay
--
-- Step 1 migrates any existing rows; steps 2-4 rebuild the
-- enum cleanly. If your quiz_questions table is empty, or if
-- you have already confirmed no rows use the old values, the
-- UPDATE statements are no-ops.
-- ────────────────────────────────────────────────────────────

-- Step 1: migrate data
UPDATE public.quiz_questions SET type = 'mc_single' WHERE type = 'multiple_choice';
UPDATE public.quiz_questions SET type = 'mc_single' WHERE type = 'true_false';
UPDATE public.quiz_questions SET type = 'essay'     WHERE type = 'short_answer';

-- Step 2: create new enum without deprecated values
CREATE TYPE public.question_type_v2 AS ENUM (
  'mc_single', 'mc_multi', 'essay', 'matching', 'ordering'
);

-- Step 3: swap column type (cast through text)
ALTER TABLE public.quiz_questions
  ALTER COLUMN type TYPE public.question_type_v2
    USING type::text::public.question_type_v2;

-- Step 4: remove old enum, rename new one
DROP TYPE public.question_type;
ALTER TYPE public.question_type_v2 RENAME TO question_type;


-- ────────────────────────────────────────────────────────────
-- SECTION 8  Schema — standardise UUID generators
--
-- Replaces uuid_generate_v4() (needs uuid-ossp extension) with
-- gen_random_uuid() (built into PostgreSQL ≥ 13) on all tables
-- that still used the old default. Only affects NEW rows.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.courses          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.enrollments      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.files            ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.modules          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.module_items     ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.assignments      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.quizzes          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.question_banks   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.submissions      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.grade_categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.grades           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.quiz_questions   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.quiz_submissions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.rubrics          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.rubric_criteria  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.invites          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.announcements    ALTER COLUMN id SET DEFAULT gen_random_uuid();


-- ────────────────────────────────────────────────────────────
-- SECTION 9  Schema — files: replace boolean flags with enum
--
-- is_placeholder and is_youtube allowed invalid combined states
-- and don't scale to additional file types. A new `type` column
-- using file_type enum replaces them.
--
-- The old boolean columns are intentionally retained for now
-- so existing client code doesn't break. Drop them once all
-- reads/writes reference the new `type` column instead.
-- ────────────────────────────────────────────────────────────

CREATE TYPE public.file_type AS ENUM (
  'storage', 'youtube', 'external_link', 'placeholder'
);

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS type public.file_type;

-- Populate from existing booleans (is_youtube takes precedence
-- over is_placeholder to avoid losing real YouTube entries)
UPDATE public.files SET type =
  CASE
    WHEN is_youtube                                        THEN 'youtube'::public.file_type
    WHEN is_placeholder                                    THEN 'placeholder'::public.file_type
    WHEN external_url IS NOT NULL AND external_url <> ''  THEN 'external_link'::public.file_type
    ELSE                                                        'storage'::public.file_type
  END;

ALTER TABLE public.files ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.files ALTER COLUMN type SET DEFAULT 'storage';


-- ────────────────────────────────────────────────────────────
-- SECTION 10  Schema — drop redundant time_allowed column
--
-- Both assignment_overrides and assignments had time_allowed
-- AND time_limit representing the same concept. time_limit is
-- the canonical name (used by quizzes, quiz_time_overrides).
-- Data is preserved: time_allowed is copied into time_limit
-- for any rows where only time_allowed was set.
-- ────────────────────────────────────────────────────────────

-- Preserve any data in time_allowed not already in time_limit
UPDATE public.assignment_overrides
  SET time_limit = time_allowed
  WHERE time_limit IS NULL AND time_allowed IS NOT NULL;

UPDATE public.assignments
  SET time_limit = time_allowed
  WHERE time_limit IS NULL AND time_allowed IS NOT NULL;

-- Drop the redundant column from both tables
ALTER TABLE public.assignment_overrides DROP COLUMN IF EXISTS time_allowed;
ALTER TABLE public.assignments          DROP COLUMN IF EXISTS time_allowed;


-- ────────────────────────────────────────────────────────────
-- SECTION 11  Schema — profiles name sync trigger
--
-- Ensures profiles.name stays consistent with given_name and
-- family_name whenever either is updated. Previously there was
-- no trigger, so edits to given_name/family_name would silently
-- leave name stale.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_profile_name()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.given_name IS NOT NULL OR NEW.family_name IS NOT NULL THEN
    NEW.name = TRIM(
      COALESCE(NEW.given_name, '') || ' ' || COALESCE(NEW.family_name, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_name ON public.profiles;

CREATE TRIGGER profiles_sync_name
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name();


-- ────────────────────────────────────────────────────────────
-- SECTION 12  Documentation — quiz_submissions.assignment_id
--
-- Add a comment documenting the intent of this FK so future
-- developers understand why it exists alongside quiz_id.
-- ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.quiz_submissions.assignment_id IS
  'Links this quiz submission to the parent assignment record so the '
  'grading system can attach a grade row. Should be non-null whenever '
  'the quiz was launched from within an assignment. Consider adding a '
  'NOT NULL constraint once all legacy rows have been confirmed to '
  'carry a value.';


-- ────────────────────────────────────────────────────────────
-- SECTION 1-FIX  Security — break RLS recursion in profiles
--
-- profiles: course peers read queries enrollments directly.
-- enrollments RLS policies in turn reference profiles (e.g.
-- the invite-check branch joins profiles to look up the current
-- user's email). PostgreSQL detects the cycle and the query
-- hangs, causing the admin "verifying access" screen to freeze.
--
-- Fix: wrap the enrollments sub-query in a SECURITY DEFINER
-- function (runs as the DB owner, bypasses RLS completely),
-- then reference that function from the policy. No data or
-- behavioural change — just breaks the evaluation cycle.
-- ────────────────────────────────────────────────────────────

-- Helper: returns UUIDs of all users co-enrolled with the
-- current user in at least one course, without triggering
-- enrollments' own RLS (SECURITY DEFINER bypasses it).
CREATE OR REPLACE FUNCTION public.get_peer_user_ids()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT DISTINCT e2.user_id
  FROM   public.enrollments e1
  JOIN   public.enrollments e2 ON e1.course_id = e2.course_id
  WHERE  e1.user_id = auth.uid()
    AND  e2.user_id <> auth.uid();
$$;

-- Rebuild the policy to call the helper instead of querying
-- enrollments inline.
DROP POLICY IF EXISTS "profiles: course peers read" ON public.profiles;

CREATE POLICY "profiles: course peers read"
  ON public.profiles
  FOR SELECT
  USING (id IN (SELECT public.get_peer_user_ids()));


-- ============================================================
-- End of migration.
-- Non-SQL items requiring separate action:
--
-- A) database_interactions.js: profiles select('*') →
--    select('id, email, name, avatar, given_name, family_name')
--    (committed separately; see companion code change)
--
-- B) supabase/functions/gemini/index.ts: update endpoint from
--    /v1beta/models/gemini-2.0-flash to /v1/models/gemini-2.0-flash
--    once the model is promoted to stable.
--
-- C) CURRENT_DATABASE_STRUCTURE.md: regenerate from Supabase
--    after running this migration to keep docs in sync.
-- ============================================================
