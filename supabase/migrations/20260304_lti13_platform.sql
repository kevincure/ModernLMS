-- LTI 1.3 Platform + Advantage schema for Supabase
-- Paste into Supabase SQL editor (or run via migration tooling)

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Core registration/deployment/key tables
-- -----------------------------------------------------------------------------

create table if not exists public.lti_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  tool_name text not null,
  issuer text not null,
  client_id text not null,
  auth_login_url text not null,
  auth_token_url text,
  jwks_url text,
  target_link_uri text,
  deep_link_return_url text,
  status text not null default 'active' check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, issuer, client_id)
);

create table if not exists public.lti_deployments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id text not null,
  scope_type text not null check (scope_type in ('org','department','course')),
  scope_ref text,
  enable_deep_linking boolean not null default true,
  enable_ags boolean not null default true,
  enable_nrps boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, deployment_id, scope_type, coalesce(scope_ref, ''))
);

create table if not exists public.lti_platform_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  kid text not null,
  alg text not null default 'RS256',
  use text not null default 'sig',
  public_jwk jsonb not null,
  private_key_secret_ref text not null,
  status text not null check (status in ('active','next','retired')),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, kid)
);

-- -----------------------------------------------------------------------------
-- 2) Launch/session/audit tables
-- -----------------------------------------------------------------------------

create table if not exists public.lti_state_nonce (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  registration_id uuid not null references public.lti_registrations(id) on delete cascade,
  deployment_id text,
  state text not null unique,
  nonce text not null unique,
  launch_redirect_uri text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists public.lti_launches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  registration_id uuid references public.lti_registrations(id) on delete set null,
  deployment_id text,
  course_id uuid references public.courses(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  message_type text,
  lti_version text,
  resource_link_id text,
  correlation_id text,
  status text not null check (status in ('success','failed')),
  error_code text,
  error_detail text,
  raw_claims jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lti_key_rotation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  old_kid text,
  new_kid text,
  initiated_by uuid references public.profiles(id) on delete set null,
  cutover_at timestamptz,
  result text not null default 'scheduled' check (result in ('scheduled','success','failed','cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3) Advantage service tables
-- -----------------------------------------------------------------------------

create table if not exists public.lti_ags_line_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  registration_id uuid references public.lti_registrations(id) on delete set null,
  deployment_id text,
  assignment_id uuid references public.assignments(id) on delete set null,
  lineitem_url text not null unique,
  label text not null,
  score_max numeric(10,2) not null,
  resource_id text,
  tag text,
  lti_context_id text,
  created_by_launch_id uuid references public.lti_launches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lti_ags_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  line_item_id uuid not null references public.lti_ags_line_items(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  score_given numeric(10,2),
  score_max numeric(10,2),
  activity_progress text,
  grading_progress text,
  timestamp_from_tool timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lti_nrps_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  registration_id uuid references public.lti_registrations(id) on delete set null,
  deployment_id text,
  role_filter text,
  limit_n integer,
  page_n integer,
  result_count integer,
  correlation_id text,
  status_code integer,
  created_at timestamptz not null default now()
);

create table if not exists public.lti_deep_link_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  registration_id uuid references public.lti_registrations(id) on delete set null,
  deployment_id text,
  launch_id uuid references public.lti_launches(id) on delete set null,
  content_item_type text,
  content_title text,
  content_url text,
  custom_claims jsonb not null default '{}'::jsonb,
  created_lms_type text,
  created_lms_id text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4) Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_lti_registrations_org on public.lti_registrations(org_id);
create index if not exists idx_lti_deployments_org on public.lti_deployments(org_id);
create index if not exists idx_lti_deployments_registration on public.lti_deployments(registration_id);
create index if not exists idx_lti_platform_keys_org on public.lti_platform_keys(org_id);
create index if not exists idx_lti_state_nonce_expires on public.lti_state_nonce(expires_at);
create index if not exists idx_lti_launches_org_created on public.lti_launches(org_id, created_at desc);
create index if not exists idx_lti_launches_corr on public.lti_launches(correlation_id);
create index if not exists idx_lti_ags_line_items_course on public.lti_ags_line_items(course_id);
create index if not exists idx_lti_ags_scores_line_item on public.lti_ags_scores(line_item_id);
create index if not exists idx_lti_nrps_requests_course on public.lti_nrps_requests(course_id);

-- -----------------------------------------------------------------------------
-- 5) Utility trigger for updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lti_registrations_updated_at on public.lti_registrations;
create trigger trg_lti_registrations_updated_at
before update on public.lti_registrations
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_lti_deployments_updated_at on public.lti_deployments;
create trigger trg_lti_deployments_updated_at
before update on public.lti_deployments
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_lti_platform_keys_updated_at on public.lti_platform_keys;
create trigger trg_lti_platform_keys_updated_at
before update on public.lti_platform_keys
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_lti_ags_line_items_updated_at on public.lti_ags_line_items;
create trigger trg_lti_ags_line_items_updated_at
before update on public.lti_ags_line_items
for each row execute function public.set_updated_at_now();

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------

alter table public.lti_registrations enable row level security;
alter table public.lti_deployments enable row level security;
alter table public.lti_platform_keys enable row level security;
alter table public.lti_state_nonce enable row level security;
alter table public.lti_launches enable row level security;
alter table public.lti_key_rotation_events enable row level security;
alter table public.lti_ags_line_items enable row level security;
alter table public.lti_ags_scores enable row level security;
alter table public.lti_nrps_requests enable row level security;
alter table public.lti_deep_link_items enable row level security;

-- superadmin management policies
create policy "lti registrations superadmin all"
on public.lti_registrations
for all
using (is_org_superadmin(org_id))
with check (is_org_superadmin(org_id));

create policy "lti deployments superadmin all"
on public.lti_deployments
for all
using (is_org_superadmin(org_id))
with check (is_org_superadmin(org_id));

create policy "lti platform keys superadmin all"
on public.lti_platform_keys
for all
using (is_org_superadmin(org_id))
with check (is_org_superadmin(org_id));

create policy "lti state nonce superadmin read"
on public.lti_state_nonce
for select
using (is_org_superadmin(org_id));

create policy "lti launches superadmin read"
on public.lti_launches
for select
using (is_org_superadmin(org_id));

create policy "lti rotation events superadmin read"
on public.lti_key_rotation_events
for select
using (is_org_superadmin(org_id));

create policy "lti ags line items superadmin all"
on public.lti_ags_line_items
for all
using (is_org_superadmin(org_id))
with check (is_org_superadmin(org_id));

create policy "lti ags scores superadmin read"
on public.lti_ags_scores
for select
using (is_org_superadmin(org_id));

create policy "lti nrps requests superadmin read"
on public.lti_nrps_requests
for select
using (is_org_superadmin(org_id));

create policy "lti deep link items superadmin read"
on public.lti_deep_link_items
for select
using (is_org_superadmin(org_id));

-- service role bypasses RLS automatically in Supabase; use service key from worker.

-- -----------------------------------------------------------------------------
-- 7) Helpful RPC for endpoint resolver
-- -----------------------------------------------------------------------------

create or replace function public.get_lti_deployment_for_course(
  p_org_id uuid,
  p_registration_id uuid,
  p_course_id uuid
)
returns table (
  deployment_id text,
  enable_deep_linking boolean,
  enable_ags boolean,
  enable_nrps boolean
)
language sql
stable
as $$
  select d.deployment_id, d.enable_deep_linking, d.enable_ags, d.enable_nrps
  from public.lti_deployments d
  where d.org_id = p_org_id
    and d.registration_id = p_registration_id
    and d.status = 'active'
    and (
      (d.scope_type = 'course' and d.scope_ref = p_course_id::text)
      or d.scope_type = 'org'
    )
  order by case when d.scope_type = 'course' then 0 else 1 end
  limit 1;
$$;

