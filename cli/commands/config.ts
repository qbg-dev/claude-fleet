import type { Command } from "commander";
import { resolveProject } from "../lib/paths";
import { getConfig, setConfigValue, resolveValue, parseCliValue } from "../lib/config";
import { ok, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const sub = parent
    .command("config <name> [key] [value]")
    .alias("cfg")
    .description("Get/set worker config")
    .option("--full", "Show full config including hooks");
  addGlobalOpts(sub)
    .action((name: string, key: string | undefined, value: string | undefined, opts: { full?: boolean }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project as string || resolveProject();
      const config = getConfig(project, name);
      if (!config) fail(`Config not found for '${name}' in '${project}'`);

      if (!key) {
        if (opts.full) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          // Summary view: hide hooks and mcp (noisy)
          const { hooks, mcp, ...summary } = config as unknown as Record<string, unknown>;
          const hookCount = Array.isArray(hooks) ? hooks.length : 0;
          console.log(JSON.stringify({ ...summary, hooks: `[${hookCount} hooks — use --full to show]` }, null, 2));
        }
        return;
      }

      if (!value) {
        // Get single key
        const val = resolveValue(project, name, key);
        console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val));
        return;
      }

      // Set key=value
      setConfigValue(project, name, key, parseCliValue(value));
      ok(`${key} → ${value} (launch.sh regenerated)`);
    });
}
