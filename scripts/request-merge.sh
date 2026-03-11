#!/usr/bin/env bash
# request-merge.sh — Request chief-of-staff to merge current worker branch
#
# Usage: request-merge.sh [--service <static|web|core>] [--desc <description>]
#
# Checks that we're on a worker branch (worker/*), then emits a bus event
# of type worker.merge-request to notify the chief-of-staff.
#
# Written by infra-monitor cycle 2 (2026-03-03) — needed by worker-fleet-mcp.test.ts
# and called by worker-commit.sh --merge-request flag.

set -euo pipefail

SERVICE=""
DESC=""

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --desc)
      DESC="${2:-}"
      shift 2
      ;;
    --*)
      echo "Error: Unknown flag: $1" >&2
      echo "Usage: $0 [--service <static|web|core>] [--desc <description>]" >&2
      exit 1
      ;;
    *)
      echo "Error: Unexpected argument: $1" >&2
      echo "Usage: $0 [--service <static|web|core>] [--desc <description>]" >&2
      exit 1
      ;;
  esac
done

# Determine current branch
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# Must be on a worker branch
if [[ ! "$BRANCH" =~ ^worker/ ]]; then
  echo "Not on a worker branch (current: ${BRANCH:-detached HEAD})" >&2
  echo "request-merge.sh must be run from a worker/* branch" >&2
  exit 1
fi

WORKER_NAME="${BRANCH#worker/}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
BUS_EMIT="${HOME}/.claude-fleet/scripts/worker-bus-emit.sh"

echo "Requesting merge for branch: $BRANCH"
[[ -n "$SERVICE" ]] && echo "  service: $SERVICE"
[[ -n "$DESC" ]] && echo "  desc: $DESC"

# Emit bus event if available
if [[ -f "$BUS_EMIT" ]]; then
  PAYLOAD="{\"worker\":\"$WORKER_NAME\",\"branch\":\"$BRANCH\""
  [[ -n "$SERVICE" ]] && PAYLOAD+=",\"service\":\"$SERVICE\""
  [[ -n "$DESC" ]] && PAYLOAD+=",\"desc\":\"$DESC\""
  PAYLOAD+="}"
  bash "$BUS_EMIT" "worker.merge-request" "$PAYLOAD" || true
  echo "Merge request emitted to bus"
else
  echo "WARNING: Bus emit script not found at $BUS_EMIT — merge request not emitted"
  echo "chief-of-staff: please merge $BRANCH"
fi
