import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProject, workerDir } from "../lib/paths";
import { getConfig, getState } from "../lib/config";
import { fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const cmd = parent
    .command("get <name>")
    .description("Show a worker's mission and key info")
    .option("--mission-only", "Print only the mission text");
  addGlobalOpts(cmd)
    .action((name: string, opts: { missionOnly?: boolean }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project || resolveProject();
      const dir = workerDir(project, name);

      if (!existsSync(dir)) fail(`Worker '${name}' not found in project '${project}'`);

      const missionPath = join(dir, "mission.md");
      const mission = existsSync(missionPath) ? readFileSync(missionPath, "utf-8").trim() : null;

      if (opts.missionOnly) {
        if (mission) {
          console.log(mission);
        } else {
          fail(`No mission.md for worker '${name}'`);
        }
        return;
      }

      // Header
      const config = getConfig(project, name);
      const state = getState(project, name);

      console.log(`Worker: ${name}`);
      console.log(`Project: ${project}`);
      if (config) {
        console.log(`Model: ${config.model || "default"} | Effort: ${config.reasoning_effort || "default"} | Mode: ${config.permission_mode || "default"}`);
        if (config.sleep_duration != null) console.log(`Sleep: ${config.sleep_duration}s (perpetual)`);
        if (config.worktree) console.log(`Worktree: ${config.worktree}`);
      }
      if (state) {
        console.log(`Status: ${state.status || "unknown"}${state.cycles_completed ? ` | Cycles: ${state.cycles_completed}` : ""}`);
      }

      console.log("");
      if (mission) {
        console.log(mission);
      } else {
        console.log("(no mission.md)");
      }
    });
}
