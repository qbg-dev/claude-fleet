#!/usr/bin/env bash
# test-bus-paths.sh — Tests for lib/bus-paths.sh path resolution functions.
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# Source the library under test
PROJECT_ROOT="$TMPDIR_TEST"
source "$HOME/.claude-ops/lib/bus-paths.sh"

echo "── bus-paths: resolve_agent_file ──"

# Flat worker: "worker/$name" → .claude/workers/$name/$filename
result=$(resolve_agent_file "worker/my-worker" "inbox.jsonl")
assert_equals "flat worker resolves to .claude/workers/" \
  "$TMPDIR_TEST/.claude/workers/my-worker/inbox.jsonl" "$result"

# Harness worker: "mod-x/worker-name" → .claude/harness/mod-x/agents/worker/worker-name/$filename
result=$(resolve_agent_file "mod-x/worker-name" "outbox.jsonl")
assert_equals "harness worker resolves to harness agents path" \
  "$TMPDIR_TEST/.claude/harness/mod-x/agents/worker/worker-name/outbox.jsonl" "$result"

# Module with module-manager dir
mkdir -p "$TMPDIR_TEST/.claude/harness/my-mod/agents/module-manager"
result=$(resolve_agent_file "my-mod" "inbox.jsonl")
assert_equals "module with MM dir resolves to module-manager" \
  "$TMPDIR_TEST/.claude/harness/my-mod/agents/module-manager/inbox.jsonl" "$result"

# Module with sidecar dir (no module-manager)
mkdir -p "$TMPDIR_TEST/.claude/harness/sidecar-mod/agents/sidecar"
result=$(resolve_agent_file "sidecar-mod" "inbox.jsonl")
assert_equals "module with sidecar dir resolves to sidecar" \
  "$TMPDIR_TEST/.claude/harness/sidecar-mod/agents/sidecar/inbox.jsonl" "$result"

# Module with neither MM nor sidecar falls back to harness root
result=$(resolve_agent_file "bare-mod" "inbox.jsonl")
assert_equals "module with no agent dirs falls back to harness root" \
  "$TMPDIR_TEST/.claude/harness/bare-mod/inbox.jsonl" "$result"

echo ""
echo "── bus-paths: resolve_agent_inbox ──"

result=$(resolve_agent_inbox "worker/test-worker")
assert_equals "inbox helper returns inbox.jsonl" \
  "$TMPDIR_TEST/.claude/workers/test-worker/inbox.jsonl" "$result"

result=$(resolve_agent_inbox "my-mod/worker-a")
assert_equals "inbox for harness worker" \
  "$TMPDIR_TEST/.claude/harness/my-mod/agents/worker/worker-a/inbox.jsonl" "$result"

echo ""
echo "── bus-paths: resolve_agent_outbox ──"

result=$(resolve_agent_outbox "worker/test-worker")
assert_equals "outbox helper returns outbox.jsonl" \
  "$TMPDIR_TEST/.claude/workers/test-worker/outbox.jsonl" "$result"

result=$(resolve_agent_outbox "my-mod/worker-b")
assert_equals "outbox for harness worker" \
  "$TMPDIR_TEST/.claude/harness/my-mod/agents/worker/worker-b/outbox.jsonl" "$result"

echo ""
echo "── bus-paths: edge cases ──"

# Worker name with dashes and numbers
result=$(resolve_agent_file "worker/my-worker-123" "state.json")
assert_equals "worker name with dashes/numbers" \
  "$TMPDIR_TEST/.claude/workers/my-worker-123/state.json" "$result"

# Deeply nested module path
result=$(resolve_agent_file "deep-mod/sub-worker" "inbox.jsonl")
assert_equals "module/worker split on first slash" \
  "$TMPDIR_TEST/.claude/harness/deep-mod/agents/worker/sub-worker/inbox.jsonl" "$result"

# Different filenames
result=$(resolve_agent_file "worker/w1" "MEMORY.md")
assert_equals "custom filename" \
  "$TMPDIR_TEST/.claude/workers/w1/MEMORY.md" "$result"

test_summary
