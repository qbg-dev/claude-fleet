/**
 * TB3 Ranger Hardening Pipeline — iterative test hardening via adversarial agents.
 *
 * Graph:
 *   attempt → analyze-harden ──→ attempt (cycle if round < N)
 *                              └→ $end   (converged)
 *
 * Attempt phase: Sonnet solves the Ranger migration task from scratch in Docker.
 * Analyze phase: Opus reviews results, classifies failures, hardens tests/instruction.
 *
 * Exit: N consecutive rounds where the agent either solves correctly OR fails for
 * legitimate difficulty (Ranger bugs), not ambiguity or env issues.
 *
 * Usage:
 *   fleet pipeline tb3-harden --set rounds=5
 *   fleet pipeline tb3-harden --set rounds=3 --set host=5.161.107.142
 *   fleet pipeline tb3-harden --set skipOracle=true   # skip oracle/nop, just harden
 *   fleet pipeline tb3-harden --dry-run
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface Tb3HardenOpts {
  rounds?: number;
  host?: string;
  local?: boolean;
  skipOracle?: boolean;
  scope?: string;
  spec?: string;
}

const TASK = "ranger-provisioning-service";
const PROJECT_ROOT = "/Users/wz/Desktop/zPersonalProjects/terminal-bench-3-w-tb3-ranger";
const TASK_DIR = `${PROJECT_ROOT}/tasks/${TASK}`;

export default function tb3Harden(opts: Tb3HardenOpts): Program {
  const rounds = opts.rounds || 5;
  const host = opts.host || "5.161.107.142";
  const local = opts.local || false;
  const skipOracle = opts.skipOracle || false;
  const dockerCmd = local ? "docker" : `ssh root@${host} docker`;

  const g = graph(
    "tb3-harden",
    `Iterative test hardening for Ranger migration task (${rounds} rounds)`,
  )
    .node("attempt", {
      description: "Agent solves the Ranger migration task in a fresh Docker container",
      agents: [
        {
          name: "agent-runner",
          role: "executor",
          model: "sonnet",
          seed: { inline: runnerSeed(host, local, dockerCmd) },
          window: "attempt",
        },
      ],
    })
    .node("analyze-harden", {
      description: "Analyze agent performance, classify failures, harden tests and instruction",
      agents: [{
        name: "hardener",
        role: "analyst",
        model: "opus",
        seed: { inline: hardenerSeed(host, local, dockerCmd, skipOracle) },
        window: "analyze",
      }],
      prelaunch: [
        { type: "parse-output", agent: "agent-runner", file: "round-results.json" },
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
      label: "all rounds complete or converged",
      priority: 1,
    })
    .defaults({
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    })
    .material({
      scope: opts.scope,
      spec: opts.spec || `Harden Ranger migration benchmark tests across ${rounds} rounds`,
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

export function parse_agent_runner_output(state: any): void {
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "round-results.json");
  if (fs.existsSync(resultsPath)) {
    if (!state.ext) state.ext = {};
    state.ext.roundResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

// ── Seed generators ────────────────────────────────────────────────────

function runnerSeed(host: string, local: boolean, dockerCmd: string): string {
  const syncCmd = local
    ? `cp -r ${TASK_DIR}/environment /tmp/tb3-harden-env`
    : `rsync -az ${TASK_DIR}/environment/ root@${host}:/tmp/tb3-harden-env/`;

  return `You are a benchmark executor for the Ranger migration task.

## Project
\`${PROJECT_ROOT}\` — a benchmark where an agent must migrate a StarRocks analytics platform from view-based tenant isolation to Apache Ranger row-level security. The task involves configuring StarRocks FE, setting up Ranger from scratch (service definition, groups, users, policies), writing a provisioning script, and onboarding a new tenant.

## Rules
- Do NOT look at \`${TASK_DIR}/solution/\` or \`${TASK_DIR}/tests/\` — you are testing the agent
- Build a fresh Docker container each round
- The agent (Sonnet) reads ONLY instruction.md and solves inside the container
- After the agent finishes (or times out at 30 min), run the test suite to grade

## Task

### Step 1: Read round number
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
\`\`\`

### Step 2: Build fresh Docker environment
\`\`\`bash
${syncCmd}
${dockerCmd} rm -f tb3-harden-r$ROUND 2>/dev/null || true
${dockerCmd} build -t tb3-harden ${local ? "/tmp/tb3-harden-env" : "/tmp/tb3-harden-env"} 2>&1 | tail -5
${dockerCmd} run -d --name tb3-harden-r$ROUND --cpus=2 --memory=6g tb3-harden
\`\`\`

### Step 3: Wait for container ready
\`\`\`bash
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-harden-r$ROUND 2>&1 | grep -q "Environment ready"; then
    echo "Container ready after $((i*2))s"
    break
  fi
  sleep 2
done
\`\`\`

### Step 4: Read the instruction (what the agent sees)
\`\`\`bash
cat ${TASK_DIR}/instruction.md
\`\`\`

### Step 5: Run Sonnet agent
Launch a Claude Code agent (Sonnet) to solve the task inside the container. The agent should:
- Read the instruction.md content
- Execute commands via \`${dockerCmd} exec tb3-harden-r$ROUND ...\`
- Have a 30-minute timeout

Use Claude Code CLI:
\`\`\`bash
INSTRUCTION=$(cat ${TASK_DIR}/instruction.md)
timeout 1800 claude -p "You are solving a benchmark task inside a Docker container.

Execute all commands with: ${dockerCmd} exec tb3-harden-r\${ROUND} <command>

Here is the task:

$INSTRUCTION

Solve it step by step. Remember all commands must run inside the container." \\
  --model claude-sonnet-4-20250514 \\
  --output-format json 2>&1 | tee "{{SESSION_DIR}}/agent-transcript-r\${ROUND}.json"
\`\`\`

### Step 6: Run test suite
\`\`\`bash
${dockerCmd} exec tb3-harden-r$ROUND mkdir -p /tests /logs/verifier
${dockerCmd} cp ${TASK_DIR}/tests/test_state.py tb3-harden-r$ROUND:/tests/test_state.py
${dockerCmd} cp ${TASK_DIR}/tests/test.sh tb3-harden-r$ROUND:/tests/test.sh
${dockerCmd} exec tb3-harden-r$ROUND chmod +x /tests/test.sh
TEST_OUTPUT=$(${dockerCmd} exec tb3-harden-r$ROUND pytest /tests/test_state.py -v --tb=short 2>&1)
echo "$TEST_OUTPUT"
REWARD=$(${dockerCmd} exec tb3-harden-r$ROUND bash -c '/tests/test.sh && cat /logs/verifier/reward.txt' 2>&1)
\`\`\`

### Step 7: Write consolidated results
Parse the pytest output and write to \`{{SESSION_DIR}}/round-results.json\`:
\`\`\`json
{
  "round": 1,
  "timestamp": "2026-03-15T12:00:00Z",
  "agent": "sonnet",
  "container": "tb3-harden-r1",
  "reward": "1" or "0",
  "tests": {
    "total": 50,
    "passed": 42,
    "failed": 8,
    "skipped": 0
  },
  "categories": {
    "A_rls_td_80": {"passed": 8, "total": 8, "tests": [...]},
    "B_rls_td_2001": {"passed": 6, "total": 8, "tests": [...]},
    "C_masking": {"passed": 5, "total": 6, "tests": [...]},
    "D_deny": {"passed": 4, "total": 4, "tests": [...]},
    "E_access": {"passed": 6, "total": 6, "tests": [...]},
    "F_isolation": {"passed": 4, "total": 4, "tests": [...]},
    "G_config": {"passed": 3, "total": 4, "tests": [...]},
    "H_provision": {"passed": 4, "total": 6, "tests": [...]},
    "I_edge": {"passed": 2, "total": 4, "tests": [...]}
  },
  "failed_tests": [
    {"name": "test_b3_td_2001_fact_service_tickets", "reason": "Access denied..."},
    ...
  ],
  "agent_blockers": ["description of what blocked the agent", ...],
  "time_spent_min": 25
}
\`\`\`

For each failed test, include the test name and the failure reason from pytest output.

### Step 8: Print summary
Print a pass/fail table:
\`\`\`
Round 1 Results:
Category          Passed  Total
A. RLS td_80       8/8
B. RLS td_2001     6/8     ← test_b3, test_b4 failed
C. Masking         5/6
...
Overall: 42/50 (reward: 0)
\`\`\``;
}

function hardenerSeed(_host: string, _local: boolean, dockerCmd: string, skipOracle: boolean): string {
  const oracleSection = skipOracle ? "" : `
### Phase 2a: Run oracle verification
Verify the reference solution still passes all 50 tests:
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
# Build fresh container
${dockerCmd} rm -f tb3-oracle-verify 2>/dev/null || true
${dockerCmd} run -d --name tb3-oracle-verify --cpus=2 --memory=6g tb3-harden
# Wait for ready
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-oracle-verify 2>&1 | grep -q "Environment ready"; then break; fi
  sleep 2
done
# Run solution
${dockerCmd} cp ${TASK_DIR}/solution/solve.sh tb3-oracle-verify:/tmp/solve.sh
${dockerCmd} exec tb3-oracle-verify bash /tmp/solve.sh
# Run tests
${dockerCmd} exec tb3-oracle-verify mkdir -p /tests
${dockerCmd} cp ${TASK_DIR}/tests/test_state.py tb3-oracle-verify:/tests/test_state.py
ORACLE_RESULT=$(${dockerCmd} exec tb3-oracle-verify pytest /tests/test_state.py -v --tb=short 2>&1)
echo "$ORACLE_RESULT"
${dockerCmd} rm -f tb3-oracle-verify
\`\`\`
If oracle fails after your changes, revert the broken test and try a different approach.`;

  return `You are the benchmark hardener for the TB3 Ranger migration task.

## Project
\`${PROJECT_ROOT}\` — a benchmark where an agent migrates StarRocks from view-based isolation to Apache Ranger RLS. 50 tests across 9 categories verify the migration.

## Context
A Sonnet agent just attempted to solve the Ranger migration task from scratch. Results are in:
- \`{{SESSION_DIR}}/round-results.json\`
- \`{{SESSION_DIR}}/agent-transcript-r{N}.json\` (agent's execution log)

## Your analysis workflow

### Phase 1: Read results
Read \`{{SESSION_DIR}}/round-results.json\`. Build a matrix:
- Test category × Pass/Fail
- For each failure, read the failure reason

### Phase 2: Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **ranger_bug** | Agent hit a known Ranger bug (group resolution, otherAttributes, isDenyAllElse, etc.) and couldn't figure it out | No action—legitimate difficulty |
| **instruction_ambiguity** | Agent misunderstood what to do because instruction.md was unclear | Fix instruction.md |
| **test_bug** | Test checks wrong condition, too strict, or relies on implementation detail | Fix test_state.py |
| **env_issue** | Container/service startup problem, race condition, port conflict | Fix start.sh or Dockerfile |
| **reward_hack** | Agent found shortcut (e.g., hardcoded td_2001 without building provision.py) | Harden tests |

Guidelines:
- If agent configured Ranger but used wrong resource hierarchy → **ranger_bug** (legitimate difficulty)
- If agent didn't know to restart FE because instruction didn't mention it → check if instruction.md says to restart → if not, **instruction_ambiguity**
- If agent set up Ranger correctly but test expects a specific policy name → **test_bug** (too coupled to implementation)
- If agent wrote provision.py but it doesn't work for td_2002 → **ranger_bug** or check if test_h5 gives useful error
- If agent just created StarRocks users with GRANTs instead of Ranger → check if tests catch it → if not, **reward_hack**
${oracleSection}

### Phase 3: Fix issues
For each instruction_ambiguity/test_bug/env_issue/reward_hack:

1. Read the relevant file:
   - \`${TASK_DIR}/instruction.md\` — for instruction issues
   - \`${TASK_DIR}/tests/test_state.py\` — for test issues
   - \`${TASK_DIR}/environment/data/start.sh\` — for env issues
   - \`${TASK_DIR}/solution/solve.sh\` — verify solution still works with changes

2. Make targeted fixes:
   - **instruction_ambiguity**: Add clarity without giving away the solution. Mention what to do, not how.
   - **test_bug**: Fix the condition. Don't couple tests to implementation details (policy names, exact API calls).
   - **env_issue**: Fix startup scripts, add retry logic, increase timeouts.
   - **reward_hack**: Add tests that verify Ranger API state (service definition exists, policies exist, row filters work dynamically).

3. After fixing tests, verify the reference solution still passes:
\`\`\`bash
# Verify solution against updated tests
cd ${PROJECT_ROOT}
# (the oracle check above handles this)
\`\`\`

### Phase 4: Update round counter
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"
\`\`\`

### Phase 5: Write report
Write to \`{{SESSION_DIR}}/harden-report-r\${ROUND}.md\`:

\`\`\`markdown
# Hardening Report — Round {N}

## Pass/Fail Matrix
| Category | Tests | Passed | Status |
|----------|-------|--------|--------|
| A. RLS td_80 | 8 | 8/8 | PASS |
| B. RLS td_2001 | 8 | 6/8 | FAIL |
| ... |

## Issues Found

### Ranger Bugs (legitimate difficulty — no action)
- Agent couldn't figure out group resolution bug — kept using groups[] only
- Agent used wrong otherAttributes format (dict instead of JSON string)

### Instruction Ambiguity (fixed)
- instruction.md didn't mention FE restart is required. Added note about restarting FE.

### Test Bugs (fixed)
- test_g2 required specific service definition name — loosened to check any StarRocks service exists

### Reward Hacks (hardened)
- Agent created users with SQL GRANTs instead of Ranger policies — added test_g3 check for Ranger service

## Changes Made
- instruction.md: Added note about FE restart requirement
- test_state.py: Loosened test_g2, added new anti-hack test
- solve.sh: No changes needed

## Difficulty Assessment
- Easy (agent solves consistently): Categories E, H
- Medium (intermittent): Categories A, B, C
- Hard (consistent fail): Categories D, G (Ranger bugs)
\`\`\`

### Phase 6: Commit changes
\`\`\`bash
cd ${PROJECT_ROOT}
git add tasks/${TASK}/
git commit -m "Round \${ROUND}: harden Ranger migration tests based on agent performance"
\`\`\`

## Key principles
- **Outcome-only**: Tests check query results and API state, never agent behavior
- A test bug means the test is wrong, not the agent
- Don't over-harden—if the agent fails because Ranger bugs are genuinely hard, that's the point
- Each round should reduce false positives/negatives while maintaining fairness
- The hidden difficulty IS the Ranger bugs—don't hint at them in the instruction
- Always verify the reference solution still passes after changes`;
}
