# Production demo checklist

Run through this list before claiming full PRD coverage on a live demo.

**Last automated run:** 2026-05-16 via Supabase MCP (`vkjbompqitvcxeezjfvp`)

## Supabase

- [x] Apply migrations in `supabase/migrations/` (remote: `feature_completeness`, `audio_bucket_and_char_upload_policy`, `audio_wav_mime_and_char_rls`, `security_hardening_v2`)
- [ ] Enable Google OAuth provider; Client IDs field = `*.apps.googleusercontent.com` only *(Dashboard — manual)*
- [ ] Redirect URLs include `https://sagasandbox.vercel.app/auth/callback` and local dev URL *(Dashboard — manual)*
- [ ] Edge secrets: `FAL_KEY`, `SUPABASE_SECRET_KEY` *(Dashboard → Edge Functions → Secrets — verify)*
- [x] Edge functions deployed: `handle-fal-webhook`, `process-export`, `cascade-regen` (ACTIVE v2 on project)
- [ ] Redeploy `process-export` after merge *(MCP deploy failed transiently; run `supabase functions deploy process-export --project-ref vkjbompqitvcxeezjfvp` after `supabase login`)*

### New tables verified (migration applied)

- `project_snapshots`, `agent_logs`, `copilot_pending_changes`
- `timeline_events.audio_summary`, `timeline_events.is_ghost`
- `exports.type` includes `animatic_video`

## Vercel

- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production)
- [x] `SUPABASE_SECRET_KEY` (Production)
- [x] `FAL_KEY` (Production)
- [x] `NEXT_PUBLIC_SITE_URL` (Production)
- [ ] `OPENAI_API_KEY` (Copilot) — **not set** on Production or in local `.env.local`
- [x] Preview: `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_SITE_URL`
- [x] Development: `AUTH_DEV_BYPASS_*`, `DEV_BYPASS_EMAIL`
- [ ] Preview: auth bypass vars *(optional — set in Dashboard; CLI needs branch name)*

## Smoke test (signed-in, real project UUID)

1. Google sign-in or dev bypass (`/login?key=…`)
2. Create project with theme + aesthetic
3. Add pin → wait for `gen_status: done` (Fal webhook)
4. Add timeline event linked to pin
5. Record voice on event (Whisper → `audio_summary`)
6. Open Copilot → propose ghost node → Approve *(needs `OPENAI_API_KEY`)*
7. Settings → change theme with cascade checked
8. Export storyboard JSON + animatic manifest
9. History → revert to earlier snapshot (confirm reload)

## Known limits

- Storyboard export is JSON manifest, not a binary PDF (labeled honestly in UI)
- Animatic queues Luma via Fal; MP4 delivery depends on Fal job completion
- Sketch synthesis requires `FAL_KEY` and optional reference image URL

## Security advisor (non-blocking warnings)

- Revoke RPC execute on `handle_new_user`, `set_updated_at`, `storage_project_id`, `is_project_member` for `anon`/`authenticated` *(partially addressed in `security_hardening_v2`)*
- Public `audio` / `images` buckets allow listing — acceptable for demo URLs
- Enable leaked-password protection in Auth settings
