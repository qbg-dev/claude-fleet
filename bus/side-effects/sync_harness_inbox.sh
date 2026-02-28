#!/usr/bin/env bash
# sync_harness_inbox.sh — Persist user prompt to harness inbox.jsonl + user/outbox.jsonl.
set -euo pipefail

payload=$(cat)
harness_name=$(echo "$payload" | jq -r '.harness // empty' 2>/dev/null || true)
[ -z "$harness_name" ] && exit 0

pr=$(echo "$payload" | jq -r '.project_root // empty' 2>/dev/null || true)
[ -z "$pr" ] && exit 0

harness_dir="$pr/.claude/harness/$harness_name"
[ ! -d "$harness_dir" ] && exit 0

ts_val=$(echo "$payload" | jq -r '.timestamp // ._ts // empty' 2>/dev/null || true)
content_val=$(echo "$payload" | jq -r '.prompt // empty' 2>/dev/null || true)

entry=$(jq -nc --arg ts "$ts_val" --arg to "$harness_name" --arg content "$content_val" \
  '{"ts":$ts,"from":"user","to":$to,"type":"prompt","content":$content}')

# Write to agent's inbox (sidecar first, fallback to module level)
sidecar_inbox="$harness_dir/agents/sidecar/inbox.jsonl"
if [ -d "$(dirname "$sidecar_inbox")" ]; then
  echo "$entry" >> "$sidecar_inbox" 2>/dev/null || true
else
  echo "$entry" >> "$harness_dir/inbox.jsonl" 2>/dev/null || true
fi

# Audit trail: user outbox
user_outbox="$pr/.claude/harness/user/outbox.jsonl"
mkdir -p "$(dirname "$user_outbox")" 2>/dev/null || true
echo "$entry" >> "$user_outbox" 2>/dev/null || true
