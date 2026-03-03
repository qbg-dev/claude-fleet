#!/usr/bin/env bash
# worker-post-commit-hook.sh — Installed as .git/hooks/post-commit in worker worktrees.
# Generic upstream version — works with any project that has .claude/workers/{name}/.
#
# After each commit:
# 1. Updates worker state.json with latest commit info
# 2. Messages chief-of-staff via worker-message.sh (durable inbox delivery)
# 3. Sends desktop notification to Warren
# 4. Writes to shared commit log (.commit-log.jsonl)
# 5. Emits worker.commit bus event

# Resolve which worker this is from the branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
WORKER_NAME="${BRANCH#worker/}"
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null)
COMMIT_MSG=$(git log -1 --format='%s' 2>/dev/null)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

# Find the main repo root (worktree parent)
MAIN_ROOT="${PROJECT_ROOT}"
if [ -f "$PROJECT_ROOT/.git" ]; then
  # This is a worktree — .git is a file pointing to main repo
  MAIN_ROOT=$(grep gitdir "$PROJECT_ROOT/.git" | sed 's/gitdir: //' | sed 's|/.git/worktrees/.*||')
fi

STATE_FILE="$MAIN_ROOT/.claude/workers/$WORKER_NAME/state.json"

# Update state.json with last_commit info
if [ -f "$STATE_FILE" ]; then
  TMP=$(mktemp)
  jq --arg sha "$COMMIT_SHA" --arg msg "$COMMIT_MSG" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '.last_commit_sha = $sha | .last_commit_msg = $msg | .last_commit_at = $ts' \
    "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE" || rm -f "$TMP"
fi

# Notify chief-of-staff via worker-message.sh (durable inbox + tmux delivery)
WORKER_MSG_SCRIPT="$HOME/.claude-ops/scripts/worker-message.sh"
if [ -x "$WORKER_MSG_SCRIPT" ]; then
  bash "$WORKER_MSG_SCRIPT" send chief-of-staff \
    "[$WORKER_NAME] committed $COMMIT_SHA on $BRANCH: $COMMIT_MSG" \
    --summary "commit $COMMIT_SHA by $WORKER_NAME" 2>/dev/null || true
fi

# Also send desktop notification via notify helper (if available)
if command -v notify &>/dev/null; then
  notify "[$WORKER_NAME] committed: $COMMIT_SHA — $COMMIT_MSG" "Worker Commit"
fi

# Write to shared commit log that chief-of-staff or any monitor can poll
COMMIT_LOG="$MAIN_ROOT/.claude/workers/.commit-log.jsonl"
echo "{\"worker\":\"$WORKER_NAME\",\"sha\":\"$COMMIT_SHA\",\"msg\":\"$COMMIT_MSG\",\"branch\":\"$BRANCH\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$COMMIT_LOG" 2>/dev/null

# Emit worker.commit bus event (side-effects handle inbox + tmux delivery)
_BUS_LIB="${CLAUDE_OPS_DIR:-${BORING_DIR:-$HOME/.boring}}/lib/event-bus.sh"
if [ -f "$_BUS_LIB" ]; then
  export PROJECT_ROOT="$MAIN_ROOT"
  source "$_BUS_LIB" 2>/dev/null || true
  PAYLOAD=$(jq -nc \
    --arg worker "$WORKER_NAME" \
    --arg sha "$COMMIT_SHA" \
    --arg msg "$COMMIT_MSG" \
    --arg branch "$BRANCH" \
    '{worker: $worker, commit_sha: $sha, message: $msg, branch: $branch, msg_type: "commit", severity: "info"}' 2>/dev/null || echo "")
  if [ -n "$PAYLOAD" ]; then
    bus_publish "worker.commit" "$PAYLOAD" 2>/dev/null || true
  fi
fi

exit 0
