-- ============================================================
-- ModernLMS — Schema Migration 2026-02-28c
-- Fix notifications INSERT RLS: the policy's inline
-- EXISTS (SELECT 1 FROM enrollments WHERE user_id = notifications.user_id)
-- checked the RECIPIENT's enrollment but ran as SECURITY INVOKER,
-- so enrollment RLS blocked reading other users' rows (42501).
--
-- Fix: add a SECURITY DEFINER helper user_is_enrolled_in_course()
-- that accepts an explicit user_id, then use it in the policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_is_enrolled_in_course(
  p_user_id   uuid,
  p_course_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id
      AND user_id   = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_enrolled_in_course(uuid, uuid)
  TO authenticated;


DROP POLICY IF EXISTS "notifications: insert" ON public.notifications;
CREATE POLICY "notifications: insert"
  ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      course_id IS NOT NULL
      AND is_enrolled_in_course(course_id)
      AND user_is_enrolled_in_course(user_id, course_id)
    )
  );
