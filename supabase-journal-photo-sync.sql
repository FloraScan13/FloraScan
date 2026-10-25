-- FloraScan journal photo sync setup
-- Run this once in the Supabase SQL Editor for your project.
-- Journal photos are private; each signed-in user can access only their own folder.

alter table public.plant_logs
  add column if not exists photos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journal-photos',
  'journal-photos',
  false,
  10485760,
  array['image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg'];

drop policy if exists "Users can view own FloraScan journal photos" on storage.objects;
create policy "Users can view own FloraScan journal photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'journal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload own FloraScan journal photos" on storage.objects;
create policy "Users can upload own FloraScan journal photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'journal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update own FloraScan journal photos" on storage.objects;
create policy "Users can update own FloraScan journal photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'journal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'journal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete own FloraScan journal photos" on storage.objects;
create policy "Users can delete own FloraScan journal photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'journal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
