# Tmux Operations

## Spawn Claude in a Pane

```bash
tmux new-window -d -t w -n myworker -c "$PROJECT"       # -d = don't steal focus
tmux send-keys -t "w:myworker" "claude --model opus --dangerously-skip-permissions"
tmux send-keys -t "w:myworker" -H 0d                    # Enter (hex, never literal)
sleep 12                                                  # wait for TUI
tmux load-buffer /tmp/seed.txt && tmux paste-buffer -t "w:myworker"
tmux send-keys -t "w:myworker" -H 0d                    # submit
```

## Rules

- **Never** literal `Enter` — always `send-keys -H 0d`
- **Never** `display-message -p '#{pane_id}'` — returns focused pane, not current
- **Always** `-d` on new-window/split-window

## Recovery

```bash
tmux send-keys -t "$PANE" Escape          # try escape first
pkill -TERM -P $(tmux display-message -t "$PANE" -p '#{pane_pid}')  # kill claude, keep shell
```
