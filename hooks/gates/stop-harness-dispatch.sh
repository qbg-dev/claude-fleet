#!/usr/bin/env bash
# stop-harness-dispatch.sh — Unified stop hook dispatcher for multi-harness sessions.
#
# Routes each Claude session to its assigned harness based on a registry file.
# Sessions not registered in the registry pass through (stop-session.sh handles naming + code review).
#
# Uses unified task graph schema (.tasks with blockedBy/owner) for ALL harnesses.
# Modules: dispatch/harness-{gates,gc,rotation,discovery}.sh
# Shared functions: lib/harness-jq.sh (hook_find_own_pane, hook_resolve_harness, hook_block, etc.)
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# ── GC configs ──
GC_THROTTLE_SEC="${GC_THROTTLE_SEC:-60}"
# ── Discovery configs ──
AGENT_DISCOVERY_ENABLED="${AGENT_DISCOVERY_ENABLED:-true}"
ROTATION_LOCK_CLEANUP_SEC="${ROTATION_LOCK_CLEANUP_SEC:-60}"
source "$HOME/.boring/lib/harness-jq.sh"
source "$HOME/.boring/lib/event-bus.sh" 2>/dev/null || true

# Source modules
source "$HOME/.boring/hooks/dispatch/harness-gates.sh"
source "$HOME/.boring/hooks/dispatch/harness-gc.sh"
source "$HOME/.boring/hooks/dispatch/harness-rotation.sh"
source "$HOME/.boring/hooks/dispatch/harness-discovery.sh"
source "$HOME/.boring/hooks/dispatch/harness-bg-tasks.sh"

# Lightweight stop-hook logger (separate from watchdog.log to avoid noise)
_log_watchdog() { echo "[$(date -u +%FT%TZ)] stop-hook: $*" >> "${HOME}/.boring/state/watchdog.log" 2>/dev/null || true; }

INPUT=$(cat)

# Parse session ID via shared function (replaces python3)
hook_parse_input "$INPUT"
SESSION_ID="$_HOOK_SESSION_ID"
[ -z "$SESSION_ID" ] && { hook_pass; exit 0; }

# Compute session dir once (used throughout)
_SESSION_DIR=$(harness_session_dir "$SESSION_ID")

# Skip if echo chain is active
[ -f "$_SESSION_DIR/echo-state.json" ] && { hook_pass; exit 0; }

# Escape hatch (per-session)
[ -f "$_SESSION_DIR/allow-stop" ] && { hook_pass; exit 0; }

# Find own pane + skip monitor sessions
OWN_PANE_ID=$(hook_find_own_pane 2>/dev/null || echo "")
if [ -n "$OWN_PANE_ID" ]; then
  PANE_TITLE=$(tmux display-message -t "$OWN_PANE_ID" -p '#{pane_title}' 2>/dev/null || echo "")
  if [[ "$PANE_TITLE" == MONITOR* ]]; then
    hook_pass; exit 0
  fi
fi

# Resolve harness via shared 3-tier lookup (replaces 16-line inline detection)
hook_resolve_harness "$OWN_PANE_ID" "$SESSION_ID"

# Patch session_id into pane-registry so watchdog can locate graceful-stop sentinel
if [ -n "${OWN_PANE_ID:-}" ] && [ -n "${SESSION_ID:-}" ] && [ -f "$PANE_REGISTRY" ]; then
  PANE_REGISTRY="$PANE_REGISTRY" OWN_PANE_ID="$OWN_PANE_ID" SESSION_ID="$SESSION_ID" \
  python3 -c "import json, os
try:
    reg_path = os.environ['PANE_REGISTRY']
    pane_id = os.environ['OWN_PANE_ID']
    sess_id = os.environ['SESSION_ID']
    reg = json.load(open(reg_path))
    if pane_id in reg:
        reg[pane_id]['session_id'] = sess_id
        json.dump(reg, open(reg_path, 'w'), indent=2)
except: pass
" 2>/dev/null || true
fi
export CLAUDE_SESSION_ID="${SESSION_ID:-}"

# Run throttled GC
run_gc

# ═══════════════════════════════════════════════════════════════
# GENERIC BLOCK — works for ALL harnesses using unified task graph
# ═══════════════════════════════════════════════════════════════
block_generic() {
  local PROGRESS="$1"

  # ── Guards (V3 + V2 compat) ──
  # PROGRESS path is used for dirname → harness dir (works even if file deleted in v3).
  # V3: config.json and state.json replace progress.json.
  # V2 compat: fall back to reading progress.json directly.
  local _HDIR; _HDIR=$(dirname "$PROGRESS")
  # Resolve coordinator dir: module-manager (current) or sidecar (legacy)
  local _AGENT_DIR
  if [ -d "$_HDIR/agents/module-manager" ]; then
    _AGENT_DIR="$_HDIR/agents/module-manager"
  else
    _AGENT_DIR="$_HDIR/agents/sidecar"
  fi
  local _CONFIG="$_AGENT_DIR/config.json"
  local _STATE="$_AGENT_DIR/state.json"

  # No v3 config AND no v2 progress → harness not set up, pass through
  if [ ! -f "$_CONFIG" ] && [ ! -f "$PROGRESS" ]; then
    hook_pass; exit 0
  fi

  # Read status: V3 from state.json, V2 from progress.json
  local STATUS="active"
  if [ -f "$_STATE" ]; then
    STATUS=$(jq -r '.status // "active"' "$_STATE" 2>/dev/null || echo "active")
  elif [ -f "$PROGRESS" ]; then
    STATUS=$(jq -r '.status // "inactive"' "$PROGRESS")
  fi
  [ "$STATUS" != "active" ] && { hook_pass; exit 0; }

  local HNAME=$(harness_name "$PROGRESS")
  # Use global CANONICAL from hook_resolve_harness (module/worker for workers, harness for top-level)
  local CANONICAL="${CANONICAL:-$HNAME}"

  local _BLOCK_RUNTIME=$(harness_runtime "$CANONICAL")
  if [ -f "$_BLOCK_RUNTIME/stop-flag" ]; then
    rm -f "$_BLOCK_RUNTIME/stop-flag"
    hook_pass; exit 0
  fi

  # ── Background task check (sleeping agents must not be stopped) ──
  check_bg_tasks "$CANONICAL" || true  # exits with hook_block if bg-task is alive

  # ── Lifecycle gate ──
  local _LIFECYCLE=$(harness_lifecycle "$PROGRESS")
  if [ "$_LIFECYCLE" = "bounded" ]; then
    local _CURRENT_TASK=$(harness_current_task "$PROGRESS")
    if [ "$_CURRENT_TASK" = "ALL_DONE" ]; then
      # Enforce MEMORY.md update + git checkpoint before stopping
      hook_block "$(echo -e "## ${HNAME}: All tasks complete — before stopping:\n\n1. Update MEMORY.md with key learnings (patterns, gotchas, decisions)\n2. Run git checkpoint: \`source ~/.boring/lib/event-bus.sh && bus_git_checkpoint \"auto: final — ${HNAME}\"\`\n\nThen stop — rotation handles session handoff if configured.\nEscape: touch ${_SESSION_DIR}/allow-stop")"
      check_rotation "$HNAME" "$PROGRESS" "$CANONICAL" && exit 0 || true
    fi
    # Tasks not done → fall through to hook_block
  else
    # Long-running: pass through cleanly.
    # hook_pass() writes graceful-stop sentinel; watchdog reads sleep_duration
    # from state.json and respawns after that interval.
    local _SLEEP_DUR
    _SLEEP_DUR=$(harness_sleep_duration "$CANONICAL")
    _log_watchdog "long-running stop: $CANONICAL (sleep_duration=${_SLEEP_DUR}s)"
    hook_pass
    exit 0
  fi

  # ── Task graph state ──
  local CURRENT=$(harness_current_task "$PROGRESS")
  local NEXT=$(harness_next_task "$PROGRESS")
  local DONE_COUNT=$(harness_done_count "$PROGRESS")
  local TOTAL=$(harness_total_count "$PROGRESS")
  local DESCRIPTION=$(harness_task_description "$PROGRESS" "$CURRENT")
  local MISSION=$(harness_mission "$PROGRESS")

  update_pane_status "$HNAME" "$CURRENT" "$DONE_COUNT" "$TOTAL"

  # ── Build status message ──
  local MSG="## ${HNAME}: ${DONE_COUNT}/${TOTAL} tasks complete.\n\n"
  [ -n "$MISSION" ] && MSG="${MSG}**Mission:** ${MISSION}\n"
  MSG="${MSG}**Current:** ${CURRENT}\n"
  [ -n "$DESCRIPTION" ] && MSG="${MSG}**Description:** ${DESCRIPTION}\n"
  MSG="${MSG}**Next:** ${NEXT}\n"
  if [ "$CURRENT" != "ALL_DONE" ]; then
    local WOULD_UNBLOCK=$(harness_would_unblock "$PROGRESS" "$CURRENT" 2>/dev/null || echo "")
    [ -n "$WOULD_UNBLOCK" ] && MSG="${MSG}**Completing ${CURRENT} unblocks:** ${WOULD_UNBLOCK}\n"
  fi

  # Wave progress display
  local WAVE_INFO=$(harness_wave_progress "$PROGRESS" 2>/dev/null || echo "")
  [ -n "$WAVE_INFO" ] && MSG="${MSG}**Wave:** ${WAVE_INFO}\n"

  # Wave gate — fires at wave boundary, injects evidence-backed report instructions
  local _SPEC_FILE=""
  [ -f "$PROJECT_ROOT/.claude/harness/${CANONICAL}/spec.md" ] && _SPEC_FILE=".claude/harness/${CANONICAL}/spec.md"
  local WAVE_GATE_MSG
  WAVE_GATE_MSG=$(check_wave_gate "$PROGRESS" "$HNAME" "$_SPEC_FILE" 2>/dev/null || echo "")
  [ -n "$WAVE_GATE_MSG" ] && MSG="${MSG}${WAVE_GATE_MSG}"

  # Blocked tasks
  local BLOCKED_INFO=$(jq -r '
    . as $root |
    [.tasks | to_entries[] | select(
      .value.status == "pending" and
      ((.value.blockedBy // []) | length) > 0 and
      ([(.value.blockedBy // [])[] as $dep | $root.tasks[$dep].status] | all(. == "completed") | not)
    ) |
      (.value.blockedBy // []) as $deps |
      [($deps[] | select($root.tasks[.].status != "completed"))] as $incomplete |
      "  \(.key) ← waiting on: \($incomplete | join(", "))"
    ] | if length > 0 then join("\n") else "" end
  ' "$PROGRESS" 2>/dev/null || echo "")
  [ -n "$BLOCKED_INFO" ] && MSG="${MSG}\n**Blocked tasks:**\n${BLOCKED_INFO}\n"

  # Context reference
  local HARNESS_MD_REL=".claude/harness/${CANONICAL}/harness.md"
  [ ! -f "$PROJECT_ROOT/.claude/harness/$CANONICAL/harness.md" ] && HARNESS_MD_REL="claude_files/${CANONICAL}-harness.md"
  MSG="${MSG}\nRead ${HARNESS_MD_REL} if context lost.\n"
  MSG="${MSG}Escape: touch ${_SESSION_DIR}/allow-stop"

  local OTHERS=$(other_harnesses_info "$HNAME")
  [ -n "$OTHERS" ] && MSG="${MSG}\n**Other active harnesses:**${OTHERS}\n"

  hook_block "$(echo -e "$MSG")"
}

# ═══════════════════════════════════════════════════════════════
# PROGRESS FILE RESOLUTION
# ═══════════════════════════════════════════════════════════════
resolve_progress_file() {
  local dispatch_name="$1"

  local manifest_path
  manifest_path=$(harness_progress_path "$dispatch_name" 2>/dev/null || echo "")
  if [ -n "$manifest_path" ] && [ -f "$manifest_path" ]; then
    echo "$manifest_path"
    return
  fi

  if [ -f "$PROJECT_ROOT/.claude/harness/${dispatch_name}/progress.json" ]; then
    echo "$PROJECT_ROOT/.claude/harness/${dispatch_name}/progress.json"
  else
    echo "$PROJECT_ROOT/claude_files/${dispatch_name}-progress.json"
  fi
}

case "$HARNESS" in
  "")
    # No harness — pass through. stop-session.sh handles naming + code review.
    hook_pass
    ;;
  none|skip)
    # Explicitly opted out of harness. stop-session.sh handles the rest.
    hook_pass
    ;;
  *)
    PFILE=$(resolve_progress_file "$HARNESS")
    if [ -f "$PFILE" ]; then
      block_generic "$PFILE"
    else
      echo "WARNING: No progress file for harness '$HARNESS' at $PFILE" >&2
      hook_pass
    fi
    ;;
esac
