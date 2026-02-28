# ~/.boring — Development Guide

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
bash ~/.boring/scripts/scaffold.sh my-feature /path/to/project
```
This creates the manifest, progress.json (from template), harness.md, start/seed/continue scripts, and registers it.

### Running tests
```bash
bash ~/.boring/tests/run-all.sh
```

### Control Plane
K8s-inspired daemon that monitors agent health, runs sweeps, and reconciles state.
```bash
nohup bash ~/.boring/scripts/control-plane.sh &  # start
bash ~/.boring/scripts/control-plane.sh --stop    # stop
cat ~/.boring/state/health.json | jq .              # status
```

### Monitor Agent
Polls a target tmux pane, detects stuck agents, sends nudges.
```bash
bash ~/.boring/scripts/monitor-agent.sh --pane <monitor-pane> <target-pane> [interval] [mission]
```

## Code Conventions

- **Shell scripts**: Source `lib/harness-jq.sh` for task graph queries. Use `locked_jq_write` for atomic JSON updates.
- **Tests**: Shell tests in `tests/` use `helpers.sh` for fixtures.
- **Hooks**: Admission hooks run before tool calls, operator hooks run after. Both live in `hooks/`.
- **Sweeps**: Modular cron scripts in `sweeps.d/`, each with its own interval and RBAC manifest in `sweeps.d/permissions/`.

## File Ownership

| Location | Owned by | Persists across |
|----------|----------|-----------------|
| `~/.boring/` | Infrastructure (this repo) | All projects, all sessions |
| `{project}/claude_files/` | Project state | Project lifetime |
| `{project}/.claude/harness/` | Harness files (newer convention) | Harness lifetime |
| `~/.boring/state/sessions/` | Per-session runtime state | Session lifetime (GC'd after 24h) |
| `~/.boring/state/harness-runtime/` | Per-harness runtime flags | Until harness deregistered |
| `~/.boring/state/pane-registry.json` | Consolidated pane metadata | Pruned when panes die |
| `~/.boring/harness/manifests/` | Harness registry | Until deregistered |
