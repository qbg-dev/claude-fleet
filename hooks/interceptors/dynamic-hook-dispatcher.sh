#!/usr/bin/env bash
# dynamic-hook-dispatcher.sh — Universal dynamic hook dispatcher for ALL events.
# Reads /tmp/claude-hooks-{WORKER}.json and applies matching hooks.
#
# For each event:
#   1. Check blocking hooks → if any pending, BLOCK the event
#   2. Collect inject hooks → merge and return as additionalContext
#   3. If no matches → pass through
#
# Condition matching (PreToolUse only):
#   - tool: exact tool name match
#   - file_glob: regex match on file_path (Edit/Write/Read)
#   - command_pattern: regex match on Bash command
#
# Subagent-aware: filters hooks by agent_id when present.
set -uo pipefail
trap 'echo "{}"; exit 0' ERR
exec 2>/dev/null

INPUT=$(cat)

source "$HOME/.claude-ops/lib/pane-resolve.sh" 2>/dev/null || true

# Parse core fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input | if type == "string" then fromjson else . end // {}' 2>/dev/null || echo "{}")
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")

[ -z "$EVENT" ] && { echo '{}'; exit 0; }

# Resolve worker name for hooks file
WORKER_NAME="${WORKER_NAME:-}"
if [ -z "$WORKER_NAME" ] && [ -n "$SESSION_ID" ]; then
  resolve_pane_and_harness "$SESSION_ID" 2>/dev/null || true
  if [[ "${HARNESS:-}" == worker/* ]]; then
    WORKER_NAME="${HARNESS#worker/}"
  fi
fi
[ -z "$WORKER_NAME" ] && WORKER_NAME="unknown"

# Read hooks file
_HF="/tmp/claude-hooks-${WORKER_NAME}.json"
[ ! -f "$_HF" ] && { echo '{}'; exit 0; }

# Extract file path + command for condition matching
_FILE=""
case "$TOOL_NAME" in
  Edit|Write|Read) _FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // ""' 2>/dev/null || echo "") ;;
esac
_CMD=""
[ "$TOOL_NAME" = "Bash" ] && _CMD=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null || echo "")

# Build agent_id filter: subagents see only their own hooks + unscoped hooks.
# Parent sees only unscoped hooks (agent_id == null).
_AID_FILTER=""
if [ -n "$AGENT_ID" ]; then
  _AID_FILTER='and (.agent_id == null or .agent_id == $aid)'
else
  _AID_FILTER='and (.agent_id == null)'
fi

# ── Check blocking hooks first ──
_BLOCK=$(jq -r --arg event "$EVENT" --arg tool "$TOOL_NAME" \
  --arg file "$_FILE" --arg cmd "$_CMD" --arg aid "$AGENT_ID" \
  "[.hooks[] | select(
    .event==\$event and .blocking==true and .completed==false
    ${_AID_FILTER}
  ) | select(
    (.condition == null) or
    ((.condition.tool == null or .condition.tool == \$tool) and
     (.condition.file_glob == null or (\$file | test(.condition.file_glob // \"^\$\"))) and
     (.condition.command_pattern == null or (\$cmd | test(.condition.command_pattern // \"^\$\"))))
  )] | if length > 0 then
    (map(\"  [\" + .id + \"] \" + .description) | join(\"\n\")) as \$list |
    \"## \" + (length | tostring) + \" pending blocking hook(s) for \" + \$event + \"\n\n\" + \$list + \"\n\nComplete each with complete_hook(id) before proceeding.\"
  else empty end" \
  "$_HF" 2>/dev/null || echo "")

if [ -n "$_BLOCK" ]; then
  jq -n --arg reason "$_BLOCK" '{"decision":"block","reason":$reason}'
  exit 0
fi

# ── Collect inject hooks ──
_INJECT=$(jq -r --arg event "$EVENT" --arg tool "$TOOL_NAME" \
  --arg file "$_FILE" --arg cmd "$_CMD" --arg aid "$AGENT_ID" \
  "[.hooks[] | select(
    .event==\$event and .blocking==false
    ${_AID_FILTER}
  ) | select(
    (.condition == null) or
    ((.condition.tool == null or .condition.tool == \$tool) and
     (.condition.file_glob == null or (\$file | test(.condition.file_glob // \"^\$\"))) and
     (.condition.command_pattern == null or (\$cmd | test(.condition.command_pattern // \"^\$\"))))
  )] | map(.content // .description) | join(\"\n- \")" \
  "$_HF" 2>/dev/null || echo "")

if [ -n "$_INJECT" ]; then
  jq -n --arg ctx "- ${_INJECT}" '{"additionalContext":$ctx}'
  exit 0
fi

echo '{}'
exit 0
