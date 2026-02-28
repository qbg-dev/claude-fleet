#!/usr/bin/env bash
# test-harness-stop.sh — Tests for harness-stop.sh CLI tool
set -uo pipefail
source "$(dirname "$0")/helpers.sh"

echo "── harness-stop CLI tests ──"

# Setup temp environment
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"; rm -rf "${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/harness-runtime/test-stop-harness"' EXIT

# ── Test: harness list shows harnesses ──
LIST_OUTPUT=$(bash ~/.claude-ops/bin/harness.sh list 2>&1)
assert "list shows 'Harnesses'" "Harnesses" "$LIST_OUTPUT"

# ── Test: harness-stop.sh wrapper redirects to harness.sh stop ──
WRAPPER_OUTPUT=$(bash ~/.claude-ops/bin/harness-stop.sh nonexistent 2>&1 || true)
assert "wrapper calls harness stop" "no progress file" "$WRAPPER_OUTPUT"

# ── Test: harness help shows usage ──
HELP_OUTPUT=$(bash ~/.claude-ops/bin/harness.sh help 2>&1 || true)
assert "help shows usage" "harness" "$HELP_OUTPUT"

# ── Test: missing harness returns error ──
MISSING_OUTPUT=$(bash ~/.claude-ops/bin/harness-stop.sh nonexistent-harness-xyz 2>&1 || true)
assert "missing harness shows error" "no progress file" "$MISSING_OUTPUT"

# ── Test: stop sets status=done via manifest ──
# Create a properly structured manifest + progress file
MOCK_MANIFEST_DIR="$HOME/.claude-ops/harness/manifests/test-stop-harness"
mkdir -p "$MOCK_MANIFEST_DIR"
MOCK_PROGRESS="$TMPDIR_TEST/progress.json"
cat > "$MOCK_PROGRESS" <<'EOF'
{
  "harness": "test-stop-harness",
  "status": "active",
  "mission": "test",
  "tasks": { "t1": { "status": "pending", "description": "test" } }
}
EOF
cat > "$MOCK_MANIFEST_DIR/manifest.json" <<EOF
{
  "name": "test-stop-harness",
  "project_root": "$TMPDIR_TEST",
  "status": "active",
  "files": { "progress": "progress.json" }
}
EOF

# Create a mock registry for this test
MOCK_REGISTRY="$TMPDIR_TEST/registry.json"
echo '{"sessions":{}, "panes":{}}' > "$MOCK_REGISTRY"

# Run stop (will fail to find worker pane, which is fine for testing)
HARNESS_SESSION_REGISTRY="$MOCK_REGISTRY" bash ~/.claude-ops/bin/harness-stop.sh test-stop-harness 2>&1 || true

# Check that status was set to done
RESULT_STATUS=$(jq -r '.status' "$MOCK_PROGRESS" 2>/dev/null || echo "unknown")
assert_equals "stop sets status=done" "done" "$RESULT_STATUS"

# ── Test: stop creates harness-level flag ──
assert_file_exists "stop creates harness stop flag" "${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/harness-runtime/test-stop-harness/stop-flag"

# ── Test: harness-dispatch.sh has harness-level escape check ──
DISPATCH_SCRIPT="$HOME/.claude-ops/hooks/harness-dispatch.sh"
assert "dispatch has harness-level stop check" "stop-flag" "$(grep 'stop-flag' "$DISPATCH_SCRIPT" | head -1)"

# ── Test: harness stop flag file gets consumed (rm -f in dispatch) ──
DISPATCH_RM=$(grep 'stop-flag' "$DISPATCH_SCRIPT" | grep -c 'rm -f' || true)
assert_equals "dispatch removes harness stop flag" "1" "$DISPATCH_RM"

# ── Test: stop output includes step numbers ──
# Re-create for another stop test
cat > "$MOCK_PROGRESS" <<'EOF'
{
  "harness": "test-stop-harness",
  "status": "active",
  "mission": "test",
  "tasks": { "t1": { "status": "pending", "description": "test" } }
}
EOF
STOP_OUTPUT=$(HARNESS_SESSION_REGISTRY="$MOCK_REGISTRY" bash ~/.claude-ops/bin/harness-stop.sh test-stop-harness 2>&1 || true)
assert "stop output has step 1" "[1/5]" "$STOP_OUTPUT"
assert "stop output has step 5" "[5/5]" "$STOP_OUTPUT"
assert "stop output shows completion" "stopped" "$STOP_OUTPUT"

# Cleanup test manifest
rm -rf "$MOCK_MANIFEST_DIR"
rm -rf "${HARNESS_STATE_DIR:-$HOME/.claude-ops/state}/harness-runtime/test-stop-harness"

test_summary
