-- Migration: per-assignment student visibility and aggregate stats display
-- Run this in your Supabase SQL editor.

-- 1. Allow hiding an assignment column from students in the gradebook
--    (distinct from `hidden` which hides the assignment from the assignments list)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS visible_to_students BOOLEAN DEFAULT true;

-- 2. Allow instructors to show class-wide aggregate stats (avg, min, max) to students
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS show_stats_to_students BOOLEAN DEFAULT false;

-- 3. Grade scale support for the grade_settings table
ALTER TABLE public.grade_settings
  ADD COLUMN IF NOT EXISTS grade_scale TEXT DEFAULT 'letter';

ALTER TABLE public.grade_settings
  ADD COLUMN IF NOT EXISTS pass_min NUMERIC DEFAULT 60;

ALTER TABLE public.grade_settings
  ADD COLUMN IF NOT EXISTS hp_min NUMERIC DEFAULT 80;

ALTER TABLE public.grade_settings
  ADD COLUMN IF NOT EXISTS hp_pass_min NUMERIC DEFAULT 60;
