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

## Hooks Infrastructure

All Claude Code hooks are managed through a canonical manifest. Three scripts handle the lifecycle:

| Script | Purpose |
|--------|---------|
| `hooks/manifest.json` | Canonical registry of all hooks (id, event, path, required, category) |
| `scripts/setup-hooks.sh` | Install hooks from manifest into `~/.claude/settings.json` |
| `scripts/lint-hooks.sh` | Verify all hooks are correctly installed |

### Hook Categories

| Category | Where | Example |
|----------|-------|---------|
| **core** (required) | `~/.claude-ops/hooks/` | `stop-worker-dispatch`, `tool-policy-gate`, `stop-inbox-drain` |
| **user** (optional) | `~/.claude/hooks/` | `stop-echo`, `post-tool-write-flag` |
| **plugin** (optional) | `~/.claude-ops/plugins/` | `snippet-injector` |
| **project** (per-project) | `{project}/.claude/hooks/` | `pii-firewall` |

### Setup & Lint

```bash
# Preview what would be installed
bash ~/.claude-ops/scripts/setup-hooks.sh --dry-run

# Install all hooks into settings.json (backs up first)
bash ~/.claude-ops/scripts/setup-hooks.sh

# Install only required hooks
bash ~/.claude-ops/scripts/setup-hooks.sh --core-only

# Verify installation
bash ~/.claude-ops/scripts/lint-hooks.sh

# CI mode (exit code only)
bash ~/.claude-ops/scripts/lint-hooks.sh --quiet

# Auto-fix missing hooks
bash ~/.claude-ops/scripts/lint-hooks.sh --fix
```

Setup smart-merges: it adds/updates manifest hooks without removing project-specific hooks already in settings.json. Lint runs automatically after setup.

### Adding a New Hook

1. Create the hook script in the appropriate directory
2. Add an entry to `hooks/manifest.json` with id, event, path, required, category
3. Run `bash scripts/setup-hooks.sh` to install
4. Add tests in `tests/test-hook-manifest.sh`
5. Run `bash tests/test-hook-manifest.sh` to verify

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
# All tests
bash ~/.claude-ops/tests/run-all.sh

# Hook-specific tests (41 tests)
bash ~/.claude-ops/tests/test-hook-manifest.sh
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
