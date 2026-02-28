# ~/.claude-ops — Development Guide

This is the agent operations infrastructure. Everything here is shared across all projects and harnesses. See `README.md` for the directory map.

## Key Concepts

**Harness**: A disposable task graph that an agent evolves through. Has a manifest, progress file, and optional waves.

**Manifest** (`harness/manifests/{name}/manifest.json`): Registry entry for a harness. Contains:
- `harness` — unique name (kebab-case)
- `project_root` — absolute path to the project
- `status` — `"active"` or `"done"`
- `files.progress` — relative path (from project_root) to the progress.json file
- `files.*` — other harness files (harness_md, best_practices, context_injections, goal, journal)
- `reports_dir` — optional, where wave reports are written

**Progress file** (`files.progress` in manifest): The canonical state of the harness. Standard schema:
```json
{
  "harness": "name",
  "mission": "What this harness accomplishes",
  "status": "active",
  "tasks": { "task-id": { "status": "pending|in_progress|completed", "description": "...", "steps": [], "completed_steps": [], "blockedBy": [], "owner": null, "metadata": {} } },
  "waves": [{ "id": 1, "name": "...", "tasks": ["task-id"], "status": "completed" }],
  "learnings": [{ "id": "...", "text": "..." }],
  "commits": [],
  "state": {}
}
```

Two file location conventions exist:
- **Newer**: `.claude/harness/{name}/progress.json` (co-located with harness files)
- **Older**: `claude_files/{name}-progress.json` (flat in claude_files)

Both work because the manifest records the exact relative path. The scaffold uses the newer convention.

## Development Workflows

### Creating a new harness
```bash
bash ~/.claude-ops/scripts/scaffold.sh my-feature /path/to/project
```
This creates the manifest, progress.json (from template), harness.md, start/seed/continue scripts, and registers it.

### Running tests
```bash
# All infrastructure tests (163 tests, 10 suites)
bash ~/.claude-ops/tests/run-all.sh

# Wave report server tests (72 tests)
cd ~/.claude-ops/wave-report-server && bun test
```

### Wave Report Server
Compiles progress.json files into rendered HTML reports. No agent tokens spent — agents just write progress.json (which they already do), and the server handles rendering.

```bash
# Scan + start (recommended)
bash ~/.claude-ops/wave-report-server/scan.sh --start

# Scan only (validates all harnesses, writes registry + issues)
bash ~/.claude-ops/wave-report-server/scan.sh

# Scan + notify agents about issues via Nexus
bash ~/.claude-ops/wave-report-server/scan.sh --notify

# Server only (if registry.json already exists)
bun run ~/.claude-ops/wave-report-server/server.ts
```

**Routes:**
| Route | Purpose |
|-------|---------|
| `GET /` | Index — lists all harnesses with status/progress |
| `GET /report/{harness}` | Compiled HTML report for that harness |
| `GET /screenshots/{harness}/{path}` | Serves screenshot images |
| `POST /api/scan` | Re-scan all manifests |
| `GET /api/registry` | Raw registry JSON |
| `GET /api/issues/{harness}` | Issues for a specific harness (agents poll this) |

**Agent integration:** The scanner writes `~/.claude-ops/wave-report-server/issues/{harness}.json` when it finds problems (missing progress file, broken JSON, orphaned screenshot references, wave→task mismatches). Agents can check this file or poll the API endpoint.

**Screenshots convention:** Place screenshots at `{project_root}/claude_files/screenshots/{harness}/` or set `task.metadata.screenshot` to a relative path. The server tries multiple resolution strategies.

### Control Plane
K8s-inspired daemon that monitors agent health, runs sweeps, and reconciles state.
```bash
nohup bash ~/.claude-ops/scripts/control-plane.sh &  # start
bash ~/.claude-ops/scripts/control-plane.sh --stop    # stop
cat ~/.claude-ops/state/health.json | jq .              # status
```

### Monitor Agent
Polls a target tmux pane, detects stuck agents, sends nudges.
```bash
bash ~/.claude-ops/scripts/monitor-agent.sh --pane <monitor-pane> <target-pane> [interval] [mission]
```

## Code Conventions

- **Shell scripts**: Source `lib/harness-jq.sh` for task graph queries. Use `locked_jq_write` for atomic JSON updates.
- **TypeScript** (wave-report-server): Pure Bun, no bundler, no React. String template compilation only.
- **Tests**: Shell tests in `tests/` use `helpers.sh` for fixtures. TS tests use `bun:test`.
- **Hooks**: Admission hooks run before tool calls, operator hooks run after. Both live in `hooks/`.
- **Sweeps**: Modular cron scripts in `sweeps.d/`, each with its own interval and RBAC manifest in `sweeps.d/permissions/`.

## File Ownership

| Location | Owned by | Persists across |
|----------|----------|-----------------|
| `~/.claude-ops/` | Infrastructure (this repo) | All projects, all sessions |
| `{project}/claude_files/` | Project state | Project lifetime |
| `{project}/.claude/harness/` | Harness files (newer convention) | Harness lifetime |
| `~/.claude-ops/state/sessions/` | Per-session runtime state | Session lifetime (GC'd after 24h) |
| `~/.claude-ops/state/harness-runtime/` | Per-harness runtime flags | Until harness deregistered |
| `~/.claude-ops/state/pane-registry.json` | Consolidated pane metadata | Pruned when panes die |
| `~/.claude-ops/harness/manifests/` | Harness registry | Until deregistered |
| `~/.claude-ops/wave-report-server/registry.json` | Scanner output | Until next scan |
| `~/.claude-ops/wave-report-server/issues/` | Per-harness issues | Until resolved + rescanned |
