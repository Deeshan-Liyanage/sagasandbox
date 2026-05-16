-- Create the audio storage bucket used by process-export edge function.
-- Character reference image upload policy for images bucket.

-- ── Audio bucket ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio',
  'audio',
  true,
  52428800, -- 50 MB
  array['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow service role to upload audio exports.
drop policy if exists "audio_service_upload" on storage.objects;
create policy "audio_service_upload"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'audio');

-- Allow public read for audio files (needed for browser playback).
drop policy if exists "audio_public_read" on storage.objects;
create policy "audio_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'audio');

-- ── Character reference image uploads in images bucket ───────────────────────
-- The /api/projects/[id]/characters/[cId]/upload route uploads to
-- images/characters/<cId>/reference.jpg using the authenticated user session.

drop policy if exists "images_characters_auth_upload" on storage.objects;
create policy "images_characters_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and starts_with(name, 'characters/')
  );

drop policy if exists "images_characters_auth_update" on storage.objects;
create policy "images_characters_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'images'
    and starts_with(name, 'characters/')
  );
