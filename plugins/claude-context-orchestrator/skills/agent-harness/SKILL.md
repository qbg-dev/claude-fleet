---
name: "agent-harness"
description: "Build and launch autonomous agent harnesses with worker, monitor, and event bus. Trigger: HARNESSUP."
---

# Agent Harness

A harness is a task graph + hooks + event bus that let a Claude agent work autonomously for hours.
The agent decides WHAT. The harness tracks WHERE. Hooks enforce HOW. The bus connects WHO.

**Trigger: HARNESSUP** — reflect, evolve, continue.

---

## Canonical Source of Truth

All harness infrastructure lives at **`~/.claude-ops/`**. Read these files directly
for up-to-date details — they are the source of truth, not this skill document.

| What you need | Where to read |
|---------------|---------------|
| **Templates** | `~/.claude-ops/templates/seed.sh.tmpl`, `worker-seed.sh` |
| **Task graph queries** | `~/.claude-ops/lib/harness-jq.sh` |
| **Event bus library** | `~/.claude-ops/lib/event-bus.sh` |
| **Stop hook enforcement** | `~/.claude-ops/hooks/gates/stop-harness-dispatch.sh` |
| **Context injection** | `~/.claude-ops/hooks/interceptors/pre-tool-context-injector.sh` |
| **Prompt/telemetry publishing** | `~/.claude-ops/hooks/publishers/prompt-publisher.sh`, `post-tool-publisher.sh` |
| **Session registration** | `~/.claude-ops/lib/harness-launch.sh` |
| **Watchdog daemon** | `~/.claude-ops/scripts/harness-watchdog.sh` (launchd plist: `~/Library/LaunchAgents/com.claude-ops.harness-watchdog.plist`) |
| **Scaffold** | `~/.claude-ops/scripts/scaffold.sh` |
| **Harness API** | `~/.claude-ops/scripts/harness-api.ts` (REST on :7777) |
| **Per-harness manifests** | `~/.claude-ops/harness/manifests/{name}/manifest.json` |
| **Ops registry** | `{project}/.claude/harness/ops-registry.json` |
| **v3 migration tests** | `~/.claude-ops/tests/test-v3-migration.sh` (145 tests) |
| **Architecture reference** | `{project}/claude_files/ref/agent-architecture.md` |

---

## Quick Create (Conversational)

When the user provides a harness description (even just a sentence), do ALL of this:

1. **Extract**: name (kebab-case from description), lifecycle (default: bounded)
2. **Scaffold**: Run `bash ~/.claude-ops/scripts/scaffold.sh [--long-running] <name> <project> --from-description "description"`
3. **Explore codebase** for relevant files (use Glob/Grep for key paths matching description keywords)
4. **Generate and write** (all new harnesses use `agents/module-manager/`):
   - `agents/module-manager/config.json`: lifecycle, model, sleep_duration, mission (one line)
   - `agents/module-manager/state.json`: status=active, cycles_completed=0, sleep_duration
   - `agents/module-manager/mission.md`: Goal + Constraints (MUST MEET) + Scope + Optimization Targets
   - `agents/module-manager/MEMORY.md`: empty stub
   - `agents/module-manager/inbox.jsonl`, `outbox.jsonl`: empty
   - `agents/module-manager/memory/{ref,notes,scripts}/`: stub dirs with .gitkeep
   - `agents/module-manager/permissions.json`: permission_mode + model + allowedTools (scoped to file-ownership.json)
   - `agents/worker/{name}/`: 6-file workspace per worker + `permissions.json`
   - `tasks.json`: task graph with blockedBy DAG, 8-15 tasks
   - `INDEX.md`: navigation guide — key files, entry points (replaces harness.md)
   - `policy.json`: empty `{"rules": [], "inject": {}}`
5. **Post-scaffold checklist**:
   - [ ] Manifest status is `active`
   - [ ] Seed generates: `bash .claude/scripts/<name>-seed.sh`
6. **Show Warren**: task list, key files identified
7. **After approval**: `bash .claude/scripts/<name>-start.sh`

---

## Per-Harness Directory Layout (v3)

Each harness at `{project}/.claude/harness/{name}/`:

| Path | Purpose | Notes |
|------|---------|-------|
| `tasks.json` | Task graph: `{tasks: {id: {status, description, blockedBy, owner}}}` | Module-level, owned by module-manager |
| `policy.json` | Context injections, rules, learnings | Grows over time |
| `INDEX.md` | Navigation guide: key files, entry points | Replaces harness.md |
| `agents/module-manager/permissions.json` | Agent permission config | Model, permission_mode, disallowedTools |
| `agents/module-manager/mission.md` | Goal + Constraints (MUST MEET) + Scope | Warren-authored; stop hook reads Constraints |
| `agents/module-manager/config.json` | lifecycle, model, sleep_duration, mission (1 line), rotation | Read by stop hook + seed |
| `agents/module-manager/state.json` | status, cycles_completed, last_cycle_at, sleep_duration | Updated via harness_bump_session |
| `agents/module-manager/MEMORY.md` | Synthesized learnings ≤200 lines | Agent writes every cycle |
| `agents/module-manager/inbox.jsonl` | Messages received (materialized by bus side-effects) | Bus-only writes |
| `agents/module-manager/outbox.jsonl` | Messages sent (audit trail) | Bus-only writes |
| `agents/module-manager/memory/ref/` | External ground truth (Warren-provided, read-only) | Agent never overwrites |
| `agents/module-manager/memory/notes/` | Agent's detailed topic notes (overflow from MEMORY.md) | Agent writes freely |
| `agents/module-manager/memory/scripts/` | Reusable scripts agent has written | Agent writes freely |
| `agents/worker/{name}/` | Worker workspace (same 6-file structure as module-manager) | |

**Removed in v3**: `progress.json`, `journal.md`, `spec.md` (merged into mission.md), `acceptance.md` (merged into mission.md Constraints), `harness.md` (replaced by INDEX.md), `identity.json`

---

## Hook System (Three Types)

All hooks use event-prefix naming convention. Registered globally in `~/.claude/settings.json`.

| Type | Purpose | Return |
|------|---------|--------|
| **Publisher** | Emit events to bus | `{}` |
| **Interceptor** | Inject context before tool calls | `{"additionalContext": "..."}` |
| **Gate** | Block/allow stopping | `{"decision":"block","reason":"..."}` |

### Active Hooks (11 total)

**Publishers** (6): `prompt-publisher.sh`, `post-tool-publisher.sh`, `subagent-lifecycle.sh`, `post-tool-deploy-flag.sh`, `post-tool-write-flag.sh`, `pre-compact-evolve.sh`

**Interceptors** (2): `snippet_injector.py`, `pre-tool-context-injector.sh`

**Gates** (3+): `stop-harness-dispatch.sh`, `stop-session.sh`, `prompt-echo-deferred.sh`, `stop-echo.sh`

> Full hook inventory with paths and behavior → `references/hooks.md`

---

## Event Bus (v3 — single stream)

Project-scoped at `{project}/.claude/bus/`. Single `stream.jsonl` with monotonic `_seq` numbering. Pluggable side-effects at `~/.claude-ops/bus/side-effects/*.sh`. Default enabled (`EVENT_BUS_ENABLED=true`).

```bash
source ~/.claude-ops/lib/event-bus.sh
bus_publish "task.completed" '{"harness":"mod-customer","task_id":"t3","summary":"..."}'
bus_publish "file-edit" '{"agent":"my-agent","file":"src/main.ts"}'
bus_read "my-consumer" --type "file-edit" --limit 10   # Advances cursor
bus_query "file-edit"                                   # No cursor, type filter
bus_git_checkpoint "auto: wave 3 complete"
bus_compact                                             # Prune consumed events
```

Bus events: `prompt`, `session.start`, `session.end`, `tool-call`, `file-edit`, `deploy`, `error`, `config-change`, `subagent.start`, `subagent.stop`, `context.compacting`, `stop.blocked`, `work-order`, `announcement`, `work-order.completed`, `work-order.created`, `task.started`, `task.completed`, `agent.stopped`, `agent.respawned`, `agent.crash`, `agent.stuck`, `agent.nudged`, `agent.crash-loop`

> Full bus API, side-effects, compaction → `references/architecture.md`

---

## Harness Roles

| Mode | Detection Rule | Lifecycle | Purpose |
|------|----------------|-----------|---------|
| **Self-sidecar** | Default (no `.parent`) | CHECK → ACT → RECORD | Agent manages harness AND executes tasks |
| **Sidecar** | Worker directories exist at `agents/worker/` | CHECK → COMMUNICATE → REFLECT | Monitors workers, routes findings, updates MEMORY.md |
| **Worker** | `lifecycle: bounded` AND `.parent` set | Execute → Report → Repeat | Executes tasks, reports to sidecar via bus |

---

## RECORD Phase (every cycle)

Always at end of cycle, before stopping:

```bash
# 1. Update MEMORY.md (synthesize learnings, prune to ≤200 lines)

# 2. Bump cycle counter in state.json
source ~/.claude-ops/lib/harness-jq.sh
harness_bump_session .claude/harness/HARNESS/tasks.json

# 3. Publish task completions to bus
source ~/.claude-ops/lib/event-bus.sh
bus_publish "task.completed" '{"harness":"HARNESS","task_id":"TASK_ID","summary":"one line"}'
# bus side-effect update_tasks_json.sh automatically updates tasks.json status
```

**No journal.md.** MEMORY.md is the synthesized record. The stop hook gate enforces that MEMORY.md was updated before advancing cycles.

---

## Quick Start: Scaffold

```bash
bash ~/.claude-ops/scripts/scaffold.sh my-feature /path/to/project
```

### Post-Scaffold Fixups

1. **Manifest status → `active`** (at `~/.claude-ops/harness/manifests/{name}/manifest.json`)
2. **Write mission.md** at `agents/module-manager/mission.md`
3. **Verify seed**: `bash .claude/scripts/{name}-seed.sh`

---

## Registration

| Tier | Source | Key | Written by |
|------|--------|-----|------------|
| **0** | `pane-registry.json` | pane ID `.harness` | `harness-launch.sh`, hooks, `harness register` |

pane-registry.json is the sole source of truth. session-registry.json removed in v3.

---

## Watchdog Daemon

Runs every 30s via launchd. Detects crash / stuck / graceful-sleep / healthy. Respawns crashed agents immediately. Waits `sleep_duration` for graceful stops before respawning.

```bash
# Manual test
bash ~/.claude-ops/scripts/harness-watchdog.sh --once

# Status
bash ~/.claude-ops/scripts/harness-watchdog.sh --status

# Logs
tail -f ~/.claude-ops/state/watchdog.log
```

Crash-loop guard: > 3 crashes/hr → publish `agent.crash-loop` → stop retrying → notify Warren.

---

## Configuration Reference

| Variable | Default | Used by |
|----------|---------|---------|
| `EVENT_BUS_ENABLED` | `true` | event-bus.sh |
| `WAVE_GATE_ENABLED` | `true` | stop-harness-dispatch.sh |
| `CYCLE_GATE_REQUIRE_MEMORY` | `true` | harness-gates.sh |
| `CYCLE_GATE_REQUIRE_ACCEPTANCE` | `true` | harness-gates.sh |
| `CONTEXT_INJECTOR_MAX_MATCHES` | `3` | pre-tool-context-injector.sh |

---

## Launch

```bash
bash .claude/scripts/my-feature-start.sh    # Standard launch
bash .claude/scripts/my-feature-seed.sh      # Context reset (reseed)
```

Aliases: `cdo` (Opus), `cds` (Sonnet), `cdh` (Haiku), `cdoc` (Opus+Chrome).

**Auto-Launch (Default):** After scaffolding and populating a harness, ALWAYS launch automatically.

---

## Permission Model

`harness-launch.sh` reads `agents/module-manager/permissions.json` via `jq` to build CLI flags (falls back to `agents/sidecar/permissions.json` for legacy harnesses). Per-worker permissions at `agents/worker/{name}/permissions.json`.

| JSON field | CLI flag | Example |
|------------|----------------|---------|
| `permission_mode` | `--dangerously-skip-permissions` / `--permission-mode` | `bypassPermissions` |
| `model` | `--model` | `opus`, `sonnet`, `haiku`, `cdo`, `cds` |
| `allowedTools` | `--allowedTools` (array, comma-joined) | `["Edit:src/**", "Bash(bun *)"]` |
| `disallowedTools` | `--disallowedTools` (array, comma-joined) | `["Bash(./scripts/deploy*)"]` |
| `tools` | `--tools` (array, comma-joined) | `["Read", "Grep", "Glob"]` |
| `addDirs` | `--add-dir` (array, comma-joined) | `["../other-repo"]` |

**`--allowedTools` patterns:** Space-before-asterisk: `Bash(git add *)`. Need BOTH `Edit(path)` AND `Write(path)`. Root files need BOTH `Edit(CLAUDE.md)` and `Edit(**/CLAUDE.md)`.

---

## Seed Template

Regenerate all seeds after template changes (hq-v3-seed.sh is custom — skip it):

```bash
PROJECT_ROOT="/path/to/project"
TMPL="$HOME/.claude-ops/templates/seed.sh.tmpl"
for seed in "$PROJECT_ROOT/.claude/scripts/"*-seed.sh; do
  name=$(basename "$seed" | sed 's/-seed\.sh$//')
  [ "$name" = "hq-v3" ] && continue  # hq-v3-seed.sh is custom
  sed "s|{{HARNESS}}|$name|g; s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" "$TMPL" > "$seed"
done
```

---

## Rotation Setup

**v3**: rotation config lives in `agents/module-manager/config.json`. The stop hook reads it directly for lifecycle and rotation mode.

```json
// agents/module-manager/config.json
{
  "lifecycle": "bounded",
  "rotation": { "mode": "new_session", "max_rounds": 1, "claude_command": "cdo" }
}
```

---

## Seed Launch Pattern (CRITICAL — Never Use `-p`)

**WRONG:** `cdo -p .claude/scripts/my-seed.sh` — Claude reads the file and asks "what should I do?"

**CORRECT:** Generate seed text → start Claude → tmux-paste the text:

```bash
# 1. Generate seed to temp file
bash .claude/scripts/my-seed.sh > /tmp/my-seed.txt

# 2. Create tmux window (use -d to stay in current pane)
tmux new-window -d -t h -n my-harness -c "$PROJECT_ROOT"

# 3. Build Claude command with permissions from permissions.json
PERMS=".claude/harness/my-harness/agents/module-manager/permissions.json"
MODEL=$(jq -r '.model // "sonnet"' "$PERMS")
ALLOWED=$(jq -r '(.allowedTools // []) | join(",")' "$PERMS")
DISALLOWED=$(jq -r '(.disallowedTools // []) | join(",")' "$PERMS")

CLAUDE_CMD="claude --model $MODEL --dangerously-skip-permissions"
[ -n "$ALLOWED" ] && CLAUDE_CMD="$CLAUDE_CMD --allowedTools $ALLOWED"
[ -n "$DISALLOWED" ] && CLAUDE_CMD="$CLAUDE_CMD --disallowedTools $DISALLOWED"

tmux send-keys -t h:my-harness "$CLAUDE_CMD"
tmux send-keys -t h:my-harness -H 0d  # hex Enter — CRITICAL
sleep 12  # wait for TUI to init

# 4. Paste seed content via load-buffer
tmux load-buffer /tmp/my-seed.txt
tmux paste-buffer -t h:my-harness
sleep 2
tmux send-keys -t h:my-harness -H 0d  # submit
```

**Key rules:**
- **`-H 0d` (hex enter)** is the only reliable submit. Literal `Enter` does NOT submit.
- **`-d` flag** on `new-window`/`split-window` prevents focus switch.
- **`load-buffer` + `paste-buffer`** for multi-line seeds (safer than `send-keys -l`).
- **Permissions from JSON**: Read `permissions.json` via `jq` and build CLI flags, rather than hardcoding.

---

## Worker Under Module-Manager Pattern

Workers scaffold inside the module's directory:

```
.claude/harness/{module}/agents/worker/{name}/
  mission.md        — MM-authored: goal, constraints, scope
  config.json       — lifecycle: bounded, parent: {module}
  state.json        — status, cycles_completed
  permissions.json  — model, allowedTools scoped to owned files
  MEMORY.md         — worker's synthesized learnings
  inbox.jsonl       — must exist (create empty if not present)
  outbox.jsonl
  memory/           — ref/, notes/, scripts/
```

**`config.json` required fields:**
```json
{
  "name": "worker-name",
  "lifecycle": "bounded",
  "model": "sonnet",
  "parent": "mod-ops",
  "rotation": {"mode": "new_session", "max_rounds": 1, "claude_command": "cds"}
}
```

**`permissions.json` example (file-ownership scoped):**
```json
{
  "permission_mode": "bypassPermissions",
  "model": "opus",
  "allowedTools": [
    "Read", "Grep", "Glob",
    "Bash(bun test *)", "Bash(git *)", "Bash(curl*)",
    "Edit(src/admin/app/pages/pm-workbench/**)", "Write(src/admin/app/pages/pm-workbench/**)",
    "Edit(.claude/harness/mod-ops/agents/worker/pm-workbench/**)",
    "Write(.claude/harness/mod-ops/agents/worker/pm-workbench/**)"
  ],
  "disallowedTools": ["Bash(./scripts/deploy-prod*)"]
}
```

**Workers run in git worktrees** for branch isolation:
- Worktree dir: `../Wechat-{worker}/` (e.g. `../Wechat-wo-fullchain/`)
- Branch: `{module}/{worker}` (e.g. `mod-ops/wo-fullchain`)
- Module-manager creates worktree, launches Claude in a tmux split-pane with `-c $WORKTREE_DIR`
- Worker uses `--add-dir ${PROJECT_ROOT}/.claude/harness/${MODULE}` to access harness files
- See `TMUX-OPS.md` "Worker Worktree Launch Pattern" for full script

---

## Critical Lessons

1. **Team mandates go in the SEED** — agents follow the seed mechanically
2. **Task descriptions are the real instructions** — make them self-contained
3. **Custom seed scripts (hq-v3-seed.sh)** — never overwrite with generic template
4. **`--allowedTools` needs BOTH Edit AND Write** for every path
5. **Each stop hook must be its own group** in settings.json
6. **Triple enforcement** for long-running harnesses (seed + context injection + policy.json)
7. **Recurring mistakes → add context injection** to policy.json
8. **Seed launch via tmux paste, never `-p`**
9. **No journal.md** — write to MEMORY.md; stop hook gate checks MEMORY.md mtime
10. **harness_bump_session** updates state.json cycles_completed (call in RECORD phase)
11. **`tmux new-window -d`** — always use `-d` to avoid stealing focus from current pane
12. **Workers in git worktrees** — `../Wechat-{worker}/` isolates branches + prevents git lock conflicts
13. **`--add-dir`** gives workers read access to harness files in main repo while working in worktree
14. **`--allowedTools` + `--dangerously-skip-permissions` are orthogonal** — both needed for unattended agents. allowedTools restricts tool availability; bypass auto-approves usage.
15. **File ownership scoping** — worker permissions.json allowedTools should match file-ownership.json entries
16. **Git index.lock from concurrent agents** — use worktrees to prevent; `lsof .git/index.lock || rm` to fix stale locks
17. **`harness-launch.sh` checks `agents/module-manager/` first** — falls back to `agents/sidecar/` for backward compat

---

## Debugging

| Symptom | Fix |
|---------|-----|
| Agent keeps stopping | Check `allow-stop` files, check stop-harness-dispatch.sh |
| Agent ignores mandates | Move to seed.sh, add to policy.json rules |
| Hooks don't fire | Check `harness register --show` for pane-registry |
| Bus events missing | Check `EVENT_BUS_ENABLED` (default: true in event-bus.sh) |
| Cycle gate warning | Update MEMORY.md this cycle; call `harness_bump_session` |
| Seed launch: agent reads file | Never use `cdo -p seed.sh`; use tmux paste pattern |
| Pane-registry stale entries | Use Python to clean (jq `!=` breaks in bash) |
| Seed killed by pipefail | Add `|| true` on pane detection line |
| Worker permissions hang | Add both Edit and Write to allowedTools |
| Watchdog not respawning | Check `~/.claude-ops/state/watchdog.log`; verify `graceful-stop` sentinel exists |
| Crash-loop flag | Delete `~/.claude-ops/state/harness-runtime/{harness}/crash-loop` to resume |

Quick status: `source ~/.claude-ops/lib/harness-jq.sh && for f in .claude/harness/*/tasks.json; do echo "$(basename $(dirname $f)): $(harness_done_count "$f")/$(harness_total_count "$f")"; done`

---

## References (on-demand)

| File | Topic |
|------|-------|
| `references/architecture.md` | Three-layer architecture, event bus, file model |
| `references/hooks.md` | Hook types, active inventory, registration, debugging |
| `references/failure-modes.md` | Antipatterns, bus failures |
| `references/philosophy.md` | HDD principles, archetypes, agent mindset |

> These reference files are supplementary. The canonical source for all harness behavior is `~/.claude-ops/`.
