#!/usr/bin/env bash
# harness-bg-tasks.sh — Background sleep flag check for stop hook.
#
# Function:
#   check_bg_tasks CANONICAL  — blocks stop if sleeping flag+PID still alive.
#
# The old _inject_bg_sleep function has been removed (v3 migration 2026-02-27).
# Long-running agents now call hook_pass() which writes a graceful-stop sentinel.
# The watchdog daemon reads sleep_duration from state.json and respawns after that interval.
#
# Flag file: harness-runtime/{canonical}/sleeping   (canonical = "module/worker" or "harness")
# Format:    "{label}:{PID}:{ISO timestamp}"
# Readers:   block_generic() in stop-harness-dispatch.sh

# ── Check if a background sleep/task is still running ────────────
# Returns 0 if blocked (task alive), 1 if clear (task done/dead)
check_bg_tasks() {
  local CANONICAL="$1"
  local RUNTIME
  RUNTIME=$(harness_runtime "$CANONICAL" 2>/dev/null || echo "")
  [ -z "$RUNTIME" ] && return 1

  local SLEEP_FLAG="$RUNTIME/sleeping"
  [ -f "$SLEEP_FLAG" ] || return 1

  local SLEEP_INFO
  SLEEP_INFO=$(cat "$SLEEP_FLAG" 2>/dev/null || echo "")
  [ -z "$SLEEP_INFO" ] && { rm -f "$SLEEP_FLAG"; return 1; }

  local label pid ts
  label=$(echo "$SLEEP_INFO" | cut -d: -f1)
  pid=$(echo "$SLEEP_INFO" | cut -d: -f2)
  ts=$(echo "$SLEEP_INFO" | cut -d: -f3-)

  # Check if PID is alive
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    hook_block "**${CANONICAL}** is sleeping (${label} started ${ts:-unknown}, pid ${pid}). Will wake automatically when done."
    exit 0
  else
    # PID dead — stale flag, clean up
    rm -f "$SLEEP_FLAG"
    echo "Cleaned stale sleeping flag for $CANONICAL (pid $pid dead)" >&2
    return 1
  fi
}


