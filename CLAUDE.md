# claude-ops

Autonomous agent fleet for Claude Code. Workers run in tmux panes on git worktrees, coordinated by MCP tools and a watchdog daemon.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  launchd (com.claude-ops.harness-watchdog)                  │
│    └── harness-watchdog.sh (loops every 30s)                │
│          ├── Detect stuck workers (scrollback hash diff)    │
│          ├── Respawn crashed panes (split into window)      │
│          ├── Wake perpetual workers after sleep_duration     │
│          └── Crash-loop guard (max 3/hr → stop + notify)   │
├─────────────────────────────────────────────────────────────┤
│  tmux session "w"                                           │
│    ├── window "workers"    [worker-a] [worker-b] [tiled]   │
│    ├── window "monitors"   [monitor-x] [tiled]             │
│    └── window "main"       [Warren] [chief-of-staff]       │
├─────────────────────────────────────────────────────────────┤
│  Worker Fleet MCP (per-project, loaded via .mcp.json)       │
│    ├── Messaging: send_message, read_inbox                  │
│    ├── State: heartbeat, update_state, fleet_status         │
│    ├── Tasks: create_task, update_task, list_tasks           │
│    └── Lifecycle: create_worker, deregister, standby        │
├─────────────────────────────────────────────────────────────┤
│  Claude Code Hooks (manifest.json → settings.json)          │
│    ├── Gates (Stop): stop-worker-dispatch, stop-inbox-drain │
│    ├── Interceptors (PreToolUse): context-injector          │
│    └── Publishers (PostToolUse): event-bus, session-register│
└─────────────────────────────────────────────────────────────┘
```

**Data flow**: Worker calls `heartbeat()` → MCP reads `registry.json` + `inbox.jsonl` → returns pending messages. Worker calls `update_state("cycles_completed", N)` → MCP writes `last_cycle_at` to registry → watchdog reads this to know when sleep started.

## Key Files

| File | What it does |
|------|-------------|
| `mcp/worker-fleet/index.ts` | MCP server (14 tools, ~2800 lines). Build: `bun build index.ts --target=node --outfile=index.js` |
| `scripts/harness-watchdog.sh` | Daemon: monitors all workers, respawns crashed/stuck/sleeping ones |
| `scripts/launch-flat-worker.sh` | Creates worktree + tmux pane + seeds Claude with mission |
| `scripts/init-project.sh` | Bootstrap any repo: git init, .claude/, .mcp.json, registry, CLAUDE.md |
| `scripts/setup-hooks.sh` | Install hooks from manifest into `~/.claude/settings.json` |
| `scripts/lint-hooks.sh` | Verify hooks are correctly installed (`--quiet` for CI, `--fix` to repair) |
| `hooks/manifest.json` | Canonical registry of all hooks (16 entries) |
| `lib/fleet-jq.sh` | Shared shell functions for hooks (hook_block, hook_pass, hook_parse_input) |
| `lib/event-bus.sh` | Event bus for inter-hook communication |
| `templates/flat-worker/mission.md` | Worker mission template with placeholders |

## Watchdog Daemon

**What it does**: Runs every 30s via launchd. For each worker in `registry.json`:

1. **Pane alive + `(running)`** → skip (actively executing)
2. **Pane alive + idle > `sleep_duration`** → sleep complete → kill + respawn with fresh seed
3. **Pane alive + idle > 10min + scrollback unchanged** → stuck → kill + resume session
4. **Pane alive + no Claude TUI** → bare shell (failed respawn) → clean restart
5. **Pane dead + perpetual** → create new pane in same window (split + tile) → relaunch
6. **Pane dead + non-perpetual** → notify chief-of-staff, don't respawn
7. **3+ crashes/hr** → crash-loop → stop retrying, send alert

**Stuck detection** (three layers):
- Layer 1: `(running)` in statusline → definitely active, skip
- Layer 2: Scrollback MD5 hash diff between checks → content changed = active
- Layer 3: Known blocking patterns (`Waiting for task`, `hook error`) → stuck timer

**Respawn**: Kills Claude process tree → stamps `last_cycle_at` (prevents kill-loop) → rebuilds Claude command from registry (model, permissions, disallowed_tools) → sends to pane → waits for TUI ready → injects seed via tmux buffer.

**Config** (env vars or launchd plist):
| Var | Default | What |
|-----|---------|------|
| `WATCHDOG_CHECK_INTERVAL` | 30 | Seconds between checks |
| `WATCHDOG_STUCK_THRESHOLD` | 600 | Seconds idle before "stuck" |
| `WATCHDOG_MAX_CRASHES` | 3 | Max crashes per hour before giving up |

**Manage**:
```bash
launchctl list | grep claude-ops          # check status
launchctl kickstart -k gui/$(id -u)/com.claude-ops.harness-watchdog  # restart
bash ~/.claude-ops/scripts/harness-watchdog.sh --status              # print state table
bash ~/.claude-ops/scripts/harness-watchdog.sh --once                # single pass (testing)
```

## Hooks

All hooks managed through `hooks/manifest.json`. Smart-merge preserves project-specific hooks.

| Hook | Event | What |
|------|-------|------|
| `stop-worker-dispatch` | Stop | Routes worker stop → recycle/sleep instead of exit |
| `stop-inbox-drain` | Stop | Blocks stop if unread inbox messages or pending ACKs |
| `tool-policy-gate` | PreToolUse | Enforces disallowed_tools from registry |
| `pre-tool-context-injector` | PreToolUse | Injects fleet context before tool calls |
| `post-tool-publisher` | PostToolUse | Emits events to bus after tool execution |
| `prompt-publisher` | UserPromptSubmit | Publishes user prompts to coordinator inbox |
| `worker-session-register` | PostToolUse | Registers session ID in registry |

```bash
bash ~/.claude-ops/scripts/setup-hooks.sh            # install all
bash ~/.claude-ops/scripts/setup-hooks.sh --core-only # required hooks only
bash ~/.claude-ops/scripts/setup-hooks.sh --dry-run   # preview
bash ~/.claude-ops/scripts/lint-hooks.sh              # verify
bash ~/.claude-ops/scripts/lint-hooks.sh --fix        # auto-repair
```

## Worker Lifecycle

```
create_worker(name, mission)     # MCP tool: creates registry entry + worktree + mission.md
launch-flat-worker.sh <name>     # Shell: creates tmux pane, seeds Claude with mission
heartbeat()                      # MCP tool: worker calls each cycle, gets inbox count
update_state("cycles_completed") # MCP tool: stamps last_cycle_at for watchdog
recycle()                        # MCP tool: graceful stop, watchdog respawns after sleep_duration
deregister(name)                 # MCP tool: remove from registry (or standby to pause)
```

**Default reporting**: Workers report to `chief-of-staff` (from `_config.mission_authority`) unless `report_to` is explicitly set. Use `direct_report=true` to report to the calling worker.

## Project Setup

```bash
# Bootstrap a new project
bash ~/.claude-ops/scripts/init-project.sh /path/to/project --with-chief-of-staff

# What it creates:
#   .claude/workers/registry.json    — worker config + _config
#   .claude/scripts/worker/*.sh      — shared worker scripts
#   .mcp.json                        — wires MCP server
#   CLAUDE.md                        — appends fleet docs section
#   .claude/workers/chief-of-staff/  — coordinator (if --with-chief-of-staff)
```

## Development

```bash
# Edit MCP server
vim ~/.claude-ops/mcp/worker-fleet/index.ts
cd ~/.claude-ops/mcp/worker-fleet && bun build index.ts --target=node --outfile=index.js

# Run tests
bash ~/.claude-ops/tests/run-all.sh
bash ~/.claude-ops/tests/test-hook-manifest.sh  # 41 hook tests

# Add a hook
# 1. Create script in hooks/{gates,interceptors,publishers}/
# 2. Add entry to hooks/manifest.json
# 3. bash scripts/setup-hooks.sh && bash tests/test-hook-manifest.sh
```

## Conventions

- Shell: `set -euo pipefail`. JSON via `jq`. Registry locks via `mkdir`.
- MCP: TypeScript + Zod schemas. Identity from `WORKER_NAME` env or git branch.
- tmux: Never `Enter` literal — always `send-keys -H 0d`. Never `display-message -p '#{pane_id}'` (returns focused pane).
- Hooks: gates block/allow (Stop), interceptors inject context (PreToolUse), publishers emit events (PostToolUse).

## File Ownership

| Location | Owner | Purpose |
|----------|-------|---------|
| `~/.claude-ops/` | This repo | Shared infra (all projects) |
| `{project}/.claude/workers/` | Project | Worker config, missions, inboxes |
| `{project}/.mcp.json` | Project | Wires MCP into Claude sessions |
| `~/.claude-ops/state/` | Runtime | Watchdog logs, crash counts, scrollback hashes |
