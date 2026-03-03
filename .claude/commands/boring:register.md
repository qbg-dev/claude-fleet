---
description: "Register current pane with watchdog as a named worker"
argument-hint: "<worker-name>"
allowed-tools: Bash, Read
---

# Register Pane with Watchdog

Register the current tmux pane in the pane-registry so the watchdog can manage it (stuck detection, respawn, cycle tracking).

## What this does

1. Detects current tmux pane ID
2. Adds it to `~/.claude-ops/state/pane-registry.json` with the required `harness` key
3. Removes any stale registration for the same worker name
4. Writes `⚡ <worker-name>` to the pane border status file (`/tmp/tmux_pane_status_<pane_id>`)
5. Auto-detects session ID from scrollback

## Execute

If `$ARGUMENTS` is provided, use it as the worker name. Otherwise, try to auto-detect from the worktree branch name or ask.

```bash
# Auto-detect worker name from git branch if not provided
WORKER_NAME="$ARGUMENTS"
if [ -z "$WORKER_NAME" ]; then
  WORKER_NAME=$(git branch --show-current 2>/dev/null | sed 's|^worker/||')
fi
```

If worker name is detected, run:

```bash
bash .claude/scripts/register-pane.sh "$WORKER_NAME"
```

If `.claude/scripts/register-pane.sh` doesn't exist in the current project, use the inline version:

```bash
WORKER="$WORKER_NAME"
PANE_REG="$HOME/.claude-ops/state/pane-registry.json"
PANE_ID=$(tmux display-message -p '#{pane_id}')
PANE_TARGET=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}')
SESSION_ID=$(tmux capture-pane -t "$PANE_ID" -p 2>/dev/null | grep -oE '[a-f0-9-]{36}\.jsonl' | tail -1 | sed 's/\.jsonl//')

[ ! -f "$PANE_REG" ] && echo '{}' > "$PANE_REG"

# Remove old registration for this worker
TMP=$(mktemp)
jq --arg name "$WORKER" --arg harness "worker/$WORKER" \
  '[to_entries[] | select(.value.harness != $harness and .value.session_name != $name)] | from_entries' \
  "$PANE_REG" > "$TMP" 2>/dev/null || cp "$PANE_REG" "$TMP"

# Add new entry with harness key (REQUIRED for watchdog management)
jq --arg pid "$PANE_ID" --arg name "$WORKER" --arg target "$PANE_TARGET" --arg sid "${SESSION_ID:-}" \
  '.[$pid] = {
    harness: ("worker/" + $name),
    session_name: $name,
    display: $name,
    task: "worker",
    done: 0,
    total: 0,
    pane_target: $target
  } + (if ($sid | length) > 0 then {session_id: $sid} else {} end)' \
  "$TMP" > "${TMP}.2" && mv "${TMP}.2" "$PANE_REG"
rm -f "$TMP"

# Write pane border indicator
echo "⚡ $WORKER" > "/tmp/tmux_pane_status_${PANE_ID}"

echo "Registered $WORKER in pane $PANE_ID ($PANE_TARGET)"
echo "  harness: worker/$WORKER"
echo "  session_id: ${SESSION_ID:-(auto-detect failed)}"
echo "  Watchdog will now manage this pane"
```

After registration, confirm to the user what was registered and that the watchdog will now manage this pane.
