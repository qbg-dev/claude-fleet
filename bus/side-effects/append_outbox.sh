#!/usr/bin/env bash
# append_outbox.sh — Append file-edit event to agent's outbox for audit trail.
set -euo pipefail
source "$HOME/.boring/lib/bus-paths.sh"

payload=$(cat)
from=$(echo "$payload" | jq -r '.agent // .from // ""' 2>/dev/null || echo "")
[ -z "$from" ] && exit 0

outbox=$(resolve_agent_outbox "$from")
[ -d "$(dirname "$outbox")" ] && echo "$payload" >> "$outbox"
