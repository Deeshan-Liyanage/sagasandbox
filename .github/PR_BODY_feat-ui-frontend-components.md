## Summary (Agent C scope + preview deploy goal)

**Agent C (Dev C)** delivers the SagaSandbox **frontend workspace** (plan sections **C1–C9**): studio shell, universe initializer modal, Konva geography canvas, pin sidebar, character vault, draggable timeline, export terminal, and `WorkspaceClient` orchestration with Zustand selection + Supabase Realtime hooks.

**Preview deploy goal:** Vercel preview must **build and render** without Agent A API routes or Supabase env vars. This branch adds:

- Landing at **`/`** and demo workspace at **`/projects/demo`** (and any `/projects/[id]`) using **`src/lib/mock-workspace.ts`** seed data
- **`isSupabaseConfigured()`** guard so Realtime subscriptions **no-op** when `NEXT_PUBLIC_SUPABASE_*` are unset
- **`vercel.json`** fix: remove `git.deploymentEnabled: false` so git-triggered previews run
- **Copilot review fixes** (7 items) for stale closures, focus stealing, export state leaks, and ESLint `no-img-element`

**Stack on `main` already includes** the initial UI commit (squash-merged via PR #4 as `c4136b9`). **This PR is the second commit only** — preview routes + review hardening — rebased on top of Agent B’s `types/db.ts` (`a9e5801`).

---

## Commits / changelog

| SHA | Subject | What changed |
|-----|---------|--------------|
| `97c258a` | `feat(ui): add workspace shell, canvas, timeline, and vault components` | **Merged to `main` via PR #4** (`c4136b9`). Full C1–C9 component stack (+2.4k LOC): `AppShell`, `UniverseInitializerModal`, `GeographyCanvas`, `PinCreator`/`PinSidebar`, `CharacterVault`, `TimelineStrip`, `ExportTerminal`, `WorkspaceClient`, `useRealtime`, `types/app.ts`, deps (`konva`, `@dnd-kit`, `@supabase/ssr`). |
| `814ff82` | `fix(ui): enable Vercel preview with mock workspace routes` | **This PR.** Mock `page.tsx` + landing, `RemoteImage`, realtime handler ref pattern, Supabase optional env, Copilot closure/focus fixes, `vercel.json` deploy enable. 15 files, +281/−104 vs `main`. |

---

## Scope — file areas with purpose

| Area | Path(s) | Purpose |
|------|---------|---------|
| **Landing** | `src/app/page.tsx` | Studio-dark home; CTA → `/projects/demo`. |
| **Workspace route** | `src/app/projects/[id]/page.tsx` | RSC loads mock project/pins/events/characters; passes props to `WorkspaceClient`. |
| **Layout** | `src/app/layout.tsx` | `min-h-full` on `<html>` for full-viewport workspace. |
| **Orchestrator** | `src/app/projects/[id]/WorkspaceClient.tsx` | Dynamic Konva import; realtime handlers; pin/event/character merge; **focus-safe** `handleEventUpdate` / `handlePinUpdate`. |
| **Mock data** | `src/lib/mock-workspace.ts` | `DEMO_PROJECT_ID`, `getMockProject/Pins/Events/Characters` for preview. |
| **Supabase client** | `src/lib/supabase-client.ts` | `isSupabaseConfigured()`; placeholder URLs when unset (build-safe). |
| **Realtime** | `src/hooks/useRealtime.ts` | `handlersRef` synced in `useEffect`; subscribe only when configured + `projectId`. |
| **Images** | `src/components/shared/RemoteImage.tsx` | `next/image` + `unoptimized` for Fal/Storage URLs. |
| **Canvas** | `src/components/canvas/GeographyCanvas.tsx` | Dropped `initialPins` reset `useEffect`. |
| **Timeline** | `src/components/timeline/TimelineStrip.tsx` | Functional state updaters; `RemoteImage` for thumbnails. |
| **Vault** | `src/components/vault/CharacterVault.tsx` | Functional updaters; portrait placeholder logic; `RemoteImage`. |
| **Export** | `src/components/export/ExportTerminal.tsx` | Reset export UI state at start of each run. |
| **Gen status** | `src/components/shared/GenStatusImage.tsx` | Lint-safe image usage. |
| **Env docs** | `.env.example` | Documents Supabase as **optional for preview**. |
| **Deploy** | `vercel.json` | Removed `deploymentEnabled: false`. |

**On `main` (not re-diffed here):** full `src/components/**`, `src/types/app.ts`, `WorkspaceClient` assembly, `package.json` deps — see merged PR #4.

---

## Architecture

### WorkspaceClient

- **Server:** `page.tsx` resolves `params.id`, calls mock getters, renders `<WorkspaceClient project={…} initial*={…} />`.
- **Client state:** `pins`, `events`, `characters` in React state; Zustand (`useUIStore`) for `selectedPin`, `activeEvent`, `sidebarMode`.
- **Realtime:** `useProjectRealtime(project.id, handlers)` — when Supabase env missing, effect returns immediately (no channel).
- **Konva:** `GeographyCanvas` via `dynamic(..., { ssr: false })` + skeleton loader — avoids Next 16 SSR/build failures with `react-konva`.
- **Mutations (still API-shaped):** components `fetch` `/api/projects/...` routes; without Agent A routes, user actions 404 but local optimistic UI still updates until refresh.

```
┌──────────────────────────────────────────────────────────────┐
│ page.tsx (RSC) → mock-workspace seed data                     │
└────────────────────────────┬─────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ WorkspaceClient                                               │
│  state: pins | events | characters                          │
│  useUIStore: selection / sidebar mode                       │
│  useProjectRealtime → optional Supabase merge               │
│  dynamic(GeographyCanvas, { ssr: false })                     │
└──────────────────────────────────────────────────────────────┘
```

### Mock routes

| Route | Behavior |
|-------|----------|
| `/` | Static landing + link to demo |
| `/projects/demo` | Full workspace with Whispering Tavern seed narrative |
| `/projects/<uuid>` | Same mock pattern; project name derived from id |

### RemoteImage

External/generated URLs (Fal, Supabase storage) use `next/image` with `unoptimized` until `images.remotePatterns` are configured in `next.config`.

### Realtime fallbacks

```ts
if (!projectId || !isSupabaseConfigured()) return;
```

No channel subscription → no placeholder Supabase errors on Vercel preview without env vars.

### Konva dynamic

Required pattern (see `AGENTS.md` learnings): never import `GeographyCanvas` synchronously in RSC tree.

---

## PR review fixes addressed (Copilot 7 items)

| # | Issue | Fix | File(s) |
|---|--------|-----|---------|
| 1 | `handleEventUpdate` steals active event focus | `setActiveEvent` only when `useUIStore.getState().activeEvent?.id === event.id` | `WorkspaceClient.tsx` |
| 2 | `GeographyCanvas` resets pins from `initialPins` | Removed redundant `useEffect`; dropped unused `initialPins` prop | `GeographyCanvas.tsx` |
| 3 | Stale closure in `TimelineStrip.handleAdd` | Functional `onEventsChange` updaters | `TimelineStrip.tsx` |
| 4 | `CharacterVault` stale closures | Functional updaters for create/patch/upload | `CharacterVault.tsx` |
| 5 | Portrait placeholder logic | “Generating…” when `reference_image_url` set and no `generated_portrait_url` | `CharacterVault.tsx` |
| 6 | `ExportTerminal` state leak between runs | Reset `downloadUrl`, `exportStatus`, `currentExportId` at export start | `ExportTerminal.tsx` |
| 7 | `useProjectRealtime` stale handlers | `handlersRef` updated in dedicated `useEffect`; subscription deps `[projectId]` only | `useRealtime.ts` |

**Additional (lint):** raw `<img>` → `RemoteImage` in vault/timeline/export paths.

---

## Handoff contracts — ready vs blocked

| Contract | Owner | Status on `main` | This PR |
|----------|-------|------------------|---------|
| `/types/db.ts` + Supabase schema | Agent B | **On `main`** (`a9e5801`) | C should migrate `src/types/app.ts` → `types/db.ts` in follow-up |
| `falQueue()` + `handle-fal-webhook` | Agent B | Edge fns on `main`; **dummy-job test gate** per AGENTS.md | UI shows `gen_status` placeholders; live updates blocked until webhook verified |
| REST APIs (`/api/projects`, pins, events, characters, exports) | Agent A | **Not merged** | All `fetch` calls wired; 404 without routes |
| `page.tsx` server fetch (real DB) | Agent A | **Mock in this PR** | Swap mock getters for Supabase/Prisma when ready |
| Auth / `userId` for canvas broadcast | Agent A | Missing | Canvas uses `"local"` until session wired |
| Canvas persistence `PATCH …/canvas` | Agent A | TODO in `WorkspaceClient` | `onCanvasChange` stub |
| `onCanvasOp` peer merge | Agent C + A | No-op handler | Remote brush not applied to peer stages yet |

**Ready for Agent A to import without changes:** all `src/components/**`, `useRealtime.ts`, `ui-store`, `WorkspaceClient`, mock layer (replace incrementally).

---

## Vercel deployment

### `vercel.json`

**Before (`main` had):**
```json
"git": { "deploymentEnabled": false }
```

**After (this branch):** schema only — **git deployments enabled** (default).

### Routes to verify on preview

- `https://<preview>/`
- `https://<preview>/projects/demo`

Build output (webpack): `○ /`, `ƒ /projects/[id]`.

### Environment variables

| Variable | Preview | Production / full stack |
|----------|---------|-------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required for server/edge |
| `FAL_KEY` | — | Required for generation |
| `DATABASE_URL` | — | Prisma |
| `OPENAI_API_KEY` | — | Copilot (future) |

See `.env.example` for full list.

### Webpack note

Local `npm run build` (Turbopack default) may fail on **darwin/arm64** with corrupt `@next/swc-darwin-arm64` (“Turbopack requires native bindings”). **CI/Vercel Linux** typically succeeds. Local verification: `npm run build -- --webpack`. If Vercel preview fails only on Turbopack, set project **Build Command** to `next build --webpack`.

---

## Test plan

| Command | Result (2026-05-16, rebased `814ff82`) |
|---------|----------------------------------------|
| `npx tsc --noEmit` | **Pass** |
| `npm run lint` | **Pass** (no errors) |
| `npm run build -- --webpack` | **Pass** — routes `/`, `/projects/[id]` |
| `npm run build` (Turbopack) | **Fail locally** (SWC/Turbopack native binding); expect **pass on Vercel** |

**Manual preview checklist:**

- [ ] `/` loads landing; CTA opens demo workspace
- [ ] `/projects/demo` — canvas, timeline, vault nav, pin overlay
- [ ] Without Supabase env: no console errors from Realtime; workspace usable
- [ ] With Supabase env + schema: pin/event `postgres_changes` update local state
- [ ] After Agent A APIs: create project via modal → real `page.tsx` fetch

---

## Reviewer guide (Cursor agent)

**Start here:** `src/app/projects/[id]/page.tsx` → `WorkspaceClient.tsx` → `mock-workspace.ts` → `useRealtime.ts` → Copilot fix diffs in timeline/vault/export.

**Focus areas:**

1. **Rebase correctness** — only preview/review delta vs `main`; no accidental removal of `types/db.ts` or Agent B files.
2. **Mock vs production path** — clear seam to replace `getMock*` with server fetch.
3. **Realtime guard** — no subscription when env unset; handlers stay fresh via ref.
4. **Focus/closure regressions** — retest timeline add + vault upload under rapid clicks.
5. **API contract drift** — `src/types/app.ts` vs `types/db.ts` on `main` (field names: `sequence_order`, `gen_status`, etc.).

**Known limitations:**

- API `fetch` calls 404 until Agent A merges routes.
- Live `gen_status` UX should stay demo-safe until fal webhook dummy-job passes (AGENTS.md).
- `onCanvasOp` still no-op; multiplayer brush not visible cross-client.
- **`AGENTS.md` learnings** exist locally (unstaged in stash) — not in this PR; merge separately if desired.

**Suggested review order:** `page.tsx` → `WorkspaceClient.tsx` → `mock-workspace.ts` → `supabase-client.ts` → `useRealtime.ts` → `TimelineStrip.tsx` → `CharacterVault.tsx` → `ExportTerminal.tsx` → `vercel.json`.

---

## Relation to PR #4

- **PR #4** ([link](https://github.com/HellFireInfernoStorm/sagasandbox/pull/4)): merged `97c258a` only; description was accurate for initial stack but **predated** preview routes and Copilot fixes.
- **This PR:** follow-up commit `814ff82` on `feat/ui-frontend-components` after rebase onto current `main`.
