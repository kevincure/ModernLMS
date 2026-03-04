-- Fix: The original delete_course_for_org_superadmin referenced a non-existent
-- column "bank_id" instead of "question_bank_id", causing a runtime error.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

CREATE OR REPLACE FUNCTION public.delete_course_for_org_superadmin(p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is superadmin for the course's org
  IF NOT EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = p_course_id
      AND c.org_id IS NOT NULL
      AND is_org_superadmin(c.org_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a superadmin for this course''s organization';
  END IF;

  -- Null out FK references on assignments that block cascading deletes
  UPDATE assignments
    SET question_bank_id = NULL, group_set_id = NULL
    WHERE course_id = p_course_id;

  -- Delete grandchild records (tables referencing course-child tables)
  DELETE FROM assignment_overrides  WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  DELETE FROM rubrics              WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  DELETE FROM submissions          WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  DELETE FROM quiz_submissions     WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = p_course_id);
  DELETE FROM quiz_questions       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = p_course_id);
  DELETE FROM quiz_submissions     WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = p_course_id);
  DELETE FROM quiz_time_overrides  WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = p_course_id);
  DELETE FROM discussion_replies   WHERE thread_id IN (SELECT id FROM discussion_threads WHERE course_id = p_course_id);
  DELETE FROM module_items         WHERE module_id IN (SELECT id FROM modules WHERE course_id = p_course_id);
  DELETE FROM messages             WHERE conversation_id IN (SELECT id FROM conversations WHERE course_id = p_course_id);
  DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE course_id = p_course_id);
  DELETE FROM group_members        WHERE group_id IN (SELECT id FROM course_groups WHERE course_id = p_course_id);

  -- Delete direct course children
  DELETE FROM assignments       WHERE course_id = p_course_id;
  DELETE FROM quizzes            WHERE course_id = p_course_id;
  DELETE FROM discussion_threads WHERE course_id = p_course_id;
  DELETE FROM announcements      WHERE course_id = p_course_id;
  DELETE FROM calendar_events    WHERE course_id = p_course_id;
  DELETE FROM conversations      WHERE course_id = p_course_id;
  DELETE FROM course_groups      WHERE course_id = p_course_id;
  DELETE FROM enrollments        WHERE course_id = p_course_id;
  DELETE FROM files              WHERE course_id = p_course_id;
  DELETE FROM grade_categories   WHERE course_id = p_course_id;
  DELETE FROM grade_settings     WHERE course_id = p_course_id;
  DELETE FROM group_sets         WHERE course_id = p_course_id;
  DELETE FROM invites            WHERE course_id = p_course_id;
  DELETE FROM modules            WHERE course_id = p_course_id;
  DELETE FROM notifications      WHERE course_id = p_course_id;
  DELETE FROM question_banks     WHERE course_id = p_course_id;

  -- Delete the course itself
  DELETE FROM courses WHERE id = p_course_id;
END;
$$;
