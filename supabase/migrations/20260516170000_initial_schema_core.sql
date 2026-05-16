-- Reproducible base schema (from remote session-1). Apply before later migrations.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  theme text not null,
  aesthetic_style text not null,
  style_config jsonb default '{}',
  canvas_state jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute procedure set_updated_at();

create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz default now(),
  primary key (project_id, user_id)
);

create table if not exists location_pins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  label text not null,
  canvas_x float4 not null,
  canvas_y float4 not null,
  description text,
  generated_image_url text,
  fal_request_id text,
  gen_status text default 'pending' check (gen_status in ('pending','generating','done','error')),
  created_at timestamptz default now()
);

create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  pin_id uuid references location_pins(id) on delete set null,
  title text not null,
  description text,
  sequence_order int4 not null,
  in_world_time text,
  generated_image_url text,
  audio_url text,
  fal_request_id text,
  gen_status text default 'pending' check (gen_status in ('pending','generating','done','error')),
  created_at timestamptz default now()
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  role text check (role in ('primary', 'secondary')),
  description text,
  visual_traits jsonb default '{}',
  reference_image_url text,
  generated_portrait_url text,
  fal_request_id text,
  gen_status text default 'pending',
  voice_id text,
  created_at timestamptz default now()
);

create table if not exists event_characters (
  event_id uuid references timeline_events(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  primary key (event_id, character_id)
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  type text not null check (type in ('storyboard_pdf', 'audio_script', 'animatic_video')),
  event_ids uuid[] default '{}',
  status text default 'queued' check (status in ('queued','processing','done','error')),
  output_url text,
  created_at timestamptz default now()
);

create or replace function is_project_member(p_project_id uuid, p_roles text[] default null)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
      and (p_roles is null or pm.role = any(p_roles))
  ) or exists (
    select 1 from projects p
    where p.id = p_project_id and p.owner_id = auth.uid()
  );
$$;

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table location_pins enable row level security;
alter table timeline_events enable row level security;
alter table characters enable row level security;
alter table exports enable row level security;
