-- Multi-tenant hardening: attach primary entities to orgs

begin;

-- 1) Add columns as nullable first for safe backfill.
alter table public.profiles add column if not exists org_id uuid;
alter table public.courses add column if not exists org_id uuid;
alter table public.invites add column if not exists org_id uuid;

-- 2) Create/find a default org row (UUID equivalent of org=1).
do $$
declare
  v_default_org_id uuid;
begin
  select id into v_default_org_id
  from public.orgs
  where sourced_id = 'default-org'
  order by updated_at asc
  limit 1;

  if v_default_org_id is null then
    insert into public.orgs (name, type, sourced_id, identifier, status)
    values ('Default Organization', 'district', 'default-org', 'default-org', 'active')
    returning id into v_default_org_id;
  end if;

  -- 3) Backfill profiles and courses first.
  update public.profiles
  set org_id = v_default_org_id
  where org_id is null;

  update public.courses
  set org_id = v_default_org_id
  where org_id is null;

  -- 4) Backfill invites explicitly.
  -- Prefer course org when available, otherwise default org.
  update public.invites i
  set org_id = coalesce(c.org_id, v_default_org_id)
  from public.courses c
  where i.course_id = c.id
    and i.org_id is null;

  update public.invites
  set org_id = v_default_org_id
  where org_id is null;
end
$$;

-- 5) Add FK constraints + indexes.
alter table public.profiles
  add constraint profiles_org_id_fkey
  foreign key (org_id) references public.orgs(id) on delete restrict;

alter table public.courses
  add constraint courses_org_id_fkey
  foreign key (org_id) references public.orgs(id) on delete restrict;

alter table public.invites
  add constraint invites_org_id_fkey
  foreign key (org_id) references public.orgs(id) on delete set null;

create index if not exists profiles_org_id_idx on public.profiles (org_id);
create index if not exists courses_org_id_idx on public.courses (org_id);
create index if not exists invites_org_id_idx on public.invites (org_id);

-- 6) Enforce not-null only after backfill.
alter table public.profiles alter column org_id set not null;
alter table public.courses alter column org_id set not null;

commit;
