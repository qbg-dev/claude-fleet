# claude-ops — Agent Reference

> `curl -fsSL https://raw.githubusercontent.com/qbg-dev/claude-ops/main/AGENTS.md`

## Registry

`.claude/workers/registry.json`:

```jsonc
{
  "_config": {
    "merge_authority": "merger",
    "mission_authority": "chief-of-staff",
    "tmux_session": "w"
  },
  "my-worker": {
    "model": "opus",
    "perpetual": true,
    "sleep_duration": 3600,
    "report_to": "chief-of-staff",
    "disallowed_tools": ["Bash(git push*)"]
  }
}
```

## MCP Tools

| Tool | What |
|------|------|
| `heartbeat()` | Register alive, get inbox count |
| `read_inbox()` | Drain messages (durable, survives crashes) |
| `send_message(to, content)` | Send to worker, "report", "all" |
| `fleet_status()` | All workers: status, pane, last commit |
| `update_state(key, value)` | Persist state in registry |
| `create_task(subject)` | Track work |
| `update_task(id, status)` | pending → in_progress → completed |
| `recycle()` | End cycle, watchdog respawns after sleep |
| `create_worker(name, mission)` | Spin up new worker |
| `deregister(name)` | Remove from fleet |

## Cycle Protocol

```
1. heartbeat() + read_inbox()
2. git fetch origin && git rebase origin/main
3. Do work, commit
4. update_state("cycles_completed", N)
5. recycle()
```

## Worker Types

| Type | Perpetual | Sleep | Example |
|------|-----------|-------|---------|
| implementer | no | — | One-shot bugfix |
| optimizer | yes | 2h | Eval loops |
| monitor | yes | 30m | Health checks |
| coordinator | yes | 15m | chief-of-staff |
