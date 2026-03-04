#!/usr/bin/env bash
# launch-main-window.sh — Launch 4 workers in a 2x2 tmux grid on the main branch.
#
# Workers: merger (top-left), patrol (top-right), chief-of-staff (bottom-left), indexer (bottom-right)
# All run in the main repo (no worktrees) on the main branch.
#
# Usage: bash launch-main-window.sh [--project /path/to/repo]
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
TARGET_SESSION="w"
PROJECT_ROOT="${PROJECT_ROOT:-}"
WINDOW_NAME="main"

# Workers in layout order: top-left, top-right, bottom-left, bottom-right
WORKERS=("merger" "patrol" "chief-of-staff" "indexer")

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ROOT="$2"; shift 2 ;;
    --session) TARGET_SESSION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Auto-detect project root
if [ -z "$PROJECT_ROOT" ]; then
  PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# Validate worker dirs exist
for w in "${WORKERS[@]}"; do
  WDIR="$PROJECT_ROOT/.claude/workers/$w"
  if [ ! -d "$WDIR" ]; then
    echo "ERROR: worker dir not found: $WDIR"
    exit 1
  fi
done

# ── Ensure tmux session exists ──────────────────────────────────────
if ! tmux has-session -t "$TARGET_SESSION" 2>/dev/null; then
  tmux new-session -d -s "$TARGET_SESSION" -n "$WINDOW_NAME" -c "$PROJECT_ROOT"
  CREATED_SESSION=1
else
  CREATED_SESSION=0
fi

# ── Create window ────────────────────────────────────────────────────
if [ "$CREATED_SESSION" -eq 1 ]; then
  # Session was just created — rename default window
  tmux rename-window -t "$TARGET_SESSION" "$WINDOW_NAME"
  PANE0=$(tmux list-panes -t "$TARGET_SESSION:$WINDOW_NAME" -F '#{pane_id}' | head -1)
else
  # Create new window in existing session
  PANE0=$(tmux new-window -t "$TARGET_SESSION" -n "$WINDOW_NAME" -c "$PROJECT_ROOT" -d -P -F '#{pane_id}')
fi

# ── Split into 2x2 grid ─────────────────────────────────────────────
# Start with pane0 (top-left = merger)
# Split right → pane1 (top-right = patrol)
PANE1=$(tmux split-window -t "$PANE0" -h -c "$PROJECT_ROOT" -d -P -F '#{pane_id}')
# Split pane0 down → pane2 (bottom-left = chief-of-staff)
PANE2=$(tmux split-window -t "$PANE0" -v -c "$PROJECT_ROOT" -d -P -F '#{pane_id}')
# Split pane1 down → pane3 (bottom-right = indexer)
PANE3=$(tmux split-window -t "$PANE1" -v -c "$PROJECT_ROOT" -d -P -F '#{pane_id}')

PANES=("$PANE0" "$PANE1" "$PANE2" "$PANE3")

echo "Created 2x2 grid: ${PANES[*]}"

# ── Install post-commit hooks in ALL active worker worktrees ─────────
# These hooks notify merger (not chief-of-staff) of new commits
HOOK_SCRIPT="$HOME/.claude-ops/scripts/worker-post-commit-hook.sh"
if [ -f "$HOOK_SCRIPT" ]; then
  for WORKTREE_DIR in "$PROJECT_ROOT"/../${PROJECT_NAME}-w-*/; do
    [ ! -d "$WORKTREE_DIR" ] && continue
    WORKTREE_GIT_DIR=$(git -C "$WORKTREE_DIR" rev-parse --git-dir 2>/dev/null || true)
    if [ -n "$WORKTREE_GIT_DIR" ]; then
      HOOKS_DIR="$WORKTREE_GIT_DIR/hooks"
      mkdir -p "$HOOKS_DIR"
      cp "$HOOK_SCRIPT" "$HOOKS_DIR/post-commit"
      chmod +x "$HOOKS_DIR/post-commit"
    fi
  done
  echo "Installed post-commit hooks in worker worktrees"
fi

# ── Pane registry ────────────────────────────────────────────────────
PANE_REG="${HARNESS_STATE_DIR:-${HOME}/.boring/state}/pane-registry.json"
[ ! -f "$PANE_REG" ] && echo '{"workers":{},"panes":{}}' > "$PANE_REG"

# ── Launch each worker ───────────────────────────────────────────────
for i in "${!WORKERS[@]}"; do
  WORKER="${WORKERS[$i]}"
  PANE="${PANES[$i]}"
  WORKER_DIR="$PROJECT_ROOT/.claude/workers/$WORKER"
  PERMS="$WORKER_DIR/permissions.json"

  # Set pane title
  tmux select-pane -T "$WORKER" -t "$PANE"

  # Read config
  MODEL=$(jq -r '.model // "sonnet"' "$PERMS" 2>/dev/null || echo "sonnet")
  PERM_MODE=$(jq -r '.permission_mode // "bypassPermissions"' "$PERMS" 2>/dev/null || echo "bypassPermissions")
  DISALLOWED=$(jq -c '.disallowedTools // []' "$PERMS" 2>/dev/null || echo "[]")
  STATE=$(cat "$WORKER_DIR/state.json" 2>/dev/null || echo '{"status":"idle","cycles_completed":0}')
  TASKS=$(cat "$WORKER_DIR/tasks.json" 2>/dev/null || echo '{}')

  # Get pane target for registry
  _PANE_TARGET=$(tmux list-panes -a -F '#{pane_id} #{session_name}:#{window_index}.#{pane_index}' \
    | awk -v p="$PANE" '$1==p{print $2}' 2>/dev/null || echo "")
  _PROJ_SLUG=$(basename "$PROJECT_ROOT")
  _WORKER_KEY="${_PROJ_SLUG}:${WORKER}"
  _NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Register in pane-registry.json (unified + flat compat)
  TMP_REG=$(mktemp)
  jq --arg pid "$PANE" --arg name "$WORKER" --arg target "${_PANE_TARGET:-}" \
    --arg proj "$PROJECT_ROOT" --arg sess "$TARGET_SESSION" \
    --arg wk "$_WORKER_KEY" --arg wdir "$WORKER_DIR" --arg wtdir "$PROJECT_ROOT" \
    --arg branch "main" --arg model "$MODEL" --arg perm_mode "$PERM_MODE" \
    --argjson disallowed "$DISALLOWED" --argjson state "$STATE" --argjson tasks "$TASKS" \
    --arg now "$_NOW" --arg win "$WINDOW_NAME" \
    '.workers //= {} | .panes //= {} |
    .workers[$wk] = ((.workers[$wk] // {}) * {
      project_root: $proj, worker_dir: $wdir, worktree: $wtdir, branch: $branch,
      window: $win,
      config: {model: $model, permission_mode: $perm_mode, disallowedTools: $disallowed}
    }) |
    (if (.workers[$wk].state // null) == null then .workers[$wk].state = $state else . end) |
    (if (.workers[$wk].tasks // null) == null then .workers[$wk].tasks = $tasks else . end) |
    .panes[$pid] = {
      worker: $name, role: "worker", pane_target: $target, tmux_session: $sess,
      session_id: "", parent_pane: null, registered_at: $now, window: $win
    } |
    .[$pid] = {
      harness: ("worker/" + $name), session_name: $name, display: $name,
      task: "worker", done: 0, total: 0, pane_target: $target,
      project_root: $proj, tmux_session: $sess, window: $win
    }' "$PANE_REG" > "$TMP_REG" 2>/dev/null && mv "$TMP_REG" "$PANE_REG" || rm -f "$TMP_REG"

  # Create seed file
  SEED_FILE="/tmp/worker-${WORKER}-seed.txt"
  cat > "$SEED_FILE" << WSEED
You are worker **$WORKER** running on **main** branch (no worktree).
Project root: $PROJECT_ROOT
Worker config: $WORKER_DIR/

Read these files NOW in this order:
1. $WORKER_DIR/mission.md — your goals and tasks
2. $WORKER_DIR/state.json — current cycle count and status
3. $PROJECT_ROOT/.claude/workers/PERPETUAL-PROTOCOL.md — self-optimization protocol

Then begin your cycle immediately.

## Cycle Pattern

Every cycle follows this sequence:

1. **Drain inbox** — \`read_inbox(clear=true)\` — act on messages before anything else
2. **Check tasks** — \`list_tasks(filter="pending")\` — find highest-priority unblocked work
3. **Do the work** — follow your mission.md cycle protocol
4. **Update state** — \`update_state("cycles_completed", N+1)\` then \`update_state("last_cycle_at", ISO)\`
5. **Perpetual?** — if \`perpetual: true\`, sleep for \`sleep_duration\` seconds, then loop

If your inbox has a message from Warren or chief-of-staff, prioritize it over your current task list.

## 三省 — End of Every Cycle

After completing work but before sleeping, perform three reflections:

1. **为人谋而不忠乎** — Re-read mission.md. Are you working on what Warren needs?
2. **与朋友交而不信乎** — Verify your results end-to-end. A 200 OK with wrong data is worse than a 500.
3. **传不习乎** — Update MEMORY.md with what you learned this cycle.

## MCP Tools (\`mcp__worker-fleet__*\`)

| Tool | What it does |
|------|-------------|
| \`send_message(to, content, summary)\` | Send to a worker, "parent", or raw pane ID "%NN" |
| \`broadcast(content, summary)\` | Send to ALL workers (use sparingly) |
| \`read_inbox(limit?, since?, clear?)\` | Read your inbox; \`clear=true\` truncates after reading |
| \`create_task(subject, priority?, ...)\` | Add a task to your task list |
| \`update_task(task_id, status?)\` | Update task status or owner |
| \`list_tasks(filter?, worker?)\` | List tasks; \`worker="all"\` for cross-worker view |
| \`get_worker_state(name?)\` | Read any worker's state.json |
| \`update_state(key, value)\` | Update your state.json + emit bus event |
| \`fleet_status()\` | Full fleet overview (all workers) |
| \`deploy(service?)\` | Deploy to TEST server + auto health check |
| \`health_check(target?)\` | Check server health: \`test\` (default), \`prod\`, or \`both\` |
| \`smart_commit(message, files?, ...)\` | Commit with format validation |
| \`post_to_nexus(message, room?)\` | Post to Nexus chat (prefixed with your name) |
| \`recycle(message?)\` | Self-recycle: write handoff, restart fresh with new context |

## Main-Window Rules
- **You run on the main branch** — no worktree, no \`worker/*\` branch.
- **Only merger touches git** (merge, cherry-pick, commit). You do NOT run git write commands.
- **Micro-commits**: Every file change that works gets a commit. Don't batch.
- **Git lock**: Check \`.claude/workers/.git-lock\` exists before reading source files during merges.
WSEED

  # Set WORKER_NAME env and launch Claude
  CLAUDE_CMD="export WORKER_NAME=$WORKER && claude --model $MODEL"
  if [ "$PERM_MODE" = "bypassPermissions" ]; then
    CLAUDE_CMD="$CLAUDE_CMD --dangerously-skip-permissions"
  fi
  CLAUDE_CMD="$CLAUDE_CMD --add-dir $WORKER_DIR"

  tmux send-keys -t "$PANE" "$CLAUDE_CMD"
  tmux send-keys -t "$PANE" -H 0d

  echo "Launched $WORKER in pane $PANE"
done

# ── Wait for Claude TUI to be ready, then inject seeds ───────────────
echo "Waiting for Claude TUI to initialize..."
sleep 15  # initial wait for all 4 instances to start

for i in "${!WORKERS[@]}"; do
  WORKER="${WORKERS[$i]}"
  PANE="${PANES[$i]}"
  SEED_FILE="/tmp/worker-${WORKER}-seed.txt"

  # Wait for "bypass permissions" statusline (max 60s per worker)
  WAIT=0
  until tmux capture-pane -t "$PANE" -p 2>/dev/null | tail -5 | grep -qF 'bypass permissions'; do
    sleep 3; WAIT=$((WAIT+3))
    [ "$WAIT" -ge 60 ] && { echo "WARNING: $WORKER TUI timeout after 60s, proceeding anyway"; break; }
  done
  sleep 2

  # Inject seed via tmux buffer
  LAUNCH_BUFFER="launch-${WORKER}-$$"
  tmux delete-buffer -b "$LAUNCH_BUFFER" 2>/dev/null || true
  if ! tmux load-buffer -b "$LAUNCH_BUFFER" "$SEED_FILE"; then
    echo "ERROR: Failed to load seed for $WORKER"
    continue
  fi
  tmux paste-buffer -b "$LAUNCH_BUFFER" -t "$PANE" -d
  sleep 4
  tmux send-keys -t "$PANE" -H 0d

  # Retry Enter if TUI absorbed it
  sleep 3
  if tmux capture-pane -t "$PANE" -p 2>/dev/null | grep -qE '❯'; then
    tmux send-keys -t "$PANE" -H 0d
    echo "(Retried Enter for $WORKER)"
  fi

  rm -f "$SEED_FILE"
  echo "Seed injected for $WORKER"
done

echo ""
echo "Main window launched with 4 workers:"
echo "  top-left:     merger (${PANES[0]})"
echo "  top-right:    patrol (${PANES[1]})"
echo "  bottom-left:  chief-of-staff (${PANES[2]})"
echo "  bottom-right: indexer (${PANES[3]})"
