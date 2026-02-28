-- ============================================================
-- ModernLMS — Schema Migration 2026-02-28d
-- 1. Add message_received to notification_type enum
-- 2. Update send_direct_message() to create a notification for
--    the recipient inside the SECURITY DEFINER body (bypasses
--    the notifications INSERT RLS that blocks client-side writes
--    for other users).
-- 3. Add send_reply_message() — atomically inserts a message and
--    notifies all other participants in the conversation.
-- Both functions are idempotent (CREATE OR REPLACE).
-- ============================================================

-- Step 1: Add the new enum label (safe no-op if it already exists)
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'message_received';


-- ────────────────────────────────────────────────────────────
-- 2. send_direct_message() — updated to notify recipient
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
  v_sender_id   uuid;
  v_conv_id     uuid;
  v_msg_id      uuid;
  v_is_new      boolean := false;
  v_sender_name text;
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

  -- Look for an existing 2-person conversation between these users in this course
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

  -- Create conversation + participants if none found
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

  -- Notify recipient (SECURITY DEFINER bypasses notifications RLS)
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications (user_id, course_id, type, title, body, link)
    VALUES (
      p_recipient_id,
      p_course_id,
      'message_received',
      COALESCE(v_sender_name, 'Someone') || ' sent you a message',
      left(COALESCE(p_content, ''), 100),
      'inbox'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Notification failure is non-fatal; message was already sent
    NULL;
  END;

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
-- 3. send_reply_message() — new RPC for replies with notification
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_reply_message(
  p_conversation_id uuid,
  p_content         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid;
  v_msg_id      uuid;
  v_course_id   uuid;
  v_sender_name text;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate caller is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  -- Get course_id for the notification
  SELECT course_id INTO v_course_id
  FROM public.conversations
  WHERE id = p_conversation_id;

  -- Insert the message
  v_msg_id := gen_random_uuid();
  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (v_msg_id, p_conversation_id, v_sender_id, p_content);

  -- Touch conversation timestamp
  UPDATE public.conversations
  SET    updated_at = now()
  WHERE  id = p_conversation_id;

  -- Notify all other participants
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications (user_id, course_id, type, title, body, link)
    SELECT cp.user_id,
           v_course_id,
           'message_received',
           COALESCE(v_sender_name, 'Someone') || ' replied to your message',
           left(COALESCE(p_content, ''), 100),
           'inbox'
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id != v_sender_id;
  EXCEPTION WHEN OTHERS THEN
    -- Notification failure is non-fatal; reply was already saved
    NULL;
  END;

  RETURN jsonb_build_object('message_id', v_msg_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_reply_message(uuid, text)
  TO authenticated;


-- ============================================================
-- End of migration.
-- Apply in Supabase SQL editor or psql as superuser.
-- ============================================================
