import type { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { FLEET_DATA } from "../lib/paths";
import { ok, info, fail } from "../lib/fmt";
import { addGlobalOpts } from "../index";
import { readJson, writeJson } from "../../shared/io";

function resolveProject(override?: string): string {
  if (override) return override;
  if (process.env.FLEET_PROJECT) return process.env.FLEET_PROJECT;

  // Auto-detect from cwd
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stderr: "pipe" });
    if (result.exitCode === 0) {
      const root = result.stdout.toString().trim();
      const name = root.split("/").pop()!.replace(/-w-.*$/, "");
      if (existsSync(join(FLEET_DATA, name))) return name;
    }
  } catch {}

  // First project dir
  try {
    const entries = require("node:fs").readdirSync(FLEET_DATA, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) return e.name;
    }
  } catch {}

  return "unknown";
}

function getFleetJson(project: string): Record<string, any> {
  const path = join(FLEET_DATA, project, "fleet.json");
  return (readJson<Record<string, any>>(path)) || {};
}

function saveFleetJson(project: string, data: Record<string, any>): void {
  const path = join(FLEET_DATA, project, "fleet.json");
  writeJson(path, data);
}

function getSession(project: string): string {
  const fj = getFleetJson(project);
  return fj.tmux_session || "w";
}

async function saveLayout(project: string, window: string): Promise<void> {
  const session = getSession(project);
  const target = `${session}:${window}`;

  // Capture layout string
  const result = Bun.spawnSync(
    ["tmux", "list-windows", "-t", target, "-F", "#{window_layout}"],
    { stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    fail(`Window '${window}' not found in session '${session}'`);
  }

  const layout = result.stdout.toString().trim();
  if (!layout) fail("Could not capture layout");

  const fj = getFleetJson(project);
  if (!fj.layouts) fj.layouts = {};
  fj.layouts[window] = layout;
  saveFleetJson(project, fj);

  ok(`Saved layout for '${window}': ${layout.slice(0, 40)}...`);
}

async function restoreLayout(project: string, window: string): Promise<void> {
  const fj = getFleetJson(project);
  const layout = fj.layouts?.[window];
  if (!layout) fail(`No saved layout for '${window}'`);

  const session = getSession(project);
  const target = `${session}:${window}`;

  const result = Bun.spawnSync(
    ["tmux", "select-layout", "-t", target, layout],
    { stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    fail(`Failed to restore layout for '${window}' in session '${session}'`);
  }

  ok(`Restored layout for '${window}'`);
}

async function listLayouts(project: string): Promise<void> {
  const fj = getFleetJson(project);
  const layouts = fj.layouts || {};

  if (Object.keys(layouts).length === 0) {
    info("No saved layouts");
    return;
  }

  console.log(chalk.bold("Saved Layouts\n"));
  for (const [window, layout] of Object.entries(layouts)) {
    console.log(`  ${chalk.cyan(window)}: ${(layout as string).slice(0, 60)}...`);
  }
}

async function deleteLayout(project: string, window: string): Promise<void> {
  const fj = getFleetJson(project);
  if (!fj.layouts?.[window]) {
    fail(`No saved layout for '${window}'`);
  }

  delete fj.layouts[window];
  if (Object.keys(fj.layouts).length === 0) delete fj.layouts;
  saveFleetJson(project, fj);

  ok(`Deleted layout for '${window}'`);
}

export function register(parent: Command): void {
  const sub = parent
    .command("layout <action> [window]")
    .description("Save/restore tmux window layouts")
    .addHelpText("after", `
Actions:
  save <window>     Capture current layout of window
  restore <window>  Apply saved layout to window
  list              Show all saved layouts
  delete <window>   Remove saved layout
`);

  addGlobalOpts(sub)
    .action(async (action: string, window: string | undefined, _opts: Record<string, unknown>, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      const project = resolveProject(globalOpts.project as string | undefined);

      switch (action) {
        case "save":
          if (!window) fail("Window name required: fleet layout save <window>");
          return saveLayout(project, window!);
        case "restore":
          if (!window) fail("Window name required: fleet layout restore <window>");
          return restoreLayout(project, window!);
        case "list":
        case "ls":
          return listLayouts(project);
        case "delete":
        case "rm":
          if (!window) fail("Window name required: fleet layout delete <window>");
          return deleteLayout(project, window!);
        default:
          fail(`Unknown action: ${action}\n\nUsage: fleet layout <save|restore|list|delete> [window]`);
      }
    });
}
