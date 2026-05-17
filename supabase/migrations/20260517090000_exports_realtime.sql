-- Publish the `exports` table to `supabase_realtime` so the workspace
-- terminal updates the "Recent exports" status (processing → done | error)
-- without requiring the user to hit Refresh.
--
-- The Next.js client subscribes via `useProjectRealtime`; without the table
-- in the publication, Postgres never broadcasts row updates so the recent
-- list looks frozen until the next manual refresh.

do $$
begin
  begin
    alter publication supabase_realtime add table exports;
  exception when duplicate_object then null;
  end;
end$$;

alter table exports replica identity full;
