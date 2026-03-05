# claude-ops — Development Guide

Agent fleet infrastructure for Claude Code. See `README.md` for full architecture.

## Key Concepts

**Worker**: A Claude Code session running in a tmux pane, on its own git worktree, with a mission file defining what it does. Configured in `{project}/.claude/workers/registry.json`.

**Registry** (`{project}/.claude/workers/registry.json`): Single source of truth for all workers in a project. Contains `_config` (project-level settings) + one entry per worker (model, permissions, status, branch, tmux pane, cycle count, custom metrics).

**Mission** (`{project}/.claude/workers/{name}/mission.md`): The worker's prompt. Defines cycle protocol, sleep schedule, reporting rules, and self-examination (三省吾身).

**Worker Fleet MCP** (`mcp/worker-fleet/index.ts`): TypeScript MCP server providing 14 tools for inter-worker messaging, state management, task tracking, and fleet status. Loaded via `.mcp.json` in each project.

**Watchdog** (`scripts/harness-watchdog.sh`): launchd daemon that detects stuck/crashed workers and respawns them. Three-layer stuck detection: (running) guard → scrollback hash diff → known blocking patterns.

## Directory Structure

```
~/.claude-ops/
├── mcp/
│   ├── worker-fleet/        # MCP server (14 tools, ~2400 lines TS)
│   │   ├── index.ts         # Source
│   │   └── index.js         # Built (bun build --target=node)
│   └── relay-server/        # Cross-machine relay
├── scripts/                 # Launch, watchdog, hooks, utilities
├── hooks/                   # Claude Code hooks (PreToolUse, PostToolUse, Stop)
├── lib/                     # Shared shell libraries
├── bus/                     # Event bus state + side-effects
├── state/                   # Runtime state (watchdog logs, crash counts)
└── tests/                   # Test suite
```

## Development Workflows

### Adding a script
Put in `scripts/`. Make it project-agnostic (use `PROJECT_ROOT` env var or `git rev-parse --show-toplevel`). The launch script copies project-local hooks first, falls back to upstream.

### Modifying the MCP server
Edit `mcp/worker-fleet/index.ts`, then rebuild:
```bash
cd ~/.claude-ops/mcp/worker-fleet
bun build index.ts --target=node --outfile=index.js
```

### Running tests
```bash
bash ~/.claude-ops/tests/run-all.sh
```

## Code Conventions

- Shell scripts: `set -euo pipefail`. Use `jq` for JSON. Lock registry with `mkdir`-based locks.
- MCP server: TypeScript with Zod schemas. Identity from `WORKER_NAME` env or git branch.
- Hooks: admission hooks (PreToolUse) inject context, publisher hooks (PostToolUse) emit events, gates (Stop) control lifecycle.
- tmux: Never use literal `Enter` — always `tmux send-keys -H 0d`. Never `tmux display-message -p '#{pane_id}'` (returns focused pane, not current).

## File Ownership

| Location | Owned by | Purpose |
|----------|----------|---------|
| `~/.claude-ops/` | This repo (upstream infra) | Shared across all projects |
| `{project}/.claude/workers/` | Project | Worker config, missions, inboxes |
| `{project}/.mcp.json` | Project | Wires MCP server into Claude sessions |
| `~/.claude-ops/state/` | Runtime | Watchdog logs, crash counts, scrollback hashes |
| `~/.claude/projects/{slug}/memory/` | Claude Code auto-memory | Per-worktree persistent memory |
