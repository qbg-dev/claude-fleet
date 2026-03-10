/**
 * Canonical path resolution for fleet infrastructure.
 * Single source of truth — every other module imports from here.
 */
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const HOME = process.env.HOME || process.env.USERPROFILE || "/tmp";

/** Infrastructure: scripts, hooks, MCP server, templates */
export const FLEET_DIR =
  process.env.CLAUDE_FLEET_DIR ||
  process.env.CLAUDE_OPS_DIR ||
  join(HOME, ".claude-fleet");

/** Data: per-project worker configs, states */
export const FLEET_DATA = join(HOME, ".claude", "fleet");

/**
 * Fleet Mail config — resolved from env > defaults.json > null.
 * Stored in defaults.json as fleet_mail_url and fleet_mail_token.
 */
function resolveMailConfig(): { url: string | null; token: string | null } {
  const envUrl = process.env.FLEET_MAIL_URL || null;
  const envToken = process.env.FLEET_MAIL_TOKEN || null;

  // Read from defaults.json
  let fileUrl: string | null = null;
  let fileToken: string | null = null;
  const dp = defaultsPath();
  if (existsSync(dp)) {
    try {
      const d = JSON.parse(readFileSync(dp, "utf-8"));
      if (d.fleet_mail_url) fileUrl = String(d.fleet_mail_url);
      if (d.fleet_mail_token) fileToken = String(d.fleet_mail_token);
    } catch {}
  }

  return {
    url: envUrl || fileUrl,
    token: envToken || fileToken,
  };
}

const _mailConfig = resolveMailConfig();

/** Fleet Mail server URL (null = not configured) */
export const FLEET_MAIL_URL: string | null = _mailConfig.url;

/** Fleet Mail admin token (null = not configured) */
export const FLEET_MAIL_TOKEN: string | null = _mailConfig.token;

/** Default tmux session */
export const DEFAULT_SESSION = "w";

/** Resolve worker directory */
export function workerDir(project: string, name: string): string {
  return join(FLEET_DATA, project, name);
}

/** Resolve worker config file */
export function configPath(project: string, name: string): string {
  return join(workerDir(project, name), "config.json");
}

/** Resolve worker state file */
export function statePath(project: string, name: string): string {
  return join(workerDir(project, name), "state.json");
}

/** Resolve defaults.json */
export function defaultsPath(): string {
  return join(FLEET_DATA, "defaults.json");
}

/** Resolve fleet.json for a project */
export function fleetJsonPath(project: string): string {
  return join(FLEET_DATA, project, "fleet.json");
}

/** Resolve the main project root from cwd */
export function resolveProjectRoot(cwd?: string): string {
  const dir = cwd || process.cwd();
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd: dir,
      stderr: "pipe",
    });
    if (result.exitCode === 0) return result.stdout.toString().trim();
  } catch {}
  return dir;
}

/** Extract project name (strip worktree suffix) */
export function resolveProject(root?: string): string {
  const r = root || resolveProjectRoot();
  const base = r.split("/").pop() || "unknown";
  return base.replace(/-w-.*$/, "");
}

/** Check if a file exists */
export function exists(p: string): boolean {
  return existsSync(p);
}
