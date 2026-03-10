import type { Command } from "commander";
import { resolveProject } from "../lib/paths";
import { getState } from "../lib/config";
import { listPaneIds } from "../lib/tmux";
import { fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const cmd = parent
    .command("attach <name>")
    .description("Focus a worker's tmux pane");
  addGlobalOpts(cmd)
    .action((name: string, _opts: Record<string, unknown>, cmd: Command) => {
      const project = cmd.optsWithGlobals().project || resolveProject();
      const state = getState(project, name);
      if (!state) fail(`Worker '${name}' not found in project '${project}'`);

      const paneId = state!.pane_id;
      if (!paneId) fail(`Worker '${name}' has no active pane (status: ${state!.status})`);
      if (!listPaneIds().has(paneId)) fail(`Pane ${paneId} no longer exists. Try: fleet start ${name}`);

      // Switch to the worker's pane
      const result = Bun.spawnSync(["tmux", "select-pane", "-t", paneId]);
      if (result.exitCode !== 0) {
        // If select-pane fails (e.g., different session), try switch-client
        Bun.spawnSync(["tmux", "switch-client", "-t", paneId]);
      }
    });
}
