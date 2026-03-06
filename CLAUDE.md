# claude-ops

Agent fleet for Claude Code. Workers run in tmux panes on git worktrees, talk via MCP, watchdog keeps them alive.

## Dependencies

```bash
brew install jq tmux git       # required
brew install sshpass            # optional (deploy scripts)
curl -fsSL https://bun.sh/install | bash  # bun (builds MCP server)
# node v18+ also required (MCP server runs on node)
```

MCP server deps (installed automatically):
- `@modelcontextprotocol/sdk` — MCP protocol
- `zod` — schema validation

## Install

```bash
git clone git@github.com:qbg-dev/claude-ops.git ~/.claude-ops
cd ~/.claude-ops/mcp/worker-fleet && bun install && bun build index.ts --target=node --outfile=index.js
bash ~/.claude-ops/scripts/setup-hooks.sh
```

## Bootstrap a Project

```bash
bash ~/.claude-ops/scripts/init-project.sh /path/to/project --with-chief-of-staff
```

Creates: `.claude/workers/registry.json`, `.mcp.json`, shared scripts, CLAUDE.md fleet section.

## Architecture

```
watchdog (launchd, every 30s)
  └── reads registry.json → for each worker:
        alive + running?     → skip
        alive + stuck 10m?   → kill + resume
        alive + sleep done?  → kill + respawn
        dead + perpetual?    → new pane + relaunch
        3+ crashes/hr?       → stop, alert

hooks (settings.json)
  stop-worker-dispatch     → route stop to recycle
  stop-inbox-drain         → block stop if unread messages
  pre-tool-context-injector→ inject fleet context
  post-tool-publisher      → emit events

MCP server (per-project via .mcp.json)
  messaging:  send_message, read_inbox
  state:      heartbeat, update_state, fleet_status
  tasks:      create_task, update_task, list_tasks
  lifecycle:  create_worker, deregister, standby, recycle
```

## Key Files

| File | Purpose |
|------|---------|
| `mcp/worker-fleet/index.ts` | MCP server (14 tools) |
| `scripts/harness-watchdog.sh` | Respawn daemon |
| `scripts/launch-flat-worker.sh` | Create worktree + pane + seed Claude |
| `scripts/init-project.sh` | Bootstrap any repo |
| `scripts/setup-hooks.sh` | Install hooks from manifest |
| `scripts/lint-hooks.sh` | Verify hooks (`--fix` to repair) |
| `hooks/manifest.json` | All 16 hooks |

## Watchdog

Runs via launchd (`com.claude-ops.harness-watchdog`), checks every 30s.

**Stuck detection**: (1) `(running)` in statusline → active, skip. (2) Scrollback MD5 unchanged between checks → idle. (3) Known blocking patterns → stuck timer.

**Respawn**: Kill Claude → stamp `last_cycle_at` → rebuild command from registry → send to pane → wait for TUI → inject seed.

```bash
launchctl kickstart -k gui/$(id -u)/com.claude-ops.harness-watchdog  # restart
bash ~/.claude-ops/scripts/harness-watchdog.sh --status              # state table
```

## Development

```bash
# Edit + rebuild MCP
cd ~/.claude-ops/mcp/worker-fleet
vim index.ts
bun build index.ts --target=node --outfile=index.js

# Tests
bash ~/.claude-ops/tests/run-all.sh

# Hooks
bash ~/.claude-ops/scripts/setup-hooks.sh      # install
bash ~/.claude-ops/scripts/lint-hooks.sh --fix  # verify + repair
```

## Conventions

- Shell: `set -euo pipefail`, JSON via `jq`, registry locks via `mkdir`
- tmux: never literal `Enter` (use `send-keys -H 0d`), never `display-message -p '#{pane_id}'`
- Workers default `report_to: chief-of-staff` unless explicitly set
