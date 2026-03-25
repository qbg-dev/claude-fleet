# Cron Setup — Autonomous Improvement Loop

> Give this file to any Claude instance. It will set up a complete autonomous improvement loop in the current project.

You are setting up an autonomous improvement loop — a 3-phase cycle: **Plan → Execute → Reflect**. Each cycle is a sprint — equivalent to a day of engineering compressed via massive LLM parallelism. Plan launches 15-20 parallel explorers, Execute launches 10-20 parallel fixers, Reflect tests everything, prevents every bug class, and ships.

**Framework location**: `~/claude-cron/`

Follow these 5 setup phases exactly.

---

## Phase A: Understand the Project (~30s)

1. Read `CLAUDE.md` (if it exists) — authoritative project reference
2. Read `package.json` / `Cargo.toml` / `go.mod` / `pyproject.toml` / `Makefile`
3. `git log -10 --oneline` — recent activity
4. `ls src/` or equivalent source directory
5. `ls test/` or equivalent test directory
6. Check if `cron/` already exists:
   - **If yes**: MIGRATION. Read existing files, reconcile with framework. Don't overwrite evolved files.
   - **If no**: FRESH SETUP. Continue to Phase B.

Detect: language, test runner, build tool, deploy target, domain.

---

## Phase B: Interview the Operator

| # | Topic | Question | Default |
|---|-------|----------|---------|
| 1 | **Project name** | What should the loop call this? | `[dir name]` |
| 2 | **Deploy target** | SSH host / URL / CI / none? | `[auto-detect]` |
| 3 | **Test commands** | Full test suite command? | `[auto-detect]` |
| 4 | **Stress target** | API endpoint or UI URL to stress-test? | `[auto-detect]` |
| 5 | **Vision** | One sentence: what is this project trying to become? | `[from README]` |
| 6 | **Tmux pane** | Which pane for the cron session? | `[current pane]` |

"Reply with just the numbers and your choice — anything you skip I'll use the default."

---

## Phase C: Generate Infrastructure

### Step 1: Scaffold

```bash
bash ~/claude-cron/scripts/setup-cron.sh "$(pwd)"
```

Creates `cron/` with 3 phase files (`plan.md`, `execute.md`, `reflect.md`), explorers, protocols, watchdog, logs.

### Step 2: Generate project-specific files

Read `.tmpl` files from `~/claude-cron/templates/` as blueprints. Generate project-specific versions:

#### `cron/vision.md`
Read `~/claude-cron/templates/vision.md.tmpl`. Expand the operator's vision answer into a north star — purpose, quality bar, never-idle work categories, success metrics.

#### `cron/constitution.md`
Read `~/claude-cron/templates/constitution.md.tmpl`. Generate with:
- All principles (universal)
- 3-phase table (Plan/Execute/Reflect)
- Architecture section (deploy target, machine, project dir)
- Protocol list (include `bug-regression-prevention.md`)
- Explorer table

#### `cron/config.json`
Read `~/claude-cron/templates/config.json.tmpl`. Fill in test commands, deploy config.

#### `cron/phases/plan.md`
Scaffold copied the generic version. Customize:
- Explorer table (E1-E4 core + E5-E8 rotating, chosen for this project)
- Context-gather steps (project-specific: production feedback, deploy health)
- Discovery swarm prompts adapted to this domain

#### `cron/phases/reflect.md`
Scaffold copied the generic version. Customize:
- Test commands for this project
- Deploy steps (or remove if no deploy)

#### `cron/protocols/deploy.md`
Read `~/claude-cron/templates/protocols/deploy.md.tmpl`. Write project-specific deploy steps.

### Step 3: Generate explorer missions

**Always create E1-E4** (core — never rotated). Read `~/claude-cron/templates/explorers/e{N}/mission.md.tmpl`, generate project-specific versions at `cron/phases/explorers/e{N}-{name}/mission.md`.

- **E1 harness**: compile, test, lint commands
- **E2 stress**: stress target (API URL, CLI, UI endpoint)
- **E3 codebase**: source directory, file size thresholds
- **E4 infra**: deploy host, health endpoint

**Then create 4+ rotating explorers (E5+)** based on project type:

| If the project has... | Create explorer for... |
|----------------------|----------------------|
| Web frontend | **UI quality** — tokens, a11y, rendering |
| API | **API contract** — schema, errors, rate limiting |
| Database | **Data quality** — nulls, constraints, performance |
| User-facing features | **Client scenarios** — real workflows, edge cases |
| LLM/AI | **Prompt quality** — system prompt health, output quality |
| External deps | **Integration health** — availability, versions |
| Scraper | **Scraping health** — success rates, freshness |

Read `~/claude-cron/examples/` for real-world mission.md examples from ChengXing and KaiFeng.

### Step 4: Customize REVIEW.md (semantic lint rules)

The scaffold seeded a `REVIEW.md` at the project root. This is the semantic testing layer — rules that require judgment, not just pass/fail. During coherency rounds, 3-8 agents review all recent changes against these rules.

Customize it for your project. Examples:
- **Interpretability**: Every flagged decision must show its formula, inputs, and data source
- **Feedback surface**: Every user-facing judgment must have a "this is incorrect" button
- **Progressive disclosure**: Summary first, drill-down on demand
- **Domain tone**: Professional, no emoji, domain terminology, data disclaimers

### Step 5: Customize discovery swarm

Review `cron/phases/explorers/discovery-swarm.md`. Customize the 15 agent prompts for this project's codebase, tech stack, and domain.

---

## Phase D: Install Watchdog

```bash
bash ~/claude-cron/scripts/install-watchdog.sh "$(pwd)"
```

This will:
1. Detect the current tmux pane
2. Write `cron/watchdog/cron.env`
3. Install SessionStart + Stop hooks
4. Offer launchd (macOS) or systemd (Linux) daemon installation

---

## Phase E: Summary + Start

```
=== Cron Loop Installed ===
Loop:       Plan → Execute → Reflect (3-phase sprint cycle)
Project:    {name}
Explorers:  {count} (E1-E4 core + E5+ rotating)
Test suite: {commands}
Deploy:     {target or "none"}
Watchdog:   {pane}

Files:
  cron/vision.md        — north star (why)
  cron/constitution.md  — source of truth (ticked every 5min)
  cron/phases/          — plan.md, execute.md, reflect.md (how)
  cron/phases/explorers/— explorer missions
  cron/protocols/       — event-triggered procedures
  cron/watchdog/        — crash recovery + hooks
  cron/logs/            — summary.jsonl + rounds/

Start: Read cron/cron_create_reminder.md
Watchdog: nohup cron/watchdog/cron-watchdog.sh &
```

Ask: "Should I begin the first cycle now?"

If yes, read `cron/cron_create_reminder.md` and follow its instructions to schedule via `CronCreate`, then begin the first Plan immediately.

---

## Meta-Cron (optional — for monitoring multiple project crons)

If the operator runs multiple project crons, set up a meta-cron that monitors them all and self-improves the framework.

### Setup

1. The meta-cron lives in `~/claude-cron/cron/` (the framework monitors itself)
2. Templates are in `~/claude-cron/templates/meta/`
3. Launch in a dedicated tmux pane (e.g., `meta-cron:1.0`)
4. Ticks every 10 min (slower than project crons)

### What it does

- **4 meta-explorers**: tick quality scorer, pane health monitor, constitution compliance auditor, framework self-audit
- **Enforces compliance**: writes fixes directly into project `cron/` files (constitution amendments, missing protocols, config fixes)
- **Improves the framework**: when both projects have the same issue, fixes the template so future setups are better
- **Propagates patterns**: good pattern in one project → framework → all projects

### Key difference from project crons

The meta-cron doesn't just remind — it **writes fixes into the monitored projects' cron/ folders and constitutions**. The constitution IS the tick, so writing into it means the agent WILL see the enforcement next cycle.

See `~/claude-cron/templates/meta/` for all meta-cron templates.
