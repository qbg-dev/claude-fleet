# Tmux Operations Reference

## Spawning a Claude Agent

```bash
PANE="w:workers.0"
PROJECT="/path/to/project"

# 1. Create pane (always -d to avoid focus switch)
tmux new-window -d -t w -n myworker -c "$PROJECT"

# 2. Launch Claude
tmux send-keys -t "$PANE" "claude --model opus --dangerously-skip-permissions"
tmux send-keys -t "$PANE" -H 0d  # NEVER literal Enter

# 3. Wait for TUI (~12s)
sleep 12
tmux capture-pane -t "$PANE" -p | tail -5 | grep -qF 'bypass permissions'

# 4. Inject seed via buffer (handles multi-line)
tmux load-buffer /tmp/seed.txt
tmux paste-buffer -t "$PANE"
sleep 2
tmux send-keys -t "$PANE" -H 0d
```

## Critical Rules

- **Never `Enter` literal** — always `send-keys -H 0d`
- **Never `display-message -p '#{pane_id}'`** — returns focused pane, not current
- **Always `-d` on new-window/split-window** — don't steal Warren's focus
- **Pane ID discovery**: use process-tree lookup, not display-message

## Recovery

```bash
# Stuck agent → try Escape first
tmux send-keys -t "$PANE" Escape

# Kill Claude process (keeps shell alive)
SHELL_PID=$(tmux display-message -t "$PANE" -p '#{pane_pid}')
pkill -TERM -P "$SHELL_PID"

# Redirect agent
tmux send-keys -t "$PANE" Escape
sleep 2
tmux send-keys -t "$PANE" "Stop. Re-read mission.md and resume."
tmux send-keys -t "$PANE" -H 0d
```

## Git Lock Contention

Workers in separate worktrees avoid `.git/index.lock` conflicts. If it happens:
```bash
lsof .git/index.lock 2>/dev/null || rm .git/index.lock
```
