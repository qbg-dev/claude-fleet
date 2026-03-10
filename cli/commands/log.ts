import { defineCommand } from "citty";
import { resolveProject } from "../lib/paths";
import { getState } from "../lib/config";
import { capturePane, listPaneIds } from "../lib/tmux";
import { fail } from "../lib/fmt";

export default defineCommand({
  meta: { name: "log", description: "Tail worker's tmux pane output" },
  args: {
    name:    { type: "positional", description: "Worker name", required: true },
    n:       { type: "string", description: "Number of lines", default: "100" },
    project: { type: "string", description: "Override project detection" },
  },
  run({ args }) {
    const name = args.name;
    if (!name) fail("Worker name is required");
    const project = args.project || resolveProject();
    const state = getState(project, name);
    if (!state) return fail(`State not found for '${name}'`);

    const paneId = state.pane_id;
    if (!paneId) return fail(`'${name}' has no active pane`);
    if (!listPaneIds().has(paneId)) return fail(`Pane ${paneId} no longer exists`);

    const lines = parseInt(args.n, 10) || 100;
    console.log(capturePane(paneId, lines));
  },
});
