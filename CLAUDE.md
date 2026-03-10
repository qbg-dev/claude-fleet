# claude-fleet

Orchestration for Claude Code. Workers run in tmux panes on git worktrees, talk via Fleet Mail, watchdog keeps them alive.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-fleet/main/install.sh | bash
```

`fleet setup` checks deps (bun, tmux, claude), creates symlinks, registers the MCP server in `~/.claude/settings.json`, verifies Fleet Mail, and creates default config.

## CLI

```bash
fleet create <name> "<mission>"          # create + launch worker
fleet start  <name>                      # restart existing worker
fleet stop   <name> [--all]              # graceful stop
fleet ls     [--json]                    # list workers with liveness
fleet config <name> [key] [value]        # get/set config
fleet defaults [key] [value]             # global defaults
fleet fork   <parent> <child> "<mission>" # fork from existing session
fleet log    <name>                      # tail output
fleet attach <name>                      # attach to tmux pane
fleet mail   <name>                      # check inbox
fleet mail-server [connect|start|status] # manage Fleet Mail
fleet mcp    [register|status]           # manage MCP server
fleet run    <name> "<command>"          # run in worker's worktree
```

Flags: `--model opus|sonnet|haiku`, `--effort high|max`, `--save`, `--json`, `-p <project>`

Config resolution: CLI flag > worker `config.json` > `defaults.json` > hardcoded defaults

## MCP Tools (20)

| Tool | Description |
|------|-------------|
| `mail_send(to, subject, body)` | Message workers, coordinators, or the operator |
| `mail_inbox(label?)` | Read inbox (UNREAD, TASK, INBOX) |
| `mail_read(thread_id)` | Read specific thread |
| `mail_help()` | Mail commands reference |
| `get_worker_state(name?)` | Get single worker or all fleet state |
| `update_state(key, value)` | Persist state across recycles |
| `add_hook(event, description, ...)` | Register dynamic hook |
| `complete_hook(id, result?)` | Mark blocking gate as done |
| `remove_hook(id)` | Remove non-system hook |
| `list_hooks(scope?)` | List active dynamic hooks |
| `recycle(message?)` | Clean restart (blocked until all gates pass) |
| `save_checkpoint(summary)` | Snapshot working state for crash recovery |
| `create_worker(name, type, mission)` | Spawn a new worker |
| `register_worker(name, config)` | Register existing worker |
| `deregister_worker(name)` | Deregister (mission_authority only) |
| `move_worker(name, project)` | Move worker to different project |
| `standby_worker(name)` | Mark as standby (mission_authority only) |
| `fleet_template(type)` | Preview worker archetype template |
| `fleet_help()` | Fleet commands reference |
| `deep_review(scope, spec, ...)` | Launch adversarial review pipeline |

## Worker Types

| Type | Lifecycle | Use case |
|------|-----------|----------|
| **implementer** | One-shot | Fix bugs, build features |
| **optimizer** | Perpetual | Run evals, fix gaps |
| **monitor** | Perpetual | Watch for anomalies |
| **merger** | Perpetual | Cherry-pick to main, deploy |
| **chief-of-staff** | Perpetual | Relay messages, monitor fleet |
| **verifier** | One-shot | Exhaustive testing |

## Storage

```
~/.claude/fleet/
├── defaults.json              # global defaults
└── {project}/
    ├── fleet.json             # fleet-wide config (authorities, tmux session)
    └── {worker}/
        ├── config.json        # model, hooks, permissions
        ├── state.json         # status, pane, cycles
        ├── mission.md         # purpose
        ├── launch.sh          # auto-generated
        └── token              # Fleet Mail auth
```

## Hooks

**12 system hooks** (irremovable) block: rm -rf, force push, reset --hard, kill-session, checkout main, merge, direct config/state/token edits.

**Dynamic hooks** — workers register their own at runtime:

```
add_hook(event="Stop", description="verify TypeScript compiles")
add_hook(event="PreToolUse", content="context to inject", condition={file_glob: "src/**"})
complete_hook("dh-1", result="PASS")
```

Events: PreToolUse, PostToolUse, Stop, UserPromptSubmit, PreCompact, SubagentStart/Stop.

Ownership: **system** (irremovable) > **creator** (worker can't remove) > **self** (worker manages).

## Watchdog

launchd daemon, checks every 30s:
- Respawns dead workers
- Kills stuck ones (10min timeout)
- Crash-loop protection (3/hr max)
- Perpetual cycles: workers call `recycle()`, watchdog respawns after `sleep_duration`

## Key Files

| Path | Purpose |
|------|---------|
| `cli/index.ts` | CLI entry (commander + Bun) |
| `cli/commands/` | Subcommands |
| `mcp/worker-fleet/index.ts` | MCP server entry |
| `shared/types.ts` | Canonical types (WorkerConfig, WorkerState, etc.) |
| `hooks/gates/` | Safety gates (tool-policy, git-safety) |
| `hooks/interceptors/` | Context injection |
| `hooks/publishers/` | Event publishing, liveness heartbeat |
| `scripts/harness-watchdog.sh` | Watchdog daemon |
| `scripts/launch-flat-worker.sh` | Worker creation |
| `scripts/deep-review.sh` | Adversarial review pipeline |
| `templates/flat-worker/types/` | Worker archetypes |
| `tools/dr-context/` | Rust binary (review context analysis) |

## Conventions

- Workers never push or merge — merger handles main
- Shell: `set -euo pipefail`, config locks via `mkdir`
- tmux: never literal Enter (`send-keys -H 0d`), never `display-message -p '#{pane_id}'`
- Types: `shared/types.ts` is the single source of truth
- Hooks: gates block via exit code, context injection via stdout JSON
