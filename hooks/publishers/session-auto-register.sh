#!/usr/bin/env bash
# session-auto-register.sh — Register any Claude session with Fleet Mail.
#
# Fires on UserPromptSubmit. Fast and idempotent:
# - Skips subagents (they share parent's session)
# - Skips if already registered
# - Creates Fleet Mail account with session-based identity
# - Injects seed template + mission.md into context
set -uo pipefail
trap 'exit 0' ERR

INPUT=$(cat)

# Skip subagents — they share parent session
echo "$INPUT" | jq -e '.agent_id // empty' &>/dev/null && exit 0

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[ -z "$SESSION_ID" ] && exit 0

SESSION_DIR="$HOME/.claude/fleet/.sessions/$SESSION_ID"

# Idempotent: skip if already registered
[ -f "$SESSION_DIR/identity.json" ] && exit 0

# Register with Fleet Mail (non-blocking, best-effort)
if command -v fleet &>/dev/null; then
  fleet register --session-id "$SESSION_ID" --quiet 2>/dev/null || true
fi

exit 0
