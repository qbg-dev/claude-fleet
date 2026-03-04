#!/usr/bin/env bash
# auto_rebase_workers.sh — Side-effect for worker.merged events.
# Notifies active workers to rebase onto main (via inbox + tmux).
set -euo pipefail

payload=$(cat)
merged_worker=$(echo "$payload" | jq -r '.worker // ""' 2>/dev/null || echo "")
[ -z "$merged_worker" ] && exit 0

pr="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo ".")}"
# Resolve main repo root if in worktree
if [[ "$pr" == *-w-* ]]; then
  pr=$(echo "$pr" | sed 's|-w-[^/]*$||')
fi
workers_dir="$pr/.claude/workers"
_REGISTRY="$workers_dir/registry.json"

# For each worker in registry (skip _config and the just-merged one)
if [ ! -f "$_REGISTRY" ]; then exit 0; fi

while IFS= read -r name; do
  [ "$name" = "_config" ] && continue
  [ "$name" = "$merged_worker" ] && continue

  # Write rebase-needed message to worker's inbox
  inbox="$workers_dir/$name/inbox.jsonl"
  [ ! -d "$(dirname "$inbox")" ] && continue
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  rebase_msg=$(jq -nc \
    --arg from "chief-of-staff" \
    --arg content "Branch worker/$merged_worker was merged to main. Please rebase: git fetch origin main && git rebase origin/main" \
    --arg ts "$NOW" \
    '{msg_type:"rebase-needed", from:$from, content:$content, _ts:$ts}')
  echo "$rebase_msg" >> "$inbox"

  # Best-effort tmux notification from registry.json
  pane=$(jq -r --arg n "$name" '.[$n].pane_id // ""' "$_REGISTRY" 2>/dev/null || echo "")
  [ -z "$pane" ] && continue

  target=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$pane" '$1 == id {print $2; exit}')
  [ -z "$target" ] && continue

  tmux send-keys -t "$target" "[rebase] $merged_worker merged to main — run: git fetch origin main && git rebase origin/main"
  tmux send-keys -t "$target" -H 0d
done < <(jq -r 'keys[]' "$_REGISTRY" 2>/dev/null || true)
