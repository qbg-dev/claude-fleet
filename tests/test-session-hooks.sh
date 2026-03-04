#!/usr/bin/env bash
# test-session-hooks.sh — Regression tests for session registration and pre-compact hooks.
#
# Covers:
#   - worker-session-register.sh: lock timeout must use exit 0 (not break)
#   - pre-compact.sh: v3 fallback reads session_id from registry.json, not pane-registry.json
#
# Bug 1 (TOCTOU): 'break' exited the lock loop but continued writing without holding the lock.
#   Fix: 'exit 0' skips the write on timeout (safe: registration is idempotent, retried next prompt).
# Bug 2 (v3 mismatch): pane-registry.json doesn't store session_id for v3 flat workers.
#   Fix: added fallback that scans $PROJECT_ROOT/.claude/workers/registry.json.
#
# Run: bash ~/.boring/tests/test-session-hooks.sh
set -uo pipefail

source "$(dirname "$0")/helpers.sh"

TMPDIR_TEST=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR_TEST"; }
trap cleanup EXIT

REGISTER_SH="$HOME/.boring/hooks/publishers/worker-session-register.sh"
PRECOMPACT_SH="$HOME/.boring/scripts/pre-compact.sh"

# ═══════════════════════════════════════════════════════════════════════
# PART 1: worker-session-register.sh lock timeout safety
# ═══════════════════════════════════════════════════════════════════════

echo "── session-register: lock timeout safety ──"

# Test 1: no bare 'break' after lock loop — would write without holding the lock
BARE_BREAK=$(grep -n '\] && break' "$REGISTER_SH" 2>/dev/null || true)
assert_empty "no bare 'break' after lock loop (TOCTOU anti-pattern)" "$BARE_BREAK"

# Test 2: uses 'exit 0' on timeout to skip write safely
TOTAL=$((TOTAL + 1))
if grep -q '\] && exit 0' "$REGISTER_SH" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${RESET} lock timeout uses exit 0 (skips write safely)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} lock timeout must use 'exit 0' to skip write — not 'break'"
  echo "    File: $REGISTER_SH"
  FAIL=$((FAIL + 1))
fi

# Test 3: lock release still present (rmdir after successful write)
assert_file_contains "lock is released after write" "$REGISTER_SH" "rmdir \"\$_LOCK_DIR\""

echo ""
echo "── pre-compact: v3 registry.json identity fallback ──"

# Test 4: pre-compact.sh has the v3 registry.json fallback block
assert_file_contains "pre-compact has v3 registry.json fallback" \
  "$PRECOMPACT_SH" "_V3_REG="

# Test 5: v3 fallback — finds worker by session_id in registry.json
PROJ_DIR="$TMPDIR_TEST/proj-v3"
mkdir -p "$PROJ_DIR/.claude/workers"
SESSION_TEST="test-session-abc123"
WORKER_TEST="my-test-worker"
cat > "$PROJ_DIR/.claude/workers/registry.json" <<JSON
{"$WORKER_TEST": {"session_id": "$SESSION_TEST", "status": "active", "perpetual": false}}
JSON

BRANCH="main"
_V3_REG="$PROJ_DIR/.claude/workers/registry.json"
if [ -n "$SESSION_TEST" ] && [[ "$BRANCH" != worker/* ]]; then
  if [ -f "$_V3_REG" ]; then
    _V3_NAME=$(jq -r --arg sid "$SESSION_TEST" \
      'to_entries[] | select(.value.session_id == $sid) | .key' \
      "$_V3_REG" 2>/dev/null | head -1)
    [ -n "$_V3_NAME" ] && [ "$_V3_NAME" != "null" ] && BRANCH="worker/$_V3_NAME"
  fi
fi
assert_equals "v3 fallback: finds worker by session_id" "worker/$WORKER_TEST" "$BRANCH"

# Test 6: v3 fallback — unknown session_id returns no match (branch unchanged)
BRANCH_UNK="main"
_V3_UNK=$(jq -r --arg sid "unknown-session-xyz" \
  'to_entries[] | select(.value.session_id == $sid) | .key' \
  "$_V3_REG" 2>/dev/null | head -1)
[ -n "$_V3_UNK" ] && [ "$_V3_UNK" != "null" ] && BRANCH_UNK="worker/$_V3_UNK" || true
assert_equals "v3 fallback: unknown session leaves branch unchanged" "main" "$BRANCH_UNK"

# Test 7: v3 fallback — 3-worker registry returns only the correct match
cat > "$PROJ_DIR/.claude/workers/registry.json" <<JSON
{
  "worker-a": {"session_id": "session-aaa", "status": "active"},
  "worker-b": {"session_id": "session-bbb", "status": "active"},
  "worker-c": {"session_id": "session-ccc", "status": "active"}
}
JSON
BRANCH_B="main"
_V3_B=$(jq -r --arg sid "session-bbb" \
  'to_entries[] | select(.value.session_id == $sid) | .key' \
  "$PROJ_DIR/.claude/workers/registry.json" 2>/dev/null | head -1)
[ -n "$_V3_B" ] && [ "$_V3_B" != "null" ] && BRANCH_B="worker/$_V3_B" || true
assert_equals "v3 fallback: 3-worker registry returns only correct match" "worker/worker-b" "$BRANCH_B"

# Test 8: v3 fallback — missing registry.json is handled gracefully (no crash)
BRANCH_MISS="main"
_V3_MISS="$PROJ_DIR/.claude/workers/nonexistent.json"
if [ -f "$_V3_MISS" ]; then
  _V3_MISS_NAME=$(jq -r --arg sid "$SESSION_TEST" \
    'to_entries[] | select(.value.session_id == $sid) | .key' \
    "$_V3_MISS" 2>/dev/null | head -1)
  [ -n "$_V3_MISS_NAME" ] && [ "$_V3_MISS_NAME" != "null" ] && BRANCH_MISS="worker/$_V3_MISS_NAME" || true
fi
assert_equals "v3 fallback: missing registry.json leaves branch unchanged" "main" "$BRANCH_MISS"

# Test 9: v3 fallback — worker already on worker/* branch skips registry scan
# (Simulates correct-CWD scenario — no unnecessary registry read)
BRANCH_CORRECT="worker/already-correct"
_SCANNED="no"
if [ -n "$SESSION_TEST" ] && [[ "$BRANCH_CORRECT" != worker/* ]]; then
  _SCANNED="yes"
fi
assert_equals "v3 fallback: correct-branch session skips registry scan" "no" "$_SCANNED"

echo ""
echo "── pre-compact: structural checks ──"

# Test 10: pre-compact has v3 fallback conditioned on BRANCH not being worker/*
assert_file_contains "v3 fallback guarded by BRANCH check" \
  "$PRECOMPACT_SH" '"$BRANCH" != worker/*'

# Test 11: v3 fallback sources PROJECT_ROOT (not hardcoded path)
assert_file_contains "v3 fallback uses PROJECT_ROOT variable" \
  "$PRECOMPACT_SH" '"$PROJECT_ROOT/.claude/workers/registry.json"'

test_summary
