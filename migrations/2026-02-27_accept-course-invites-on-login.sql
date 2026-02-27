-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27d
-- Expand accept_pending_org_invites() to also auto-accept
-- course-level invites (the `invites` table).
--
-- When a student is invited via admin and then enrolled in a
-- course, both an org_invites row and an invites row are
-- created.  On first login the RPC function should:
--   1. Create org_members + delete org_invites  (existing)
--   2. Create enrollments + delete invites      (new)
--
-- Also adds a unique index on enrollments(user_id, course_id)
-- so the INSERT … ON CONFLICT is safe and idempotent.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Unique constraint on enrollments (user_id, course_id)
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON public.enrollments (user_id, course_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 2  Updated accept_pending_org_invites()
--
-- Now also handles course-level invites: for each pending
-- invite row matching the caller's email, inserts an
-- enrollment and deletes the invite.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_pending_org_invites()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email   text;
  inv       record;
  cinv      record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Email comes from the profile that was just upserted before this call.
  SELECT email INTO v_email
  FROM   public.profiles
  WHERE  id = v_user_id;

  IF v_email IS NULL THEN RETURN; END IF;

  -- ── Org-level invites ──────────────────────────────────────
  FOR inv IN
    SELECT id, org_id, role, invited_by
    FROM   public.org_invites
    WHERE  email  = v_email
      AND  status = 'pending'
  LOOP
    -- Create org membership (idempotent — safe on repeated sign-ins).
    INSERT INTO public.org_members (org_id, user_id, role, created_by)
    VALUES (
      inv.org_id,
      v_user_id,
      inv.role,
      COALESCE(inv.invited_by, v_user_id)
    )
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- Delete the org invite — no longer needed.
    DELETE FROM public.org_invites WHERE id = inv.id;
  END LOOP;

  -- ── Course-level invites ───────────────────────────────────
  FOR cinv IN
    SELECT id, course_id, role
    FROM   public.invites
    WHERE  email  = v_email
      AND  status = 'pending'
  LOOP
    -- Create enrollment (idempotent).
    INSERT INTO public.enrollments (user_id, course_id, role)
    VALUES (v_user_id, cinv.course_id, cinv.role)
    ON CONFLICT (user_id, course_id) DO NOTHING;

    -- Delete the course invite — no longer needed.
    DELETE FROM public.invites WHERE id = cinv.id;
  END LOOP;
END;
$$;

-- Grant stays the same — any authenticated user can call this.
GRANT EXECUTE ON FUNCTION public.accept_pending_org_invites() TO authenticated;


-- ============================================================
-- End of migration.
-- ============================================================
