#!/usr/bin/env bash
# Removes the worktrees left behind by the audit subagent: only worktrees
# under .claude/worktrees/ whose HEAD is an "audit snapshot" commit.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
removed=0
while read -r key path; do
  [ "$key" = worktree ] || continue
  case "$path" in "$PWD"/.claude/worktrees/*) ;; *) continue ;; esac
  if [ "$(git -C "$path" log -1 --format=%s 2>/dev/null)" = "audit snapshot (not on any branch)" ]; then
    git worktree remove --force "$path" && echo "removed $path" && removed=$((removed+1))
  fi
done < <(git worktree list --porcelain)
git worktree prune
echo "audit worktrees removed: $removed"
