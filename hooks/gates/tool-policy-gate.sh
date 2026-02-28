#!/usr/bin/env bash
# tool-policy-gate.sh — PreToolUse gate that blocks tools per agent permissions.json
#
# Reads disallowedTools from the calling agent's permissions.json and blocks
# matching tool calls. Pattern format:
#   "ToolName"              — blocks all uses of ToolName
#   "Bash(git push*)"      — blocks Bash commands matching glob
#   "Edit(src/**)"          — blocks Edit on files matching glob
#   "Write(data/**)"        — blocks Write on files matching glob
#
# This replaces --disallowedTools CLI flag with a centralized hook.
set -uo pipefail
trap 'echo "{}"; exit 0' ERR

source "$HOME/.claude-ops/lib/pane-resolve.sh"

INPUT=$(cat)
hook_parse_input "$INPUT"
SESSION_ID="$_HOOK_SESSION_ID"
TOOL_NAME="$_HOOK_TOOL_NAME"
TOOL_INPUT="$_HOOK_TOOL_INPUT"

# Resolve which agent is calling
resolve_pane_and_harness "$SESSION_ID"
[ -z "$HARNESS" ] && { echo '{}'; exit 0; }

# Determine permissions.json path from pane registry
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PANE_REG="${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/pane-registry.json"

AGENT_ROLE=$(jq -r --arg pid "$OWN_PANE_ID" '.[$pid].agent_role // "module-manager"' "$PANE_REG" 2>/dev/null || echo "module-manager")
PARENT=$(jq -r --arg pid "$OWN_PANE_ID" '.[$pid].parent // ""' "$PANE_REG" 2>/dev/null || echo "")

if [ "$AGENT_ROLE" = "worker" ] || [ "$AGENT_ROLE" = "module-manager" ] && [ -n "$PARENT" ] && [ "$PARENT" != "$HARNESS" ]; then
  # Worker: permissions at .claude/harness/{parent}/agents/worker/{name}/permissions.json
  PERMS="$PROJECT_ROOT/.claude/harness/$PARENT/agents/worker/$HARNESS/permissions.json"
else
  # Module manager: permissions at .claude/harness/{name}/agents/module-manager/permissions.json
  PERMS="$PROJECT_ROOT/.claude/harness/$HARNESS/agents/module-manager/permissions.json"
fi

[ ! -f "$PERMS" ] && { echo '{}'; exit 0; }

# Read disallowedTools array
DISALLOWED=$(jq -r '.disallowedTools // [] | .[]' "$PERMS" 2>/dev/null || true)
[ -z "$DISALLOWED" ] && { echo '{}'; exit 0; }

# Extract tool-specific arguments for matching
COMMAND=""
[ "$TOOL_NAME" = "Bash" ] && COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null || echo "")
FILE_PATH=""
case "$TOOL_NAME" in
  Edit|Write) FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // ""' 2>/dev/null || echo "") ;;
esac

while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue

  # Extract tool name and optional argument pattern
  PATTERN_TOOL="${pattern%%(*}"
  if [[ "$pattern" == *"("* ]]; then
    PATTERN_ARG="${pattern#*(}"
    PATTERN_ARG="${PATTERN_ARG%)}"
  else
    PATTERN_ARG=""
  fi

  # Check tool name match
  [ "$TOOL_NAME" != "$PATTERN_TOOL" ] && continue

  # If no arg pattern, block all uses of this tool
  if [ -z "$PATTERN_ARG" ]; then
    hook_block "Tool '$TOOL_NAME' blocked by policy for agent ${CANONICAL:-$HARNESS}"
    exit 0
  fi

  # Match argument pattern (glob-style)
  case "$TOOL_NAME" in
    Bash)
      # Convert glob to regex: escape dots, * → .*, ? → .
      REGEX=$(echo "$PATTERN_ARG" | sed 's/[.[\^$+{}|]/\\&/g; s/\*/.*/g; s/?/./g')
      if echo "$COMMAND" | grep -qE "^${REGEX}"; then
        hook_block "Command blocked by policy for agent ${CANONICAL:-$HARNESS}: $(echo "$COMMAND" | head -c 100)"
        exit 0
      fi
      ;;
    Edit|Write)
      # Convert glob to regex: ** = any path, * = single segment
      REGEX=$(echo "$PATTERN_ARG" | sed 's/[.[\^$+{}|]/\\&/g; s/\*\*/.*/g; s/\*/[^\/]*/g')
      if echo "$FILE_PATH" | grep -qE "(^|/)${REGEX}"; then
        hook_block "File path blocked by policy for agent ${CANONICAL:-$HARNESS}: $(basename "$FILE_PATH")"
        exit 0
      fi
      ;;
  esac
done <<< "$DISALLOWED"

# No match — allow
echo '{}'
