# claude-ops

Autonomous agent fleet for Claude Code.

Each worker = git worktree + tmux pane + persistent memory. Workers commit on their own branches, coordinate via MCP tools, watchdog respawns them.

**Why worktrees?** Claude Code scopes auto-memory by filesystem path. Different worktree = isolated memory. By cycle 50, a worker knows things a fresh session never could.

## Dependencies

| Tool | Install | Required |
|------|---------|----------|
| git | `brew install git` | yes |
| jq | `brew install jq` | yes |
| tmux | `brew install tmux` | yes |
| bun | `curl -fsSL https://bun.sh/install \| bash` | yes (build MCP) |
| node v18+ | `brew install node` | yes (run MCP) |
| sshpass | `brew install sshpass` | no (deploy only) |

## Install

```bash
git clone git@github.com:qbg-dev/claude-ops.git ~/.claude-ops
cd ~/.claude-ops/mcp/worker-fleet && bun install && bun build index.ts --target=node --outfile=index.js
bash ~/.claude-ops/scripts/setup-hooks.sh
```

## Bootstrap a Project

```bash
bash ~/.claude-ops/scripts/init-project.sh /path/to/project --with-chief-of-staff
# Creates: registry.json, .mcp.json, shared scripts, CLAUDE.md fleet section
```

## Launch a Worker

```bash
bash ~/.claude-ops/scripts/launch-flat-worker.sh my-worker
# Or from any Claude session:
create_worker(name: "my-worker", mission: "...", launch: true)
```

## How It Works

1. **Launch** creates git worktree + tmux pane + seeds Claude with mission
2. **Worker** reads mission, does work, commits, messages merger
3. **Watchdog** (launchd, every 30s) detects stopped/stuck/crashed workers, respawns them
4. **MCP** gives workers 14 tools: messaging, tasks, state, fleet visibility
5. **Merger** cherry-picks worker branches to main, deploys

Workers never push. One merger handles main.

## Project Structure

```
{project}/
├── .claude/workers/registry.json   # all worker config + state
├── .claude/workers/{name}/mission.md
├── .claude/scripts/worker/         # shared scripts
├── .mcp.json                       # wires MCP server
└── CLAUDE.md                       # fleet docs

~/.claude-ops/
├── mcp/worker-fleet/   # MCP server (14 tools, TypeScript)
├── scripts/            # launch, watchdog, hooks, init
├── hooks/              # Claude Code hooks (manifest.json)
└── state/              # runtime: logs, crash counts
```

## Docs

- `CLAUDE.md` — development guide (architecture, watchdog, hooks, conventions)
- `AGENTS.md` — single-page agent reference (curl-friendly)
- `TMUX-OPS.md` — tmux patterns for spawning/recovering agents

## License

Apache 2.0
