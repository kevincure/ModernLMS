-- ============================================================
-- ModernLMS — Schema Migration 2026-02-25
-- Adds: file folder support, grade excused flag
-- Run in the Supabase SQL editor (or psql as superuser).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1  Files — add folder column for display grouping
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS folder text DEFAULT NULL;

COMMENT ON COLUMN public.files.folder IS
  'Optional display-only folder path, e.g. "Lecture Notes" or "Week 1/Readings". Used for UI grouping only.';


-- ────────────────────────────────────────────────────────────
-- SECTION 2  Grades — add excused flag
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS excused boolean DEFAULT false;

COMMENT ON COLUMN public.grades.excused IS
  'When true, this grade is excluded from overall grade calculation.';
