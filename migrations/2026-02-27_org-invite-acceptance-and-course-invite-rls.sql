-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27b
-- Fix three invite/enrollment gaps:
--   1. accept_pending_org_invites() — auto-accept org membership
--      when an invited user first signs in
--   2. invites: own email select — let new users see their own
--      pending course invites (breaks chicken-and-egg with RLS)
--   3. invites: superadmin insert — allow org superadmins to
--      create course-level invites for pending users in admin UI
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Unique constraint on org_members (org_id, user_id)
--
-- Required so the INSERT … ON CONFLICT (org_id, user_id) in
-- accept_pending_org_invites() compiles without error.
-- The constraint also enforces data integrity (a user should
-- only appear once per org).
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_org_user
  ON public.org_members (org_id, user_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 2  accept_pending_org_invites() RPC
--
-- Called by the client (supabaseEnsureProfile) on every
-- sign-in.  For each pending org_invite matching the signed-in
-- user's email:
--   a) Inserts an org_members row (ON CONFLICT = no-op so safe
--      to call repeatedly)
--   b) Updates org_invites.status to 'accepted'
--
-- SECURITY DEFINER lets the function bypass RLS, which is
-- required because:
--   • org_members INSERT is only allowed to superadmins
--   • org_invites UPDATE is only allowed to superadmins
-- The function itself is callable by any authenticated user
-- (GRANT EXECUTE below) but only acts on the caller's own
-- email, so there is no privilege escalation risk.
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

    -- Mark the org-level invite as accepted.
    UPDATE public.org_invites
    SET    status = 'accepted'
    WHERE  id     = inv.id;
  END LOOP;
END;
$$;

-- Allow any signed-in user to call this.  The function only
-- touches rows matched by auth.uid() / the caller's email.
GRANT EXECUTE ON FUNCTION public.accept_pending_org_invites() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- SECTION 3  invites: own email select
--
-- Problem: the existing invites SELECT policy requires the
-- user to already be enrolled in the course to see their
-- invite — a chicken-and-egg problem for brand-new users.
--
-- Fix: add a second SELECT policy that allows any user to
-- read invite rows where the email matches their own JWT
-- email.  Supabase OR's multiple SELECT policies, so this
-- is purely additive.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invites: own email select" ON public.invites;

CREATE POLICY "invites: own email select"
  ON public.invites
  FOR SELECT
  USING (email = auth.email());


-- ────────────────────────────────────────────────────────────
-- SECTION 4  invites: superadmin insert
--
-- Allows org superadmins to create course-level invite rows
-- for pending users via the admin panel UI.  The existing
-- INSERT policy only covers course instructors/TAs (enrolled
-- staff), so superadmins who are not enrolled in a specific
-- course couldn't create invites for it.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invites: superadmin insert" ON public.invites;

CREATE POLICY "invites: superadmin insert"
  ON public.invites
  FOR INSERT
  WITH CHECK (
    course_id IN (SELECT public.get_superadmin_course_ids())
  );


-- ============================================================
-- End of migration.
-- ============================================================
