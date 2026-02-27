-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27
-- Add: Group Management & Group Assignments
--      Inbox / Direct Messaging
--      Persistent Notifications System
--
-- IDEMPOTENT: safe to run multiple times (uses IF NOT EXISTS
-- and DROP POLICY IF EXISTS).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- ENUM ADDITIONS
-- ────────────────────────────────────────────────────────────

-- Extend notification_type for messaging & group events
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'message_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'group_created';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'due_date_reminder';

-- Group assignment grading mode
DO $$ BEGIN
  CREATE TYPE public.group_grading_mode AS ENUM ('per_group', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- 1. COURSE GROUPS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_sets_course
  ON public.group_sets (course_id);

ALTER TABLE public.group_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_sets: enrolled select" ON public.group_sets;
CREATE POLICY "group_sets: enrolled select"
  ON public.group_sets FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS "group_sets: staff manage" ON public.group_sets;
CREATE POLICY "group_sets: staff manage"
  ON public.group_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = group_sets.course_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );


CREATE TABLE IF NOT EXISTS public.course_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_set_id  uuid NOT NULL REFERENCES public.group_sets(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_groups_set
  ON public.course_groups (group_set_id);

CREATE INDEX IF NOT EXISTS idx_course_groups_course
  ON public.course_groups (course_id);

ALTER TABLE public.course_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_groups: enrolled select" ON public.course_groups;
CREATE POLICY "course_groups: enrolled select"
  ON public.course_groups FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS "course_groups: staff manage" ON public.course_groups;
CREATE POLICY "course_groups: staff manage"
  ON public.course_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = course_groups.course_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );


CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.course_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON public.group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON public.group_members (user_id);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members: enrolled select" ON public.group_members;
CREATE POLICY "group_members: enrolled select"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_groups cg
      WHERE cg.id = group_members.group_id
        AND is_enrolled_in_course(cg.course_id)
    )
  );

DROP POLICY IF EXISTS "group_members: staff manage" ON public.group_members;
CREATE POLICY "group_members: staff manage"
  ON public.group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM course_groups cg
      JOIN enrollments e ON e.course_id = cg.course_id
      WHERE cg.id = group_members.group_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2. GROUP ASSIGNMENTS
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_group_assignment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_set_id uuid REFERENCES public.group_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_grading_mode text DEFAULT 'per_group';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.course_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_group
  ON public.submissions (group_id) WHERE group_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 3. GROUP DISCUSSION SPACES
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.discussion_threads
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.course_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_discussion_threads_group
  ON public.discussion_threads (group_id) WHERE group_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 4. INBOX / DIRECT MESSAGING
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject     text,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_course
  ON public.conversations (course_id);


CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at     timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_convo_participants_user
  ON public.conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_convo_participants_convo
  ON public.conversation_participants (conversation_id);


-- Helper function: check conversation membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;


ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convo_participants: own select" ON public.conversation_participants;
DROP POLICY IF EXISTS "convo_participants: participant select" ON public.conversation_participants;
CREATE POLICY "convo_participants: participant select"
  ON public.conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "convo_participants: enrolled insert" ON public.conversation_participants;
CREATE POLICY "convo_participants: enrolled insert"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND is_enrolled_in_course(c.course_id)
    )
  );

DROP POLICY IF EXISTS "convo_participants: own update" ON public.conversation_participants;
CREATE POLICY "convo_participants: own update"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());


ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations: participant select" ON public.conversations;
CREATE POLICY "conversations: participant select"
  ON public.conversations FOR SELECT
  USING (
    created_by = auth.uid()
    OR is_conversation_participant(id)
  );

DROP POLICY IF EXISTS "conversations: enrolled insert" ON public.conversations;
CREATE POLICY "conversations: enrolled insert"
  ON public.conversations FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_enrolled_in_course(course_id)
  );

DROP POLICY IF EXISTS "conversations: update" ON public.conversations;
CREATE POLICY "conversations: update"
  ON public.conversations FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = conversations.course_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );


CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (conversation_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages: participant select" ON public.messages;
CREATE POLICY "messages: participant select"
  ON public.messages FOR SELECT
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages: participant insert" ON public.messages;
CREATE POLICY "messages: participant insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
  );


-- ────────────────────────────────────────────────────────────
-- 5. PERSISTENT NOTIFICATIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id    uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        text NOT NULL,
  body         text,
  link         text,
  ref_id       uuid,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: own select" ON public.notifications;
CREATE POLICY "notifications: own select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Allow: insert for yourself, OR insert for any enrolled user in a course
-- you're also enrolled in (enables student→student message notifications)
DROP POLICY IF EXISTS "notifications: insert" ON public.notifications;
CREATE POLICY "notifications: insert"
  ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      course_id IS NOT NULL
      AND is_enrolled_in_course(course_id)
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.course_id = notifications.course_id
          AND e.user_id = notifications.user_id
      )
    )
  );

DROP POLICY IF EXISTS "notifications: own update" ON public.notifications;
CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: own delete" ON public.notifications;
CREATE POLICY "notifications: own delete"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grade_released        boolean NOT NULL DEFAULT true,
  assignment_due        boolean NOT NULL DEFAULT true,
  announcement          boolean NOT NULL DEFAULT true,
  submission_received   boolean NOT NULL DEFAULT true,
  quiz_available        boolean NOT NULL DEFAULT true,
  message_received      boolean NOT NULL DEFAULT true,
  group_created         boolean NOT NULL DEFAULT true,
  due_date_reminder     boolean NOT NULL DEFAULT true,
  reminder_hours_before integer NOT NULL DEFAULT 24,
  UNIQUE (user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences: own select" ON public.notification_preferences;
CREATE POLICY "notification_preferences: own select"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences: own insert" ON public.notification_preferences;
CREATE POLICY "notification_preferences: own insert"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences: own update" ON public.notification_preferences;
CREATE POLICY "notification_preferences: own update"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTION: Batch-create notifications
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_course_students(
  p_course_id uuid,
  p_type      notification_type,
  p_title     text,
  p_body      text DEFAULT NULL,
  p_link      text DEFAULT NULL,
  p_ref_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, course_id, type, title, body, link, ref_id)
  SELECT e.user_id, p_course_id, p_type, p_title, p_body, p_link, p_ref_id
  FROM   public.enrollments e
  WHERE  e.course_id = p_course_id
    AND  e.user_id != auth.uid()
    AND  NOT EXISTS (
      SELECT 1 FROM public.notification_preferences np
      WHERE np.user_id = e.user_id
        AND (
          (p_type = 'grade_released'      AND np.grade_released = false) OR
          (p_type = 'assignment_due'       AND np.assignment_due = false) OR
          (p_type = 'announcement'         AND np.announcement = false) OR
          (p_type = 'submission_received'  AND np.submission_received = false) OR
          (p_type = 'quiz_available'       AND np.quiz_available = false) OR
          (p_type = 'message_received'     AND np.message_received = false) OR
          (p_type = 'group_created'        AND np.group_created = false) OR
          (p_type = 'due_date_reminder'    AND np.due_date_reminder = false)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_course_students(uuid, notification_type, text, text, text, uuid) TO authenticated;


-- ============================================================
-- End of migration.
-- ============================================================
