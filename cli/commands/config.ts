import { defineCommand } from "citty";
import { resolveProject } from "../lib/paths";
import { getConfig, setConfigValue, resolveValue, parseCliValue } from "../lib/config";
import { ok, fail } from "../lib/fmt";

export default defineCommand({
  meta: { name: "config", description: "Get/set worker config" },
  args: {
    name: { type: "positional", description: "Worker name", required: true },
    key: { type: "positional", description: "Config key", required: false },
    value: { type: "positional", description: "New value", required: false },
    project: { type: "string", description: "Override project detection" },
  },
  run({ args }) {
    const project = args.project || resolveProject();
    const config = getConfig(project, args.name);
    if (!config) fail(`Config not found for '${args.name}' in '${project}'`);

    if (!args.key) {
      // Show full config
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    if (!args.value) {
      // Get single key
      const val = resolveValue(project, args.name, args.key);
      console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val));
      return;
    }

    // Set key=value
    setConfigValue(project, args.name, args.key, parseCliValue(args.value));
    ok(`${args.key} → ${args.value} (launch.sh regenerated)`);
  },
});
