#!/usr/bin/env bash
# hook-engine.sh — Unified dynamic hook dispatch with script execution.
# Registered on ALL events. Reads dynamic hooks from per-worker hooks dir
# and applies block/inject/script decisions.
#
# Hook storage (new): ~/.claude/fleet/{project}/{worker}/hooks/hooks.json
# Hook storage (legacy): ~/.claude/ops/hooks/dynamic/{worker}.json
# Script files: ~/.claude/fleet/{project}/{worker}/hooks/{id}-{slug}.sh
#
# Output protocol:
#   Block:  {"decision":"block","reason":"..."}
#   Inject: {"additionalContext":"..."}
#   Pass:   {}
#
# Script exit codes (Claude Code convention):
#   0 = allow (pass through)
#   2 = block (stderr shown as reason)
#   1 = error (logged internally, non-blocking failure)
#
# Fail-open: any error → {} (never accidentally block)
set -uo pipefail
trap 'echo "{}"; exit 0' ERR

# ── Read input ──────────────────────────────────────────────────
INPUT=$(cat)

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || echo "")
[ -z "$EVENT" ] && { echo '{}'; exit 0; }

# Worker identity — no worker means no dynamic hooks to check
WORKER="${WORKER_NAME:-}"
[ -z "$WORKER" ] && { echo '{}'; exit 0; }

# ── Resolve hooks file (new layout > legacy) ──────────────────
_FLEET_DIR="$HOME/.claude/fleet"
_HOOKS_DIR=""
_HOOKS_FILE=""

# Try to detect project name from PROJECT_ROOT or cwd
_PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
_PROJECT_NAME=$(basename "$_PROJECT_ROOT" | sed 's/-w-.*$//')

# New layout: ~/.claude/fleet/{project}/{worker}/hooks/hooks.json
_NEW_HOOKS_DIR="$_FLEET_DIR/$_PROJECT_NAME/$WORKER/hooks"
_NEW_HOOKS_FILE="$_NEW_HOOKS_DIR/hooks.json"

# Legacy layout: ~/.claude/ops/hooks/dynamic/{worker}.json
_LEGACY_DIR="${CLAUDE_HOOKS_DIR:-$HOME/.claude/ops/hooks/dynamic}"
_LEGACY_FILE="$_LEGACY_DIR/${WORKER}.json"

if [ -f "$_NEW_HOOKS_FILE" ]; then
  _HOOKS_DIR="$_NEW_HOOKS_DIR"
  _HOOKS_FILE="$_NEW_HOOKS_FILE"
elif [ -f "$_LEGACY_FILE" ]; then
  _HOOKS_DIR="$_LEGACY_DIR"
  _HOOKS_FILE="$_LEGACY_FILE"
else
  echo '{}'; exit 0
fi

# Parse identity
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // "{}"' 2>/dev/null || echo "{}")
IS_SUBAGENT=false
[ -n "$AGENT_ID" ] && IS_SUBAGENT=true

# ── SubagentStop: auto-complete hooks scoped to this agent ──────
if [ "$EVENT" = "SubagentStop" ] && [ -n "$AGENT_ID" ]; then
  _NOW=$(date -Iseconds 2>/dev/null || date -u +%FT%TZ)
  _UPDATED=$(jq --arg aid "$AGENT_ID" --arg now "$_NOW" \
    '.hooks = [.hooks[] | if (.agent_id == $aid and .completed == false) then .completed = true | .completed_at = $now | .result = "auto-completed: subagent stopped" else . end]' \
    "$_HOOKS_FILE" 2>/dev/null || echo "")
  if [ -n "$_UPDATED" ]; then
    echo "$_UPDATED" > "$_HOOKS_FILE" 2>/dev/null || true
  fi
fi

# ── Filter hooks matching this event ────────────────────────────
# Subagents see: hooks scoped to their agent_id + unscoped hooks
# Parent sees: unscoped hooks only
if [ "$IS_SUBAGENT" = "true" ]; then
  MATCHING=$(jq --arg ev "$EVENT" --arg aid "$AGENT_ID" \
    '[.hooks[] | select(.event == $ev and .completed == false and (.agent_id == $aid or .agent_id == null or .agent_id == ""))]' \
    "$_HOOKS_FILE" 2>/dev/null || echo "[]")
else
  MATCHING=$(jq --arg ev "$EVENT" \
    '[.hooks[] | select(.event == $ev and .completed == false and (.agent_id == null or .agent_id == ""))]' \
    "$_HOOKS_FILE" 2>/dev/null || echo "[]")
fi

COUNT=$(echo "$MATCHING" | jq 'length' 2>/dev/null || echo "0")
[ "$COUNT" -eq 0 ] && { echo '{}'; exit 0; }

# ── Condition matching (for PreToolUse/PostToolUse) ─────────────
_matches_condition() {
  local hook_json="$1"
  local cond
  cond=$(echo "$hook_json" | jq -r '.condition // empty' 2>/dev/null || echo "")
  [ -z "$cond" ] && return 0  # No condition = always matches

  # Tool name match
  local cond_tool
  cond_tool=$(echo "$hook_json" | jq -r '.condition.tool // empty' 2>/dev/null || echo "")
  if [ -n "$cond_tool" ] && [ -n "$TOOL_NAME" ]; then
    [ "$TOOL_NAME" != "$cond_tool" ] && return 1
  fi

  # File glob match
  local cond_glob
  cond_glob=$(echo "$hook_json" | jq -r '.condition.file_glob // empty' 2>/dev/null || echo "")
  if [ -n "$cond_glob" ]; then
    local file_path
    file_path=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // .command // ""' 2>/dev/null || echo "")
    if [ -n "$file_path" ]; then
      # Use bash pattern matching
      [[ "$file_path" != $cond_glob ]] && return 1
    fi
  fi

  # Command pattern match (regex)
  local cond_cmd
  cond_cmd=$(echo "$hook_json" | jq -r '.condition.command_pattern // empty' 2>/dev/null || echo "")
  if [ -n "$cond_cmd" ]; then
    local cmd_str
    cmd_str=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null || echo "")
    if [ -n "$cmd_str" ]; then
      echo "$cmd_str" | grep -qE "$cond_cmd" || return 1
    fi
  fi

  return 0
}

# ── Script execution ─────────────────────────────────────────────
# Runs a hook script file with env vars. Returns exit code.
# Exit 0 = allow, 2 = block (stderr captured), 1 = error (logged)
_run_hook_script() {
  local hook_json="$1"
  local script_rel
  script_rel=$(echo "$hook_json" | jq -r '.script_path // empty' 2>/dev/null || echo "")
  [ -z "$script_rel" ] && return 0

  local script_file="$_HOOKS_DIR/$script_rel"
  [ ! -f "$script_file" ] && return 0

  # Permission scan: re-check denyList at execution time
  # Source fleet-jq.sh for scan_script_against_denylist
  local _FLEET_JQ
  _FLEET_JQ="${TMUX_AGENTS_DIR:-${CLAUDE_OPS_DIR:-$HOME/.tmux-agents}}/lib/fleet-jq.sh"
  if [ -f "$_FLEET_JQ" ]; then
    source "$_FLEET_JQ" 2>/dev/null || true
    if type scan_script_against_denylist &>/dev/null; then
      # Find permissions.json
      local _PERMS="${PROJECT_ROOT:-.}/.claude/workers/$WORKER/permissions.json"
      if [ -f "$_PERMS" ]; then
        local _SCAN_RESULT
        _SCAN_RESULT=$(scan_script_against_denylist "$script_file" "$_PERMS")
        if [ $? -ne 0 ]; then
          echo "[hook-engine] Script blocked at execution time: $_SCAN_RESULT" >&2
          return 1
        fi
      fi
    fi
  fi

  local hook_id
  hook_id=$(echo "$hook_json" | jq -r '.id // "?"' 2>/dev/null || echo "?")
  local is_blocking
  is_blocking=$(echo "$hook_json" | jq -r '.blocking // false' 2>/dev/null || echo "false")

  if [ "$is_blocking" = "true" ]; then
    # Blocking: run synchronously, capture exit code and stderr
    local _stderr_file
    _stderr_file=$(mktemp)
    WORKER_NAME="$WORKER" HOOK_EVENT="$EVENT" HOOK_ID="$hook_id" PROJECT_ROOT="${PROJECT_ROOT:-}" \
      bash "$script_file" 2>"$_stderr_file"
    local _exit=$?
    local _stderr
    _stderr=$(cat "$_stderr_file" 2>/dev/null | head -c 500)
    rm -f "$_stderr_file"
    # Exit 2 = block, populate SCRIPT_BLOCK_REASON
    if [ "$_exit" -eq 2 ] && [ -n "$_stderr" ]; then
      SCRIPT_BLOCK_REASON="$_stderr"
    fi
    return $_exit
  else
    # Non-blocking: run in background
    WORKER_NAME="$WORKER" HOOK_EVENT="$EVENT" HOOK_ID="$hook_id" PROJECT_ROOT="${PROJECT_ROOT:-}" \
      bash "$script_file" &>/dev/null &
    return 0
  fi
}

# ── Process matching hooks ──────────────────────────────────────
BLOCK_REASONS=""
INJECT_CONTEXTS=""
SCRIPT_BLOCK_REASON=""

for i in $(seq 0 $((COUNT - 1))); do
  HOOK=$(echo "$MATCHING" | jq ".[$i]" 2>/dev/null || echo "{}")

  # Check condition matching for tool events
  if [[ "$EVENT" == "PreToolUse" || "$EVENT" == "PostToolUse" ]]; then
    _matches_condition "$HOOK" || continue
  fi

  IS_BLOCKING=$(echo "$HOOK" | jq -r '.blocking // false' 2>/dev/null || echo "false")
  HOOK_ID=$(echo "$HOOK" | jq -r '.id // "?"' 2>/dev/null || echo "?")
  DESC=$(echo "$HOOK" | jq -r '.description // "dynamic hook"' 2>/dev/null || echo "dynamic hook")
  CONTENT=$(echo "$HOOK" | jq -r '.content // .description // ""' 2>/dev/null || echo "")
  HAS_SCRIPT=$(echo "$HOOK" | jq -r '.script_path // empty' 2>/dev/null || echo "")

  # Run script if present
  if [ -n "$HAS_SCRIPT" ]; then
    SCRIPT_BLOCK_REASON=""
    _run_hook_script "$HOOK"
    _SCRIPT_EXIT=$?
    if [ "$_SCRIPT_EXIT" -eq 2 ]; then
      # Script says block — use stderr as reason
      local_reason="${SCRIPT_BLOCK_REASON:-Script $HAS_SCRIPT exited with code 2}"
      BLOCK_REASONS="${BLOCK_REASONS}  [${HOOK_ID}] ${DESC} — ${local_reason}\n"
      continue
    elif [ "$_SCRIPT_EXIT" -eq 1 ]; then
      # Script error — log and continue (non-blocking failure)
      continue
    fi
    # Exit 0 = allow — fall through to normal gate/inject logic
  fi

  if [ "$IS_BLOCKING" = "true" ]; then
    BLOCK_REASONS="${BLOCK_REASONS}  [${HOOK_ID}] ${DESC}\n"
  elif [ -n "$CONTENT" ]; then
    INJECT_CONTEXTS="${INJECT_CONTEXTS}${CONTENT}\n"
  fi
done

# ── Emit decision ──────────────────────────────────────────────
# Blocking takes priority (PreToolUse and Stop can block; PostToolUse cannot)
if [ -n "$BLOCK_REASONS" ] && [ "$EVENT" != "PostToolUse" ]; then
  # Stop hook infinite loop guard
  if [ "$EVENT" = "Stop" ] && [ "${STOP_HOOK_ACTIVE:-}" = "true" ]; then
    echo '{}'; exit 0
  fi

  PENDING_COUNT=$(echo -e "$BLOCK_REASONS" | grep -c '\[' || echo "0")
  REASON=$(printf '## %s pending blocking hook(s)\n\n%b\nComplete each with complete_hook(id) before proceeding.' "$PENDING_COUNT" "$BLOCK_REASONS")
  # Use -c (compact) to prevent Apple jq from emitting literal newlines in string values
  jq -cn --arg reason "$REASON" '{"decision":"block","reason":$reason}'
  exit 0
fi

# Inject context if any non-blocking hooks matched
if [ -n "$INJECT_CONTEXTS" ]; then
  CTX=$(printf '%b' "$INJECT_CONTEXTS" | head -c 2000)
  jq -cn --arg ctx "$CTX" '{"additionalContext":$ctx}'
  exit 0
fi

echo '{}'
exit 0
