#!/usr/bin/env bash
# inject_context_or_task.sh — Route context→policy.json or task→tasks.json.
set -euo pipefail

payload=$(cat)
routing=$(echo "$payload" | jq -r '.routing // ""' 2>/dev/null || echo "")
to=$(echo "$payload" | jq -r '.to // ""' 2>/dev/null || echo "")
[ -z "$to" ] || [ -z "$routing" ] && exit 0

pr="${PROJECT_ROOT:-.}"

if [ "$routing" = "context" ]; then
  policy_path="$pr/.claude/harness/$to/policy.json"
  [ ! -f "$policy_path" ] && exit 0
  from_agent=$(echo "$payload" | jq -r '.from // "unknown"' 2>/dev/null || echo "unknown")
  key=$(echo "$payload" | jq -r '.key // ("inbox-" + .from)' 2>/dev/null || echo "inbox-unknown")
  content_text=$(echo "$payload" | jq -r '.body // .content // ""' 2>/dev/null || echo "")
  attributed="[BUS:${from_agent}] ${content_text}"
  tmp="${policy_path}.tmp.$$"
  jq --arg k "$key" --arg v "$attributed" \
    '.inject.tool_context[$k] = {"inject": $v, "inject_when": "always"}' \
    "$policy_path" > "$tmp" 2>/dev/null && mv "$tmp" "$policy_path" || rm -f "$tmp"

elif [ "$routing" = "task" ]; then
  tasks_path="$pr/.claude/harness/$to/tasks.json"
  [ ! -f "$tasks_path" ] && exit 0
  task_id=$(echo "$payload" | jq -r '.task_id // ("bus-task-" + (now | tostring | split(".")[0]))' 2>/dev/null || echo "bus-task-$(date +%s)")
  description=$(echo "$payload" | jq -r '.body // .description // ""' 2>/dev/null || echo "")
  from_agent=$(echo "$payload" | jq -r '.from // "unknown"' 2>/dev/null || echo "unknown")
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  tmp="${tasks_path}.tmp.$$"
  jq --arg tid "$task_id" --arg desc "$description" --arg by "$from_agent" --arg ts "$ts" \
    'if .tasks[$tid] then . else .tasks[$tid] = {"status":"pending","description":$desc,"blockedBy":[],"owner":null,"steps":[],"completed_steps":[],"metadata":{"created_by":$by,"created_at":$ts}} end' \
    "$tasks_path" > "$tmp" 2>/dev/null && mv "$tmp" "$tasks_path" || rm -f "$tmp"
fi
