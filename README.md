# claude-ops — Worker Fleet Infrastructure for Claude Code

Infrastructure layer for running autonomous Claude Code agent fleets. Turns Claude sessions into persistent, recoverable workers with their own missions, permissions, and memory. Uses Claude Code's native hooks, settings, MCP, and session model.

## Core Idea

Each worker is a Claude Code session running in a tmux pane, on its own git worktree, with its own branch. Workers are configured by a `registry.json` + `mission.md` in the project repo. This repo provides the upstream infrastructure: launch scripts, watchdog, MCP server, hooks.

```
~/.claude-ops/                    (this repo — project-agnostic infrastructure)
  scripts/launch-flat-worker.sh   Launch a worker (worktree + tmux + Claude)
  scripts/harness-watchdog.sh     Daemon: detect stuck/crashed, respawn
  mcp/worker-fleet/index.ts       MCP server (14 tools for messaging, state, fleet)
  mcp/relay-server/index.ts       Cross-machine relay for remote workers

{project}/                        (project-specific config)
  .claude/workers/registry.json   Single source of truth for all workers
  .claude/workers/{name}/
    mission.md                    What this worker does
    inbox.jsonl                   Incoming messages (durable)
  .mcp.json                      Wires worker-fleet MCP into Claude sessions
```

## How to Launch a Worker

### 1. Create worker directory and mission

```bash
mkdir -p .claude/workers/my-worker
cat > .claude/workers/my-worker/mission.md << 'EOF'
# my-worker — What It Does

## Mission
Describe what this agent does each cycle.

## Cycle Protocol
1. Step one
2. Step two
3. Commit, request merge, sleep
EOF
```

### 2. Add to registry

```jsonc
// .claude/workers/registry.json
{
  "_config": {
    "commit_notify": ["merger"],
    "merge_authority": "merger",
    "tmux_session": "w",
    "project_name": "my-project"
  },
  "my-worker": {
    "model": "sonnet",                    // or "opus"
    "permission_mode": "bypassPermissions",
    "disallowed_tools": [                 // safety sandbox
      "Bash(git push*)",
      "Bash(rm -rf*)",
      "Bash(*deploy-prod*)"
    ],
    "status": "idle",
    "perpetual": true,                    // sleep/wake forever
    "sleep_duration": 3600,               // seconds between cycles
    "branch": "worker/my-worker",
    "window": "workers",                  // tmux window group
    "parent": "chief-of-staff"
  }
}
```

### 3. Set up .mcp.json

```jsonc
// .mcp.json (project root — gives workers fleet communication tools)
{
  "mcpServers": {
    "worker-fleet": {
      "command": "/path/to/bun",
      "args": ["run", "/path/to/.claude-ops/mcp/worker-fleet/index.ts"],
      "env": { "PROJECT_ROOT": "/path/to/project" }
    }
  }
}
```

### 4. Launch

```bash
bash ~/.claude-ops/scripts/launch-flat-worker.sh my-worker
```

This:
1. Creates git worktree `../my-project-w-my-worker/` on branch `worker/my-worker`
2. Copies `.mcp.json` into worktree
3. Installs git hooks (post-commit notifies merger, commit-msg adds Worker: trailers)
4. Creates/joins tmux window group, splits pane
5. Starts Claude Code with permission sandboxing
6. Generates and injects seed prompt
7. Registers pane in `registry.json`

## Architecture

### tmux as the Substrate

All workers live in one tmux session, organized by window groups:

```
Session: w
  Window: main        → chief-of-staff, merger, patrol
  Window: optimizers  → bi-optimizer, kefu-optimizer, sql-library-builder
  Window: monitors    → infra-monitor, auth-monitor
```

Workers in the same window share a tiled layout. Watchdog monitors all panes from a single daemon.

### Worker Fleet MCP Server

14 tools in 5 categories, loaded via `.mcp.json`:

| Category | Tools |
|----------|-------|
| **Messaging** | `send_message` (to worker, "parent", "children", "all"), `read_inbox` |
| **Tasks** | `create_task`, `update_task`, `list_tasks` |
| **State** | `get_worker_state`, `update_state` |
| **Fleet** | `fleet_status` |
| **Lifecycle** | `recycle`, `spawn_child`, `heartbeat`, `check_config`, `create_worker` |

Identity auto-detected from `WORKER_NAME` env or git branch name.

Messaging is durable: writes to `inbox.jsonl` first (survives restarts), then delivers via tmux (instant).

### Memory Through Worktrees

Each worker's git worktree has a different filesystem path, so Claude Code's auto-memory (`~/.claude/projects/{path-slug}/memory/`) gives each one isolated persistent memory automatically:

```
Worker: bi-optimizer
  Worktree: project-w-bi-optimizer/
  Memory:   ~/.claude/projects/-...-project-w-bi-optimizer/memory/MEMORY.md

Worker: patrol
  Worktree: project-w-patrol/
  Memory:   ~/.claude/projects/-...-project-w-patrol/memory/MEMORY.md
```

Workers accumulate domain knowledge across cycles. By cycle 50, they have deep operational knowledge a fresh session wouldn't have.

### Watchdog

`harness-watchdog.sh` runs as a launchd daemon, checking every 30 seconds:

| State | Detection | Action |
|-------|-----------|--------|
| Active | `(running)` in statusline | Skip |
| Idle >10min | Scrollback hash unchanged | Resume session |
| Stuck | Tool-call timestamp stale | Kill + respawn |
| Dead pane | Pane missing from tmux | Re-split + relaunch |
| Crash-loop | >3 crashes/hour | Stop, notify human |

Three-layer stuck detection:
1. `(running)` guard — skip if executing bash
2. Scrollback hash diff — `md5(last 30 lines)` vs previous check
3. Known blocking patterns — `"Waiting for task"`, `"hook error"`

### Permission Sandboxing

Workers get `--disallowed-tools` from registry. Examples:

- **Read-only observer**: `disallowed_tools: ["Edit", "Write", "Bash(git commit*)"]`
- **No deploy**: `disallowed_tools: ["Bash(*deploy-prod*)", "Bash(*deploy.sh*)"]`
- **Standard worker**: `disallowed_tools: ["Bash(git push*)", "Bash(rm -rf*)", "Bash(git reset --hard*)"]`

### Cross-Machine Relay

`mcp/relay-server/index.ts` bridges messaging between machines (e.g., laptop + Mac Mini over Tailscale). Workers call `send_message()` normally; the MCP server routes through the relay if the recipient is remote.

## Worker Types

| Type | Lifecycle | Access | Example |
|------|-----------|--------|---------|
| **Implementer** | Cycles with sleep | Read-write, commit | bi-optimizer, kefu-optimizer |
| **Observer** | Perpetual, short cycles | Read-only | patrol (visual QA), auth-monitor |
| **Coordinator** | Perpetual, short cycles | Read + message routing | chief-of-staff |
| **Merger** | Perpetual, event-driven | Full (merge + deploy) | merger |
| **One-shot** | Runs once | Read-write | miniapp-audit, finance-fix |

## Governance Model

1. **Workers commit** on their own branches but **never push or merge**
2. **Merger** is the only agent that merges to main and deploys
3. Workers request merges via `send_message("merger", ...)`
4. **Chief-of-staff** reviews fleet health every 15 min, edits worker missions
5. **Eval-driven**: workers have acceptance criteria (eval scripts) and optimize autonomously
6. **Git history is the audit trail**: every commit has `Worker:` and `Cycle:` trailers

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `launch-flat-worker.sh` | Launch a worker (worktree + tmux + Claude) |
| `harness-watchdog.sh` | Daemon: detect stuck/crashed, respawn |
| `worker-status.sh` | Show table of all workers from registry |
| `register-pane.sh` | Self-register tmux pane into registry |
| `request-merge.sh` | Request merge from merger worker |
| `json-union-merge.sh` | Merge registry.json across branches |
| `worker-post-commit-hook.sh` | Git hook: notify merger, update registry |
| `worker-commit-msg-hook.sh` | Git hook: add Worker:/Cycle: trailers |
| `worker-post-merge-hook.sh` | Git hook: notify workers of merge |
| `check-flat-workers.sh` | Fleet health check |
| `fleet-health.sh` | Quick fleet health summary |
| `launch-main-window.sh` | Set up the initial tmux session |

## Setup

```bash
# Clone
git clone git@github.com:qbg-dev/claude-ops.git ~/.claude-ops

# Install MCP dependencies
cd ~/.claude-ops/mcp/worker-fleet && bun install

# Set up watchdog (macOS)
# See scripts/harness-watchdog.sh header for launchd plist
```

## License

Apache 2.0
