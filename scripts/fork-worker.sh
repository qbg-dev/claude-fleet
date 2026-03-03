#!/usr/bin/env bash
# fork-worker.sh — Self-registers as a child pane, then execs Claude forked from parent session.
#
# Usage: fork-worker.sh <parent_pane_id> <parent_session_id> [extra-claude-flags...]
#
# Run this in a NEW pane (e.g. after C-x % to split). The script detects its own
# pane_id via tmux, registers itself as a child of the parent, then exec's Claude
# with --resume <session> --fork-session so the new session branches from the parent
# conversation without affecting it.
#
# Example (paste in new pane after C-x y):
#   bash ~/.claude-ops/scripts/fork-worker.sh %612 abc123def456 --dangerously-skip-permissions

set -uo pipefail

PARENT_PANE="${1:-}"
PARENT_SESSION="${2:-}"
shift 2 2>/dev/null || true

if [ -z "$PARENT_PANE" ] || [ -z "$PARENT_SESSION" ]; then
  echo "Usage: fork-worker.sh <parent_pane_id> <parent_session_id> [claude-flags...]" >&2
  exit 1
fi

# Detect our own pane_id (we are running IN the child pane)
CHILD_PANE=$(tmux display-message -p '#{pane_id}' 2>/dev/null || echo "")

if [ -n "$CHILD_PANE" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if bash "$SCRIPT_DIR/worker-register-child.sh" "$CHILD_PANE" "$PARENT_PANE"; then
    echo "Registered as child of $PARENT_PANE — forking session $PARENT_SESSION"
  else
    echo "Warning: child registration failed, continuing anyway" >&2
  fi
else
  echo "Warning: could not detect pane_id (not in tmux?), skipping registration" >&2
fi

# Hand off to Claude — fork-session creates a new session ID branching from parent
exec claude --resume "$PARENT_SESSION" --fork-session "$@"
