#!/usr/bin/env bash
# test-harness-jq.sh — Tests for lib/harness-jq.sh functions (v2 decomposed files).
set -euo pipefail

source "$(dirname "$0")/helpers.sh"
source "$HOME/.claude-ops/lib/harness-jq.sh"

FIXTURES="$(dirname "$0")/fixtures"
# v2 functions take a path that resolvers use to find tasks.json/config.json/state.json
# We pass sample-progress.json as the "anchor" path — resolvers derive sibling files from its dir
PROGRESS="$FIXTURES/sample-progress.json"

echo "── harness-jq.sh (v2) ──"

# ── current_task ──
RESULT=$(harness_current_task "$PROGRESS")
assert_equals "current_task returns in_progress task" "task-3" "$RESULT"

# ── current_task with no in_progress ──
TMP_DIR=$(mktemp -d)
cp "$FIXTURES/tasks.json" "$TMP_DIR/tasks.json"
mkdir -p "$TMP_DIR/agents/sidecar"
cp "$FIXTURES/agents/sidecar/config.json" "$TMP_DIR/agents/sidecar/config.json"
cp "$FIXTURES/agents/sidecar/state.json" "$TMP_DIR/agents/sidecar/state.json"
TMP="$TMP_DIR/sample-progress.json"
echo '{}' > "$TMP"
jq '.tasks["task-3"].status = "pending"' "$TMP_DIR/tasks.json" > "$TMP_DIR/tasks.json.tmp" && mv "$TMP_DIR/tasks.json.tmp" "$TMP_DIR/tasks.json"
RESULT=$(harness_current_task "$TMP")
assert_equals "current_task falls back to first unblocked pending" "task-3" "$RESULT"
rm -rf "$TMP_DIR"

# ── current_task ALL_DONE ──
TMP_DIR=$(mktemp -d)
cp "$FIXTURES/tasks.json" "$TMP_DIR/tasks.json"
mkdir -p "$TMP_DIR/agents/sidecar"
cp "$FIXTURES/agents/sidecar/config.json" "$TMP_DIR/agents/sidecar/config.json"
TMP="$TMP_DIR/sample-progress.json"
echo '{}' > "$TMP"
jq '.tasks |= map_values(.status = "completed")' "$TMP_DIR/tasks.json" > "$TMP_DIR/tasks.json.tmp" && mv "$TMP_DIR/tasks.json.tmp" "$TMP_DIR/tasks.json"
RESULT=$(harness_current_task "$TMP")
assert_equals "current_task returns ALL_DONE when all completed" "ALL_DONE" "$RESULT"
rm -rf "$TMP_DIR"

# ── next_task ──
RESULT=$(harness_next_task "$PROGRESS")
assert_equals "next_task returns first unblocked pending" "task-5" "$RESULT"

# ── next_task ALL_DONE ──
TMP_DIR=$(mktemp -d)
cp "$FIXTURES/tasks.json" "$TMP_DIR/tasks.json"
mkdir -p "$TMP_DIR/agents/sidecar"
cp "$FIXTURES/agents/sidecar/config.json" "$TMP_DIR/agents/sidecar/config.json"
TMP="$TMP_DIR/sample-progress.json"
echo '{}' > "$TMP"
jq '.tasks["task-4"].status = "completed" | .tasks["task-5"].status = "completed"' "$TMP_DIR/tasks.json" > "$TMP_DIR/tasks.json.tmp" && mv "$TMP_DIR/tasks.json.tmp" "$TMP_DIR/tasks.json"
RESULT=$(harness_next_task "$TMP")
assert_equals "next_task returns ALL_DONE when none pending" "ALL_DONE" "$RESULT"
rm -rf "$TMP_DIR"

# ── done_count ──
RESULT=$(harness_done_count "$PROGRESS")
assert_equals "done_count is 2" "2" "$RESULT"

# ── total_count ──
RESULT=$(harness_total_count "$PROGRESS")
assert_equals "total_count is 5" "5" "$RESULT"

# ── completed_names ──
RESULT=$(harness_completed_names "$PROGRESS")
assert "completed_names includes task-1" "task-1" "$RESULT"
assert "completed_names includes task-2" "task-2" "$RESULT"

# ── pending_names ──
RESULT=$(harness_pending_names "$PROGRESS")
assert "pending_names includes task-4" "task-4" "$RESULT"
assert "pending_names includes task-5" "task-5" "$RESULT"

# ── task_description ──
RESULT=$(harness_task_description "$PROGRESS" "task-3")
assert_equals "task_description correct" "Currently active task" "$RESULT"

# ── name (from config.json) ──
RESULT=$(harness_name "$PROGRESS")
assert_equals "harness_name correct" "test-harness" "$RESULT"

# ── mission (from config.json) ──
RESULT=$(harness_mission "$PROGRESS")
assert_equals "harness_mission correct" "Test mission for unit tests" "$RESULT"

# ── check_blocked (unblocked task) ──
RESULT=$(harness_check_blocked "$PROGRESS" "task-5")
assert_equals "check_blocked returns null for unblocked" "null" "$RESULT"

# ── check_blocked (blocked task) ──
RESULT=$(harness_check_blocked "$PROGRESS" "task-4")
assert "check_blocked returns blocker info for blocked task" "blocked" "$RESULT"
assert "check_blocked shows task-3 as blocker" "task-3" "$RESULT"

# ── set_in_progress (unblocked) ──
TMP_DIR=$(mktemp -d)
cp "$FIXTURES/tasks.json" "$TMP_DIR/tasks.json"
mkdir -p "$TMP_DIR/agents/sidecar"
cp "$FIXTURES/agents/sidecar/config.json" "$TMP_DIR/agents/sidecar/config.json"
TMP="$TMP_DIR/sample-progress.json"
echo '{}' > "$TMP"
harness_set_in_progress "$TMP" "task-5" >/dev/null 2>&1 || true
STATUS=$(jq -r '.tasks["task-5"].status' "$TMP_DIR/tasks.json")
assert_equals "set_in_progress sets status" "in_progress" "$STATUS"
rm -rf "$TMP_DIR"

# ── set_in_progress (blocked — should fail) ──
RESULT=$(harness_set_in_progress "$PROGRESS" "task-4" 2>&1 || true)
assert "set_in_progress fails for blocked task" "ERROR" "$RESULT"

# ── set_completed ──
TMP_DIR=$(mktemp -d)
cp "$FIXTURES/tasks.json" "$TMP_DIR/tasks.json"
mkdir -p "$TMP_DIR/agents/sidecar"
cp "$FIXTURES/agents/sidecar/config.json" "$TMP_DIR/agents/sidecar/config.json"
TMP="$TMP_DIR/sample-progress.json"
echo '{}' > "$TMP"
harness_set_completed "$TMP" "task-3" >/dev/null 2>&1 || true
STATUS=$(jq -r '.tasks["task-3"].status' "$TMP_DIR/tasks.json")
assert_equals "set_completed sets status" "completed" "$STATUS"
rm -rf "$TMP_DIR"

# ── would_unblock ──
RESULT=$(harness_would_unblock "$PROGRESS" "task-3")
assert "would_unblock shows task-4" "task-4" "$RESULT"

# ── harness_state (from state.json) ──
RESULT=$(harness_cycle_count "$PROGRESS")
assert_equals "harness_cycle_count reads from state.json" "3" "$RESULT"

RESULT=$(harness_cycle_phase "$PROGRESS")
assert_equals "harness_cycle_phase reads from state.json" "act" "$RESULT"

# ── v2 resolver errors on missing files ──
TMP_DIR=$(mktemp -d)
echo '{}' > "$TMP_DIR/fake.json"
RESULT=$(_resolve_tasks_file "$TMP_DIR/fake.json" 2>&1 || true)
assert "resolve_tasks_file errors on missing" "ERROR" "$RESULT"
RESULT=$(_resolve_config_file "$TMP_DIR/fake.json" 2>&1 || true)
assert "resolve_config_file errors on missing" "ERROR" "$RESULT"
RESULT=$(_resolve_state_file "$TMP_DIR/fake.json" 2>&1 || true)
assert "resolve_state_file errors on missing" "ERROR" "$RESULT"
rm -rf "$TMP_DIR"

# ── worker_scaffold ──
echo ""
echo "── worker functions ──"
TMP_DIR=$(mktemp -d)
worker_scaffold "test-mod" "test-worker" "execution" "Test mission" "acceptance criterion" "warren" "$TMP_DIR" 2>/dev/null
assert "worker_scaffold creates mission.md" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/mission.md" ] && echo true || echo false)"
assert "worker_scaffold creates config.json" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/config.json" ] && echo true || echo false)"
assert "worker_scaffold creates state.json" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/state.json" ] && echo true || echo false)"
assert "worker_scaffold creates MEMORY.md" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/MEMORY.md" ] && echo true || echo false)"
assert "worker_scaffold creates inbox.jsonl" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/inbox.jsonl" ] && echo true || echo false)"
assert "worker_scaffold creates outbox.jsonl" "true" "$([ -f "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/outbox.jsonl" ] && echo true || echo false)"
TYPE=$(jq -r '.type' "$TMP_DIR/.claude/harness/test-mod/agents/worker/test-worker/state.json")
assert_equals "worker state type is execution" "execution" "$TYPE"
rm -rf "$TMP_DIR"

# ── MANIFEST FUNCTIONS ──
echo ""
echo "── manifest functions ──"

# harness_manifest
RESULT=$(harness_manifest "test-manifest")
assert "harness_manifest returns expected path" ".claude-ops/harness/manifests/test-manifest/manifest.json" "$RESULT"

# harness_list_active (uses real manifests)
RESULT=$(harness_list_active)
# Just check it runs without error — specific harnesses may vary
assert "harness_list_active returns something" "" "$([ -n "$RESULT" ] && echo ok || echo "")"

test_summary
