# Setup claude-fleet

Run these commands to install claude-fleet and create your first worker:

```bash
# Install (if not already installed)
if [ ! -d "$HOME/.claude-fleet" ]; then
  git clone https://github.com/qbg-dev/claude-fleet.git ~/.claude-fleet
  ~/.claude-fleet/bin/fleet setup
fi

# Verify
fleet ls
```

If `fleet setup` fails with "Fleet Mail not configured", start a local server first:
```bash
fleet mail-server start
fleet setup
```

## Create a worker

```bash
fleet create <name> "<what this worker should do>"
```

This creates a git worktree, tmux pane, and Claude Code session with the mission injected. The worker starts immediately.

## Inside a worker

You have 20 MCP tools. The most important:

```
mail_inbox()                              # check for messages
mail_send(to="merger", subject="...", body="...")  # send messages
add_hook(event="Stop", description="...")  # block exit until check passes
complete_hook("dh-1", result="PASS")      # release a gate
update_state(key, value)                  # persist across recycles
recycle()                                 # clean restart
create_worker(name, type, mission)        # spawn another worker
```

## Perpetual workers

Set `sleep_duration` to loop:
```bash
fleet config my-worker sleep_duration 900  # 15-min cycles
```

The worker does work → calls `recycle()` → watchdog waits 15min → respawns.

## Full reference

Read `~/.claude-fleet/CLAUDE.md` for the complete CLI, MCP tools, hooks, and architecture reference.
