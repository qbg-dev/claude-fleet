#!/usr/bin/env bash
# merge-trigger-watchdog.sh — Lightweight daemon that watches .merge-trigger
# and wakes chief-of-staff via tmux when workers request a merge.
#
# Runs as a background process in chief's tmux pane.
# Usage: bash merge-trigger-watchdog.sh &
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TRIGGER="$PROJECT_ROOT/.claude/workers/.merge-trigger"
PANE_REG="${HOME}/.claude-ops/state/pane-registry.json"
POLL_INTERVAL="${POLL_INTERVAL:-1}"

# Resolve chief-of-staff pane
_find_chief_pane() {
  jq -r 'to_entries[] | select(.value.harness == "worker/chief-of-staff") | .key' \
    "$PANE_REG" 2>/dev/null | head -1 || echo ""
}

_pane_target() {
  local pane_id="$1"
  tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$pane_id" '$1 == id {print $2; exit}'
}

echo "[merge-watchdog] Started. Polling $TRIGGER every ${POLL_INTERVAL}s"

while true; do
  if [ -s "$TRIGGER" ]; then
    # Read trigger contents
    WORKERS=$(cat "$TRIGGER" 2>/dev/null || echo "")

    # Clear trigger atomically (truncate, not remove — avoids race)
    > "$TRIGGER"

    # Find chief pane
    CHIEF_PANE=$(_find_chief_pane)
    if [ -n "$CHIEF_PANE" ]; then
      CHIEF_TARGET=$(_pane_target "$CHIEF_PANE")
      if [ -n "$CHIEF_TARGET" ]; then
        # Wake chief-of-staff
        WORKER_NAMES=$(echo "$WORKERS" | awk '{print $1}' | sort -u | tr '\n' ', ' | sed 's/, $//')
        tmux send-keys -t "$CHIEF_TARGET" "Merge trigger: $WORKER_NAMES"
        tmux send-keys -t "$CHIEF_TARGET" -H 0d
        echo "[merge-watchdog] Woke chief-of-staff: $WORKER_NAMES"
      fi
    fi
  fi

  sleep "$POLL_INTERVAL"
done
