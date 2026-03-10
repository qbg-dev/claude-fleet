# claude-fleet

Give Claude Code agents a name, a mission, and a lifecycle.

```bash
curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-fleet/main/install.sh | bash
fleet create my-worker "Fix the login bug in auth.ts"
```

Or manually:
```bash
git clone git@github.com:qbg-dev/claude-fleet.git ~/.claude-fleet
~/.claude-fleet/bin/fleet setup
fleet create my-worker "Fix the login bug in auth.ts"
```

## Why

Claude Code is powerful but ephemeral—sessions end, context is lost, and you manage one agent at a time.

**Persistent agents.** Workers have a name, mission, and config. A watchdog respawns them on crash. By cycle 50, auto-memory knows things a fresh session never could.

**Hooks as code-memory.** Dynamic hooks turned out to be the killer feature. Workers register Stop hooks to block exit until checks pass. PreToolUse hooks inject context when touching specific files. Memory as executable code, not static files.

**Reliability at scale.** With ten agents, you can't watch them all. A multi-pass adversarial review pipeline lets agents review each other's work with confidence voting and adversarial judging.

**Boring collaboration.** Workers talk via a mail server (Rust + SQLite). LKML-style threads, task labels, merge requests. Deliberately simple.

**CLI + MCP parity.** Everything works both from the terminal and from inside a worker. Agents self-register, create other workers, manage their own hooks.

## Requirements

[Claude Code](https://docs.anthropic.com/en/docs/claude-code), [bun](https://bun.sh), [tmux](https://github.com/tmux/tmux), git.

Fleet Mail is required—set it up before `fleet setup`:
```bash
fleet mail-server start                    # local server
fleet mail-server connect http://host:8025 # or existing
```

## Usage

```bash
fleet create <name> "<mission>"   # create + launch
fleet ls                          # list workers
fleet stop <name>                 # graceful stop
fleet start <name>                # restart
fleet config <name> [key] [value] # get/set config
fleet log <name>                  # tail output
fleet mail <name>                 # check inbox
```

See [CLAUDE.md](CLAUDE.md) for the full reference (MCP tools, hooks, watchdog, worker types, architecture).

## License

Apache 2.0
