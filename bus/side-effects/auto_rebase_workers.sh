#!/usr/bin/env bash
# auto_rebase_workers.sh — Side-effect for worker.merged events.
# Notifies active workers to rebase onto main (via inbox + tmux).
set -euo pipefail
source "$HOME/.boring/lib/harness-jq.sh"
source "$HOME/.boring/lib/bus-paths.sh"

payload=$(cat)
merged_worker=$(echo "$payload" | jq -r '.worker // ""' 2>/dev/null || echo "")
[ -z "$merged_worker" ] && exit 0

pr="${PROJECT_ROOT:-.}"
workers_dir="$pr/.claude/workers"

# For each active worker (has state.json with status != "done"), skip the just-merged one
for dir in "$workers_dir"/*/; do
  [ ! -d "$dir" ] && continue
  name=$(basename "$dir")
  [ "$name" = "$merged_worker" ] && continue
  [ "$name" = "_archived" ] && continue

  state_file="$dir/state.json"
  [ ! -f "$state_file" ] && continue

  status=$(jq -r '.status // "unknown"' "$state_file" 2>/dev/null || echo "unknown")
  [ "$status" = "done" ] && continue

  # Write rebase-needed message to worker's inbox
  inbox="$dir/inbox.jsonl"
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  rebase_msg=$(jq -nc \
    --arg from "chief-of-staff" \
    --arg content "Branch worker/$merged_worker was merged to main. Please rebase: git fetch origin main && git rebase origin/main" \
    --arg ts "$NOW" \
    '{msg_type:"rebase-needed", from:$from, content:$content, _ts:$ts}')
  echo "$rebase_msg" >> "$inbox"

  # Best-effort tmux notification (scoped by project)
  pane=$(jq -r --arg h "worker/$name" --arg proj "$pr" \
    'to_entries[] | select(.value.harness == $h and (.value.project_root // "") == $proj) | .key' \
    "$PANE_REGISTRY" 2>/dev/null | head -1 || echo "")
  # Fallback: unscoped for registries without project_root
  if [ -z "$pane" ]; then
    pane=$(jq -r --arg h "worker/$name" \
      'to_entries[] | select(.value.harness == $h) | .key' \
      "$PANE_REGISTRY" 2>/dev/null | head -1 || echo "")
  fi
  [ -z "$pane" ] && continue

  target=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$pane" '$1 == id {print $2; exit}')
  [ -z "$target" ] && continue

  tmux send-keys -t "$target" "[rebase] $merged_worker merged to main — run: git fetch origin main && git rebase origin/main"
  tmux send-keys -t "$target" -H 0d
done
