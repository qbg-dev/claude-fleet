# claude-ops — Agent Quick Reference

> Curl this from any Claude session to understand the system:
> ```bash
> curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-ops/main/AGENTS.md
> ```

## Core Idea

Each worker = Claude Code session + tmux pane + git worktree. Different worktree path = isolated auto-memory. Workers commit on their own branch, talk via MCP tools, watchdog respawns them.

## Launch a Worker

```bash
# From shell
bash ~/.claude-ops/scripts/launch-flat-worker.sh my-worker

# From a running Claude session (MCP)
create_worker(name: "my-worker", mission: "...", launch: true)
```

## Registry Schema

`.claude/workers/registry.json`:

```jsonc
{
  "_config": {
    "merge_authority": "merger",
    "mission_authority": "chief-of-staff",
    "tmux_session": "w",
    "project_name": "my-project"
  },
  "my-worker": {
    "model": "opus",                          // or "sonnet", "haiku"
    "permission_mode": "bypassPermissions",
    "disallowed_tools": ["Bash(git push*)"],  // permission sandbox
    "perpetual": true,                        // respawn after sleep
    "sleep_duration": 3600,                   // seconds between cycles
    "report_to": "chief-of-staff",            // default if omitted
    "window": "workers",                      // tmux window group
    // Auto-populated:
    "status": "running",
    "pane_id": "%42",
    "cycles_completed": 5,
    "last_cycle_at": "2026-03-06T12:00:00Z"
  }
}
```

## MCP Tools (14)

Identity auto-detected from git branch. Source: `mcp/worker-fleet/index.ts`.

| Tool | What |
|------|------|
| `send_message(to, content)` | Send to worker name, "report", "direct_reports", or "all" |
| `read_inbox()` | Drain durable inbox (JSONL), returns structured messages |
| `fleet_status()` | All workers: status, branch, pane, last commit |
| `get_worker_state(worker)` | Another worker's full state |
| `update_state(key, value)` | Update own state in registry |
| `heartbeat()` | Confirm alive, get inbox count |
| `create_task(subject)` | Add to own task list |
| `update_task(id, status)` | Move through pending → in_progress → completed |
| `list_tasks()` | Show task list |
| `recycle()` | End cycle, watchdog respawns after sleep_duration |
| `create_worker(name, mission)` | Create + optionally launch a new worker |
| `deregister(name)` | Remove from registry |
| `standby()` | Pause (registered but not running) |
| `check_config()` | Lint registry for misconfigurations |

## Worker Cycle Protocol

```
1. heartbeat() + read_inbox()     # register alive, drain messages
2. git fetch origin && git rebase origin/main
3. Do work, commit frequently
4. update_state("cycles_completed", N)
5. Send merge request via send_message(to: "merger", ...)
6. recycle()                      # graceful stop → watchdog respawns after sleep
```

## Worker Types

| Type | Perpetual | Sleep | Use case |
|------|-----------|-------|----------|
| `implementer` | false | — | One-shot feature/bugfix work |
| `optimizer` | true | 2h | Eval-driven improvement loops |
| `monitor` | true | 30m | Health checks, alerting |
| `coordinator` | true | 15m | Fleet coordination (chief-of-staff) |

## Reporting

Workers default to reporting to `chief-of-staff`. Override with `report_to` param or `direct_report: true`.

## Git Discipline

- One branch per worker (`worker/{name}`), never shared
- Workers commit freely, never push — merger is the single gatekeeper
- Post-commit hook auto-notifies merger
- Merge requests via `send_message` with branch, SHAs, what changed
