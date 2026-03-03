#!/usr/bin/env bash
# worker-message.sh — Inter-worker messaging via tmux pane registry.
# Mirrors Claude's built-in SendMessage API (send / broadcast / shutdown).
#
# Usage:
#   worker-message.sh send <worker-name> "<content>" [--summary "short preview"]
#   worker-message.sh broadcast "<content>" [--summary "short preview"]
#   worker-message.sh shutdown <worker-name> ["<reason>"]
#   worker-message.sh list                  # show all registered workers + panes
#
# Workers are identified by name (e.g. "chatbot-tools"), resolved via pane-registry.json.
#
# Delivery is two-layer:
#   1. Instant  — tmux send-keys (best-effort, fires even if bus unavailable)
#   2. Durable  — bus_publish "cell-message" → side-effects:
#                   notify_assignee  → recipient's inbox.jsonl (survives worker sleep)
#                   append_outbox    → sender's outbox.jsonl (audit trail)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/harness-jq.sh"

# Source event-bus.sh for bus_publish (gracefully degrades if unavailable)
_BUS_LIB="${BORING_DIR:-${CLAUDE_OPS_DIR:-$HOME/.boring}}/lib/event-bus.sh"
_BUS_AVAILABLE="false"
if [ -f "$_BUS_LIB" ]; then
  source "$_BUS_LIB" 2>/dev/null && _BUS_AVAILABLE="true" || true
fi

# ── Detect own pane ID + display target ──
_own_pane_id() {
  tmux list-panes -a -F '#{pane_pid} #{pane_id}' 2>/dev/null | while read pid id; do
    p=$PPID
    while [ "$p" -gt 1 ]; do
      [ "$p" = "$pid" ] && echo "$id" && return 0
      p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    done
  done
}

OWN_PANE=$(_own_pane_id 2>/dev/null || true)
OWN_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
  | awk -v id="$OWN_PANE" '$1 == id {print $2; exit}')
OWN_NAME=$(jq -r --arg p "$OWN_PANE" '.[$p].harness // empty' "$PANE_REGISTRY" 2>/dev/null \
  | sed 's|^worker/||' || true)

# Resolve parent for child panes — used in message signatures and payload
PARENT_PANE=$(jq -r --arg p "$OWN_PANE" '.[$p].parent_pane // empty' "$PANE_REGISTRY" 2>/dev/null || echo "")
PARENT_NAME=""
[ -n "$PARENT_PANE" ] && \
  PARENT_NAME=$(jq -r --arg p "$PARENT_PANE" '.[$p].harness // ""' "$PANE_REGISTRY" 2>/dev/null \
    | sed 's|^worker/||' || echo "")

# Bus identity: "worker/$name" for worker panes, "operator" for human/main session
FROM="${OWN_NAME:+worker/$OWN_NAME}"
FROM="${FROM:-operator}"

# Fallback signature — used only when bus is unavailable
if [ -n "$PARENT_NAME" ]; then
  _FALLBACK_SIG="[from ${OWN_TARGET:-?} (child of ${PARENT_NAME})]"
elif [ -n "$OWN_NAME" ]; then
  _FALLBACK_SIG="[from ${OWN_TARGET:-?} (${OWN_NAME})]"
else
  _FALLBACK_SIG="[from ${OWN_TARGET:-?}]"
fi

# ── Durable bus emit (cell-message → deliver_tmux + notify_assignee + append_outbox side-effects) ──
# $1=to (e.g. "worker/chatbot-tools")  $2=content  $3=summary  [$4=msg_type override]
_bus_emit() {
  [ "$_BUS_AVAILABLE" = "false" ] && return 1
  local to="$1" content="$2" summary="${3:-}" msg_type="${4:-message}"
  local payload
  payload=$(jq -nc \
    --arg to "$to" \
    --arg from "$FROM" \
    --arg from_pane "$OWN_PANE" \
    --arg from_target "$OWN_TARGET" \
    --arg from_name "$OWN_NAME" \
    --arg from_parent_name "$PARENT_NAME" \
    --arg content "$content" \
    --arg summary "$summary" \
    --arg msg_type "$msg_type" \
    '{to:$to, from:$from, from_pane:$from_pane, from_target:$from_target,
      from_name:$from_name, from_parent_name:$from_parent_name,
      content:$content, summary:$summary, msg_type:$msg_type, channel:"worker-message"}')
  bus_publish "cell-message" "$payload" 2>/dev/null || true
}

# ── Resolve worker name → pane_id ──
_worker_pane() {
  local name="$1"
  jq -r --arg h "worker/$name" \
    'to_entries[] | select(.value.harness == $h) | .key' \
    "$PANE_REGISTRY" 2>/dev/null | head -1
}

# ── Resolve pane_id → tmux target (e.g. w:1.0) ──
_pane_target() {
  local pane_id="$1"
  tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null \
    | awk -v id="$pane_id" '$1 == id {print $2; exit}'
}

CMD="${1:-help}"
shift 2>/dev/null || true

case "$CMD" in
  send)
    RECIPIENT="${1:?Usage: worker-message.sh send <worker-name> \"<content>\" [--summary \"...\"]}"
    shift
    CONTENT="${1:?Missing message content}"
    shift
    SUMMARY=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --summary|-s) SUMMARY="$2"; shift 2 ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
      esac
    done

    PANE_ID=$(_worker_pane "$RECIPIENT")
    [ -z "$PANE_ID" ] && {
      echo "ERROR: Worker '$RECIPIENT' not found in pane registry." >&2
      echo "Run 'worker-message.sh list' to see registered workers." >&2
      exit 1
    }
    TARGET=$(_pane_target "$PANE_ID")
    [ -z "$TARGET" ] && {
      echo "ERROR: Worker '$RECIPIENT' pane $PANE_ID has no active tmux target (may have exited)." >&2
      exit 1
    }

    if ! _bus_emit "worker/$RECIPIENT" "$CONTENT" "$SUMMARY"; then
      # Bus unavailable — fall back to direct tmux delivery
      tmux send-keys -t "$TARGET" "$_FALLBACK_SIG $CONTENT"
      tmux send-keys -t "$TARGET" -H 0d
    fi
    echo "Sent to $RECIPIENT ($TARGET)${SUMMARY:+ — $SUMMARY}"
    ;;

  broadcast)
    CONTENT="${1:?Usage: worker-message.sh broadcast \"<content>\" [--primary-only] [--summary \"...\"]}"
    shift
    SUMMARY=""
    PRIMARY_ONLY="false"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --summary|-s)      SUMMARY="$2"; shift 2 ;;
        --primary-only|-P) PRIMARY_ONLY="true"; shift ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
      esac
    done

    # By default: send to all worker panes AND registered children (parent_pane ∈ worker IDs).
    # With --primary-only: send only to root harness panes (harness="worker/$name").
    SENT=0
    if [ "$PRIMARY_ONLY" = "true" ]; then
      JQ_FILTER='to_entries[]
        | select(.value.harness | startswith("worker/"))
        | [.key, (.value.harness | ltrimstr("worker/"))]
        | @tsv'
    else
      JQ_FILTER='
        (to_entries | map(select(.value.harness | startswith("worker/"))) | map(.key)) as $wids |
        to_entries[]
        | select(
            (.value.harness | startswith("worker/"))
            or ((.value.parent_pane // "") as $p | $p != "" and ([$p] | inside($wids)))
          )
        | [.key, (.value.harness // ("child:" + (.value.parent_pane // "?")))]
        | @tsv'
    fi

    while IFS=$'\t' read -r pane_id name; do
      [ "$pane_id" = "$OWN_PANE" ] && continue
      TARGET=$(_pane_target "$pane_id")
      if [ -z "$TARGET" ]; then
        echo "  ⚠ $name ($pane_id): no active pane (skipped)"
        continue
      fi
      # Strip harness prefix to get plain worker name; child panes keep pane_id as to
      local_name="${name#worker/}"
      local_name="${local_name#child:}"
      local bus_to
      if [[ "$local_name" == %* ]]; then
        bus_to="$local_name"   # bare pane ID — deliver_tmux resolves directly
      else
        bus_to="worker/$local_name"
      fi
      if ! _bus_emit "$bus_to" "$CONTENT" "$SUMMARY" "broadcast"; then
        # Bus unavailable — fall back to direct tmux delivery
        tmux send-keys -t "$TARGET" "$_FALLBACK_SIG $CONTENT"
        tmux send-keys -t "$TARGET" -H 0d
      fi
      echo "  → $name ($TARGET)"
      SENT=$((SENT + 1))
    done < <(jq -r "$JQ_FILTER" "$PANE_REGISTRY" 2>/dev/null | sort -u)

    SCOPE=$( [ "$PRIMARY_ONLY" = "true" ] && echo "primary workers" || echo "workers + children" )
    echo "Broadcast to $SENT $SCOPE${SUMMARY:+ — $SUMMARY}"
    ;;

  shutdown)
    RECIPIENT="${1:?Usage: worker-message.sh shutdown <worker-name> [\"<reason>\"]}"
    shift
    REASON="${1:-Your task is complete. Please wrap up and stop.}"

    PANE_ID=$(_worker_pane "$RECIPIENT")
    [ -z "$PANE_ID" ] && {
      echo "ERROR: Worker '$RECIPIENT' not found in pane registry." >&2
      exit 1
    }
    TARGET=$(_pane_target "$PANE_ID")
    [ -z "$TARGET" ] && {
      echo "ERROR: Worker '$RECIPIENT' pane $PANE_ID has no active tmux target." >&2
      exit 1
    }

    MSG="SHUTDOWN REQUEST: Please wrap up your current task and stop. Reason: $REASON"
    if ! _bus_emit "worker/$RECIPIENT" "$MSG" "shutdown" "shutdown"; then
      tmux send-keys -t "$TARGET" "$_FALLBACK_SIG $MSG"
      tmux send-keys -t "$TARGET" -H 0d
    fi
    echo "Shutdown request sent to $RECIPIENT ($TARGET)"
    ;;

  list)
    echo "Registered workers + children (pane-registry.json):"
    echo ""
    { printf "WORKER\tPANE_ID\tTARGET\tTYPE\n"
      jq -r '
        (to_entries | map(select(.value.harness | startswith("worker/"))) | map(.key)) as $wids |
        to_entries[]
        | select(
            (.value.harness | startswith("worker/"))
            or ((.value.parent_pane // "") as $p | $p != "" and ([$p] | inside($wids)))
          )
        | [
            (.value.harness // ("child-of:" + (.value.parent_pane // "?")) | ltrimstr("worker/")),
            .key,
            (.value.pane_target // "?"),
            (if (.value.harness | startswith("worker/")) then "primary" else "child" end)
          ]
        | @tsv' "$PANE_REGISTRY" 2>/dev/null | sort
    } | column -t -s $'\t' || echo "(none registered)"
    echo ""
    echo "Tip: 'worker-message.sh send <WORKER> \"message\"' (use WORKER name column)"
    ;;

  help|*)
    echo "Usage: worker-message.sh <send|broadcast|shutdown|list>"
    echo ""
    echo "Commands:"
    echo "  send <worker> \"<msg>\" [--summary \"...\"]    DM a specific worker by name"
    echo "  broadcast \"<msg>\" [--summary \"...\"]        Send same message to all workers"
    echo "  shutdown <worker> [\"<reason>\"]              Request graceful stop"
    echo "  list                                        Show all registered workers"
    echo ""
    echo "Examples:"
    echo "  worker-message.sh send chief-of-staff \"Branch worker/chatbot-tools is ready for merge\""
    echo "  worker-message.sh broadcast \"Deploying to test — hold off on prod pushes\""
    echo "  worker-message.sh shutdown ui-patrol \"Regression sweep complete\""
    echo "  worker-message.sh list"
    exit 0
    ;;
esac
