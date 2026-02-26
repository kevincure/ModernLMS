-- ============================================================
-- ModernLMS — Schema Migration 2026-02-26
-- Fix: infinite recursion in enrollment RLS policies +
--      "column course_id does not exist" in course deletion
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- BUG 1  RLS recursion: enrollment INSERT/SELECT policies
--
-- Root cause: the enrollment RLS policies call helper functions
-- (is_course_instructor, is_course_creator, is_enrolled_in_course,
-- is_instructor_in_course) that themselves query enrollments or
-- courses without bypassing RLS.  PostgreSQL detects the cycle:
--
--   enrollments:insert  → is_course_instructor(course_id)
--                        → SELECT FROM enrollments   ← policy fires again
--
--   enrollments:insert  → is_course_creator(course_id)
--                        → SELECT FROM courses
--                        → courses:select fires
--                        → is_enrolled_in_course(id)
--                        → SELECT FROM enrollments   ← policy fires again
--
-- Fix: rebuild all four helpers as SECURITY DEFINER so they run
-- as the DB owner and bypass RLS entirely.  The functions contain
-- no data the caller couldn't otherwise read; SECURITY DEFINER
-- only prevents the policy re-entry loop.
-- ────────────────────────────────────────────────────────────

-- Returns true when the calling user holds the 'instructor' role
-- in the given course (queries enrollments without triggering RLS).
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

-- Returns true when the calling user created the given course
-- (queries courses without triggering RLS).
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

-- Returns true when the calling user has any enrollment in the
-- given course (queries enrollments without triggering RLS).
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

-- Returns true when the calling user is an instructor or TA in
-- the given course (queries enrollments without triggering RLS).
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


-- ────────────────────────────────────────────────────────────
-- BUG 2  delete_course_for_org_superadmin: wrong column name
--
-- Root cause: the function body contained
--   DELETE FROM public.courses WHERE course_id = p_course_id
-- but the courses table's primary-key column is `id`, not
-- `course_id` (that name is used only as a FK in child tables).
-- PostgreSQL raises "column course_id does not exist".
--
-- Fix: rewrite the function using `id = p_course_id` for the
-- final courses deletion.  All child tables that reference
-- courses indirectly (via assignments, modules, quizzes, etc.)
-- are deleted in dependency order so no FK violation occurs.
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

  -- grades reference submissions
  DELETE FROM public.grades
  WHERE  submission_id IN (
    SELECT s.id FROM public.submissions s
    JOIN   public.assignments a ON a.id = s.assignment_id
    WHERE  a.course_id = p_course_id
  );

  -- submissions reference assignments
  DELETE FROM public.submissions
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- rubric_criteria reference rubrics
  DELETE FROM public.rubric_criteria
  WHERE  rubric_id IN (
    SELECT r.id FROM public.rubrics r
    JOIN   public.assignments a ON a.id = r.assignment_id
    WHERE  a.course_id = p_course_id
  );

  -- rubrics reference assignments
  DELETE FROM public.rubrics
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- assignment_overrides reference assignments
  DELETE FROM public.assignment_overrides
  WHERE  assignment_id IN (
    SELECT id FROM public.assignments WHERE course_id = p_course_id
  );

  -- quiz_submissions reference quizzes
  DELETE FROM public.quiz_submissions
  WHERE  quiz_id IN (
    SELECT id FROM public.quizzes WHERE course_id = p_course_id
  );

  -- quiz_time_overrides reference quizzes
  DELETE FROM public.quiz_time_overrides
  WHERE  quiz_id IN (
    SELECT id FROM public.quizzes WHERE course_id = p_course_id
  );

  -- quiz_questions reference question_banks
  DELETE FROM public.quiz_questions
  WHERE  bank_id IN (
    SELECT id FROM public.question_banks WHERE course_id = p_course_id
  );

  -- module_items reference modules
  DELETE FROM public.module_items
  WHERE  module_id IN (
    SELECT id FROM public.modules WHERE course_id = p_course_id
  );

  -- discussion_replies reference discussion_threads
  DELETE FROM public.discussion_replies
  WHERE  thread_id IN (
    SELECT id FROM public.discussion_threads WHERE course_id = p_course_id
  );

  -- ── Delete direct course children ─────────────────────────
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

  -- ── Finally delete the course itself (PK column is `id`) ──
  DELETE FROM public.courses WHERE id = p_course_id;
END;
$$;


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
