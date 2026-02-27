-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27d
-- Full invite-acceptance support: RPC + client-side RLS.
--
-- When a student is invited via admin and then enrolled in a
-- course, both an org_invites row and an invites row are
-- created.  On first login:
--   1. Create org_members + delete org_invites
--   2. Create enrollments + delete invites
--
-- The JS client attempts both an RPC call (SECURITY DEFINER)
-- and direct client-side operations.  This migration provides:
--   A. RLS policies so the client can handle invites directly
--   B. Updated RPC as a belt-and-suspenders fallback
--   C. Unique index on enrollments for idempotent inserts
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Unique constraint on enrollments (user_id, course_id)
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON public.enrollments (user_id, course_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 2  RLS — org_invites: let users read + delete their
--            own pending invites
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_invites: own email select" ON public.org_invites;
CREATE POLICY "org_invites: own email select"
  ON public.org_invites
  FOR SELECT
  USING (email = auth.email());

DROP POLICY IF EXISTS "org_invites: own email delete" ON public.org_invites;
CREATE POLICY "org_invites: own email delete"
  ON public.org_invites
  FOR DELETE
  USING (email = auth.email());


-- ────────────────────────────────────────────────────────────
-- SECTION 3  RLS — org_members: let users insert themselves
--            when they have a matching pending org invite
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_members: self-insert via pending invite" ON public.org_members;
CREATE POLICY "org_members: self-insert via pending invite"
  ON public.org_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM   public.org_invites oi
      WHERE  oi.org_id = org_members.org_id
        AND  oi.email  = auth.email()
        AND  oi.status = 'pending'
    )
  );


-- ────────────────────────────────────────────────────────────
-- SECTION 4  Updated accept_pending_org_invites() RPC
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
