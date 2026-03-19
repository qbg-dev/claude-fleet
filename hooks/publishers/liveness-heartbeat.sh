#!/usr/bin/env bash
# liveness-heartbeat.sh — Touch a timestamp file on every hook fire.
# Registered on ALL hook events so the watchdog has a reliable
# "last activity" signal without parsing scrollback.
#
# Worker identity resolution: matches current tmux pane_id against
# ~/.claude/fleet/{project}/{worker}/state.json — same source of truth
# as the statusline. Does NOT rely on WORKER_NAME env var.
#
# File: ~/.claude-fleet/state/watchdog-runtime/{worker}/liveness
# Contains: epoch timestamp of last activity

# ── Resolve worker name (cached per-process) ──
# Cache file keyed by PID so each Claude session resolves once
_CACHE_DIR="${HOME}/.claude-fleet/state/heartbeat-cache"
_CACHE_FILE="${_CACHE_DIR}/${PPID:-$$}"
WORKER=""

if [ -f "$_CACHE_FILE" ]; then
  WORKER=$(cat "$_CACHE_FILE" 2>/dev/null)
else
  # Method 1: WORKER_NAME env var (set by fleet create/watchdog)
  WORKER="${WORKER_NAME:-}"

  # Method 2: Resolve from fleet state.json by pane_id (same as statusline)
  if [ -z "$WORKER" ]; then
    # Resolve current pane_id by walking PPID chain to a tmux pane
    _pane_id=$(tmux list-panes -a -F '#{pane_pid} #{pane_id}' 2>/dev/null | while read pid id; do
      p=$$; while [ "$p" -gt 1 ]; do
        [ "$p" = "$pid" ] && echo "$id" && break 2
        p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
      done
    done)

    if [ -n "$_pane_id" ] && [ -d "$HOME/.claude/fleet" ]; then
      _fw_state=$(grep -rl "\"${_pane_id}\"" "$HOME/.claude/fleet"/*/*/state.json 2>/dev/null | head -1)
      if [ -n "$_fw_state" ]; then
        _fw_pid=$(jq -r '.pane_id // empty' "$_fw_state" 2>/dev/null)
        if [ "$_fw_pid" = "$_pane_id" ]; then
          WORKER=$(basename "$(dirname "$_fw_state")")
        fi
      fi
    fi

    # Method 3: Derive from git branch (worker/X → X)
    if [ -z "$WORKER" ]; then
      _branch=$(git branch --show-current 2>/dev/null)
      case "$_branch" in worker/*) WORKER="${_branch#worker/}" ;; esac
    fi
  fi

  # Cache the result (or empty string to skip future resolution)
  mkdir -p "$_CACHE_DIR" 2>/dev/null || true
  printf '%s' "$WORKER" > "$_CACHE_FILE" 2>/dev/null || true
fi

[ -z "$WORKER" ] && echo '{}' && exit 0

RUNTIME_DIR="${HOME}/.claude-fleet/state/watchdog-runtime/${WORKER}"
mkdir -p "$RUNTIME_DIR" 2>/dev/null || true

# Write epoch + optional subagent identity
INPUT=$(cat)
_AID=$(echo "$INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")
_ATYPE=$(echo "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
if [ -n "$_AID" ]; then
  printf '%s %s:%s\n' "$(date +%s)" "$_ATYPE" "$_AID" > "$RUNTIME_DIR/liveness"
else
  date +%s > "$RUNTIME_DIR/liveness"
fi
echo '{}'
exit 0
