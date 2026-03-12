import type { Command } from "commander";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FLEET_DATA, workerDir, resolveProject } from "../lib/paths";
import { getState, writeJsonLocked } from "../lib/config";
import { info, ok, warn, fail } from "../lib/fmt";
import { gracefulStop, listPaneIds } from "../lib/tmux";
import { addGlobalOpts } from "../index";

async function stopWorker(name: string, project: string): Promise<void> {
  const dir = workerDir(project, name);
  const statePath = join(dir, "state.json");

  if (!existsSync(statePath)) {
    warn(`State not found for '${name}'`);
    return;
  }

  const state = getState(project, name);
  const paneId = state?.pane_id;

  if (!paneId) {
    warn(`'${name}' has no pane — marking standby`);
    writeJsonLocked(statePath, { ...state, status: "standby", pane_id: null, pane_target: null });
    return;
  }

  if (!listPaneIds().has(paneId)) {
    warn(`'${name}' pane ${paneId} is already gone — marking standby`);
    writeJsonLocked(statePath, { ...state, status: "standby", pane_id: null, pane_target: null });
    return;
  }

  info(`Stopping '${name}' (pane ${paneId})`);
  await gracefulStop(paneId);

  writeJsonLocked(statePath, { ...state, status: "standby", pane_id: null, pane_target: null });
  ok(`Worker '${name}' stopped (standby — watchdog will not respawn)`);
}

export function register(parent: Command): void {
  const sub = parent
    .command("stop [name]")
    .description("Graceful stop (use --all for all workers)")
    .option("-a, --all", "Stop all workers");
  addGlobalOpts(sub)
    .action(async (name: string | undefined, opts: { all?: boolean }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project as string || resolveProject();

      if (opts.all) {
        const projectDir = join(FLEET_DATA, project);
        if (!existsSync(projectDir)) fail(`Project not found: ${project}`);

        let stopped = 0;
        const workers = readdirSync(projectDir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name))
          .map((d) => d.name);

        for (const w of workers) {
          const state = getState(project, w);
          if (!state || (state.status !== "active" && state.status !== "sleeping")) continue;
          await stopWorker(w, project);
          stopped++;
        }

        if (stopped === 0) info("No active workers to stop");
        return;
      }

      if (!name) fail("Usage: fleet stop <name> [--all]");
      await stopWorker(name!, project);
    });
}
