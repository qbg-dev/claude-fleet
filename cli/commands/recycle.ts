import type { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FLEET_DATA, workerDir, resolveProject } from "../lib/paths";
import { getState, writeJsonLocked } from "../lib/config";
import { info, ok, warn, fail } from "../lib/fmt";
import { listPaneIds, killPane } from "../lib/tmux";
import { addGlobalOpts } from "../index";

/**
 * fleet recycle <name> — Kill a worker's session so the watchdog immediately respawns it.
 * Unlike `fleet start --force`, this sets status to "recycling" so the watchdog
 * picks it up on the next poll (30s max) with a fresh seed + config reload.
 */
export function register(parent: Command): void {
  const sub = parent
    .command("recycle <name>")
    .description("Restart a worker with fresh context (watchdog respawns immediately)")
    .option("-a, --all", "Recycle all workers");
  addGlobalOpts(sub)
    .action(async (name: string, opts: { all?: boolean }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project as string || resolveProject();

      if (opts.all) {
        const projectDir = join(FLEET_DATA, project);
        if (!existsSync(projectDir)) fail(`Project '${project}' not found`);
        const { readdirSync } = await import("node:fs");
        const workers = readdirSync(projectDir, { withFileTypes: true })
          .filter(d => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name))
          .map(d => d.name);
        for (const w of workers) {
          recycleOne(w, project);
        }
        ok(`Recycled ${workers.length} workers`);
        return;
      }

      recycleOne(name, project);
    });
}

function recycleOne(name: string, project: string): void {
  const dir = workerDir(project, name);
  if (!existsSync(dir)) { warn(`Worker '${name}' not found`); return; }

  const state = getState(project, name);
  const panes = listPaneIds();
  const paneId = state?.pane_id;

  // Clear sleep timer so watchdog respawns immediately
  const statePath = join(dir, "state.json");
  if (existsSync(statePath)) {
    try {
      const stateData = JSON.parse(require("node:fs").readFileSync(statePath, "utf-8"));
      stateData.status = "recycling";
      delete stateData.sleep_until;
      writeJsonLocked(statePath, stateData);
    } catch {}
  }

  if (paneId && panes.has(paneId)) {
    // Kill the pane — watchdog will detect dead pane and respawn
    killPane(paneId);
    ok(`Recycled '${name}' (killed pane ${paneId}) — watchdog will respawn`);
  } else {
    info(`Worker '${name}' not running — watchdog will start it on next poll`);
  }
}
