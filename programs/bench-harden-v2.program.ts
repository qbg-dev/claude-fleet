/**
 * Bench Harden v2 — unified multi-benchmark hardening pipeline.
 *
 * Synthesizes the best features from greenfield-harden, tb3-harden, and torchft-harden:
 *   - 3-node graph with expand phase (greenfield)
 *   - Docker on remote host via SSH (tb3)
 *   - Oracle verification (tb3/torchft)
 *   - Agent SDK for solver agents (tb3/torchft)
 *   - Token rotation from oauth-tokens.md (new)
 *   - Cross-round memory via stable-passes.json (new)
 *   - Convention checks (new)
 *
 * Graph:
 *   attempt → analyze-harden ──→ attempt     (if issues found)
 *                              └→ expand      (if converged: 2 clean rounds)
 *                              └→ $end        (if paused or max rounds)
 *   expand → attempt                          (new complexity, re-harden)
 *
 * Usage:
 *   fleet pipeline bench-harden-v2 --set benchmark=greenfield --set benchDir=/Users/wz/Desktop/qbg/greenfield-bench --set host=52.32.15.150
 *   fleet pipeline bench-harden-v2 --set benchmark=tb3-ranger --set benchDir=/Users/wz/zPersonalProjects/terminal-bench-3 --set host=5.161.107.142
 *   fleet pipeline bench-harden-v2 --set benchmark=torchft-cifar10 --set benchDir=/Users/wz/zPersonalProjects/terminal-bench-3 --set host=52.32.15.150
 *   fleet pipeline bench-harden-v2 --dry-run --set benchmark=greenfield --set benchDir=/Users/wz/Desktop/qbg/greenfield-bench
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface BenchHardenV2Opts {
  benchmark: string;       // "greenfield" | "tb3-ranger" | "torchft-cifar10"
  benchDir: string;        // local path to benchmark repo
  host?: string;           // remote host for Docker (SSH)
  sshUser?: string;        // SSH user (default: "root"; use "ec2-user" for EC2)
  rounds?: number;         // max rounds (default: 50)
  dockerImage?: string;    // Docker image name override
  skipOracle?: boolean;    // skip oracle verification
  skipExpand?: boolean;    // skip expand phase (2-node only)
  scope?: string;
  spec?: string;
}

// ── Token rotation ──────────────────────────────────────────────
// Read at compile time from oauth-tokens.md — no hardcoded tokens
const TOKEN_FILE = `${process.env.HOME}/.claude/sensitive/oauth-tokens.md`;

function readOAuthTokens(): string[] {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(TOKEN_FILE, "utf-8");
    const tokens: string[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("sk-ant-oat01-")) {
        tokens.push(trimmed);
      }
    }
    return tokens;
  } catch {
    console.error(`Warning: Could not read ${TOKEN_FILE}, using empty token list`);
    return [];
  }
}

// ── Per-benchmark configuration ─────────────────────────────────

interface BenchConfig {
  taskDir: string;           // directory containing the task (instruction, tests, solution)
  imageName: string;         // Docker image name
  containerPrefix: string;   // container name prefix
  envReadyMarker?: string;   // grep pattern for container readiness
  hasSolution: boolean;      // whether oracle solution exists
  solutionPath?: string;     // path to solution script (relative to taskDir)
  testCmd: string;           // command to run tests inside container
  cpus: number;
  memory: string;
  agentTimeout: number;      // seconds
  maxTurns: number;
  runnerSeedFn: (cfg: BenchConfig, host: string, dockerCmd: string, tokens: string[], sshUser: string) => string;
  hardenerSeedFn: (cfg: BenchConfig, host: string, dockerCmd: string, skipOracle: boolean, sshUser: string) => string;
  expanderSeedFn?: (cfg: BenchConfig) => string;
}

function getBenchConfig(benchmark: string, benchDir: string): BenchConfig {
  switch (benchmark) {
    case "greenfield":
      return greenfieldConfig(benchDir);
    case "tb3-ranger":
      return tb3RangerConfig(benchDir);
    case "torchft-cifar10":
      return torchftConfig(benchDir);
    default:
      throw new Error(`Unknown benchmark: ${benchmark}. Expected: greenfield, tb3-ranger, torchft-cifar10`);
  }
}

// ── Main program factory ────────────────────────────────────────

export default function benchHardenV2(opts: BenchHardenV2Opts): Program {
  if (!opts.benchmark) throw new Error("--set benchmark=<name> is required");
  if (!opts.benchDir) throw new Error("--set benchDir=<path> is required");

  const rounds = opts.rounds || 50;
  const host = opts.host || "52.32.15.150";
  const sshUser = opts.sshUser || "ec2-user";
  const skipOracle = opts.skipOracle || false;
  const skipExpand = opts.skipExpand || false;
  const tokens = readOAuthTokens();
  const cfg = getBenchConfig(opts.benchmark, opts.benchDir);
  if (opts.dockerImage) cfg.imageName = opts.dockerImage;

  // EC2 instances use ec2-user with sudo; Hetzner/bare-metal use root
  const sshPrefix = `ssh ${sshUser}@${host}`;
  const dockerCmd = sshUser === "root" ? `${sshPrefix} docker` : `${sshPrefix} sudo docker`;

  const g = graph(
    `bench-harden-v2-${opts.benchmark}`,
    `Unified hardening pipeline for ${opts.benchmark} (${rounds} rounds, host: ${host})`,
  )
    // ── Node 1: attempt — build container, run solver, collect results ──
    .node("attempt", {
      description: `Run ${opts.benchmark} solver in fresh Docker container on ${host}`,
      agents: [{
        name: "runner",
        role: "executor",
        model: "sonnet",
        seed: { inline: cfg.runnerSeedFn(cfg, host, dockerCmd, tokens, sshUser) },
        window: "attempt",
      }],
    })
    // ── Node 2: analyze-harden — classify failures, fix issues ──
    .node("analyze-harden", {
      description: "Analyze failures, run oracle, classify issues, harden tests/verifiers",
      agents: [{
        name: "hardener",
        role: "analyst",
        model: "opus[1m]",
        seed: { inline: cfg.hardenerSeedFn(cfg, host, dockerCmd, skipOracle, sshUser) },
        window: "analyze",
      }],
      prelaunch: [
        { type: "parse-output", agent: "runner", file: "round-results.json" },
      ],
    });

  // ── Node 3: expand (optional) ──
  if (!skipExpand && cfg.expanderSeedFn) {
    g.node("expand", {
      description: `Expand ${opts.benchmark} complexity using real-world patterns`,
      agents: [{
        name: "expander",
        role: "architect",
        model: "opus[1m]",
        seed: { inline: cfg.expanderSeedFn(cfg) },
        window: "expand",
      }],
    });
  }

  // ── Edges ──
  // attempt → analyze (always)
  g.edge("attempt", "analyze-harden");

  // analyze → attempt (cycle back if NOT converged)
  g.edge("analyze-harden", "attempt", {
    condition: `! test -f "{{SESSION_DIR}}/converged.flag"`,
    maxIterations: rounds,
    label: "issues found, more rounds needed",
  });

  if (!skipExpand && cfg.expanderSeedFn) {
    // analyze → expand (if converged: 2 consecutive clean rounds)
    g.edge("analyze-harden", "expand", {
      condition: `test -f "{{SESSION_DIR}}/converged.flag"`,
      label: "converged — expand complexity",
      priority: 0,
    });

    // expand → attempt (new complexity added, re-harden)
    g.edge("expand", "attempt", {
      maxIterations: 5,
      label: "new complexity added, re-harden",
    });

    // expand → $end (max expansions)
    g.edge("expand", "$end", {
      label: "max expansions reached",
      priority: 1,
    });
  }

  // analyze → $end (max iterations safety valve)
  g.edge("analyze-harden", "$end", {
    label: "max iterations or converged (no expand)",
    priority: 2,
  });

  g.defaults({
    model: "sonnet[1m]",
    effort: "high",
    permission: "bypassPermissions",
  })
  .material({
    scope: opts.scope,
    spec: opts.spec || `Unified hardening for ${opts.benchmark} (max ${rounds} rounds, host: ${host})`,
  });

  const built = g.build();

  return {
    name: built.name,
    description: built.description,
    phases: [],
    defaults: built.defaults,
    material: built.material,
    graph: built,
  };
}

// ── Parse output handlers ──────────────────────────────────────────────

export function parse_runner_output(state: any): void {
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "round-results.json");
  if (fs.existsSync(resultsPath)) {
    if (!state.ext) state.ext = {};
    state.ext.roundResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

// ══════════════════════════════════════════════════════════════════════
// ── GREENFIELD CONFIG ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

function greenfieldConfig(benchDir: string): BenchConfig {
  const CASES = [
    "case_01_complaint_escalation", "case_02_fee_collection",
    "case_03_work_order_routing", "case_04_lease_renewal",
    "case_05_bi_dashboard", "case_06_parking_flood",
    "case_07_billing_dispute", "case_08_new_property",
    "case_09_restaurant_conflict", "case_10_anomaly_detection",
    "case_11_access_control",
  ];

  return {
    taskDir: benchDir,
    imageName: "greenfield-bench",
    containerPrefix: "greenfield-harden",
    hasSolution: false,
    testCmd: "python -m agents.runner.main",
    cpus: 2,
    memory: "4g",
    agentTimeout: 2400,
    maxTurns: 30,

    runnerSeedFn: (cfg, host, dockerCmd, tokens, sshUser) => {
      const tokenArray = tokens.map((t, i) => `TOKENS[${i}]="${t}"`).join("\n");
      const caseEntries = CASES.map((c, i) => `  - ${c} (token idx: ${i % tokens.length})`).join("\n");

      return `You are a benchmark executor for the greenfield-bench hotel management benchmark.

## Project
\`${benchDir}\` — a benchmark with ${CASES.length} hotel management cases, each with 3 cascading checkpoints. Cases are solved by a Claude Code SDK agent that can only use MCP tools (hotel_db, guest_services, comms, documents, admin).

## Remote host
Docker runs on \`${host}\` (SSH user: ${sshUser}). All Docker commands use: \`${dockerCmd}\`

## Rules
- Run all cases sequentially — each spawns a Claude Code SDK agent internally
- Do NOT modify any benchmark files (cases, verifiers, MCP servers) — only run them
- **Token rotation**: Set CLAUDE_CODE_OAUTH_TOKEN before each case to distribute API load

## Task

### Step 1: Read round number + stable passes
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
# Read stable passes from previous rounds
cat "{{SESSION_DIR}}/stable-passes.json" 2>/dev/null || echo "{}"
\`\`\`

### Step 2: Sync benchmark to remote + build Docker image
\`\`\`bash
rsync -az --delete ${benchDir}/ ${sshUser}@${host}:/tmp/greenfield-bench/
${dockerCmd} build -t ${cfg.imageName} /tmp/greenfield-bench/ 2>&1 | tail -5
\`\`\`

### Step 3: Run each case with token rotation
Cases to run:
${caseEntries}

**Token rotation setup:**
\`\`\`bash
${tokenArray}
\`\`\`

For each case (index I, 0-based):
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
CONTAINER="${cfg.containerPrefix}-r$ROUND-caseI"

# Start fresh container for this case
${dockerCmd} rm -f $CONTAINER 2>/dev/null || true
${dockerCmd} run -d --name $CONTAINER --cpus=${cfg.cpus} --memory=${cfg.memory} ${cfg.imageName} sleep infinity

# Set token and run case
export CLAUDE_CODE_OAUTH_TOKEN="\${TOKENS[$((I % ${tokens.length}))]}"
${dockerCmd} exec -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" $CONTAINER \\
  python -m agents.runner.main --case {CASE_NAME} --cascade --model claude-sonnet-4-20250514 --max-turns ${cfg.maxTurns}

# Collect results
${dockerCmd} cp $CONTAINER:/app/results/{CASE_NAME}/ "{{SESSION_DIR}}/results/{CASE_NAME}/" 2>/dev/null || true
${dockerCmd} rm -f $CONTAINER
\`\`\`

Run them one at a time. After each case completes, note the output.

**Rate limit handling**: If a case fails with rate_limit, wait 60s and retry with the next token.

### Step 4: Collect grade results
For each case, read the grade.json files from checkpoint directories (cp1/, cp2/, cp3/) in the results.

### Step 5: Write consolidated results
Write to \`{{SESSION_DIR}}/round-results.json\`:
\`\`\`json
{
  "round": 1,
  "benchmark": "greenfield",
  "timestamp": "2026-03-16T12:00:00Z",
  "host": "${host}",
  "cases": {
    "case_01_complaint_escalation": {
      "pass": true,
      "checkpoints": {
        "1": {"passed": true, "passed_count": 3, "total_count": 3, "results": [...]},
        "2": {"passed": true, "passed_count": 2, "total_count": 2, "results": [...]},
        "3": {"passed": false, "passed_count": 1, "total_count": 3, "results": [...]}
      }
    }
  },
  "summary": {
    "total_cases": ${CASES.length},
    "passed": 8,
    "failed": 3,
    "failed_cases": ["case_05_bi_dashboard", ...]
  }
}
\`\`\`

A case passes only if ALL its checkpoints pass. Include the full \`results\` array from each grade.json.

### Step 6: Update stable passes
Read previous stable-passes.json. A case is "stable" if it passed this round AND the previous round.
\`\`\`bash
# Write updated stable-passes.json
\`\`\`

### Step 7: Print summary table`;
    },

    hardenerSeedFn: (cfg, _host, _dockerCmd, _skipOracle) => {
      return `You are the benchmark hardener for greenfield-bench, a hotel management benchmark with outcome-only verifiers.

## Project
\`${cfg.taskDir}\` — ${CASES.length} cases × 3 cascading checkpoints. Agent uses 5 MCP servers (hotel_db, guest_services, comms, documents, admin). Verifiers check database state and files — never agent internals.

## Context
A Sonnet agent just ran all benchmark cases. Results are in:
- \`{{SESSION_DIR}}/round-results.json\`

## Conventions
Check \`/Users/wz/Desktop/qbg/conventions/\` for benchmark design conventions before making changes.

## Known patterns from prior rounds

### Free-form field mismatches
Verifiers checking free-form text (report_type, subject, description, recipient_name) with exact matching fail on reasonable but non-identical wording. **Fix**: Use SQL LIKE patterns.
- \`report_type = 'legal'\` → \`report_type LIKE '%legal%'\`
- \`recipient_name = 'Smith'\` → \`recipient_name LIKE '%Smith%'\`

### Missing MCP tool operations
Verifiers checking for operations the MCP servers don't support always fail. Before marking as capability failure, verify the write operation exists.

### Underspecified checkpoint context
Checkpoint user_messages that don't explicitly request the output format the verifier checks for. **Fix**: Add explicit instructions.

### Name variance
Agent may write "John Smith", "J. Smith", "Mr. Smith". **Fix**: Use \`%LastName%\` LIKE patterns.

## Analysis workflow

### Phase 1: Read results
Read \`{{SESSION_DIR}}/round-results.json\`. Build a case × checkpoint pass/fail matrix.

### Phase 2: Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **capability** | Agent timeout, wrong approach | No action — legitimate difficulty |
| **task_design** | Checkpoint instructions ambiguous, MCP tools don't support required action | Fix checkpoint JSON |
| **verifier_bug** | Wrong conditions, too strict/loose, checks wrong column | Fix verifiers.json |
| **reward_hack** | Agent gamed verifiers without doing real work | Harden verifiers |
| **infra** | Container/rate-limit/network issue | Note for runner fixes |

### Phase 3: Verify MCP server capabilities
\`\`\`bash
grep -rn "action" ${cfg.taskDir}/environment/mcp_servers/*/mcp_servers/*/main.py
\`\`\`

Known server audit_log actions:
- **admin**: permission_check, get_access_policy, policy_update, audit_query, get_employee, list_employees
- **guest_services**: CREATE, identity_verification, QUERY
- **documents**: create_report, draft_notice, create_spreadsheet, read_template, list_templates
- **comms**: send_email, send_notice, log_call, get_inbox, get_sent
- **hotel_db**: QUERY, SCHEMA_BROWSE

### Phase 4: Fix issues
For each task_design/verifier_bug/reward_hack:
1. Read the verifier file: \`${cfg.taskDir}/cases/{case}/verifiers.json\`
2. Read checkpoint if needed: \`${cfg.taskDir}/cases/{case}/checkpoint_{N}.json\`
3. Make targeted fixes (LIKE patterns, loosen/tighten conditions, clarify user_message)

### Phase 5: Track convergence
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"

CLEAN=$(cat "{{SESSION_DIR}}/clean-rounds.txt" 2>/dev/null || echo 0)
\`\`\`

If NO verifier_bug or task_design fixes needed: increment clean counter.
If fixes were needed: reset to 0.

**Convergence**: 2 consecutive clean rounds → create \`{{SESSION_DIR}}/converged.flag\`.

### Phase 6: Write report
Write to \`{{SESSION_DIR}}/harden-report-r\${ROUND}.md\` with pass/fail matrix, classified issues, changes made, convergence status.

### Phase 7: Commit changes
\`\`\`bash
cd ${cfg.taskDir}
git add cases/
git commit -m "Round \${ROUND}: harden greenfield-bench verifiers"
\`\`\`

## Key principles
- **Outcome-only**: Verifiers check database state and files, never agent behavior
- LIKE patterns for all free-form text field verifiers
- Check MCP server source before assuming an action string exists
- Don't over-harden — capability failures are legitimate difficulty`;
    },

    expanderSeedFn: (cfg) => {
      return `You are the complexity expander for greenfield-bench, a hotel management benchmark.

## Context
The benchmark has converged — 2 consecutive clean hardening rounds. All remaining failures are legitimate capability gaps. Your job is to make the benchmark harder with real-world complexity.

## Reference Materials
1. **Current results**: \`{{SESSION_DIR}}/round-results.json\`
2. **Existing cases**: \`${cfg.taskDir}/cases/\`
3. **Conventions**: \`/Users/wz/Desktop/qbg/conventions/BENCHMARK-CREATION.md\`

## Expansion Strategies (choose 1-2 per cycle)

### 1. Multi-tenant stress
Add cases requiring cross-property operations with access control boundaries.

### 2. Long-context pressure
Add cases requiring 50+ tool calls and recall of earlier information.

### 3. Noise injection
Add misleading data, similar guest names, deleted/expired records.

### 4. State consistency
Add cases where later checkpoints must undo/modify earlier work.

### 5. Human handoff simulation
Add cases where the agent must recognize when to escalate vs. handle autonomously.

## Implementation
For each new case:
1. Create directory: \`${cfg.taskDir}/cases/case_NN_descriptive_name/\`
2. Write checkpoint_1.json, checkpoint_2.json, checkpoint_3.json
3. Write verifiers.json with outcome-only checks
4. Use LIKE patterns for all free-form text fields from the start
5. Verify all checked operations have MCP tool support

After expansion:
\`\`\`bash
rm -f "{{SESSION_DIR}}/converged.flag"
echo 0 > "{{SESSION_DIR}}/clean-rounds.txt"
cd ${cfg.taskDir}
git add cases/
git commit -m "Expand: add real-world complexity ($(date +%Y-%m-%d))"
\`\`\`

Write expansion report to \`{{SESSION_DIR}}/expansion-report.md\`.`;
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// ── TB3 RANGER CONFIG ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

function tb3RangerConfig(benchDir: string): BenchConfig {
  const TASK = "ranger-provisioning-service";
  const taskDir = `${benchDir}/tasks/${TASK}`;

  return {
    taskDir,
    imageName: "tb3-harden",
    containerPrefix: "tb3-harden",
    envReadyMarker: "Environment ready",
    hasSolution: true,
    solutionPath: "solution/solve.sh",
    testCmd: "pytest /tests/test_state.py -v --tb=short",
    cpus: 2,
    memory: "6g",
    agentTimeout: 2400,
    maxTurns: 100,

    runnerSeedFn: (cfg, host, dockerCmd, tokens, sshUser) => {
      const syncCmd = `rsync -az ${cfg.taskDir}/environment/ ${sshUser}@${host}:/tmp/tb3-harden-env/`;
      const tokenRotation = tokens.length > 0
        ? `export CLAUDE_CODE_OAUTH_TOKEN="${tokens[0]}"`
        : `# No tokens available`;

      return `You are a benchmark executor for the TB3 Ranger migration task.

## Project
\`${benchDir}\` — a benchmark where an agent must migrate a StarRocks analytics platform from view-based tenant isolation to Apache Ranger row-level security.

## Rules
- Do NOT look at \`${cfg.taskDir}/solution/\` or \`${cfg.taskDir}/tests/\` — you are testing the agent
- Build a fresh Docker container each round on remote host \`${host}\`
- Spawn the solving agent via Claude Agent SDK (NOT the CLI)
- After the agent finishes (or times out), run the test suite to grade

## Task

### Step 1: Read round number
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
\`\`\`

### Step 2: Build fresh Docker environment
\`\`\`bash
${syncCmd}
${dockerCmd} rm -f ${cfg.containerPrefix}-r$ROUND 2>/dev/null || true
${dockerCmd} build -t ${cfg.imageName} /tmp/tb3-harden-env 2>&1 | tail -5
${dockerCmd} run -d --name ${cfg.containerPrefix}-r$ROUND --cpus=${cfg.cpus} --memory=${cfg.memory} ${cfg.imageName}
\`\`\`

### Step 3: Wait for container ready
\`\`\`bash
for i in $(seq 1 240); do
  if ${dockerCmd} logs ${cfg.containerPrefix}-r$ROUND 2>&1 | grep -q "${cfg.envReadyMarker}"; then
    echo "Container ready after $((i*2))s"
    break
  fi
  sleep 2
done
\`\`\`

### Step 4: Write and run Agent SDK script
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
INSTRUCTION=$(cat ${cfg.taskDir}/instruction.md)

# Token rotation: use round-robin across available tokens
TOKENS=(${tokens.map(t => `"${t}"`).join(" ")})
TOKEN_IDX=$(( (ROUND - 1) % ${tokens.length || 1} ))
${tokenRotation}

cat > /tmp/bench-agent-runner.ts << 'AGENTEOF'
import { query } from "@anthropic-ai/claude-code";
import * as fs from "fs";

const round = process.env.ROUND || "1";
const instruction = process.env.INSTRUCTION || "";
const dockerExec = "${dockerCmd} exec ${cfg.containerPrefix}-r" + round;
const sessionDir = process.env.SESSION_DIR || "/tmp";
const startTime = Date.now();
const messages: string[] = [];

async function main() {
  console.log(\`Spawning Sonnet agent for round \${round}...\`);
  for await (const message of query({
    prompt: \`You are solving a benchmark task inside a Docker container on a remote host.

IMPORTANT: Execute ALL commands using this prefix:
\${dockerExec} bash -c '<your command here>'

For multi-line scripts, write them to a file first:
\${dockerExec} bash -c 'cat > /tmp/script.sh << "EOF"
<script content>
EOF'
\${dockerExec} bash /tmp/script.sh

Here is the task:

\${instruction}

Solve it step by step. Every command must run inside the container via the docker exec prefix above.\`,
    options: {
      model: "claude-sonnet-4-20250514",
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash", "Read", "Write", "Edit"],
      maxTurns: ${cfg.maxTurns},
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

main().catch(err => { console.error("Agent SDK error:", err); process.exit(1); });
AGENTEOF

ROUND=$ROUND INSTRUCTION="$INSTRUCTION" SESSION_DIR="{{SESSION_DIR}}" \\
  timeout ${cfg.agentTimeout} bun /tmp/bench-agent-runner.ts 2>&1 | tee "{{SESSION_DIR}}/agent-sdk-log-r$ROUND.txt"
echo "Agent SDK script exited with code $?"
\`\`\`

### Step 5: Run test suite
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
${dockerCmd} exec ${cfg.containerPrefix}-r$ROUND mkdir -p /tests /logs/verifier
${dockerCmd} cp ${cfg.taskDir}/tests/test_state.py ${cfg.containerPrefix}-r$ROUND:/tests/test_state.py
${dockerCmd} cp ${cfg.taskDir}/tests/test.sh ${cfg.containerPrefix}-r$ROUND:/tests/test.sh
${dockerCmd} exec ${cfg.containerPrefix}-r$ROUND chmod +x /tests/test.sh
TEST_OUTPUT=$(${dockerCmd} exec ${cfg.containerPrefix}-r$ROUND ${cfg.testCmd} 2>&1)
echo "$TEST_OUTPUT"
REWARD=$(${dockerCmd} exec ${cfg.containerPrefix}-r$ROUND bash -c '/tests/test.sh && cat /logs/verifier/reward.txt' 2>&1)
echo "Reward: $REWARD"
\`\`\`

### Step 6: Write consolidated results
Parse pytest output → \`{{SESSION_DIR}}/round-results.json\`:
\`\`\`json
{
  "round": 1,
  "benchmark": "tb3-ranger",
  "timestamp": "...",
  "host": "${host}",
  "agent": "sonnet-sdk",
  "container": "${cfg.containerPrefix}-r1",
  "reward": "1" or "0",
  "tests": { "total": 50, "passed": 42, "failed": 8 },
  "failed_tests": [{"name": "test_b3_...", "reason": "..."}],
  "agent_blockers": [...],
  "time_spent_min": 25
}
\`\`\`

### Step 7: Print summary table`;
    },

    hardenerSeedFn: (cfg, _host, dockerCmd, skipOracle) => {
      const oracleSection = skipOracle ? "" : `
### Phase 2a: Run oracle verification
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
${dockerCmd} rm -f tb3-oracle-verify 2>/dev/null || true
${dockerCmd} run -d --name tb3-oracle-verify --cpus=${cfg.cpus} --memory=${cfg.memory} ${cfg.imageName}
for i in $(seq 1 240); do
  if ${dockerCmd} logs tb3-oracle-verify 2>&1 | grep -q "${cfg.envReadyMarker}"; then break; fi
  sleep 2
done
${dockerCmd} cp ${cfg.taskDir}/solution/solve.sh tb3-oracle-verify:/tmp/solve.sh
${dockerCmd} exec tb3-oracle-verify bash /tmp/solve.sh
${dockerCmd} exec tb3-oracle-verify mkdir -p /tests
${dockerCmd} cp ${cfg.taskDir}/tests/test_state.py tb3-oracle-verify:/tests/test_state.py
ORACLE_RESULT=$(${dockerCmd} exec tb3-oracle-verify ${cfg.testCmd} 2>&1)
echo "$ORACLE_RESULT"
${dockerCmd} rm -f tb3-oracle-verify
\`\`\`
If oracle fails after your changes, revert the broken test and try a different approach.`;

      return `You are the benchmark hardener for the TB3 Ranger migration task.

## Project
\`${benchDir}\` — a benchmark where an agent migrates StarRocks from view-based isolation to Apache Ranger RLS. 50 tests across 9 categories verify the migration.

## Context
Results: \`{{SESSION_DIR}}/round-results.json\` and \`{{SESSION_DIR}}/agent-transcript-r{N}.json\`

## Conventions
Check \`/Users/wz/Desktop/qbg/conventions/\` for benchmark design conventions.

## Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **ranger_bug** | Agent hit known Ranger bug | No action — legitimate difficulty |
| **instruction_ambiguity** | instruction.md unclear | Fix instruction.md |
| **test_bug** | Test checks wrong condition or implementation detail | Fix test_state.py |
| **env_issue** | Container/service startup problem | Fix start.sh or Dockerfile |
| **reward_hack** | Agent found shortcut | Harden tests |
${oracleSection}

## Fix issues
1. Read relevant files (\`${cfg.taskDir}/instruction.md\`, \`${cfg.taskDir}/tests/test_state.py\`, etc.)
2. Make targeted fixes
3. Verify solution still passes

## Track convergence
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"
CLEAN=$(cat "{{SESSION_DIR}}/clean-rounds.txt" 2>/dev/null || echo 0)
\`\`\`
If no test_bug/instruction_ambiguity fixes: increment clean. Otherwise reset to 0.
2 consecutive clean → \`touch "{{SESSION_DIR}}/converged.flag"\`

## Write report + commit
\`\`\`bash
cd ${benchDir}
git add tasks/ranger-provisioning-service/
git commit -m "Round \${ROUND}: harden Ranger migration tests"
\`\`\``;
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// ── TORCHFT CIFAR-10 CONFIG ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

function torchftConfig(benchDir: string): BenchConfig {
  const taskDir = `${benchDir}/tasks/torchft-cifar10`;

  return {
    taskDir,
    imageName: "torchft-v2",
    containerPrefix: "torchft-harden",
    hasSolution: true,
    solutionPath: "solution/solve.sh",
    testCmd: "pytest /tests/test_state.py -v --tb=short",
    cpus: 4,
    memory: "8g",
    agentTimeout: 1200,
    maxTurns: 80,

    runnerSeedFn: (cfg, host, dockerCmd, tokens, sshUser) => {
      const syncCmd = `rsync -az ${cfg.taskDir}/environment/ ${sshUser}@${host}:/tmp/torchft-env/`;
      const tokenRotation = tokens.length > 0
        ? `export CLAUDE_CODE_OAUTH_TOKEN="${tokens[0]}"`
        : `# No tokens available`;

      return `You are a benchmark executor for the torchft-cifar10 task.

## Project
\`${benchDir}\` — a benchmark where an agent must implement fault-tolerant data-parallel CIFAR-10 training with heartbeat-based failure detection and quorum-based blocking all-reduce.

## Rules
- Do NOT look at \`${cfg.taskDir}/solution/\` or \`${cfg.taskDir}/tests/\`
- Build a fresh Docker container each round on \`${host}\`
- Spawn solving agent via Claude Agent SDK
- After agent finishes, run test suite to grade

## Task

### Step 1: Read round number
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
\`\`\`

### Step 2: Build fresh Docker environment
\`\`\`bash
${syncCmd}
${dockerCmd} rm -f ${cfg.containerPrefix}-r$ROUND 2>/dev/null || true
${dockerCmd} build -t ${cfg.imageName} /tmp/torchft-env/ 2>&1 | tail -5
${dockerCmd} run -d --name ${cfg.containerPrefix}-r$ROUND --cpus=${cfg.cpus} --memory=${cfg.memory} ${cfg.imageName} sleep infinity
\`\`\`

### Step 3: Write and run Agent SDK script
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
INSTRUCTION=$(cat ${cfg.taskDir}/instruction.md)

TOKENS=(${tokens.map(t => `"${t}"`).join(" ")})
TOKEN_IDX=$(( (ROUND - 1) % ${tokens.length || 1} ))
${tokenRotation}

cat > /tmp/bench-agent-runner.ts << 'AGENTEOF'
import { query } from "@anthropic-ai/claude-code";
import * as fs from "fs";

const round = process.env.ROUND || "1";
const instruction = process.env.INSTRUCTION || "";
const container = "${cfg.containerPrefix}-r" + round;
const dockerExec = "${dockerCmd} exec " + container;
const sessionDir = process.env.SESSION_DIR || "/tmp";
const startTime = Date.now();
const messages: string[] = [];

async function main() {
  console.log(\`Spawning Sonnet agent for round \${round}...\`);
  for await (const message of query({
    prompt: \`You are solving a benchmark task inside a Docker container on a remote host.

IMPORTANT: Execute ALL commands using this prefix:
\${dockerExec} bash -c '<your command here>'

For multi-line scripts, write them to a file first:
\${dockerExec} bash -c 'cat > /app/train.py << "PYEOF"
<python content>
PYEOF'

Then run: \${dockerExec} bash /app/run.sh

Here is the task:

\${instruction}

Solve it step by step. Create /app/train.py inside the container, then run bash /app/run.sh.\`,
    options: {
      model: "claude-sonnet-4-20250514",
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash", "Read", "Write", "Edit"],
      maxTurns: ${cfg.maxTurns},
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

main().catch(err => { console.error("Agent SDK error:", err); process.exit(1); });
AGENTEOF

ROUND=$ROUND INSTRUCTION="$INSTRUCTION" SESSION_DIR="{{SESSION_DIR}}" \\
  timeout ${cfg.agentTimeout} bun /tmp/bench-agent-runner.ts 2>&1 | tee "{{SESSION_DIR}}/agent-sdk-log-r$ROUND.txt"
echo "Agent SDK script exited with code $?"
\`\`\`

### Step 4: Run test suite
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
CONTAINER="${cfg.containerPrefix}-r$ROUND"
${dockerCmd} exec $CONTAINER mkdir -p /tests /logs/verifier
${dockerCmd} cp ${cfg.taskDir}/tests/test_state.py $CONTAINER:/tests/test_state.py
${dockerCmd} cp ${cfg.taskDir}/tests/test.sh $CONTAINER:/tests/test.sh
${dockerCmd} exec $CONTAINER chmod +x /tests/test.sh
TEST_OUTPUT=$(${dockerCmd} exec $CONTAINER ${cfg.testCmd} 2>&1)
echo "$TEST_OUTPUT"
REWARD=$(${dockerCmd} exec $CONTAINER bash -c '/tests/test.sh && cat /logs/verifier/reward.txt' 2>&1)
echo "Reward: $REWARD"
\`\`\`

### Step 5: Write results + cleanup
Parse pytest output → \`{{SESSION_DIR}}/round-results.json\`:
\`\`\`json
{
  "round": 1,
  "benchmark": "torchft-cifar10",
  "timestamp": "...",
  "host": "${host}",
  "reward": "1" or "0",
  "tests": { "total": 10, "passed": 8, "failed": 2 },
  "failed_tests": [{"name": "test_model_accuracy", "reason": "accuracy 0.72 < 0.80"}],
  "time_spent_min": 12
}
\`\`\`

Cleanup: \`${dockerCmd} rm -f ${cfg.containerPrefix}-r$ROUND\``;
    },

    hardenerSeedFn: (cfg, _host, dockerCmd, skipOracle) => {
      const oracleSection = skipOracle ? "" : `
### Phase 2a: Run oracle verification
\`\`\`bash
${dockerCmd} rm -f torchft-oracle-verify 2>/dev/null || true
${dockerCmd} build -t ${cfg.imageName} /tmp/torchft-env/ 2>&1 | tail -3
${dockerCmd} run --rm --cpus=${cfg.cpus} --memory=${cfg.memory} \\
  -v ${cfg.taskDir}/solution:/solution:ro -v ${cfg.taskDir}/tests:/tests:ro \\
  ${cfg.imageName} bash -c "bash /solution/solve.sh && mkdir -p /logs/verifier && bash /tests/test.sh && echo REWARD=$(cat /logs/verifier/reward.txt)" 2>&1
\`\`\`
If oracle fails, revert the broken change.`;

      return `You are the benchmark hardener for the torchft-cifar10 task.

## Project
\`${benchDir}\` — a benchmark where an agent implements fault-tolerant data-parallel CIFAR-10 training. 10 tests verify model accuracy, heartbeat, quorum-based sync, parameter convergence, chaos resilience, and infrastructure integrity.

## Context
Results: \`{{SESSION_DIR}}/round-results.json\` and \`{{SESSION_DIR}}/agent-transcript-r{N}.json\`

## Conventions
Check \`/Users/wz/Desktop/qbg/conventions/\` for benchmark design conventions.

## Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **convergence_issue** | Agent's training doesn't reach 80% accuracy | No action — legitimate difficulty |
| **instruction_ambiguity** | instruction.md unclear | Fix instruction.md |
| **test_bug** | Test too strict or checks implementation detail | Fix test_state.py |
| **env_issue** | Container OOM, timing | Fix Dockerfile or run.sh |
| **reward_hack** | Agent found shortcut (pretrained weights, fake artifacts) | Harden tests |
${oracleSection}

## Fix issues
Read \`${cfg.taskDir}/instruction.md\`, \`${cfg.taskDir}/tests/test_state.py\`, etc. Make targeted fixes.

## Track convergence
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"
CLEAN=$(cat "{{SESSION_DIR}}/clean-rounds.txt" 2>/dev/null || echo 0)
\`\`\`
2 consecutive clean → \`touch "{{SESSION_DIR}}/converged.flag"\`

## Write report + commit
\`\`\`bash
cd ${benchDir}
git add tasks/torchft-cifar10/
git commit -m "torchft-cifar10: round \${ROUND} hardening"
\`\`\``;
    },
  };
}
