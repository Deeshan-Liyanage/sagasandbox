-- Feature completeness: snapshots, copilot, timeline extras, export animatic

alter table timeline_events
  add column if not exists audio_summary text,
  add column if not exists is_ghost boolean not null default false;

alter table exports drop constraint if exists exports_type_check;
alter table exports add constraint exports_type_check
  check (type in ('storyboard_pdf', 'audio_script', 'animatic_video'));

create table if not exists project_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  state_blob jsonb not null default '{}',
  change_description text,
  created_at timestamptz default now()
);

create table if not exists agent_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  query text not null,
  response text not null,
  action_taken boolean default false,
  revert_reference_id uuid references project_snapshots(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists copilot_pending_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  change_type text not null check (change_type in ('add_event', 'update_event', 'add_pin')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table project_snapshots enable row level security;
alter table agent_logs enable row level security;
alter table copilot_pending_changes enable row level security;

create policy snapshots_member on project_snapshots for all
  using (is_project_member(project_id));

create policy agent_logs_member on agent_logs for all
  using (is_project_member(project_id));

create policy copilot_pending_member on copilot_pending_changes for all
  using (is_project_member(project_id));

alter publication supabase_realtime add table project_snapshots;
alter publication supabase_realtime add table copilot_pending_changes;
