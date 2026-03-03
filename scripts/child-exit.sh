#!/usr/bin/env bash
# child-exit.sh — Called by /child-exit slash command.
#
# Looks up own pane in pane-registry.json:
#   - If a parent_pane is registered, notifies the parent via tmux send-keys.
#   - Then kills own pane with tmux kill-pane -K.
#
# Usage:
#   child-exit.sh "summary of what was accomplished"
#
# Called by: /child-exit slash command
# See also:  worker-register-child.sh (registers the parent_pane relationship)
set -uo pipefail
trap 'exit 0' EXIT

MESSAGE="${*:-Work complete. No summary provided.}"
PANE_REGISTRY="${PANE_REGISTRY:-$HOME/.boring/state/pane-registry.json}"

# ── 1. Find own pane ID (process-tree walk) ──────────────────────────────────
OWN_PANE_ID=$(tmux list-panes -a -F '#{pane_pid} #{pane_id}' 2>/dev/null | while read -r pid id; do
  p=$PPID
  while [ "$p" -gt 1 ]; do
    [ "$p" = "$pid" ] && echo "$id" && break 2
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
  done
done)

if [ -z "$OWN_PANE_ID" ]; then
  echo "child-exit: not running inside tmux — nothing to do." >&2
  exit 0
fi

# ── 2. Look up parent pane in registry ───────────────────────────────────────
PARENT_PANE=$(jq -r --arg pid "$OWN_PANE_ID" '.[$pid].parent_pane // ""' \
  "$PANE_REGISTRY" 2>/dev/null || echo "")

if [ -z "$PARENT_PANE" ]; then
  echo "child-exit: pane $OWN_PANE_ID has no parent_pane in registry (not a registered child)." >&2
  echo "  Killing own pane anyway." >&2
else
  # ── 3. Resolve parent name + target ──────────────────────────────────────
  PARENT_NAME=$(jq -r --arg pid "$PARENT_PANE" '.[$pid].harness // "parent"' \
    "$PANE_REGISTRY" 2>/dev/null | sed 's|^worker/||')
  PARENT_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$PARENT_PANE" '$1 == id {print $2; exit}')

  # ── 4. Resolve own name for signature ──────────────────────────────────────
  OWN_NAME=$(jq -r --arg pid "$OWN_PANE_ID" '.[$pid].harness // .[$pid].session_name // ""' \
    "$PANE_REGISTRY" 2>/dev/null | sed 's|^worker/||')
  OWN_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$OWN_PANE_ID" '$1 == id {print $2; exit}')

  # ── 5. Notify parent — try worker-message.sh first, fall back to direct tmux ──
  NOTIFIED=false
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # worker-message.sh only works for "worker/*" harness names
  if [[ "$PARENT_NAME" != "parent" ]] && bash "$SCRIPT_DIR/worker-message.sh" send "$PARENT_NAME" "$MESSAGE" 2>/dev/null; then
    echo "child-exit: notified ${PARENT_NAME} via bus — ${MESSAGE}"
    NOTIFIED=true
  fi

  # Direct tmux fallback (covers non-worker parents like hq-v3)
  if [ "$NOTIFIED" = "false" ] && [ -n "$PARENT_TARGET" ]; then
    SIG="[from ${OWN_TARGET:-$OWN_PANE_ID} (${OWN_NAME:-child})]"
    tmux send-keys -t "$PARENT_TARGET" "$SIG $MESSAGE"
    tmux send-keys -t "$PARENT_TARGET" -H 0d
    echo "child-exit: notified ${PARENT_NAME} via tmux ($PARENT_TARGET) — ${MESSAGE}"
    NOTIFIED=true
  fi

  if [ "$NOTIFIED" = "false" ]; then
    echo "child-exit: could not notify ${PARENT_NAME} (pane gone or bus unavailable)." >&2
  fi
fi

# ── 6. Kill own pane ─────────────────────────────────────────────────────────
echo "child-exit: killing pane ${OWN_PANE_ID} (${MY_TARGET:-?})"
tmux kill-pane -t "$OWN_PANE_ID"
# execution stops here — tmux kills this pane
exit 0
