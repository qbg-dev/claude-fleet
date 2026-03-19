/**
 * TB3 Benchmark Verification Pipeline — oracle + nop + blind agent trial.
 *
 * Graph:
 *   setup → verify (oracle + nop in parallel) → agent-trial → evaluate ──→ agent-trial (if task bug, max 3)
 *                                                                        └→ $end (verified or reward hack)
 *
 * Setup: Build Docker, start container, wait for "Environment ready".
 * Verify: Oracle (solve.sh → 50/50) + Nop (no solve → majority fail).
 * Agent trial: Fresh container, blind solve from instruction.md only.
 * Evaluate: Classify outcome (VERIFIED, TASK_BUG, REWARD_HACK).
 *
 * Usage:
 *   fleet pipeline tb3-verify --task ranger-provisioning-service --host 18.236.183.103
 *   fleet pipeline tb3-verify --task ranger-provisioning-service --local
 *   fleet pipeline tb3-verify --task ranger-provisioning-service --skip-trial
 *   fleet pipeline tb3-verify --dry-run
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface Tb3VerifyOpts {
  task?: string;
  host?: string;
  local?: boolean;
  skipTrial?: boolean;
  agentModel?: string;
  scope?: string;
  spec?: string;
}

export default function tb3Verify(opts: Tb3VerifyOpts): Program {
  const task = opts.task || "ranger-provisioning-service";
  const host = opts.host || "18.236.183.103";
  const local = opts.local || false;
  const skipTrial = opts.skipTrial || false;
  const agentModel = opts.agentModel || "opus";
  const taskDir = `/Users/wz/zPersonalProjects/terminal-bench-3-w-tb3-ranger/tasks/${task}`;

  const sshPrefix = local ? "" : `ssh root@${host}`;
  const dockerCmd = local ? "docker" : `ssh root@${host} docker`;

  const builder = graph(
    "tb3-verify",
    `Benchmark verification for ${task} (oracle + nop${skipTrial ? "" : " + agent trial"})`,
  )
    .node("setup", {
      description: "Build Docker image, start container, wait for ready",
      agents: [{
        name: "setup-worker",
        role: "devops",
        model: "sonnet",
        seed: { inline: setupSeed(taskDir, task, host, local, dockerCmd, sshPrefix) },
        window: "setup",
      }],
    })
    .node("verify", {
      description: "Oracle (solve.sh → 50/50) + Nop (no solve → fail)",
      agents: [
        {
          name: "oracle-tester",
          role: "tester",
          model: "sonnet",
          seed: { inline: oracleTestSeed(taskDir, task, dockerCmd, sshPrefix) },
          window: "verify",
        },
        {
          name: "nop-tester",
          role: "tester",
          model: "sonnet",
          seed: { inline: nopTestSeed(taskDir, task, dockerCmd, sshPrefix) },
          window: "verify",
        },
      ],
      prelaunch: [
        { type: "parse-output", agent: "setup-worker", file: "setup-result.json" },
      ],
    })
    .edge("setup", "verify");

  if (skipTrial) {
    // Skip agent trial, go straight to evaluate from verify
    builder
      .node("evaluate", {
        description: "Evaluate oracle + nop results",
        agents: [{
          name: "evaluator",
          role: "analyst",
          model: "opus",
          seed: { inline: evaluateSeed(taskDir, task, skipTrial) },
          window: "evaluate",
        }],
        prelaunch: [
          { type: "parse-output", agent: "oracle-tester", file: "oracle-result.json" },
          { type: "parse-output", agent: "nop-tester", file: "nop-result.json" },
        ],
      })
      .edge("verify", "evaluate")
      .edge("evaluate", "$end", { label: "verification complete" });
  } else {
    // Full pipeline with agent trial
    builder
      .node("agent-trial", {
        description: "Blind agent attempt from instruction.md only",
        agents: [{
          name: "blind-agent",
          role: "solver",
          model: agentModel as any,
          seed: { inline: agentTrialSeed(taskDir, task, dockerCmd, sshPrefix) },
          window: "trial",
        }],
        prelaunch: [
          { type: "parse-output", agent: "oracle-tester", file: "oracle-result.json" },
          { type: "parse-output", agent: "nop-tester", file: "nop-result.json" },
        ],
      })
      .node("evaluate", {
        description: "Evaluate all results, classify outcome",
        agents: [{
          name: "evaluator",
          role: "analyst",
          model: "opus",
          seed: { inline: evaluateSeed(taskDir, task, skipTrial) },
          window: "evaluate",
        }],
        prelaunch: [
          { type: "parse-output", agent: "blind-agent", file: "trial-result.json" },
        ],
      })
      .edge("verify", "agent-trial")
      .edge("agent-trial", "evaluate")
      // Back-edge: if task bug, retry agent trial (max 3 cycles)
      .edge("evaluate", "agent-trial", {
        condition: `test "$(cat "{{SESSION_DIR}}/score.txt" 2>/dev/null)" = "0" && test "$(cat "{{SESSION_DIR}}/verdict.txt" 2>/dev/null)" = "TASK_BUG"`,
        maxIterations: 3,
        label: "task bug—retry agent trial",
      })
      .edge("evaluate", "$end", {
        label: "verified or reward hack",
        priority: 1,
      });
  }

  const g = builder
    .defaults({
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    })
    .material({
      scope: opts.scope,
      spec: opts.spec || `Verify benchmark task: ${task}`,
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

export function parse_setup_worker_output(state: any): void {
  loadResult(state, "setup-result.json");
}

export function parse_oracle_tester_output(state: any): void {
  loadResult(state, "oracle-result.json");
}

export function parse_nop_tester_output(state: any): void {
  loadResult(state, "nop-result.json");
}

export function parse_blind_agent_output(state: any): void {
  loadResult(state, "trial-result.json");
}

function loadResult(state: any, file: string): void {
  const fs = require("fs");
  const path = require("path");
  const p = path.join(state.sessionDir, file);
  if (fs.existsSync(p)) {
    if (!state.ext) state.ext = {};
    state.ext[file.replace(".json", "").replace(/-/g, "_")] = JSON.parse(fs.readFileSync(p, "utf-8"));
  }
}

// ── Seed generators ────────────────────────────────────────────────────

function setupSeed(taskDir: string, task: string, host: string, local: boolean, dockerCmd: string, _sshPrefix: string): string {
  const copyCmd = local
    ? `cp -r ${taskDir}/environment /tmp/tb3-env-${task}`
    : `rsync -az ${taskDir}/environment/ root@${host}:/tmp/tb3-env-${task}/`;

  return `You are a DevOps worker setting up the benchmark environment for "${task}".

## Task
1. Copy the environment directory to the build host
2. Build the Docker image
3. Start the container
4. Wait for "Environment ready" in the logs (max 8 minutes)

## Commands

### Copy environment files
\`\`\`bash
${copyCmd}
\`\`\`

### Build Docker image
\`\`\`bash
${dockerCmd} build -t tb3-${task} ${local ? `/tmp/tb3-env-${task}` : `/tmp/tb3-env-${task}`}
\`\`\`

### Start container (oracle run)
\`\`\`bash
${dockerCmd} rm -f tb3-oracle-${task} 2>/dev/null || true
${dockerCmd} run -d --name tb3-oracle-${task} \\
  --cpus=2 --memory=6g \\
  tb3-${task}
\`\`\`

### Wait for ready
\`\`\`bash
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-oracle-${task} 2>&1 | grep -q "Environment ready"; then
    echo "Container ready after $((i*2))s"
    break
  fi
  sleep 2
done
\`\`\`

### Start nop container (for nop test)
\`\`\`bash
${dockerCmd} rm -f tb3-nop-${task} 2>/dev/null || true
${dockerCmd} run -d --name tb3-nop-${task} \\
  --cpus=2 --memory=6g \\
  tb3-${task}
\`\`\`

Wait for nop container ready too.

${!local ? `### Start agent trial container\n\`\`\`bash\n${dockerCmd} rm -f tb3-trial-${task} 2>/dev/null || true\n${dockerCmd} run -d --name tb3-trial-${task} \\\\\n  --cpus=2 --memory=6g \\\\\n  tb3-${task}\n\`\`\`\n\nWait for trial container ready too.` : ""}

## Output
Write to \`{{SESSION_DIR}}/setup-result.json\`:
\`\`\`json
{
  "status": "ready",
  "oracle_container": "tb3-oracle-${task}",
  "nop_container": "tb3-nop-${task}",
  "trial_container": "tb3-trial-${task}",
  "build_time_sec": <seconds>,
  "startup_time_sec": <seconds>
}
\`\`\``;
}

function oracleTestSeed(taskDir: string, task: string, dockerCmd: string, _sshPrefix: string): string {
  return `You are the oracle tester for benchmark task "${task}".

## Task
1. Copy solve.sh into the oracle container
2. Run solve.sh
3. Copy test_state.py + test.sh into the container
4. Run tests
5. Expect 50/50 tests pass

## Commands

### Copy solution into container
\`\`\`bash
${dockerCmd} cp ${taskDir}/solution/solve.sh tb3-oracle-${task}:/tmp/solve.sh
${dockerCmd} exec tb3-oracle-${task} chmod +x /tmp/solve.sh
\`\`\`

### Run solve.sh
\`\`\`bash
${dockerCmd} exec tb3-oracle-${task} bash /tmp/solve.sh 2>&1
\`\`\`

If solve.sh fails, capture the error and report it.

### Copy tests into container
\`\`\`bash
${dockerCmd} exec tb3-oracle-${task} mkdir -p /tests /logs/verifier
${dockerCmd} cp ${taskDir}/tests/test_state.py tb3-oracle-${task}:/tests/test_state.py
${dockerCmd} cp ${taskDir}/tests/test.sh tb3-oracle-${task}:/tests/test.sh
${dockerCmd} exec tb3-oracle-${task} chmod +x /tests/test.sh
\`\`\`

### Run tests
\`\`\`bash
${dockerCmd} exec tb3-oracle-${task} pytest /tests/test_state.py -v --tb=short 2>&1
\`\`\`

### Check reward
\`\`\`bash
${dockerCmd} exec tb3-oracle-${task} bash /tests/test.sh
${dockerCmd} exec tb3-oracle-${task} cat /logs/verifier/reward.txt
\`\`\`

## Output
Write to \`{{SESSION_DIR}}/oracle-result.json\`:
\`\`\`json
{
  "status": "pass" | "fail",
  "total_tests": 50,
  "passed": <n>,
  "failed": <n>,
  "failed_tests": ["test_name", ...],
  "solve_exit_code": 0,
  "reward": "1" | "0",
  "output": "<truncated test output>"
}
\`\`\``;
}

function nopTestSeed(taskDir: string, task: string, dockerCmd: string, _sshPrefix: string): string {
  return `You are the nop tester for benchmark task "${task}".

## Task
Run the test suite on a FRESH container WITHOUT running solve.sh first.
Most tests should FAIL (the environment starts with view-based isolation,
not Ranger RLS). If too many tests pass without the solution, the tests
need hardening.

## Commands

### Wait for nop container
\`\`\`bash
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-nop-${task} 2>&1 | grep -q "Environment ready"; then
    echo "Nop container ready"
    break
  fi
  sleep 2
done
\`\`\`

### Copy tests into container (NO solve.sh!)
\`\`\`bash
${dockerCmd} exec tb3-nop-${task} mkdir -p /tests /logs/verifier
${dockerCmd} cp ${taskDir}/tests/test_state.py tb3-nop-${task}:/tests/test_state.py
${dockerCmd} cp ${taskDir}/tests/test.sh tb3-nop-${task}:/tests/test.sh
${dockerCmd} exec tb3-nop-${task} chmod +x /tests/test.sh
\`\`\`

### Run tests (expect most to fail)
\`\`\`bash
${dockerCmd} exec tb3-nop-${task} pytest /tests/test_state.py -v --tb=short 2>&1
\`\`\`

### Check reward (should be 0)
\`\`\`bash
${dockerCmd} exec tb3-nop-${task} bash /tests/test.sh
${dockerCmd} exec tb3-nop-${task} cat /logs/verifier/reward.txt
\`\`\`

## Output
Write to \`{{SESSION_DIR}}/nop-result.json\`:
\`\`\`json
{
  "status": "expected_fail",
  "total_tests": 50,
  "passed": <n>,
  "failed": <n>,
  "passed_tests": ["test_name", ...],
  "reward": "0",
  "concern": "too_many_pass" | "acceptable",
  "output": "<truncated test output>"
}
\`\`\`

If more than 10 tests pass without the solution, flag concern as "too_many_pass".`;
}

function agentTrialSeed(taskDir: string, task: string, dockerCmd: string, _sshPrefix: string): string {
  return `You are the blind agent trial runner for benchmark task "${task}".

## Task
A fresh container is running with the benchmark environment. Read ONLY the
instruction.md (NOT solution/ or tests/) and attempt to solve the task.
You have 30 minutes.

## Rules
- Do NOT read ${taskDir}/solution/ or ${taskDir}/tests/
- Only read ${taskDir}/instruction.md for the task description
- Execute commands inside the container: \`${dockerCmd} exec tb3-trial-${task} ...\`
- You ARE the agent being tested—solve the benchmark task as described

## Setup

### Wait for trial container
\`\`\`bash
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-trial-${task} 2>&1 | grep -q "Environment ready"; then
    echo "Trial container ready"
    break
  fi
  sleep 2
done
\`\`\`

### Read the instruction
\`\`\`bash
cat ${taskDir}/instruction.md
\`\`\`

## Execution
Follow the instructions in instruction.md. Execute all commands inside the
container using \`${dockerCmd} exec tb3-trial-${task} ...\`.

## After solving (or time limit)
Copy tests and run them to measure your score:
\`\`\`bash
${dockerCmd} exec tb3-trial-${task} mkdir -p /tests /logs/verifier
${dockerCmd} cp ${taskDir}/tests/test_state.py tb3-trial-${task}:/tests/test_state.py
${dockerCmd} cp ${taskDir}/tests/test.sh tb3-trial-${task}:/tests/test.sh
${dockerCmd} exec tb3-trial-${task} chmod +x /tests/test.sh
${dockerCmd} exec tb3-trial-${task} pytest /tests/test_state.py -v --tb=short 2>&1
${dockerCmd} exec tb3-trial-${task} bash /tests/test.sh
${dockerCmd} exec tb3-trial-${task} cat /logs/verifier/reward.txt
\`\`\`

## Output
Write to \`{{SESSION_DIR}}/trial-result.json\`:
\`\`\`json
{
  "status": "solved" | "partial" | "failed",
  "total_tests": 50,
  "passed": <n>,
  "failed": <n>,
  "failed_tests": ["test_name", ...],
  "reward": "1" | "0",
  "blockers": ["description of what blocked progress", ...],
  "time_spent_min": <minutes>,
  "approach_summary": "<brief description of approach taken>"
}
\`\`\``;
}

function evaluateSeed(_taskDir: string, task: string, skipTrial: boolean): string {
  const trialSection = skipTrial ? "" : `
### Agent trial results
Read \`{{SESSION_DIR}}/trial-result.json\`.

Classify the agent outcome:
- **Solved correctly**: Agent got ≥45/50 tests passing through legitimate Ranger setup
- **Partial solve**: Agent got some tests but hit legitimate difficulty (Ranger bugs)
- **Failed—task bug**: Agent failed because instruction was ambiguous or environment broken
- **Failed—legitimate**: Agent failed because the task is genuinely hard
- **Reward hack**: Agent found a shortcut that tests didn't catch`;

  return `You are the evaluator for benchmark task "${task}".

## Task
Review all result files and classify the overall outcome.

## Inputs

### Oracle results
Read \`{{SESSION_DIR}}/oracle-result.json\`.
- Oracle MUST pass 50/50. If not, the solution is broken—report TASK_BUG.

### Nop results
Read \`{{SESSION_DIR}}/nop-result.json\`.
- Nop should fail majority of tests. If >10 pass without solution, tests need hardening.
${trialSection}

## Classification

Write \`{{SESSION_DIR}}/verdict.txt\` with one of:
- \`VERIFIED\` — Oracle 50/50 + nop fails + agent either solved correctly or failed for legitimate reasons
- \`TASK_BUG\` — Oracle failed OR agent failed due to ambiguity/env issues
- \`REWARD_HACK\` — Agent found shortcut not caught by tests

Write \`{{SESSION_DIR}}/score.txt\`:
- \`1\` if VERIFIED
- \`0\` if TASK_BUG or REWARD_HACK

## Report
Write \`{{SESSION_DIR}}/report.md\` with:
- Oracle results summary (pass/fail counts)
- Nop results summary + concern flags
${skipTrial ? "" : "- Agent trial summary (approach, blockers, outcome)"}
- Final verdict with reasoning
- Recommendations for test hardening (if any)

## Output
\`\`\`bash
echo "VERIFIED" > "{{SESSION_DIR}}/verdict.txt"   # or TASK_BUG or REWARD_HACK
echo 1 > "{{SESSION_DIR}}/score.txt"               # or 0
\`\`\``;
}
