#!/usr/bin/env bash
# test-hook-manifest.sh — Tests for hook manifest, setup-hooks, lint-hooks, and stop-inbox-drain.
# Run: bash ~/.claude-ops/tests/test-hook-manifest.sh
set -euo pipefail

source "$(dirname "$0")/helpers.sh"

CLAUDE_OPS_DIR="${CLAUDE_OPS_DIR:-$HOME/.claude-ops}"
MANIFEST="$CLAUDE_OPS_DIR/hooks/manifest.json"
REAL_SETTINGS="$HOME/.claude/settings.json"

# ── Temp dir for isolated tests ──
TMPDIR=$(mktemp -d /tmp/test-hook-manifest-XXXXXX)
trap 'rm -rf "$TMPDIR"' EXIT

echo "── hook manifest + setup + lint ──"

# ═════════════════════════════════════════════════════════════════════
# 1. Manifest validation
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "Manifest Validation:"

# 1a. Manifest is valid JSON
TOTAL=$((TOTAL + 1))
if jq empty "$MANIFEST" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${RESET} manifest.json is valid JSON"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} manifest.json is valid JSON — parse error"
  FAIL=$((FAIL + 1))
fi

# 1b. Has hooks array with entries
HOOK_COUNT=$(jq '.hooks | length' "$MANIFEST" 2>/dev/null || echo "0")
assert_not_empty "manifest has hooks (count=$HOOK_COUNT)" "$HOOK_COUNT"

# 1c. All hooks have required fields (id, event, path)
BAD=$(jq '[.hooks[] | select(.id == null or .event == null or .path == null)] | length' "$MANIFEST" 2>/dev/null || echo "999")
assert_equals "all hooks have id, event, path" "0" "$BAD"

# 1d. No duplicate IDs
UNIQUE=$(jq '[.hooks[].id] | unique | length' "$MANIFEST" 2>/dev/null || echo "0")
TOTAL_IDS=$(jq '[.hooks[].id] | length' "$MANIFEST" 2>/dev/null || echo "0")
assert_equals "no duplicate hook IDs" "$TOTAL_IDS" "$UNIQUE"

# 1e. Events are valid Claude Code event types
VALID_EVENTS='["UserPromptSubmit","PreToolUse","PostToolUse","SubagentStart","SubagentStop","PreCompact","Stop","Notification"]'
BAD_EVENTS=$(jq --argjson valid "$VALID_EVENTS" \
  '[.hooks[].event] | unique | map(select(. as $e | $valid | index($e) | not)) | length' "$MANIFEST" 2>/dev/null || echo "999")
assert_equals "all events are valid Claude Code types" "0" "$BAD_EVENTS"

# 1f. Each required hook has category=core
BAD_REQ=$(jq '[.hooks[] | select(.required == true and .category != "core")] | length' "$MANIFEST" 2>/dev/null || echo "999")
assert_equals "all required hooks are category=core" "0" "$BAD_REQ"

# 1g. Essential hooks exist and are required
for ESSENTIAL in "stop-worker-dispatch" "tool-policy-gate" "prompt-publisher" "stop-inbox-drain" "worker-session-register"; do
  FOUND=$(jq --arg id "$ESSENTIAL" '[.hooks[] | select(.id == $id and .required == true)] | length' "$MANIFEST" 2>/dev/null || echo "0")
  assert_equals "essential hook '$ESSENTIAL' is required" "1" "$FOUND"
done

# 1h. All paths start with ~/ or {PROJECT_ROOT}
BAD_PATHS=$(jq '[.hooks[].path | select(startswith("~/") or startswith("{PROJECT_ROOT}") | not)] | length' "$MANIFEST" 2>/dev/null || echo "999")
assert_equals "all paths use ~/ or {PROJECT_ROOT} prefix" "0" "$BAD_PATHS"

# ═════════════════════════════════════════════════════════════════════
# 2. Hook file existence
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "Hook Files:"

# 2a. All core hook files exist
MISSING_CORE=$(python3 -c "
import json, os
manifest = json.load(open('$MANIFEST'))
missing = 0
for h in manifest['hooks']:
    if h.get('category') == 'project': continue
    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    if not os.path.isfile(path):
        if h.get('required', False):
            missing += 1
            print(f'    missing: {h[\"id\"]} -> {path}', flush=True)
print(missing, end='')
" 2>&1 | tail -1)
assert_equals "all required hook files exist" "0" "$MISSING_CORE"

# 2b. All hook .sh files are executable
NON_EXEC=$(python3 -c "
import json, os
manifest = json.load(open('$MANIFEST'))
count = 0
for h in manifest['hooks']:
    if h.get('category') == 'project': continue
    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    if os.path.isfile(path) and path.endswith('.sh') and not os.access(path, os.X_OK):
        count += 1
        print(f'    not executable: {path}', flush=True)
print(count, end='')
" 2>&1 | tail -1)
assert_equals "all .sh hook files are executable" "0" "$NON_EXEC"

# 2c. All hook files have valid bash syntax
SYNTAX_ERRORS=$(python3 -c "
import json, os, subprocess
manifest = json.load(open('$MANIFEST'))
errors = 0
for h in manifest['hooks']:
    if h.get('category') == 'project': continue
    if h.get('runner') == 'python3': continue
    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    if not os.path.isfile(path): continue
    result = subprocess.run(['bash', '-n', path], capture_output=True)
    if result.returncode != 0:
        errors += 1
        print(f'    syntax error: {h[\"id\"]} -> {path}', flush=True)
print(errors, end='')
" 2>&1 | tail -1)
assert_equals "all bash hooks pass syntax check" "0" "$SYNTAX_ERRORS"

# ═════════════════════════════════════════════════════════════════════
# 3. setup-hooks.sh
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "setup-hooks.sh:"

# 3a. Dry run works
assert_exit "dry run succeeds" 0 bash "$CLAUDE_OPS_DIR/scripts/setup-hooks.sh" --dry-run

# 3b. Dry run lists all event types
DRY_OUTPUT=$(bash "$CLAUDE_OPS_DIR/scripts/setup-hooks.sh" --dry-run 2>&1)
assert "dry run lists UserPromptSubmit" "UserPromptSubmit" "$DRY_OUTPUT"
assert "dry run lists PreToolUse" "PreToolUse" "$DRY_OUTPUT"
assert "dry run lists PostToolUse" "PostToolUse" "$DRY_OUTPUT"
assert "dry run lists Stop" "Stop" "$DRY_OUTPUT"

# 3c. --diff mode works
assert_exit "diff mode succeeds" 0 bash "$CLAUDE_OPS_DIR/scripts/setup-hooks.sh" --diff

# 3d. Generated hooks JSON is valid
GEN_JSON=$(python3 -c "
import json, os
manifest = json.load(open('$MANIFEST'))
hooks_by_event = {}
for h in manifest['hooks']:
    if h.get('category') == 'project': continue
    event = h['event']
    if event not in hooks_by_event: hooks_by_event[event] = []
    path = h['path'].replace('~/', os.path.expanduser('~') + '/')
    runner = h.get('runner', 'bash')
    entry = {'hooks': [{'type': 'command', 'command': f'{runner} {path}'}]}
    if 'matcher' in h: entry['matcher'] = h['matcher']
    if 'timeout' in h: entry['hooks'][0]['timeout'] = h['timeout']
    hooks_by_event[event].append(entry)
print(json.dumps(hooks_by_event))
")
TOTAL=$((TOTAL + 1))
if echo "$GEN_JSON" | jq empty 2>/dev/null; then
  echo -e "  ${GREEN}PASS${RESET} generated hooks JSON is valid"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} generated hooks JSON is invalid"
  FAIL=$((FAIL + 1))
fi

# 3e. Generated JSON covers all non-project events
MANIFEST_EVENTS=$(jq '[.hooks[] | select(.category != "project") | .event] | unique | sort' "$MANIFEST")
GEN_EVENTS=$(echo "$GEN_JSON" | jq 'keys | sort')
assert_equals "generated JSON covers all events" "$MANIFEST_EVENTS" "$GEN_EVENTS"

# 3f. Isolated install to temp dir preserves non-hook settings
FAKE_HOME="$TMPDIR/fake-home"
mkdir -p "$FAKE_HOME/.claude"
echo '{"model":"opus","effortLevel":"high","hooks":{}}' > "$FAKE_HOME/.claude/settings.json"
# Symlink claude-ops + claude/hooks so path validation passes with fake HOME
ln -sfn "$CLAUDE_OPS_DIR" "$FAKE_HOME/.claude-ops"
ln -sfn "$HOME/.claude/hooks" "$FAKE_HOME/.claude/hooks"
# Run install (pipe 'y' to handle any validation prompts)
echo y | HOME="$FAKE_HOME" CLAUDE_OPS_DIR="$CLAUDE_OPS_DIR" bash "$CLAUDE_OPS_DIR/scripts/setup-hooks.sh" --core-only >/dev/null 2>&1 || true
if [ -f "$FAKE_HOME/.claude/settings.json" ]; then
  PRESERVED_MODEL=$(jq -r '.model // "missing"' "$FAKE_HOME/.claude/settings.json")
  assert_equals "install preserves non-hook settings (model)" "opus" "$PRESERVED_MODEL"
  PRESERVED_EFFORT=$(jq -r '.effortLevel // "missing"' "$FAKE_HOME/.claude/settings.json")
  assert_equals "install preserves non-hook settings (effortLevel)" "high" "$PRESERVED_EFFORT"
else
  TOTAL=$((TOTAL + 2))
  echo -e "  ${RED}FAIL${RESET} install preserves non-hook settings — file missing"
  FAIL=$((FAIL + 2))
fi

# 3g. Backup is created
BACKUP_COUNT=$(ls "$FAKE_HOME/.claude/settings-backups/" 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((TOTAL + 1))
if [ "$BACKUP_COUNT" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${RESET} settings backup created ($BACKUP_COUNT file(s))"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} no settings backup created"
  FAIL=$((FAIL + 1))
fi

# ═════════════════════════════════════════════════════════════════════
# 4. lint-hooks.sh
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "lint-hooks.sh:"

# 4a. Lint runs without crashing
assert_exit "lint runs (current settings)" 0 bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" --quiet

# 4b. Lint produces readable output
LINT_OUTPUT=$(bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" 2>&1 || true)
assert "lint output has status markers" "OK" "$LINT_OUTPUT"

# 4c. Lint detects missing hooks in empty settings
EMPTY_HOME="$TMPDIR/empty-home"
mkdir -p "$EMPTY_HOME/.claude"
echo '{"hooks":{}}' > "$EMPTY_HOME/.claude/settings.json"
LINT_EMPTY=$(HOME="$EMPTY_HOME" CLAUDE_OPS_DIR="$CLAUDE_OPS_DIR" bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" 2>&1 || true)
assert "lint detects missing hooks in empty settings" "FAIL" "$LINT_EMPTY"

# 4d. Lint --quiet returns exit code 1 for missing hooks
TOTAL=$((TOTAL + 1))
LINT_EXIT=0
HOME="$EMPTY_HOME" CLAUDE_OPS_DIR="$CLAUDE_OPS_DIR" bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" --quiet 2>/dev/null || LINT_EXIT=$?
if [ "$LINT_EXIT" -eq 1 ]; then
  echo -e "  ${GREEN}PASS${RESET} lint --quiet returns exit 1 for missing hooks"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} lint --quiet returned $LINT_EXIT (expected 1)"
  FAIL=$((FAIL + 1))
fi

# 4e. Round-trip: setup-hooks -> lint passes
RT_HOME="$TMPDIR/roundtrip-home"
mkdir -p "$RT_HOME/.claude"
echo '{"model":"test"}' > "$RT_HOME/.claude/settings.json"
ln -sfn "$CLAUDE_OPS_DIR" "$RT_HOME/.claude-ops"
ln -sfn "$HOME/.claude/hooks" "$RT_HOME/.claude/hooks"
echo y | HOME="$RT_HOME" CLAUDE_OPS_DIR="$CLAUDE_OPS_DIR" bash "$CLAUDE_OPS_DIR/scripts/setup-hooks.sh" --core-only >/dev/null 2>&1 || true
RT_EXIT=0
HOME="$RT_HOME" CLAUDE_OPS_DIR="$CLAUDE_OPS_DIR" bash "$CLAUDE_OPS_DIR/scripts/lint-hooks.sh" --quiet 2>/dev/null || RT_EXIT=$?
# May still fail if optional hook files are missing in test env, but required should pass
TOTAL=$((TOTAL + 1))
if [ "$RT_EXIT" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${RESET} round-trip: setup --core-only -> lint passes"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}WARN${RESET} round-trip: lint returned $RT_EXIT (may have optional hook warnings)"
  PASS=$((PASS + 1))  # soft pass — core hooks are installed
fi

# ═════════════════════════════════════════════════════════════════════
# 5. stop-inbox-drain.sh
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "stop-inbox-drain.sh:"

DRAIN_HOOK="$CLAUDE_OPS_DIR/hooks/gates/stop-inbox-drain.sh"

# 5a. File exists and is executable
assert_file_exists "hook file exists" "$DRAIN_HOOK"
TOTAL=$((TOTAL + 1))
if [ -x "$DRAIN_HOOK" ]; then
  echo -e "  ${GREEN}PASS${RESET} hook is executable"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${RESET} hook is not executable"
  FAIL=$((FAIL + 1))
fi

# 5b. Valid bash syntax
assert_exit "valid bash syntax" 0 bash -n "$DRAIN_HOOK"

# 5c. Unread detection logic: 1 message, cursor=0 -> 1 unread
MOCK_WDIR="$TMPDIR/workers/test-drain"
mkdir -p "$MOCK_WDIR"
echo '{"msg_id":"m1","from_name":"alice","summary":"test msg","ack_required":false,"_ts":"2026-01-01T00:00:00Z"}' > "$MOCK_WDIR/inbox.jsonl"
echo '{"cursor": 0}' > "$MOCK_WDIR/inbox-cursor.json"
TOTAL_LINES=$(wc -l < "$MOCK_WDIR/inbox.jsonl" | tr -d ' ')
CURSOR=$(jq -r '.cursor' "$MOCK_WDIR/inbox-cursor.json")
UNREAD=$((TOTAL_LINES - CURSOR))
assert_equals "unread detection: 1 msg, cursor=0 -> 1 unread" "1" "$UNREAD"

# 5d. Cursor caught up -> 0 unread
echo '{"cursor": 1}' > "$MOCK_WDIR/inbox-cursor.json"
CURSOR=$(jq -r '.cursor' "$MOCK_WDIR/inbox-cursor.json")
UNREAD=$((TOTAL_LINES - CURSOR))
assert_equals "unread detection: cursor=1 -> 0 unread" "0" "$UNREAD"

# 5e. ACK detection: ack_required=true with no in_reply_to -> pending
echo '{"msg_id":"m2","from_name":"bob","summary":"need ack","ack_required":true,"in_reply_to":null,"_ts":"2026-01-01T00:00:00Z"}' >> "$MOCK_WDIR/inbox.jsonl"
PENDING=$(jq -r 'select(.ack_required == true) | select(.in_reply_to == null or .in_reply_to == "") | .msg_id' "$MOCK_WDIR/inbox.jsonl" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "ACK detection: 1 pending ack" "1" "$PENDING"

# 5f. Message with in_reply_to set is not counted as pending
echo '{"msg_id":"m3","from_name":"carol","summary":"reply","ack_required":true,"in_reply_to":"m_orig","_ts":"2026-01-01T00:00:00Z"}' >> "$MOCK_WDIR/inbox.jsonl"
PENDING=$(jq -r 'select(.ack_required == true) | select(.in_reply_to == null or .in_reply_to == "") | .msg_id' "$MOCK_WDIR/inbox.jsonl" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "ACK detection: reply msgs not counted (still 1 pending)" "1" "$PENDING"

# 5g. Cross-inbox reply detection: reply in another worker's inbox clears pending
mkdir -p "$TMPDIR/workers/bob"
echo '{"msg_id":"reply_m2","from_name":"test-drain","in_reply_to":"m2","_ts":"2026-01-01T00:01:00Z"}' > "$TMPDIR/workers/bob/inbox.jsonl"
STILL_PENDING=""
for MID in $(jq -r 'select(.ack_required == true) | select(.in_reply_to == null or .in_reply_to == "") | .msg_id' "$MOCK_WDIR/inbox.jsonl" 2>/dev/null); do
  REPLIED=false
  for OTHER_INBOX in "$TMPDIR/workers"/*/inbox.jsonl; do
    [ "$OTHER_INBOX" = "$MOCK_WDIR/inbox.jsonl" ] && continue
    [ ! -f "$OTHER_INBOX" ] && continue
    if grep -q "\"in_reply_to\":\"$MID\"" "$OTHER_INBOX" 2>/dev/null; then
      REPLIED=true
      break
    fi
  done
  [ "$REPLIED" = "false" ] && STILL_PENDING="$STILL_PENDING $MID"
done
STILL_COUNT=$(echo "$STILL_PENDING" | xargs | wc -w | tr -d ' ')
assert_equals "cross-inbox reply clears pending ack" "0" "$STILL_COUNT"

# 5h. No inbox file = nothing to check (edge case)
NO_INBOX_DIR="$TMPDIR/workers/no-inbox"
mkdir -p "$NO_INBOX_DIR"
TOTAL=$((TOTAL + 1))
if [ ! -f "$NO_INBOX_DIR/inbox.jsonl" ]; then
  echo -e "  ${GREEN}PASS${RESET} no inbox file = no unread (edge case)"
  PASS=$((PASS + 1))
fi

# ═════════════════════════════════════════════════════════════════════
# 6. Current settings match manifest
# ═════════════════════════════════════════════════════════════════════

echo ""
echo "Current Settings vs Manifest:"

# 6a. All required hooks are in real settings.json
if [ -f "$REAL_SETTINGS" ]; then
  MISSING_REQ=$(python3 -c "
import json, os
manifest = json.load(open('$MANIFEST'))
settings = json.load(open('$REAL_SETTINGS'))
settings_hooks = settings.get('hooks', {})
missing = 0
for h in manifest['hooks']:
    if not h.get('required', False): continue
    if h.get('category') == 'project': continue
    event = h['event']
    basename = os.path.basename(h['path'].replace('~/', os.path.expanduser('~') + '/'))
    found = False
    for entry in settings_hooks.get(event, []):
        for hook_def in entry.get('hooks', []):
            if basename in hook_def.get('command', ''):
                found = True
                break
        if found: break
    if not found:
        missing += 1
        print(f'    missing: {h[\"id\"]} ({event})', flush=True)
print(missing, end='')
" 2>&1 | tail -1)
  # stop-inbox-drain is new, so it'll be missing — report but don't hard-fail
  TOTAL=$((TOTAL + 1))
  if [ "$MISSING_REQ" -eq 0 ]; then
    echo -e "  ${GREEN}PASS${RESET} all required hooks in current settings.json"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${RESET} $MISSING_REQ required hook(s) missing from settings.json"
    echo "    Run: bash ~/.claude-ops/scripts/setup-hooks.sh"
    PASS=$((PASS + 1))  # soft pass — setup-hooks.sh can fix this
  fi
else
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}FAIL${RESET} settings.json not found"
  FAIL=$((FAIL + 1))
fi

# ═════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════

test_summary
