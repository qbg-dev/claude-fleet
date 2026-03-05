#!/usr/bin/env bash
# deliver_tmux.sh — Deliver cell-message content to recipient's active tmux pane.
#
# Side-effect of "cell-message" events. Resolves worker pane from registry.json.
#
# Recipient resolution:
#   .to == "worker/name"  → look up pane_id from registry.json
#   .to == "%NNN"         → use pane ID directly
set -euo pipefail

payload=$(cat)
to=$(echo "$payload"      | jq -r '.to // ""'              2>/dev/null || echo "")
content=$(echo "$payload" | jq -r '.content // ""'         2>/dev/null || echo "")
[ -z "$to" ] || [ -z "$content" ] && exit 0

# ── Build sender signature ──
from_target=$(echo "$payload"  | jq -r '.from_target // ""'      2>/dev/null || echo "")
from_name=$(echo "$payload"    | jq -r '.from_name // ""'         2>/dev/null || echo "")
from_parent=$(echo "$payload"  | jq -r '.from_parent_name // ""'  2>/dev/null || echo "")

if [ -n "$from_parent" ]; then
  SIG="[from ${from_target:-?} (child of ${from_parent})]"
elif [ -n "$from_name" ]; then
  SIG="[from ${from_target:-?} (${from_name})]"
elif [ -n "$from_target" ]; then
  SIG="[from ${from_target}]"
else
  SIG="[from unknown]"
fi

# ── Resolve recipient pane from registry.json ──
from_project=$(echo "$payload" | jq -r '.from_project // ""' 2>/dev/null || echo "")
if [[ "$to" == %* ]]; then
  # Bare pane ID (e.g. child panes in broadcast)
  PANE_ID="$to"
else
  PANE_ID=""
  # Extract worker name from "worker/name" format
  _recip_name="${to#worker/}"
  # Look up from registry.json
  _scope="${from_project:-$(git rev-parse --show-toplevel 2>/dev/null || echo "")}"
  # Resolve main repo root if in worktree
  if [[ "$_scope" == *-w-* ]]; then
    _scope=$(echo "$_scope" | sed 's|-w-[^/]*$||')
  fi
  _REGISTRY="${_scope}/.claude/workers/registry.json"
  if [ -f "$_REGISTRY" ]; then
    PANE_ID=$(jq -r --arg n "$_recip_name" '.[$n].pane_id // ""' "$_REGISTRY" 2>/dev/null || echo "")
  fi
fi
[ -z "$PANE_ID" ] && exit 0

TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
  | awk -v id="$PANE_ID" '$1 == id {print $2; exit}')
[ -z "$TARGET" ] && exit 0

tmux send-keys -t "$TARGET" -H 03  # Ctrl-C to interrupt active turn
tmux send-keys -t "$TARGET" "$SIG $content"
tmux send-keys -t "$TARGET" -H 0d
