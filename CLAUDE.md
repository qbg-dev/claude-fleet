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

## MCP tools

20 tools available inside every worker:

| Tool | What it does |
|------|-------------|
| `mail_send(to, subject, body)` | message workers, coordinators, or the operator |
| `mail_inbox(label?)` | read inbox (UNREAD, TASK, INBOX) |
| `mail_read(thread_id)` | read specific thread |
| `mail_help()` | mail commands reference |
| `get_worker_state(name?)` | get single worker or all fleet state |
| `update_state(key, value)` | persist state across recycles |
| `add_hook(event, description, ...)` | register dynamic hook |
| `complete_hook(id, result?)` | mark blocking gate as done |
| `remove_hook(id)` | remove non-system hook |
| `list_hooks(scope?)` | list active dynamic hooks |
| `recycle(message?)` | clean restart (blocked until all gates pass) |
| `save_checkpoint(summary)` | snapshot working state for crash recovery |
| `create_worker(name, type, mission)` | spawn a new worker |
| `register_worker(name, config)` | register existing worker |
| `deregister_worker(name)` | deregister (mission_authority only) |
| `move_worker(name, project)` | move worker to different project |
| `standby_worker(name)` | mark as standby (mission_authority only) |
| `fleet_template(type)` | preview worker archetype template |
| `fleet_help()` | fleet commands reference |
| `deep_review(scope, spec, ...)` | launch adversarial review pipeline |

## Worker types

| Type | Lifecycle | Use case |
|------|-----------|----------|
| implementer | one-shot | fix bugs, build features |
| optimizer | perpetual | run evals, fix gaps |
| monitor | perpetual | watch for anomalies |
| merger | perpetual | cherry-pick to main, deploy |
| chief-of-staff | perpetual | relay messages, monitor fleet |
| verifier | one-shot | exhaustive testing |

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

12 system hooks (irremovable) block: rm -rf, force push, reset --hard, kill-session, checkout main, merge, direct config/state/token edits.

Workers register their own hooks at runtime:

```
add_hook(event="Stop", description="verify TypeScript compiles")
add_hook(event="PreToolUse", content="context to inject", condition={file_glob: "src/**"})
complete_hook("dh-1", result="PASS")
```

Events: PreToolUse, PostToolUse, Stop, UserPromptSubmit, PreCompact, SubagentStart/Stop.

Three ownership tiers: system (irremovable) > creator (worker can't remove) > self (worker manages).

## Watchdog

launchd daemon, checks every 30s. Respawns dead workers, kills stuck ones (10min timeout), crash-loop protection (3/hr max). Perpetual workers call `recycle()` and the watchdog respawns after `sleep_duration`.

## Key files

| Path | What it is |
|------|-----------|
| `cli/index.ts` | CLI entry (commander + Bun) |
| `cli/commands/` | subcommands |
| `mcp/worker-fleet/index.ts` | MCP server entry |
| `shared/types.ts` | canonical types (WorkerConfig, WorkerState, etc.) |
| `hooks/gates/` | safety gates (tool-policy, git-safety) |
| `hooks/interceptors/` | context injection |
| `hooks/publishers/` | event publishing, liveness heartbeat |
| `scripts/harness-watchdog.sh` | watchdog daemon |
| `scripts/launch-flat-worker.sh` | worker creation |
| `scripts/deep-review.sh` | adversarial review pipeline |
| `templates/flat-worker/types/` | worker archetypes |
| `tools/dr-context/` | Rust binary (review context analysis) |

## Conventions

Workers never push or merge — merger handles main. Shell scripts use `set -euo pipefail`. Config locks via `mkdir`. tmux: never literal Enter (`send-keys -H 0d`), never `display-message -p '#{pane_id}'`. All shared types live in `shared/types.ts`.
