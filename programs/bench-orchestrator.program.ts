/**
 * Benchmark Orchestrator — Cross-Pollinating Hardener with Cron Monitoring
 *
 * Architecture:
 *   Single perpetual PI node (Lab Mode pattern) — 30-minute watchdog cycles.
 *   Each cycle: read pipeline state → cross-pollinate → spawn workers → checkpoint.
 *
 * Monitors:
 *   - tb3-harden (terminal-bench-3): Ranger RLS migration, 50 tests
 *   - greenfield-harden (greenfield-bench): 11 hotel cases × 3 checkpoints
 *
 * Cross-pollinates learnings between pipelines, spawns hardeners when idle,
 * escalates complexity when benchmarks are solved.
 *
 * Usage:
 *   fleet pipeline bench-orchestrator
 *   fleet pipeline bench-orchestrator --set sleepMin=45
 *   fleet pipeline bench-orchestrator --dry-run
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface BenchOrchestratorOpts {
  sleepMin?: number;   // minutes between cycles (default 30)
  scope?: string;
  spec?: string;
}

const TB3_ROOT = "/Users/wz/zPersonalProjects/terminal-bench-3-w-tb3-ranger";
const GF_ROOT = "/Users/wz/Desktop/qbg/greenfield-bench";
const WECHAT_ROOT = "/Users/wz/zPersonalProjects/Wechat";
const CROSS_DIR = "/tmp/cross-pollination";

export default function benchOrchestrator(opts: BenchOrchestratorOpts): Program {
  const sleepSec = (opts.sleepMin || 30) * 60; // default 30 min

  const g = graph(
    "bench-orchestrator",
    "Cross-pollinating benchmark orchestrator — monitors tb3-harden & greenfield-harden",
  )
    .node("orchestrator", {
      description: "Perpetual PI — 30-min cycles monitoring and cross-pollinating benchmark pipelines",
      agents: [{
        name: "bench-pi",
        role: "professor",
        model: "sonnet",
        sleepDuration: sleepSec,
        seed: { inline: buildOrchestratorSeed(opts) },
        window: "orchestrator",
        hooks: [
          // Re-inject pipeline state before context compaction
          {
            event: "PreCompact",
            type: "prompt",
            description: "Re-inject pipeline awareness across compaction",
            prompt: [
              "CRITICAL STATE — preserve across compaction:",
              "",
              "You are bench-pi, the cross-pollinating benchmark orchestrator.",
              "Two pipelines: tb3-harden (Ranger RLS, 50 tests) and greenfield-harden (11 hotel cases).",
              "",
              "Each cycle you must:",
              "1. `fleet ls --json` — check active workers",
              "2. Read latest round-results.json from both pipelines",
              "3. Cross-pollinate findings between pipelines",
              "4. Relaunch idle pipelines, spawn hardeners as needed",
              "5. Write cycle report, call round_stop()",
              "",
              "Check your last checkpoint and Fleet Mail for state continuity.",
              `Cross-pollination reports: ${CROSS_DIR}/`,
              `TB3 project: ${TB3_ROOT}`,
              `Greenfield project: ${GF_ROOT}`,
            ].join("\n"),
          },
          // Startup — read checkpoints and mail
          {
            event: "SessionStart",
            type: "prompt",
            description: "Read prior state on watchdog respawn",
            prompt: [
              "You are resuming after a watchdog respawn. Before anything:",
              "1. mail_inbox() — check for worker results and Warren's instructions",
              "2. Read your last checkpoint if it exists",
              "3. `fleet ls --json` — get current worker status",
              "4. Read latest cross-pollination reports from /tmp/cross-pollination/",
              "5. Decide actions for this cycle",
            ].join("\n"),
          },
          // End-of-cycle checkpoint
          {
            event: "Stop",
            type: "prompt",
            description: "Force structured cycle report before checkpoint",
            prompt: [
              "## End-of-Cycle Report (MANDATORY)",
              "",
              "Before round_stop(), write a structured cycle report:",
              "",
              "### Pipeline Status",
              "- tb3-harden: [active/idle/dead] — tests passed: X/50 — last round: N",
              "- greenfield-harden: [active/idle/dead] — cases passed: X/11 — last round: N",
              "",
              "### Cross-Pollination This Cycle",
              "- TB3 → Greenfield: [what was transferred]",
              "- Greenfield → TB3: [what was transferred]",
              "",
              "### Actions Taken",
              "- [workers spawned, pipelines relaunched, complexity escalated]",
              "",
              "### Next Cycle Plan",
              "- [what to do in 30 minutes]",
              "",
              "Write this to /tmp/cross-pollination/cycle-report-latest.md, then round_stop().",
            ].join("\n"),
          },
          // Notify Warren
          {
            event: "Stop",
            type: "message",
            description: "Send cycle summary to Warren",
            to: "user",
            subject: "Bench orchestrator cycle complete",
            body: "bench-pi completed a monitoring cycle. Check /tmp/cross-pollination/cycle-report-latest.md for status.",
          },
        ],
      }],
    })
    .edge("orchestrator", "$end", { label: "watchdog manages cycling via round_stop()" })
    .defaults({
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    })
    .material({
      scope: opts.scope,
      spec: opts.spec || "Monitor and cross-pollinate tb3-harden and greenfield-harden benchmark pipelines",
    })
    .build();

  return {
    name: g.name,
    description: g.description,
    phases: [],
    graph: g,
    defaults: g.defaults,
    material: g.material,
  };
}

// ── Orchestrator Seed ──────────────────────────────────────────────────

function buildOrchestratorSeed(opts: BenchOrchestratorOpts): string {
  const sleepMin = opts.sleepMin || 30;

  return `# bench-pi — Cross-Pollinating Benchmark Orchestrator

You are a perpetual orchestrator running in ${sleepMin}-minute watchdog cycles. You monitor two benchmark hardening pipelines and cross-pollinate learnings between them.

## Pipelines You Monitor

### 1. tb3-harden (Terminal Bench 3)
- **Project**: \`${TB3_ROOT}\`
- **Task**: Ranger RLS migration — agent migrates StarRocks from view-based isolation to Apache Ranger
- **Tests**: 50 tests across 9 categories (A–I)
- **Fleet state**: \`~/.claude/fleet/terminal-bench-3/\`
- **Results**: \`{{SESSION_DIR}}/round-results.json\` (if running via pipeline)
- **Reports**: harden-report-r*.md in session dir
- **Known bugs**: group resolution, otherAttributes format, isDenyAllElse — these are legitimate Ranger difficulty

### 2. greenfield-harden (Greenfield Bench)
- **Project**: \`${GF_ROOT}\`
- **Task**: 11 hotel management cases × 3 cascading checkpoints
- **Fleet state**: \`~/.claude/fleet/greenfield-bench/\`
- **Results**: round-results.json in session dir
- **Reports**: harden-report-r*.md in session dir
- **Known issues**: verifier bugs (action strings, LIKE patterns, data_exists vs data_created)

## Per-Cycle Workflow

### Step 1: Check Pipeline Status
\`\`\`bash
# Check active workers
fleet ls --json 2>/dev/null || fleet ls

# Look for latest results from tb3-harden
find ~/.claude/fleet/terminal-bench-3/ -name "round-results.json" -newer /tmp/cross-pollination/.last-check 2>/dev/null | head -5
find /tmp/fleet-pipeline-* -path "*/tb3-harden/*/round-results.json" 2>/dev/null | head -5

# Look for latest results from greenfield-harden
find ~/.claude/fleet/greenfield-bench/ -name "round-results.json" -newer /tmp/cross-pollination/.last-check 2>/dev/null | head -5
find /tmp/fleet-pipeline-* -path "*/greenfield-harden/*/round-results.json" 2>/dev/null | head -5

# Check harden reports
find ${TB3_ROOT} ${GF_ROOT} -name "harden-report-r*.md" -newer /tmp/cross-pollination/.last-check 2>/dev/null | head -10
\`\`\`

If no results found via find, check the fleet state dirs directly:
\`\`\`bash
ls -lt ~/.claude/fleet/terminal-bench-3/*/checkpoints/ 2>/dev/null | head -10
ls -lt ~/.claude/fleet/greenfield-bench/*/checkpoints/ 2>/dev/null | head -10
\`\`\`

### Step 2: Read and Analyze Results
For each pipeline that has new results since last check:
- Read round-results.json
- Read the latest harden-report
- Build a progress matrix:
  - TB3: category × pass/fail, highlight new failures vs prior round
  - Greenfield: case × checkpoint × pass/fail, highlight new failures

### Step 3: Cross-Pollinate Findings

#### TB3 → Greenfield
- Ranger bugs found in tb3 (group resolution, otherAttributes, isDenyAllElse) → could inform greenfield case_11 (access_control)
- Test patterns: anti-reward-hack checks (verifying Ranger API state, not just query results) → apply to greenfield verifiers
- Docker/env hardening patterns → apply to greenfield environment setup

#### Greenfield → TB3
- Verifier improvements: LIKE patterns instead of exact match → apply to tb3 test_state.py
- data_exists vs data_created distinction → tb3 could distinguish "data was present" vs "agent created it"
- Cascading checkpoint pattern (CP1→CP2→CP3 state persistence) → tb3 could verify round-over-round state

#### Common Patterns
- Agent failure modes: SDK crashes, timeout management, tool permission issues
- Reward hack detection strategies
- Instruction clarity patterns that reduce ambiguity failures

Write cross-pollination findings to:
\`\`\`bash
mkdir -p ${CROSS_DIR}
# Write findings
cat > ${CROSS_DIR}/tb3-to-greenfield.md << 'EOF'
# TB3 → Greenfield Cross-Pollination (Cycle N)
...
EOF

cat > ${CROSS_DIR}/greenfield-to-tb3.md << 'EOF'
# Greenfield → TB3 Cross-Pollination (Cycle N)
...
EOF

# Update timestamp
touch ${CROSS_DIR}/.last-check
\`\`\`

### Step 4: Decide Actions

**If a pipeline is idle/dead** (no active workers, no recent results):
- Relaunch it: \`fleet pipeline tb3-harden\` or \`fleet pipeline greenfield-harden\`
- Or spawn an ad-hoc hardener via create_worker()

**If a pipeline just completed a round** (new results):
- Read results, cross-pollinate (Step 3)
- If improvements are clear, spawn a worker to apply them

**If greenfield passes ≥9/11 cases** → Trigger complexity escalation:
- Read ${WECHAT_ROOT} for real-world complexity patterns
- Propose new benchmark cases inspired by:
  | Wechat Pattern | Benchmark Complexity |
  |----------------|---------------------|
  | Split-service (core + web) | Task requires managing multiple services |
  | StarRocks + Ranger RLS | Multi-project isolation (already in tb3) |
  | SSH bastion tunneling | Network hop complexity to database access |
  | Server-authoritative files | Config files that must NOT be overwritten |
  | Langfuse Docker Compose | Multi-container orchestration |
  | Zero-downtime deploy | Service continuity during migration |
  | Schema auto-migration | DB schema changes preserving existing data |
- Write proposal to ${CROSS_DIR}/complexity-escalation.md
- Mail Warren with proposal: mail_send(to: "user", subject: "Benchmark complexity escalation proposal", body: "...")

**If tb3 passes ≥45/50 tests** → Trigger test hardening:
- Add anti-cheat: verify agent didn't hardcode td_2001 without building provision.py
- Add cascading state verification: ensure policy state persists across restarts
- Add Pass^k reliability metric: propose running agent 3x to measure consistency

### Step 5: Spawn Workers as Needed

Use create_worker() MCP tool for ad-hoc hardeners:
\`\`\`
create_worker(
  name: "tb3-cross-hardener",
  mission: "Apply greenfield LIKE-pattern verifier improvements to tb3 test_state.py. Read ${CROSS_DIR}/greenfield-to-tb3.md for specific changes.",
  type: "implementer"
)
\`\`\`

Use mail_send() to coordinate with existing pipeline workers:
\`\`\`
mail_send(to: "hardener", subject: "Cross-pollination input", body: "New findings from greenfield: ...")
\`\`\`

### Step 6: Hardener & Verifier Improvement Proposals

Track these improvement ideas across cycles:

**Hardener improvements**:
- Reward hack detection: check if agent gamed tests (inserted rows directly instead of Ranger setup)
- Cascading state verification: checkpoint N's state persists at N+1
- Pass^k reliability: run agent 3x, measure consistency

**Verifier improvements**:
- Move from exact match to LIKE patterns (greenfield lesson)
- Negative tests: verify agent did NOT take shortcuts
- State mutation tests: modify data after agent setup, verify Ranger still filters
- data_created vs data_exists distinction

### Step 7: Write Cycle Report and Checkpoint
\`\`\`bash
mkdir -p ${CROSS_DIR}
cat > ${CROSS_DIR}/cycle-report-latest.md << 'EOF'
# Benchmark Orchestrator — Cycle Report
Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Pipeline Status
- tb3-harden: [status] — X/50 tests — Round N
- greenfield-harden: [status] — X/11 cases — Round N

## Cross-Pollination
- TB3 → Greenfield: [summary]
- Greenfield → TB3: [summary]

## Actions Taken
- [list]

## Next Cycle Plan
- [list]
EOF
\`\`\`

Then call \`save_checkpoint("Cycle N: tb3 X/50, greenfield X/11. Actions: ...")\`
Then call \`round_stop()\`

## Important Rules

- You are PERPETUAL — the watchdog respawns you every ${sleepMin} minutes
- Always call round_stop() at the end of your cycle
- Read checkpoints and mail_inbox() on startup for continuity
- Do NOT run benchmark tasks yourself — monitor, analyze, and delegate
- Keep cross-pollination reports in ${CROSS_DIR}/ for persistence across cycles
- Mail Warren (mail_send to: "user") for significant findings or escalation proposals
- If both pipelines are idle and there's nothing new, still write a status report and round_stop()
- Commit any changes you make to benchmark files

## First Cycle Bootstrap

On your very first cycle (no prior checkpoint):
1. Run \`fleet ls\` to see what's already running
2. Check both pipeline directories for existing results
3. If no hardeners are active, launch both pipelines:
   - \`fleet pipeline tb3-harden --set rounds=3\`
   - \`fleet pipeline greenfield-harden --set rounds=3\`
4. Set up the cross-pollination directory: \`mkdir -p ${CROSS_DIR}\`
5. Write initial status report
6. round_stop()
`;
}
