-- Add assignment visibility/timing columns for consistent LMS behavior
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Backfill hidden flag for existing non-published rows
UPDATE public.assignments
SET hidden = CASE WHEN status = 'published' THEN false ELSE true END
WHERE hidden IS NULL;
