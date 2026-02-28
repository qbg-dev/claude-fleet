#!/usr/bin/env bash
# harness-rotation.sh — Module: context-aware session rotation.
# Sourced by stop-harness-dispatch.sh. Requires: harness-jq.sh, _SESSION_DIR, SESSION_ID.
#
# Modes: none → allow stop cleanly. new_session → spawn fresh session via handoff.sh.

# Returns 0 (should exit/allow stop) or 1 (continue blocking normally).
check_rotation() {
  local HARNESS_NAME="$1"
  local PROGRESS="$2"
  local CANONICAL="$3"

  local MODE
  MODE=$(jq -r '.rotation.mode // "none"' "$PROGRESS" 2>/dev/null || echo "none")
  [ "$MODE" = "none" ] && return 1

  # Rotate: spawn fresh session
  local _RUNTIME
  _RUNTIME=$(harness_runtime "$CANONICAL")
  local ROTATE_LOCK="$_SESSION_DIR/rotate-lock"
  if ! mkdir "$ROTATE_LOCK" 2>/dev/null; then
    echo "Rotation already in progress for $SESSION_ID — skipping" >&2
    echo '{}'; exit 0
  fi
  touch "$_SESSION_DIR/allow-stop"
  echo "{\"harness\":\"$CANONICAL\",\"session_id\":\"$SESSION_ID\"}" \
    > "$_SESSION_DIR/rotate-signal"
  bash "$HOME/.claude-ops/lib/handoff.sh" --rotate "$SESSION_ID" &
  ( sleep "${ROTATION_LOCK_CLEANUP_SEC:-60}"; rmdir "$ROTATE_LOCK" 2>/dev/null || true ) &
  echo '{}'; exit 0
}
