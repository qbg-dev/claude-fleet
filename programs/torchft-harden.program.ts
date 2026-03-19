/**
 * Torchft CIFAR-10 Hardening Pipeline — iterative test hardening via adversarial agents.
 *
 * Graph:
 *   attempt → analyze-harden ──→ attempt (cycle if round < N)
 *                              └→ $end   (all rounds complete)
 *
 * Attempt phase: Sonnet solves the torchft-cifar10 task from scratch in Docker.
 * Analyze phase: Opus reviews results, classifies failures, hardens tests/instruction.
 *
 * Usage:
 *   fleet pipeline torchft-harden --set rounds=5
 *   fleet pipeline torchft-harden --set rounds=3
 *   fleet pipeline torchft-harden --set skipOracle=true
 *   fleet pipeline torchft-harden --dry-run
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface TorchftHardenOpts {
  rounds?: number;
  skipOracle?: boolean;
  scope?: string;
  spec?: string;
}

const TASK_DIR = "/Users/wz/zPersonalProjects/terminal-bench-3/tasks/torchft-cifar10";
const PROJECT_ROOT = "/Users/wz/zPersonalProjects/terminal-bench-3";

export default function torchftHarden(opts: TorchftHardenOpts): Program {
  const rounds = opts.rounds || 5;
  const skipOracle = opts.skipOracle || false;

  const g = graph(
    "torchft-harden",
    `Iterative test hardening for torchft-cifar10 (${rounds} rounds)`,
  )
    .node("attempt", {
      description: "Agent solves the torchft-cifar10 task in a fresh Docker container",
      agents: [
        {
          name: "agent-solver",
          role: "solver",
          model: "sonnet",
          seed: { inline: solverSeed() },
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
        seed: { inline: hardenerSeed(skipOracle) },
        window: "analyze",
      }],
      prelaunch: [
        { type: "parse-output", agent: "agent-solver", file: "round-results.json" },
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
      spec: opts.spec || `Harden torchft-cifar10 benchmark tests across ${rounds} rounds`,
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

export function parse_agent_solver_output(state: any): void {
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "round-results.json");
  if (fs.existsSync(resultsPath)) {
    if (!state.ext) state.ext = {};
    state.ext.roundResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

// ── Seed generators ────────────────────────────────────────────────────

function solverSeed(): string {
  return `You are a benchmark executor for the torchft-cifar10 task.

## Project
\`${PROJECT_ROOT}\` — a benchmark where an agent must implement fault-tolerant data-parallel CIFAR-10 training with heartbeat-based failure detection and quorum-based blocking all-reduce.

## Rules
- Do NOT look at \`${TASK_DIR}/solution/\` or \`${TASK_DIR}/tests/\` — you are testing the agent
- Build a fresh Docker container each round
- Spawn the solving agent via Claude Agent SDK
- After the agent finishes (or times out), run the test suite to grade

## Task

### Step 1: Read round number
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
\`\`\`

### Step 2: Build fresh Docker environment
\`\`\`bash
docker rm -f torchft-harden-r$ROUND 2>/dev/null || true
docker build -t torchft-v2 ${TASK_DIR}/environment/ 2>&1 | tail -5
docker run -d --name torchft-harden-r$ROUND --cpus=4 --memory=8g torchft-v2 sleep infinity
\`\`\`

### Step 3: Write and run the Agent SDK script
Write a TypeScript file that uses the Claude Agent SDK to spawn a solving agent. The agent gets the instruction and must create \`/app/train.py\` inside the container, then run \`bash /app/run.sh\`.

\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
INSTRUCTION=$(cat ${TASK_DIR}/instruction.md)

cat > /tmp/torchft-agent-runner.ts << 'AGENTEOF'
import { query } from "@anthropic-ai/claude-code";
import * as fs from "fs";

const round = process.env.ROUND || "1";
const instruction = process.env.INSTRUCTION || "";
const container = "torchft-harden-r" + round;
const sessionDir = process.env.SESSION_DIR || "/tmp";

const startTime = Date.now();
const messages: string[] = [];

async function main() {
  console.log(\`Spawning Sonnet agent for round \${round}...\`);

  for await (const message of query({
    prompt: \`You are solving a benchmark task inside a Docker container.

IMPORTANT: Execute ALL commands using this prefix:
docker exec \${container} bash -c '<your command here>'

For multi-line scripts, write them to a file first:
docker exec \${container} bash -c 'cat > /app/train.py << "PYEOF"
<python content>
PYEOF'

Then run: docker exec \${container} bash /app/run.sh

Here is the task:

\${instruction}

Solve it step by step. Create /app/train.py inside the container, then run bash /app/run.sh.\`,
    options: {
      model: "claude-sonnet-4-20250514",
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash", "Read", "Write", "Edit"],
      maxTurns: 80,
      effort: "high",
    }
  })) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content as any[]) {
        if ("text" in block) {
          messages.push(block.text);
          console.log("Agent:", block.text.slice(0, 200));
        } else if ("name" in block) {
          console.log(\`[Tool] \${block.name}\`);
        }
      }
    }
    if (message.type === "result") {
      const elapsed = Math.round((Date.now() - startTime) / 60000);
      console.log(\`\\nAgent finished: \${message.subtype}, \${elapsed} min, \${message.num_turns} turns, $\${message.total_cost_usd}\`);
      fs.writeFileSync(
        \`\${sessionDir}/agent-transcript-r\${round}.json\`,
        JSON.stringify({ subtype: message.subtype, turns: message.num_turns, cost: message.total_cost_usd, elapsed_min: elapsed, messages }, null, 2)
      );
    }
  }
}

main().catch(err => {
  console.error("Agent SDK error:", err);
  process.exit(1);
});
AGENTEOF

# Run the Agent SDK script with env vars (timeout 20 min — training takes ~8 min)
ROUND=$ROUND INSTRUCTION="$INSTRUCTION" SESSION_DIR="{{SESSION_DIR}}" \\
  timeout 1200 bun /tmp/torchft-agent-runner.ts 2>&1 | tee "{{SESSION_DIR}}/agent-sdk-log-r$ROUND.txt"
echo "Agent SDK script exited with code $?"
\`\`\`

### Step 4: Run test suite
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
CONTAINER="torchft-harden-r$ROUND"
docker exec $CONTAINER mkdir -p /tests /logs/verifier
docker cp ${TASK_DIR}/tests/test_state.py $CONTAINER:/tests/test_state.py
docker cp ${TASK_DIR}/tests/test.sh $CONTAINER:/tests/test.sh
docker exec $CONTAINER chmod +x /tests/test.sh
TEST_OUTPUT=$(docker exec $CONTAINER pytest /tests/test_state.py -v --tb=short 2>&1)
echo "$TEST_OUTPUT"
REWARD=$(docker exec $CONTAINER bash -c '/tests/test.sh && cat /logs/verifier/reward.txt' 2>&1)
echo "Reward: $REWARD"
\`\`\`

### Step 5: Write consolidated results
Parse the pytest output and write to \`{{SESSION_DIR}}/round-results.json\`:
\`\`\`json
{
  "round": 1,
  "timestamp": "2026-03-15T12:00:00Z",
  "agent": "sonnet-sdk",
  "container": "torchft-harden-r1",
  "reward": "1" or "0",
  "tests": {
    "total": 10,
    "passed": 8,
    "failed": 2
  },
  "failed_tests": [
    {"name": "test_model_accuracy", "reason": "accuracy 0.7234 < 0.80"},
    ...
  ],
  "agent_blockers": ["description of what blocked the agent", ...],
  "time_spent_min": 12
}
\`\`\`

### Step 6: Print summary and cleanup
Print a pass/fail table:
\`\`\`
Round 1 Results:
Test                                    Result
test_model_file_exists                  PASS
test_model_is_valid_state_dict          PASS
test_model_accuracy                     FAIL (0.72 < 0.80)
test_infrastructure_integrity           PASS
test_chaos_log_shows_sustained_kills    PASS
test_heartbeat_files_from_multiple_workers  PASS
test_sync_directory_has_multiple_epochs  PASS
test_sync_epochs_have_quorum_artifacts  PASS
test_sync_parameters_diverge_then_converge  PASS
test_training_log_shows_failures_and_restarts  PASS
Overall: 9/10 (reward: 0)
\`\`\`

Clean up the container:
\`\`\`bash
docker rm -f torchft-harden-r$ROUND 2>/dev/null || true
\`\`\``;
}

function hardenerSeed(skipOracle: boolean): string {
  const oracleSection = skipOracle ? "" : `
### Phase 2a: Run oracle verification
Verify the reference solution still passes all 10 tests:
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
docker rm -f torchft-oracle-verify 2>/dev/null || true
docker build -t torchft-v2 ${TASK_DIR}/environment/ 2>&1 | tail -3
docker run --rm --cpus=4 --memory=8g \\
  -v ${TASK_DIR}/solution:/solution:ro -v ${TASK_DIR}/tests:/tests:ro \\
  torchft-v2 bash -c "bash /solution/solve.sh && mkdir -p /logs/verifier && bash /tests/test.sh && echo REWARD=$(cat /logs/verifier/reward.txt)" 2>&1
\`\`\`
If oracle fails after your changes, revert the broken change and try a different approach.`;

  return `You are the benchmark hardener for the torchft-cifar10 task.

## Project
\`${PROJECT_ROOT}\` — a benchmark where an agent must implement fault-tolerant data-parallel CIFAR-10 training. 10 tests verify model accuracy, heartbeat mechanism, quorum-based sync, parameter convergence, chaos resilience, and infrastructure integrity.

## Context
A Sonnet agent just attempted to solve the torchft-cifar10 task from scratch. Results are in:
- \`{{SESSION_DIR}}/round-results.json\`
- \`{{SESSION_DIR}}/agent-transcript-r{N}.json\` (agent's execution log)

## Your analysis workflow

### Phase 1: Read results
Read \`{{SESSION_DIR}}/round-results.json\` and the agent transcript. Build a picture of what the agent did and where it failed.

### Phase 2: Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **convergence_issue** | Agent's training approach doesn't reach 80% accuracy (wrong LR, no all-reduce, bad architecture choice) | No action—legitimate difficulty |
| **instruction_ambiguity** | Agent misunderstood what to do because instruction.md was unclear | Fix instruction.md |
| **test_bug** | Test checks wrong condition, too strict, or relies on implementation detail | Fix test_state.py |
| **env_issue** | Container OOM, timing issue, Docker problem | Fix Dockerfile or run.sh constants |
| **reward_hack** | Agent found shortcut (e.g., pretrained weights, skipping training, faking sync artifacts) | Harden tests |

Guidelines:
- If agent trained but accuracy is 70-79% → **convergence_issue** (they need better sync/hyperparams)
- If agent didn't implement heartbeat because instruction wasn't clear → **instruction_ambiguity**
- If agent trained correctly but test_sync_parameters_diverge_then_converge fails due to timing → **test_bug**
- If agent downloaded pretrained weights or copied model from /data → **reward_hack**
- If agent created fake heartbeat/sync files without real training → **reward_hack**
- If agent modified run.sh/chaos.sh/model.py → test_infrastructure_integrity should catch this
${oracleSection}

### Phase 3: Fix issues
For each instruction_ambiguity/test_bug/env_issue/reward_hack:

1. Read the relevant file:
   - \`${TASK_DIR}/instruction.md\` — for instruction issues
   - \`${TASK_DIR}/tests/test_state.py\` — for test issues
   - \`${TASK_DIR}/environment/Dockerfile\` — for env issues
   - \`${TASK_DIR}/solution/solve.sh\` — verify solution still works with changes

2. Make targeted fixes:
   - **instruction_ambiguity**: Add clarity without giving away the solution. Mention what to do, not how.
   - **test_bug**: Fix the condition. Don't couple tests to implementation details.
   - **env_issue**: Fix resource limits, timeouts, or startup.
   - **reward_hack**: Add tests that verify real training happened (e.g., check model weights aren't from a pretrained source, verify training loss decreases, check sync files contain real divergent states).

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
| Test | Result | Category |
|------|--------|----------|
| test_model_file_exists | PASS | — |
| test_model_accuracy | FAIL (0.72) | convergence_issue |
| ... |

## Issues Found

### Convergence Issues (legitimate difficulty — no action)
- Agent averaged parameters but not optimizer state, causing momentum divergence

### Instruction Ambiguity (fixed)
- instruction.md didn't specify minimum quorum size clearly

### Test Bugs (fixed)
- test_sync timing too strict for slow containers

### Reward Hacks (hardened)
- Agent downloaded pretrained ResNet and finetuned — added weight-shape anti-cheat test

## Changes Made
- instruction.md: Added explicit quorum requirement
- test_state.py: Added anti-pretrained-weight check
- solve.sh: No changes needed
\`\`\`

### Phase 6: Commit changes
\`\`\`bash
cd ${PROJECT_ROOT}
git add tasks/torchft-cifar10/
git commit -m "torchft-cifar10: round \${ROUND} hardening based on agent performance"
\`\`\`

## Key principles
- **Outcome-only**: Tests check training artifacts and model quality, never agent behavior
- A test bug means the test is wrong, not the agent
- Don't over-harden—if the agent fails because distributed training is genuinely hard, that's the point
- Each round should reduce false positives/negatives while maintaining fairness
- The hidden difficulty IS getting 4 workers to converge with chaos kills—don't hint at optimizer state sync
- Always verify the reference solution still passes after changes`;
}
