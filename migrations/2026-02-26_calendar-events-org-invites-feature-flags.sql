-- ============================================================
-- ModernLMS — Schema Migration 2026-02-26 (Part 2)
-- Add: calendar_events table
--      org_invites table
--      get_org_feature_flags() SECURITY DEFINER RPC
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. calendar_events
--    Non-assignment calendar entries (class sessions, lectures,
--    office hours, exams, etc.).  Visible to all org members
--    enrolled in the course.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  event_date   timestamptz NOT NULL,
  event_type   text NOT NULL DEFAULT 'Event',  -- Class, Lecture, Office Hours, Exam, Event
  description  text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-course fetches sorted by date
CREATE INDEX IF NOT EXISTS idx_calendar_events_course_date
  ON public.calendar_events (course_id, event_date);

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Staff (instructors / TAs) and enrolled students can view events for their courses
CREATE POLICY "calendar_events: select enrolled"
  ON public.calendar_events
  FOR SELECT
  USING (
    is_enrolled_in_course(course_id)
    OR is_org_superadmin(
      (SELECT org_id FROM public.courses WHERE id = course_id LIMIT 1)
    )
  );

-- Only course staff / org superadmins can insert
CREATE POLICY "calendar_events: insert staff"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    is_course_instructor(course_id)
    OR is_course_creator(course_id)
    OR is_org_superadmin(
      (SELECT org_id FROM public.courses WHERE id = course_id LIMIT 1)
    )
  );

-- Only the creator or course staff can delete
CREATE POLICY "calendar_events: delete staff"
  ON public.calendar_events
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR is_course_instructor(course_id)
    OR is_course_creator(course_id)
    OR is_org_superadmin(
      (SELECT org_id FROM public.courses WHERE id = course_id LIMIT 1)
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2. org_invites
--    Pending invitations for users who don't yet have accounts.
--    When a new user signs up, a trigger (or app-level code)
--    checks this table and auto-creates the org_member record
--    and any course enrollments from the `invites` table.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member',  -- member, admin, superadmin
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending', -- pending, accepted, expired
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

-- Index for fast email lookup on signup
CREATE INDEX IF NOT EXISTS idx_org_invites_email
  ON public.org_invites (email, status);

-- RLS
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Superadmins of the org can see all invites for that org
CREATE POLICY "org_invites: superadmin select"
  ON public.org_invites
  FOR SELECT
  USING (is_org_superadmin(org_id));

-- Superadmins can insert / upsert invites
CREATE POLICY "org_invites: superadmin insert"
  ON public.org_invites
  FOR INSERT
  WITH CHECK (is_org_superadmin(org_id));

-- Superadmins can update (e.g. mark accepted / expired)
CREATE POLICY "org_invites: superadmin update"
  ON public.org_invites
  FOR UPDATE
  USING (is_org_superadmin(org_id))
  WITH CHECK (is_org_superadmin(org_id));

-- Superadmins can delete invite records
CREATE POLICY "org_invites: superadmin delete"
  ON public.org_invites
  FOR DELETE
  USING (is_org_superadmin(org_id));


-- ────────────────────────────────────────────────────────────
-- 3. get_org_feature_flags(p_org_id uuid) → jsonb
--    SECURITY DEFINER so any org member can call it without
--    needing direct access to admin_audit_log (which is
--    restricted to superadmins by RLS).
--    Returns: { "ai_enabled": true, "discussion_enabled": true, ... }
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_feature_flags(p_org_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_flags jsonb := '{}'::jsonb;
  v_row   record;
BEGIN
  -- Only members of the org may call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Walk rows newest-first; first occurrence of each flag wins
  FOR v_row IN
    SELECT details
    FROM   public.admin_audit_log
    WHERE  org_id = p_org_id
      AND  action = 'feature_flag_change'
    ORDER  BY created_at DESC
    LIMIT  50
  LOOP
    IF (v_row.details ? 'flag')
      AND NOT (v_flags ? (v_row.details->>'flag'))
    THEN
      v_flags := jsonb_set(
        v_flags,
        ARRAY[v_row.details->>'flag'],
        to_jsonb(v_row.details->'value')   -- preserve boolean type from JSONB
      );
    END IF;
  END LOOP;

  RETURN v_flags;
END;
$$;

-- Grant EXECUTE to authenticated users so the RPC works via Supabase client
GRANT EXECUTE ON FUNCTION public.get_org_feature_flags(uuid) TO authenticated;


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
