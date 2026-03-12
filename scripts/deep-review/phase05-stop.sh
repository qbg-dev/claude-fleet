#!/usr/bin/env bash
# Phase 0.5 Stop hook — bridges REVIEW.md improver → review workers.
# Called by hook-engine.ts when the improver session stops.
# Exit 0 = allow stop (workers launched), Exit 2 = block stop.
set -euo pipefail

FLEET_DIR="${CLAUDE_FLEET_DIR:-$HOME/.claude-fleet}"

# Resolve session dir
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_DIR_FILE="${SCRIPT_DIR}/session-dir.txt"
if [ ! -f "$SESSION_DIR_FILE" ]; then
  echo "ERROR: session-dir.txt not found next to stop hook script" >&2
  exit 0
fi
SESSION_DIR="$(cat "$SESSION_DIR_FILE")"

# Phase 0.5 output is optional — original REVIEW.md is fine as fallback
# No blocking needed even if output is missing

# Extract tmux session name from pipeline state (for visible window)
TMUX_SESSION=""
if [ -f "$SESSION_DIR/pipeline-state.json" ]; then
  TMUX_SESSION="$(python3 -c "import json; print(json.load(open('$SESSION_DIR/pipeline-state.json'))['ctx']['reviewSession'])" 2>/dev/null || true)"
fi

# Launch worker bridge in a visible tmux window (or fall back to background)
BRIDGE_CMD="bun '$FLEET_DIR/cli/lib/deep-review/pipeline-bridge.ts' phase05-to-workers '$SESSION_DIR' 2>&1 | tee -a '$SESSION_DIR/bridge-phase05.log'"
if [ -n "$TMUX_SESSION" ] && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  tmux new-window -d -t "$TMUX_SESSION" -n "bridge" bash -c "$BRIDGE_CMD; echo ''; echo '[bridge] Done. Press Enter to close.'; read" &
else
  nohup bash -c "$BRIDGE_CMD" &
fi

exit 0  # allow stop
