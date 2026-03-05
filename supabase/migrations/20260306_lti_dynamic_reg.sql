-- LTI Dynamic Registration + Platform-Initiated Launch support
-- Apply in Supabase SQL Editor after the base LTI migration

-- -----------------------------------------------------------------------------
-- Login hints table
-- Stores the user/course/deployment context created when the ModernLMS frontend
-- kicks off a platform-initiated LTI launch. The hint_token is passed as the
-- OIDC login_hint through the tool and back to our /lti/oidc/auth endpoint.
-- -----------------------------------------------------------------------------
create table if not exists public.lti_login_hints (
  id             uuid primary key default gen_random_uuid(),
  hint_token     text not null unique,
  org_id         uuid not null references public.orgs(id) on delete cascade,
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id  text not null,
  user_id        uuid references public.profiles(id) on delete set null,
  course_id      uuid references public.courses(id) on delete set null,
  target_link_uri text,
  message_type   text not null default 'LtiResourceLinkRequest',
  expires_at     timestamptz not null,
  consumed_at    timestamptz
);

create index if not exists idx_lti_login_hints_token   on public.lti_login_hints(hint_token);
create index if not exists idx_lti_login_hints_expires on public.lti_login_hints(expires_at);

alter table public.lti_login_hints enable row level security;

create policy "lti login hints service role only"
on public.lti_login_hints
for all
using (false);
