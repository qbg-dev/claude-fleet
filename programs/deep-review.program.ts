/**
 * Deep Review Program — the entire pipeline declared as a single file.
 *
 * Replaces the orchestration scattered across 8+ files with one readable
 * top-to-bottom declaration that compiles into fleet's distributed artifacts.
 *
 * Usage:
 *   fleet pipeline deep-review --scope HEAD~3..HEAD --verify
 *   fleet deep-review --scope HEAD   (legacy alias, delegates here)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Program, AgentSpec, ProgramPipelineState, ProgramDefaults } from "../engine/program/types";
import { DEFAULT_CODEBASE_FOCUS } from "../cli/lib/deep-review/args";

export interface DeepReviewOpts {
  scope: string;
  contentFiles: string[];
  spec: string;
  passesPerFocus: number;
  focusAreas: string[];
  maxWorkers: number | null;
  verify: boolean;
  verifyRoles: string;
  noJudge: boolean;
  noContext: boolean;
  noImproveReview: boolean;
  workerModel: string;
  coordModel: string;
  notifyTarget: string;
  force: boolean;
}

/**
 * Parse raw CLI opts into typed DeepReviewOpts.
 * Called by pipeline.ts if this export exists, replacing hardcoded buildProgramOpts.
 */
export function parseOpts(opts: Record<string, any>, _projectRoot: string): DeepReviewOpts {
  const scope = opts.scope || "HEAD";
  const isCodebase = scope === "codebase";
  const defaultSpec = isCodebase
    ? "Perform a comprehensive quality review of this codebase. Look for bugs, security issues, architectural problems, error handling gaps, and opportunities for improvement."
    : "Review this material thoroughly for issues, gaps, and improvements.";

  return {
    scope,
    contentFiles: opts.content ? opts.content.split(",").map((s: string) => s.trim()) : [],
    spec: opts.spec || defaultSpec,
    passesPerFocus: parseInt(opts.passes, 10) || 2,
    focusAreas: opts.focus ? opts.focus.split(",").map((s: string) => s.trim()) : [],
    maxWorkers: opts.maxWorkers ? parseInt(opts.maxWorkers, 10) : null,
    verify: !!opts.verify,
    verifyRoles: opts.verifyRoles || "",
    noJudge: opts.judge === false,
    noContext: opts.context === false,
    noImproveReview: opts.improveReview === false,
    workerModel: process.env.DEEP_REVIEW_WORKER_MODEL || "sonnet",
    coordModel: process.env.DEEP_REVIEW_COORD_MODEL || "sonnet",
    notifyTarget: opts.notify || "",
    force: !!opts.force,
  };
}

/**
 * The program declaration — returns a Program describing all phases.
 */
export default function deepReview(opts: DeepReviewOpts): Program {
  return {
    name: "deep-review",
    description: "Multi-pass adversarial code review with dynamic role design",
    phases: [
      // ── Phase 0: Role Designer (Opus) ──────────────────────────
      {
        name: "planning",
        description: "Opus designs optimal review team composition from the material",
        agents: [{
          name: "role-designer",
          role: "role-designer",
          model: "opus",
          seed: { template: "deep-review/role-designer-seed.md" },
          window: "planning",
        }],
      },

      // ── Phase 1: REVIEW.md Improver (Opus, optional) ──────────
      ...(!opts.noImproveReview ? [{
        name: "improve-review",
        description: "Opus improves REVIEW.md based on role designer output",
        agents: [{
          name: "review-improver",
          role: "improver",
          model: "opus",
          seed: { template: "deep-review/review-improver-seed.md" },
          window: "planning",
        }] as AgentSpec[],
        prelaunch: [
          { type: "parse-output" as const, agent: "role-designer", file: "roles.json" },
        ],
      }] : []),

      // ── Phase 2: Review Workers (dynamic count from role designer) ──
      {
        name: "review",
        description: "Parallel adversarial review workers + coordinator",
        agents: {
          generator: "generateReviewWorkers",
          estimate: opts.maxWorkers || opts.passesPerFocus * 8,
          fallback: defaultWorkers(opts),
        },
        gate: "coordinator",
        layout: { panesPerWindow: 4, algorithm: "tiled" },
        prelaunch: [
          ...(!opts.noImproveReview ? [
            { type: "parse-output" as const, agent: "review-improver", file: "review-md-improved.md" },
          ] : []),
          { type: "context-prepass" as const },
          { type: "shuffle-material" as const },
        ],
      },

      // ── Phase 3: Verification (optional, FIFO-gated on coordinator) ──
      ...(opts.verify ? [{
        name: "verification",
        description: "Chrome MCP, curl, test suite, and script verification",
        agents: verifierAgents(opts),
        gate: "all" as const,
      }] : []),
    ],
    defaults: {
      model: opts.workerModel,
      effort: "high",
      permission: "bypassPermissions",
    },
    material: {
      scope: opts.scope,
      contentFiles: opts.contentFiles,
      spec: opts.spec,
    },
  };
}

// ── Dynamic Generator (called at bridge time) ────────────────────

/**
 * Generate review workers from role designer output.
 * Called by the bridge when Phase 2 compiles.
 */
export function generateReviewWorkers(
  state: ProgramPipelineState,
  defaults: ProgramDefaults,
): AgentSpec[] {
  const roleResult = state.ext?.roleResult as {
    useDynamicRoles: boolean; focusAreas: string[]; numFocus: number;
    totalWorkers: number; passesPerFocus: number; roleNames: string;
  } | undefined;

  if (!roleResult || !roleResult.useDynamicRoles) {
    console.log("[generator] No dynamic roles, using default workers");
    const opts = state.opts as unknown as DeepReviewOpts;
    return defaultWorkers(opts);
  }

  const agents: AgentSpec[] = [];
  const model = defaults.model || "sonnet";

  // Create review workers
  for (let i = 0; i < roleResult.totalWorkers; i++) {
    const focus = roleResult.focusAreas[i];
    const windowGroup = Math.floor(i / 4) + 1;

    // Count this worker's pass number within its focus
    let passInFocus = 0;
    for (let j = 0; j <= i; j++) {
      if (roleResult.focusAreas[j] === focus) passInFocus++;
    }
    const focusTotal = roleResult.focusAreas.filter(fa => fa === focus).length;

    // Resolve attack vectors (custom from roles.json or built-in)
    let attackVectors = "";
    const avFile = join(state.sessionDir, `av-${focus}.txt`);
    if (existsSync(avFile)) {
      attackVectors = readFileSync(avFile, "utf-8");
    }

    agents.push({
      name: `worker-${i + 1}`,
      role: "reviewer",
      model,
      seed: { template: "deep-review/worker-seed.md" },
      window: `workers-${windowGroup}`,
      vars: {
        PASS_NUMBER: String(i + 1),
        PASS_IN_FOCUS: String(passInFocus),
        PASSES_PER_FOCUS: String(focusTotal),
        NUM_PASSES: String(roleResult.totalWorkers),
        SPECIALIZATION: focus,
        ROLE_ID: focus,
        ATTACK_VECTORS: attackVectors,
        SPEC: (state.ext?.spec as string) || "",
        MATERIAL_FILE: join(state.sessionDir, `material-pass-${i + 1}.txt`),
        OUTPUT_FILE: join(state.sessionDir, `findings-pass-${i + 1}.json`),
        DONE_FILE: join(state.sessionDir, `pass-${i + 1}.done`),
      },
    });
  }

  // Coordinator
  const reportFile = join(state.sessionDir, "report.md");
  agents.push({
    name: "coordinator",
    role: "coordinator",
    model: (state.opts as any).coordModel || "sonnet",
    seed: { template: "deep-review/coordinator-seed.md" },
    window: "coordinator",
    vars: {
      SESSION_ID: state.sessionHash,
      NUM_PASSES: String(roleResult.totalWorkers),
      PASSES_PER_FOCUS: String(roleResult.passesPerFocus),
      NUM_FOCUS: String(roleResult.numFocus),
      FOCUS_LIST: roleResult.focusAreas.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(","),
      REPORT_FILE: reportFile,
      NOTIFY_TARGET: (state.opts as any).notifyTarget || "",
      REVIEW_SESSION: state.tmuxSession,
      DIFF_DESC: state.material?.diffDesc || "",
      MATERIAL_TYPES: state.material?.materialTypesStr || "",
    },
    hooks: [{
      event: "Stop",
      type: "command",
      command: buildCoordinatorStopScript({
        sessionDir: state.sessionDir,
        tmuxSession: state.tmuxSession,
        reportFile,
        launchingPane: (state.ext?.launchingPane as string) || "",
        notifyTarget: (state.opts as any).notifyTarget || "",
        cleanupScript: join(state.sessionDir, "cleanup.sh"),
      }),
      blocking: false,
      description: "System: notify launcher, schedule cleanup in 20min",
    }],
  });

  // Judge (if enabled)
  if (!(state.opts as any).noJudge) {
    agents.push({
      name: "judge",
      role: "judge",
      model,
      seed: { template: "deep-review/judge-seed.md" },
      window: "coordinator",
      vars: {
        NUM_PASSES: String(roleResult.totalWorkers),
      },
    });
  }

  // Build and write worker roster
  const roster = agents
    .filter(a => a.role === "reviewer")
    .map((a, i) => `- Worker ${i + 1}: ${a.vars?.SPECIALIZATION || "general"}`)
    .join("\n");
  const { writeFileSync } = require("node:fs");
  writeFileSync(join(state.sessionDir, "worker-roster.txt"), roster);

  return agents;
}

/**
 * Parse role designer output — prelaunch action for Phase 1/2.
 */
export function parse_role_designer_output(state: ProgramPipelineState): void {
  const rolesFile = join(state.sessionDir, "roles.json");

  if (!existsSync(rolesFile)) {
    console.log("[parse] roles.json not found, will use fallback workers");
    return;
  }

  try {
    const roles = JSON.parse(readFileSync(rolesFile, "utf-8"));
    if (!roles.roles || !Array.isArray(roles.roles)) {
      console.log("[parse] Invalid roles.json structure");
      return;
    }

    const focusAreas: string[] = [];
    const roleNameParts: string[] = [];
    let maxPassesPerFocus = 1;

    for (const role of roles.roles) {
      const roleId = role.id;
      const rolePasses = role.passes || 1;
      const roleAv = role.attack_vectors || "";

      // Write attack vectors file
      const { writeFileSync: wf } = require("node:fs");
      wf(join(state.sessionDir, `av-${roleId}.txt`), roleAv);
      roleNameParts.push(`${roleId}(×${rolePasses})`);

      for (let j = 0; j < rolePasses; j++) {
        focusAreas.push(roleId);
      }

      if (rolePasses > maxPassesPerFocus) maxPassesPerFocus = rolePasses;
    }

    const result = {
      useDynamicRoles: true,
      focusAreas,
      numFocus: roles.roles.length,
      totalWorkers: focusAreas.length,
      passesPerFocus: maxPassesPerFocus,
      roleNames: roleNameParts.join(", "),
    };

    if (!state.ext) state.ext = {};
    state.ext.roleResult = result;

    console.log(`[parse] Roles: ${result.roleNames}`);
    console.log(`[parse] Total workers: ${result.totalWorkers}`);
  } catch (err) {
    console.log(`[parse] Failed to parse roles.json: ${err}`);
  }
}

/**
 * Parse improver output — prelaunch action for Phase 2.
 */
export function parse_review_improver_output(state: ProgramPipelineState): void {
  const outputFile = join(state.sessionDir, "review-md-improved.md");

  if (!existsSync(outputFile)) {
    console.log("[parse] Improver did not produce output, using original REVIEW.md");
    return;
  }

  const improved = readFileSync(outputFile, "utf-8").trim();
  if (improved && improved.length >= 50) {
    // Save original for comparison
    const origReview = state.ext?.reviewConfig as string;
    if (origReview) {
      const { writeFileSync: wf } = require("node:fs");
      wf(join(state.sessionDir, "review-md-original.md"), origReview);
    }

    if (!state.ext) state.ext = {};
    state.ext.reviewConfig = improved;
    console.log("[parse] REVIEW.md improved and applied");
  }
}

// ── Default/Fallback Workers ─────────────────────────────────────

function defaultWorkers(opts: DeepReviewOpts): AgentSpec[] {
  const model = opts.workerModel || "sonnet";
  const isCodebase = opts.scope === "codebase";
  const defaultFocus = isCodebase
    ? [...DEFAULT_CODEBASE_FOCUS]
    : ["security", "logic", "error-handling", "data-integrity", "performance", "architecture"];
  const focusAreas = opts.focusAreas.length > 0
    ? opts.focusAreas
    : defaultFocus;

  const agents: AgentSpec[] = [];
  let workerNum = 1;

  for (const focus of focusAreas) {
    for (let p = 0; p < opts.passesPerFocus; p++) {
      const windowGroup = Math.floor((workerNum - 1) / 4) + 1;
      agents.push({
        name: `worker-${workerNum}`,
        role: "reviewer",
        model,
        seed: { template: "deep-review/worker-seed.md" },
        window: `workers-${windowGroup}`,
        vars: {
          PASS_NUMBER: String(workerNum),
          PASS_IN_FOCUS: String(p + 1),
          PASSES_PER_FOCUS: String(opts.passesPerFocus),
          NUM_PASSES: String(focusAreas.length * opts.passesPerFocus),
          SPECIALIZATION: focus,
          ROLE_ID: focus,
        },
      });
      workerNum++;
    }
  }

  // Coordinator
  agents.push({
    name: "coordinator",
    role: "coordinator",
    model: opts.coordModel || "sonnet",
    seed: { template: "deep-review/coordinator-seed.md" },
    window: "coordinator",
  });

  return agents;
}

/**
 * Build a bash script for the coordinator's Stop hook.
 * Handles: notification, tmux send-keys to launcher, done marker, 20-min cleanup timer.
 */
function buildCoordinatorStopScript(opts: {
  sessionDir: string;
  tmuxSession: string;
  reportFile: string;
  launchingPane: string;
  notifyTarget: string;
  cleanupScript: string;
}): string {
  const fleetDir = process.env.CLAUDE_FLEET_DIR || join(process.env.HOME || "/tmp", ".claude-fleet");
  // The hook system expects a single-line command; use a heredoc via bash -c
  // or write a script file and reference it. Since PipelineHook.command is
  // executed as `bash -c "$command"`, we write a multi-line script.
  return [
    `#!/usr/bin/env bash`,
    `set -euo pipefail`,
    `REPORT_FILE="${opts.reportFile}"`,
    `SESSION_DIR="${opts.sessionDir}"`,
    `TMUX_SESSION="${opts.tmuxSession}"`,
    `FLEET_DIR="${fleetDir}"`,
    `FINDINGS=$(grep -c '###' "$REPORT_FILE" 2>/dev/null || echo 0)`,
    ``,
    `# 1. Done marker`,
    `echo "complete" > "$SESSION_DIR/review.done"`,
    ``,
    `# 2. Desktop notification`,
    `"$FLEET_DIR/bin/notify" "Deep review complete: $FINDINGS findings" "Deep Review" "file://$REPORT_FILE" 2>/dev/null || true`,
    ``,
    `# 3. Notify launching worker's tmux pane`,
    opts.launchingPane ? [
      `tmux send-keys -t "${opts.launchingPane}" "" C-c 2>/dev/null || true`,
      `tmux send-keys -t "${opts.launchingPane}" "echo '--- DEEP REVIEW COMPLETE ($FINDINGS findings) ---'" Enter 2>/dev/null || true`,
      `tmux send-keys -t "${opts.launchingPane}" "echo 'Report: $REPORT_FILE'" Enter 2>/dev/null || true`,
      `tmux send-keys -t "${opts.launchingPane}" "echo 'Read it now. Workers cleaned up in 20min.'" Enter 2>/dev/null || true`,
    ].join("\n") : "# No launching pane to notify",
    ``,
    `# 4. Fleet Mail notification`,
    opts.notifyTarget ? [
      `if [ -n "\${FLEET_MAIL_URL:-}" ] && [ -n "\${FLEET_MAIL_TOKEN:-}" ]; then`,
      `  curl -s -X POST "\${FLEET_MAIL_URL}/api/messages" \\`,
      `    -H "Authorization: Bearer \${FLEET_MAIL_TOKEN}" \\`,
      `    -H "Content-Type: application/json" \\`,
      `    -d "{\\"to\\":\\"${opts.notifyTarget}\\",\\"subject\\":\\"REVIEW DONE\\",\\"body\\":\\"Report: $REPORT_FILE | Findings: $FINDINGS | Read now, cleanup in 20min.\\"}" > /dev/null 2>&1 || true`,
      `fi`,
    ].join("\n") : "# No notify target",
    ``,
    `# 5. Schedule tmux session kill + fleet cleanup in 20 minutes`,
    `nohup bash -c 'sleep 1200 && tmux kill-session -t "${opts.tmuxSession}" 2>/dev/null; bash "${opts.cleanupScript}" 2>/dev/null' \\`,
    `  > "$SESSION_DIR/auto-cleanup.log" 2>&1 &`,
    `disown`,
  ].join("\n");
}

function verifierAgents(opts: DeepReviewOpts): AgentSpec[] {
  const model = opts.workerModel || "sonnet";
  const types = ["chrome", "curl", "test", "script"];

  return types.map(vtype => ({
    name: `verifier-${vtype}`,
    role: "verifier",
    model,
    seed: { template: "deep-review/verifier-seed.md" },
    window: "verifiers",
    vars: {
      VERIFY_TYPE: vtype,
      VERIFY_ROLES: opts.verifyRoles || "",
    },
  }));
}
