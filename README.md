# claude-fleet

Give Claude Code agents a name, a mission, and a lifecycle. They persist across crashes, talk to each other, and review each other's work.

```bash
git clone git@github.com:qbg-dev/claude-fleet.git ~/.claude-fleet
~/.claude-fleet/bin/fleet setup
fleet create my-worker "Fix the login bug in auth.ts"
```

## Why

Claude Code is powerful but ephemeral—sessions end, context is lost, and you manage one agent at a time.

**Persistent agents.** Workers have a name, mission, and config. A watchdog respawns them on crash. By cycle 50, auto-memory knows things a fresh session never could.

**Hooks as code-memory.** We tried complex memory systems—not worth it. But dynamic hooks turned out to be the killer feature. Workers register Stop hooks to block exit until checks pass. PreToolUse hooks inject context when touching specific files. Memory as executable code, not static files.

**Reliability at scale.** With ten agents, you can't watch them all. A multi-pass adversarial review pipeline lets agents review each other's work with confidence voting, adversarial judging, and end-to-end verification.

**Boring collaboration.** Workers talk via a mail server (Rust + SQLite). LKML-style threads, task labels, merge requests. Deliberately simple.

**CLI + MCP parity.** Everything works both from the terminal and from inside a worker. Agents self-register, create other workers, manage their own hooks. No forced choice.

## Requirements

[Claude Code](https://docs.anthropic.com/en/docs/claude-code), [bun](https://bun.sh), [tmux](https://github.com/tmux/tmux), git. `fleet setup` checks all of these.

Fleet Mail is required for coordination:
```bash
fleet mail-server start                    # local server
fleet mail-server connect http://host:8025 # or existing
```

## CLI

```bash
fleet create <name> "<mission>"   # create + launch worker
fleet ls                          # list workers
fleet stop <name>                 # graceful stop
fleet start <name>                # restart
fleet config <name> [key] [value] # get/set config
fleet log <name>                  # tail output
fleet mail <name>                 # check inbox
fleet mail-server status          # Fleet Mail info
```

Flags: `--model opus|sonnet|haiku`, `--effort high|max`, `--save`, `--json`

Config resolution: CLI flag > worker `config.json` > `defaults.json` > hardcoded

## MCP Tools (20, available inside every worker)

```
mail_send(to, subject, body)     # message workers or the operator
mail_inbox(label?)               # read inbox
add_hook(event, description)     # register dynamic hook
complete_hook(id, result?)       # mark gate as done
update_state(key, value)         # persist state across recycles
create_worker(name, type, mission)
recycle(message?)                # clean restart (blocked until gates pass)
save_checkpoint(summary)         # snapshot for crash recovery
deep_review(scope, spec)         # launch adversarial review
```

## Worker Types

| Type | Lifecycle | Use case |
|------|-----------|----------|
| **implementer** | One-shot | Fix bugs, build features |
| **optimizer** | Perpetual | Run evals, fix gaps |
| **monitor** | Perpetual | Watch for anomalies |
| **merger** | Perpetual | Cherry-pick to main, deploy |
| **chief-of-staff** | Perpetual | Relay messages, monitor fleet |
| **verifier** | One-shot | Exhaustive testing |

## How It Works

Each worker = Claude Code + git worktree + tmux pane + persistent config.

```
~/.claude/fleet/{project}/{worker}/
├── config.json    # model, hooks, permissions
├── state.json     # status, pane, cycles
├── mission.md     # what this worker does
├── launch.sh      # auto-generated restart command
└── token          # Fleet Mail auth
```

**Watchdog** (launchd, 30s): respawns dead workers, kills stuck ones (10min timeout), crash-loop protection (3/hr max), memory-leak recycling.

**Safety gates** (12 system hooks, irremovable): block rm -rf, force push, reset --hard, kill-session, checkout main, merge. Workers can't disable them.

**Dynamic hooks**: workers register their own at runtime via `add_hook()`. Three ownership tiers: system (irremovable) > creator > self.

## Deep Review

Multi-pass adversarial code review pipeline:

```bash
# From CLI
bash scripts/deep-review.sh --scope main --passes 2 --verify

# From inside a worker (MCP)
deep_review(scope="main", spec="Security audit", verify=true)
```

Parallel workers × focus areas → coordinator aggregates with confidence voting → adversarial judge validates → optional verifier deploys and tests.

## Docs

- [Getting Started](docs/getting-started.md) — installation, first worker, configuration
- [Architecture](docs/architecture.md) — components, data flow, file ownership
- [Hooks](docs/hooks.md) — lifecycle, context injection, policy enforcement
- [Event Bus](docs/event-bus.md) — JSONL event streaming
- [Worker Types](templates/flat-worker/types/README.md) — 6 archetypes

## License

Apache 2.0
