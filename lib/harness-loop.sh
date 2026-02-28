#!/usr/bin/env bash
# harness-loop.sh — Auto-resume loop for harnesses.
#
# For BOUNDED harnesses: runs Claude once and exits.
# For LONG-RUNNING harnesses: runs Claude, waits 30 min after exit, re-launches.
#
# Environment (set by harness-launch.sh before invoking):
#   CLAUDE_CMD     — claude command (e.g. "cdo" or full path)
#   HARNESS        — harness name
#   PROJECT_ROOT   — project root path
#
# The FIRST iteration's seed is sent by harness-launch.sh via tmux send-keys.
# Subsequent iterations generate and inject their own seed.
set -euo pipefail

CLAUDE_CMD="${CLAUDE_CMD:?CLAUDE_CMD must be set}"
HARNESS="${HARNESS:?HARNESS must be set}"
PROJECT_ROOT="${PROJECT_ROOT:?PROJECT_ROOT must be set}"

# Resolve common aliases (cdo/cds/cdh/cdoc/cdsc/cdo1m/cds1m) to full commands.
# These are zsh aliases not available in bash scripts.
_resolve_claude_cmd() {
  local cmd="$1"
  local base="claude --dangerously-skip-permissions"
  case "$cmd" in
    cdo)    echo "$base --model opus" ;;
    cds)    echo "$base --model sonnet" ;;
    cdh)    echo "$base --model haiku" ;;
    cdoc)   echo "$base --model opus --chrome" ;;
    cdsc)   echo "$base --model sonnet --chrome" ;;
    cdo1m)  echo "$base --model 'opus[1m]'" ;;
    cds1m)  echo "$base --model 'sonnet[1m]'" ;;
    *)      echo "$cmd" ;;
  esac
}
CLAUDE_CMD=$(_resolve_claude_cmd "$CLAUDE_CMD")
PROGRESS="$PROJECT_ROOT/.claude/harness/$HARNESS/progress.json"
SEED_SCRIPT="$PROJECT_ROOT/.claude/scripts/${HARNESS}-seed.sh"
RESUME_DELAY="${HARNESS_RESUME_DELAY:-1800}"  # 30 minutes
STOP_FLAG="$HOME/.boring/state/harness-runtime/$HARNESS/stop-flag"

# Source shared library for hook_find_own_pane + hook_pane_target
source "$HOME/.boring/lib/harness-jq.sh" 2>/dev/null || true

# Find own pane (this script runs IN the harness tmux pane)
_OWN_PANE_ID=$(hook_find_own_pane 2>/dev/null || echo "")
OWN_PANE=$(hook_pane_target "$_OWN_PANE_ID" 2>/dev/null || echo "")

# Inject seed prompt via tmux send-keys (for iterations > 1)
inject_seed() {
  local seed
  seed=$(bash "$SEED_SCRIPT" 2>/dev/null)
  if [ -z "$seed" ]; then
    echo "ERROR: Seed script produced empty output" >&2
    return 1
  fi

  # Wait for Claude to be ready (poll for any readiness indicator)
  for i in $(seq 1 45); do
    sleep 2
    if tmux capture-pane -t "$OWN_PANE" -p 2>/dev/null | grep -qE "bypass permissions|permission mode|What can I help|Tips for|/help"; then
      tmux send-keys -t "$OWN_PANE" -l "$seed"
      sleep 0.5
      tmux send-keys -t "$OWN_PANE" Enter
      echo "[harness-loop] Seed injected (~$((i*2))s, $(echo "$seed" | wc -c | tr -d ' ') bytes)"
      return 0
    fi
  done
  echo "WARN: Claude didn't load in 90s — seed not injected" >&2
  return 1
}

# Update progress.json for new session (delegates to shared harness_bump_session)
bump_session() {
  harness_bump_session "$PROGRESS"
}

# Record session start/end in agent workspace (identity-aware)
record_session() {
  local action="$1"  # "start" or "end"
  local agent_dir=""
  # Find agent workspace: try sidecar, then coordinator
  for slot in sidecar coordinator; do
    local candidate="$PROJECT_ROOT/.claude/harness/$HARNESS/agents/$slot"
    if [ -d "$candidate" ]; then
      agent_dir="$candidate"
      break
    fi
  done
  [ -z "$agent_dir" ] && return 0

  local sessions_file="$agent_dir/sessions.jsonl"
  local id_file="$agent_dir/identity.json"

  if [ "$action" = "start" ]; then
    echo "{\"action\":\"start\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"iteration\":$iteration}" >> "$sessions_file" 2>/dev/null
  else
    echo "{\"action\":\"end\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"iteration\":$iteration}" >> "$sessions_file" 2>/dev/null
    # Increment total_sessions in identity.json
    if [ -f "$id_file" ]; then
      local tmp; tmp=$(mktemp)
      jq '.total_sessions = (.total_sessions // 0) + 1' "$id_file" > "$tmp" && mv "$tmp" "$id_file"
    fi
  fi
}

iteration=0
while true; do
  iteration=$((iteration + 1))

  # For iterations > 1, inject seed from background
  # (iteration 1's seed is sent by harness-launch.sh)
  if [ "$iteration" -gt 1 ]; then
    bump_session
    record_session "start"

    # Re-read model from identity.json for re-launch (may have been updated)
    for _slot in sidecar coordinator; do
      _id_file="$PROJECT_ROOT/.claude/harness/$HARNESS/agents/$_slot/identity.json"
      if [ -f "$_id_file" ]; then
        _id_model=$(jq -r '.model // empty' "$_id_file" 2>/dev/null)
        if [ -n "$_id_model" ]; then
          CLAUDE_CMD=$(_resolve_claude_cmd "$_id_model")
        fi
        break
      fi
    done

    ( sleep 5; inject_seed ) &
    SEED_PID=$!
  fi

  # Run Claude (blocks until Claude exits)
  eval "$CLAUDE_CMD"

  # Record session end in agent workspace
  record_session "end"

  # Wait for any background seed injection to finish
  if [ "$iteration" -gt 1 ] && [ -n "${SEED_PID:-}" ]; then
    wait "$SEED_PID" 2>/dev/null || true
  fi

  # Check lifecycle — bounded harnesses exit immediately
  # v3: config.json is the source of truth; fall back to progress.json for legacy
  _hdir="$(dirname "$PROGRESS")"
  if [ -d "$_hdir/agents/module-manager" ]; then
    config_file="$_hdir/agents/module-manager/config.json"
  else
    config_file="$_hdir/agents/sidecar/config.json"
  fi
  LIFECYCLE=$(jq -r '.lifecycle // "bounded"' "$config_file" 2>/dev/null \
    || jq -r '.lifecycle // "bounded"' "$PROGRESS" 2>/dev/null \
    || echo "bounded")
  if [ "$LIFECYCLE" != "long-running" ]; then
    break
  fi

  # Check stop flag
  if [ -f "$STOP_FLAG" ]; then
    rm -f "$STOP_FLAG"
    echo "Stop flag found — exiting loop."
    break
  fi

  # Auto-resume countdown
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  $HARNESS: Agent paused."
  echo "  Auto-resuming in $((RESUME_DELAY / 60)) minutes."
  echo "  Ctrl+C to stop permanently."
  echo "  Or: touch $STOP_FLAG"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  # Interruptible sleep
  sleep "$RESUME_DELAY" || {
    echo "Interrupted — exiting loop."
    break
  }

  # Re-check stop flag after sleep
  if [ -f "$STOP_FLAG" ]; then
    rm -f "$STOP_FLAG"
    echo "Stop flag found after sleep — exiting loop."
    break
  fi

  echo "[harness-loop] Auto-resuming $HARNESS (iteration $((iteration + 1)))..."
done

echo "[harness-loop] $HARNESS loop exited after $iteration iteration(s)."
