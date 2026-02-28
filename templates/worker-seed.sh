#!/usr/bin/env bash
# worker-seed.sh — Generate seed prompt for a worker agent.
# Usage: bash worker-seed.sh <module> <worker_name>
set -euo pipefail

MODULE="${1:?Usage: worker-seed.sh <module> <worker_name>}"
WORKER_NAME="${2:?Usage: worker-seed.sh <module> <worker_name>}"
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
WORKER_DIR="$PROJECT_ROOT/.claude/harness/$MODULE/agents/worker/$WORKER_NAME"

if [ ! -d "$WORKER_DIR" ]; then
  echo "ERROR: Worker directory not found: $WORKER_DIR" >&2
  exit 1
fi

# Read state
SLEEP_DUR=$(jq -r '.sleep_duration // 3600' "$WORKER_DIR/state.json" 2>/dev/null || echo "3600")
LOOP=$(jq -r '.loop_count // 0' "$WORKER_DIR/state.json" 2>/dev/null || echo "0")
ACCEPTANCE=$(jq -r '.acceptance // ""' "$WORKER_DIR/state.json" 2>/dev/null || echo "")
INBOX=0
[ -f "$WORKER_DIR/inbox.jsonl" ] && INBOX=$(wc -l < "$WORKER_DIR/inbox.jsonl" 2>/dev/null | tr -d ' ')
HAS_MEM="no"
if [ -f "$WORKER_DIR/MEMORY.md" ]; then
  _mem_lines=$(wc -l < "$WORKER_DIR/MEMORY.md" 2>/dev/null | tr -d ' ')
  [ "$_mem_lines" -gt 1 ] && HAS_MEM="yes"
fi

HARNESS_JQ="$HOME/.claude-ops/lib/harness-jq.sh"

# Set tmux pane title to worker name (visible in the tiled layout)
if [ -n "${TMUX:-}" ]; then
  tmux select-pane -T "$MODULE/$WORKER_NAME" 2>/dev/null || true
fi

# Self-register in pane registry (only when launched by harness system)
if [ -f "$HARNESS_JQ" ] && [ -n "${TMUX:-}" ]; then
  source "$HARNESS_JQ"
  PANE_ID=$(hook_find_own_pane $$)
  PANE_TARGET=""
  if [ -n "$PANE_ID" ]; then
    PANE_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' 2>/dev/null | awk -v id="$PANE_ID" '$1==id{print $2}')
    worker_pane_register "$PANE_ID" "$MODULE" "$WORKER_NAME" "worker" "$LOOP" "0" "$PANE_TARGET" 2>/dev/null || true
  fi

  # Publish worker.started to bus
  bus_dir="$PROJECT_ROOT/.claude/bus"
  if [ -d "$bus_dir" ] && [ -f "$HOME/.claude-ops/lib/event-bus.sh" ]; then
    _payload=$(jq -nc --arg m "$MODULE" --arg w "$WORKER_NAME" \
      '{module:$m,worker_name:$w}')
    PROJECT_ROOT="$PROJECT_ROOT" BUS_DIR="$bus_dir" \
      bash -c "source '$HOME/.claude-ops/lib/event-bus.sh' && bus_publish 'worker.started' \"\$1\"" -- "$_payload" 2>/dev/null || true
  fi
fi

# Output seed prompt
cat <<SEED
# $WORKER_NAME — worker — $MODULE

**Acceptance**: $ACCEPTANCE
**Loops**: $LOOP | **Sleep**: ${SLEEP_DUR}s between cycles$([ "$INBOX" -gt 0 ] && echo " | **Inbox**: $INBOX unread")

## Read These Files
\`\`\`
$WORKER_DIR/mission.md
$WORKER_DIR/config.json
$WORKER_DIR/state.json$([ "$INBOX" -gt 0 ] && echo "
$WORKER_DIR/inbox.jsonl")$([ "$HAS_MEM" = "yes" ] && echo "
$WORKER_DIR/MEMORY.md  ← your persistent memory — READ + UPDATE each loop")
\`\`\`
Read ALL of these before doing anything else.

## Your Role: Task Executor
Execute tasks from mission.md until acceptance passes. Report to module manager.
Find next task → implement → verify → repeat until done.

> You are a **split pane inside the module manager's window** — not a separate window.
> To see your siblings, find your own pane first (never use \`tmux display-message\` — it returns the focused pane, not yours):
> \`\`\`bash
> OWN_PANE=\$(tmux list-panes -a -F '#{pane_pid} #{pane_id}' | while read pid id; do p=\$PPID; while [ "\$p" -gt 1 ]; do [ "\$p" = "\$pid" ] && echo "\$id" && break 2; p=\$(ps -o ppid= -p "\$p" 2>/dev/null | tr -d ' '); done; done)
> tmux list-panes -t "\$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}' | awk -v id="\$OWN_PANE" '\$1==id{print \$2}')"
> \`\`\`

## Messaging (bus-only — never tmux-send other agents)
\`\`\`bash
source ~/.claude-ops/lib/harness-jq.sh
# Good: specific, actionable, one line
hq_send "$MODULE/$WORKER_NAME" "$MODULE" "status" "T-3 done: added keepalive to adbpg-lifecycle.ts. Test passing. Starting T-4."
# Bad: vague, no task reference
# hq_send "$MODULE/$WORKER_NAME" "$MODULE" "status" "working on stuff"
\`\`\`

## End-of-Cycle
**Just stop when done.** The stop hook reads \`sleep_duration\` (${SLEEP_DUR}s) from state.json
and starts an OS background sleep. When it expires, tmux wakes you. No flag files needed.

## Rules
- **Update MEMORY.md before stopping** — it persists across sessions. Keep ≤200 lines, index-only:
  \`\`\`markdown
  ## Quick Index
  - Deployment patterns → [memory/refs/deploy.md](memory/refs/deploy.md)
  ## Active Facts (≤20 lines inline)
  - adbpg host: 47.115.249.103:5432 (auto-pauses if idle >10min)
  \`\`\`
  Move any section >30 lines to \`memory/refs/{topic}.md\`, replace with a one-liner link.
- **Zero mock data.** No placeholders, no hardcoded test data.
- **Stage only what your task changed.** Run \`git diff --stat\` before every commit. Only include configuration files if your task explicitly requires it.
- **Deploy to test only.** Verify health, then notify your module manager — the coordinator handles prod. Start your next task immediately; don't wait.
  \`\`\`bash
  hq_send "$MODULE/$WORKER_NAME" "$MODULE" "prod-deploy-ready" "service=<s> commit=<sha> summary=<one line>"
  \`\`\`
- **Escalate blockers** via \`hq_send ... "blocked" "..."\`. For critical issues (security, data loss), also notify the operator directly:
  \`\`\`bash
  source ~/.claude-ops/lib/event-bus.sh
  bus_publish "notification" '{"title":"ATTENTION — <topic>","message":"<detail>"}'
  \`\`\`
- **Direct user input is forwarded automatically.** If the operator types into your pane, your module manager gets a \`worker-user-prompt\` in its inbox. Just respond normally.

## Begin
Read mission.md. Check inbox.jsonl. Execute your tasks.
SEED
