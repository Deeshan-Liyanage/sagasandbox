-- Animatic pipeline: correlate Fal queue jobs + allow MP4 objects in exports bucket

alter table exports add column if not exists fal_request_id text;

create index if not exists exports_fal_request_id_idx
  on exports(fal_request_id)
  where fal_request_id is not null;

comment on column exports.fal_request_id is
  'When set, a Fal queue job (e.g. Luma animatic) is in flight for this export row.';

update storage.buckets
set allowed_mime_types = array['application/pdf', 'application/json', 'video/mp4']
where id = 'exports';
