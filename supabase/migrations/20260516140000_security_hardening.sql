-- Security hardening: address Supabase Security Advisor warnings.
--
-- 1. Restrict EXECUTE on trigger functions to postgres only.
--    anon / authenticated roles should never be able to call these directly.
-- 2. Set an explicit search_path on helper functions to prevent search-path
--    injection attacks.

-- ── Trigger functions ─────────────────────────────────────────────────────────

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_project() from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

-- ── Utility functions: explicit search_path ───────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- storage_project_id is a helper used in RLS policies
create or replace function public.storage_project_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select (string_to_array(object_name, '/'))[1]::uuid;
$$;
