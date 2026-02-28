#!/usr/bin/env bash
# dlq_if_critical.sh — Append to dead-letter queue if severity=critical.
set -euo pipefail

payload=$(cat)
severity=$(echo "$payload" | jq -r '.severity // "normal"' 2>/dev/null || echo "normal")
[ "$severity" != "critical" ] && exit 0

pr="${PROJECT_ROOT:-.}"
dlq_file="$pr/.claude/bus/dlq/failed.jsonl"
mkdir -p "$(dirname "$dlq_file")" 2>/dev/null || true
echo "$payload" >> "$dlq_file"
