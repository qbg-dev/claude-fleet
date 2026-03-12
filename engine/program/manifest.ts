/**
 * Manifest generation — human-readable pipeline overview for window 0.
 *
 * Generated from the Program declaration at launch.
 * Updated by the bridge when dynamic phases compile (replaces DYNAMIC placeholders).
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Program, CompiledPhase, ProgramPipelineState } from "./types";
import { isDynamic } from "./types";

/**
 * Generate the initial manifest from the program declaration.
 */
export function generateManifest(
  program: Program,
  state: ProgramPipelineState,
  compiledPhases: CompiledPhase[],
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Phase listing
  let phasesSection = "";
  for (let i = 0; i < program.phases.length; i++) {
    const phase = program.phases[i];
    const compiled = compiledPhases[i];
    const status = i === 0 ? "RUNNING" : compiled?.status === "compiled" ? "READY" : `PENDING`;
    const dynamic = isDynamic(phase.agents) ? ", DYNAMIC" : "";

    phasesSection += `  Phase ${i}: ${phase.name.padEnd(20)} [${status}${dynamic}]\n`;

    if (compiled?.status === "compiled") {
      for (const name of compiled.agentNames) {
        phasesSection += `    ${name}\n`;
      }
    } else if (isDynamic(phase.agents)) {
      const est = phase.agents.estimate || "?";
      phasesSection += `    ~${est} agents — count determined by previous phase\n`;
      if (phase.agents.fallback) {
        phasesSection += `    Fallback: ${phase.agents.fallback.length} static agents\n`;
      }
    } else {
      for (const agent of phase.agents) {
        const model = agent.model || state.defaults.model || "default";
        phasesSection += `    ${agent.name} (${model})\n`;
      }
    }

    // Show phase hooks
    if (phase.hooks && phase.hooks.length > 0) {
      phasesSection += `    Hooks: ${phase.hooks.map(h => `${h.event}:${h.type}`).join(", ")}\n`;
    }

    // Show convergence
    if (phase.convergence) {
      const max = phase.convergence.maxIterations || 10;
      phasesSection += `    Convergence: max ${max} iterations\n`;
    }

    phasesSection += "\n";
  }

  // Hook chain
  let hookChain = "";
  for (let i = 0; i < program.phases.length - 1; i++) {
    const phase = program.phases[i];
    const gate = phase.gate || "last agent";

    if (phase.convergence) {
      const nextIdx = phase.next !== undefined ? phase.next : i + 1;
      const max = phase.convergence.maxIterations || 10;
      hookChain += `  ${gate} Stop → convergence check → cycle to Phase ${i} (max ${max}x) or → Phase ${nextIdx}\n`;
    } else if (phase.next !== undefined) {
      hookChain += `  ${gate} Stop → bridge → Phase ${phase.next}\n`;
    } else {
      const nextPhase = program.phases[i + 1];
      hookChain += `  ${gate} Stop → bridge → ${nextPhase.name}\n`;
    }
  }

  // Window listing
  let windowList = "  :0 manifest\n";
  // Agent windows (estimated from phases)
  const windowNames = new Set<string>();
  for (const phase of program.phases) {
    if (isDynamic(phase.agents)) {
      const est = phase.agents.estimate || 4;
      const numWindows = Math.ceil(est / (phase.layout?.panesPerWindow || 4));
      for (let w = 1; w <= numWindows; w++) {
        windowNames.add(`${phase.name}-${w}`);
      }
    } else {
      const agentWindows = new Set(phase.agents.map(a => a.window || phase.name));
      for (const w of agentWindows) {
        windowNames.add(w);
      }
    }
  }
  for (const name of windowNames) {
    windowList += `  :${name}\n`;
  }

  const manifest = `═══════════════════════════════════════════════════
  PIPELINE: ${program.name}
  Session:  ${state.tmuxSession}
  Created:  ${now}
═══════════════════════════════════════════════════

${state.material ? `MATERIAL
────────
  Scope:     ${state.material.diffDesc || state.material.materialType}
  Lines:     ${state.material.diffLines}
  Type:      ${state.material.materialType}
${state.spec ? `  Spec:      ${state.spec}\n` : ""}
` : ""}PHASES (${program.phases.length})
──────────
${phasesSection}
HOOK CHAIN
──────────
${hookChain}
WINDOWS
───────
${windowList}
FILES
─────
  Program:  ${state.programPath}
  State:    ${state.sessionDir}/pipeline-state.json
  Cleanup:  ${state.sessionDir}/cleanup.sh
  Manifest: ${state.sessionDir}/manifest.txt

ATTACH
──────
  tmux switch-client -t ${state.tmuxSession}
  tmux a -t ${state.tmuxSession}
`;

  const manifestPath = join(state.sessionDir, "manifest.txt");
  writeFileSync(manifestPath, manifest);
  return manifestPath;
}

/**
 * Update manifest after a dynamic phase compiles.
 * Replaces the DYNAMIC placeholder with actual agent details.
 */
export function updateManifest(
  state: ProgramPipelineState,
  phaseIndex: number,
  agentNames: string[],
): void {
  const manifestPath = join(state.sessionDir, "manifest.txt");
  if (!existsSync(manifestPath)) return;

  let content = readFileSync(manifestPath, "utf-8");

  // Replace PENDING status with COMPILED
  const pendingPattern = new RegExp(
    `(Phase ${phaseIndex}: \\S+\\s+)\\[PENDING[^\\]]*\\]`,
  );
  content = content.replace(pendingPattern, `$1[COMPILED]`);

  // Replace estimate line with actual agents
  const dynamicPattern = new RegExp(
    `    ~\\d+\\?? agents — count determined by previous phase\\n(    Fallback: \\d+ static agents\\n)?`,
  );
  const agentList = agentNames.map(n => `    ${n}`).join("\n") + "\n";
  content = content.replace(dynamicPattern, agentList);

  writeFileSync(manifestPath, content);
}
