#!/usr/bin/env bash
# worker-status.sh — Show status of all flat workers from registry.json
#
# Usage:
#   ./worker-status.sh               # show table of all workers
#   ./worker-status.sh --json        # output raw JSON

set -euo pipefail

PROJECT_ROOT="$(git -C "$(dirname "$0")/../.." rev-parse --show-toplevel 2>/dev/null || { echo "ERROR: PROJECT_ROOT not set and not in a git repo" >&2; exit 1; })"
REGISTRY="$PROJECT_ROOT/.claude/workers/registry.json"

[ ! -f "$REGISTRY" ] && { echo "No registry found at $REGISTRY"; exit 1; }

# ── Colors ────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'; RESET='\033[0m'
  GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; CYAN='\033[36m'; DIM='\033[2m'
else
  BOLD=''; RESET=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; DIM=''
fi

# ── Table output ─────────────────────────────────────────────────
cmd_table() {
  printf "\n${BOLD}%-25s %-10s %-15s %-8s %-10s %-8s %s${RESET}\n" \
    "WORKER" "PANE" "WINDOW" "STATE" "MODEL" "PERP" "CYCLES"
  printf '%s\n' "$(printf '─%.0s' {1..90})"

  while IFS= read -r worker; do
    [ "$worker" = "_config" ] && continue

    local pane_id window model perpetual cycles status
    pane_id=$(jq -r --arg n "$worker" '.[$n].pane_id // "-"' "$REGISTRY" 2>/dev/null)
    window=$(jq -r --arg n "$worker" '.[$n].window // "-"' "$REGISTRY" 2>/dev/null)
    model=$(jq -r --arg n "$worker" '.[$n].model // "sonnet"' "$REGISTRY" 2>/dev/null)
    perpetual=$(jq -r --arg n "$worker" '.[$n].perpetual // false' "$REGISTRY" 2>/dev/null)
    cycles=$(jq -r --arg n "$worker" '.[$n].cycles_completed // 0' "$REGISTRY" 2>/dev/null)
    status=$(jq -r --arg n "$worker" '.[$n].status // "unknown"' "$REGISTRY" 2>/dev/null)

    # Check pane alive
    local state="no-pane"
    if [ "$pane_id" != "-" ] && [ "$pane_id" != "null" ] && [ -n "$pane_id" ]; then
      if tmux list-panes -a -F '#{pane_id}' 2>/dev/null | grep -qxF "$pane_id"; then
        state="alive"
      else
        state="dead"
      fi
    fi

    # Color state
    local state_color="$RESET"
    case "$state" in
      alive)   state_color="$GREEN"  ;;
      dead)    state_color="$RED"    ;;
      no-pane) state_color="$DIM"    ;;
    esac

    local perp_mark="no"
    [ "$perpetual" = "true" ] && perp_mark="${CYAN}yes${RESET}"

    printf "%-25s ${DIM}%-10s${RESET} %-15s ${state_color}%-8s${RESET} %-10s %-8b %s\n" \
      "$worker" "${pane_id:-n/a}" "${window:-n/a}" "$state" \
      "$model" "$perp_mark" "$cycles"
  done < <(jq -r 'keys[]' "$REGISTRY" 2>/dev/null || true)

  printf '%s\n' "$(printf '─%.0s' {1..90})"

  # Window group summary
  echo ""
  printf "${BOLD}Window Groups:${RESET}\n"
  jq -r '
    [to_entries[] | select(.key != "_config") | {worker: .key, window: (.value.window // .key)}]
    | group_by(.window)
    | .[]
    | "  " + .[0].window + ": " + ([.[].worker] | join(", "))
  ' "$REGISTRY" 2>/dev/null || true

  # Daemon health
  echo ""
  local daemon_pid; daemon_pid=$(pgrep -f 'harness-watchdog.sh' 2>/dev/null | head -1 || true)
  if [ -n "$daemon_pid" ]; then
    local daemon_age; daemon_age=$(ps -o etime= -p "$daemon_pid" 2>/dev/null | tr -d ' ' || echo "?")
    echo "  ${GREEN}●${RESET} Watchdog  PID $daemon_pid  uptime $daemon_age"
  else
    echo "  ${RED}●${RESET} Watchdog NOT running!"
  fi
  echo ""
}

# ── JSON output ──────────────────────────────────────────────────
cmd_json() {
  jq '
    to_entries
    | map(select(.key != "_config"))
    | map({
        name: .key,
        pane_id: (.value.pane_id // null),
        window: (.value.window // null),
        model: (.value.model // "sonnet"),
        perpetual: (.value.perpetual // false),
        cycles: (.value.cycles_completed // 0),
        status: (.value.status // "unknown"),
        parent: (.value.parent // null),
        children: (.value.children // [])
      })
  ' "$REGISTRY"
}

# ── Main ─────────────────────────────────────────────────────────
case "${1:-}" in
  --json) cmd_json ;;
  *)      cmd_table ;;
esac
