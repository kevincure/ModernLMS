-- ============================================================
-- ModernLMS — Schema Migration 2026-02-28b
-- Fix get_course_recipients: column reference "user_id" was
-- ambiguous in PL/pgSQL because the RETURNS TABLE declaration
-- creates a local variable with the same name as the SELECT
-- column.  Rewrite as LANGUAGE sql where RETURNS TABLE column
-- names are output-only aliases with no variable scope.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_course_recipients(p_course_id uuid)
RETURNS TABLE (
  user_id uuid,
  name    text,
  email   text,
  role    text,
  avatar  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id,
         p.name,
         p.email,
         e.role,
         p.avatar
  FROM   public.enrollments e
  JOIN   public.profiles    p ON p.id = e.user_id
  WHERE  e.course_id = p_course_id
    AND  e.user_id  != auth.uid()
    AND  EXISTS (
           SELECT 1 FROM public.enrollments
           WHERE  course_id = p_course_id
             AND  user_id   = auth.uid()
         );
$$;

GRANT EXECUTE ON FUNCTION public.get_course_recipients(uuid)
  TO authenticated;
