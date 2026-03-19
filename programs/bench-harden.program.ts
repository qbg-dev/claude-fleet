/**
 * Benchmark Hardening Pipeline — iterative test hardening via adversarial agents.
 *
 * Graph:
 *   attempt → analyze-harden ──→ attempt (cycle if round < N)
 *                              └→ $end   (converged)
 *
 * Attempt phase: Sonnet + Codex solve the benchmark from scratch.
 * Analyze phase: Opus reviews results, hardens tests, verifies ref solution.
 *
 * Usage:
 *   fleet pipeline bench-harden --set problem=distributed_kv_store --set rounds=3
 *   fleet pipeline bench-harden --dry-run
 */
import type { Program, ProgramFlag } from "../engine/program/types";
import { graph } from "../engine/program/graph";

/** Declared flags — `fleet pipeline bench-harden --set problem=X --set rounds=3` */
export const flags: ProgramFlag[] = [
  { name: "problem", description: "SCBench problem name", type: "string", default: "distributed_kv_store" },
  { name: "rounds", description: "Number of hardening rounds", type: "number", default: 3 },
];

export interface BenchHardenOpts {
  problem?: string;
  rounds?: number;
  scope?: string;
  spec?: string;
  projectRoot?: string;
  force?: boolean;
}

export default function benchHarden(opts: BenchHardenOpts): Program {
  const problem = opts.problem || "distributed_kv_store";
  const rounds = opts.rounds || 3;
  const problemDir = `/Users/wz/zPersonalProjects/slop-code-bench/problems/${problem}`;

  const g = graph(
    "bench-harden",
    `Iterative benchmark hardening for ${problem} (${rounds} rounds, Sonnet + Codex)`,
  )
    .node("attempt", {
      description: "Sonnet + Codex solve the benchmark from scratch",
      agents: [
        {
          name: "sonnet-solver",
          role: "solver",
          model: "sonnet",
          seed: { inline: solverSeed(problemDir, problem, "sonnet") },
          window: "solvers",
        },
        {
          name: "codex-solver",
          role: "solver",
          model: "gpt-5.4",
          runtime: "codex",
          seed: { inline: solverSeed(problemDir, problem, "codex") },
          window: "solvers",
        },
      ],
    })
    .node("analyze-harden", {
      description: "Analyze agent performance, harden tests",
      agents: [{
        name: "hardener",
        role: "analyst",
        model: "opus",
        seed: { inline: hardenerSeed(problemDir, problem) },
        window: "analyze",
      }],
      prelaunch: [
        { type: "parse-output", agent: "sonnet-solver", file: "sonnet-results.json" },
        { type: "parse-output", agent: "codex-solver", file: "codex-results.json" },
      ],
    })
    // attempt → analyze (always)
    .edge("attempt", "analyze-harden")
    // analyze → attempt (cycle back if more rounds needed)
    .edge("analyze-harden", "attempt", {
      condition: `test $(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1) -lt ${rounds}`,
      maxIterations: rounds,
      label: "more rounds needed",
    })
    // analyze → $end (done)
    .edge("analyze-harden", "$end", {
      label: "all rounds complete",
      priority: 1,
    })
    .defaults({
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    })
    .material({
      scope: opts.scope,
      spec: opts.spec || `Harden ${problem} benchmark tests across ${rounds} rounds`,
    })
    .build();

  return {
    name: g.name,
    description: g.description,
    phases: [],
    defaults: g.defaults,
    material: g.material,
    graph: g,
  };
}

// ── Parse output handlers ──────────────────────────────────────────────

export function parse_sonnet_solver_output(state: any): void {
  // Bridge calls this to extract sonnet results into pipeline state
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "results", "sonnet-solver", "results.json");
  if (fs.existsSync(resultsPath)) {
    state.ext.sonnetResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

export function parse_codex_solver_output(state: any): void {
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "results", "codex-solver", "results.json");
  if (fs.existsSync(resultsPath)) {
    state.ext.codexResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

// ── Seed generators ────────────────────────────────────────────────────

function solverSeed(problemDir: string, problem: string, agentName: string): string {
  return `You are a coding agent solving the SCBench "${problem}" benchmark.

## Rules
- Do NOT look at anything in \`${problemDir}/solutions/\` — you are being tested
- Read specs from \`${problemDir}/checkpoint_N.md\`
- Read test expectations from \`${problemDir}/tests/test_checkpoint_N.py\`
- Read the conftest at \`${problemDir}/tests/conftest.py\` to understand the test harness

## Working directory
\`\`\`bash
mkdir -p /tmp/scbench-${agentName}-r$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
\`\`\`

## Task
Implement all 6 checkpoints sequentially. For each checkpoint N (1 through 6):

1. Read the spec: \`${problemDir}/checkpoint_N.md\`
2. Write/update your solution at \`/tmp/scbench-${agentName}-r$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)/main.py\`
3. Run tests:
   \`\`\`bash
   cd ${problemDir}
   pytest tests/test_checkpoint_N.py \\
     --entrypoint="python3 /tmp/scbench-${agentName}-r$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)/main.py" \\
     --checkpoint=checkpoint_N -v 2>&1
   \`\`\`
4. If tests fail, fix your code and retry (up to 3 retries per checkpoint)
5. Record results

## Dependencies
\`\`\`bash
pip install flask httpx psutil 2>/dev/null
\`\`\`

## Output
After all 6 checkpoints, write results to \`{{RESULTS_DIR}}/results.json\`:
\`\`\`json
{
  "agent": "${agentName}",
  "round": <round_number>,
  "checkpoints": {
    "1": {"total": N, "passed": N, "failed": N, "failed_tests": ["test_name", ...], "retries": N},
    "2": {...},
    ...
    "6": {...}
  },
  "total_tests": N,
  "total_passed": N,
  "solution_path": "/tmp/scbench-${agentName}-rN/main.py"
}
\`\`\`

## Key implementation notes
- \`--data-dir\` must be a flag on EACH subcommand (not the parent parser)
- Flask server must bind 0.0.0.0 and be threaded
- CLI output must be JSON to stdout
- The conftest \`start_server\` polls \`GET /kv\` to detect readiness
- Cluster tests use \`--cluster node1:PORT1,node2:PORT2,node3:PORT3 --node-id nodeN\``;
}

function hardenerSeed(problemDir: string, problem: string): string {
  return `You are the benchmark hardener for SCBench "${problem}".

## Context
Two agents (Sonnet + Codex) just attempted to solve the benchmark from scratch.
Their results are in:
- \`{{SESSION_DIR}}/results/sonnet-solver/results.json\`
- \`{{SESSION_DIR}}/results/codex-solver/results.json\`
Their solution code is at the paths listed in those files.

## Your analysis workflow

### Phase 1: Read results
Read both result files. Build a matrix:
- Test name × Agent → pass/fail

### Phase 2: Categorize tests

| Category | Meaning | Action |
|----------|---------|--------|
| Both pass easily | Test may be too easy or hackable | Inspect agent code for shortcuts |
| One passes, one fails | Good discriminator | Keep as-is |
| Both fail | Too hard OR spec unclear | Check if reference solution passes |
| Both pass but code is hacky | Test is gameable | Harden test |

### Phase 3: Inspect agent solutions for hacks
For tests that both agents pass, read their main.py files and check:
- Are they actually implementing the spec?
- Or are they taking shortcuts (hardcoded values, test inspection, etc.)?
- If shortcuts found → the test needs hardening

### Phase 4: Harden tests
For each identified weakness:
1. Read the current test at \`${problemDir}/tests/test_checkpoint_N.py\`
2. Add or strengthen assertions
3. Verify the reference solution still passes:
   \`\`\`bash
   cd ${problemDir}
   pytest tests/test_checkpoint_N.py \\
     --entrypoint="python3 solutions/checkpoint_N/main.py" \\
     --checkpoint=checkpoint_N -v
   \`\`\`
4. If reference fails → your test is wrong, fix it

### Phase 5: Update round counter
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"
\`\`\`

### Phase 6: Write report
Write to \`{{SESSION_DIR}}/harden-report-r\${ROUND}.md\`:
- Per-checkpoint pass/fail matrix
- Hacks found in agent solutions
- Tests hardened (with rationale)
- Tests removed (if unfair)
- Difficulty assessment per checkpoint

### Phase 7: Commit changes
\`\`\`bash
cd ${problemDir}/..
git add ${problem}/tests/
git commit -m "Round \${ROUND}: harden ${problem} tests based on agent performance"
\`\`\`

## Key principles
- A test is too easy if agents pass it WITHOUT implementing the spec
- A test is unfair if the reference solution can't pass it
- Each round should increase hack-resistance while maintaining fairness
- Don't make tests timing-dependent or flaky—that's worse than easy tests`;
}
