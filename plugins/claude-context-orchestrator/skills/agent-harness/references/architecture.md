# Harness Architecture

## Three-Separation Architecture

| Concern | Location | Shared? | What lives here |
|---------|----------|---------|-----------------|
| **Infrastructure** | `~/.claude-ops/` | Global — all projects | Scripts, hooks, templates, tests, event bus library |
| **State** | `{project}/.claude/harness/{name}/` | Per-harness | tasks.json, policy.json, agents/module-manager/ |
| **Event Bus** | `{project}/.claude/bus/` | Per-project | Single stream.jsonl, cursors, schema, seq counter |
| **Execution** | `TeamCreate` + `Task` tool | Ephemeral | Worker spawn, messaging, task delegation |

---

## Infrastructure Layer (`~/.claude-ops/`)

Shared across all projects. Agents source directly — never copy into projects.

### Libraries

| Path | What |
|------|------|
| `~/.claude-ops/lib/harness-jq.sh` | Task graph queries, manifest registry, hook helpers |
| `~/.claude-ops/lib/event-bus.sh` | Event bus v3 (single stream, publish, read, query, compact, checkpoint) |
| `~/.claude-ops/lib/pane-resolve.sh` | Pane ID + harness resolution for hooks |
| `~/.claude-ops/lib/bus-paths.sh` | Agent path resolution: `resolve_agent_file`, `resolve_agent_inbox`, `resolve_agent_outbox` |
| `~/.claude-ops/lib/handoff.sh` | Session rotation/replacement |

### Hooks (by type)

| Path | Type | Event | What |
|------|------|-------|------|
| `hooks/publishers/prompt-publisher.sh` | Publisher | UserPromptSubmit | Prompt logging + inbox sync + bus events |
| `hooks/publishers/post-tool-publisher.sh` | Publisher | PostToolUse | Tool logging + bus telemetry |
| `hooks/interceptors/pre-tool-context-injector.sh` | Interceptor | PreToolUse | Context injections from policy.json + bus reads |
| `hooks/gates/stop-harness-dispatch.sh` | Gate | Stop | Harness routing, phase gates, rotation |
| `hooks/gates/stop-session.sh` | Gate | Stop | Code-review for non-harness sessions |
| `hooks/dispatch/harness-*.sh` | Module | (sourced) | Gate/rotation/discovery/gc modules |
| `hooks/operators/checks.d/*.sh` | Check | (sourced) | Modular code quality checks |

### Scripts

| Script | What it does |
|--------|-------------|
| `~/.claude-ops/scripts/scaffold.sh` | Create new harness from templates + manifest |
| `~/.claude-ops/scripts/monitor-agent.sh` | Polling monitor + Claude session |
| `~/.claude-ops/scripts/harness-api.ts` | REST API on :7777 (dashboard, bus, agents) |
| `~/.claude-ops/scripts/tmux-harness-summary.sh` | Tmux status bar agent summary |

### Templates

| Template | Generates |
|----------|-----------|
| `templates/seed.sh.tmpl` | `.claude/scripts/{name}-seed.sh` |
| `templates/start.sh.tmpl` | `.claude/scripts/{name}-start.sh` |
| `templates/policy.json.tmpl` | `.claude/harness/{name}/policy.json` |
| `templates/acceptance.md.tmpl` | `.claude/harness/{name}/acceptance.md` |
| `templates/worker-seed.sh` | Worker agent seed prompt (takes MODULE + WORKER_NAME args) |
| `templates/report.css` | Shared stylesheet for reports |

### CLI Tools

| Tool | What |
|------|------|
| `~/.claude-ops/bin/harness.sh` | Unified CLI: list, status, stop, start, restart, logs, health, scaffold, register |
| `~/.claude-ops/bin/report-issue.sh` | File structured issues or feature requests |

### Test Suite

```bash
bash ~/.claude-ops/tests/run-all.sh              # Full suite
bash ~/.claude-ops/tests/test-event-bus.sh        # 43 bus v3 tests (single stream)
bash ~/.claude-ops/tests/test-registration.sh     # 16 three-tier discovery tests
bash ~/.claude-ops/tests/test-hooks.sh            # Hook integration tests
bash ~/.claude-ops/tests/test-harness-jq.sh       # 35 task graph + manifest tests
bash ~/.claude-ops/tests/test-scaffold.sh         # Scaffold tests
bash ~/.claude-ops/tests/test-waves.sh            # Wave function tests
bash ~/.claude-ops/tests/test-cycle-phase.sh      # Cycle phase enforcement tests
bash ~/.claude-ops/tests/test-worker-dispatch.sh  # Worker dispatch tests
```

---

## State Layer: Per-Harness Directory (v3)

Each harness at `{project}/.claude/harness/{name}/`:

| File | Purpose | Git tracked? |
|------|---------|-------------|
| `tasks.json` | Task graph: `{tasks: {id: {status, description, blockedBy, owner}}}` | YES |
| `policy.json` | Context injections, rules, learnings | YES |
| `acceptance.md` | Pass/fail status per criterion | YES |
| `agents/module-manager/config.json` | lifecycle, model, sleep_duration, mission, rotation | YES |
| `agents/module-manager/state.json` | status, cycles_completed, last_cycle_at | YES |
| `agents/module-manager/mission.md` | Goal + Constraints (MUST MEET) + Scope | YES |
| `agents/module-manager/MEMORY.md` | Synthesized learnings ≤200 lines | YES |
| `agents/module-manager/permissions.json` | bypassPermissions + disallowedTools | YES |
| `agents/module-manager/inbox.jsonl` | Messages received (materialized by bus) | NO |
| `agents/module-manager/outbox.jsonl` | Messages sent (audit trail) | NO |
| `agents/module-manager/memory/` | ref/, notes/, scripts/ subdirs | YES |

**Removed in v3**: `progress.json`, `harness.md`, `journal.md`, `spec.md` (merged into mission.md), `identity.json`, `subscriptions.yaml`

### Agent Workspace (v3 — 6 files per agent)

Module-managers at `agents/module-manager/`, workers at `agents/worker/{name}/`:

| File | Purpose |
|------|---------|
| `mission.md` | What to do (replaces identity.json mission field) |
| `config.json` | Static config: model, lifecycle, monitoring thresholds |
| `state.json` | Runtime state: type (execution/optimization/monitoring), loop counts, acceptance |
| `MEMORY.md` | Persistent learnings — agent reads and updates each loop |
| `inbox.jsonl` | Messages received (materialized by bus side-effects) |
| `outbox.jsonl` | Messages sent (audit trail) |

---

## State Layer: v3 File Schemas

### tasks.json (module root — task graph)

```json
{
  "tasks": {
    "task-id": {
      "status": "pending|in_progress|completed",
      "description": "self-contained task description",
      "blockedBy": [],
      "owner": null,
      "metadata": {}
    }
  }
}
```

### agents/module-manager/config.json

```json
{
  "name": "mod-ops",
  "mission": "one-line mission description",
  "lifecycle": "bounded|long-running",
  "model": "sonnet",
  "sleep_duration": 900,
  "rotation": {
    "max_rounds": 1,
    "mode": "new_session",    // "new_session" | "none"
    "claude_command": "cdo"   // cdo (opus) | cds (sonnet) | cdh (haiku)
  },
  "scope_tags": [],
  "created_at": "ISO"
}
```

### agents/module-manager/state.json

```json
{
  "status": "active|done",
  "cycles_completed": 0,
  "last_cycle_at": null,
  "session_count": 0
}
```

### Task Graph Functions (`harness-jq.sh`)

| Function | Returns |
|----------|---------|
| `harness_current_task $PF` | First in_progress, else first unblocked pending, else "ALL_DONE" |
| `harness_next_task $PF` | Next unblocked pending (skipping in_progress) |
| `harness_done_count $PF` / `harness_total_count $PF` | Counts |
| `harness_completed_names $PF` / `harness_pending_names $PF` | Comma-separated IDs |
| `harness_task_description $PF $TASK` | Description of a specific task |
| `harness_check_blocked $PF $TASK` | JSON blocker details or "null" |
| `harness_set_in_progress $PF $TASK` | Set status (validates deps) |
| `harness_set_completed $PF $TASK` | Set status to completed |
| `harness_would_unblock $PF $TASK` | Tasks that become runnable on completion |
| `harness_init $PF` | Initialize path cache for v3 config/state/tasks resolution |
| `worker_scaffold $DIR $NAME $MISSION` | Create worker directory with 6-file model |
| `worker_pane_register $PID $MOD $NAME ...` | Register worker in pane-registry |
| `worker_loop_update $STATE $PID $TARGET $DELTA $MSG` | Update worker state + registry after loop |
| `pane_registry_update $PID $HARNESS $TASK $DONE $TOTAL $DISPLAY [$TARGET] [$ROLE]` | Update pane-registry entry (single atomic write) |

---

## Event Bus Layer (`{project}/.claude/bus/`)

### v3 Architecture

Single `stream.jsonl` (no topic directories). Events carry `_event_type`, `_seq` (monotonic), `_ts`. Pluggable side-effects declared in `schema.json` and executed from `~/.claude-ops/bus/side-effects/*.sh`. Atomic writes via mkdir-based spinlock.

### Bus Event Types (v3 — 16 types)

| Event type | Published by |
|------------|-------------|
| `prompt` | prompt-publisher.sh |
| `session.start` | prompt-publisher.sh (first prompt) |
| `session.end` | stop hooks |
| `tool-call` | post-tool-publisher.sh |
| `file-edit` | post-tool-publisher.sh |
| `deploy` | post-tool-deploy-flag.sh |
| `error` | any hook on error |
| `config-change` | post-tool-publisher.sh |
| `subagent.start` | subagent-lifecycle.sh |
| `subagent.stop` | subagent-lifecycle.sh |
| `context.compacting` | pre-compact-evolve.sh |
| `stop.blocked` | hook_block() in harness-jq.sh |
| `work-order` | bus_publish (direct) |
| `announcement` | bus_publish_announcement() |
| `work-order.completed` | lead agent |
| `work-order.created` | lead agent |

### Bus API

```bash
source ~/.claude-ops/lib/event-bus.sh

bus_publish "file-edit" '{"agent":"my-agent","file":"src/main.ts"}'
bus_read "my-consumer" --type "file-edit" --limit 10  # Advances cursor
bus_query "file-edit"                                  # Legacy: type + after_seq
bus_query --type "deploy" --from "code-health" --after 500 --limit 50
bus_query --pattern "work-order" --since "2026-02-27T00:00:00Z"
bus_query_filter "telemetry"                           # Named filter from schema.json
bus_subscribe "my-consumer"                            # Init cursor at current max
bus_ack "my-consumer" 142                              # Manual cursor advance
bus_git_checkpoint "auto: wave 3 complete"
bus_compact                                            # Prune consumed events (global)
```

### Convenience Aliases

```bash
bus_publish_deploy "agent" "static" "test"
bus_publish_announcement "bot" "message" "urgent"
```

---

## Registration

| Source | Key | Written by |
|--------|-----|------------|
| `pane-registry.json` | pane ID `.harness` | `harness-launch.sh`, stop hooks, `harness register` |

pane-registry.json is the sole source of truth. session-registry.json was fully removed in v3. All hooks read via `resolve_pane_and_harness()` in `pane-resolve.sh`.

---

## Execution Layer: Teams

| Mode | When | Agents | Team? |
|------|------|--------|-------|
| **Swarm** | 2+ independent tasks | 1 lead + N workers | Yes (TeamCreate) |
| **Solo** | All tasks sequential | 1 (harness agent) | No |

### Swarm Lifecycle

1. `{name}-seed.sh` injected into module-manager → reads tasks.json + config.json
2. Module-manager calls `TeamCreate`, creates tasks from tasks.json, spawns workers
3. Workers claim tasks, complete them, notify module-manager via `hq_send` + bus
4. Module-manager updates tasks.json + publishes bus events
5. On rotation: `harness_bump_session` → handoff.sh → new session re-reads tasks.json + state.json
6. All done: shutdown workers → `bus_git_checkpoint` → `state.json status="done"`

### Hooks Integration

Hooks fire on the **lead agent only** — workers are subagents with their own lifecycle.

---

## Durable State (`~/.claude-ops/state/`)

| Path | Purpose |
|------|---------|
| `pane-registry.json` | Agent discovery metadata (Tier 0 source of truth) |
| `sessions/{sid}/` | Per-session: allow-stop, echo-state.json, baseline.txt, flags |
| `harness-runtime/{name}/` | Per-harness: stop-flag, rotation-advisory |
| `health.json` | Per-agent health status |
| `metrics.jsonl` | Unified event stream |

---

## Per-Harness Manifests

```
~/.claude-ops/harness/manifests/{name}/manifest.json
```

Registry functions in harness-jq.sh: `harness_list_active`, `harness_project_root`, `harness_progress_path`, `harness_list_all`.

---

## Ops Registry (v4)

Dynamic agent discovery at `{project}/.claude/harness/ops-registry.json`. The hq-v3 harness reads this to aggregate module state.

Current system (v4): 1 coordinator (`hq-v3`) + 4 module-managers (`mod-ops`, `mod-tenant`, `mod-intel`, `mod-platform`) + 14 workers.

```json
{
  "_meta": { "version": 4 },
  "coordinator": "hq-v3",
  "agents": {
    "hq-v3": { "type": "coordinator", "modules": ["mod-ops", "mod-tenant", "mod-intel", "mod-platform"] },
    "mod-ops": { "type": "module-manager", "workers": ["wo-fullchain", "pm-workbench"], "preview_port": 8012 },
    ...
  }
}
```

---

## Module-Manager Agent Slot (v3)

v3 introduces `agents/module-manager/` as the primary agent slot (replaces `agents/sidecar/` for modules that have workers). `harness-launch.sh` checks `agents/module-manager/permissions.json` first, falls back to `agents/sidecar/permissions.json`.

Module-managers coordinate workers but also have their own workspace (MEMORY.md, inbox, outbox). Workers are at `agents/worker/{name}/`.

---

## Worker Worktree Isolation

Workers run in **git worktrees** for branch isolation — each worker gets its own copy of the repo on its own branch. No git lock contention between workers or with the main checkout.

```
~/Desktop/zPersonalProjects/
  Wechat/                    ← main checkout (module-managers + hq-v3)
  Wechat-wo-fullchain/       ← worktree for wo-fullchain (branch: mod-ops/wo-fullchain)
  Wechat-pm-workbench/       ← worktree for pm-workbench (branch: mod-ops/pm-workbench)
  Wechat-kf-quality/         ← worktree for kf-quality (branch: mod-tenant/kf-quality)
  ...
```

Module-managers create worktrees with `git worktree add` and launch workers with `tmux split-window -d -c $WORKTREE_DIR`. Workers use `--add-dir ${PROJECT_ROOT}/.claude/harness/${MODULE}` to read harness files from the main repo.

**Key benefit:** Workers commit freely to their own branch. Module-managers merge approved work into module integration branches (`mod-ops/work`, etc.). hq-v3 merges integration branches to main.

---

## `--allowedTools` + `--dangerously-skip-permissions` Interaction

These flags are orthogonal:
- `--allowedTools` filters which tools are **available** to the model (whitelist)
- `--dangerously-skip-permissions` auto-approves **usage** of available tools (no user confirmation)

Both should be set for unattended agents: bypass removes the approval prompt, allowedTools restricts the blast radius. A worker with `allowedTools: ["Edit(src/miniapp/**)", "Read", "Grep"]` and `--dangerously-skip-permissions` can freely edit miniapp files but cannot touch anything else.

---

## File Ownership Map

`{project}/.claude/harness/file-ownership.json` defines which module/worker owns which source files. Workers' `permissions.json` `allowedTools` should match their ownership entries.

| Module | Owns |
|--------|------|
| mod-ops | `src/admin/app/pages/pm-workbench/`, `src/admin/routes/work-order*` |
| mod-tenant | `src/miniapp/`, `src/wechat/callback/`, chatbot tool handlers |
| mod-intel | `src/bi/`, `src/admin/app/pages/finance/`, `src/admin/routes/dashboard*` |
| mod-platform | `scripts/deploy*`, `data/config/databases.json` |
| hq-v3 | Read-only everywhere |
| Shared | `src/admin/routes/index.ts`, `data/config/security-policies.json` (MM serializes) |
