#!/usr/bin/env bash
# test-seed.sh — Tests for seed prompt generation.
# Scaffolds a temp harness then tests its seed output without tmux.
set -euo pipefail

source "$(dirname "$0")/helpers.sh"

SCAFFOLD="$HOME/.claude-ops/scripts/scaffold.sh"
HARNESS_NAME="test-seed-$$"

# Setup temp project
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR"
HARNESS_DIR="$TMPDIR/.claude/harness/$HARNESS_NAME"
SEED_SCRIPT="$TMPDIR/.claude/scripts/${HARNESS_NAME}-seed.sh"
PROGRESS="$HARNESS_DIR/progress.json"

# Scaffold the harness
bash "$SCAFFOLD" "$HARNESS_NAME" "$TMPDIR" > /dev/null 2>&1

# Save pane registry so we don't pollute it
PANE_REG="$HOME/.claude-ops/state/pane-registry.json"
PANE_REG_BACKUP=""
if [ -f "$PANE_REG" ]; then
  PANE_REG_BACKUP=$(mktemp)
  cp "$PANE_REG" "$PANE_REG_BACKUP"
fi

cleanup() {
  rm -rf "$TMPDIR"
  rm -rf "$HOME/.claude-ops/harness/manifests/$HARNESS_NAME"
  rm -rf "$HOME/.claude-ops/harness/reports/$HARNESS_NAME"
  rm -rf "$HOME/.claude-ops/state/playwright/$HARNESS_NAME"
  # Restore pane registry
  if [ -n "$PANE_REG_BACKUP" ] && [ -f "$PANE_REG_BACKUP" ]; then
    mv "$PANE_REG_BACKUP" "$PANE_REG"
  fi
}
trap cleanup EXIT

echo "── seed.sh ──"

# Test 1: Seed exits 0 on fresh scaffold
TOTAL=$((TOTAL + 1))
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${RESET} seed exits 0 on fresh scaffold"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} seed exits $EXIT_CODE"
  FAIL=$((FAIL + 1))
fi

# Test 2: Seed output contains harness name header
assert "output contains harness name header" "# ${HARNESS_NAME}" "$OUTPUT"

# Test 3: Seed contains mission from progress.json
tmp=$(mktemp)
jq '.mission = "Optimize the login page"' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
assert "output contains mission" "Optimize the login page" "$OUTPUT"

# Test 4: Default role is self-sidecar
assert "default role is self-sidecar" "self-sidecar" "$OUTPUT"

# Test 5: Worker role when bounded + parent
tmp=$(mktemp)
jq '.lifecycle = "bounded" | .parent = "my-sidecar"' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
assert "worker role with bounded+parent" "Task Executor" "$OUTPUT"
# Reset parent
tmp=$(mktemp)
jq '.parent = null' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"

# Test 6: Phase 0 gate shows sleep instruction
tmp=$(mktemp)
jq '.sketch_approved = false' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
assert "phase 0 gate shows sleep instruction" "sleep 3600" "$OUTPUT"

# Test 7: Phase 0.5 gate when sketch approved only
tmp=$(mktemp)
jq '.sketch_approved = true | .generalization_approved = false' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
assert "phase 0.5 gate when sketch approved" "Phase 0.5" "$OUTPUT"

# Test 8: No phase gate when both approved
tmp=$(mktemp)
jq '.sketch_approved = true | .generalization_approved = true' "$PROGRESS" > "$tmp" && mv "$tmp" "$PROGRESS"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if echo "$OUTPUT" | grep -q "Phase 0"; then
  echo -e "  ${RED}FAIL${RESET} no phase gate when both approved (found Phase 0)"
  FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}PASS${RESET} no phase gate when both approved"
  PASS=$((PASS + 1))
fi

# Test 9: Inbox count in output
echo '{"ts":"2026-01-01","from":"test","type":"status","content":"msg1"}' > "$HARNESS_DIR/inbox.jsonl"
echo '{"ts":"2026-01-02","from":"test","type":"status","content":"msg2"}' >> "$HARNESS_DIR/inbox.jsonl"
echo '{"ts":"2026-01-03","from":"test","type":"status","content":"msg3"}' >> "$HARNESS_DIR/inbox.jsonl"
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
assert "inbox count in output" "3 unread" "$OUTPUT"
# Clear inbox for remaining tests
> "$HARNESS_DIR/inbox.jsonl"

# Test 10: No {{HARNESS}} in output
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if echo "$OUTPUT" | grep -q '{{HARNESS}}'; then
  echo -e "  ${RED}FAIL${RESET} found {{HARNESS}} in seed output"
  FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}PASS${RESET} no {{HARNESS}} in output"
  PASS=$((PASS + 1))
fi

# Test 11: Missing progress.json: graceful fallback
PROGRESS_BACKUP=$(mktemp)
mv "$PROGRESS" "$PROGRESS_BACKUP"
TOTAL=$((TOTAL + 1))
OUTPUT=$(bash "$SEED_SCRIPT" 2>/dev/null)
EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ] && echo "$OUTPUT" | grep -qF "No progress file"; then
  echo -e "  ${GREEN}PASS${RESET} graceful fallback when progress.json missing"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} missing progress.json: exit=$EXIT_CODE"
  FAIL=$((FAIL + 1))
fi
mv "$PROGRESS_BACKUP" "$PROGRESS"

# Test 12: Seed without HARNESS_LAUNCHED skips registration
# The seed script only registers when HARNESS_LAUNCHED=1
TOTAL=$((TOTAL + 1))
BEFORE=""
[ -f "$PANE_REG" ] && BEFORE=$(cat "$PANE_REG")
unset HARNESS_LAUNCHED 2>/dev/null || true
bash "$SEED_SCRIPT" > /dev/null 2>&1
AFTER=""
[ -f "$PANE_REG" ] && AFTER=$(cat "$PANE_REG")
if [ "$BEFORE" = "$AFTER" ]; then
  echo -e "  ${GREEN}PASS${RESET} seed without HARNESS_LAUNCHED skips registration"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} seed modified pane registry without HARNESS_LAUNCHED"
  FAIL=$((FAIL + 1))
fi

test_summary
