-- ============================================================
-- Assignment Schema Migrations
-- Run this ENTIRE file in the Supabase SQL editor (Query Editor).
-- ============================================================

-- 1. Add optional "time to complete" (minutes) to assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS time_allowed integer;   -- NULL = unlimited

-- 2. Expand assignment_overrides to support all four override types
--    (due date, available from, available until, time allowed).
--    Make due_date nullable since you might only override one field.
ALTER TABLE public.assignment_overrides
  ALTER COLUMN due_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS available_from  timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS time_allowed    integer;

-- ============================================================
-- How the overrides are applied at runtime (app logic):
--
--   effective_due_date      = override.due_date      ?? assignment.due_date
--   effective_avail_from    = override.available_from ?? assignment.available_from  ?? NOW()
--   effective_avail_until   = override.available_until ?? assignment.available_until ?? (late_submissions ? NULL : due_date)
--   effective_time_allowed  = override.time_allowed   ?? assignment.time_allowed    ?? NULL (unlimited)
-- ============================================================

-- 3. RLS policies: allow instructors/TAs to create manual grade entries

-- 3a. Allow staff to INSERT placeholder submissions on behalf of students
--     (needed for manual grading of students who haven't submitted)
CREATE POLICY "Staff can create manual submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE a.id = submissions.assignment_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );

-- 3b. Allow staff to UPDATE submissions in their courses
CREATE POLICY "Staff can update submissions in their courses"
  ON public.submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE a.id = submissions.assignment_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );

-- 3c. Allow staff to INSERT grade rows
--     (the existing "Staff can grade" policy covers UPDATE; this adds INSERT)
CREATE POLICY "Staff can insert grades"
  ON public.grades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE s.id = grades.submission_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );
