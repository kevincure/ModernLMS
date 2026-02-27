-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27c
-- Clean up invite rows on acceptance instead of leaving
-- them with status = 'accepted' / 'rejected'.
--
--   1. accept_pending_org_invites() — DELETE org_invites rows
--      instead of marking them 'accepted'.  Once the user is in
--      org_members the invite row serves no purpose.
--
--   2. invites: own email delete — allow a user to DELETE a
--      course-invite row where the email matches their own JWT
--      email.  Needed so acceptInvite() / rejectInvite() on the
--      client can hard-delete the row instead of updating status.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Update accept_pending_org_invites() to DELETE rows
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Email comes from the profile that was just upserted before this call.
  SELECT email INTO v_email
  FROM   public.profiles
  WHERE  id = v_user_id;

  IF v_email IS NULL THEN RETURN; END IF;

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

    -- Delete the org invite — it is no longer needed once the user
    -- has a real org_members row.
    DELETE FROM public.org_invites WHERE id = inv.id;
  END LOOP;
END;
$$;

-- Grant stays the same — any authenticated user can call this.
GRANT EXECUTE ON FUNCTION public.accept_pending_org_invites() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- SECTION 2  invites: own email delete
--
-- Allows a user to delete a course-invite row addressed to
-- their own email.  Required so that accepting or declining a
-- course invite from the client removes the row entirely
-- (instead of updating status to 'accepted'/'rejected').
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invites: own email delete" ON public.invites;

CREATE POLICY "invites: own email delete"
  ON public.invites
  FOR DELETE
  USING (email = auth.email());


-- ============================================================
-- End of migration.
-- ============================================================
