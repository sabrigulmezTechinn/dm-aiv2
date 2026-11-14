#!/usr/bin/env bash
# Prints the SHA of a throwaway commit holding the current work (staged,
# unstaged and untracked files, .gitignore respected) on top of HEAD.
# It does not touch the working tree, the real index, the stash or any branch.
# The audit subagent checks this SHA out in its own worktree, which shares
# this repository's object store.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
tmp_index="$(mktemp)"
trap 'rm -f "$tmp_index"' EXIT
cp "$(git rev-parse --git-path index)" "$tmp_index"
GIT_INDEX_FILE="$tmp_index" git add -A
tree="$(GIT_INDEX_FILE="$tmp_index" git write-tree)"
git commit-tree "$tree" -p HEAD -m "audit snapshot (not on any branch)"
