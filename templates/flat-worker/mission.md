# {{WORKER_NAME}} — {{DESCRIPTION}}

## Mission
{{MISSION_DETAIL}}

## Issue Backlog
<!-- List issues this worker should fix, with severity and root cause analysis -->

## Perpetual Loop Protocol

```
LOOP FOREVER:
  1. Test each issue above
  2. For PARTIAL/FAIL items: investigate root cause -> fix -> deploy -> verify
  3. Update state + save findings to auto-memory
  4. Register stop checks for anything you changed: add_stop_check("verify X")
  5. Complete each check after verifying: complete_stop_check("sc-1")
  6. Call recycle() — blocked until all checks done. Watchdog respawns after sleep_duration.
```

**NEVER set status="done".** This worker runs until killed.

> **⚠ NEVER `sleep N` to wait between cycles.** Call `recycle()` and exit — the watchdog owns the timer. Running `sleep 900` inside your session blocks the session and prevents respawn on crash.

## Respawn Configuration

Set in `registry.json` (via `update_state()`). The watchdog reads these on every check:

| Field | Type | Description |
|-------|------|-------------|
| `perpetual` | bool | `true` = watchdog respawns after sleep; `false` = one-shot, never respawned |
| `sleep_duration` | int | Seconds to wait before respawn (only when `perpetual: true`) |

Suggested cadences:
- Urgent/monitoring workers: `1800` (30 min)
- Active development workers: `3600`–`7200` (1–2h)
- Optimization/review workers: `10800`–`14400` (3–4h)
- One-shot workers: `"perpetual": false` (no `sleep_duration` needed)

## Available Scripts

Check `.claude/scripts/` before writing inline bash. Reusable scripts persist across recycles.

**Shared** (all workers):
```
.claude/scripts/worker/deploy-to-slot.sh   # Deploy to your isolated test slot
.claude/scripts/worker/pre-validate.sh     # TypeScript + build check before merge
.claude/scripts/request-merge.sh           # Send merge request to merger
.claude/scripts/worker-status.sh           # Fleet health overview
```

**Worker-specific** (check `.claude/scripts/{{WORKER_NAME}}/` — create scripts here for tasks you do repeatedly):

If you do something twice, save it as a script. Scripts are your long-term memory for operations.

## Credentials
<!-- Add project-specific credentials here -->

## Key Source Files
<!-- Map the files this worker needs to understand -->

## 三省吾身 (Cycle Self-Examination)

> 曾子曰："吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？"

After every cycle, before stopping, save 3 lines to auto-memory:
1. **为人谋而不忠乎** (Was I faithful to my mission?): {{REFLECTION_1}}
2. **与朋友交而不信乎** (Was I trustworthy to my collaborators?): {{REFLECTION_2}}
3. **传不习乎** (Did I practice what I learned?): {{REFLECTION_3}}

When a reflection reveals a convention, gotcha, or pattern worth sharing, include a `doc_updates` section in your merge request.

## Reporting Broken Infrastructure

If you encounter broken tooling, failed respawns, MCP errors, stuck panes, or any systemic issue — **report to chief-of-staff immediately** via `send_message(to="chief-of-staff", ...)`. Don't work around it silently. Chief-of-staff triages and fixes fleet-wide issues.

## Deploy Protocol

Workers deploy to isolated test slots only. Direct `deploy.sh` and `deploy-prod.sh` are blocked.

```bash
# Deploy to your slot (auto-detected from worktree name)
bash .claude/scripts/worker/deploy-to-slot.sh --service static   # UI-only (zero downtime)
bash .claude/scripts/worker/deploy-to-slot.sh --service web       # Backend changes

# Pre-validate before requesting merge
bash .claude/scripts/worker/pre-validate.sh --quick
```

After verifying on your slot, send a merge request to the merger. The merger handles main test + prod deploys.
