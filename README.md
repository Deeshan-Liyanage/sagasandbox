# SagaSandbox

Agentic multimodal storytelling canvas — collaborative world-building, timeline, and canvas workspace.

**Production:** https://sagasandbox.vercel.app

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy [`.env.example`](.env.example) to `.env.local` and fill in keys as features are added.

## Deployments (collaborators)

Vercel Hobby only allows the project owner to deploy from a private repo via native Git integration. This project uses **GitHub Actions** with the owner's Vercel token so **any collaborator** can trigger deploys without a Vercel account.

### Branch naming

Name branches like Conventional Commits: `<type>/<short-description>` (e.g. `feat/timeline-pins`, `fix/canvas-sync`, `ci/vercel-deploy`). Agents and contributors should follow [`.cursor/rules/Branch-Naming.mdc`](.cursor/rules/Branch-Naming.mdc). Do not push directly to `main`.

### Workflow

1. Create a properly named branch from `main`, push it, and open a **pull request**.
2. The [Vercel Deploy](.github/workflows/vercel-deploy.yml) workflow runs and posts a **preview URL** on the PR.
3. After review, merge to `main` → production deploys to https://sagasandbox.vercel.app.

Native Vercel Git auto-deploys are disabled in [`vercel.json`](vercel.json); GitHub Actions is the single deploy path.

### One-time setup (project owner)

1. **Make the repo public** (required for free Hobby collaboration): GitHub → **Settings** → **General** → **Danger zone** → **Change visibility** → **Public**.

2. **Add GitHub Actions secrets** (Settings → Secrets and variables → Actions → New repository secret):

   | Secret | Value |
   |--------|--------|
   | `VERCEL_TOKEN` | Create at [vercel.com/account/tokens](https://vercel.com/account/tokens) |
   | `VERCEL_ORG_ID` | Vercel → **Settings** → copy **Team ID** (or personal account ID) |
   | `VERCEL_PROJECT_ID` | SagaSandbox project → **Settings** → **General** → **Project ID** |

3. Push to `main` or open a PR to confirm the workflow passes.

### Tips for contributors

- You only need **GitHub** access; no Vercel account required.
- Set `git config user.email` to your GitHub verified or noreply email for clear commit attribution.
- If the deploy check fails, ask the owner to confirm the three secrets above are set.

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Vercel collaboration (Hobby limits)](https://vercel.com/docs/deployments/troubleshoot-project-collaboration)
