#!/usr/bin/env bash
# Phase 0 Stop hook — unblocks pre-created bridge-0 window via FIFO.
# Called by hook-engine.ts when the role designer session stops.
# Exit 0 = allow stop (bridge triggered), Exit 2 = block stop.
set -euo pipefail

# Resolve session dir from sidecar file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_DIR_FILE="${SCRIPT_DIR}/session-dir.txt"
if [ ! -f "$SESSION_DIR_FILE" ]; then
  echo "ERROR: session-dir.txt not found next to stop hook script" >&2
  exit 0  # allow stop — can't block without context
fi
SESSION_DIR="$(cat "$SESSION_DIR_FILE")"

# Validate Phase 0 output
if [ ! -f "$SESSION_DIR/roles.json" ]; then
  echo "Role designer did not produce roles.json — will use v1 fallback" >&2
  touch "$SESSION_DIR/roles-fallback"
fi

# Unblock bridge-0 FIFO (pre-created window is waiting on it)
FIFO="$SESSION_DIR/fifo-bridge-0"
if [ -p "$FIFO" ]; then
  echo "go" > "$FIFO"
  echo "[hook] Bridge-0 FIFO triggered"
else
  # Fallback: FIFO doesn't exist (v1 mode or window not pre-created)
  FLEET_DIR="${CLAUDE_FLEET_DIR:-$HOME/.claude-fleet}"
  echo "[hook] No FIFO at $FIFO, running bridge directly" >&2
  TMUX_SESSION=""
  if [ -f "$SESSION_DIR/pipeline-state.json" ]; then
    TMUX_SESSION="$(python3 -c "import json; print(json.load(open('$SESSION_DIR/pipeline-state.json'))['ctx']['reviewSession'])" 2>/dev/null || true)"
  fi
  BRIDGE_CMD="bun '$FLEET_DIR/cli/lib/deep-review/pipeline-bridge.ts' phase0-to-05 '$SESSION_DIR' 2>&1 | tee -a '$SESSION_DIR/bridge-0.log'"
  if [ -n "$TMUX_SESSION" ] && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-window -d -t "$TMUX_SESSION" -n "bridge-0" bash -c "$BRIDGE_CMD; echo ''; echo '[bridge] Done. Press Enter to close.'; read" &
  else
    nohup bash -c "$BRIDGE_CMD" &
  fi
fi

exit 0  # allow stop
