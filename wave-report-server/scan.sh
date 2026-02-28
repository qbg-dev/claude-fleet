#!/usr/bin/env bash
# scan.sh — Pre-startup scanner for wave report server
# Discovers harnesses, validates progress files, writes registry.json
# Optionally notifies agents about issues via Nexus or tmux
#
# Usage:
#   bash scan.sh              # scan only
#   bash scan.sh --notify     # scan + notify agents with issues via Nexus
#   bash scan.sh --start      # scan + start server
#   bash scan.sh --install    # install launchd service (manual start)
#   bash scan.sh --uninstall  # remove launchd service
#   bash scan.sh --status     # check if server is running

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="$DIR/registry.json"
ISSUES_DIR="$DIR/issues"
MANIFESTS_DIR="$HOME/.boring/harness/manifests"

NOTIFY=false
START=false
INSTALL=false
UNINSTALL=false
STATUS=false
for arg in "$@"; do
  case "$arg" in
    --notify)    NOTIFY=true ;;
    --start)     START=true ;;
    --install)   INSTALL=true ;;
    --uninstall) UNINSTALL=true ;;
    --status)    STATUS=true ;;
  esac
done

PLIST_SRC="$DIR/com.boring.wave-report.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.boring.wave-report.plist"
LABEL="com.boring.wave-report"

# Handle --install
if [ "$INSTALL" = true ]; then
  cp "$PLIST_SRC" "$PLIST_DST"
  launchctl load "$PLIST_DST" 2>/dev/null || true
  echo "Installed: $PLIST_DST"
  echo "Start:  launchctl start $LABEL"
  echo "Stop:   launchctl stop $LABEL"
  echo "Logs:   tail -f ~/Library/Logs/wave-report-server.log"
  exit 0
fi

# Handle --uninstall
if [ "$UNINSTALL" = true ]; then
  launchctl stop "$LABEL" 2>/dev/null || true
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Uninstalled wave report server service"
  exit 0
fi

# Handle --status
if [ "$STATUS" = true ]; then
  if lsof -ti:3847 >/dev/null 2>&1; then
    PID=$(lsof -ti:3847)
    echo "● Running (PID $PID) on http://localhost:3847"
  else
    echo "○ Not running"
  fi
  exit 0
fi

echo "=== Wave Report Scanner ==="
echo "Scanning: $MANIFESTS_DIR"

# Run the TypeScript scanner (writes registry.json + issues/)
bun run "$DIR/scanner.ts"

# Read results
if [ ! -f "$REGISTRY" ]; then
  echo "ERROR: Scanner failed to produce registry.json"
  exit 1
fi

TOTAL=$(jq '.entries | length' "$REGISTRY")
ACTIVE=$(jq '[.entries[] | select(.status == "active")] | length' "$REGISTRY")
WITH_ISSUES=$(jq '[.entries[] | select(.issues | length > 0)] | length' "$REGISTRY")

echo ""
echo "Registry: $TOTAL harnesses ($ACTIVE active, $WITH_ISSUES with issues)"
echo "Written to: $REGISTRY"

# Notify agents about issues
if [ "$NOTIFY" = true ] && [ "$WITH_ISSUES" -gt 0 ]; then
  echo ""
  echo "--- Notifying agents ---"

  # Strategy 1: Post to Nexus (agents with MCP access will see it)
  if command -v nexus-qbg-zhu &>/dev/null; then
    ISSUE_SUMMARY=$(jq -r '.entries[] | select(.issues | length > 0) | "• \(.harness): \(.issues | join("; "))"' "$REGISTRY" | head -10)
    nexus-qbg-zhu send -r features "[wave-report-scanner] $WITH_ISSUES harness(es) have issues:
$ISSUE_SUMMARY

Agents: check /api/issues/{your-harness} on port 3847, or read ~/.boring/wave-report-server/issues/{harness}.json" 2>/dev/null || true
    echo "Posted to Nexus #features"
  fi

  # Strategy 2: Write a marker file agents can check via their stop hooks
  for issues_file in "$ISSUES_DIR"/*.json; do
    [ -f "$issues_file" ] || continue
    HARNESS=$(jq -r '.harness' "$issues_file")
    echo "  Issues: $HARNESS → $issues_file"
  done
fi

# Print clean report
echo ""
echo "--- Harness Status ---"
jq -r '.entries[] | "\(.status | if . == "active" then "●" elif . == "done" then "○" else "?" end) \(.harness)\t\(.tasksDone)/\(.tasksTotal)\t\(.issues | length) issues"' "$REGISTRY" | column -t -s $'\t'

# Start server if requested
if [ "$START" = true ]; then
  echo ""
  echo "Starting server on port 3847..."
  exec bun run "$DIR/server.ts"
fi
