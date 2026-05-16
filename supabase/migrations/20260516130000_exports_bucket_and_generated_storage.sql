-- Agent B B4: exports bucket + public read for generated/* paths in images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exports',
  'exports',
  false,
  104857600,
  array['application/pdf', 'application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images_generated_service_upload" on storage.objects;
create policy "images_generated_service_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'generated'
  );

drop policy if exists "images_generated_public_read" on storage.objects;
create policy "images_generated_public_read"
  on storage.objects for select
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'generated'
  );

drop policy if exists "exports_auth_all" on storage.objects;
create policy "exports_auth_all"
  on storage.objects for all
  using (bucket_id = 'exports' and auth.role() = 'authenticated')
  with check (bucket_id = 'exports' and auth.role() = 'authenticated');
