#!/usr/bin/env bash
# session-file-sync.sh — Sync session transcript to Fleet Mail server.
#
# Fires on UserPromptSubmit, throttled to every 5 minutes.
# Uploads the JSONL transcript as a blob and updates account metadata.
set -uo pipefail
trap 'exit 0' ERR

INPUT=$(cat)

# Skip subagents
echo "$INPUT" | jq -e '.agent_id // empty' &>/dev/null && exit 0

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[ -z "$SESSION_ID" ] && exit 0

SESSION_DIR="$HOME/.claude/fleet/.sessions/$SESSION_ID"

# Must be registered
[ -f "$SESSION_DIR/identity.json" ] || exit 0

# Throttle: only sync every 5 minutes
SYNC_STATE="$SESSION_DIR/.last-sync"
NOW=$(date +%s)
if [ -f "$SYNC_STATE" ]; then
  LAST=$(cat "$SYNC_STATE" 2>/dev/null || echo "0")
  DIFF=$((NOW - LAST))
  [ "$DIFF" -lt 300 ] && exit 0
fi

# Best-effort sync (non-blocking background)
if command -v fleet &>/dev/null; then
  fleet session sync --session-id "$SESSION_ID" 2>/dev/null &
  disown 2>/dev/null || true
  echo "$NOW" > "$SYNC_STATE"
fi

exit 0
