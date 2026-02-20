-- ============================================================
-- Assignment Overrides + Time Allowed Schema Migration
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Add optional "time to complete" (minutes) to assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS time_allowed integer;   -- NULL = unlimited

-- 2. Expand assignment_overrides to support all four override types
--    (due date, available from, available until, time allowed).
--    Make due_date nullable since you might only override one field.
ALTER TABLE public.assignment_overrides
  ALTER COLUMN due_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS available_from  timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS time_allowed    integer;

-- ============================================================
-- How the overrides are applied at runtime (app logic):
--
--   effective_due_date      = override.due_date      ?? assignment.due_date
--   effective_avail_from    = override.available_from ?? assignment.available_from  ?? NOW()
--   effective_avail_until   = override.available_until ?? assignment.available_until ?? (late_submissions ? NULL : due_date)
--   effective_time_allowed  = override.time_allowed   ?? assignment.time_allowed    ?? NULL (unlimited)
-- ============================================================
