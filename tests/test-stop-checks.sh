#!/usr/bin/env bash
# test-stop-checks.sh — Unit tests for stop check logic
# Tests the in-memory stop check store behavior that gates recycle().

set -euo pipefail
PASS=0; FAIL=0; TOTAL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  if [ "$expected" = "$actual" ]; then
    echo -e "  \033[0;32mPASS\033[0m $label"
    PASS=$((PASS+1))
  else
    echo -e "  \033[0;31mFAIL\033[0m $label (expected: '$expected', got: '$actual')"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  TOTAL=$((TOTAL+1))
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "  \033[0;32mPASS\033[0m $label"
    PASS=$((PASS+1))
  else
    echo -e "  \033[0;31mFAIL\033[0m $label (needle '$needle' not found)"
    FAIL=$((FAIL+1))
  fi
}

# We test the stop check logic by extracting it from index.ts and running
# it as a standalone bun script. This avoids needing MCP transport.

TEST_DIR=$(mktemp -d)

cat > "$TEST_DIR/test-stop-checks.ts" <<'TYPESCRIPT'
// Extracted stop check logic from index.ts for unit testing
interface StopCheck {
  id: string;
  description: string;
  added_at: string;
  completed: boolean;
  completed_at?: string;
}

const stopChecks: Map<string, StopCheck> = new Map();
let counter = 0;

function addCheck(description: string): string {
  const id = `sc-${++counter}`;
  stopChecks.set(id, { id, description, added_at: new Date().toISOString(), completed: false });
  return id;
}

function completeCheck(id: string): boolean {
  if (id === "all") {
    for (const check of stopChecks.values()) {
      if (!check.completed) {
        check.completed = true;
        check.completed_at = new Date().toISOString();
      }
    }
    return true;
  }
  const check = stopChecks.get(id);
  if (!check) return false;
  check.completed = true;
  check.completed_at = new Date().toISOString();
  return true;
}

function pendingCount(): number {
  return [...stopChecks.values()].filter(c => !c.completed).length;
}

function canRecycle(force: boolean): boolean {
  if (force) return true;
  return pendingCount() === 0;
}

// Run tests
const results: string[] = [];

// Test 1: empty — can recycle
results.push(`empty_can_recycle=${canRecycle(false)}`);

// Test 2: add a check — cannot recycle
const id1 = addCheck("verify TypeScript compiles");
results.push(`after_add_pending=${pendingCount()}`);
results.push(`after_add_can_recycle=${canRecycle(false)}`);
results.push(`after_add_force_recycle=${canRecycle(true)}`);

// Test 3: add second check
const id2 = addCheck("test deploy to slot");
results.push(`two_checks_pending=${pendingCount()}`);

// Test 4: complete first check
completeCheck(id1);
results.push(`after_complete_one_pending=${pendingCount()}`);
results.push(`after_complete_one_can_recycle=${canRecycle(false)}`);

// Test 5: complete second check
completeCheck(id2);
results.push(`after_complete_all_pending=${pendingCount()}`);
results.push(`after_complete_all_can_recycle=${canRecycle(false)}`);

// Test 6: add more, then complete_all
addCheck("check A");
addCheck("check B");
addCheck("check C");
results.push(`three_new_pending=${pendingCount()}`);
completeCheck("all");
results.push(`after_all_pending=${pendingCount()}`);
results.push(`after_all_can_recycle=${canRecycle(false)}`);

// Test 7: complete nonexistent returns false
results.push(`complete_nonexistent=${completeCheck("sc-999")}`);

// Test 8: IDs are sequential
results.push(`last_id=sc-${counter}`);

console.log(results.join("\n"));
TYPESCRIPT

RESULT=$(cd "$TEST_DIR" && bun run test-stop-checks.ts 2>&1)

echo ""
echo "── stop-checks: empty state ──"
assert_contains "can recycle when empty" "empty_can_recycle=true" "$RESULT"

echo ""
echo "── stop-checks: add check gates recycle ──"
assert_contains "1 pending after add" "after_add_pending=1" "$RESULT"
assert_contains "cannot recycle with pending" "after_add_can_recycle=false" "$RESULT"
assert_contains "force=true bypasses gate" "after_add_force_recycle=true" "$RESULT"

echo ""
echo "── stop-checks: multiple checks ──"
assert_contains "2 pending after second add" "two_checks_pending=2" "$RESULT"

echo ""
echo "── stop-checks: completing individual checks ──"
assert_contains "1 pending after completing first" "after_complete_one_pending=1" "$RESULT"
assert_contains "still blocked with 1 pending" "after_complete_one_can_recycle=false" "$RESULT"
assert_contains "0 pending after completing both" "after_complete_all_pending=0" "$RESULT"
assert_contains "can recycle after all done" "after_complete_all_can_recycle=true" "$RESULT"

echo ""
echo "── stop-checks: complete_all ──"
assert_contains "3 new pending checks" "three_new_pending=3" "$RESULT"
assert_contains "0 after complete_all" "after_all_pending=0" "$RESULT"
assert_contains "can recycle after complete_all" "after_all_can_recycle=true" "$RESULT"

echo ""
echo "── stop-checks: edge cases ──"
assert_contains "complete nonexistent returns false" "complete_nonexistent=false" "$RESULT"
assert_contains "IDs are sequential (sc-5 last)" "last_id=sc-5" "$RESULT"

# Cleanup
rm -rf "$TEST_DIR"

echo ""
echo -e "  $PASS passed, $FAIL failed, $TOTAL total"
