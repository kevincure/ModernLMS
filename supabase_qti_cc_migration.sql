-- ============================================================
-- CC 1.4 + QTI 3.0 Schema Migration
-- Run this in Supabase Query Editor (SQL tab)
-- ============================================================
-- This migration aligns the assignment and question bank tables
-- with IMS Global Common Cartridge 1.4 and QTI 3.0 standards.
--
-- SAFE TO RUN MULTIPLE TIMES: all statements use IF NOT EXISTS
-- or ADD COLUMN IF NOT EXISTS patterns.
-- ============================================================


-- ============================================================
-- PART 1: ASSIGNMENTS TABLE
-- New fields to support the 3-type model (essay / quiz / no_submission)
-- ============================================================

-- 1a. assignment_type: the primary type selector
--     Replaces the old free-text 'category' field for structural logic
--     (category is kept for gradebook weighting purposes)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'essay'
  CHECK (assignment_type IN ('essay', 'quiz', 'no_submission'));

-- 1b. grading_type: how the assignment is graded
--     CC 1.4 supports points; complete_incomplete and letter_grade are LMS extensions
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS grading_type text DEFAULT 'points'
  CHECK (grading_type IN ('points', 'complete_incomplete', 'letter_grade'));

-- 1c. submission_modalities: essay only — which ways students can submit
--     JSONB array, values: 'text', 'file'
--     Example: '["text", "file"]' or '["text"]'
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS submission_modalities jsonb DEFAULT '["text"]';

-- 1d. allowed_file_types: essay with file upload — accepted extensions
--     Example: '[".pdf", ".docx", ".png"]'
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS allowed_file_types jsonb DEFAULT '[]';

-- 1e. max_file_size_mb: essay with file upload — max upload size in MB
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS max_file_size_mb integer DEFAULT 50;

-- 1f. question_bank_id: quiz/exam type — which bank drives this assignment
--     Points are auto-calculated from the sum of bank question points
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS question_bank_id uuid REFERENCES public.question_banks(id) ON DELETE SET NULL;

-- 1g. submission_attempts: how many times a student may submit (null = unlimited)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS submission_attempts integer DEFAULT NULL;

-- 1h. time_limit: quiz type — minutes allowed from first open (null = unlimited)
--     Supplements the per-student quiz_time_overrides table
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS time_limit integer DEFAULT NULL;

-- 1i. randomize_questions: quiz type — shuffle question order per student
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS randomize_questions boolean DEFAULT false;

-- 1j. Index for question_bank_id lookups
CREATE INDEX IF NOT EXISTS idx_assignments_question_bank
  ON public.assignments(question_bank_id);


-- ============================================================
-- PART 2: QUESTION_BANKS TABLE
-- Extend with QTI 3.0 bank-level settings
-- ============================================================

-- 2a. description: optional rich text description of the bank
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS description text;

-- 2b. default_points_per_question: auto-fills new questions (QTI 3.0 convenience)
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS default_points_per_question numeric(5,2) DEFAULT 1;

-- 2c. randomize: bank-level shuffle toggle (per student)
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS randomize boolean DEFAULT false;

-- 2d. created_by: track bank author
ALTER TABLE public.question_banks
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);


-- ============================================================
-- PART 3: QUESTION_TYPE ENUM — expand to QTI 3.0 interaction types
-- Old values: multiple_choice, true_false, short_answer
-- New values added: mc_single, mc_multi, essay, matching, ordering
-- (old values kept for backward compatibility)
-- ============================================================

-- Add new question type values (safe — PostgreSQL allows adding to enums)
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'mc_single';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'mc_multi';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'essay';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'matching';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'ordering';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;


-- ============================================================
-- PART 4: BANK_QUESTIONS TABLE
-- Extend with all QTI 3.0 per-question fields
-- ============================================================

-- 4a. title: optional internal label / question ID
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS title text;

-- 4b. time_dependent: QTI 3.0 REQUIRED attribute on qti-assessment-item
--     true = this question has its own time limit
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS time_dependent boolean DEFAULT false;

-- 4c. time_limit: per-question time limit in seconds (only when time_dependent=true)
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS time_limit integer DEFAULT NULL;

-- 4d. QTI 3.0 feedback fields (qti-modal-feedback elements)
--     feedback_general: shown after submission regardless of correctness
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS feedback_general text;

--     feedback_correct: shown only when student earns full points
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS feedback_correct text;

--     feedback_incorrect: shown when student misses any points
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS feedback_incorrect text;

--     hint: shown to student on demand before answering (pre-submission)
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS hint text;

-- 4e. Accessibility fields (QTI 3.0 + WCAG)
--     alt_text_required: enforce alt-text on any image in prompt/answers
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS alt_text_required boolean DEFAULT false;

--     curriculum_alignment: CASE GUIDs / state standards array
--     Example: '["CCSS.MATH.CONTENT.6.RP.A.1", "TX-TEKS.Math.6.4A"]'
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS curriculum_alignment jsonb DEFAULT '[]';

-- 4f. shuffle_options: for MC types — randomize A/B/C/D order per student
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS shuffle_options boolean DEFAULT false;

-- 4g. partial_credit: scoring template for MC multi, matching, ordering
--     Values: 'all_or_nothing' | 'per_correct' | 'penalize_incorrect'
--     Maps to QTI 3.0 map_response (per_correct, penalize_incorrect)
--     vs match_correct (all_or_nothing) response processing templates
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS partial_credit text DEFAULT 'all_or_nothing'
  CHECK (partial_credit IN ('all_or_nothing', 'per_correct', 'penalize_incorrect'));

-- 4h. case_sensitive: for short_answer type — exact match toggle
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS case_sensitive boolean DEFAULT false;

-- 4i. expected_length: for essay type — suggested response length (lines)
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS expected_length integer DEFAULT NULL;

-- 4j. position: ordering within the bank
ALTER TABLE public.bank_questions
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- NOTE ON 'options' and 'correct_answer' JSONB COLUMNS (existing):
-- These remain as flexible JSONB and store type-specific data:
--
-- mc_single / multiple_choice:
--   options: ["Choice A", "Choice B", "Choice C", "Choice D"]
--   correct_answer: 0  (index)
--   Also stores per-answer feedback in the options array as objects if needed:
--   options: [{"text": "Choice A", "feedback": "Wrong because..."}, ...]
--
-- mc_multi:
--   options: ["Choice A", "Choice B", "Choice C"]
--   correct_answer: [0, 2]  (array of correct indices)
--
-- true_false:
--   correct_answer: true | false
--
-- short_answer:
--   correct_answer: ["Washington", "george washington"]  (accepted answers array)
--
-- essay:
--   correct_answer: null (manual grading)
--
-- matching:
--   options: [{"source": "Paris", "target": "France"}, {"source": "Berlin", "target": "Germany"}]
--   correct_answer: null (pairs are the source of truth; UI scrambles targets for students)
--
-- ordering:
--   options: ["First step", "Second step", "Third step"]  (in correct order)
--   correct_answer: null (options array order is the correct order)


-- ============================================================
-- PART 5: QUIZ_SUBMISSIONS — add assignment_id for quiz-type assignments
-- Allows quiz submissions to be tracked against an assignment rather than
-- a standalone quiz record.
-- ============================================================

ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_assignment
  ON public.quiz_submissions(assignment_id);


-- ============================================================
-- PART 6: ASSIGNMENT_OVERRIDES — add available_from / available_until
-- Per-student overrides can now include window overrides, not just due_date
-- ============================================================

ALTER TABLE public.assignment_overrides
  ADD COLUMN IF NOT EXISTS available_from timestamp with time zone DEFAULT NULL;

ALTER TABLE public.assignment_overrides
  ADD COLUMN IF NOT EXISTS available_until timestamp with time zone DEFAULT NULL;

ALTER TABLE public.assignment_overrides
  ADD COLUMN IF NOT EXISTS time_limit integer DEFAULT NULL;

ALTER TABLE public.assignment_overrides
  ADD COLUMN IF NOT EXISTS submission_attempts integer DEFAULT NULL;


-- ============================================================
-- PART 7: BACKFILL — set assignment_type for existing assignments
-- Map old 'category' values to new assignment_type
-- ============================================================

-- Quiz/exam categories → quiz type
UPDATE public.assignments
  SET assignment_type = 'quiz'
  WHERE category IN ('quiz', 'exam')
    AND assignment_type = 'essay';  -- only update if not already set

-- Everything else → essay type (already the default, but explicit for clarity)
UPDATE public.assignments
  SET assignment_type = 'essay'
  WHERE category NOT IN ('quiz', 'exam')
    AND assignment_type = 'essay';


-- ============================================================
-- PART 8: RLS POLICIES for new question_bank_id reference
-- Students taking a quiz-type assignment need to read the linked bank's questions
-- ============================================================

-- Allow enrolled students to read bank_questions for published quiz-type assignments
-- (The existing "Enrolled see bank questions" policy already covers staff;
--  this adds student read access when an assignment of type quiz links to the bank)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_questions'
      AND policyname = 'Students see bank questions via quiz assignment'
  ) THEN
    CREATE POLICY "Students see bank questions via quiz assignment"
      ON public.bank_questions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.question_banks qb
          JOIN public.assignments a ON a.question_bank_id = qb.id
          JOIN public.enrollments e ON e.course_id = a.course_id
          WHERE qb.id = bank_questions.bank_id
            AND e.user_id = auth.uid()
            AND a.status = 'published'
        )
      );
  END IF;
END;
$$;

-- Allow quiz_submissions to be inserted for assignment_id (student self-insert)
-- The existing "Students can submit quiz" policy already allows INSERT with user_id = auth.uid()
-- No additional policy needed; the assignment_id column is nullable.


-- ============================================================
-- GRANT permissions on new columns (Supabase auto-inherits via table grants,
-- but explicit grants are safe to include)
-- ============================================================
GRANT ALL ON TABLE public.bank_questions TO authenticated;
GRANT ALL ON TABLE public.question_banks TO authenticated;
GRANT ALL ON TABLE public.assignments TO authenticated;
GRANT ALL ON TABLE public.quiz_submissions TO authenticated;
GRANT ALL ON TABLE public.assignment_overrides TO authenticated;


-- ============================================================
-- DONE
-- ============================================================
-- Summary of changes:
--
-- assignments:        +assignment_type, +grading_type, +submission_modalities,
--                     +allowed_file_types, +max_file_size_mb, +question_bank_id,
--                     +submission_attempts, +time_limit, +randomize_questions
--
-- question_banks:     +description, +default_points_per_question, +randomize, +created_by
--
-- question_type enum: +mc_single, +mc_multi, +essay, +matching, +ordering
--
-- bank_questions:     +title, +time_dependent, +time_limit, +feedback_general,
--                     +feedback_correct, +feedback_incorrect, +hint,
--                     +alt_text_required, +curriculum_alignment, +shuffle_options,
--                     +partial_credit, +case_sensitive, +expected_length, +position
--
-- quiz_submissions:   +assignment_id (for quiz-type assignment submissions)
--
-- assignment_overrides: +available_from, +available_until, +time_limit,
--                       +submission_attempts
-- ============================================================
