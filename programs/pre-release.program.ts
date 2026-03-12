/**
 * Pre-Release Program — linear pipeline for release readiness checks.
 *
 * 3 phases:
 *   Phase 0: auditor (Opus) — diff analysis, version bump decision, config drift detection
 *   Phase 1: checkers (Sonnet, parallel) — TS compile, tests, mock scan, dependency audit
 *   Phase 2: deployer (Opus) — synthesize go/no-go verdict, generate changelog + deploy instructions
 *
 * Phase 1 has a command check hook: bun build must pass before proceeding.
 *
 * Usage:
 *   fleet pipeline pre-release --scope HEAD
 *   fleet pipeline pre-release --scope v1.2.0..HEAD --dry-run
 */
import type { Program, AgentSpec } from "../engine/program/types";

export interface PreReleaseOpts {
  scope: string;
  projectRoot?: string;
  spec?: string;
  force?: boolean;
}

export default function preRelease(opts: PreReleaseOpts): Program {
  return {
    name: "pre-release",
    description: "Release readiness: audit → check → deploy verdict",
    phases: [
      // ── Phase 0: Auditor (Opus) ──────────────────────────
      {
        name: "audit",
        description: "Analyze diff, decide version bump, detect config drift",
        agents: [{
          name: "auditor",
          role: "auditor",
          model: "opus",
          seed: { inline: auditSeed(opts) },
          window: "audit",
        }],
      },

      // ── Phase 1: Checkers (Sonnet, parallel) ──────────────
      {
        name: "checks",
        description: "Parallel: TS compile, tests, mock scan, dependency audit",
        agents: checkerAgents(),
        gate: "all",
        layout: { panesPerWindow: 4, algorithm: "tiled" },
        hooks: [{
          event: "Stop",
          type: "command",
          description: "Verify TypeScript compiles before proceeding",
          check: "bun build src/server.ts --outdir /tmp/pre-release-check --target bun 2>/dev/null",
          blocking: true,
        }],
        prelaunch: [
          { type: "parse-output", agent: "auditor", file: "audit-result.json" },
        ],
      },

      // ── Phase 2: Deployer (Opus) ──────────────────────────
      {
        name: "deploy",
        description: "Synthesize go/no-go verdict, generate changelog + deploy instructions",
        agents: [{
          name: "deployer",
          role: "deployer",
          model: "opus",
          seed: { inline: deployerSeed(opts) },
          window: "deploy",
        }],
        prelaunch: [
          { type: "parse-output", agent: "ts-checker", file: "ts-check-result.json" },
          { type: "parse-output", agent: "test-runner", file: "test-result.json" },
        ],
      },
    ],
    defaults: {
      model: "sonnet",
      effort: "high",
      permission: "bypassPermissions",
    },
    material: {
      scope: opts.scope,
      spec: opts.spec || "Analyze this diff for release readiness.",
    },
  };
}

function checkerAgents(): AgentSpec[] {
  return [
    {
      name: "ts-checker",
      role: "checker",
      model: "sonnet",
      seed: { inline: `You are a TypeScript build checker.

Your task:
1. Run: bun build src/server.ts --outdir /tmp/ts-check --target bun
2. Run: bun build src/server-web.ts --outdir /tmp/ts-check --target bun
3. Run: bun build src/server-core.ts --outdir /tmp/ts-check --target bun
4. Capture any errors
5. Write results to {{SESSION_DIR}}/ts-check-result.json as: { "pass": bool, "errors": string[] }

If all builds pass, report PASS. If any fail, list the specific errors.` },
      window: "checks",
    },
    {
      name: "test-runner",
      role: "checker",
      model: "sonnet",
      seed: { inline: `You are a test suite runner.

Your task:
1. Run: bun test (the full test suite)
2. Capture results (pass/fail counts, any failures)
3. Note: 4 prompt-loader.test.ts failures are known/pre-existing (Langfuse unreachable)
4. Write results to {{SESSION_DIR}}/test-result.json as: { "pass": bool, "total": N, "passed": N, "failed": N, "knownFailures": N, "newFailures": string[] }

Only flag as FAIL if there are NEW failures beyond the known 4.` },
      window: "checks",
    },
    {
      name: "mock-scanner",
      role: "checker",
      model: "sonnet",
      seed: { inline: `You are a mock data scanner.

Your task:
1. Run: git diff {{SCOPE}} -- . | grep -i 'mock\\|placeholder\\|dummy\\|hardcoded.*test\\|TODO\\|FIXME'
2. Check if any mock/placeholder data was introduced in the diff
3. Scan for any test/demo accounts being used in non-test code
4. Write results to {{SESSION_DIR}}/mock-scan-result.json as: { "pass": bool, "findings": string[] }

ZERO mock data is a non-negotiable policy. Flag any instance.` },
      window: "checks",
    },
    {
      name: "dep-auditor",
      role: "checker",
      model: "sonnet",
      seed: { inline: `You are a dependency auditor.

Your task:
1. Check if package.json or bun.lock changed in the diff
2. If changed: verify no known vulnerabilities were introduced
3. Check for any new dependencies and verify they're necessary
4. Check .env.default for any new env vars that need to be set on servers
5. Write results to {{SESSION_DIR}}/dep-audit-result.json as: { "pass": bool, "newDeps": string[], "newEnvVars": string[], "concerns": string[] }` },
      window: "checks",
    },
  ];
}

function auditSeed(opts: PreReleaseOpts): string {
  return `You are a release auditor (Opus).

Your task:
1. Analyze the diff at scope: ${opts.scope}
2. Determine the appropriate version bump (patch/minor/major) based on changes
3. Check for config drift between local and server files (tools.json, projects.json, databases.json)
4. Identify any migration or schema changes that need special deployment handling
5. List all changed modules/services to determine the correct --service flag

Write your analysis to {{SESSION_DIR}}/audit-result.json as:
{
  "versionBump": "patch" | "minor" | "major",
  "reason": "why this bump level",
  "serviceScope": "static" | "web" | "core" | "all",
  "configDrift": [{ "file": "...", "issue": "..." }],
  "migrations": [{ "type": "sqlite" | "starrocks", "details": "..." }],
  "risks": ["..."],
  "changedModules": ["..."]
}`;
}

function deployerSeed(opts: PreReleaseOpts): string {
  return `You are a deploy coordinator (Opus).

Your task:
1. Read all check results from {{SESSION_DIR}}/*-result.json
2. Read the audit result from {{SESSION_DIR}}/audit-result.json
3. Synthesize a GO/NO-GO verdict
4. If GO: generate changelog entry (Chinese, for data/config/changelog.xml) and deploy instructions
5. If NO-GO: list specific blockers that must be fixed

Write your verdict to {{SESSION_DIR}}/report.md with:
- VERDICT: GO or NO-GO
- Summary of all check results
- Version: vX.Y.Z (from audit)
- Service scope: --service <flag>
- Changelog entry (Chinese XML block)
- Deploy instructions for test + prod
- Any post-deploy steps needed`;
}
