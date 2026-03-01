-- ============================================================
-- ModernLMS — Schema Migration 2026-03-01
-- Update send_direct_message() and send_reply_message() to
-- include the conversation_id in the notification link so the
-- client can navigate directly to the conversation.
-- Link format: 'inbox:<conversation_id>'
-- ============================================================

-- 1. send_direct_message() — link now includes conversation id
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

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND user_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'Sender not enrolled in course';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND user_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'Recipient not enrolled in course';
  END IF;

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

  IF v_conv_id IS NULL THEN
    v_is_new := true;
    v_conv_id := gen_random_uuid();

    INSERT INTO public.conversations (id, course_id, subject, created_by)
    VALUES (v_conv_id, p_course_id, p_subject, v_sender_id);

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_sender_id),
           (v_conv_id, p_recipient_id);
  END IF;

  v_msg_id := gen_random_uuid();
  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (v_msg_id, v_conv_id, v_sender_id, p_content);

  UPDATE public.conversations
  SET    updated_at = now()
  WHERE  id = v_conv_id;

  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications (user_id, course_id, type, title, body, link)
    VALUES (
      p_recipient_id,
      p_course_id,
      'message_received',
      COALESCE(v_sender_name, 'Someone') || ' sent you a message',
      left(COALESCE(p_content, ''), 100),
      'inbox:' || v_conv_id::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'conversation_id', v_conv_id,
    'message_id',      v_msg_id,
    'is_new',          v_is_new
  );
END;
$$;


-- 2. send_reply_message() — link now includes conversation id
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

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT course_id INTO v_course_id
  FROM public.conversations
  WHERE id = p_conversation_id;

  v_msg_id := gen_random_uuid();
  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (v_msg_id, p_conversation_id, v_sender_id, p_content);

  UPDATE public.conversations
  SET    updated_at = now()
  WHERE  id = p_conversation_id;

  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_sender_id LIMIT 1;
  BEGIN
    INSERT INTO public.notifications (user_id, course_id, type, title, body, link)
    SELECT cp.user_id,
           v_course_id,
           'message_received',
           COALESCE(v_sender_name, 'Someone') || ' replied to your message',
           left(COALESCE(p_content, ''), 100),
           'inbox:' || p_conversation_id::text
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id != v_sender_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('message_id', v_msg_id);
END;
$$;

-- ============================================================
-- End of migration.
-- ============================================================
