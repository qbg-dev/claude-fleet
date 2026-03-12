/**
 * Hook generator — creates Stop hook scripts for phase transitions.
 *
 * Stop hooks run `bun bridge.ts` directly as a background process.
 * No FIFOs, no sidecar files, no bridge windows.
 *
 * For gate:"all" phases, each agent writes a .done marker file.
 * The last agent's hook checks the count before launching bridge.
 *
 * For cyclic phases, the hook checks convergence before deciding
 * whether to cycle back or proceed to the next phase.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FLEET_DATA } from "../../cli/lib/paths";
import type { PipelineHook } from "./types";
import { getHooksIO } from "./hooks-bridge";

const FLEET_DIR_DEFAULT = join(process.env.HOME || "/tmp", ".claude-fleet");

let _phCounter = 0;

/**
 * Generate a Stop hook script for a single agent -> next phase transition.
 * Returns the path to the generated script.
 */
export function generateStopHook(
  agentName: string,
  phaseIndex: number,
  sessionDir: string,
  opts?: {
    gateCount?: number;
    convergence?: { check: string; maxIterations: number; nextPhase: number; cyclePhase: number };
  },
): string {
  const hooksDir = join(sessionDir, "hooks", agentName);
  mkdirSync(hooksDir, { recursive: true });

  const scriptName = `phase-${phaseIndex}-stop.sh`;
  const scriptPath = join(hooksDir, scriptName);

  let script: string;

  if (opts?.convergence) {
    script = generateConvergenceStopHook(agentName, phaseIndex, sessionDir, opts.convergence);
  } else if (opts?.gateCount && opts.gateCount > 1) {
    script = generateGateAllStopHook(agentName, phaseIndex, sessionDir, opts.gateCount);
  } else {
    script = generateStandardStopHook(agentName, phaseIndex, sessionDir);
  }

  writeFileSync(scriptPath, script, { mode: 0o755 });
  return scriptPath;
}

/**
 * Standard Stop hook: launch bridge directly as background process.
 */
function generateStandardStopHook(
  agentName: string,
  phaseIndex: number,
  sessionDir: string,
): string {
  return `#!/usr/bin/env bash
# ${agentName} Stop -> Bridge Phase ${phaseIndex}
set -euo pipefail
FLEET_DIR="\${CLAUDE_FLEET_DIR:-${FLEET_DIR_DEFAULT}}"
SESSION_DIR="${sessionDir}"
nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${phaseIndex}" \\
  >> "$SESSION_DIR/bridge-${phaseIndex}.log" 2>&1 &
exit 0
`;
}

/**
 * Gate-all Stop hook: each agent writes a done marker.
 * The last one launches the bridge.
 */
function generateGateAllStopHook(
  agentName: string,
  phaseIndex: number,
  sessionDir: string,
  expectedCount: number,
): string {
  return `#!/usr/bin/env bash
# ${agentName} Stop -> gate-all check for Phase ${phaseIndex}
set -euo pipefail
SESSION_DIR="${sessionDir}"
echo "done" > "$SESSION_DIR/${agentName}.done"
ACTUAL=$(ls "$SESSION_DIR"/*.done 2>/dev/null | wc -l | tr -d ' ')
if [ "$ACTUAL" -ge ${expectedCount} ]; then
  FLEET_DIR="\${CLAUDE_FLEET_DIR:-${FLEET_DIR_DEFAULT}}"
  nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${phaseIndex}" \\
    >> "$SESSION_DIR/bridge-${phaseIndex}.log" 2>&1 &
fi
exit 0
`;
}

/**
 * Convergence Stop hook: check convergence condition before deciding
 * whether to cycle back or proceed to the next phase.
 */
function generateConvergenceStopHook(
  agentName: string,
  phaseIndex: number,
  sessionDir: string,
  convergence: { check: string; maxIterations: number; nextPhase: number; cyclePhase: number },
): string {
  return `#!/usr/bin/env bash
# ${agentName} Stop -> convergence check for Phase ${phaseIndex}
set -euo pipefail
SESSION_DIR="${sessionDir}"
FLEET_DIR="\${CLAUDE_FLEET_DIR:-${FLEET_DIR_DEFAULT}}"
CYCLE=$(cat "$SESSION_DIR/cycle-${phaseIndex}.count" 2>/dev/null || echo 0)
echo $((CYCLE + 1)) > "$SESSION_DIR/cycle-${phaseIndex}.count"
if [ "$CYCLE" -ge ${convergence.maxIterations} ] || (${convergence.check}); then
  nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${convergence.nextPhase}" \\
    >> "$SESSION_DIR/bridge-${convergence.nextPhase}.log" 2>&1 &
else
  nohup bun "$FLEET_DIR/engine/program/bridge.ts" "$SESSION_DIR" "${convergence.cyclePhase}" \\
    >> "$SESSION_DIR/bridge-${convergence.cyclePhase}.log" 2>&1 &
fi
exit 0
`;
}

/**
 * Install a generated Stop hook into a fleet worker's hooks directory.
 * Writes hooks.json + the script file into the worker's fleet dir.
 */
export function installStopHook(
  workerName: string,
  project: string,
  _hookScriptPath: string,
  sessionDir: string,
  phaseIndex: number,
  opts?: {
    gateCount?: number;
    convergence?: { check: string; maxIterations: number; nextPhase: number; cyclePhase: number };
  },
): void {
  const workerHooksDir = join(FLEET_DATA, project, workerName, "hooks");
  mkdirSync(workerHooksDir, { recursive: true });

  // Generate the stop hook script
  const scriptName = `phase-${phaseIndex}-stop.sh`;
  const destScript = join(workerHooksDir, scriptName);

  let scriptContent: string;
  if (opts?.convergence) {
    scriptContent = generateConvergenceStopHook(workerName, phaseIndex, sessionDir, opts.convergence);
  } else if (opts?.gateCount && opts.gateCount > 1) {
    scriptContent = generateGateAllStopHook(workerName, phaseIndex, sessionDir, opts.gateCount);
  } else {
    scriptContent = generateStandardStopHook(workerName, phaseIndex, sessionDir);
  }
  writeFileSync(destScript, scriptContent, { mode: 0o755 });

  // Write hooks.json using shared library format
  const hooks = {
    hooks: [{
      id: "dh-1",
      event: "Stop",
      description: `Bridge: phase-${phaseIndex} transition (${workerName})`,
      blocking: false,
      completed: false,
      status: "active" as const,
      lifetime: "persistent" as const,
      script_path: scriptName,
      registered_by: "program-api",
      ownership: "creator" as const,
      added_at: new Date().toISOString(),
    }],
  };

  writeFileSync(join(workerHooksDir, "hooks.json"), JSON.stringify(hooks, null, 2));
}

/**
 * Install pipeline hooks (phase-level or agent-level) into a worker's hooks dir.
 * Converts PipelineHook[] into DynamicHook format and writes to hooks.json.
 */
export async function installPipelineHooks(
  hooksDir: string,
  hooks: PipelineHook[],
  registeredBy: string,
): Promise<void> {
  const { addHookToFile, writeScriptFile } = await getHooksIO();

  for (const hook of hooks) {
    const id = `ph-${++_phCounter}`;
    const desc = hook.description || `Pipeline ${hook.event} hook`;

    const dynHook: Record<string, unknown> = {
      id,
      event: hook.event,
      description: desc,
      blocking: hook.blocking ?? (hook.event === "Stop"),
      completed: false,
      added_at: new Date().toISOString(),
      registered_by: registeredBy,
      ownership: "creator",
      status: "active",
      lifetime: "persistent",
    };

    if (hook.check) dynHook.check = hook.check;

    if (hook.command) {
      const filename = writeScriptFile(hooksDir, id, desc, hook.command);
      dynHook.script_path = filename;
    }

    if (hook.prompt) {
      dynHook.content = hook.prompt;
    }

    if (hook.matcher) {
      dynHook.condition = { tool: hook.matcher };
    }

    addHookToFile(hooksDir, dynHook);
  }
}
