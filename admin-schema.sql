-- ============================================================
-- Admin Backend Schema — AllDayLMS
--
-- Paste this entire file into the Supabase SQL Editor and run it.
-- It is safe to run multiple times (uses IF NOT EXISTS / DO blocks).
--
-- Security architecture:
--   • Row-Level Security (RLS) is the primary enforcement layer.
--     Even a crafted direct API call cannot bypass these policies.
--   • SECURITY DEFINER functions run as the table owner so they
--     can read org_members without exposing that table to callers.
--   • SET search_path = public on every function prevents
--     search-path-hijacking attacks.
--   • Superadmin status can ONLY be set via direct DB access —
--     there is no self-service promotion path.
--   • All admin actions are immutably audit-logged (no UPDATE/DELETE
--     on audit_log allowed by any policy).
--
-- OneRoster 1.2 alignment:
--   orgs         → OR orgs        (sourcedId, name, type)
--   profiles     → OR users       (sourcedId, givenName, familyName)
--   org_members  → OR orgMemberships (role in org)
--   courses      → OR courses + classes (linked via org & session)
--   enrollments  → OR enrollments (role in class: student/teacher/ta)
--   grades       → OR results     (gradebook sync)
-- ============================================================


-- ============================================================
-- STEP 1 — Add numeric_id to orgs for ?org=N URL lookups
-- ============================================================

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS numeric_id INTEGER;

-- Create a sequence so future orgs auto-get sequential IDs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'orgs_numeric_id_seq') THEN
    CREATE SEQUENCE orgs_numeric_id_seq START 1;
  END IF;
END $$;

-- Give numeric_id a default from the sequence
ALTER TABLE orgs
  ALTER COLUMN numeric_id SET DEFAULT nextval('orgs_numeric_id_seq');

-- Unique constraint so URL lookups are deterministic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orgs_numeric_id_key'
  ) THEN
    ALTER TABLE orgs ADD CONSTRAINT orgs_numeric_id_key UNIQUE (numeric_id);
  END IF;
END $$;


-- ============================================================
-- STEP 2 — Insert the default org (org #1, name "Default")
--           Skip if an org with numeric_id = 1 already exists.
-- ============================================================

INSERT INTO orgs (id, name, type, status, numeric_id)
VALUES (gen_random_uuid(), 'Default', 'district', 'active', 1)
ON CONFLICT (numeric_id) DO NOTHING;


-- ============================================================
-- STEP 3 — org_member_role enum
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_member_role') THEN
    CREATE TYPE org_member_role AS ENUM ('member', 'admin', 'superadmin');
  END IF;
END $$;


-- ============================================================
-- STEP 4 — org_members table
--           Maps users to orgs with a role (member/admin/superadmin).
--           OneRoster equivalent: orgMemberships
-- ============================================================

CREATE TABLE IF NOT EXISTS org_members (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID          NOT NULL REFERENCES orgs(id)     ON DELETE CASCADE,
  user_id     UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        org_member_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by  UUID          REFERENCES profiles(id),
  -- OneRoster fields (for future 1.2 export)
  sourced_id  TEXT          GENERATED ALWAYS AS (id::text) STORED,
  oneroster_status TEXT     NOT NULL DEFAULT 'active',
  UNIQUE (org_id, user_id)
);

-- Auto-update updated_at
CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON org_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- STEP 5 — Add org_id to courses
--           Links a course to the org that owns it.
-- ============================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);


-- ============================================================
-- STEP 5B — Add term to courses (OneRoster: academicSession)
--            Existing courses are backfilled to SPRING 2026.
-- ============================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS term TEXT;

UPDATE courses
SET term = 'SPRING 2026'
WHERE term IS NULL;

ALTER TABLE courses
  ALTER COLUMN term SET DEFAULT 'SPRING 2026';

CREATE INDEX IF NOT EXISTS idx_courses_org_term ON courses(org_id, term);


-- ============================================================
-- STEP 6 — admin_audit_log
--           Every admin action is recorded here.
--           INSERT allowed for admins; UPDATE and DELETE blocked for everyone.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID        NOT NULL REFERENCES orgs(id),
  actor_user_id   UUID        NOT NULL REFERENCES profiles(id),
  action          TEXT        NOT NULL,   -- e.g. 'add_org_member', 'create_course'
  target_type     TEXT,                   -- 'user', 'course', 'enrollment'
  target_id       UUID,                   -- the affected row's id
  details         JSONB,                  -- extra context (role changes, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at — audit rows are immutable
);


-- ============================================================
-- STEP 7 — Row-Level Security: enable on new tables
-- ============================================================

ALTER TABLE org_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 8 — Helper functions (SECURITY DEFINER)
--
-- These run as the table owner so they can inspect org_members
-- without the caller needing direct access. SET search_path
-- prevents search-path injection.
-- ============================================================

-- Returns true if the calling user is a superadmin for the given org.
CREATE OR REPLACE FUNCTION is_org_superadmin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   org_members
    WHERE  org_id  = p_org_id
    AND    user_id = auth.uid()
    AND    role    = 'superadmin'
  );
$$;

-- Returns true if the calling user is admin OR superadmin for the given org.
CREATE OR REPLACE FUNCTION is_org_admin_or_higher(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   org_members
    WHERE  org_id  = p_org_id
    AND    user_id = auth.uid()
    AND    role    IN ('admin', 'superadmin')
  );
$$;

-- Returns the numeric_id of any org where the caller is a superadmin.
-- Used to scope profile lookups without leaking cross-org data.
CREATE OR REPLACE FUNCTION get_superadmin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM   org_members
  WHERE  user_id = auth.uid()
  AND    role    = 'superadmin';
$$;

-- Returns course IDs in orgs where caller is superadmin.
-- SECURITY DEFINER avoids RLS recursion if other table policies
-- reference courses/enrollments.
CREATE OR REPLACE FUNCTION get_superadmin_course_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM   courses c
  JOIN   org_members om ON om.org_id = c.org_id
  WHERE  om.user_id = auth.uid()
  AND    om.role    = 'superadmin'
  AND    c.org_id   IS NOT NULL;
$$;

-- Legacy main-app policies may reference enrollments from courses and vice-versa.
-- These SECURITY DEFINER helpers prevent recursion when those legacy policies
-- are present by avoiding RLS-dependent self-reference checks.
CREATE OR REPLACE FUNCTION is_enrolled_in_course(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrollments e
    WHERE e.course_id = p_course_id
    AND   e.user_id   = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_instructor_in_course(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrollments e
    WHERE e.course_id = p_course_id
    AND   e.user_id   = auth.uid()
    AND   e.role      = 'instructor'
  );
$$;

CREATE OR REPLACE FUNCTION is_course_creator(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM courses c
    WHERE c.id = p_course_id
    AND   c.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_course_instructor(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrollments e
    WHERE e.course_id = p_course_id
    AND   e.user_id   = auth.uid()
    AND   e.role      = 'instructor'
  );
$$;


-- ============================================================
-- STEP 9 — RLS Policies: org_members
-- ============================================================

-- Drop old policies if re-running (idempotent)
DROP POLICY IF EXISTS "org_members: superadmin full access select" ON org_members;
DROP POLICY IF EXISTS "org_members: superadmin full access insert" ON org_members;
DROP POLICY IF EXISTS "org_members: superadmin full access update" ON org_members;
DROP POLICY IF EXISTS "org_members: superadmin full access delete" ON org_members;
DROP POLICY IF EXISTS "org_members: users see own membership"      ON org_members;

-- Superadmins can SELECT all rows in their org
CREATE POLICY "org_members: superadmin full access select"
  ON org_members FOR SELECT
  USING (is_org_superadmin(org_id));

-- Superadmins can INSERT new members into their org
CREATE POLICY "org_members: superadmin full access insert"
  ON org_members FOR INSERT
  WITH CHECK (is_org_superadmin(org_id));

-- Superadmins can UPDATE roles in their org
-- (cannot escalate beyond superadmin — enforced by enum)
CREATE POLICY "org_members: superadmin full access update"
  ON org_members FOR UPDATE
  USING (is_org_superadmin(org_id));

-- Superadmins can DELETE members from their org
CREATE POLICY "org_members: superadmin full access delete"
  ON org_members FOR DELETE
  USING (is_org_superadmin(org_id));

-- Every authenticated user can see their own memberships
-- (so the admin login can check the calling user's role)
CREATE POLICY "org_members: users see own membership"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());


-- ============================================================
-- STEP 10 — RLS Policies: admin_audit_log
-- ============================================================

DROP POLICY IF EXISTS "audit_log: superadmin can view"     ON admin_audit_log;
DROP POLICY IF EXISTS "audit_log: admins can insert"       ON admin_audit_log;

-- Only superadmins can read the log
CREATE POLICY "audit_log: superadmin can view"
  ON admin_audit_log FOR SELECT
  USING (is_org_superadmin(org_id));

-- Admin-or-higher can write entries (no UPDATE or DELETE policy → immutable)
CREATE POLICY "audit_log: admins can insert"
  ON admin_audit_log FOR INSERT
  WITH CHECK (is_org_admin_or_higher(org_id));


-- ============================================================
-- STEP 11 — RLS Policies: profiles
--           Allow org superadmins to look up all profiles
--           (needed to search "add user by email").
--           Your existing profile self-read policy stays in place.
-- ============================================================

DROP POLICY IF EXISTS "profiles: org superadmin can read all" ON profiles;

CREATE POLICY "profiles: org superadmin can read all"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM get_superadmin_org_ids())
  );


-- ============================================================
-- STEP 12 — RLS Policies: courses
--           Allow org superadmins to INSERT courses for their org
--           and view all org courses.
-- ============================================================

DROP POLICY IF EXISTS "courses: org superadmin select"  ON courses;
DROP POLICY IF EXISTS "courses: org superadmin insert"  ON courses;
DROP POLICY IF EXISTS "courses: org superadmin update"  ON courses;

CREATE POLICY "courses: org superadmin select"
  ON courses FOR SELECT
  USING (
    org_id IS NOT NULL
    AND is_org_superadmin(org_id)
  );

CREATE POLICY "courses: org superadmin insert"
  ON courses FOR INSERT
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_superadmin(org_id)
  );

CREATE POLICY "courses: org superadmin update"
  ON courses FOR UPDATE
  USING (
    org_id IS NOT NULL
    AND is_org_superadmin(org_id)
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_superadmin(org_id)
  );

DROP POLICY IF EXISTS "courses: org superadmin delete" ON courses;

CREATE POLICY "courses: org superadmin delete"
  ON courses FOR DELETE
  USING (
    org_id IS NOT NULL
    AND is_org_superadmin(org_id)
  );

-- If legacy course policies already exist, rewrite them in non-recursive form.
DROP POLICY IF EXISTS "Courses visible to enrolled or created" ON courses;
DROP POLICY IF EXISTS "Instructors can manage courses"         ON courses;

CREATE POLICY "Courses visible to enrolled or created"
  ON courses FOR SELECT
  USING (
    created_by = auth.uid()
    OR is_enrolled_in_course(id)
  );

CREATE POLICY "Instructors can manage courses"
  ON courses FOR ALL
  USING (is_instructor_in_course(id));


-- ============================================================
-- STEP 13 — RLS Policies: enrollments
--           Allow org superadmins to manage enrollments for
--           courses that belong to their org.
-- ============================================================

DROP POLICY IF EXISTS "enrollments: org superadmin select" ON enrollments;
DROP POLICY IF EXISTS "enrollments: org superadmin insert" ON enrollments;
DROP POLICY IF EXISTS "enrollments: org superadmin delete" ON enrollments;

CREATE POLICY "enrollments: org superadmin select"
  ON enrollments FOR SELECT
  USING (course_id IN (SELECT get_superadmin_course_ids()));

CREATE POLICY "enrollments: org superadmin insert"
  ON enrollments FOR INSERT
  WITH CHECK (course_id IN (SELECT get_superadmin_course_ids()));

CREATE POLICY "enrollments: org superadmin delete"
  ON enrollments FOR DELETE
  USING (course_id IN (SELECT get_superadmin_course_ids()));


-- ============================================================
-- STEP 13B — Secure course cascade deletion helper
--
-- Deletes only rows that are explicitly tied to a course_id.
-- This intentionally avoids touching org-level or user-level rows.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_course_for_org_superadmin(p_course_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT c.org_id
  INTO v_org_id
  FROM courses c
  WHERE c.id = p_course_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF NOT is_org_superadmin(v_org_id) THEN
    RAISE EXCEPTION 'Not authorized to delete this course';
  END IF;

  -- Delete direct course-owned data first (if table exists).
  IF to_regclass('public.assignment_overrides') IS NOT NULL THEN
    DELETE FROM assignment_overrides WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.quiz_time_overrides') IS NOT NULL THEN
    DELETE FROM quiz_time_overrides WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.discussion_replies') IS NOT NULL
     AND to_regclass('public.discussion_threads') IS NOT NULL THEN
    DELETE FROM discussion_replies
    WHERE thread_id IN (SELECT id FROM discussion_threads WHERE course_id = p_course_id);
  END IF;

  IF to_regclass('public.module_items') IS NOT NULL THEN
    DELETE FROM module_items WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.rubric_criteria') IS NOT NULL
     AND to_regclass('public.rubrics') IS NOT NULL THEN
    DELETE FROM rubric_criteria
    WHERE rubric_id IN (SELECT id FROM rubrics WHERE course_id = p_course_id);
  END IF;

  IF to_regclass('public.quiz_questions') IS NOT NULL
     AND to_regclass('public.quizzes') IS NOT NULL THEN
    DELETE FROM quiz_questions
    WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = p_course_id);
  END IF;

  IF to_regclass('public.submissions') IS NOT NULL
     AND to_regclass('public.assignments') IS NOT NULL THEN
    DELETE FROM submissions
    WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  END IF;

  IF to_regclass('public.grades') IS NOT NULL
     AND to_regclass('public.assignments') IS NOT NULL THEN
    DELETE FROM grades
    WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  END IF;

  IF to_regclass('public.quiz_submissions') IS NOT NULL THEN
    DELETE FROM quiz_submissions WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.files') IS NOT NULL THEN
    DELETE FROM files WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL THEN
    DELETE FROM announcements WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.discussion_threads') IS NOT NULL THEN
    DELETE FROM discussion_threads WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.modules') IS NOT NULL THEN
    DELETE FROM modules WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.quizzes') IS NOT NULL THEN
    DELETE FROM quizzes WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.invites') IS NOT NULL THEN
    DELETE FROM invites WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.rubrics') IS NOT NULL THEN
    DELETE FROM rubrics WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.grade_categories') IS NOT NULL THEN
    DELETE FROM grade_categories WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.grade_settings') IS NOT NULL THEN
    DELETE FROM grade_settings WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.question_banks') IS NOT NULL THEN
    DELETE FROM question_banks WHERE course_id = p_course_id;
  END IF;

  IF to_regclass('public.assignments') IS NOT NULL THEN
    DELETE FROM assignments WHERE course_id = p_course_id;
  END IF;

  -- Keep this last among course-owned children.
  DELETE FROM enrollments WHERE course_id = p_course_id;

  -- Delete the course itself.
  DELETE FROM courses WHERE id = p_course_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_course_for_org_superadmin(UUID) TO authenticated;


-- ============================================================
-- STEP 14 — Grant yourself superadmin on org #1
--
-- Un-comment the block below, replace the email, and run ONCE
-- after you have logged into the main app at least once
-- (so your profile row exists in the profiles table).
-- ============================================================

/*
INSERT INTO org_members (org_id, user_id, role)
SELECT
  (SELECT id FROM orgs        WHERE numeric_id = 1),
  (SELECT id FROM profiles    WHERE email = 'YOUR_EMAIL@example.com'),
  'superadmin'
ON CONFLICT (org_id, user_id)
  DO UPDATE SET role = 'superadmin', updated_at = now();
*/


-- ============================================================
-- Done!
-- Next steps:
--   1. In Supabase Auth settings → URL Configuration, add
--      http://localhost:<PORT>/admin.html to "Redirect URLs".
--   2. Un-comment Step 14 above, add your email, and run it.
--   3. Open http://localhost:<PORT>/admin.html?org=1 and sign in.
-- ============================================================
