#!/usr/bin/env bash
# test-liveness-heartbeat.sh — Tests for hooks/publishers/liveness-heartbeat.sh
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

HOOK="$HOME/.claude-ops/hooks/publishers/liveness-heartbeat.sh"

echo "── liveness-heartbeat: basic operation ──"

# Without WORKER_NAME set, should exit silently
WORKER_NAME="" HOME="$TMPDIR_TEST" bash "$HOOK" < /dev/null 2>/dev/null
assert_equals "no worker name exits cleanly" "0" "$?"

# With WORKER_NAME set, should create liveness file
export WORKER_NAME="test-worker"
HOME="$TMPDIR_TEST" bash "$HOOK" < /dev/null
LIVENESS_FILE="$TMPDIR_TEST/.claude-ops/state/watchdog-runtime/test-worker/liveness"
assert_file_exists "liveness file created" "$LIVENESS_FILE"

# Liveness file should contain a valid epoch timestamp
CONTENT=$(cat "$LIVENESS_FILE")
TOTAL=$((TOTAL + 1))
if [[ "$CONTENT" =~ ^[0-9]+$ ]] && [ "$CONTENT" -gt 1700000000 ]; then
  echo -e "  ${GREEN}PASS${RESET} liveness contains valid epoch"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} liveness contains valid epoch"
  echo "    got: $CONTENT"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── liveness-heartbeat: updates on subsequent calls ──"

# Call again after a brief pause
sleep 1
HOME="$TMPDIR_TEST" bash "$HOOK" < /dev/null
NEW_CONTENT=$(cat "$LIVENESS_FILE")
TOTAL=$((TOTAL + 1))
if [ "$NEW_CONTENT" -ge "$CONTENT" ]; then
  echo -e "  ${GREEN}PASS${RESET} liveness timestamp updated"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} liveness timestamp updated"
  echo "    old: $CONTENT, new: $NEW_CONTENT"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── liveness-heartbeat: different workers ──"

WORKER_NAME="other-worker" HOME="$TMPDIR_TEST" bash "$HOOK" < /dev/null
OTHER_FILE="$TMPDIR_TEST/.claude-ops/state/watchdog-runtime/other-worker/liveness"
assert_file_exists "separate liveness for other worker" "$OTHER_FILE"

# Both files should exist independently
assert_file_exists "original worker liveness still exists" "$LIVENESS_FILE"

test_summary
