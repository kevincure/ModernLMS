-- LTI Advantage v2: spec-compliance additions
-- Run AFTER 20260304_lti13_platform.sql

-- 1) Add missing columns to lti_ags_scores
ALTER TABLE public.lti_ags_scores ADD COLUMN IF NOT EXISTS comment text;

-- 2) Add missing columns to lti_ags_line_items
ALTER TABLE public.lti_ags_line_items ADD COLUMN IF NOT EXISTS start_date_time timestamptz;
ALTER TABLE public.lti_ags_line_items ADD COLUMN IF NOT EXISTS end_date_time timestamptz;
ALTER TABLE public.lti_ags_line_items ADD COLUMN IF NOT EXISTS resource_link_id text;

-- 3) JTI replay prevention for OAuth2 client assertions (spec MUST)
CREATE TABLE IF NOT EXISTS public.lti_client_assertion_jti (
  jti text NOT NULL,
  client_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jti, client_id)
);

CREATE INDEX IF NOT EXISTS idx_lti_jti_expires
  ON public.lti_client_assertion_jti(expires_at);

-- RLS: service-role only (worker uses service key)
ALTER TABLE public.lti_client_assertion_jti ENABLE ROW LEVEL SECURITY;

-- 4) Cleanup function for expired nonces and JTIs
CREATE OR REPLACE FUNCTION public.cleanup_expired_lti_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted integer := 0;
  d integer;
BEGIN
  DELETE FROM public.lti_state_nonce WHERE expires_at < now() - interval '1 hour';
  GET DIAGNOSTICS d = ROW_COUNT;
  deleted := deleted + d;

  DELETE FROM public.lti_client_assertion_jti WHERE expires_at < now();
  GET DIAGNOSTICS d = ROW_COUNT;
  deleted := deleted + d;

  RETURN deleted;
END;
$$;

-- 5) Add index for NRPS differential membership (?since= param)
CREATE INDEX IF NOT EXISTS idx_enrollments_date_last_modified
  ON public.enrollments(date_last_modified);
