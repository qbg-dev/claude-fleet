#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# harness — Unified CLI for managing autonomous agent harnesses
# ══════════════════════════════════════════════════════════════════
#
# Usage:
#   harness list                     # Show all harnesses (active + done)
#   harness status [<name>]          # Detailed status for one or all active
#   harness stop <name> [--force]    # Gracefully stop a harness
#   harness stop --all [--force]     # Stop all active harnesses
#   harness start <name> [<task>]    # Start/resume a harness agent
#   harness restart <name>           # Stop + start (force rotation)
#   harness logs <name> [--tail N]   # Show activity logs for a harness
#   harness health                   # Show control plane health
#   harness scaffold <name> <project> [--long-running]  # Create new harness
#   harness agents                   # Show all Claude processes with status
#   harness register [<pane> <harness>]  # Bind session to harness
#   harness dashboard                # Interactive fzf management panel
#
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

source "$HOME/.claude-ops/lib/harness-jq.sh" 2>/dev/null || true
source "$HOME/.claude-ops/lib/harness-pane.sh" 2>/dev/null || true
[ -f "$HOME/.claude-ops/control-plane.conf" ] && source "$HOME/.claude-ops/control-plane.conf"

REGISTRY="${HARNESS_SESSION_REGISTRY:-$HOME/.claude-ops/state/session-registry.json}"
STATE_DIR="${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}"
ACTIVITY_DIR="${HARNESS_ACTIVITY_DIR:-$STATE_DIR/activity}"
HEALTH_FILE="${HARNESS_HEALTH_FILE:-$STATE_DIR/health.json}"
METRICS_FILE="${HARNESS_METRICS_FILE:-$STATE_DIR/metrics.jsonl}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Pager: auto-paginate when stdout is a TTY ────────────────────
# Usage: _paged cmd_foo "$@"
# Pipes through less -RFX (colors, quit-if-fits, no clear) when interactive.
_paged() {
  if [ -t 1 ]; then
    "$@" 2>&1 | less -RFX
  else
    "$@"
  fi
}

# ── Usage ────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}harness${RESET} — Manage autonomous agent harnesses

${BOLD}COMMANDS${RESET}
  list                          Show all harnesses with status
  status [<name>]               Detailed status (one or all active)
  stop <name> [--force]         Gracefully stop a harness
  stop --all [--force]          Stop all active harnesses
  start <name> [<task>]         Start/resume a harness agent
  restart <name>                Stop + start (force rotation)
  logs <name> [--tail N]        Show activity log (default: last 20)
  health                        Control plane health table
  scaffold <name> <project>     Create new harness from template
    [--long-running]
  create <name> [<project>]      Scaffold + populate from description
    [--long-running] [--description "..."]
  agents                        Show all Claude processes with registration
  register                      Interactive: pick session → pick harness
  register <pane> <harness>     Direct: bind pane to harness
  register --auto               Auto-register panes with metadata
  register --show               Show current registry
  dashboard                     Interactive fzf management panel
  web [--no-open]               Start API server + open web dashboard

${BOLD}EXAMPLES${RESET}
  harness list
  harness status finance-dash-v3
  harness stop data-consistency --force
  harness start corpus-reindex
  harness logs tianding-audit --tail 50
  harness scaffold my-feature /path/to/project
  harness create login-perf . --description "Optimize login page load time"
  harness agents
  harness register h:3.0 finance-dash-v3
  harness dashboard
  harness web
  harness web --no-open
EOF
  exit "${1:-1}"
}

# ══════════════════════════════════════════════════════════════════
# CMD: list
# ══════════════════════════════════════════════════════════════════
cmd_list() {
  echo -e "${BOLD}Harnesses:${RESET}"
  echo ""

  local active_count=0 done_count_total=0
  local hname pfile status done_c total lifecycle

  # Gather all harnesses (active + done) via manifests
  while IFS='|' read -r hname project_root; do
    [ -z "$hname" ] && continue
    pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
    [ ! -f "$pfile" ] && continue

    status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null || echo "unknown")
    done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
    total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
    lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")

    if [ "$status" = "active" ]; then
      active_count=$((active_count + 1))
      local current worker_pane_info pane_info
      current=$(harness_current_task "$pfile" 2>/dev/null || echo "?")
      worker_pane_info=$(find_worker_pane "$hname" 2>/dev/null || echo "")

      if [ -n "$worker_pane_info" ]; then
        pane_info="${GREEN}alive${RESET} (${worker_pane_info#*|})"
      else
        pane_info="${YELLOW}no worker${RESET}"
      fi

      printf "  ${GREEN}●${RESET} %-24s %s/%s  %-14s worker: %b  task: %s\n" \
        "$hname" "$done_c" "$total" "[$lifecycle]" "$pane_info" "$current"
    else
      done_count_total=$((done_count_total + 1))
      printf "  ${DIM}○ %-24s %s/%s  [%s]${RESET}\n" \
        "$hname" "$done_c" "$total" "$status"
    fi
  done < <(harness_list_all 2>/dev/null)

  echo ""
  echo -e "  ${GREEN}$active_count active${RESET}, ${DIM}$done_count_total done${RESET}"
}

# ══════════════════════════════════════════════════════════════════
# CMD: status
# ══════════════════════════════════════════════════════════════════
cmd_status() {
  local target="${1:-}"

  if [ -n "$target" ]; then
    _show_status "$target"
  else
    # Show status for all active harnesses
    local found=0
    while IFS='|' read -r hname _rest; do
      [ -z "$hname" ] && continue
      local pfile
      pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
      [ ! -f "$pfile" ] && continue
      local st
      st=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null)
      [ "$st" != "active" ] && continue
      [ "$found" -gt 0 ] && echo ""
      _show_status "$hname"
      found=$((found + 1))
    done < <(harness_list_active 2>/dev/null)
    [ "$found" -eq 0 ] && echo "No active harnesses."
  fi
}

_show_status() {
  local hname="$1"
  local pfile
  pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
  if [ -z "$pfile" ] || [ ! -f "$pfile" ]; then
    echo -e "${RED}Harness '$hname' not found${RESET}" >&2
    return 1
  fi

  local status mission done_c total lifecycle current session_count cycles
  status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null)
  mission=$(jq -r '.mission // "(no mission)"' "$pfile" 2>/dev/null | head -c 120)
  done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
  total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
  lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")
  current=$(harness_current_task "$pfile" 2>/dev/null || echo "none")
  session_count=$(jq -r '.session_count // 0' "$pfile" 2>/dev/null)
  cycles=$(jq -r '.cycles_completed // 0' "$pfile" 2>/dev/null)

  echo -e "${BOLD}$hname${RESET} [$status, $lifecycle]"
  echo -e "  ${CYAN}Mission:${RESET} $mission"
  echo -e "  ${CYAN}Progress:${RESET} $done_c/$total tasks, $session_count sessions, $cycles cycles"
  echo -e "  ${CYAN}Current:${RESET} $current"

  # Worker pane
  local worker_result
  worker_result=$(find_worker_pane "$hname" 2>/dev/null || echo "")
  if [ -n "$worker_result" ]; then
    local pane_id="${worker_result%%|*}"
    local pane_target="${worker_result#*|}"
    echo -e "  ${CYAN}Worker:${RESET} ${GREEN}alive${RESET} at $pane_target"

    # Monitor
    local monitor_pane
    monitor_pane=$(find_monitor_pane "$hname" "$pane_id" "$pane_target" 2>/dev/null || echo "")
    if [ -n "$monitor_pane" ]; then
      echo -e "  ${CYAN}Monitor:${RESET} ${GREEN}alive${RESET} at $monitor_pane"
    fi
  else
    echo -e "  ${CYAN}Worker:${RESET} ${YELLOW}not running${RESET}"
  fi

  # Health from control plane
  if [ -f "$HEALTH_FILE" ]; then
    local health_data
    health_data=$(jq -r --arg h "$hname" '.harnesses[$h] // empty' "$HEALTH_FILE" 2>/dev/null || echo "")
    if [ -n "$health_data" ]; then
      local w_status m_status restarts
      w_status=$(echo "$health_data" | jq -r '.worker.status // "unknown"')
      m_status=$(echo "$health_data" | jq -r '.monitor.status // "none"')
      restarts=$(echo "$health_data" | jq -r '.worker.restarts // 0')
      echo -e "  ${CYAN}Health:${RESET} worker=$w_status monitor=$m_status restarts=$restarts"
    fi
  fi

  # Activity log stats
  local activity_log="$ACTIVITY_DIR/claude_activity_${hname}.jsonl"
  if [ -f "$activity_log" ] && [ -s "$activity_log" ]; then
    local event_count last_event
    event_count=$(wc -l < "$activity_log" | tr -d ' ')
    last_event=$(tail -1 "$activity_log" | jq -r '.ts // "?"' 2>/dev/null)
    echo -e "  ${CYAN}Activity:${RESET} $event_count events, last at $last_event"
  else
    echo -e "  ${CYAN}Activity:${RESET} (no log)"
  fi

  # Learnings count
  local learnings
  learnings=$(jq '[.learnings // [] | length] | add // 0' "$pfile" 2>/dev/null || echo "0")
  if [ "$learnings" -gt 0 ]; then
    echo -e "  ${CYAN}Learnings:${RESET} $learnings"
  fi

  # Task list (full — pager handles overflow)
  echo -e "  ${CYAN}Tasks:${RESET}"
  jq -r '.tasks | to_entries[] | "    \(if .value.status == "completed" then "✓" elif .value.status == "in_progress" then "→" else "○" end) \(.key): \((.value.description // "")[0:90])"' "$pfile" 2>/dev/null
}

# ══════════════════════════════════════════════════════════════════
# CMD: stop
# ══════════════════════════════════════════════════════════════════
cmd_stop() {
  local target="$1"
  local force="${2:-false}"

  if [ "$target" = "--all" ] || [ "$target" = "-a" ]; then
    echo -e "${BOLD}Stopping all active harnesses...${RESET}"
    echo ""
    local stopped=0
    while IFS='|' read -r hname _rest; do
      [ -z "$hname" ] && continue
      local pfile
      pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
      [ ! -f "$pfile" ] && continue
      local st
      st=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null)
      [ "$st" != "active" ] && continue
      _stop_harness "$hname" "$force"
      echo ""
      stopped=$((stopped + 1))
    done < <(harness_list_active 2>/dev/null)
    if [ "$stopped" -eq 0 ]; then
      echo "No active harnesses to stop."
    else
      echo -e "${GREEN}Stopped $stopped harness(es).${RESET}"
    fi
  else
    _stop_harness "$target" "$force"
  fi
}

_stop_harness() {
  local hname="$1"
  local force="${2:-false}"

  # 1. Find progress file
  local pfile
  pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
  if [ -z "$pfile" ] || [ ! -f "$pfile" ]; then
    echo -e "${RED}Error: no progress file found for harness '$hname'${RESET}" >&2
    echo "Run 'harness list' to see harnesses." >&2
    return 1
  fi

  local status
  status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null || echo "unknown")
  if [ "$status" != "active" ]; then
    echo -e "${YELLOW}Warning: harness '$hname' is already status='$status'${RESET}"
  fi

  echo -e "${BOLD}Stopping harness: $hname${RESET}"

  # 2. Set status to "done" in progress.json
  local tmp
  tmp=$(mktemp)
  if jq '.status = "done"' "$pfile" > "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
    mv "$tmp" "$pfile"
    echo "  [1/5] Set status=done in progress.json"
  else
    rm -f "$tmp"
    echo -e "  ${RED}[1/5] Failed to update progress.json${RESET}" >&2
  fi

  # 3. Touch escape hatch for all registered sessions
  local sessions_found=0
  if [ -f "$REGISTRY" ]; then
    while IFS= read -r sid; do
      [ -z "$sid" ] && continue
      touch "$(harness_session_dir "$sid")/allow-stop"
      sessions_found=$((sessions_found + 1))
    done < <(jq -r --arg h "$hname" '
      [(.sessions // {}) | to_entries[] | select(.value == $h) | .key] +
      [to_entries[] | select(.key != "panes" and .key != "sessions" and .value == $h) | .key]
      | unique[]
    ' "$REGISTRY" 2>/dev/null || true)
  fi
  echo "  [2/5] Created escape hatch for $sessions_found session(s)"

  # 4. Touch harness-level stop flag
  touch "$(harness_runtime "$hname")/stop-flag"
  echo "  [3/5] Created harness stop flag"

  # 5. Deregister from session registry
  if [ -f "$REGISTRY" ]; then
    local tmp_reg
    tmp_reg=$(mktemp)
    jq --arg h "$hname" '
      (.sessions // {}) |= with_entries(select(.value != $h)) |
      (.panes // {}) |= with_entries(select(.value != $h)) |
      with_entries(select(.key == "panes" or .key == "sessions" or .value != $h))
    ' "$REGISTRY" > "$tmp_reg" 2>/dev/null && mv "$tmp_reg" "$REGISTRY"
    echo "  [4/5] Deregistered from session registry"
  else
    echo "  [4/5] No registry file found (skip)"
  fi

  # 6. Force kill if requested
  if [ "$force" = "true" ]; then
    local worker_result
    worker_result=$(find_worker_pane "$hname" 2>/dev/null || echo "")
    if [ -n "$worker_result" ]; then
      local pane_id="${worker_result%%|*}"
      local pane_target="${worker_result#*|}"
      echo "  [5/5] Force-stopping agent in $pane_target..."

      # Escalating kill: /quit → Escape → kill
      tmux send-keys -t "$pane_id" "/quit" 2>/dev/null || true
      tmux send-keys -t "$pane_id" -H 0d 2>/dev/null || true
      sleep 3

      if is_claude_alive_in_pane "$pane_id" 2>/dev/null; then
        tmux send-keys -t "$pane_id" Escape 2>/dev/null || true
        sleep 2

        if is_claude_alive_in_pane "$pane_id" 2>/dev/null; then
          local shell_pid
          shell_pid=$(tmux display-message -t "$pane_id" -p '#{pane_pid}' 2>/dev/null || echo "")
          if [ -n "$shell_pid" ]; then
            for cpid in $(pgrep -P "$shell_pid" 2>/dev/null | head -5); do
              if ps -o command= -p "$cpid" 2>/dev/null | grep -q "^claude "; then
                kill "$cpid" 2>/dev/null || true
                echo "  Killed Claude process (PID $cpid)"
              fi
            done
          fi
        else
          echo "  Agent exited after Escape"
        fi
      else
        echo "  Agent exited after /quit"
      fi

      # Kill monitor daemon if present
      local monitor_pane daemon_pid
      monitor_pane=$(find_monitor_pane "$hname" "$pane_id" "$pane_target" 2>/dev/null || echo "")
      daemon_pid=$(find_daemon_pid "$pane_id" "$pane_target" 2>/dev/null || echo "")
      if [ -n "$daemon_pid" ] && kill -0 "$daemon_pid" 2>/dev/null; then
        kill "$daemon_pid" 2>/dev/null || true
        echo "  Killed monitor daemon (PID $daemon_pid)"
      fi
      if [ -n "$monitor_pane" ] && is_claude_alive_in_pane "$monitor_pane" 2>/dev/null; then
        local mshell_pid
        mshell_pid=$(tmux display-message -t "$monitor_pane" -p '#{pane_pid}' 2>/dev/null || echo "")
        if [ -n "$mshell_pid" ]; then
          for cpid in $(pgrep -P "$mshell_pid" 2>/dev/null | head -5); do
            if ps -o command= -p "$cpid" 2>/dev/null | grep -q "^claude "; then
              kill "$cpid" 2>/dev/null || true
              echo "  Killed monitor Claude process (PID $cpid)"
            fi
          done
        fi
      fi
    else
      echo "  [5/5] No worker pane found (already gone)"
    fi
  else
    echo "  [5/5] Graceful stop (agent will exit on next stop hook)"
  fi

  # Clean up state files
  rm -f "${STATE_DIR}/stuck_${hname}" "${STATE_DIR}/stuck_nudges_${hname}"
  rm -f "$(harness_runtime "$hname")/rotation-advisory"

  echo -e "${GREEN}Harness '$hname' stopped.${RESET}"
}

# ══════════════════════════════════════════════════════════════════
# CMD: start
# ══════════════════════════════════════════════════════════════════
cmd_start() {
  local hname="$1"
  local task="${2:-}"

  # Verify harness exists
  local pfile
  pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
  if [ -z "$pfile" ] || [ ! -f "$pfile" ]; then
    echo -e "${RED}Error: no progress file found for harness '$hname'${RESET}" >&2
    echo "Available harnesses:" >&2
    harness_list_all 2>/dev/null | awk -F'|' '{print "  " $1}' >&2
    return 1
  fi

  # Check status — if done, set back to active
  local status
  status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null)
  if [ "$status" = "done" ]; then
    echo -e "${YELLOW}Reactivating harness '$hname' (was status=done)${RESET}"
    local tmp
    tmp=$(mktemp)
    jq '.status = "active"' "$pfile" > "$tmp" && mv "$tmp" "$pfile"
  fi

  # Clean up stop flags
  rm -f "$(harness_runtime "$hname")/stop-flag"

  # Find start script
  local project_root
  project_root=$(harness_project_root "$hname" 2>/dev/null || echo "")
  [ -z "$project_root" ] && { echo -e "${RED}Error: can't find project root for '$hname'${RESET}" >&2; return 1; }

  local start_script="$project_root/.claude/scripts/${hname}-start.sh"
  if [ ! -f "$start_script" ]; then
    echo -e "${RED}Error: no start script at $start_script${RESET}" >&2
    return 1
  fi

  echo -e "${BOLD}Starting harness: $hname${RESET}"
  echo -e "  Project: $project_root"
  echo -e "  Script: ${start_script#"$project_root/"}"

  if [ -n "$task" ]; then
    echo -e "  Starting at task: $task"
    bash "$start_script" "$task"
  else
    bash "$start_script"
  fi
}

# ══════════════════════════════════════════════════════════════════
# CMD: restart
# ══════════════════════════════════════════════════════════════════
cmd_restart() {
  local hname="$1"
  echo -e "${BOLD}Restarting harness: $hname${RESET}"
  echo ""

  # Stop with force
  _stop_harness "$hname" "true" 2>/dev/null || true
  echo ""

  # Wait for pane to settle
  sleep 3

  # Start
  cmd_start "$hname"
}

# ══════════════════════════════════════════════════════════════════
# CMD: logs
# ══════════════════════════════════════════════════════════════════
cmd_logs() {
  local hname="$1"
  local tail_n="${2:-20}"

  local activity_log="$ACTIVITY_DIR/claude_activity_${hname}.jsonl"
  if [ ! -f "$activity_log" ]; then
    echo -e "${YELLOW}No activity log found for '$hname'${RESET}" >&2
    echo "  Expected: $activity_log" >&2
    return 1
  fi

  local total_events
  total_events=$(wc -l < "$activity_log" | tr -d ' ')

  local source_cmd="cat"
  local showing="all $total_events"
  if [ "$tail_n" -gt 0 ] && [ "$tail_n" -lt "$total_events" ]; then
    source_cmd="tail -$tail_n"
    showing="last $tail_n of $total_events"
  fi

  echo -e "${BOLD}Activity log for $hname${RESET} ($showing events)"
  echo ""

  $source_cmd "$activity_log" | while IFS= read -r line; do
    local ts tool file cmd
    ts=$(echo "$line" | jq -r '.ts // ""' 2>/dev/null | sed 's/T/ /' | sed 's/Z//')
    tool=$(echo "$line" | jq -r '.tool // ""' 2>/dev/null)
    file=$(echo "$line" | jq -r '.file // ""' 2>/dev/null)
    cmd=$(echo "$line" | jq -r '.cmd // ""' 2>/dev/null | head -c 120)

    if [ -n "$file" ]; then
      printf "  ${DIM}%s${RESET}  %-6s  %s\n" "$ts" "$tool" "$file"
    elif [ -n "$cmd" ]; then
      printf "  ${DIM}%s${RESET}  %-6s  %s\n" "$ts" "$tool" "$cmd"
    else
      printf "  ${DIM}%s${RESET}  %-6s\n" "$ts" "$tool"
    fi
  done
}

# ══════════════════════════════════════════════════════════════════
# CMD: health
# ══════════════════════════════════════════════════════════════════
cmd_health() {
  echo -e "${BOLD}Control Plane Health${RESET}"
  echo ""

  # Daemon status
  local pid_file="$STATE_DIR/control-plane.pid"
  if [ -f "$pid_file" ]; then
    local daemon_pid
    daemon_pid=$(cat "$pid_file" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$daemon_pid" ] && kill -0 "$daemon_pid" 2>/dev/null; then
      echo -e "  Daemon: ${GREEN}running${RESET} (PID $daemon_pid)"
    else
      echo -e "  Daemon: ${RED}dead${RESET} (stale PID $daemon_pid)"
    fi
  else
    echo -e "  Daemon: ${YELLOW}not started${RESET}"
  fi

  # Health file
  if [ -f "$HEALTH_FILE" ]; then
    local updated_at
    updated_at=$(jq -r '.updated_at // "unknown"' "$HEALTH_FILE" 2>/dev/null)
    echo -e "  Last check: $updated_at"
    echo ""

    echo -e "  ${BOLD}Per-Harness Health:${RESET}"
    jq -r '.harnesses // {} | to_entries[] | "    \(.key): worker=\(.value.worker.status // "?") monitor=\(.value.monitor.status // "?") restarts=\(.value.worker.restarts // 0)"' \
      "$HEALTH_FILE" 2>/dev/null || echo "    (no data)"
  else
    echo -e "  Health file: ${YELLOW}not found${RESET}"
  fi

  echo ""

  # Sweep state
  local sweep_state="$STATE_DIR/sweep-state.json"
  if [ -f "$sweep_state" ]; then
    echo -e "  ${BOLD}Sweep Last Run:${RESET}"
    jq -r 'to_entries[] | "    \(.key): \(.value)"' "$sweep_state" 2>/dev/null || echo "    (empty)"
  fi

  echo ""

  # Metrics summary
  if [ -f "$METRICS_FILE" ]; then
    local metrics_lines
    metrics_lines=$(wc -l < "$METRICS_FILE" | tr -d ' ')
    echo -e "  Metrics: $metrics_lines events in $METRICS_FILE"
  fi
}

# ══════════════════════════════════════════════════════════════════
# Shared: Discover all Claude Code panes
# ══════════════════════════════════════════════════════════════════
# Populates parallel arrays: _PANE_IDS, _PANE_TARGETS, _PANE_PIDS, _PANE_HARNESSES, _PANE_TASKS, _PANE_STATES
# Call _discover_panes before using any of these arrays.
_discover_panes() {
  _PANE_IDS=()
  _PANE_TARGETS=()
  _PANE_PIDS=()
  _PANE_HARNESSES=()
  _PANE_TASKS=()
  _PANE_STATES=()
  _PANE_IDLE_SECS=()

  local ptarget ppid pane_id
  while IFS=$'\t' read -r ptarget ppid pane_id; do
    # Check children for claude process
    local is_claude=false
    for cpid in $(pgrep -P "$ppid" 2>/dev/null | head -5); do
      ps -o command= -p "$cpid" 2>/dev/null | grep -q "^claude " && is_claude=true && break
    done
    $is_claude || continue

    # Skip monitor panes
    local ptitle
    ptitle=$(tmux display-message -t "$pane_id" -p '#{pane_title}' 2>/dev/null || echo "")
    [[ "$ptitle" == MONITOR* ]] && continue

    # Determine harness from registry
    local harness=""
    if [ -f "$REGISTRY" ]; then
      harness=$(jq -r --arg pid "$pane_id" '(.panes // {})[$pid] // ""' "$REGISTRY" 2>/dev/null || echo "")
    fi
    # Fallback: pane registry
    if [ -z "$harness" ]; then
      harness=$(pane_registry_read "$pane_id" | jq -r '.harness // ""' 2>/dev/null || echo "")
    fi

    # Task from pane registry
    local task=""
    task=$(pane_registry_read "$pane_id" | jq -r '.task // ""' 2>/dev/null || echo "")

    # TUI state from pane capture (priority: blocked > thinking > active > idle)
    local state="idle"
    local snap
    snap=$(tmux capture-pane -t "$pane_id" -p 2>/dev/null | grep -v '^[[:space:]]*$' | tail -10)
    # Check for active tool use (spinner chars) or tool names
    if echo "$snap" | grep -qE '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]'; then
      state="active"
    elif echo "$snap" | grep -qE '(Reading|Writing|Editing|Searching|Globbing|Grepping|WebFetch)'; then
      state="active"
    fi
    # Thinking overrides active (agent is processing, not using tools)
    echo "$snap" | grep -qE '(Thinking|Herding|Discombobulating|Processing|Reasoning|thought for)' && state="thinking"
    # Blocked overrides everything
    echo "$snap" | grep -qE '(BLOCKED|Permission denied)' && state="blocked"

    # Idle time from activity log (more reliable than pane_activity for Claude TUI)
    local idle_secs=0
    if [ -n "${harness}" ]; then
      local alog="$ACTIVITY_DIR/claude_activity_${harness}.jsonl"
      if [ -f "$alog" ] && [ -s "$alog" ]; then
        local last_ts
        last_ts=$(tail -1 "$alog" | jq -r '.ts // ""' 2>/dev/null || echo "")
        if [ -n "$last_ts" ]; then
          local last_epoch
          last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_ts" +%s 2>/dev/null || date -d "$last_ts" +%s 2>/dev/null || echo "0")
          [ "$last_epoch" -gt 0 ] && idle_secs=$(( $(date +%s) - last_epoch ))
        fi
      fi
    fi
    # Fallback: pane activity timestamp
    if [ "$idle_secs" -eq 0 ]; then
      local pane_activity
      pane_activity=$(tmux display-message -t "$pane_id" -p '#{pane_activity}' 2>/dev/null || echo "0")
      if [ -n "$pane_activity" ] && [ "$pane_activity" -gt 0 ]; then
        idle_secs=$(( $(date +%s) - pane_activity ))
      fi
    fi

    _PANE_IDS+=("$pane_id")
    _PANE_TARGETS+=("$ptarget")
    _PANE_PIDS+=("$ppid")
    _PANE_HARNESSES+=("$harness")
    _PANE_TASKS+=("$task")
    _PANE_STATES+=("$state")
    _PANE_IDLE_SECS+=("$idle_secs")
  done < <(tmux list-panes -a -F $'#{session_name}:#{window_index}.#{pane_index}\t#{pane_pid}\t#{pane_id}' 2>/dev/null)
}

# Format idle seconds as human-readable
_fmt_idle() {
  local s="$1"
  if [ "$s" -lt 60 ]; then echo "${s}s"
  elif [ "$s" -lt 3600 ]; then echo "$((s / 60))m"
  else echo "$((s / 3600))h$((s % 3600 / 60))m"
  fi
}

# ══════════════════════════════════════════════════════════════════
# CMD: agents
# ══════════════════════════════════════════════════════════════════
cmd_agents() {
  _discover_panes

  local total=${#_PANE_IDS[@]}
  if [ "$total" -eq 0 ]; then
    echo "No Claude Code agents found in tmux."
    return 0
  fi

  local registered=0 unregistered=0

  echo -e "${BOLD}Claude Code Agents:${RESET}"
  echo ""
  printf "  ${DIM}%-8s %-8s %-10s %-6s %-24s %s${RESET}\n" "PANE" "PID" "STATUS" "IDLE" "HARNESS" "TASK"

  local i
  for i in $(seq 0 $((total - 1))); do
    local pane_target="${_PANE_TARGETS[$i]}"
    local ppid="${_PANE_PIDS[$i]}"
    local harness="${_PANE_HARNESSES[$i]}"
    local task="${_PANE_TASKS[$i]}"
    local state="${_PANE_STATES[$i]}"
    local idle_s="${_PANE_IDLE_SECS[$i]}"

    local idle_str
    idle_str=$(_fmt_idle "$idle_s")

    local harness_display
    if [ -n "$harness" ]; then
      harness_display="$harness"
      registered=$((registered + 1))
    else
      harness_display="${YELLOW}(unregistered)${RESET}"
      unregistered=$((unregistered + 1))
    fi

    local state_display
    case "$state" in
      active)   state_display="${GREEN}active${RESET}" ;;
      thinking) state_display="${CYAN}thinking${RESET}" ;;
      blocked)  state_display="${RED}blocked${RESET}" ;;
      *)        state_display="${DIM}idle${RESET}" ;;
    esac

    printf "  %-8s %-8s %-10b %-6s %-24b %s\n" \
      "$pane_target" "$ppid" "$state_display" "$idle_str" "$harness_display" "${task:--}"
  done

  echo ""
  echo -e "  ${BOLD}$total agents total:${RESET} ${GREEN}$registered registered${RESET}, ${YELLOW}$unregistered unregistered${RESET}"
  if [ "$unregistered" -gt 0 ]; then
    echo -e "  Run ${BOLD}harness register${RESET} to bind unregistered sessions."
  fi
}

# ══════════════════════════════════════════════════════════════════
# CMD: register
# ══════════════════════════════════════════════════════════════════
cmd_register() {
  local mode="${1:-interactive}"

  case "$mode" in
    --show)
      _register_show
      ;;
    --auto)
      _register_auto
      ;;
    --help|-h)
      echo "Usage:"
      echo "  harness register                          Interactive fzf picker"
      echo "  harness register <pane> <harness>         Direct bind"
      echo "  harness register --auto                   Auto-register from pane metadata"
      echo "  harness register --show                   Show current registry"
      ;;
    *)
      # Check if it's a direct bind (two positional args)
      if [ -n "$mode" ] && [ -n "${2:-}" ]; then
        _register_direct "$mode" "$2"
      else
        _register_interactive
      fi
      ;;
  esac
}

_register_show() {
  local pane_reg="${PANE_REGISTRY:-$STATE_DIR/pane-registry.json}"

  echo -e "${BOLD}Pane Registry (Tier 0 — primary):${RESET}"
  echo ""
  if [ -f "$pane_reg" ]; then
    local harness_count
    harness_count=$(jq '[to_entries[] | select(.value | has("harness"))] | length' "$pane_reg" 2>/dev/null || echo "0")
    if [ "$harness_count" -gt 0 ]; then
      jq -r '[to_entries[] | select(.value | has("harness"))] | sort_by(.value.updated_at) | reverse | .[] | "  \(.key) → \(.value.harness)  (\(.value.display // "no status"))"' "$pane_reg" 2>/dev/null
    else
      echo -e "  ${DIM}(no harness entries)${RESET}"
    fi
  else
    echo -e "  ${DIM}(file missing)${RESET}"
  fi

  echo ""
  echo -e "${BOLD}Session Registry (legacy fallback):${RESET}"
  echo ""
  if [ ! -f "$REGISTRY" ] || [ "$(jq 'length' "$REGISTRY" 2>/dev/null)" = "0" ]; then
    echo -e "  ${DIM}(empty)${RESET}"
    return 0
  fi

  local pane_count
  pane_count=$(jq '(.panes // {}) | length' "$REGISTRY" 2>/dev/null || echo "0")
  if [ "$pane_count" -gt 0 ]; then
    echo -e "  ${BOLD}Pane Bindings:${RESET}"
    jq -r '(.panes // {}) | to_entries[] | "    \(.key) → \(.value)"' "$REGISTRY" 2>/dev/null
  fi

  local sess_count
  sess_count=$(jq '(.sessions // {}) | length' "$REGISTRY" 2>/dev/null || echo "0")
  if [ "$sess_count" -gt 0 ]; then
    echo -e "  ${BOLD}Session Bindings:${RESET}"
    jq -r '(.sessions // {}) | to_entries[] | "    \(.key[0:16])... → \(.value)"' "$REGISTRY" 2>/dev/null
  fi
}

_register_auto() {
  _discover_panes
  local count=0

  local i
  for i in $(seq 0 $((${#_PANE_IDS[@]} - 1))); do
    local pane_id="${_PANE_IDS[$i]}"
    local pane_target="${_PANE_TARGETS[$i]}"
    local harness="${_PANE_HARNESSES[$i]}"

    # Already registered
    [ -n "$harness" ] && {
      local in_registry
      in_registry=$(jq -r --arg pid "$pane_id" '(.panes // {})[$pid] // ""' "$REGISTRY" 2>/dev/null || echo "")
      [ -n "$in_registry" ] && continue
    }

    # Try pane registry
    local meta_harness=""
    meta_harness=$(pane_registry_read "$pane_id" | jq -r '.harness // ""' 2>/dev/null || echo "")

    if [ -n "$meta_harness" ]; then
      pane_registry_update "$pane_id" "$meta_harness" "auto-registered" "0" "0" "${meta_harness}: auto-registered"
      locked_jq_write "$REGISTRY" "session-registry" \
        '(.panes // {}) as $p | .panes = ($p + {($pid): $h})' \
        --arg pid "$pane_id" --arg h "$meta_harness"
      echo -e "  ${GREEN}✓${RESET} Registered $pane_target → $meta_harness"
      count=$((count + 1))
    fi
  done

  if [ "$count" -eq 0 ]; then
    echo "No unregistered panes with metadata found."
  else
    echo -e "\n${GREEN}Registered $count pane(s).${RESET}"
  fi
}

# Resolve pane target (h:3.0) to pane_id (%NNN)
_resolve_pane_id() {
  local target="$1"
  # If already a pane_id (%NNN), return as-is
  [[ "$target" == %* ]] && echo "$target" && return
  # Lookup by target
  tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_id}' 2>/dev/null \
    | awk -v t="$target" '$1 == t {print $2; exit}'
}

_register_direct() {
  local pane_target="$1"
  local harness="$2"

  # Resolve pane target to pane_id
  local pane_id
  pane_id=$(_resolve_pane_id "$pane_target")
  if [ -z "$pane_id" ]; then
    echo -e "${RED}Error: pane '$pane_target' not found in tmux${RESET}" >&2
    return 1
  fi

  # Verify harness exists
  local pfile
  pfile=$(harness_progress_path "$harness" 2>/dev/null || echo "")
  if [ -z "$pfile" ] || [ ! -f "$pfile" ]; then
    echo -e "${RED}Error: harness '$harness' not found${RESET}" >&2
    echo "Available harnesses:" >&2
    harness_list_active 2>/dev/null | awk -F'|' '{print "  " $1}' >&2
    return 1
  fi

  # Write to BOTH registries (pane-registry is Tier 0 / primary)
  pane_registry_update "$pane_id" "$harness" "registered" "0" "0" "${harness}: registered"
  locked_jq_write "$REGISTRY" "session-registry" \
    '(.panes // {}) as $p | .panes = ($p + {($pid): $h})' \
    --arg pid "$pane_id" --arg h "$harness"

  echo -e "${GREEN}✓${RESET} Registered $pane_target ($pane_id) → $harness"
}

_register_interactive() {
  # Check fzf availability
  if ! command -v fzf >/dev/null 2>&1; then
    echo -e "${RED}Error: fzf not found. Install with 'brew install fzf'${RESET}" >&2
    echo "Alternatively, use direct mode: harness register <pane> <harness>" >&2
    return 1
  fi

  _discover_panes

  # Build list of unregistered panes
  local unreg_lines=()
  local i
  for i in $(seq 0 $((${#_PANE_IDS[@]} - 1))); do
    local in_registry=""
    if [ -f "$REGISTRY" ]; then
      in_registry=$(jq -r --arg pid "${_PANE_IDS[$i]}" '(.panes // {})[$pid] // ""' "$REGISTRY" 2>/dev/null || echo "")
    fi
    if [ -z "$in_registry" ]; then
      local idle_str
      idle_str=$(_fmt_idle "${_PANE_IDLE_SECS[$i]}")
      local meta_h="${_PANE_HARNESSES[$i]}"
      local hint=""
      [ -n "$meta_h" ] && hint=" [meta: $meta_h]"
      unreg_lines+=("${_PANE_TARGETS[$i]}  [PID ${_PANE_PIDS[$i]}]  ${_PANE_STATES[$i]}  idle ${idle_str}${hint}")
    fi
  done

  if [ ${#unreg_lines[@]} -eq 0 ]; then
    echo "All Claude sessions are already registered."
    echo "Use 'harness register --show' to see current bindings."
    return 0
  fi

  echo -e "${BOLD}Select an unregistered Claude session:${RESET}"
  local selected_line
  selected_line=$(printf '%s\n' "${unreg_lines[@]}" | fzf --prompt="Session > " --height=15 --reverse --no-multi)
  [ -z "$selected_line" ] && { echo "Cancelled."; return 0; }

  # Extract pane target from selection (first field)
  local sel_pane
  sel_pane=$(echo "$selected_line" | awk '{print $1}')

  # Build list of active harnesses
  local harness_lines=()
  while IFS='|' read -r hname _rest; do
    [ -z "$hname" ] && continue
    local pfile
    pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
    [ ! -f "$pfile" ] && continue
    local done_c total lifecycle
    done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
    total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
    lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")
    harness_lines+=("$hname  ${done_c}/${total} tasks  [$lifecycle]")
  done < <(harness_list_active 2>/dev/null)

  if [ ${#harness_lines[@]} -eq 0 ]; then
    echo -e "${YELLOW}No active harnesses found.${RESET}"
    return 1
  fi

  echo ""
  echo -e "${BOLD}Select harness for $sel_pane:${RESET}"
  local sel_harness_line
  sel_harness_line=$(printf '%s\n' "${harness_lines[@]}" | fzf --prompt="Harness > " --height=15 --reverse --no-multi)
  [ -z "$sel_harness_line" ] && { echo "Cancelled."; return 0; }

  local sel_harness
  sel_harness=$(echo "$sel_harness_line" | awk '{print $1}')

  _register_direct "$sel_pane" "$sel_harness"
}

# ══════════════════════════════════════════════════════════════════
# CMD: dashboard
# ══════════════════════════════════════════════════════════════════
cmd_dashboard() {
  # Check fzf availability
  if ! command -v fzf >/dev/null 2>&1; then
    echo -e "${RED}Error: fzf not found. Install with 'brew install fzf'${RESET}" >&2
    return 1
  fi

  # Create a temp script for the fzf preview
  local preview_script
  local _state_tmp="${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/tmp"
  mkdir -p "$_state_tmp" 2>/dev/null
  preview_script=$(mktemp "$_state_tmp/harness-dash-preview.XXXXXX")
  cat > "$preview_script" <<'PREVIEW_EOF'
#!/usr/bin/env bash
# Preview script for harness dashboard — receives the selected line as $1
source "$HOME/.claude-ops/lib/harness-jq.sh" 2>/dev/null || true
source "$HOME/.claude-ops/lib/harness-pane.sh" 2>/dev/null || true
REGISTRY="${HARNESS_SESSION_REGISTRY:-$HOME/.claude-ops/state/session-registry.json}"
ACTIVITY_DIR="${HARNESS_ACTIVITY_DIR:-$HOME/.claude-ops/state/activity}"
HEALTH_FILE="${HARNESS_HEALTH_FILE:-$HOME/.claude-ops/state/health.json}"

line="$1"
hname=$(echo "$line" | awk '{print $2}')

pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
[ -z "$pfile" ] || [ ! -f "$pfile" ] && { echo "No progress file for: $hname"; exit 0; }

mission=$(jq -r '.mission // "(no mission)"' "$pfile" 2>/dev/null | head -c 120)
done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
current=$(harness_current_task "$pfile" 2>/dev/null || echo "none")
lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")

echo "Mission: $mission"
echo "Progress: $done_c/$total tasks [$lifecycle]"
echo "Current: $current"
echo ""

# Worker info
worker_result=$(find_worker_pane "$hname" 2>/dev/null || echo "")
if [ -n "$worker_result" ]; then
  pane_id="${worker_result%%|*}"
  pane_target="${worker_result#*|}"
  pane_pid=$(tmux display-message -t "$pane_id" -p '#{pane_pid}' 2>/dev/null || echo "?")
  pane_activity=$(tmux display-message -t "$pane_id" -p '#{pane_activity}' 2>/dev/null || echo "0")
  idle_secs=0
  [ -n "$pane_activity" ] && [ "$pane_activity" -gt 0 ] && idle_secs=$(( $(date +%s) - pane_activity ))
  if [ "$idle_secs" -lt 60 ]; then idle_str="${idle_secs}s"
  elif [ "$idle_secs" -lt 3600 ]; then idle_str="$((idle_secs / 60))m"
  else idle_str="$((idle_secs / 3600))h"
  fi
  echo "Worker: $pane_target [PID $pane_pid] idle ${idle_str}"

  # Monitor
  monitor_pane=$(find_monitor_pane "$hname" "$pane_id" "$pane_target" 2>/dev/null || echo "")
  [ -n "$monitor_pane" ] && echo "Monitor: $monitor_pane"
else
  echo "Worker: not running"
fi

# Health
if [ -f "$HEALTH_FILE" ]; then
  hdata=$(jq -r --arg h "$hname" '.harnesses[$h] // empty' "$HEALTH_FILE" 2>/dev/null || echo "")
  if [ -n "$hdata" ]; then
    w_st=$(echo "$hdata" | jq -r '.worker.status // "?"')
    m_st=$(echo "$hdata" | jq -r '.monitor.status // "?"')
    restarts=$(echo "$hdata" | jq -r '.worker.restarts // 0')
    echo "Health: worker=$w_st monitor=$m_st restarts=$restarts"
  fi
fi

echo ""

# Recent activity
activity_log="$ACTIVITY_DIR/claude_activity_${hname}.jsonl"
if [ -f "$activity_log" ] && [ -s "$activity_log" ]; then
  echo "Recent activity:"
  tail -8 "$activity_log" | while IFS= read -r aline; do
    ts=$(echo "$aline" | jq -r '.ts // ""' 2>/dev/null | sed 's/T/ /' | sed 's/Z//' | sed 's/.*\(...........\)/\1/')
    tool=$(echo "$aline" | jq -r '.tool // ""' 2>/dev/null)
    file=$(echo "$aline" | jq -r '.file // ""' 2>/dev/null)
    cmd=$(echo "$aline" | jq -r '.cmd // ""' 2>/dev/null | head -c 50)
    detail="${file:-$cmd}"
    printf "  %s  %-6s  %s\n" "$ts" "$tool" "$detail"
  done
fi

echo ""

# Task list (compact)
echo "Tasks:"
jq -r '.tasks | to_entries[] | "\(if .value.status == "completed" then "  ✓" elif .value.status == "in_progress" then "  →" else "  ○" end) \(.key)"' "$pfile" 2>/dev/null | head -12
task_count=$(jq '.tasks | length' "$pfile" 2>/dev/null || echo "0")
[ "$task_count" -gt 12 ] && echo "  ... and $((task_count - 12)) more"
PREVIEW_EOF
  chmod +x "$preview_script"

  # Create the actions handler script
  local actions_script
  actions_script=$(mktemp "$_state_tmp/harness-dash-actions.XXXXXX")
  cat > "$actions_script" <<'ACTIONS_EOF'
#!/usr/bin/env bash
# Actions submenu for a harness
source "$HOME/.claude-ops/lib/harness-jq.sh" 2>/dev/null || true
source "$HOME/.claude-ops/lib/harness-pane.sh" 2>/dev/null || true
REGISTRY="${HARNESS_SESSION_REGISTRY:-$HOME/.claude-ops/state/session-registry.json}"

hname="$1"
action=$(printf 'View status\nView logs (last 50)\nRegister session\nNudge worker\nStop harness\nForce stop (kill)\nRestart (rotate)\nFocus worker pane\n' | fzf --prompt="$hname > " --height=12 --reverse --no-multi)

case "$action" in
  "View status")
    bash "$HOME/.claude-ops/bin/harness.sh" status "$hname"
    read -rp "Press Enter to continue..."
    ;;
  "View logs (last 50)")
    bash "$HOME/.claude-ops/bin/harness.sh" logs "$hname" --tail 50
    read -rp "Press Enter to continue..."
    ;;
  "Register session")
    bash "$HOME/.claude-ops/bin/harness.sh" register
    read -rp "Press Enter to continue..."
    ;;
  "Nudge worker")
    worker_result=$(find_worker_pane "$hname" 2>/dev/null || echo "")
    if [ -n "$worker_result" ]; then
      pane_id="${worker_result%%|*}"
      read -rp "Nudge message: " nudge_msg
      if [ -n "$nudge_msg" ]; then
        tmux send-keys -t "$pane_id" "$nudge_msg" 2>/dev/null
        tmux send-keys -t "$pane_id" -H 0d 2>/dev/null
        echo "Sent nudge to $hname worker."
      fi
    else
      echo "No worker pane found for $hname"
    fi
    read -rp "Press Enter to continue..."
    ;;
  "Stop harness")
    bash "$HOME/.claude-ops/bin/harness.sh" stop "$hname"
    read -rp "Press Enter to continue..."
    ;;
  "Force stop (kill)")
    bash "$HOME/.claude-ops/bin/harness.sh" stop "$hname" --force
    read -rp "Press Enter to continue..."
    ;;
  "Restart (rotate)")
    bash "$HOME/.claude-ops/bin/harness.sh" restart "$hname"
    read -rp "Press Enter to continue..."
    ;;
  "Focus worker pane")
    worker_result=$(find_worker_pane "$hname" 2>/dev/null || echo "")
    if [ -n "$worker_result" ]; then
      pane_id="${worker_result%%|*}"
      tmux select-pane -t "$pane_id" 2>/dev/null
      echo "Focused $hname worker pane."
    else
      echo "No worker pane found."
    fi
    ;;
esac
ACTIONS_EOF
  chmod +x "$actions_script"

  # Main dashboard loop
  while true; do
    # Build harness list for fzf
    local dash_lines=()
    while IFS='|' read -r hname project_root; do
      [ -z "$hname" ] && continue
      local pfile
      pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
      [ ! -f "$pfile" ] && continue

      local status done_c total lifecycle label
      status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null || echo "unknown")
      done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
      total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
      lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")

      if [ "$lifecycle" = "long-running" ]; then label="lr"
      elif [ "$status" = "done" ]; then label="done"
      else
        local waves
        waves=$(jq '.waves // [] | length' "$pfile" 2>/dev/null || echo "0")
        if [ "$waves" -gt 0 ]; then label="w:$waves"
        else label="b"
        fi
      fi

      local icon
      if [ "$status" = "active" ]; then icon="●"
      else icon="○"
      fi

      dash_lines+=("$(printf '%s %-24s %3s/%-3s [%s]' "$icon" "$hname" "$done_c" "$total" "$label")")
    done < <(harness_list_all 2>/dev/null)

    if [ ${#dash_lines[@]} -eq 0 ]; then
      echo "No harnesses found."
      break
    fi

    local selected
    selected=$(printf '%s\n' "${dash_lines[@]}" | fzf \
      --prompt="harness> " \
      --header="Enter: actions | ctrl-r: register | ctrl-a: agents | q/esc: quit" \
      --preview="bash $preview_script {}" \
      --preview-window=right:55%:wrap \
      --height=90% \
      --reverse \
      --bind="ctrl-r:execute(bash $HOME/.claude-ops/bin/harness.sh register)+reload(bash $HOME/.claude-ops/bin/harness.sh _dashboard_lines)" \
      --bind="ctrl-a:execute(bash $HOME/.claude-ops/bin/harness.sh agents; read -rp 'Press Enter...')" \
      --expect=enter,ctrl-c,esc \
      --no-multi)

    local key
    key=$(echo "$selected" | head -1)
    local choice
    choice=$(echo "$selected" | tail -1)

    case "$key" in
      ctrl-c|esc|"")
        break
        ;;
      enter)
        if [ -n "$choice" ]; then
          local sel_hname
          sel_hname=$(echo "$choice" | awk '{print $2}')
          bash "$actions_script" "$sel_hname"
        fi
        ;;
    esac
  done

  # Cleanup
  rm -f "$preview_script" "$actions_script"
}

# Internal helper for dashboard reload binding
_cmd_dashboard_lines() {
  while IFS='|' read -r hname project_root; do
    [ -z "$hname" ] && continue
    local pfile
    pfile=$(harness_progress_path "$hname" 2>/dev/null || echo "")
    [ ! -f "$pfile" ] && continue

    local status done_c total lifecycle label
    status=$(jq -r '.status // "unknown"' "$pfile" 2>/dev/null || echo "unknown")
    done_c=$(harness_done_count "$pfile" 2>/dev/null || echo "0")
    total=$(harness_total_count "$pfile" 2>/dev/null || echo "0")
    lifecycle=$(harness_lifecycle "$pfile" 2>/dev/null || echo "bounded")

    if [ "$lifecycle" = "long-running" ]; then label="lr"
    elif [ "$status" = "done" ]; then label="done"
    else
      local waves
      waves=$(jq '.waves // [] | length' "$pfile" 2>/dev/null || echo "0")
      if [ "$waves" -gt 0 ]; then label="w:$waves"
      else label="b"
      fi
    fi

    local icon
    [ "$status" = "active" ] && icon="●" || icon="○"

    printf '%s %-24s %3s/%-3s [%s]\n' "$icon" "$hname" "$done_c" "$total" "$label"
  done < <(harness_list_all 2>/dev/null)
}

# ══════════════════════════════════════════════════════════════════
# CMD: scaffold
# ══════════════════════════════════════════════════════════════════
cmd_scaffold() {
  local name="$1"
  local project="$2"
  local long_running="${3:-}"

  if [ ! -d "$project" ]; then
    echo -e "${RED}Error: project directory '$project' not found${RESET}" >&2
    return 1
  fi

  local scaffold_args=("$name" "$project")
  [ "$long_running" = "--long-running" ] && scaffold_args=("--long-running" "${scaffold_args[@]}")

  bash "$HOME/.claude-ops/scripts/scaffold.sh" "${scaffold_args[@]}"
}

# ══════════════════════════════════════════════════════════════════
# CMD: create (scaffold + populate from description)
# ══════════════════════════════════════════════════════════════════
cmd_create() {
  local name="$1"
  local project="${2:-$(pwd)}"
  local long_running="${3:-}"
  local description="${4:-}"

  if [ ! -d "$project" ]; then
    echo -e "${RED}Error: project directory '$project' not found${RESET}" >&2
    return 1
  fi

  # Run scaffold (--from-description handles mission + spec.md population)
  local scaffold_args=("$name" "$project")
  [ "$long_running" = "--long-running" ] && scaffold_args=("--long-running" "${scaffold_args[@]}")
  [ -n "$description" ] && scaffold_args=("--from-description" "$description" "${scaffold_args[@]}")
  bash "$HOME/.claude-ops/scripts/scaffold.sh" "${scaffold_args[@]}"

  echo ""
  echo -e "${BOLD}Next steps:${RESET}"
  if [ -n "$description" ]; then
    echo "  Mission set from --description. Now:"
    echo "  1. Edit .claude/harness/$name/progress.json — add tasks with blockedBy DAG"
    echo "  2. Edit .claude/harness/$name/harness.md — write terrain map"
    echo "  3. Edit .claude/harness/$name/spec.md — paste requirements"
    echo "  4. Edit .claude/harness/$name/acceptance.md — map criteria"
    echo "  5. Launch:  harness start $name"
  else
    echo "  1. Edit .claude/harness/$name/spec.md — paste requirements"
    echo "  2. Edit .claude/harness/$name/acceptance.md — map criteria"
    echo "  3. Edit .claude/harness/$name/harness.md — write mission + terrain"
    echo "  4. Edit .claude/harness/$name/progress.json — add real tasks"
    echo "  5. Launch:  harness start $name"
  fi
}

# ══════════════════════════════════════════════════════════════════
# CMD: web
# ══════════════════════════════════════════════════════════════════
cmd_web() {
  local no_open="${1:-false}"
  local api_script="$HOME/.claude-ops/scripts/harness-api.ts"
  local port="${HARNESS_API_PORT:-7777}"

  if ! command -v bun &>/dev/null; then
    echo -e "${RED}Error: bun is required to run the API server${RESET}" >&2
    return 1
  fi

  # Check if API is already running on the port
  if lsof -i ":$port" -sTCP:LISTEN &>/dev/null; then
    echo -e "${GREEN}API already running on :${port}${RESET}"
  else
    echo -e "Starting harness-api on :${port}..."
    local _logs_dir="${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/logs"
    mkdir -p "$_logs_dir" 2>/dev/null
    nohup bun run "$api_script" >"$_logs_dir/harness-api.log" 2>&1 &
    local pid=$!
    # Wait briefly for the server to come up
    for i in $(seq 1 10); do
      sleep 0.5
      if curl -sf "http://localhost:${port}/health" >/dev/null 2>&1; then
        echo -e "${GREEN}API started (PID ${pid})${RESET}"
        break
      fi
      if [ "$i" = "10" ]; then
        echo -e "${YELLOW}Warning: API may not be ready yet. Check ${_logs_dir}/harness-api.log${RESET}"
      fi
    done
  fi

  if [ "$no_open" != "true" ]; then
    echo "Opening https://qbg.dev/harness"
    open "https://qbg.dev/harness"
  fi
}

# ══════════════════════════════════════════════════════════════════
# Parse arguments
# ══════════════════════════════════════════════════════════════════
[ $# -eq 0 ] && usage

COMMAND="$1"
shift

case "$COMMAND" in
  list|ls)
    _paged cmd_list
    ;;
  status|st)
    _paged cmd_status "${1:-}"
    ;;
  stop)
    [ $# -eq 0 ] && { echo "Error: 'stop' requires a harness name or --all" >&2; usage; }
    TARGET="$1"; shift
    FORCE=false
    while [ $# -gt 0 ]; do
      case "$1" in
        --force|-f) FORCE=true; shift ;;
        *) echo "Unknown option: $1" >&2; usage ;;
      esac
    done
    cmd_stop "$TARGET" "$FORCE"
    ;;
  start)
    [ $# -eq 0 ] && { echo "Error: 'start' requires a harness name" >&2; usage; }
    cmd_start "$1" "${2:-}"
    ;;
  restart)
    [ $# -eq 0 ] && { echo "Error: 'restart' requires a harness name" >&2; usage; }
    cmd_restart "$1"
    ;;
  logs|log)
    [ $# -eq 0 ] && { echo "Error: 'logs' requires a harness name" >&2; usage; }
    HNAME="$1"; shift
    TAIL_N=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --tail|-n) TAIL_N="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; usage ;;
      esac
    done
    _paged cmd_logs "$HNAME" "$TAIL_N"
    ;;
  health)
    _paged cmd_health
    ;;
  scaffold|new)
    [ $# -lt 2 ] && { echo "Error: 'scaffold' requires <name> <project>" >&2; usage; }
    NAME="$1"; PROJECT="$2"; shift 2
    LR=""
    [ $# -gt 0 ] && [ "$1" = "--long-running" ] && LR="--long-running"
    cmd_scaffold "$NAME" "$PROJECT" "$LR"
    ;;
  create)
    [ $# -lt 1 ] && { echo "Error: 'create' requires <name>" >&2; usage; }
    NAME="$1"; shift
    PROJECT="$(pwd)"
    LR=""
    DESC=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --long-running) LR="--long-running"; shift ;;
        --description|-d) DESC="$2"; shift 2 ;;
        *) [ -d "$1" ] && PROJECT="$1" && shift || { echo "Unknown option: $1" >&2; usage; } ;;
      esac
    done
    cmd_create "$NAME" "$PROJECT" "$LR" "$DESC"
    ;;
  agents|ag)
    _paged cmd_agents
    ;;
  register|reg)
    cmd_register "${1:-}" "${2:-}"
    ;;
  dashboard|dash)
    cmd_dashboard
    ;;
  web)
    NO_OPEN=false
    while [ $# -gt 0 ]; do
      case "$1" in
        --no-open) NO_OPEN=true; shift ;;
        *) echo "Unknown option: $1" >&2; usage ;;
      esac
    done
    cmd_web "$NO_OPEN"
    ;;
  _dashboard_lines)
    # Internal: used by dashboard fzf reload binding
    _cmd_dashboard_lines
    ;;
  help|--help|-h)
    usage 0
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    usage
    ;;
esac
