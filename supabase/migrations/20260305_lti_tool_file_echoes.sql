-- LTI tool UX additions: per-course file preview echoes

create table if not exists public.lti_tool_file_echoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  registration_id uuid references public.lti_registrations(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_preview_50 text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lti_tool_file_echoes_course on public.lti_tool_file_echoes(course_id, created_at desc);

alter table public.lti_tool_file_echoes enable row level security;

create policy "lti tool echoes org members read"
on public.lti_tool_file_echoes
for select
using (is_org_member(org_id));

create policy "lti tool echoes staff insert"
on public.lti_tool_file_echoes
for insert
with check (is_org_member(org_id) and exists (
  select 1 from public.enrollments e
  where e.course_id = lti_tool_file_echoes.course_id
    and e.user_id = auth.uid()
    and e.role in ('instructor','ta')
));
