import type { Command } from "commander";
import { readdirSync } from "node:fs";
import { FLEET_DATA } from "../lib/paths";
import { getConfig, getState } from "../lib/config";
import { listPaneIds } from "../lib/tmux";
import chalk from "chalk";
import { table, statusColor } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const sub = parent
    .command("list")
    .alias("ls")
    .description("List all workers");
  addGlobalOpts(sub)
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      const filterProject = globalOpts.project as string | undefined;
      const json = globalOpts.json as boolean;
      const panes = listPaneIds();
      const results: Array<{
        name: string; project: string; status: string; runtime: string;
        model: string; pane: string; window: string; branch: string;
      }> = [];

      // Iterate project dirs
      let projects: string[];
      try {
        projects = readdirSync(FLEET_DATA, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
      } catch {
        projects = [];
      }

      for (const project of projects) {
        if (filterProject && project !== filterProject) continue;

        let workers: string[];
        try {
          workers = readdirSync(`${FLEET_DATA}/${project}`, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !["missions", "_user", "_config"].includes(d.name))
            .map((d) => d.name);
        } catch {
          continue;
        }

        for (const name of workers) {
          const config = getConfig(project, name);
          const state = getState(project, name);
          if (!config || !state) continue;

          let status = state.status || "unknown";
          // Liveness check: active but pane gone → dead
          if (status === "active" && state.pane_id && !panes.has(state.pane_id)) {
            status = "dead";
          }

          results.push({
            name,
            project,
            status,
            runtime: config.runtime || "claude",
            model: config.model || "-",
            pane: state.pane_id || "-",
            window: config.window || "-",
            branch: config.branch || "-",
          });
        }
      }

      if (json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log("No workers found." + (filterProject ? ` (project: ${filterProject})` : ""));
        console.log(`  Run ${chalk.cyan("fleet create <name> <mission>")} to create one.`);
        return;
      }

      // Show RUNTIME column when any worker uses a non-default runtime
      const hasNonClaude = results.some(r => r.runtime !== "claude");
      // Show PROJECT column when workers span multiple projects
      const uniqueProjects = new Set(results.map(r => r.project));
      if (uniqueProjects.size > 1) {
        const headers = hasNonClaude
          ? ["NAME", "PROJECT", "RUNTIME", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"]
          : ["NAME", "PROJECT", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"];
        table(
          headers,
          results.map((r) => hasNonClaude
            ? [r.name, r.project, r.runtime, statusColor(r.status), r.model, r.pane, r.window, r.branch]
            : [r.name, r.project, statusColor(r.status), r.model, r.pane, r.window, r.branch]),
        );
      } else {
        const headers = hasNonClaude
          ? ["NAME", "RUNTIME", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"]
          : ["NAME", "STATUS", "MODEL", "PANE", "WINDOW", "BRANCH"];
        table(
          headers,
          results.map((r) => hasNonClaude
            ? [r.name, r.runtime, statusColor(r.status), r.model, r.pane, r.window, r.branch]
            : [r.name, statusColor(r.status), r.model, r.pane, r.window, r.branch]),
        );
      }
    });
}
