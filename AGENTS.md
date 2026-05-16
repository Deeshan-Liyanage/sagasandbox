<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git (agents)

- Branch names: `.cursor/rules/Branch-Naming.mdc` (Conventional Branches; never commit on `main`).
- **Commit at milestones** without waiting for the user: `.cursor/rules/Agent-Milestone-Commits.mdc` (Conventional Commits; push only when asked).
- **No secrets in git**: `.cursor/rules/No-Secrets-In-Repo.mdc` (never commit API keys, tokens, or credentials).
- **Stay current with main** (when helpful): `.cursor/rules/Sync-With-Main.mdc` (fetch/pull or merge `main` before new work — not mandatory).
- **Verbose commits & PRs; review loop**: `.cursor/rules/Agent-Verbose-Git-And-PR-Review.mdc` (detailed messages; reviewers give feedback; PR authors fix issues after merge or close).
