/**
 * Greenfield-Bench Hardening Pipeline — iterative verifier hardening for hotel domain.
 *
 * Graph:
 *   attempt → analyze-harden ──→ attempt (cycle if round < N)
 *                              └→ $end   (converged)
 *
 * Attempt phase: Sonnet runs all 11 hotel management cases (cascade mode).
 * Analyze phase: Opus reviews results, classifies failures, hardens verifiers/checkpoints.
 *
 * Usage:
 *   fleet pipeline greenfield-harden --rounds 3
 *   fleet pipeline greenfield-harden --rounds 1 --spec "case_01_complaint_escalation,case_06_parking_flood"
 *   fleet pipeline greenfield-harden --dry-run
 */
import type { Program } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface GreenfieldHardenOpts {
  rounds?: number;
  spec?: string; // comma-separated case filter
  scope?: string;
}

const PROJECT_ROOT = "/Users/wz/Desktop/qbg/greenfield-bench";

const ALL_CASES = [
  "case_01_complaint_escalation",
  "case_02_fee_collection",
  "case_03_work_order_routing",
  "case_04_lease_renewal",
  "case_05_bi_dashboard",
  "case_06_parking_flood",
  "case_07_billing_dispute",
  "case_08_new_property",
  "case_09_restaurant_conflict",
  "case_10_anomaly_detection",
  "case_11_access_control",
];

export default function greenfieldHarden(opts: GreenfieldHardenOpts): Program {
  const rounds = opts.rounds || 3;
  const cases = opts.spec ? opts.spec.split(",").map((s) => s.trim()) : ALL_CASES;

  const g = graph(
    "greenfield-harden",
    `Iterative verifier hardening for greenfield-bench hotel domain (${rounds} rounds, ${cases.length} cases)`,
  )
    .node("attempt", {
      description: "Run benchmark cases and collect grade results",
      agents: [
        {
          name: "case-runner",
          role: "executor",
          model: "sonnet",
          seed: { inline: runnerSeed(cases) },
          window: "attempt",
        },
      ],
    })
    .node("analyze-harden", {
      description: "Analyze failures, classify issues, harden verifiers and checkpoints",
      agents: [{
        name: "hardener",
        role: "analyst",
        model: "opus",
        seed: { inline: hardenerSeed(cases) },
        window: "analyze",
      }],
      prelaunch: [
        { type: "parse-output", agent: "case-runner", file: "round-results.json" },
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
      spec: `Harden greenfield-bench hotel management verifiers across ${rounds} rounds`,
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

export function parse_case_runner_output(state: any): void {
  const fs = require("fs");
  const path = require("path");
  const resultsPath = path.join(state.sessionDir, "round-results.json");
  if (fs.existsSync(resultsPath)) {
    state.ext.roundResults = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  }
}

// ── Seed generators ────────────────────────────────────────────────────

function runnerSeed(cases: string[]): string {
  const caseList = cases.map((c) => `  - ${c}`).join("\n");
  return `You are a benchmark executor for the greenfield-bench hotel management benchmark.

## Project
\`${PROJECT_ROOT}\` — a benchmark with 11 hotel management cases, each with 3 cascading checkpoints. Cases are solved by a Claude Code SDK agent that can only use MCP tools (hotel_db, guest_services, comms, documents, admin).

## Rules
- Run all cases sequentially—each spawns a Claude Code SDK agent internally
- Do NOT modify any benchmark files (cases, verifiers, MCP servers)—only run them
- Each case creates an isolated DB + workspace in results/{case}/{timestamp}/

## Task

### Step 1: Read round number
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo "Starting round $ROUND"
\`\`\`

### Step 2: Run each case
For each of the following cases, run the benchmark in cascade mode:

${caseList}

Command for each case:
\`\`\`bash
cd ${PROJECT_ROOT}
python -m agents.runner.main --case {CASE_NAME} --cascade --model claude-sonnet-4-20250514 --max-turns 30
\`\`\`

Run them one at a time. After each case completes, note the output directory path printed at the end ("Run complete: {path}").

### Step 3: Collect grade results
After all cases finish, for each case find its latest results directory:
\`\`\`bash
LATEST=$(ls -td ${PROJECT_ROOT}/results/{CASE_NAME}/*/ 2>/dev/null | head -1)
\`\`\`

Read the grade.json files from each checkpoint directory (cp1/, cp2/, cp3/).

### Step 4: Write consolidated results
Write a JSON summary to \`{{SESSION_DIR}}/round-results.json\` with this structure:
\`\`\`json
{
  "round": 1,
  "timestamp": "2026-03-15T12:00:00Z",
  "cases": {
    "case_01_complaint_escalation": {
      "pass": true,
      "run_dir": "/path/to/results/...",
      "checkpoints": {
        "1": {"passed": true, "passed_count": 3, "total_count": 3, "results": [...]},
        "2": {"passed": true, "passed_count": 2, "total_count": 2, "results": [...]},
        "3": {"passed": false, "passed_count": 1, "total_count": 3, "results": [...]}
      }
    }
  },
  "summary": {
    "total_cases": 11,
    "passed": 8,
    "failed": 3,
    "failed_cases": ["case_05_bi_dashboard", "case_08_new_property", "case_10_anomaly_detection"]
  }
}
\`\`\`

A case passes only if ALL its checkpoints pass.

Include the full \`results\` array from each grade.json so the hardener can see exactly which verifiers failed and why.

### Step 5: Print summary
Print a pass/fail table showing all cases and their checkpoint results.`;
}

function hardenerSeed(_cases: string[]): string {
  return `You are the benchmark hardener for greenfield-bench, a hotel management benchmark with outcome-only verifiers.

## Project
\`${PROJECT_ROOT}\` — 11 cases × 3 cascading checkpoints. Agent uses 5 MCP servers (hotel_db, guest_services, comms, documents, admin). Verifiers check database state and files—never agent internals.

## Context
A Sonnet agent just ran all benchmark cases. Results are in:
- \`{{SESSION_DIR}}/round-results.json\`

## Your analysis workflow

### Phase 1: Read results
Read \`{{SESSION_DIR}}/round-results.json\`. Build a matrix:
- Case × Checkpoint → pass/fail
- For each failure, read the \`reason\` field from the verifier result

### Phase 2: Classify each failure

| Category | Meaning | Action |
|----------|---------|--------|
| **capability** | Agent timeout, wrong approach, couldn't figure it out | No action—legitimate difficulty |
| **task_design** | Checkpoint instructions ambiguous, MCP tools don't support required action | Fix checkpoint JSON |
| **verifier_bug** | Wrong conditions, too strict/loose, checks wrong column/table | Fix verifiers.json |
| **reward_hack** | Agent gamed verifiers without doing real work (e.g., inserted matching rows directly) | Harden verifiers |

Guidelines for classification:
- If the verifier reason says "SQL error" or references a non-existent table/column → **verifier_bug**
- If the verifier reason says "No rows matching" but the agent's trajectory shows it did the right thing → **verifier_bug** (conditions too strict)
- If the verifier checks for an action string that no MCP server writes → **verifier_bug**
- If the checkpoint persona or user_message doesn't clearly tell the agent what to do → **task_design**
- If the agent ran out of turns or got confused → **capability**
- If the agent created matching data without actually solving the task → **reward_hack**

### Phase 3: Verify MCP server capabilities
For verifiers that check \`audit_log\` actions or specific data patterns, verify the MCP servers actually support those operations:

\`\`\`bash
# Check what actions each server writes to audit_log
grep -n "action" ${PROJECT_ROOT}/environment/mcp_servers/*/mcp_servers/*/main.py
\`\`\`

Known server audit_log actions:
- **admin**: permission_check, get_access_policy, policy_update, audit_query, get_employee, list_employees
- **guest_services**: CREATE, identity_verification, QUERY
- **documents**: create_report, draft_notice, create_spreadsheet, read_template, list_templates
- **comms**: send_email, send_notice, log_call, get_inbox, get_sent
- **hotel_db**: QUERY, SCHEMA_BROWSE

### Phase 4: Fix issues
For each task_design/verifier_bug/reward_hack issue:

1. Read the verifier file: \`${PROJECT_ROOT}/cases/{case_name}/verifiers.json\`
2. Read the checkpoint file if needed: \`${PROJECT_ROOT}/cases/{case_name}/checkpoint_{N}.json\`
3. Make targeted fixes:
   - For wrong action strings: change to match what server actually writes
   - For overly strict conditions: loosen (use fewer conditions, accept alternatives)
   - For overly loose conditions: tighten (add more conditions, use data_created instead of data_exists)
   - For reward hacks: add additional verifiers that check related state
   - For ambiguous checkpoints: clarify the user_message or add constraints

4. After fixing, verify the fix makes sense—don't introduce new bugs

### Phase 5: Update round counter
\`\`\`bash
ROUND=$(cat "{{SESSION_DIR}}/round.txt" 2>/dev/null || echo 1)
echo $((ROUND + 1)) > "{{SESSION_DIR}}/round.txt"
\`\`\`

### Phase 6: Write report
Write to \`{{SESSION_DIR}}/harden-report-r\${ROUND}.md\`:

\`\`\`markdown
# Hardening Report — Round {N}

## Pass/Fail Matrix
| Case | CP1 | CP2 | CP3 | Overall |
|------|-----|-----|-----|---------|
| case_01 | PASS | PASS | PASS | PASS |
| ... |

## Issues Found
### Verifier Bugs
- case_XX CP2 verifier 1: checked action=EXPORT but docs server writes create_spreadsheet. Fixed.

### Task Design Issues
- case_XX CP3: user_message doesn't mention export format. Added "export as CSV" to instructions.

### Reward Hacks
- (none this round)

### Capability Failures (no action needed)
- case_XX: Agent ran out of turns on complex multi-step task

## Changes Made
- cases/case_XX/verifiers.json: Changed action condition from X to Y
- cases/case_XX/checkpoint_3.json: Clarified user_message

## Difficulty Assessment
- Easy (both rounds pass): case_01, case_02, ...
- Medium (intermittent): case_06, ...
- Hard (consistent fail): case_10, ...
\`\`\`

### Phase 7: Commit changes
\`\`\`bash
cd ${PROJECT_ROOT}
git add cases/
git commit -m "Round \${ROUND}: harden greenfield-bench verifiers based on agent performance"
\`\`\`

## Key principles
- **Outcome-only**: Verifiers check database state and files, never agent behavior
- A verifier bug means the verifier is wrong, not the agent
- A task_design issue means the checkpoint instructions are unclear
- Don't over-harden—if the agent fails for legitimate capability reasons, that's fine
- Each round should reduce false positives/negatives while maintaining fairness
- Check MCP server source before assuming an action string exists`;
}
