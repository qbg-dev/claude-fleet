#!/usr/bin/env bash
# test-control-plane.sh — Tests for control-plane.sh resilience improvements
set -uo pipefail
source "$(dirname "$0")/helpers.sh"

echo "── control-plane resilience tests ──"

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

CP_SCRIPT="$HOME/.claude-ops/scripts/control-plane.sh"

# ── Test: script has no set -e (error containment) ──
# The script should use set -uo pipefail (no -e)
NO_SET_E=$(head -30 "$CP_SCRIPT" | grep -c "set -euo pipefail" || true)
assert_equals "no set -euo pipefail (error containment)" "0" "$NO_SET_E"

# The actual `set` command (not comment) should be set -uo pipefail
HAS_SET_UO=$(grep -c "^set -uo pipefail" "$CP_SCRIPT" || true)
assert_equals "has set -uo pipefail" "1" "$HAS_SET_UO"

# ── Test: run_tick function exists ──
HAS_RUN_TICK=$(grep -c "^run_tick()" "$CP_SCRIPT" || true)
assert_equals "run_tick function exists" "1" "$HAS_RUN_TICK"

# ── Test: error handling wraps run_tick ──
HAS_ERROR_HANDLER=$(grep -c "CONSECUTIVE_ERRORS" "$CP_SCRIPT" || true)
assert "error handler exists" "CONSECUTIVE_ERRORS" "$(grep 'CONSECUTIVE_ERRORS' "$CP_SCRIPT" | head -1)"

# ── Test: metrics rotation exists in emit_metric ──
HAS_ROTATION=$(grep -c "METRICS_MAX_SIZE_BYTES" "$CP_SCRIPT" || true)
assert "metrics rotation in emit_metric" "METRICS_MAX_SIZE_BYTES" "$(grep 'METRICS_MAX_SIZE_BYTES' "$CP_SCRIPT" | head -1)"

# ── Test: rotate_sweep_log function exists ──
HAS_ROTATE_SWEEP=$(grep -c "^rotate_sweep_log()" "$CP_SCRIPT" || true)
assert_equals "rotate_sweep_log function exists" "1" "$HAS_ROTATE_SWEEP"

# ── Test: sweep output goes to per-sweep log (not metrics JSONL) ──
SWEEP_LOG_REF=$(grep -c 'sweep_log=.*SWEEP_LOG_DIR.*harness_sweep_' "$CP_SCRIPT" || true)
assert "sweep output isolated to per-sweep log" "1" "$SWEEP_LOG_REF"

# Verify sweeps no longer append to METRICS_FILE
OLD_METRICS_APPEND=$(grep 'METRICS_FILE.*2>&1' "$CP_SCRIPT" | grep -v 'emit_metric\|^#\|^[[:space:]]*#' | grep -c 'sweep.*METRICS_FILE' || true)
assert_equals "sweeps no longer append to METRICS_FILE" "0" "$OLD_METRICS_APPEND"

# ── Test: sweep state validation in init_sweep_state ──
HAS_VALIDATION=$(grep -c "jq empty" "$CP_SCRIPT" || true)
assert_equals "sweep state validation exists" "1" "$HAS_VALIDATION"

# ── Test: should_run guards against non-numeric last_run ──
HAS_NUMERIC_GUARD=$(grep -A2 'last_run=.*jq' "$CP_SCRIPT" | grep -c 'last_run=0' || true)
assert "numeric guard for last_run" "last_run=0" "$(grep 'last_run=0' "$CP_SCRIPT" | head -1)"

# ── Test: harness-jq.sh is sourced ──
HAS_JQ_SOURCE=$(grep -c 'harness-jq.sh' "$CP_SCRIPT" || true)
assert "harness-jq.sh sourced" "harness-jq.sh" "$(grep 'harness-jq.sh' "$CP_SCRIPT" | head -1)"

# ── Test: SIGHUP is trapped ──
assert_file_contains "traps SIGHUP" "$CP_SCRIPT" "SIGHUP"

# ── Test: SIGPIPE is ignored ──
assert_file_contains "ignores SIGPIPE" "$CP_SCRIPT" "SIGPIPE"

# ── Test: config var defaults guard against partial source ──
HAS_TICK_DEFAULT=$(grep -c 'TICK_INTERVAL=.*:-' "$CP_SCRIPT" || true)
assert "has TICK_INTERVAL default" "1" "$HAS_TICK_DEFAULT"

# ── Test: inline GC function exists ──
assert_file_contains "has run_gc function" "$CP_SCRIPT" "run_gc()"

# ── Test: GC prunes stale session dirs ──
assert_file_contains "GC prunes session dirs" "$CP_SCRIPT" "sessions"

# ── Test: GC prunes dead pane-registry entries ──
assert_file_contains "GC prunes pane-registry" "$CP_SCRIPT" "pane-registry"

# ── Test: dry-run completes successfully ──
DRY_RUN_OUTPUT=$(bash "$CP_SCRIPT" --dry-run 2>&1)
DRY_RUN_EXIT=$?
assert_equals "dry-run exits successfully" "0" "$DRY_RUN_EXIT"
assert "dry-run logs completion" "Dry run complete" "$DRY_RUN_OUTPUT"

# ── Test: harness-pane.sh library exists and has all functions ──
PANE_LIB="$HOME/.claude-ops/lib/harness-pane.sh"
assert_file_exists "harness-pane.sh library exists" "$PANE_LIB"
assert_file_contains "has find_worker_pane" "$PANE_LIB" "find_worker_pane()"
assert_file_contains "has find_monitor_pane" "$PANE_LIB" "find_monitor_pane()"
assert_file_contains "has find_daemon_pid" "$PANE_LIB" "find_daemon_pid()"
assert_file_contains "has is_claude_alive_in_pane" "$PANE_LIB" "is_claude_alive_in_pane()"

# ══════════════════════════════════════════════════════════════════
# harness CLI tests
# ══════════════════════════════════════════════════════════════════

HARNESS_CLI="$HOME/.claude-ops/bin/harness.sh"

# ── Test: harness CLI exists and is executable ──
TOTAL=$((TOTAL + 1))
if [ -x "$HARNESS_CLI" ]; then
  echo -e "  ${GREEN}PASS${RESET} harness CLI is executable"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} harness CLI is executable"
  FAIL=$((FAIL + 1))
fi

# ── Test: harness help exits 0 ──
bash "$HARNESS_CLI" help >/dev/null 2>&1
assert_equals "harness help exits 0" "0" "$?"

# ── Test: harness list exits 0 ──
bash "$HARNESS_CLI" list >/dev/null 2>&1
assert_equals "harness list exits 0" "0" "$?"

# ── Test: harness health exits 0 ──
bash "$HARNESS_CLI" health >/dev/null 2>&1
assert_equals "harness health exits 0" "0" "$?"

# ── Test: harness list shows active/done counts ──
LIST_OUTPUT=$(bash "$HARNESS_CLI" list 2>&1)
assert "harness list shows active count" "active" "$LIST_OUTPUT"
assert "harness list shows done count" "done" "$LIST_OUTPUT"

# ── Test: harness status with valid name exits 0 ──
# Find any harness that exists
SOME_HARNESS=$(bash "$HARNESS_CLI" list 2>&1 | grep -oP '(?:● |○ )\K\S+' | head -1)
if [ -n "$SOME_HARNESS" ]; then
  bash "$HARNESS_CLI" status "$SOME_HARNESS" >/dev/null 2>&1
  assert_equals "harness status exits 0" "0" "$?"
fi

# ── Test: harness status with invalid name exits 1 ──
bash "$HARNESS_CLI" status "nonexistent-harness-xyz" >/dev/null 2>&1
assert_equals "harness status invalid exits 1" "1" "$?"

# ── Test: harness uses state dir not /tmp ──
HARNESS_TMP_REFS=$(grep -c '"/tmp/harness_' "$HARNESS_CLI" 2>/dev/null || true)
assert_equals "harness CLI has no hardcoded /tmp/harness_ paths" "0" "$HARNESS_TMP_REFS"

# ── Test: state dir paths use variables ──
STATE_DIR_REFS=$(grep -c 'STATE_DIR' "$HARNESS_CLI" || true)
TOTAL=$((TOTAL + 1))
if [ "$STATE_DIR_REFS" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${RESET} harness CLI uses STATE_DIR variable ($STATE_DIR_REFS refs)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} harness CLI uses STATE_DIR variable"
  FAIL=$((FAIL + 1))
fi

test_summary
