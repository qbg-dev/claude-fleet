import type { Command } from "commander";
import { existsSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FLEET_DATA, resolveProject } from "../lib/paths";
import { info, ok, fail } from "../lib/fmt";

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function registerRename(program: Command): void {
  program
    .command("rename <old-name> <new-name>")
    .description("Rename a worker (updates state, config, and fleet registry)")
    .action(async (oldName: string, newName: string) => {
      if (!NAME_RE.test(newName)) fail(`Name must be kebab-case: ${newName}`);

      const project = resolveProject();
      const oldDir = join(FLEET_DATA, project, oldName);
      const newDir = join(FLEET_DATA, project, newName);

      if (!existsSync(oldDir)) fail(`Worker '${oldName}' not found in project '${project}'`);
      if (existsSync(newDir)) fail(`Worker '${newName}' already exists in project '${project}'`);

      // Rename directory
      renameSync(oldDir, newDir);

      // Update config.json if it exists
      const configPath = join(newDir, "config.json");
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        config.worker_name = newName;
        config.renamed_from = oldName;
        config.renamed_at = new Date().toISOString();
        writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
      }

      // Update state.json if it exists
      const statePath = join(newDir, "state.json");
      if (existsSync(statePath)) {
        const state = JSON.parse(readFileSync(statePath, "utf-8"));
        state.worker_name = newName;
        writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
      }

      ok(`Renamed '${oldName}' → '${newName}' in project '${project}'`);
      info(`Worker directory: ${newDir}`);
    });
}
