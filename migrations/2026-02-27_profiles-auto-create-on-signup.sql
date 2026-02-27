-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27
-- Auto-create profile rows for new auth users.
-- Run in the Supabase SQL editor (or psql as superuser).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1  Trigger — create profiles row on auth.users insert
--
-- When a user signs up (Google OAuth, magic link, or via an
-- admin invite that is then accepted), Supabase creates a row
-- in auth.users.  Previously there was no trigger to mirror
-- that into public.profiles, so invited users had no profile
-- row and the app returned a 406 PGRST116 error on sign-in.
--
-- SECURITY DEFINER lets the function run as the db owner and
-- bypass RLS, which is required because auth.uid() is NULL
-- inside a trigger fired by Supabase's internal auth service.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
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
  ON CONFLICT (id) DO NOTHING;   -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

-- Drop and recreate so the migration is safe to re-run.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- SECTION 2  RLS — allow users to INSERT/UPDATE their own profile
--
-- The existing policies only covered SELECT.  Without INSERT,
-- the client-side upsert in supabaseEnsureProfile() would fail
-- for users whose profile row doesn't exist yet.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ────────────────────────────────────────────────────────────
-- SECTION 3  Back-fill — create profiles for any auth users
--            that slipped through before the trigger existed.
--
-- Safe to run even if all users already have a profile row
-- (ON CONFLICT DO NOTHING is a no-op for existing rows).
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
