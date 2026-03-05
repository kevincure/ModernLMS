-- LTI AGS → LMS Gradebook sync
-- Connects line items to assignments and score passback to grades.
-- Run AFTER 20260305_lti_advantage_v2.sql

-- 1. Mark submissions that were auto-created by LTI AGS so they can be
--    distinguished from real student submissions and safely cleaned up
--    when a line item is deleted.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'student';
-- Valid values: 'student' | 'lti_ags'

COMMENT ON COLUMN public.submissions.source IS
  'Origin of the submission: ''student'' = submitted by learner, ''lti_ags'' = auto-created by LTI AGS score passback';

-- 2. Atomic function: find-or-create a submission then upsert its grade.
--    Called by the LTI platform worker (service role) when a tool posts
--    a score with gradingProgress = FullyGraded.
--
--    Returns: { submission_id, grade_id }
CREATE OR REPLACE FUNCTION public.lti_ags_sync_grade(
  p_assignment_id uuid,
  p_user_id       uuid,
  p_score         numeric,
  p_comment       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id uuid;
  v_grade_id      uuid;
BEGIN
  -- Find the most recent submission for this student + assignment.
  -- Prefer an existing lti_ags submission so we reuse it on re-grades.
  SELECT id INTO v_submission_id
  FROM public.submissions
  WHERE assignment_id = p_assignment_id
    AND user_id       = p_user_id
  ORDER BY
    CASE WHEN source = 'lti_ags' THEN 0 ELSE 1 END,
    submitted_at DESC
  LIMIT 1;

  IF v_submission_id IS NULL THEN
    -- No prior submission: create a synthetic one on behalf of the student.
    INSERT INTO public.submissions (assignment_id, user_id, source, submitted_at)
    VALUES (p_assignment_id, p_user_id, 'lti_ags', now())
    RETURNING id INTO v_submission_id;
  ELSE
    -- Refresh timestamp so the gradebook sees an update time.
    UPDATE public.submissions
    SET updated_at = now(), source = 'lti_ags'
    WHERE id = v_submission_id;
  END IF;

  -- Upsert grade for this submission.
  SELECT id INTO v_grade_id
  FROM public.grades
  WHERE submission_id = v_submission_id
  LIMIT 1;

  IF v_grade_id IS NULL THEN
    INSERT INTO public.grades (submission_id, score, feedback, released, graded_by, graded_at)
    VALUES (v_submission_id, p_score, p_comment, true, null, now())
    RETURNING id INTO v_grade_id;
  ELSE
    UPDATE public.grades
    SET score    = p_score,
        feedback = p_comment,
        released = true,
        graded_at = now(),
        updated_at = now()
    WHERE id = v_grade_id;
  END IF;

  RETURN jsonb_build_object(
    'submission_id', v_submission_id,
    'grade_id',      v_grade_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lti_ags_sync_grade TO service_role;
