#!/usr/bin/env bash
# worker-post-rebase-hook.sh — git post-rewrite hook for workers.
# Fires after rebase or amend. Scans for conflict markers in tracked files.
set -uo pipefail

CAUSE="${1:-unknown}"

# Only act on rebase
[ "$CAUSE" != "rebase" ] && exit 0

# Scan tracked files for conflict markers
CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
if [ -z "$CONFLICTS" ]; then
  # Also check for leftover markers in tracked files
  CONFLICTS=$(git grep -l '^<<<<<<<' -- ':(exclude)*.json' ':(exclude)*.lock' 2>/dev/null || true)
fi

if [ -n "$CONFLICTS" ]; then
  echo ""
  echo "WARNING: CONFLICT MARKERS DETECTED after rebase:"
  echo "$CONFLICTS" | head -20
  echo ""
  echo "Resolve these before committing."

  # Emit bus event if event-bus is available
  BUS_SCRIPT="$HOME/.claude-ops/lib/event-bus.sh"
  if [ -f "$BUS_SCRIPT" ]; then
    source "$BUS_SCRIPT"
    WORKER_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's|^worker/||')
    bus_publish "git.conflict-markers-found" "$(jq -n --arg w "$WORKER_NAME" --arg files "$CONFLICTS" '{worker: $w, files: ($files | split("\n"))}')" 2>/dev/null || true
  fi
fi

exit 0
