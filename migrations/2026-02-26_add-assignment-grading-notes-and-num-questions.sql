-- Add missing columns to assignments table
-- grading_notes: instructor notes/instructions for graders (used by AI grading)
-- num_questions: number of questions to select from a question bank for quizzes

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS grading_notes text DEFAULT NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS num_questions integer DEFAULT NULL;
