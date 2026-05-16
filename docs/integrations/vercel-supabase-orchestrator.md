# Orchestrator runbook: Supabase ↔ Vercel integration

**Audience:** Managing Cursor agent (or human lead) coordinating Agents A/B/C after `feat(db)` is on `main`.  
**Supabase project ref:** `<your-project-ref>` (Dashboard → Project Settings → General)  
**Supabase API URL:** `https://<your-project-ref>.supabase.co` (same as `NEXT_PUBLIC_SUPABASE_URL`)  
**Do not commit secrets.** Values live in `.env.local` (local) and Vercel / Supabase dashboards (deployed).

---

## 1. Goal

Wire the Next.js app on Vercel to the existing Supabase project so that:

- Browser clients authenticate with Supabase Auth (cookies via `@supabase/ssr`).
- API routes and webhooks use `SUPABASE_SECRET_KEY` (preferred) only on the server.
- fal.ai webhooks reach `/api/webhooks/fal` on the **correct deployment URL** per environment.
- Edge Functions (`handle-fal-webhook`, `process-export`, `cascade-regen`) have secrets independent of Vercel.

---

## 2. Prerequisites (verify before starting)

| Check | How |
|-------|-----|
| `main` contains Agent B artifacts | `types/db.ts`, `src/lib/fal.ts`, `supabase/functions/*` |
| Remote schema applied | Supabase MCP `list_tables` or Dashboard → Table Editor |
| Edge functions deployed | Dashboard → Edge Functions: `handle-fal-webhook`, `process-export`, `cascade-regen` (v1+, `verify_jwt: false`) |
| Vercel project linked to repo | GitHub integration or `VERCEL_PROJECT_ID` in Actions secrets |
| Human has keys in `.env.local` | Never read/commit this file |

---

## 3. Environment variables (single source of truth)

Copy from `.env.example`. Map each variable to **where** it must exist.

| Variable | Vercel Preview | Vercel Production | Supabase Edge secrets | Local `.env.local` |
|----------|----------------|-------------------|----------------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | — | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | — | ✅ |
| `SUPABASE_SECRET_KEY` | ✅ | ✅ | — | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback) | optional | optional | — | optional |
| `NEXT_PUBLIC_SITE_URL` | ✅ (preview URL) | ✅ (prod domain) | — | `http://localhost:3000` |
| `FAL_KEY` | ✅ | ✅ | ✅ (image gen + Kokoro TTS) | ✅ |
| `OPENAI_API_KEY` | ✅ | ✅ | — | ✅ |

**Rules for the orchestrator:**

1. **`NEXT_PUBLIC_*`** — Safe for browser; required at **build time** on Vercel. After changing, redeploy.
2. **`SUPABASE_SECRET_KEY`** — Server-only. Used in API routes and `/api/webhooks/fal` forwarder. Never prefix with `NEXT_PUBLIC_`.
   - Legacy fallback supported: `SUPABASE_SERVICE_ROLE_KEY`.
3. **`NEXT_PUBLIC_SITE_URL`** — Must match the deployment users hit:
   - Production: `https://<your-production-domain>`
   - Preview: use Vercel’s **stable preview URL** for the project or set per-deployment via Vercel env UI (see §5).
   - Local: `http://localhost:3000`
4. **Edge secrets** — Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets. Vercel env vars do **not** automatically apply to Deno functions.

Get keys from Supabase Dashboard → Project Settings → API:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **secret key (`sb_secret_...`)** → `SUPABASE_SECRET_KEY` (preferred)
- **legacy service_role JWT** → `SUPABASE_SERVICE_ROLE_KEY` (fallback only)

---

## 4. Step-by-step: Vercel Dashboard

### 4.1 Add environment variables

1. Open [Vercel Dashboard](https://vercel.com) → SagaSandbox project → **Settings** → **Environment Variables**.
2. Add each variable from §3 for **Production** and **Preview** (and **Development** if using `vercel dev`).
3. For `NEXT_PUBLIC_SITE_URL`:
   - **Production:** canonical production URL (e.g. `https://sagasandbox.vercel.app` or custom domain).
   - **Preview:** see §5 — fal webhooks break if this stays `localhost` on preview deploys.

### 4.2 Redeploy

After env changes: **Deployments** → latest → **Redeploy** (or push an empty commit). Next.js inlines `NEXT_PUBLIC_*` at build time.

### 4.3 Confirm build

- `npm run build` locally with same env names.
- Vercel build log must show no missing env errors for routes using Supabase/fal.

---

## 5. Preview deployments and `NEXT_PUBLIC_SITE_URL`

fal.ai calls `webhookUrl: ${NEXT_PUBLIC_SITE_URL}/api/webhooks/fal` from `src/lib/fal.ts`.

**Problem:** A single Preview env value cannot match every unique `*.vercel.app` preview URL unless updated per deploy.

**Orchestrator options (pick one):**

| Strategy | When to use |
|----------|-------------|
| **A. Production-only image gen** | Hackathon demo: set `NEXT_PUBLIC_SITE_URL` only on Production; test fal flow on prod/staging alias. |
| **B. Fixed staging alias** | Vercel → Settings → Domains → assign stable URL to a branch; set Preview `NEXT_PUBLIC_SITE_URL` to that alias. |
| **C. Post-deploy script** | CI updates Vercel Preview `NEXT_PUBLIC_SITE_URL` after deploy (advanced; not in repo yet). |

**Managing agent action:** Document which strategy the team chose in the PR that wires Agent A auth.

---

## 6. Step-by-step: Supabase Dashboard

### 6.1 Auth URL configuration (required for Agent A magic link)

1. **Authentication** → **URL Configuration**
2. **Site URL:** same as production `NEXT_PUBLIC_SITE_URL`
3. **Redirect URLs** (add all that apply):
   ```
   http://localhost:3000/auth/callback
   https://<production-domain>/auth/callback
   https://<staging-or-preview-domain>/auth/callback
   ```
4. Save.

### 6.2 Edge Function secrets

1. **Edge Functions** → **Secrets**
2. Set:
   - `FAL_KEY` — same value as Vercel (covers both image generation and Kokoro TTS audio in `process-export`)
3. `SUPABASE_URL` plus key env (`SUPABASE_SECRET_KEYS` and legacy `SUPABASE_SERVICE_ROLE_KEY`) are injected by Supabase runtime.

### 6.3 Realtime (Agent C)

Confirm replication enabled for: `location_pins`, `timeline_events`, `exports`, `characters` (Dashboard → Database → Publications / Realtime).

### 6.4 Storage

Buckets: `images`, `audio`, `exports`. Generated assets use `images/generated/{request_id}.jpg` (see `supabase/migrations/20260516130000_exports_bucket_and_generated_storage.sql`).

---

## 7. Code the orchestrator should ensure exists (Agent A)

These are **not** fully on `main` as of Agent B merge — assign or verify Agent A completes:

| File | Purpose |
|------|---------|
| `src/lib/supabase-server.ts` | `createServerClient` from `@supabase/ssr` + `cookies()` |
| `src/middleware.ts` | `updateSession` pattern; protect `/projects/*` |
| `src/app/auth/callback/route.ts` | `exchangeCodeForSession` → redirect `/projects` |
| API routes under `src/app/api/projects/**` | CRUD; use `createClient()` + RLS |

**Already present:**

- `src/lib/supabase-client.ts` — browser client
- `src/app/api/webhooks/fal/route.ts` — forwards to edge function
- `types/db.ts`, `types/app.ts`

---

## 8. End-to-end verification checklist

Run in order after env + auth URLs are set.

### 8.1 Local

```bash
# .env.local filled (human-owned)
npm run dev
```

- [ ] App loads at `http://localhost:3000`
- [ ] Magic link login completes (after Agent A auth routes exist)
- [ ] `GET` project list hits Supabase (no 401 from missing session)

### 8.2 Vercel Production (or chosen staging URL)

- [ ] Deployment shows env vars in build (Settings → Environment Variables)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` in browser Network tab (any client request to `*.supabase.co`)
- [ ] Create project → row in `projects` + `project_members` (Supabase Table Editor)

### 8.3 fal pipeline

- [ ] Create location pin via API → `gen_status` = `generating`
- [ ] fal webhook POST → `https://<SITE_URL>/api/webhooks/fal` → edge function
- [ ] Pin row updates: `generated_image_url` set, `gen_status` = `done`
- [ ] UI shows image (Agent C Realtime or refresh)

**Debug:**

- Vercel → Deployment → **Functions** logs for `/api/webhooks/fal`
- Supabase → Edge Functions → `handle-fal-webhook` → Logs
- If webhook never arrives: wrong `NEXT_PUBLIC_SITE_URL` or fal dashboard webhook config

### 8.4 Export pipeline

- [ ] `POST /api/projects/[id]/exports` fires `process-export`
- [ ] `exports.status` → `processing` → `done`
- [ ] `output_url` or signed URL returned

---

## 9. GitHub Actions ↔ Vercel (existing workflow)

File: `.github/workflows/vercel-deploy.yml`

Secrets required in GitHub repo:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

**Orchestrator:** Ensure Vercel env vars (§4) are set in the **Vercel project**, not only in GitHub. Actions runs `vercel pull` + `vercel build` — build uses Vercel-stored env.

`vercel.json` has `"deploymentEnabled": false` — deploys go through GitHub Actions, not Vercel’s native git hook alone. Both need consistent env configuration.

---

## 10. Optional: Vercel ↔ Supabase marketplace integration

If the team uses [Vercel Supabase integration](https://vercel.com/integrations/supabase):

1. Vercel → Project → **Integrations** → Supabase → Connect your Supabase project (use the ref from Dashboard)
2. Integration can auto-sync `NEXT_PUBLIC_SUPABASE_URL` and anon key to Vercel env.
3. **Still manually add:** `SUPABASE_SECRET_KEY`, `FAL_KEY`, `NEXT_PUBLIC_SITE_URL`, `OPENAI_API_KEY`, Edge secrets.

Do **not** rely on marketplace sync for service role or fal keys.

---

## 11. Prisma removal (team decision)

`package.json` still lists `@prisma/client` / `prisma` and `.env.example` lists `DATABASE_URL`. Stack is **Supabase-only**.

**Orchestrator follow-up task** (separate `chore` PR):

- Remove `prisma`, `@prisma/client`, `DATABASE_URL` from `.env.example`
- Delete any `prisma/` schema if present
- Confirm no imports reference Prisma

---

## 12. Agent ownership boundaries (avoid merge conflicts)

| Area | Owner |
|------|--------|
| `types/`, `supabase/functions/`, `src/lib/fal.ts` | Agent B |
| `src/app/api/projects/**`, auth, middleware | Agent A |
| `src/components/**`, `useRealtime`, canvas | Agent C |
| **This runbook + Vercel/Supabase dashboard** | Managing agent / human |

---

## 13. Quick reference: webhook chain

```
fal.ai queue complete
  → POST {NEXT_PUBLIC_SITE_URL}/api/webhooks/fal  (Vercel Next.js)
  → POST {SUPABASE_URL}/functions/v1/handle-fal-webhook  (apikey: secret key)
  → upload images/generated/{request_id}.jpg
  → UPDATE location_pins | timeline_events | characters
  → Realtime postgres_changes → Agent C UI
```

---

## 14. Escalation / common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build OK, Supabase calls fail | Missing `NEXT_PUBLIC_*` at build | Redeploy after adding Vercel env |
| Auth redirect loop | Redirect URL not in Supabase allow list | §6.1 |
| `gen_status` stuck on `generating` | Webhook URL wrong or edge secret missing | §5 + §6.2 |
| RLS permission denied | User not in `project_members` | Agent A insert on project create |
| CORS / cookie issues on preview | Different domain than Site URL | Align Site URL + redirect URLs |

---

*Last updated: Agent B integration pass — coordinate with `docs/supabase-session-1-migration.md`.*
