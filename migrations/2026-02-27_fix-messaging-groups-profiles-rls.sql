-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27
-- Fix RLS policies for:
--   1. profiles: course peers read — student ↔ instructor
--      visibility broken because inline JOIN on enrollments
--      was subject to enrollment RLS (blocked cross-user reads)
--   2. conversation_participants INSERT — failed because inline
--      SELECT from conversations was subject to its own RLS,
--      creating a circular dependency during insert
--   3. group_sets / course_groups / group_members staff manage
--      — inline enrollment JOINs replaced with SECURITY DEFINER
--      helpers to avoid potential RLS recursion on delete
--
-- IDEMPOTENT: safe to re-run (uses CREATE OR REPLACE and
-- DROP POLICY IF EXISTS).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. HELPER: shares_course_with(p_other_user_id)
--
-- Returns true if auth.uid() and p_other_user_id are both
-- enrolled in at least one common course.  SECURITY DEFINER
-- bypasses the enrollment SELECT policy so the JOIN works
-- for all roles (students, instructors, TAs alike).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shares_course_with(p_other_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.enrollments e1
    JOIN   public.enrollments e2 ON e1.course_id = e2.course_id
    WHERE  e1.user_id = auth.uid()
      AND  e2.user_id = p_other_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.shares_course_with(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. FIX: profiles: course peers read
--
-- Old policy used an inline JOIN on enrollments. If the
-- enrollments SELECT policy restricts cross-user reads, the
-- JOIN for e2 (the peer's enrollment) returns no rows and
-- the policy never grants access.
-- New policy delegates to the SECURITY DEFINER helper above.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles: course peers read" ON public.profiles;
CREATE POLICY "profiles: course peers read"
  ON public.profiles FOR SELECT
  USING (shares_course_with(id));


-- ────────────────────────────────────────────────────────────
-- 3. HELPER: get_conversation_course_id(p_conv_id)
--
-- Returns the course_id for a conversation, bypassing the
-- conversations SELECT RLS.  Used in the
-- conversation_participants INSERT policy so it does not
-- need to query conversations through RLS (which creates a
-- circular dependency: participants insert → conversations
-- select → is_conversation_participant → participants select).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_conversation_course_id(p_conv_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT course_id FROM public.conversations WHERE id = p_conv_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_course_id(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. FIX: conversation_participants INSERT policy
--
-- Old policy: EXISTS (SELECT 1 FROM conversations WHERE …)
-- This queries conversations through its own RLS, which calls
-- is_conversation_participant, which reads conversation_
-- participants — circular at insert time.
-- New policy: calls two SECURITY DEFINER helpers directly.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "convo_participants: enrolled insert" ON public.conversation_participants;
CREATE POLICY "convo_participants: enrolled insert"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    is_enrolled_in_course(get_conversation_course_id(conversation_id))
  );


-- ────────────────────────────────────────────────────────────
-- 5. FIX: group_sets staff manage policy
--
-- Replace inline enrollment subquery with the existing
-- SECURITY DEFINER helper is_instructor_in_course().
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "group_sets: staff manage" ON public.group_sets;
CREATE POLICY "group_sets: staff manage"
  ON public.group_sets FOR ALL
  USING (is_instructor_in_course(course_id));


-- ────────────────────────────────────────────────────────────
-- 6. FIX: course_groups staff manage policy
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "course_groups: staff manage" ON public.course_groups;
CREATE POLICY "course_groups: staff manage"
  ON public.course_groups FOR ALL
  USING (is_instructor_in_course(course_id));


-- ────────────────────────────────────────────────────────────
-- 7. HELPER: is_instructor_for_group(p_group_id)
--
-- Returns true if auth.uid() is an instructor/TA for the
-- course that owns the given group.  SECURITY DEFINER so it
-- bypasses course_groups SELECT RLS when called from a
-- group_members policy.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_instructor_for_group(p_group_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.course_groups cg
    WHERE  cg.id = p_group_id
      AND  public.is_instructor_in_course(cg.course_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_instructor_for_group(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 8. FIX: group_members staff manage policy
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "group_members: staff manage" ON public.group_members;
CREATE POLICY "group_members: staff manage"
  ON public.group_members FOR ALL
  USING (is_instructor_for_group(group_id));


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
