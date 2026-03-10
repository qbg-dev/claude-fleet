import type { Command } from "commander";
import { readFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SESSION, workerDir, resolveProject,
} from "../lib/paths";
import {
  getConfig, getFleetConfig, generateLaunchSh, writeJsonLocked,
} from "../lib/config";
import { info, ok, fail } from "../lib/fmt";
import { launchInTmux } from "../lib/launch";
import { addGlobalOpts } from "../index";

export function register(parent: Command): void {
  const sub = parent
    .command("start <name>")
    .alias("restart")
    .description("Start or restart an existing worker")
    .option("--model <model>", "Override model")
    .option("--effort <effort>", "Override effort")
    .option("--permission-mode <mode>", "Override permission mode")
    .option("--window <name>", "tmux window group")
    .option("--window-index <index>", "Explicit window position")
    .option("--save", "Persist flag overrides to config");
  addGlobalOpts(sub)
    .action(async (name: string, opts: {
      model?: string; effort?: string; permissionMode?: string;
      window?: string; windowIndex?: string; save?: boolean;
    }, cmd: Command) => {
      const project = cmd.optsWithGlobals().project as string || resolveProject();
      const dir = workerDir(project, name);
      const configPath = join(dir, "config.json");

      if (!existsSync(dir)) fail(`Worker '${name}' not found in project '${project}'`);
      if (!existsSync(configPath)) fail(`No config.json for '${name}'`);

      // Apply overrides
      const overrides: Record<string, string> = {};
      if (opts.model) overrides.model = opts.model;
      if (opts.effort) overrides.reasoning_effort = opts.effort;
      if (opts.permissionMode) overrides.permission_mode = opts.permissionMode;
      if (opts.window) overrides.window = opts.window;

      const hasOverrides = Object.keys(overrides).length > 0;
      const backupPath = `${configPath}.start-bak`;

      if (hasOverrides) {
        if (opts.save) {
          // Save to config permanently (locked — prevents CLI/MCP race)
          info("Saving overrides to config");
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          Object.assign(config, overrides);
          writeJsonLocked(configPath, config);
          generateLaunchSh(project, name);
          ok("Config updated + launch.sh regenerated");
        } else {
          // Temporary: backup, modify, launch, restore later
          copyFileSync(configPath, backupPath);
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          Object.assign(config, overrides);
          writeJsonLocked(configPath, config);
        }
      }

      const config = getConfig(project, name);
      const window = config?.window || name;
      const fleetConfig = getFleetConfig(project);
      const session = fleetConfig?.tmux_session || DEFAULT_SESSION;

      const windowIndex = opts.windowIndex ? parseInt(opts.windowIndex, 10) : undefined;

      try {
        await launchInTmux(name, project, session, window, windowIndex);
      } finally {
        // Restore config backup if temporary override + regenerate launch.sh
        if (hasOverrides && !opts.save && existsSync(backupPath)) {
          copyFileSync(backupPath, configPath);
          Bun.spawnSync(["rm", "-f", backupPath]);
          generateLaunchSh(project, name);
        }
      }
    });
}
