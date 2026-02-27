-- ============================================================
-- ModernLMS — Schema Migration 2026-02-27
-- Add: Group Management & Group Assignments
--      Inbox / Direct Messaging
--      Persistent Notifications System
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
--    Reusable groups within a course. Instructors create
--    group sets, then assign students to groups within them.
-- ────────────────────────────────────────────────────────────

-- Group sets: a named collection of groups (e.g. "Project Teams", "Lab Partners")
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

CREATE POLICY "group_sets: enrolled select"
  ON public.group_sets FOR SELECT
  USING (is_enrolled_in_course(course_id));

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


-- Individual groups within a group set
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

CREATE POLICY "course_groups: enrolled select"
  ON public.course_groups FOR SELECT
  USING (is_enrolled_in_course(course_id));

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


-- Group membership (which students are in which group)
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

-- Students can see members of groups in courses they're enrolled in
CREATE POLICY "group_members: enrolled select"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_groups cg
      WHERE cg.id = group_members.group_id
        AND is_enrolled_in_course(cg.course_id)
    )
  );

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
--    Link assignments to group sets. When a group submits,
--    all members get credit. Grading can be per-group or
--    individual.
-- ────────────────────────────────────────────────────────────

-- Add group columns to assignments table
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_group_assignment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_set_id uuid REFERENCES public.group_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_grading_mode text DEFAULT 'per_group';

-- Add group_id to submissions so we know which group submitted
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.course_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_group
  ON public.submissions (group_id) WHERE group_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 3. GROUP DISCUSSION SPACES
--    Each group can have its own discussion threads, visible
--    only to group members and staff.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.discussion_threads
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.course_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_discussion_threads_group
  ON public.discussion_threads (group_id) WHERE group_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 4. INBOX / DIRECT MESSAGING
--    Threaded conversations between users within a course.
--    NOTE: conversations table is created first, then
--    conversation_participants, then conversations RLS
--    policies (which reference conversation_participants).
-- ────────────────────────────────────────────────────────────

-- Conversation (thread header)
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


-- Conversation participants (must exist before conversations RLS policies)
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
-- (SECURITY DEFINER bypasses RLS, preventing infinite recursion)
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

-- Participants can see all members in conversations they belong to
CREATE POLICY "convo_participants: participant select"
  ON public.conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id));

CREATE POLICY "convo_participants: enrolled insert"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND is_enrolled_in_course(c.course_id)
    )
  );

CREATE POLICY "convo_participants: own update"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());


-- Now add RLS policies to conversations (conversation_participants exists)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Only participants can see their conversations
CREATE POLICY "conversations: participant select"
  ON public.conversations FOR SELECT
  USING (is_conversation_participant(id));

-- Any enrolled user can create a conversation
CREATE POLICY "conversations: enrolled insert"
  ON public.conversations FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_enrolled_in_course(course_id)
  );

-- Creator or staff can update (e.g. subject)
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


-- Messages within a conversation
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

-- Only conversation participants can see messages
CREATE POLICY "messages: participant select"
  ON public.messages FOR SELECT
  USING (is_conversation_participant(conversation_id));

-- Only participants can insert messages
CREATE POLICY "messages: participant insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
  );


-- ────────────────────────────────────────────────────────────
-- 5. PERSISTENT NOTIFICATIONS
--    In-app notification feed with read status and preferences.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id    uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        text NOT NULL,
  body         text,
  link         text,          -- e.g. page to navigate to
  ref_id       uuid,          -- generic reference (assignment_id, thread_id, etc.)
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications: own select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- System (or staff via RPC) can insert notifications for users
-- For client-side creation, allow if the creator is staff in the course
CREATE POLICY "notifications: insert"
  ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      course_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.course_id = notifications.course_id
          AND e.user_id = auth.uid()
          AND e.role IN ('instructor', 'ta')
      )
    )
  );

-- Users can update their own notifications (mark read)
CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications: own delete"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());


-- Per-user notification preferences
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

CREATE POLICY "notification_preferences: own select"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notification_preferences: own insert"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences: own update"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTION: Batch-create notifications for
--    all enrolled students in a course.
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
    AND  e.user_id != auth.uid()  -- don't notify yourself
    -- Respect per-user preferences
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
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
