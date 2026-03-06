-- Add NRPS privacy policy column to lti_deployments.
-- Controls what PII is exposed via the Names & Role Provisioning Service.
-- Values: 'full' (name+email), 'name-only', 'email-only', 'anonymous' (no PII).
-- Default: 'full' for backward compatibility.

ALTER TABLE public.lti_deployments
  ADD COLUMN IF NOT EXISTS nrps_pii_policy text NOT NULL DEFAULT 'full'
    CHECK (nrps_pii_policy IN ('full', 'name-only', 'email-only', 'anonymous'));
