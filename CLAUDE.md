# dm-ai

AI Dungeon Master for D&D 5e. pnpm monorepo: `apps/mobile` (Expo), `apps/server`, `packages/{mapgen,rules,shared}`, product docs in `docs/`.

Commands: `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm dev:server`, `pnpm dev:web`.

## Keep the main context small

- Repo exploration ("where is", "how does X work"): delegate to the `search` subagent.
- Finding usages before a rename, signature change or delete: delegate to the `grep` subagent.
- Typecheck, tests and diff review before declaring a change done: run `.claude/scripts/audit-snapshot.sh` (prints a SHA of your current work without touching the tree), then delegate to the `audit` subagent with that SHA. It works in its own worktree, so it never touches the working branch.
- Do the editing yourself in the main session; subagents report back, they do not edit.
- Consult the advisor before locking in a plan, when the same error appears twice, and before declaring done.
