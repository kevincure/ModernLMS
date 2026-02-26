-- ============================================================
-- ModernLMS — Schema Migration 2026-02-26
-- Fix: infinite recursion in enrollment RLS policies +
--      "column course_id does not exist" in course deletion +
--      add department_id to courses for course groups
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- FIX 1a  SECURITY DEFINER helpers
--
-- Functions used inside RLS policies on enrollments and courses
-- must bypass RLS themselves, otherwise they trigger policy
-- re-evaluation and PostgreSQL raises "infinite recursion
-- detected in policy for relation enrollments".
--
-- Even though the query rewriter treats function calls as
-- opaque (so they don't cause compile-time cycles by
-- themselves), they WILL cause runtime recursion when the
-- executed SQL inside a SECURITY INVOKER function triggers
-- RLS on the same tables.  SECURITY DEFINER prevents this.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_course_instructor(p_course_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.enrollments
    WHERE  course_id = p_course_id
      AND  user_id   = auth.uid()
      AND  role      = 'instructor'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_course_creator(p_course_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.courses
    WHERE  id         = p_course_id
      AND  created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(p_course_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.enrollments
    WHERE  course_id = p_course_id
      AND  user_id   = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_in_course(p_course_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.enrollments
    WHERE  course_id = p_course_id
      AND  user_id   = auth.uid()
      AND  role      IN ('instructor', 'ta')
  );
$$;

-- Also promote get_superadmin_course_ids to SECURITY DEFINER.
-- It queries courses (which triggers courses:select RLS at
-- runtime when INVOKER), so make it safe.
CREATE OR REPLACE FUNCTION public.get_superadmin_course_ids()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT c.id
  FROM   public.courses c
  WHERE  c.org_id IN (SELECT public.get_superadmin_org_ids());
$$;

-- get_superadmin_org_ids — returns org IDs where caller is
-- superadmin.  Must also be SECURITY DEFINER so it can read
-- org_members without triggering org_members RLS.
CREATE OR REPLACE FUNCTION public.get_superadmin_org_ids()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT om.org_id
  FROM   public.org_members om
  WHERE  om.user_id = auth.uid()
    AND  om.role    = 'superadmin';
$$;

-- is_org_superadmin — SECURITY DEFINER to avoid recursion with
-- org_members RLS (which itself calls is_org_superadmin).
CREATE OR REPLACE FUNCTION public.is_org_superadmin(p_org_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.org_members
    WHERE  org_id  = p_org_id
      AND  user_id = auth.uid()
      AND  role    = 'superadmin'
  );
$$;

-- is_org_admin_or_higher — same treatment.
CREATE OR REPLACE FUNCTION public.is_org_admin_or_higher(p_org_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.org_members
    WHERE  org_id  = p_org_id
      AND  user_id = auth.uid()
      AND  role    IN ('admin', 'superadmin')
  );
$$;


-- ────────────────────────────────────────────────────────────
-- FIX 1b  Enrollment INSERT policy — inline invites subquery
--
-- ROOT CAUSE of the "infinite recursion" error:
--
-- The enrollment INSERT policy contained an INLINE subquery:
--   EXISTS (SELECT 1 FROM invites i JOIN profiles p ON …)
--
-- PostgreSQL's query rewriter expands RLS for inline table
-- references.  The invites SELECT policy itself has an inline
--   EXISTS (SELECT 1 FROM enrollments …)
--
-- This creates a compile-time table reference cycle:
--   enrollments → invites → enrollments  →  CYCLE DETECTED
--
-- Fix: move the invite check into a SECURITY DEFINER function
-- (opaque to the rewriter) and rebuild the policy to call it.
-- ────────────────────────────────────────────────────────────

-- Helper: checks whether the current user has a pending invite
-- for the given course.  SECURITY DEFINER so the rewriter does
-- not follow the invites/profiles table references.
CREATE OR REPLACE FUNCTION public.has_pending_course_invite(p_course_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.invites  i
    JOIN   public.profiles p ON p.id = auth.uid()
    WHERE  i.course_id = p_course_id
      AND  i.email     = p.email
      AND  i.status    = 'pending'
  );
$$;

-- Rebuild the enrollment INSERT policy using the new helper.
DROP POLICY IF EXISTS "enrollments: insert" ON public.enrollments;

CREATE POLICY "enrollments: insert"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (
    is_course_creator(course_id)
    OR is_course_instructor(course_id)
    OR (course_id IN (SELECT get_superadmin_course_ids()))
    OR (
      user_id = auth.uid()
      AND has_pending_course_invite(course_id)
    )
  );


-- ────────────────────────────────────────────────────────────
-- FIX 2  delete_course_for_org_superadmin: wrong column name
--
-- The function body contained:
--   DELETE FROM public.courses WHERE course_id = p_course_id
-- but the courses PK column is `id`, not `course_id`.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_course_for_org_superadmin(p_course_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a superadmin for this course's org.
  IF NOT EXISTS (
    SELECT 1
    FROM   public.courses c
    WHERE  c.id = p_course_id
      AND  public.is_org_superadmin(c.org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not a superadmin for this course''s organisation';
  END IF;

  -- ── Delete child records in dependency order ──────────────

  -- grades → submissions → assignments
  DELETE FROM public.grades
  WHERE  submission_id IN (
    SELECT s.id FROM public.submissions s
    JOIN   public.assignments a ON a.id = s.assignment_id
    WHERE  a.course_id = p_course_id
  );

  DELETE FROM public.submissions
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- rubric_criteria → rubrics → assignments
  DELETE FROM public.rubric_criteria
  WHERE  rubric_id IN (
    SELECT r.id FROM public.rubrics r
    JOIN   public.assignments a ON a.id = r.assignment_id
    WHERE  a.course_id = p_course_id
  );

  DELETE FROM public.rubrics
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- assignment_overrides → assignments
  DELETE FROM public.assignment_overrides
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- quiz_submissions → quizzes
  DELETE FROM public.quiz_submissions
  WHERE  quiz_id IN (
    SELECT id FROM public.quizzes WHERE course_id = p_course_id
  );

  -- quiz_time_overrides → quizzes
  DELETE FROM public.quiz_time_overrides
  WHERE  quiz_id IN (
    SELECT id FROM public.quizzes WHERE course_id = p_course_id
  );

  -- quiz_questions → question_banks
  DELETE FROM public.quiz_questions
  WHERE  bank_id IN (
    SELECT id FROM public.question_banks WHERE course_id = p_course_id
  );

  -- module_items → modules
  DELETE FROM public.module_items
  WHERE  module_id IN (
    SELECT id FROM public.modules WHERE course_id = p_course_id
  );

  -- discussion_replies → discussion_threads
  DELETE FROM public.discussion_replies
  WHERE  thread_id IN (
    SELECT id FROM public.discussion_threads WHERE course_id = p_course_id
  );

  -- ── Direct course children ────────────────────────────────
  DELETE FROM public.question_banks    WHERE course_id = p_course_id;
  DELETE FROM public.quizzes           WHERE course_id = p_course_id;
  DELETE FROM public.assignments       WHERE course_id = p_course_id;
  DELETE FROM public.modules           WHERE course_id = p_course_id;
  DELETE FROM public.discussion_threads WHERE course_id = p_course_id;
  DELETE FROM public.announcements     WHERE course_id = p_course_id;
  DELETE FROM public.files             WHERE course_id = p_course_id;
  DELETE FROM public.grade_settings    WHERE course_id = p_course_id;
  DELETE FROM public.grade_categories  WHERE course_id = p_course_id;
  DELETE FROM public.invites           WHERE course_id = p_course_id;
  DELETE FROM public.enrollments       WHERE course_id = p_course_id;

  -- ── Finally delete the course (PK column is `id`) ─────────
  DELETE FROM public.courses WHERE id = p_course_id;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- FIX 3  Add department_id to courses for course-group support
--
-- Allows assigning a course to a department (child org) when
-- creating it.  Nullable — courses without a department are
-- org-wide.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS department_id uuid
    REFERENCES public.orgs(id) ON DELETE SET NULL;


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
