-- Enable realtime on projects so scenery_preview_url updates reach the canvas.

do $$
begin
  begin
    alter publication supabase_realtime add table projects;
  exception when duplicate_object then null;
  end;
end$$;
