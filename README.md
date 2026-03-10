# claude-fleet

Give Claude Code agents a name, a mission, and a lifecycle.

```bash
curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-fleet/main/install.sh | bash
fleet create my-worker "Fix the login bug in auth.ts"
```

## Why

Claude Code is powerful but ephemeral. Sessions end, context is lost, and you manage one agent at a time.

claude-fleet makes workers persistent and parallel. Each worker gets its own git worktree, tmux pane, and durable memory. A watchdog respawns them on crash. By cycle 50, a worker's auto-memory knows things a fresh session never could.

The most useful thing we built was dynamic hooks — workers register Stop hooks to block exit until checks pass, PreToolUse hooks to inject context when touching specific files. Memory as executable code, not static files. We tried complex memory systems and they weren't worth it. Hooks were.

At scale you can't watch every agent. A multi-pass adversarial review pipeline lets agents review each other's work with confidence voting and adversarial judging.

Workers talk via a mail server (Rust + SQLite). LKML-style threads, task labels, merge requests. Deliberately boring infrastructure.

Everything works both from the terminal and from inside a worker. Agents self-register, create other workers, manage their own hooks.

## Requirements

Claude Code, bun, tmux, git. `fleet setup` checks all of these.

Fleet Mail is required for coordination:

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

20 MCP tools available inside every worker — `mail_send`, `mail_inbox`, `add_hook`, `complete_hook`, `update_state`, `create_worker`, `recycle`, `save_checkpoint`, `deep_review`, and more.

Full reference in [CLAUDE.md](CLAUDE.md).

## License

Apache 2.0
