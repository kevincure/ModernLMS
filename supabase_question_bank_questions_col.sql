-- ============================================================
-- Question Bank: Add 'questions' JSONB column
-- Run in Supabase SQL Editor
-- SAFE: uses ADD COLUMN IF NOT EXISTS — idempotent
-- ============================================================
-- Root cause of error PGRST204:
--   The JS code stores bank questions as a JSONB array directly
--   on the question_banks row. The column did not exist in the
--   base schema or the QTI/CC migration, so PostgREST rejected
--   the INSERT/UPDATE with "Could not find the 'questions' column".
--
-- This also adds:
--   • updated_at + trigger for question_banks (good hygiene)
--   • Loads question_banks rows in the same place as other course data
-- ============================================================

-- 1. Add the questions JSONB cache column
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '[]';

-- 2. Add updated_at so edits are traceable
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Wire up the existing update_updated_at trigger
DROP TRIGGER IF EXISTS update_question_banks_updated_at ON public.question_banks;
CREATE TRIGGER update_question_banks_updated_at
  BEFORE UPDATE ON public.question_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- DONE — after running this, question bank creation and updates
-- will work without PGRST204 errors.
-- ============================================================
