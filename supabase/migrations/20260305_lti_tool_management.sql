-- LTI Tool Management: admin authorization + faculty course assignment + student visibility
-- Run AFTER 20260304_lti13_platform.sql and 20260305_lti_advantage_v2.sql

-- ─── 1) New columns ──────────────────────────────────────────────────────────

-- Admin can authorize/revoke tools for org use (default true to keep existing tools visible)
ALTER TABLE public.lti_registrations
  ADD COLUMN IF NOT EXISTS admin_authorized boolean NOT NULL DEFAULT true;

-- Faculty can hide/show tools per course-level deployment
ALTER TABLE public.lti_deployments
  ADD COLUMN IF NOT EXISTS visible_to_students boolean NOT NULL DEFAULT false;

-- ─── 2) Helper: is the current user an instructor in a given course? ──────────

CREATE OR REPLACE FUNCTION public.is_course_instructor(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE course_id = p_course_id
      AND user_id = auth.uid()
      AND role IN ('instructor', 'ta')
  )
$$;

-- ─── 3) SELECT policies so app.js can load tool data for all org members ─────
--  (existing "superadmin all" policy only covers superadmins; regular users
--   need explicit SELECT grants so database_interactions.js can populate appData)

CREATE POLICY "lti registrations org member select"
  ON public.lti_registrations
  FOR SELECT
  USING (
    is_org_superadmin(org_id)
    OR org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lti deployments org member select"
  ON public.lti_deployments
  FOR SELECT
  USING (
    is_org_superadmin(org_id)
    OR org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- ─── 4) INSERT/UPDATE so instructors can manage course-level deployments ──────

CREATE POLICY "lti deployments instructor insert"
  ON public.lti_deployments
  FOR INSERT
  WITH CHECK (
    scope_type = 'course'
    AND is_course_instructor(scope_ref::uuid)
    AND (
      SELECT admin_authorized
      FROM public.lti_registrations
      WHERE id = registration_id
    )
  );

CREATE POLICY "lti deployments instructor update"
  ON public.lti_deployments
  FOR UPDATE
  USING (
    scope_type = 'course'
    AND is_course_instructor(scope_ref::uuid)
  )
  WITH CHECK (
    scope_type = 'course'
    AND is_course_instructor(scope_ref::uuid)
  );
