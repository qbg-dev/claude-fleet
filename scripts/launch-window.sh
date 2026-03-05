#!/usr/bin/env bash
# launch-window.sh — Launch all workers registered to a named window group.
# Discovers workers by scanning .claude/workers/*/permissions.json for matching "window" field.
# No hardcoded worker lists — workers self-register via their permissions.json.
#
# Usage:
#   bash launch-window.sh main                    # launch all workers in "main" group
#   bash launch-window.sh optimizers              # launch all workers in "optimizers" group
#   bash launch-window.sh --list                  # list all window groups and their workers
#   bash launch-window.sh --all                   # launch ALL window groups
#   bash launch-window.sh main --project /path    # specify project root
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-}"
WINDOW_NAME=""
LIST_MODE=0
ALL_MODE=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ROOT="$2"; shift 2 ;;
    --list)    LIST_MODE=1; shift ;;
    --all)     ALL_MODE=1; shift ;;
    -*)        echo "Unknown flag: $1"; exit 1 ;;
    *)
      if [ -z "$WINDOW_NAME" ]; then
        WINDOW_NAME="$1"
      else
        echo "Unexpected argument: $1"; exit 1
      fi
      shift
      ;;
  esac
done

# Auto-detect project root
if [ -z "$PROJECT_ROOT" ]; then
  PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

WORKERS_DIR="$PROJECT_ROOT/.claude/workers"

# ── Discover window→workers mapping from permissions.json ──────────
# Returns lines of "window_name worker_name"
_discover_windows() {
  for perms in "$WORKERS_DIR"/*/permissions.json; do
    [ ! -f "$perms" ] && continue
    local worker_dir; worker_dir="$(dirname "$perms")"
    local worker; worker="$(basename "$worker_dir")"
    local win; win=$(jq -r '.window // empty' "$perms" 2>/dev/null || echo "")
    # Workers without a window field → solo window named after themselves
    [ -z "$win" ] && win="$worker"
    echo "$win $worker"
  done
}

# ── List mode ──────────────────────────────────────────────────────
if [ "$LIST_MODE" -eq 1 ]; then
  echo "Window groups (from permissions.json):"
  echo ""
  _discover_windows | sort -k1,1 | awk '
    BEGIN { prev="" }
    {
      if ($1 != prev) {
        if (prev != "") printf "\n"
        printf "  %-15s %s", $1, $2
        prev = $1
      } else {
        printf ", %s", $2
      }
    }
    END { printf "\n" }
  '
  echo ""

  # Also show workers without permissions.json (ungrouped)
  ungrouped=""
  for d in "$WORKERS_DIR"/*/; do
    [ ! -d "$d" ] && continue
    local_worker="$(basename "$d")"
    [ "$local_worker" = "_archived" ] && continue
    [ "$local_worker" = "main" ] && continue
    [ ! -f "$d/permissions.json" ] && [ -f "$d/mission.md" ] && ungrouped="$ungrouped $local_worker"
  done
  if [ -n "$ungrouped" ]; then
    echo "  Ungrouped (no permissions.json, solo window each):$ungrouped"
  fi
  exit 0
fi

# ── Validate args ──────────────────────────────────────────────────
if [ "$ALL_MODE" -eq 0 ] && [ -z "$WINDOW_NAME" ]; then
  echo "Usage: launch-window.sh <window-name> | --list | --all"
  echo ""
  echo "Available windows:"
  _discover_windows | awk '{print $1}' | sort -u | sed 's/^/  /'
  exit 1
fi

# ── Collect workers to launch ──────────────────────────────────────
WORKERS_TO_LAUNCH=()

if [ "$ALL_MODE" -eq 1 ]; then
  # Launch everything
  while IFS=' ' read -r _win worker; do
    WORKERS_TO_LAUNCH+=("$worker")
  done < <(_discover_windows)
else
  # Launch specific window group
  while IFS=' ' read -r win worker; do
    [ "$win" = "$WINDOW_NAME" ] && WORKERS_TO_LAUNCH+=("$worker")
  done < <(_discover_windows)
fi

if [ ${#WORKERS_TO_LAUNCH[@]} -eq 0 ]; then
  echo "ERROR: No workers found for window '$WINDOW_NAME'"
  echo ""
  echo "Available windows:"
  _discover_windows | awk '{print $1}' | sort -u | sed 's/^/  /'
  exit 1
fi

# ── Launch ─────────────────────────────────────────────────────────
EXTRA_ARGS=()
[ -n "$PROJECT_ROOT" ] && EXTRA_ARGS+=(--project "$PROJECT_ROOT")

echo "Launching ${#WORKERS_TO_LAUNCH[@]} workers: ${WORKERS_TO_LAUNCH[*]}"

for w in "${WORKERS_TO_LAUNCH[@]}"; do
  bash "$SCRIPT_DIR/launch-flat-worker.sh" "$w" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}" &
done
wait

echo "Done — window group '${WINDOW_NAME:-all}' launched"
