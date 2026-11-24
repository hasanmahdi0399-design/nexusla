-- NEXUS storage setup. Run after 001_core.sql.
-- Bucket is public because the current app displays getPublicUrl() media URLs.
-- The policies restrict uploads/updates/deletes to the user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 2097152,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists nexus_media_public_read on storage.objects;
create policy nexus_media_public_read on storage.objects
for select to public using (bucket_id = 'media');

drop policy if exists nexus_media_upload_own_folder on storage.objects;
create policy nexus_media_upload_own_folder on storage.objects
for insert to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists nexus_media_update_own_folder on storage.objects;
create policy nexus_media_update_own_folder on storage.objects
for update to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists nexus_media_delete_own_folder on storage.objects;
create policy nexus_media_delete_own_folder on storage.objects
for delete to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
