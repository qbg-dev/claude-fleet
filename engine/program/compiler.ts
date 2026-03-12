/**
 * Compiler — walks a Program declaration and produces CompiledPlan.
 *
 * Two modes:
 *   - Eager: compiles static phases whose agent count is known at launch.
 *   - Deferred: dynamic phases are compiled by the bridge at runtime.
 *
 * The compiler calls seed-resolver, hook-generator, fleet-provision for each phase.
 */
import { writeFileSync, readFileSync as fsReadFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Program,
  Phase,
  AgentSpec,
  CompiledPlan,
  CompiledPhase,
  CompiledWindow,
  CompiledWorker,
  ProgramPipelineState,
} from "./types";
import { isDynamic } from "./types";
import { resolveSeedToFile, buildStateVars } from "./seed-resolver";
import { installStopHook, installPipelineHooks } from "./hook-generator";
import { FLEET_DATA } from "../../cli/lib/paths";

const HOME = process.env.HOME || "/tmp";

/**
 * Compile a full program (eager pass).
 * Static phases get fully compiled. Dynamic phases get placeholders.
 */
export function compile(
  program: Program,
  state: ProgramPipelineState,
): CompiledPlan {
  const plan: CompiledPlan = {
    program: { name: program.name, description: program.description },
    phases: [],
    windows: [],
    workers: [],
    hooks: [],
    sessionDir: state.sessionDir,
    programPath: state.programPath,
  };

  for (let i = 0; i < program.phases.length; i++) {
    const phase = program.phases[i];

    if (isDynamic(phase.agents)) {
      // Deferred compilation — placeholder
      const estimate = phase.agents.estimate || 4;
      plan.phases.push({
        index: i,
        name: phase.name,
        status: "deferred",
        agentCount: estimate,
        agentNames: [],
        dynamic: true,
        estimate,
      });

      // Pre-create estimated windows
      const panesPerWindow = phase.layout?.panesPerWindow || 4;
      const numWindows = Math.ceil(estimate / panesPerWindow);
      for (let w = 1; w <= numWindows; w++) {
        plan.windows.push({
          name: `${phase.name}-${w}`,
          paneCount: Math.min(panesPerWindow, estimate - (w - 1) * panesPerWindow),
          phase: phase.name,
          layout: phase.layout?.algorithm || "tiled",
        });
      }
    } else {
      // Eager compilation
      const compiled = compilePhase(i, phase.agents, phase, state);
      plan.phases.push(compiled.phase);
      plan.windows.push(...compiled.windows);
      plan.workers.push(...compiled.workers);
    }

    // Hook chain: current phase's gate agent -> next phase bridge
    const nextPhaseIndex = resolveNextPhase(phase, i, program.phases.length);
    if (nextPhaseIndex !== null) {
      // Install stop hooks on gate agents (only for eager phases)
      if (!isDynamic(phase.agents)) {
        const gateAgents = resolveGateAgents(phase, phase.agents);
        const isGateAll = phase.gate === "all";

        // Build convergence opts if this phase cycles
        const convergenceOpts = phase.convergence ? {
          check: phase.convergence.check,
          maxIterations: phase.convergence.maxIterations || 10,
          nextPhase: nextPhaseIndex,
          cyclePhase: typeof phase.next === "number" ? phase.next : i,
        } : undefined;

        for (const gateAgent of gateAgents) {
          installStopHook(
            gateAgent.name,
            state.fleetProject,
            "",
            state.sessionDir,
            nextPhaseIndex,
            {
              ...(isGateAll ? { gateCount: gateAgents.length } : {}),
              ...(convergenceOpts ? { convergence: convergenceOpts } : {}),
            },
          );

          plan.hooks.push({
            workerName: gateAgent.name,
            targetPhaseIndex: nextPhaseIndex,
            scriptPath: join(
              HOME, ".claude/fleet", state.fleetProject,
              gateAgent.name, "hooks", `phase-${nextPhaseIndex}-stop.sh`,
            ),
            sessionDirPath: state.sessionDir,
            gateCount: isGateAll ? gateAgents.length : undefined,
          });
        }
      }
    }

    // Install phase-level pipeline hooks (on all agents in this phase, eager only)
    if (phase.hooks && phase.hooks.length > 0 && !isDynamic(phase.agents)) {
      for (const agent of phase.agents) {
        const workerHooksDir = join(FLEET_DATA, state.fleetProject, agent.name, "hooks");
        // Fire-and-forget async — hooks are written before agents launch
        installPipelineHooks(workerHooksDir, phase.hooks, state.programName).catch(() => {});
      }
    }

    // Install per-agent pipeline hooks (eager only)
    if (!isDynamic(phase.agents)) {
      for (const agent of phase.agents) {
        if (agent.hooks && agent.hooks.length > 0) {
          const workerHooksDir = join(FLEET_DATA, state.fleetProject, agent.name, "hooks");
          installPipelineHooks(workerHooksDir, agent.hooks, state.programName).catch(() => {});
        }
      }
    }
  }

  return plan;
}

/**
 * Resolve the next phase index for a phase.
 * Returns null if this is the last phase (no transition needed).
 */
function resolveNextPhase(phase: Phase, currentIndex: number, totalPhases: number): number | null {
  if (phase.next !== undefined) {
    if (typeof phase.next === "number") return phase.next;
    // String reference — resolve by name (would need phases array, for now use i+1)
    return currentIndex + 1 < totalPhases ? currentIndex + 1 : null;
  }
  // Default: next sequential phase
  return currentIndex + 1 < totalPhases ? currentIndex + 1 : null;
}

/**
 * Compile a single phase from resolved agent specs.
 * Used both during eager compilation and by the bridge for deferred phases.
 */
export function compilePhase(
  phaseIndex: number,
  agents: AgentSpec[],
  phase: Phase,
  state: ProgramPipelineState,
): {
  phase: CompiledPhase;
  windows: CompiledWindow[];
  workers: CompiledWorker[];
} {
  const stateVars = buildStateVars(state);
  const defaultModel = state.defaults.model || "sonnet";
  const panesPerWindow = phase.layout?.panesPerWindow || 4;

  // Group agents by window
  const windowMap = new Map<string, AgentSpec[]>();
  for (const agent of agents) {
    const win = agent.window || phase.name;
    if (!windowMap.has(win)) windowMap.set(win, []);
    windowMap.get(win)!.push(agent);
  }

  const windows: CompiledWindow[] = [];
  const workers: CompiledWorker[] = [];

  for (const [winName, winAgents] of windowMap) {
    // Split large windows into multiple (4 panes each)
    const numSubWindows = Math.ceil(winAgents.length / panesPerWindow);

    for (let sw = 0; sw < numSubWindows; sw++) {
      const subAgents = winAgents.slice(sw * panesPerWindow, (sw + 1) * panesPerWindow);
      const windowName = numSubWindows > 1 ? `${winName}-${sw + 1}` : winName;

      windows.push({
        name: windowName,
        paneCount: subAgents.length,
        phase: phase.name,
        layout: phase.layout?.algorithm || "tiled",
      });

      for (let p = 0; p < subAgents.length; p++) {
        const agent = subAgents[p];
        const model = agent.model || defaultModel;

        // Resolve seed
        const seedPath = resolveSeedToFile(
          agent,
          state,
          state.sessionDir,
          { ...stateVars, ...(agent.vars || {}) },
        );

        const wrapperPath = join(state.sessionDir, `run-${agent.name}.sh`);

        workers.push({
          name: agent.name,
          role: agent.role,
          model,
          seedPath,
          wrapperPath,
          window: windowName,
          paneIndex: p,
          phaseIndex,
        });
      }
    }
  }

  const compiledPhase: CompiledPhase = {
    index: phaseIndex,
    name: phase.name,
    status: "compiled",
    agentCount: agents.length,
    agentNames: agents.map(a => a.name),
    dynamic: false,
  };

  return { phase: compiledPhase, windows, workers };
}

/**
 * Resolve which agents are the "gate" for a phase.
 * - Default: last agent only
 * - "all": all agents
 * - specific name: that agent
 */
function resolveGateAgents(phase: Phase, agents: AgentSpec[]): AgentSpec[] {
  if (!phase.gate || phase.gate === "all") {
    return phase.gate === "all" ? agents : [agents[agents.length - 1]];
  }

  const named = agents.find(a => a.name === phase.gate);
  return named ? [named] : [agents[agents.length - 1]];
}

/**
 * Serialize pipeline state for bridge scripts.
 */
export function savePipelineState(state: ProgramPipelineState): void {
  writeFileSync(
    join(state.sessionDir, "pipeline-state.json"),
    JSON.stringify(state, null, 2),
  );
}

/**
 * Load pipeline state from session directory.
 */
export function loadPipelineState(sessionDir: string): ProgramPipelineState {
  const content = fsReadFileSync(join(sessionDir, "pipeline-state.json"), "utf-8");
  return JSON.parse(content) as ProgramPipelineState;
}
