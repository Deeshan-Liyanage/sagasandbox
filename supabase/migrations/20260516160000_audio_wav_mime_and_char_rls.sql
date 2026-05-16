-- Blocker 2: add audio/wav (and audio/x-wav) to the audio bucket's allowed MIME types
-- so process-export uploads succeed when Kokoro returns .wav files.
update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav'
]
where id = 'audio';

-- Major 4: tighten character-upload RLS policies so only project members
-- (not any authenticated user) can write to images/characters/<cId>/... paths.
-- Drop the overly-broad policies added in the previous migration.
drop policy if exists "images_characters_auth_upload" on storage.objects;
drop policy if exists "images_characters_auth_update" on storage.objects;

-- Re-create with a project-membership subquery:
-- Path structure: characters/<cId>/reference.jpg  → (string_to_array(name,'/'))[2] = cId
create policy "images_characters_project_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and starts_with(name, 'characters/')
    and exists (
      select 1
      from public.characters c
      join public.project_members pm on pm.project_id = c.project_id
      where c.id = (string_to_array(name, '/'))[2]::uuid
        and pm.user_id = auth.uid()
    )
  );

create policy "images_characters_project_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'images'
    and starts_with(name, 'characters/')
    and exists (
      select 1
      from public.characters c
      join public.project_members pm on pm.project_id = c.project_id
      where c.id = (string_to_array(name, '/'))[2]::uuid
        and pm.user_id = auth.uid()
    )
  );
