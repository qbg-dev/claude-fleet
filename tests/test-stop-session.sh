#!/usr/bin/env bash
# test-stop-session.sh — Tests for hooks/gates/stop-session.sh
# Tests the session naming state machine and code review phases.
# NOTE: Cannot override HOME (hook sources $HOME/.claude-ops/lib/*), so we
# override HARNESS_STATE_DIR and tool-log paths via env vars + temp project.
set -euo pipefail
source "$(dirname "$0")/helpers.sh"

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

HOOK="$HOME/.claude-ops/hooks/gates/stop-session.sh"

# Create a temp project with git repo (for Phase B)
PROJECT="$TMPDIR_TEST/project"
mkdir -p "$PROJECT"
(cd "$PROJECT" && git init -q && git commit --allow-empty -m "init" -q)

# State dir in tmp (avoids polluting real state)
STATE_DIR="$TMPDIR_TEST/state"
mkdir -p "$STATE_DIR/sessions"

# Tool log dir keyed by project basename
PROJ_NAME=$(basename "$PROJECT")
TOOL_LOG_DIR="$TMPDIR_TEST/.claude/tool-logs/$PROJ_NAME"
mkdir -p "$TOOL_LOG_DIR"

# Common env for all test invocations
run_hook() {
  echo "$1" | \
    HARNESS_STATE_DIR="$STATE_DIR" \
    PANE_REGISTRY="$TMPDIR_TEST/pane-registry.json" \
    PROJECT_ROOT="$PROJECT" \
    EVENT_BUS_ENABLED="false" \
    bash "$HOOK" 2>/dev/null
}

# Create empty pane registry
echo '{}' > "$TMPDIR_TEST/pane-registry.json"

# Symlink tool-logs so the hook finds them at $HOME/.claude/tool-logs/$PROJ_NAME
# Actually the hook computes it as $HOME/.claude/tool-logs/$PROJECT where PROJECT=basename(cwd)
# We can't change HOME, so instead let's create the tool log in the real HOME location
# and clean up after. Better approach: use a unique project name.
UNIQUE_PROJ="test-stop-session-$$"
REAL_TOOL_LOG_DIR="$HOME/.claude/tool-logs/$UNIQUE_PROJ"
mkdir -p "$REAL_TOOL_LOG_DIR"
# Clean up the real tool log dir on exit
trap 'rm -rf "$TMPDIR_TEST" "$REAL_TOOL_LOG_DIR"' EXIT

# Rename project dir to match
mv "$PROJECT" "$TMPDIR_TEST/$UNIQUE_PROJ"
PROJECT="$TMPDIR_TEST/$UNIQUE_PROJ"

echo "── stop-session: empty/missing session_id ──"

RESULT=$(run_hook '{}')
assert_equals "missing session_id returns {}" "{}" "$RESULT"

echo ""
echo "── stop-session: session with no tool activity ──"

SID="test-notools-$$"
RESULT=$(run_hook "{\"session_id\":\"$SID\",\"cwd\":\"$PROJECT\"}")
assert_equals "no tool activity returns {}" "{}" "$RESULT"

echo ""
echo "── stop-session: session with < 3 tools skips naming ──"

SID2="test-few-$$"
echo "{\"session_id\":\"$SID2\",\"tool_name\":\"Read\"}" > "$REAL_TOOL_LOG_DIR/tools.jsonl"
echo "{\"session_id\":\"$SID2\",\"tool_name\":\"Glob\"}" >> "$REAL_TOOL_LOG_DIR/tools.jsonl"

RESULT=$(run_hook "{\"session_id\":\"$SID2\",\"cwd\":\"$PROJECT\"}")
assert_equals "< 3 tool calls skips naming" "{}" "$RESULT"

echo ""
echo "── stop-session: session with 3+ tools triggers naming ──"

SID3="test-many-$$"
for i in 1 2 3 4; do
  echo "{\"session_id\":\"$SID3\",\"tool_name\":\"Read\"}" >> "$REAL_TOOL_LOG_DIR/tools.jsonl"
done

RESULT=$(run_hook "{\"session_id\":\"$SID3\",\"cwd\":\"$PROJECT\"}")

TOTAL=$((TOTAL + 1))
if echo "$RESULT" | jq -e '.decision == "block"' > /dev/null 2>&1; then
  echo -e "  ${GREEN}PASS${RESET} 3+ tool calls triggers naming block"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} 3+ tool calls triggers naming block"
  echo "    got: $RESULT"
  FAIL=$((FAIL + 1))
fi

assert "naming prompt mentions session naming" "Name this session" "$RESULT"

# Verify asked flag was created
ASKED_FLAG="$STATE_DIR/sessions/$SID3/session-asked"
assert_file_exists "session-asked flag created" "$ASKED_FLAG"

echo ""
echo "── stop-session: second call with name file collects name ──"

NAME_DIR="$STATE_DIR/sessions/$SID3"
echo '{"name":"my test session","summary":"ran some tests"}' > "$NAME_DIR/session-name.json"

RESULT=$(run_hook "{\"session_id\":\"$SID3\",\"cwd\":\"$PROJECT\"}")

# Cooldown flag should exist after naming
COOLDOWN_FLAG="$NAME_DIR/named-marker"
assert_file_exists "cooldown marker created" "$COOLDOWN_FLAG"

# Session name and asked files should be cleaned up
TOTAL=$((TOTAL + 1))
if [ ! -f "$NAME_DIR/session-name.json" ] && [ ! -f "$NAME_DIR/session-asked" ]; then
  echo -e "  ${GREEN}PASS${RESET} naming files cleaned up"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} naming files cleaned up"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── stop-session: cooldown prevents re-naming ──"

SID4="test-cooldown-$$"
for i in 1 2 3 4; do
  echo "{\"session_id\":\"$SID4\",\"tool_name\":\"Read\"}" >> "$REAL_TOOL_LOG_DIR/tools.jsonl"
done

# Create cooldown flag
COOL_DIR="$STATE_DIR/sessions/$SID4"
mkdir -p "$COOL_DIR"
touch "$COOL_DIR/named-marker"

RESULT=$(run_hook "{\"session_id\":\"$SID4\",\"cwd\":\"$PROJECT\"}")

TOTAL=$((TOTAL + 1))
DECISION=$(echo "$RESULT" | jq -r '.decision // "allow"' 2>/dev/null)
if [ "$DECISION" = "allow" ] || [ "$RESULT" = "{}" ]; then
  echo -e "  ${GREEN}PASS${RESET} cooldown prevents naming block"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} cooldown prevents naming block"
  echo "    got: $RESULT"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "── stop-session: Phase B write-flag triggers review ──"

SID5="test-review-$$"
REVIEW_DIR="$STATE_DIR/sessions/$SID5"
mkdir -p "$REVIEW_DIR"
touch "$REVIEW_DIR/named-marker"  # skip naming
touch "$REVIEW_DIR/write-flag"    # trigger Phase B

# Phase B uses baseline: first call creates baseline from current dirty files,
# subsequent calls detect NEW dirty files. Pre-create an empty baseline,
# then modify a tracked file so it appears as "new since baseline".
echo "" > "$REVIEW_DIR/baseline.txt"
# Create and commit a file, then modify it (git diff HEAD catches tracked changes)
(cd "$PROJECT" && mkdir -p src && echo "original" > src/test-file.ts && git add -A && git commit -m "add test file" -q)
(cd "$PROJECT" && echo "modified" > src/test-file.ts)

RESULT=$(run_hook "{\"session_id\":\"$SID5\",\"cwd\":\"$PROJECT\"}")

TOTAL=$((TOTAL + 1))
DECISION=$(echo "$RESULT" | jq -r '.decision // "allow"' 2>/dev/null)
if [ "$DECISION" = "block" ]; then
  echo -e "  ${GREEN}PASS${RESET} write-flag triggers code review block"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} write-flag triggers code review block"
  echo "    got: $RESULT"
  FAIL=$((FAIL + 1))
fi

# Clean up dirty file
(cd "$PROJECT" && git checkout -- src/test-file.ts 2>/dev/null || true)

echo ""
echo "── stop-session: no write-flag and no deploy skips review ──"

SID6="test-noreview-$$"
NOREVIEW_DIR="$STATE_DIR/sessions/$SID6"
mkdir -p "$NOREVIEW_DIR"
touch "$NOREVIEW_DIR/named-marker"

RESULT=$(run_hook "{\"session_id\":\"$SID6\",\"cwd\":\"$PROJECT\"}")
assert_equals "no write-flag returns {}" "{}" "$RESULT"

echo ""
echo "── stop-session: echo-state.json bypasses everything ──"

SID7="test-echo-$$"
for i in 1 2 3 4 5; do
  echo "{\"session_id\":\"$SID7\",\"tool_name\":\"Write\"}" >> "$REAL_TOOL_LOG_DIR/tools.jsonl"
done
ECHO_DIR="$STATE_DIR/sessions/$SID7"
mkdir -p "$ECHO_DIR"
echo '{"active":true}' > "$ECHO_DIR/echo-state.json"
touch "$ECHO_DIR/write-flag"

RESULT=$(run_hook "{\"session_id\":\"$SID7\",\"cwd\":\"$PROJECT\"}")
assert_equals "echo chain bypasses all gates" "{}" "$RESULT"

test_summary
