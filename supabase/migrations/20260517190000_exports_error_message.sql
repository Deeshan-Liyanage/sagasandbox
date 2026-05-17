-- Adds a free-form error_message column to exports so failures surface
-- diagnostically in the UI instead of an opaque "error" status. Used by
-- both process-export and handle-fal-webhook edge functions.

alter table public.exports
  add column if not exists error_message text;

comment on column public.exports.error_message is
  'Human-readable failure reason. Populated when status = ''error''; cleared on retry.';
