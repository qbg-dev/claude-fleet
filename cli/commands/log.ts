import type { Command } from "commander";
import { resolveProject } from "../lib/paths";
import { getState } from "../lib/config";
import { capturePane, listPaneIds } from "../lib/tmux";
import { fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const sub = parent
    .command("log <name>")
    .alias("logs")
    .description("Tail worker's tmux pane output")
    .option("-n <lines>", "Number of lines", "100");
  addGlobalOpts(sub)
    .action((name: string, opts: { n: string }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project || resolveProject();
      const state = getState(project, name);
      if (!state) return fail(`State not found for '${name}'`);

      const paneId = state.pane_id;
      if (!paneId) return fail(`'${name}' has no active pane`);
      if (!listPaneIds().has(paneId)) return fail(`Pane ${paneId} no longer exists`);

      const lines = parseInt(opts.n, 10) || 100;
      console.log(capturePane(paneId, lines));
    });
}
