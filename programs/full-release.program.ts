/**
 * Full Release Program — composable meta-pipeline.
 *
 * Demonstrates graph composition via embed():
 *   1. Eval-loop sub-pipeline: generate + evaluate test scenarios
 *   2. Pre-release sub-pipeline: audit + checks + deploy verdict
 *   3. Cross-subgraph wiring: eval converges -> pre-release audit begins
 *
 * Usage:
 *   fleet pipeline full-release --scope HEAD --spec "BI dashboard"
 *   fleet pipeline full-release --dry-run
 */
import type { Program, ProgramGraph } from "../engine/program/types";
import { graph } from "../engine/program/graph";

export interface FullReleaseOpts {
  scope: string;
  spec?: string;
  threshold?: number;
  maxIterations?: number;
  projectRoot?: string;
  force?: boolean;
}

/**
 * Build a standalone eval-loop graph (reusable sub-pipeline).
 */
function evalLoopGraph(opts: FullReleaseOpts): ProgramGraph {
  const threshold = opts.threshold || 80;
  const maxIter = opts.maxIterations || 3; // fewer iterations in composed context

  return graph("eval-loop", "Test generation + evaluation cycle")
    .node("generate", {
      description: "Produce and run test scenarios",
      agents: [{
        name: "eval-generator",
        role: "generator",
        model: "sonnet",
        seed: { inline: `You are a test generator. Generate and run test scenarios for: ${opts.spec || "the system"}.
Target score: ${threshold}/100. Write results to {{SESSION_DIR}}/test-results.json.
Check {{SESSION_DIR}}/eval-feedback.json for prior feedback.` },
        window: "eval-generate",
      }],
    })
    .node("evaluate", {
      description: "Score test results",
      agents: [{
        name: "eval-evaluator",
        role: "evaluator",
        model: "opus",
        seed: { inline: `You are a test evaluator. Read {{SESSION_DIR}}/test-results.json.
Score 0-100 across coverage/correctness/edge-cases/robustness.
Write score to {{SESSION_DIR}}/score.txt, feedback to {{SESSION_DIR}}/eval-feedback.json.` },
        window: "eval-evaluate",
      }],
      prelaunch: [
        { type: "parse-output", agent: "eval-generator", file: "test-results.json" },
      ],
    })
    .edge("generate", "evaluate")
    .edge("evaluate", "generate", {
      condition: `test $(cat "{{SESSION_DIR}}/score.txt" 2>/dev/null || echo 0) -lt ${threshold}`,
      maxIterations: maxIter,
      label: "score below threshold",
    })
    .edge("evaluate", "$end", { label: "converged", priority: 1 })
    .build();
}

/**
 * Build a standalone pre-release graph (reusable sub-pipeline).
 */
function preReleaseGraph(opts: FullReleaseOpts): ProgramGraph {
  return graph("pre-release", "Audit + checks + deploy verdict")
    .node("audit", {
      description: "Analyze diff for release readiness",
      agents: [{
        name: "release-auditor",
        role: "auditor",
        model: "opus",
        seed: { inline: `You are a release auditor. Analyze diff at scope: ${opts.scope}.
Determine version bump, check config drift, identify migrations.
Write analysis to {{SESSION_DIR}}/audit-result.json.` },
        window: "audit",
      }],
    })
    .node("checks", {
      description: "Parallel release checks",
      agents: [
        {
          name: "release-ts-checker",
          role: "checker",
          model: "sonnet",
          seed: { inline: `Run TypeScript build checks. Write results to {{SESSION_DIR}}/ts-check-result.json.` },
          window: "checks",
        },
        {
          name: "release-test-runner",
          role: "checker",
          model: "sonnet",
          seed: { inline: `Run full test suite. Write results to {{SESSION_DIR}}/test-result.json.` },
          window: "checks",
        },
      ],
      gate: "all",
      layout: { panesPerWindow: 4, algorithm: "tiled" },
      prelaunch: [
        { type: "parse-output", agent: "release-auditor", file: "audit-result.json" },
      ],
    })
    .node("verdict", {
      description: "Synthesize go/no-go verdict",
      agents: [{
        name: "release-deployer",
        role: "deployer",
        model: "opus",
        seed: { inline: `Read all check results from {{SESSION_DIR}}/*-result.json.
Synthesize GO/NO-GO verdict. Write to {{SESSION_DIR}}/release-report.md.` },
        window: "verdict",
      }],
      prelaunch: [
        { type: "parse-output", agent: "release-ts-checker", file: "ts-check-result.json" },
        { type: "parse-output", agent: "release-test-runner", file: "test-result.json" },
      ],
    })
    .edge("audit", "checks")
    .edge("checks", "verdict")
    .build();
}

/**
 * The composed program: eval-loop -> pre-release, wired via embed().
 */
export default function fullRelease(opts: FullReleaseOpts): Program {
  const g = graph(
    "full-release",
    `Full release pipeline: eval loop (threshold ${opts.threshold || 80}) then pre-release checks`,
  )
    // Embed eval-loop sub-pipeline
    .embed(evalLoopGraph(opts), { prefix: "eval" })
    // Embed pre-release sub-pipeline
    .embed(preReleaseGraph(opts), { prefix: "rel" })
    // Wire: eval converges -> pre-release audit begins
    .edge("eval.evaluate", "rel.audit", {
      label: "eval converged, start release checks",
      priority: 2, // lower priority than the cycle-back and $end edges from eval-loop
    })
    .entry("eval.generate")
    .defaults({
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    })
    .material({
      scope: opts.scope,
      spec: opts.spec || "Full release pipeline.",
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
