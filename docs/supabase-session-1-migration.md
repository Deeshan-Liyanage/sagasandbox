# Session 1 — Supabase schema (applied)

**Canonical agent playbook:** [sagasandbox_parallel_cursor_plan.md](./sagasandbox_parallel_cursor_plan.md) (Agent B sections B1–B10)  
**Project ref:** set via `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` (Dashboard → Project Settings → General)  
**Status:** Remote schema applied. Agent B committed repo types, fal helper, edge functions (deployed), and B4 exports bucket migration.

**Vercel integration (managing agent):** [vercel-supabase-orchestrator.md](./integrations/vercel-supabase-orchestrator.md)

## Migrations applied (remote only)

| Name | Contents |
|------|----------|
| `initial_schema_core` | `profiles`, `projects`, `project_members`, auth trigger, helpers |
| `initial_schema_rls_projects` | RLS on projects + project_members |
| `initial_schema_entities` | `location_pins`, `timeline_events`, `characters`, `event_characters`, `exports` |
| `initial_schema_rls_entities` | RLS on entity tables |
| `initial_schema_realtime_storage` | Realtime publication, `images`/`audio` buckets (private), storage policies |

## Tables (all RLS enabled)

- `profiles`, `projects`, `project_members`
- `location_pins`, `timeline_events`, `characters`, `event_characters`, `exports`

## Extras vs parallel plan B1

- `event_characters` junction table (not in B1 SQL — keep for tagging)
- `characters.fal_request_id`, `characters.gen_status` (portrait jobs)
- Realtime includes `characters` (B1 only lists pins, events, exports)

## Drift vs parallel plan B4 (resolve in next migration)

| Item | Parallel plan | Remote today |
|------|---------------|--------------|
| `images` / `audio` buckets | Public read | Private + project-scoped RLS |
| `exports` bucket | Private, PDF/JSON | **Not created** |
| Storage path | `characters/${cId}/reference.jpg` etc. | `{project_id}/...` convention |

Team decision needed: switch buckets to public (simpler URLs) or keep private + signed URLs.

## Agent B deliverables (in repo)

- `/types/db.ts` + `/types/app.ts` (**B3** — unblocks Agents A & C)
- `/src/lib/fal.ts` + `/src/app/api/webhooks/fal/route.ts` (**B5**)
- `/src/lib/realtime-spec.ts` (**B7**)
- `supabase/functions/handle-fal-webhook/`, `process-export/`, `cascade-regen/` (**B6**, **B8**, **B9**)
- `supabase/migrations/20260516130000_exports_bucket_and_generated_storage.sql` (**B4**)

## Edge functions deployed (verify_jwt: false)

| Slug | Version |
|------|---------|
| `handle-fal-webhook` | v1 |
| `process-export` | v1 |
| `cascade-regen` | v1 |

Set Edge secrets: `FAL_KEY`, `ELEVENLABS_API_KEY`, optional `ELEVENLABS_DEFAULT_VOICE_ID` (Supabase Dashboard → Edge Functions → Secrets).

## B10 (demo audio)

Blocked until Agent A runs `scripts/seed-demo.ts` and shares demo `project_id` + event IDs.

## Security advisor warnings (Phase 7)

- Revoke `EXECUTE` on `handle_new_user` / `handle_new_project` from `anon`/`authenticated`
- Set `search_path` on `set_updated_at`, `storage_project_id`
