#!/usr/bin/env bash
# worker-prompt-notify.sh — Notify parent module manager when the operator types into a worker pane.
# Triggered by "prompt" event. Only fires when harness field is a worker (canonical contains "/").
# Side-effect receives PROJECT_ROOT as env var from event-bus.sh.
set -euo pipefail

payload=$(cat)

harness=$(echo "$payload" | jq -r '.harness // ""' 2>/dev/null || echo "")
[ -z "$harness" ] && exit 0

# Only fire for workers — harness canonical contains "/" (e.g. "hq-v3/ui-patrol")
[[ "$harness" != */* ]] && exit 0

pr="${PROJECT_ROOT:-}"
[ -z "$pr" ] && exit 0

_parent="${harness%/*}"   # e.g. "hq-v3" from "hq-v3/ui-patrol"
_worker="${harness##*/}"  # e.g. "ui-patrol"

ts=$(echo "$payload" | jq -r '.metadata.timestamp // ._ts // ""' 2>/dev/null || date -Iseconds)
prompt=$(echo "$payload" | jq -r '.prompt // ""' 2>/dev/null || echo "")
preview=$(echo "$prompt" | head -c 200)

notify_msg=$(jq -nc \
  --arg ts "$ts" \
  --arg from "$harness" \
  --arg worker "$_worker" \
  --arg preview "$preview" \
  '{"ts":$ts,"from":$from,"type":"worker-user-prompt","content":"⚠️ Operator sent a direct message to worker \($worker): \"\($preview)\""}' \
  2>/dev/null || true)

[ -z "$notify_msg" ] && exit 0

for _dir in module-manager sidecar; do
  _inbox="$pr/.claude/harness/$_parent/agents/$_dir/inbox.jsonl"
  if [ -f "$_inbox" ] || [ -d "$(dirname "$_inbox")" ]; then
    echo "$notify_msg" >> "$_inbox" 2>/dev/null || true
    break
  fi
done
