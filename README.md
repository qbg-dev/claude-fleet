# claude-ops

Autonomous agent fleet for Claude Code. Each worker = git worktree + tmux pane + persistent memory. Workers commit on their own branches, coordinate via MCP, and a watchdog keeps them alive forever.

## Why Worktrees?

Claude Code scopes auto-memory by filesystem path. Git worktrees give each worker a different path = **isolated persistent memory for free**. By cycle 50, a worker knows things a fresh session never could.

```
project/                 → main (merger only)
project-w-optimizer/     → worker/optimizer   (its own memory)
project-w-patrol/        → worker/patrol      (its own memory)
project-w-chief-of-staff/→ worker/chief-of-staff (fleet coordinator)
```

## Quick Start

```bash
# Install
bash <(curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-ops/main/install.sh)

# Bootstrap a project
bash ~/.claude-ops/scripts/init-project.sh /path/to/project --with-chief-of-staff

# Launch a worker
bash ~/.claude-ops/scripts/launch-flat-worker.sh my-worker

# Or from any running Claude session (MCP tool):
create_worker(name: "my-worker", mission: "...", launch: true)
```

## Architecture

```
launchd daemon (every 30s)
  └── watchdog ──→ registry.json ──→ for each worker:
        ├── alive + active?      → skip
        ├── alive + stuck?       → kill + resume session
        ├── alive + sleep done?  → kill + respawn with seed
        ├── dead + perpetual?    → create pane + relaunch
        └── 3+ crashes/hr?      → stop, alert chief-of-staff

Claude Code hooks (settings.json)
  ├── Stop gates         → block exit if unread inbox / pending ACKs
  ├── PreToolUse         → inject fleet context, enforce disallowed_tools
  └── PostToolUse        → emit events, register session ID

Worker Fleet MCP (per-project .mcp.json)
  ├── Messaging          → send_message, read_inbox (durable inbox.jsonl)
  ├── State              → heartbeat, update_state, fleet_status
  ├── Tasks              → create_task, update_task, list_tasks
  └── Lifecycle          → create_worker, deregister, standby, recycle
```

## How Workers Work

1. **Launch**: `launch-flat-worker.sh` creates worktree on `worker/{name}`, opens tmux pane, starts Claude with seed prompt (mission + inbox + fleet state)
2. **Cycle**: Worker reads mission → does work → commits → calls `update_state("cycles_completed", N)` → calls `recycle()` to graceful-stop
3. **Sleep**: Watchdog sees `last_cycle_at` + `sleep_duration` → waits → respawns with fresh seed
4. **Messaging**: `send_message(to, content)` writes to `inbox.jsonl` + delivers via tmux. Messages survive crashes.
5. **Merge**: Worker sends merge request via `send_message` → merger cherry-picks to main → deploys

Workers never push or merge directly. One designated merger handles main. Enforced by `disallowed_tools`.

## Project Structure (per-project)

```
{project}/
├── .claude/workers/
│   ├── registry.json         # All worker config + state (_config + per-worker entries)
│   ├── chief-of-staff/
│   │   ├── mission.md        # Coordinator's prompt
│   │   └── inbox.jsonl       # Pending messages
│   └── my-worker/
│       ├── mission.md
│       └── inbox.jsonl
├── .claude/scripts/worker/   # Shared worker scripts (deploy-to-slot, pre-validate)
├── .mcp.json                 # Wires Worker Fleet MCP server
└── CLAUDE.md                 # Fleet docs section (auto-appended by init)
```

## Infrastructure (this repo)

```
~/.claude-ops/
├── mcp/worker-fleet/     # MCP server (14 tools, TypeScript + Zod)
├── scripts/              # Launch, watchdog, hooks, init, utilities (36 scripts)
├── hooks/                # Claude Code hooks: gates, interceptors, publishers
│   └── manifest.json     # Canonical registry (16 hooks)
├── lib/                  # Shared shell libs (fleet-jq, event-bus)
├── templates/            # Worker type templates (mission.md, permissions)
├── state/                # Runtime: watchdog logs, crash counts, scrollback hashes
└── tests/                # Test suite (41 hook tests + integration)
```

## Worker Types

| Type | Model | Perpetual | Sleep | Use case |
|------|-------|-----------|-------|----------|
| `implementer` | opus | false | — | Feature work, bug fixes (one-shot) |
| `optimizer` | opus | true | 2h | Continuous improvement loops |
| `monitor` | sonnet | true | 30m | Health checks, alerting |
| `coordinator` | opus | true | 15m | Fleet coordination (chief-of-staff) |

Set via `create_worker(type: "optimizer")` or override individually.

## Reporting Hierarchy

Workers default to reporting to `chief-of-staff` (set in `_config.mission_authority`). Override with `report_to` parameter or `direct_report: true` to report to the creating worker.

## Hooks

Managed via canonical manifest. Smart-merge preserves project-specific hooks.

```bash
bash ~/.claude-ops/scripts/setup-hooks.sh      # install from manifest
bash ~/.claude-ops/scripts/lint-hooks.sh        # verify
bash ~/.claude-ops/scripts/lint-hooks.sh --fix  # auto-repair
```

| Gate (Stop) | What it blocks |
|-------------|---------------|
| `stop-worker-dispatch` | Routes stop → recycle/sleep instead of exit |
| `stop-inbox-drain` | Blocks stop if unread messages or pending ACKs |

## License

Apache 2.0
