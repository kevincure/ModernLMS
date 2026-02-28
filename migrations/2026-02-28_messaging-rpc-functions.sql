-- ============================================================
-- ModernLMS — Schema Migration 2026-02-28
-- Add SECURITY DEFINER RPC functions for messaging:
--
--   1. send_direct_message()  — atomically creates/reuses a
--      conversation, adds participants, and inserts the message.
--      Bypasses all the RLS circular dependencies between
--      conversations ↔ conversation_participants ↔ messages.
--
--   2. get_course_recipients() — returns all enrolled users in
--      a course (except the caller).  Bypasses enrollment and
--      profile SELECT RLS so students can see instructors and
--      vice-versa when composing a new message.
--
-- IDEMPOTENT: uses CREATE OR REPLACE.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. send_direct_message()
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_course_id    uuid,
  p_recipient_id uuid,
  p_subject      text DEFAULT NULL,
  p_content      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_conv_id   uuid;
  v_msg_id    uuid;
  v_is_new    boolean := false;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate sender enrollment
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND user_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'Sender not enrolled in course';
  END IF;

  -- Validate recipient enrollment
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND user_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'Recipient not enrolled in course';
  END IF;

  -- Look for an existing 2-person conversation between these users
  SELECT cp1.conversation_id INTO v_conv_id
  FROM   public.conversation_participants cp1
  JOIN   public.conversation_participants cp2
    ON   cp1.conversation_id = cp2.conversation_id
  JOIN   public.conversations c
    ON   c.id = cp1.conversation_id
  WHERE  cp1.user_id = v_sender_id
    AND  cp2.user_id = p_recipient_id
    AND  c.course_id = p_course_id
    AND  (SELECT count(*)
          FROM public.conversation_participants
          WHERE conversation_id = cp1.conversation_id) = 2
  LIMIT 1;

  -- Create new conversation + participants if none found
  IF v_conv_id IS NULL THEN
    v_is_new := true;
    v_conv_id := gen_random_uuid();

    INSERT INTO public.conversations (id, course_id, subject, created_by)
    VALUES (v_conv_id, p_course_id, p_subject, v_sender_id);

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_sender_id),
           (v_conv_id, p_recipient_id);
  END IF;

  -- Insert the message
  v_msg_id := gen_random_uuid();
  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (v_msg_id, v_conv_id, v_sender_id, p_content);

  -- Touch conversation timestamp
  UPDATE public.conversations
  SET    updated_at = now()
  WHERE  id = v_conv_id;

  RETURN jsonb_build_object(
    'conversation_id', v_conv_id,
    'message_id',      v_msg_id,
    'is_new',          v_is_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, uuid, text, text)
  TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. get_course_recipients()
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_course_recipients(p_course_id uuid)
RETURNS TABLE (
  user_id uuid,
  name    text,
  email   text,
  role    text,
  avatar  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is enrolled
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not enrolled in course';
  END IF;

  RETURN QUERY
  SELECT e.user_id,
         p.name,
         p.email,
         e.role,
         p.avatar
  FROM   public.enrollments e
  JOIN   public.profiles p ON p.id = e.user_id
  WHERE  e.course_id = p_course_id
    AND  e.user_id  != auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_recipients(uuid)
  TO authenticated;


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
