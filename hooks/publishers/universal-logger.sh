#!/usr/bin/env bash
# universal-logger.sh — Universal event logger for ALL hook events.
# Publishes standardized bus events for every hook invocation.
# Registered for all 18 events. Never blocks, never injects.
#
# Event bus topic: hook.{event_name} (lowercase, e.g. hook.pre_tool_use)
# Payload: session_id, event, tool_name (if applicable), agent_id (if subagent)
set -uo pipefail
trap 'echo "{}"; exit 0' ERR
exec 2>/dev/null

INPUT=$(cat)

source "$HOME/.claude-ops/lib/event-bus.sh" 2>/dev/null || { echo '{}'; exit 0; }
source "$HOME/.claude-ops/lib/pane-resolve.sh" 2>/dev/null || true

# Extract fields from hook input (works for ALL events)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")

[ -z "$SESSION_ID" ] && [ -z "$EVENT" ] && { echo '{}'; exit 0; }

# Resolve worker identity (best-effort, fast)
BUS_AGENT="main"
if [ -n "$SESSION_ID" ]; then
  resolve_pane_and_harness "$SESSION_ID" 2>/dev/null || true
  [ -n "${HARNESS:-}" ] && BUS_AGENT="$HARNESS"
fi

# Convert event name to bus topic: PreToolUse → hook.pre_tool_use
BUS_TOPIC="hook.$(echo "$EVENT" | sed 's/\([A-Z]\)/_\1/g' | sed 's/^_//' | tr '[:upper:]' '[:lower:]')"

# Build payload — include only non-empty fields
PAYLOAD=$(jq -n --compact-output \
  --arg agent "$BUS_AGENT" \
  --arg sid "$SESSION_ID" \
  --arg event "$EVENT" \
  --arg tool "$TOOL_NAME" \
  --arg aid "$AGENT_ID" \
  --arg atype "$AGENT_TYPE" \
  '{agent: $agent, session_id: $sid, event: $event} +
   (if $tool != "" then {tool: $tool} else {} end) +
   (if $aid != "" then {agent_id: $aid, agent_type: $atype} else {} end)' \
  2>/dev/null || echo '{}')

bus_publish "$BUS_TOPIC" "$PAYLOAD" 2>/dev/null || true

echo '{}'
exit 0
