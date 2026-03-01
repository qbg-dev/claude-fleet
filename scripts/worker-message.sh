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
# Messages are delivered via tmux send-keys with auto-signature.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/harness-jq.sh"

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

SIGNATURE="[from ${OWN_TARGET:-?}${OWN_NAME:+ ($OWN_NAME)}]"

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

# ── Send text to a tmux pane ──
_send_to_pane() {
  local target="$1"
  local content="$2"
  tmux send-keys -t "$target" "$SIGNATURE $content"
  tmux send-keys -t "$target" -H 0d
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

    _send_to_pane "$TARGET" "$CONTENT"
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
      _send_to_pane "$TARGET" "$CONTENT"
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
    _send_to_pane "$TARGET" "$MSG"
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
