-- Add is_extra_credit flag to assignments table
-- Extra credit assignments add to score numerator but not denominator
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS is_extra_credit boolean DEFAULT false;

-- Add drop_lowest to grade_categories for per-category drop support
-- (Currently stored via naming convention __drop:categoryName in grade_categories)
ALTER TABLE public.grade_categories ADD COLUMN IF NOT EXISTS drop_lowest integer DEFAULT 0;
