-- Supabase Storage policies for LMS course files bucket
-- Assumes storage object path convention: courses/<course_id>/<filename>
-- where <course_id> is a UUID matching public.enrollments.course_id.

-- Optional: ensure bucket exists (safe if it already exists).
insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

-- Remove old policies for this bucket if they exist.
drop policy if exists "course_files_select_enrolled" on storage.objects;
drop policy if exists "course_files_insert_staff" on storage.objects;
drop policy if exists "course_files_update_staff" on storage.objects;
drop policy if exists "course_files_delete_staff" on storage.objects;

-- Enrolled users can read objects for courses they are in.
create policy "course_files_select_enrolled"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-files'
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = (storage.foldername(name))[2]
  )
);

-- Staff (instructor/ta) can upload objects for their course.
create policy "course_files_insert_staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-files'
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = (storage.foldername(name))[2]
      and e.role in ('instructor', 'ta')
  )
);

-- Staff can update objects for their course.
create policy "course_files_update_staff"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'course-files'
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = (storage.foldername(name))[2]
      and e.role in ('instructor', 'ta')
  )
)
with check (
  bucket_id = 'course-files'
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = (storage.foldername(name))[2]
      and e.role in ('instructor', 'ta')
  )
);

-- Staff can delete objects for their course.
create policy "course_files_delete_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-files'
  and exists (
    select 1
    from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = (storage.foldername(name))[2]
      and e.role in ('instructor', 'ta')
  )
);
