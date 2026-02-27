-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27d
-- Complete invite-acceptance support.
--
-- When a student is invited via admin (org_invites) and added
-- to a course (invites), on first login everything should be
-- auto-accepted: org_members created, enrollment created, and
-- both invite rows deleted.
--
-- This migration uses THREE complementary mechanisms so that
-- invites are handled regardless of timing:
--
--   A. handle_new_user() trigger — fires on first signup (auth.users
--      INSERT).  Runs as SECURITY DEFINER → bypasses RLS.  This is
--      the primary path for first-login invite acceptance.
--
--   B. accept_pending_org_invites() RPC — called by the client on
--      every sign-in.  Handles invites that arrive AFTER the user
--      already has an account (trigger won't fire again).
--
--   C. RLS policies — allow the client-side JS fallback to handle
--      invites directly if the RPC isn't available.
--
-- Also adds:
--   • Unique indexes for idempotent inserts
--   • Superadmin SELECT on invites (admin enrollments display)
--   • profiles INSERT/UPDATE policies (client-side profile upsert)
--
-- Safe to run multiple times (uses IF NOT EXISTS, CREATE OR REPLACE,
-- DROP ... IF EXISTS throughout).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1  Unique indexes (idempotent inserts)
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_org_user
  ON public.org_members (org_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON public.enrollments (user_id, course_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 2  handle_new_user() trigger — first-login path
--
-- Creates the profile AND accepts all pending invites in one
-- shot.  Runs as SECURITY DEFINER so no RLS restrictions.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  inv  record;
  cinv record;
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (id, email, name, given_name, family_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      TRIM(
        COALESCE(NEW.raw_user_meta_data->>'given_name', '') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'family_name', '')
      ),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'family_name'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Accept pending org invites ───────────────────────────
  FOR inv IN
    SELECT id, org_id, role, invited_by
    FROM   public.org_invites
    WHERE  email  = NEW.email
      AND  status = 'pending'
  LOOP
    INSERT INTO public.org_members (org_id, user_id, role, created_by)
    VALUES (inv.org_id, NEW.id, inv.role::org_member_role, COALESCE(inv.invited_by, NEW.id))
    ON CONFLICT (org_id, user_id) DO NOTHING;

    DELETE FROM public.org_invites WHERE id = inv.id;
  END LOOP;

  -- ── Accept pending course invites ────────────────────────
  FOR cinv IN
    SELECT id, course_id, role
    FROM   public.invites
    WHERE  email  = NEW.email
      AND  status = 'pending'
  LOOP
    INSERT INTO public.enrollments (user_id, course_id, role)
    VALUES (NEW.id, cinv.course_id, cinv.role::enrollment_role)
    ON CONFLICT (user_id, course_id) DO NOTHING;

    DELETE FROM public.invites WHERE id = cinv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate trigger (safe to re-run).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- SECTION 3  accept_pending_org_invites() RPC — repeat-login path
--
-- Called by the client on every sign-in to handle invites that
-- arrived after the user already had an account.
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

  SELECT email INTO v_email
  FROM   public.profiles
  WHERE  id = v_user_id;

  IF v_email IS NULL THEN RETURN; END IF;

  -- Org-level invites
  FOR inv IN
    SELECT id, org_id, role, invited_by
    FROM   public.org_invites
    WHERE  email  = v_email
      AND  status = 'pending'
  LOOP
    INSERT INTO public.org_members (org_id, user_id, role, created_by)
    VALUES (inv.org_id, v_user_id, inv.role::org_member_role, COALESCE(inv.invited_by, v_user_id))
    ON CONFLICT (org_id, user_id) DO NOTHING;

    DELETE FROM public.org_invites WHERE id = inv.id;
  END LOOP;

  -- Course-level invites
  FOR cinv IN
    SELECT id, course_id, role
    FROM   public.invites
    WHERE  email  = v_email
      AND  status = 'pending'
  LOOP
    INSERT INTO public.enrollments (user_id, course_id, role)
    VALUES (v_user_id, cinv.course_id, cinv.role::enrollment_role)
    ON CONFLICT (user_id, course_id) DO NOTHING;

    DELETE FROM public.invites WHERE id = cinv.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_pending_org_invites() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- SECTION 4  RLS policies — client-side fallback + admin UI
-- ────────────────────────────────────────────────────────────

-- profiles: allow users to insert/update their own row
DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- org_invites: users can read/delete their own pending invites
DROP POLICY IF EXISTS "org_invites: own email select" ON public.org_invites;
CREATE POLICY "org_invites: own email select"
  ON public.org_invites FOR SELECT
  USING (email = auth.email());

DROP POLICY IF EXISTS "org_invites: own email delete" ON public.org_invites;
CREATE POLICY "org_invites: own email delete"
  ON public.org_invites FOR DELETE
  USING (email = auth.email());

-- org_members: users can self-insert when they have a pending invite
DROP POLICY IF EXISTS "org_members: self-insert via pending invite" ON public.org_members;
CREATE POLICY "org_members: self-insert via pending invite"
  ON public.org_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.org_invites oi
      WHERE  oi.org_id = org_members.org_id
        AND  oi.email  = auth.email()
        AND  oi.status = 'pending'
    )
  );

-- invites: users can read/delete their own course invites
DROP POLICY IF EXISTS "invites: own email select" ON public.invites;
CREATE POLICY "invites: own email select"
  ON public.invites FOR SELECT
  USING (email = auth.email());

DROP POLICY IF EXISTS "invites: own email delete" ON public.invites;
CREATE POLICY "invites: own email delete"
  ON public.invites FOR DELETE
  USING (email = auth.email());

-- invites: superadmin can insert (for admin adding pending users to courses)
DROP POLICY IF EXISTS "invites: superadmin insert" ON public.invites;
CREATE POLICY "invites: superadmin insert"
  ON public.invites FOR INSERT
  WITH CHECK (course_id IN (SELECT public.get_superadmin_course_ids()));

-- invites: superadmin can read (admin enrollments display)
DROP POLICY IF EXISTS "invites: superadmin select" ON public.invites;
CREATE POLICY "invites: superadmin select"
  ON public.invites FOR SELECT
  USING (course_id IN (SELECT public.get_superadmin_course_ids()));

-- invites: superadmin can delete (cancel course invites from admin)
DROP POLICY IF EXISTS "invites: superadmin delete" ON public.invites;
CREATE POLICY "invites: superadmin delete"
  ON public.invites FOR DELETE
  USING (course_id IN (SELECT public.get_superadmin_course_ids()));


-- ────────────────────────────────────────────────────────────
-- SECTION 5  Back-fill profiles (safe no-op if all exist)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, name, given_name, family_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    TRIM(
      COALESCE(u.raw_user_meta_data->>'given_name', '') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'family_name', '')
    ),
    SPLIT_PART(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'given_name',
  u.raw_user_meta_data->>'family_name'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- End of migration.
-- ============================================================
