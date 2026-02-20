-- ============================================================
-- Staff Manual Grade / Submission RLS Policies
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Allow instructors/TAs to create placeholder submissions
--    on behalf of students in their courses (for manual grading).
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

-- 2. Allow instructors/TAs to update any submission in their courses
--    (needed for updating placeholder submissions to add files, etc.)
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

-- 3. Allow instructors/TAs to insert grades for submissions in their courses.
--    (The existing "Staff can grade" policy may already cover UPDATE;
--     this covers INSERT for new grade rows.)
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
